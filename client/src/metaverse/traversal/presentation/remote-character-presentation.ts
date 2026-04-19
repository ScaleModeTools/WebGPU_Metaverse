import {
  isMetaverseTraversalAuthorityActionAirborne,
  isMetaverseTraversalAuthorityActionPendingOrActive,
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaverseRealtimePlayerObservedTraversalSnapshot,
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseCameraSnapshot, MetaverseRemoteCharacterPresentationSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  MetaverseMovementAnimationPolicyRuntime
} from "./metaverse-movement-animation-policy";
import {
  createTraversalSurfaceCameraPresentationSnapshot
} from "./camera-presentation";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteCharacterPresentationSnapshot {
  aimCamera: MetaverseCameraSnapshot | null;
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
  readonly remoteCharacterRootAlpha: number;
  readonly remoteCharacterRootBasePlayer: MetaverseRealtimePlayerSnapshot;
  readonly remoteCharacterRootNextPlayer: MetaverseRealtimePlayerSnapshot | null;
  readonly sampleEpoch: number;
}

type RemoteCharacterAimPresentationConfig = Pick<
  MetaverseRuntimeConfig,
  "bodyPresentation" | "groundedBody"
>;

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

function sampleRemotePlayerRootPositionInto(
  target: MutableVector3Snapshot,
  remoteCharacterRootBasePlayer: MetaverseRealtimePlayerSnapshot,
  remoteCharacterRootNextPlayer: MetaverseRealtimePlayerSnapshot | null,
  remoteCharacterRootAlpha: number
): MutableVector3Snapshot {
  if (remoteCharacterRootNextPlayer !== null) {
    return writeMutableVector3(
      target,
      lerp(
        remoteCharacterRootBasePlayer.position.x,
        remoteCharacterRootNextPlayer.position.x,
        remoteCharacterRootAlpha
      ),
      lerp(
        remoteCharacterRootBasePlayer.position.y,
        remoteCharacterRootNextPlayer.position.y,
        remoteCharacterRootAlpha
      ),
      lerp(
        remoteCharacterRootBasePlayer.position.z,
        remoteCharacterRootNextPlayer.position.z,
        remoteCharacterRootAlpha
      )
    );
  }

  return writeMutableVector3(
    target,
    remoteCharacterRootBasePlayer.position.x,
    remoteCharacterRootBasePlayer.position.y,
    remoteCharacterRootBasePlayer.position.z
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

function sampleRemotePlayerObservedTraversalFacingYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.observedTraversal.facing.yawRadians;
  }

  return lerpWrappedRadians(
    basePlayer.observedTraversal.facing.yawRadians,
    nextPlayer.observedTraversal.facing.yawRadians,
    alpha
  );
}

function sampleRemotePlayerLookPitchRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  const readPresentationPitchRadians = (
    playerSnapshot: MetaverseRealtimePlayerSnapshot
  ): number =>
    playerSnapshot.mountedOccupancy === null
      ? playerSnapshot.observedTraversal.facing.pitchRadians
      : playerSnapshot.look.pitchRadians;

  if (nextPlayer === null) {
    return readPresentationPitchRadians(basePlayer);
  }

  return lerp(
    readPresentationPitchRadians(basePlayer),
    readPresentationPitchRadians(nextPlayer),
    alpha
  );
}

function sampleRemotePlayerLookYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  const readPresentationYawRadians = (
    playerSnapshot: MetaverseRealtimePlayerSnapshot
  ): number =>
    playerSnapshot.mountedOccupancy === null
      ? playerSnapshot.observedTraversal.facing.yawRadians
      : playerSnapshot.look.yawRadians;

  if (nextPlayer === null) {
    return readPresentationYawRadians(basePlayer);
  }

  return lerpWrappedRadians(
    readPresentationYawRadians(basePlayer),
    readPresentationYawRadians(nextPlayer),
    alpha
  );
}

function resolveRemoteCharacterAimCameraSnapshot(
  position: MutableVector3Snapshot,
  look: MutableRemoteCharacterPresentationSnapshot["look"],
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "locomotionMode" | "mountedOccupancy"
  >,
  config: RemoteCharacterAimPresentationConfig
): MetaverseCameraSnapshot | null {
  if (
    playerSnapshot.mountedOccupancy !== null ||
    playerSnapshot.locomotionMode !== "grounded"
  ) {
    return null;
  }

  return createTraversalSurfaceCameraPresentationSnapshot(
    position,
    config.groundedBody.eyeHeightMeters,
    look.yawRadians,
    look.pitchRadians,
    config.bodyPresentation.groundedFirstPersonForwardOffsetMeters
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

function resolveObservedTraversalInputMagnitude(
  observedTraversal: MetaverseRealtimePlayerObservedTraversalSnapshot
): number {
  return Math.min(
    1,
    Math.hypot(
      observedTraversal.bodyControl.moveAxis,
      observedTraversal.bodyControl.strafeAxis
    )
  );
}

function sampleRemotePlayerObservedTraversalInputMagnitude(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return resolveObservedTraversalInputMagnitude(basePlayer.observedTraversal);
  }

  const moveAxis = lerp(
    basePlayer.observedTraversal.bodyControl.moveAxis,
    nextPlayer.observedTraversal.bodyControl.moveAxis,
    alpha
  );
  const strafeAxis = lerp(
    basePlayer.observedTraversal.bodyControl.strafeAxis,
    nextPlayer.observedTraversal.bodyControl.strafeAxis,
    alpha
  );

  return Math.min(1, Math.hypot(moveAxis, strafeAxis));
}

function resolveRemoteCharacterAnimationVocabulary(
  animationRuntime: MetaverseMovementAnimationPolicyRuntime,
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "observedTraversal"
    | "traversalAuthority"
  >,
  inputMagnitude: number,
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
          !isMetaverseTraversalAuthorityActionPendingOrActive(
            playerSnapshot.traversalAuthority,
            "jump"
          ) &&
          !isMetaverseTraversalAuthorityActionAirborne(
            playerSnapshot.traversalAuthority,
            "jump"
          )),
      inputMagnitude,
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
  readonly #config: RemoteCharacterAimPresentationConfig;
  readonly #snapshot: MutableRemoteCharacterPresentationSnapshot;

  #sampleEpoch = 0;

  constructor(
    playerSnapshot: MetaverseRealtimePlayerSnapshot,
    config: RemoteCharacterAimPresentationConfig
  ) {
    this.#config = config;
    this.#snapshot = {
      aimCamera: null,
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
        position: writeMutableVector3(
          createMutableVector3(),
          playerSnapshot.position.x,
          playerSnapshot.position.y,
          playerSnapshot.position.z
        ),
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
    remoteCharacterRootAlpha,
    remoteCharacterRootBasePlayer,
    remoteCharacterRootNextPlayer,
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
        sampleRemotePlayerObservedTraversalInputMagnitude(
          basePlayer,
          nextPlayer,
          alpha
        ),
        deltaSeconds
      );
    sampleRemotePlayerRootPositionInto(
      this.#snapshot.presentation.position,
      remoteCharacterRootBasePlayer,
      remoteCharacterRootNextPlayer,
      remoteCharacterRootAlpha
    );
    this.#snapshot.presentation.yawRadians =
      sampledDiscretePlayerSnapshot.mountedOccupancy === null
        ? sampleRemotePlayerObservedTraversalFacingYawRadians(
            basePlayer,
            nextPlayer,
            alpha
          )
        : sampleRemotePlayerYawRadians(
            basePlayer,
            nextPlayer,
            alpha,
            extrapolationSeconds
          );
    this.#snapshot.aimCamera = resolveRemoteCharacterAimCameraSnapshot(
      this.#snapshot.presentation.position,
      this.#snapshot.look,
      sampledDiscretePlayerSnapshot,
      this.#config
    );
    this.#sampleEpoch = sampleEpoch;
  }
}
