import {
  isMetaverseTraversalAuthorityJumpAirborne,
  isMetaverseTraversalAuthorityJumpPendingOrActive,
  type MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared";

import type {
  MetaverseRemoteCharacterPresentationSnapshot
} from "../../types/metaverse-runtime";
import {
  MetaverseMovementAnimationPolicyRuntime
} from "./metaverse-movement-animation-policy";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteCharacterPresentationSnapshot {
  characterId: string;
  look: {
    pitchRadians: number;
    yawRadians: number;
  };
  mountedOccupancy: MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"];
  playerId: string;
  poseSyncMode: "runtime-server-sampled";
  presentation: {
    animationVocabulary:
      MetaverseRemoteCharacterPresentationSnapshot["presentation"]["animationVocabulary"];
    position: MutableVector3Snapshot;
    yawRadians: number;
  };
}

export interface RemoteCharacterPresentationAuthoritativeSample {
  readonly alpha: number;
  readonly basePlayer: MetaverseRealtimePlayerSnapshot;
  readonly deltaSeconds: number;
  readonly extrapolationSeconds: number;
  readonly nextPlayer: MetaverseRealtimePlayerSnapshot | null;
  readonly sampleEpoch: number;
}

function createMutableVector3(): MutableVector3Snapshot {
  return {
    x: 0,
    y: 0,
    z: 0
  };
}

function writeMutableVector3(
  target: MutableVector3Snapshot,
  x: number,
  y: number,
  z: number
): MutableVector3Snapshot {
  target.x = x;
  target.y = y;
  target.z = z;

  return target;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function wrapRadians(rawValue: number): number {
  let normalizedValue = rawValue;

  while (normalizedValue > Math.PI) {
    normalizedValue -= Math.PI * 2;
  }

  while (normalizedValue <= -Math.PI) {
    normalizedValue += Math.PI * 2;
  }

  return normalizedValue;
}

function lerpWrappedRadians(
  startRadians: number,
  endRadians: number,
  alpha: number
): number {
  return wrapRadians(
    startRadians + wrapRadians(endRadians - startRadians) * alpha
  );
}

function sampleRemotePlayerPositionInto(
  target: MutableVector3Snapshot,
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): MutableVector3Snapshot {
  if (nextPlayer !== null) {
    return writeMutableVector3(
      target,
      lerp(basePlayer.position.x, nextPlayer.position.x, alpha),
      lerp(basePlayer.position.y, nextPlayer.position.y, alpha),
      lerp(basePlayer.position.z, nextPlayer.position.z, alpha)
    );
  }

  if (extrapolationSeconds <= 0) {
    return writeMutableVector3(
      target,
      basePlayer.position.x,
      basePlayer.position.y,
      basePlayer.position.z
    );
  }

  return writeMutableVector3(
    target,
    basePlayer.position.x + basePlayer.linearVelocity.x * extrapolationSeconds,
    basePlayer.position.y + basePlayer.linearVelocity.y * extrapolationSeconds,
    basePlayer.position.z + basePlayer.linearVelocity.z * extrapolationSeconds
  );
}

function sampleRemotePlayerYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  if (nextPlayer === null) {
    if (extrapolationSeconds <= 0) {
      return basePlayer.yawRadians;
    }

    return wrapRadians(
      basePlayer.yawRadians +
        basePlayer.angularVelocityRadiansPerSecond * extrapolationSeconds
    );
  }

  return lerpWrappedRadians(basePlayer.yawRadians, nextPlayer.yawRadians, alpha);
}

function sampleRemotePlayerLookPitchRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.look.pitchRadians;
  }

  return lerp(basePlayer.look.pitchRadians, nextPlayer.look.pitchRadians, alpha);
}

function sampleRemotePlayerLookYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.look.yawRadians;
  }

  return lerpWrappedRadians(
    basePlayer.look.yawRadians,
    nextPlayer.look.yawRadians,
    alpha
  );
}

function selectSampledRemotePlayerSnapshot(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): MetaverseRealtimePlayerSnapshot {
  if (nextPlayer === null) {
    return basePlayer;
  }

  return alpha < 0.5 ? basePlayer : nextPlayer;
}

function resolveRemoteCharacterAnimationVocabulary(
  animationRuntime: MetaverseMovementAnimationPolicyRuntime,
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "traversalAuthority"
  >,
  deltaSeconds: number
): MetaverseRemoteCharacterPresentationSnapshot["presentation"]["animationVocabulary"] {
  if (playerSnapshot.mountedOccupancy?.occupancyKind === "seat") {
    animationRuntime.reset("seated");
    return "seated";
  }

  return animationRuntime.advance(
    {
      grounded:
        playerSnapshot.mountedOccupancy !== null ||
        (playerSnapshot.locomotionMode === "grounded" &&
          !isMetaverseTraversalAuthorityJumpPendingOrActive(
            playerSnapshot.traversalAuthority
          ) &&
          !isMetaverseTraversalAuthorityJumpAirborne(
            playerSnapshot.traversalAuthority
          )),
      inputMagnitude: 0,
      locomotionMode:
        playerSnapshot.mountedOccupancy !== null
          ? "grounded"
          : playerSnapshot.locomotionMode === "swim"
            ? "swim"
            : "grounded",
      planarSpeedUnitsPerSecond: Math.hypot(
        playerSnapshot.linearVelocity.x,
        playerSnapshot.linearVelocity.z
      ),
      verticalSpeedUnitsPerSecond: playerSnapshot.linearVelocity.y
    },
    deltaSeconds
  );
}

export class MetaverseRemoteCharacterPresentationOwner {
  readonly #animationRuntime = new MetaverseMovementAnimationPolicyRuntime();
  readonly #snapshot: MutableRemoteCharacterPresentationSnapshot;

  #sampleEpoch = 0;

  constructor(playerSnapshot: MetaverseRealtimePlayerSnapshot) {
    this.#snapshot = {
      characterId: playerSnapshot.characterId,
      look: {
        pitchRadians: playerSnapshot.look.pitchRadians,
        yawRadians: playerSnapshot.look.yawRadians
      },
      mountedOccupancy: playerSnapshot.mountedOccupancy,
      playerId: playerSnapshot.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: {
        animationVocabulary: "idle",
        position: createMutableVector3(),
        yawRadians: playerSnapshot.yawRadians
      }
    };
  }

  get presentationSnapshot(): MetaverseRemoteCharacterPresentationSnapshot {
    return this.#snapshot;
  }

  get sampleEpoch(): number {
    return this.#sampleEpoch;
  }

  syncAuthoritativeSample({
    alpha,
    basePlayer,
    deltaSeconds,
    extrapolationSeconds,
    nextPlayer,
    sampleEpoch
  }: RemoteCharacterPresentationAuthoritativeSample): void {
    const sampledDiscretePlayerSnapshot = selectSampledRemotePlayerSnapshot(
      basePlayer,
      nextPlayer,
      alpha
    );

    this.#snapshot.characterId = sampledDiscretePlayerSnapshot.characterId;
    this.#snapshot.look.pitchRadians = sampleRemotePlayerLookPitchRadians(
      basePlayer,
      nextPlayer,
      alpha
    );
    this.#snapshot.look.yawRadians = sampleRemotePlayerLookYawRadians(
      basePlayer,
      nextPlayer,
      alpha
    );
    this.#snapshot.mountedOccupancy =
      sampledDiscretePlayerSnapshot.mountedOccupancy;
    this.#snapshot.presentation.animationVocabulary =
      resolveRemoteCharacterAnimationVocabulary(
        this.#animationRuntime,
        sampledDiscretePlayerSnapshot,
        deltaSeconds
      );
    sampleRemotePlayerPositionInto(
      this.#snapshot.presentation.position,
      basePlayer,
      nextPlayer,
      alpha,
      extrapolationSeconds
    );
    this.#snapshot.presentation.yawRadians = sampleRemotePlayerYawRadians(
      basePlayer,
      nextPlayer,
      alpha,
      extrapolationSeconds
    );
    this.#sampleEpoch = sampleEpoch;
  }
}
