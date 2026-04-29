import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  shouldKeepMetaverseMountedOccupancyFreeRoam
} from "@webgpu-metaverse/shared/metaverse/presence";

import type { MetaverseCameraSnapshot, MetaverseRemoteCharacterPresentationSnapshot } from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import {
  createGroundedMovementAnimationPolicyInput,
  MetaverseMovementAnimationPolicyRuntime
} from "./metaverse-movement-animation-policy";
import { resolveCharacterAnimationPlaybackRateMultiplier } from "./character-presentation";
import {
  createTraversalSurfaceCameraPresentationSnapshot
} from "./camera-presentation";
import {
  projectGroundedTraversalPresentationPosition,
  projectTraversalPresentationPosition
} from "./presentation-projection";

interface MutableVector3Snapshot {
  x: number;
  y: number;
  z: number;
}

interface MutableRemoteCharacterPresentationSnapshot {
  aimCamera: MetaverseCameraSnapshot | null;
  characterId: string;
  combatAlive: boolean;
  look: {
    pitchRadians: number;
    yawRadians: number;
  };
  mountedOccupancy: MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"];
  playerId: string;
  poseSyncMode: "runtime-server-sampled";
  presentation: {
    animationCycleId?: number;
    animationPlaybackRateMultiplier: number;
    animationVocabulary:
      MetaverseRemoteCharacterPresentationSnapshot["presentation"]["animationVocabulary"];
    position: MutableVector3Snapshot;
    yawRadians: number;
  };
  teamId: MetaverseRemoteCharacterPresentationSnapshot["teamId"];
  username: MetaverseRemoteCharacterPresentationSnapshot["username"];
  weaponState: MetaverseRemoteCharacterPresentationSnapshot["weaponState"];
}

export interface RemoteCharacterPresentationAuthoritativeSample {
  readonly alpha: number;
  readonly basePlayer: MetaverseRealtimePlayerSnapshot;
  readonly deltaSeconds: number;
  readonly extrapolationSeconds: number;
  readonly nextPlayer: MetaverseRealtimePlayerSnapshot | null;
  readonly remoteCharacterRootAlpha: number;
  readonly remoteCharacterRootBasePlayer: MetaverseRealtimePlayerSnapshot;
  readonly remoteCharacterRootExtrapolationSeconds: number;
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
  config: RemoteCharacterAimPresentationConfig,
  remoteCharacterRootBasePlayer: MetaverseRealtimePlayerSnapshot,
  remoteCharacterRootNextPlayer: MetaverseRealtimePlayerSnapshot | null,
  remoteCharacterRootAlpha: number,
  remoteCharacterRootExtrapolationSeconds: number
): MutableVector3Snapshot {
  const baseActiveBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
      remoteCharacterRootBasePlayer
    );

  if (remoteCharacterRootNextPlayer !== null) {
    const nextActiveBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        remoteCharacterRootNextPlayer
      );

    return writeMutableVector3(
      target,
      lerp(
        baseActiveBodySnapshot.position.x,
        nextActiveBodySnapshot.position.x,
        remoteCharacterRootAlpha
      ),
      lerp(
        baseActiveBodySnapshot.position.y,
        nextActiveBodySnapshot.position.y,
        remoteCharacterRootAlpha
      ),
      lerp(
        baseActiveBodySnapshot.position.z,
        nextActiveBodySnapshot.position.z,
        remoteCharacterRootAlpha
      )
    );
  }

  const projectedPosition =
    remoteCharacterRootBasePlayer.locomotionMode === "grounded"
      ? projectGroundedTraversalPresentationPosition(
          baseActiveBodySnapshot.position,
          baseActiveBodySnapshot.linearVelocity,
          remoteCharacterRootExtrapolationSeconds,
          remoteCharacterRootBasePlayer.groundedBody.grounded,
          config.groundedBody.gravityUnitsPerSecond
        )
      : projectTraversalPresentationPosition(
          baseActiveBodySnapshot.position,
          baseActiveBodySnapshot.linearVelocity,
          remoteCharacterRootExtrapolationSeconds
        );

  return writeMutableVector3(
    target,
    projectedPosition.x,
    projectedPosition.y,
    projectedPosition.z
  );
}

function sampleRemotePlayerBodyYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  const baseActiveBodySnapshot =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(basePlayer);

  if (nextPlayer === null) {
    if (extrapolationSeconds <= 0) {
      return baseActiveBodySnapshot.yawRadians;
    }

    return wrapRadians(
      baseActiveBodySnapshot.yawRadians +
        basePlayer.angularVelocityRadiansPerSecond * extrapolationSeconds
    );
  }

  return lerpWrappedRadians(
    baseActiveBodySnapshot.yawRadians,
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(nextPlayer).yawRadians,
    alpha
  );
}

function shouldPresentRemotePlayerYawFromLook(
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "mountedOccupancy"
  >
): boolean {
  return (
    playerSnapshot.mountedOccupancy === null ||
    shouldKeepMetaverseMountedOccupancyFreeRoam(
      playerSnapshot.mountedOccupancy
    )
  );
}

function sampleRemotePlayerLookPitchRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number
): number {
  if (nextPlayer === null) {
    return basePlayer.look.pitchRadians;
  }

  return lerp(
    basePlayer.look.pitchRadians,
    nextPlayer.look.pitchRadians,
    alpha
  );
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

function resolveRemoteCharacterAimCameraSnapshot(
  position: MutableVector3Snapshot,
  look: MutableRemoteCharacterPresentationSnapshot["look"],
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "combat" | "locomotionMode" | "mountedOccupancy" | "weaponState"
  >,
  config: RemoteCharacterAimPresentationConfig
): MetaverseCameraSnapshot | null {
  if (
    playerSnapshot.combat?.alive === false ||
    playerSnapshot.mountedOccupancy !== null ||
    playerSnapshot.locomotionMode !== "grounded" ||
    playerSnapshot.weaponState === null
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

function sampleRemotePlayerPresentationYawRadians(
  basePlayer: MetaverseRealtimePlayerSnapshot,
  nextPlayer: MetaverseRealtimePlayerSnapshot | null,
  alpha: number,
  extrapolationSeconds: number
): number {
  const sampledPlayerSnapshot = selectSampledRemotePlayerSnapshot(
    basePlayer,
    nextPlayer,
    alpha
  );

  if (shouldPresentRemotePlayerYawFromLook(sampledPlayerSnapshot)) {
    return sampleRemotePlayerLookYawRadians(basePlayer, nextPlayer, alpha);
  }

  return sampleRemotePlayerBodyYawRadians(
    basePlayer,
    nextPlayer,
    alpha,
    extrapolationSeconds
  );
}

function resolvePresentationIntentInputMagnitude(
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "presentationIntent"
  >
): number {
  return Math.min(
    1,
    Math.hypot(
      playerSnapshot.presentationIntent.moveAxis,
      playerSnapshot.presentationIntent.strafeAxis
    )
  );
}

function resolveRemoteCharacterAnimationVocabulary(
  animationRuntime: MetaverseMovementAnimationPolicyRuntime,
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    | "groundedBody"
    | "locomotionMode"
    | "mountedOccupancy"
    | "presentationIntent"
    | "swimBody"
    | "traversalAuthority"
    | "weaponState"
  >,
  deltaSeconds: number
): MetaverseRemoteCharacterPresentationSnapshot["presentation"]["animationVocabulary"] {
  const moveAxis = playerSnapshot.presentationIntent.moveAxis;
  const strafeAxis = playerSnapshot.presentationIntent.strafeAxis;
  const inputMagnitude = resolvePresentationIntentInputMagnitude(playerSnapshot);

  if (playerSnapshot.mountedOccupancy?.occupancyKind === "seat") {
    animationRuntime.reset("seated");
    return "seated";
  }

  if (playerSnapshot.locomotionMode === "grounded") {
    return animationRuntime.advance(
      createGroundedMovementAnimationPolicyInput({
        groundedBodySnapshot: playerSnapshot.groundedBody,
        inputMagnitude,
        moveAxis,
        strafeAxis,
        traversalAuthority: playerSnapshot.traversalAuthority
      }),
      deltaSeconds
    );
  }

  const swimBodySnapshot =
    playerSnapshot.swimBody ??
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);

  return animationRuntime.advance(
    {
      grounded: false,
      inputMagnitude,
      locomotionMode: "swim",
      moveAxis,
      planarSpeedUnitsPerSecond: Math.hypot(
        swimBodySnapshot.linearVelocity.x,
        swimBodySnapshot.linearVelocity.z
      ),
      strafeAxis,
      verticalSpeedUnitsPerSecond: 0
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
    const activeBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(playerSnapshot);
    const combatAlive = playerSnapshot.combat?.alive ?? true;

    this.#config = config;
    this.#snapshot = {
      aimCamera: null,
      characterId: playerSnapshot.characterId,
      combatAlive,
      look: {
        pitchRadians: playerSnapshot.look.pitchRadians,
        yawRadians: playerSnapshot.look.yawRadians
      },
      mountedOccupancy: playerSnapshot.mountedOccupancy,
      playerId: playerSnapshot.playerId,
      poseSyncMode: "runtime-server-sampled",
      presentation: {
        animationCycleId: 0,
        animationPlaybackRateMultiplier: 1,
        animationVocabulary: "idle",
        position: writeMutableVector3(
          createMutableVector3(),
          activeBodySnapshot.position.x,
          activeBodySnapshot.position.y,
          activeBodySnapshot.position.z
        ),
        yawRadians: sampleRemotePlayerPresentationYawRadians(
          playerSnapshot,
          null,
          0,
          0
        )
      },
      teamId: playerSnapshot.teamId,
      username: playerSnapshot.username,
      weaponState: combatAlive ? playerSnapshot.weaponState : null
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
    remoteCharacterRootExtrapolationSeconds,
    remoteCharacterRootNextPlayer,
    sampleEpoch
  }: RemoteCharacterPresentationAuthoritativeSample): void {
    const sampledDiscretePlayerSnapshot = selectSampledRemotePlayerSnapshot(
      basePlayer,
      nextPlayer,
      alpha
    );
    const sampledCombatAlive =
      sampledDiscretePlayerSnapshot.combat?.alive ?? true;

    this.#snapshot.characterId = sampledDiscretePlayerSnapshot.characterId;
    this.#snapshot.combatAlive = sampledCombatAlive;
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
    this.#snapshot.teamId = sampledDiscretePlayerSnapshot.teamId;
    this.#snapshot.username = sampledDiscretePlayerSnapshot.username;
    this.#snapshot.weaponState = sampledCombatAlive
      ? sampledDiscretePlayerSnapshot.weaponState
      : null;
    this.#snapshot.presentation.animationVocabulary =
      resolveRemoteCharacterAnimationVocabulary(
        this.#animationRuntime,
        sampledDiscretePlayerSnapshot,
        deltaSeconds
      );
    this.#snapshot.presentation.animationCycleId =
      this.#animationRuntime.animationCycleId;
    this.#snapshot.presentation.animationPlaybackRateMultiplier =
      resolveCharacterAnimationPlaybackRateMultiplier({
        animationVocabulary: this.#snapshot.presentation.animationVocabulary,
        boost:
          sampledDiscretePlayerSnapshot.locomotionMode === "grounded" &&
          sampledDiscretePlayerSnapshot.groundedBody.driveTarget.boost,
        config: this.#config,
        locomotionMode: sampledDiscretePlayerSnapshot.locomotionMode,
        moveAxis: sampledDiscretePlayerSnapshot.presentationIntent.moveAxis
      });
    sampleRemotePlayerRootPositionInto(
      this.#snapshot.presentation.position,
      this.#config,
      remoteCharacterRootBasePlayer,
      remoteCharacterRootNextPlayer,
      remoteCharacterRootAlpha,
      remoteCharacterRootExtrapolationSeconds
    );
    this.#snapshot.presentation.yawRadians =
      sampleRemotePlayerPresentationYawRadians(
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
