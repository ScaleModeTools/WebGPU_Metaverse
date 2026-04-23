import {
  createMetaversePresencePoseSnapshot,
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  type MetaversePlayerTeamId,
  type MetaverseJoinPresenceCommand,
  type MetaversePlayerId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaverseSyncPresenceCommand
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  resolveMetaverseTraversalPoseKinematics,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type { MetaverseAuthoritativeSurfaceColliderSnapshot } from "../../world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import type { MetaverseAuthoritativeMountedOccupancyRuntimeState } from "../mounted/metaverse-authoritative-mounted-occupancy-authority.js";
import {
  createMetaverseAuthoritativeLastGroundedBodySnapshot,
  type MetaverseAuthoritativeLastGroundedBodySnapshot
} from "./metaverse-authoritative-last-grounded-body-snapshot.js";

export interface MetaverseAuthoritativePlayerPoseRuntimeState<
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState = MetaverseAuthoritativeMountedOccupancyRuntimeState
> {
  angularVelocityRadiansPerSecond: number;
  lastGroundedBodySnapshot: MetaverseAuthoritativeLastGroundedBodySnapshot;
  lastPoseAtMs: number | null;
  lastProcessedLookSequence: number;
  lastProcessedTraversalSequence: number;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  readonly teamId: MetaversePlayerTeamId;
  positionX: number;
  positionY: number;
  positionZ: number;
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  realtimeWorldAuthorityActive: boolean;
  stateSequence: number;
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  yawRadians: number;
}

interface MetaverseAuthoritativeMountedOccupancyResolver<
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState
> {
  resolveMountedOccupancyRuntimeState(
    mountedOccupancy: MetaversePresencePoseSnapshot["mountedOccupancy"]
  ): MountedOccupancy | null;
  resolveAcceptedMountedOccupancy(
    playerId: MetaversePlayerId,
    requestedMountedOccupancy: MountedOccupancy | null,
    previousMountedOccupancy: MountedOccupancy | null
  ): MountedOccupancy | null;
}

interface MetaverseAuthoritativePlayerPoseAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerPoseRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState,
  VehicleRuntime
> {
  readonly clearDriverVehicleControl: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerTraversalIntent: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerVehicleOccupancy: (playerId: MetaversePlayerId) => void;
  readonly createPlayerRuntimeState: (
    playerId: MetaversePlayerId,
    characterId: string,
    teamId: MetaversePlayerTeamId,
    username: MetaversePresencePlayerSnapshot["username"],
    nowMs: number
  ) => PlayerRuntime;
  readonly incrementSnapshotSequence: () => void;
  readonly mountedOccupancyAuthority:
    MetaverseAuthoritativeMountedOccupancyResolver<MountedOccupancy>;
  readonly playersById: Map<MetaversePlayerId, PlayerRuntime>;
  readonly resolveAuthoritativeSurfaceColliders:
    () => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly resolveJoinPose: (
    playerId: MetaversePlayerId,
    teamId: MetaversePlayerTeamId,
    nextPose: MetaversePresencePoseSnapshot
  ) => MetaversePresencePoseSnapshot;
  readonly resolveConstrainedPlayerLookIntent: (
    playerRuntime: PlayerRuntime,
    pitchRadians: number,
    yawRadians: number
  ) => {
    readonly pitchRadians: number;
    readonly yawRadians: number;
  };
  readonly syncImplicitPlayerLookFromBodyYaw: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncMountedPlayerPoseFromVehicle: (
    playerRuntime: PlayerRuntime,
    vehicleRuntime: VehicleRuntime,
    nowMs: number,
    previousFacingYawRadians: number
  ) => void;
  readonly syncPlayerTraversalAuthorityState: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncPlayerTraversalBodyRuntimes: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncUnmountedPlayerToAuthoritativeSurface: (
    playerRuntime: PlayerRuntime,
    authoritativeSurfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[],
    excludedOwnerEnvironmentAssetId: string | null
  ) => void;
  readonly syncVehicleOccupancyAndInitialPoseFromPlayer: (
    playerRuntime: PlayerRuntime,
    mountedOccupancy: MountedOccupancy,
    nowMs: number
  ) => VehicleRuntime;
}

function isOlderPresenceUpdate(
  currentStateSequence: number,
  nextPose: MetaversePresencePoseSnapshot
): boolean {
  return nextPose.stateSequence < currentStateSequence;
}

function hasExplicitPresenceLook(nextPose: MetaversePresencePoseSnapshot): boolean {
  return (
    nextPose.look.pitchRadians !== 0 ||
    nextPose.look.yawRadians !== nextPose.yawRadians
  );
}

function computeSecondsBetween(
  previousTimeMs: number | null,
  nowMs: number
): number | null {
  if (previousTimeMs === null) {
    return null;
  }

  const deltaSeconds = (nowMs - previousTimeMs) / 1_000;

  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return null;
  }

  return deltaSeconds;
}

export class MetaverseAuthoritativePlayerPoseAuthority<
  PlayerRuntime extends MetaverseAuthoritativePlayerPoseRuntimeState<MountedOccupancy>,
  MountedOccupancy extends MetaverseAuthoritativeMountedOccupancyRuntimeState,
  VehicleRuntime
> {
  readonly #dependencies: MetaverseAuthoritativePlayerPoseAuthorityDependencies<
    PlayerRuntime,
    MountedOccupancy,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativePlayerPoseAuthorityDependencies<
      PlayerRuntime,
      MountedOccupancy,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  #resolvePreAuthoritySpawnPose(
    playerId: MetaversePlayerId,
    teamId: MetaversePlayerTeamId,
    nextPose: MetaversePresencePoseSnapshot,
    realtimeWorldAuthorityActive: boolean
  ): MetaversePresencePoseSnapshot {
    return realtimeWorldAuthorityActive
      ? nextPose
      : this.#dependencies.resolveJoinPose(playerId, teamId, nextPose);
  }

  acceptJoinCommand(command: MetaverseJoinPresenceCommand, nowMs: number): void {
    const currentPlayer = this.#dependencies.playersById.get(command.playerId);
    const resolvedTeamId = currentPlayer?.teamId ?? command.teamId;
    const nextPose = this.#resolvePreAuthoritySpawnPose(
      command.playerId,
      resolvedTeamId,
      createMetaversePresencePoseSnapshot(command.pose),
      currentPlayer?.realtimeWorldAuthorityActive ?? false
    );

    if (
      currentPlayer !== undefined &&
      isOlderPresenceUpdate(currentPlayer.stateSequence, nextPose)
    ) {
      currentPlayer.lastSeenAtMs = nowMs;
      return;
    }

    const playerRuntime =
      currentPlayer ??
      this.#dependencies.createPlayerRuntimeState(
        command.playerId,
        command.characterId,
        resolvedTeamId,
        command.username,
        nowMs
      );

    playerRuntime.lastSeenAtMs = nowMs;

    if (currentPlayer !== undefined && playerRuntime.realtimeWorldAuthorityActive) {
      return;
    }

    this.#applyPlayerPose(
      playerRuntime,
      nextPose,
      nowMs,
      hasExplicitPresenceLook(nextPose)
    );
    this.#dependencies.playersById.set(command.playerId, playerRuntime);
    this.#dependencies.incrementSnapshotSequence();
  }

  acceptSyncCommand(command: MetaverseSyncPresenceCommand, nowMs: number): void {
    const nextPose = createMetaversePresencePoseSnapshot(command.pose);

    this.acceptPlayerPoseCommand(
      command.playerId,
      nextPose,
      nowMs,
      hasExplicitPresenceLook(nextPose)
    );
  }

  acceptPlayerPoseCommand(
    playerId: MetaversePlayerId,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number,
    lookProvided: boolean = false
  ): void {
    const playerRuntime = this.#dependencies.playersById.get(playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${playerId}`);
    }

    const resolvedPose = this.#resolvePreAuthoritySpawnPose(
      playerId,
      playerRuntime.teamId,
      nextPose,
      playerRuntime.realtimeWorldAuthorityActive
    );

    playerRuntime.lastSeenAtMs = nowMs;

    if (isOlderPresenceUpdate(playerRuntime.stateSequence, resolvedPose)) {
      return;
    }

    if (playerRuntime.realtimeWorldAuthorityActive) {
      return;
    }

    this.#applyPlayerPose(playerRuntime, resolvedPose, nowMs, lookProvided);
    this.#dependencies.incrementSnapshotSequence();
  }

  #applyPlayerPose(
    playerRuntime: PlayerRuntime,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number,
    lookProvided: boolean
  ): void {
    const requestedMountedEnvironmentAssetId =
      nextPose.mountedOccupancy?.environmentAssetId ?? null;
    const requestedMountedOccupancy =
      this.#dependencies.mountedOccupancyAuthority.resolveMountedOccupancyRuntimeState(
        nextPose.mountedOccupancy
      );
    const acceptedMountedOccupancy =
      this.#dependencies.mountedOccupancyAuthority.resolveAcceptedMountedOccupancy(
        playerRuntime.playerId,
        requestedMountedOccupancy,
        playerRuntime.mountedOccupancy
      );

    this.#dependencies.clearPlayerVehicleOccupancy(playerRuntime.playerId);
    this.#dependencies.clearPlayerTraversalIntent(playerRuntime.playerId);

    playerRuntime.presenceAnimationVocabulary = nextPose.animationVocabulary;
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode:
          nextPose.locomotionMode === "swim" ? "swim" : "grounded"
      });
    playerRuntime.lastGroundedBodySnapshot =
      createMetaverseAuthoritativeLastGroundedBodySnapshot({
        contact: {
          supportingContactDetected: nextPose.locomotionMode === "grounded"
        },
        interaction: playerRuntime.lastGroundedBodySnapshot.interaction,
        ...(nextPose.locomotionMode === "grounded"
          ? {
              jumpBody: {
                grounded: true,
                jumpReady: true
              }
            }
        : {}),
        positionYMeters: nextPose.position.y
      });
    playerRuntime.lastProcessedTraversalSequence = nextPose.stateSequence;
    playerRuntime.locomotionMode =
      acceptedMountedOccupancy === null &&
      requestedMountedEnvironmentAssetId !== null
        ? "grounded"
        : nextPose.locomotionMode;

    if (
      playerRuntime.locomotionMode === "grounded" ||
      playerRuntime.locomotionMode === "swim"
    ) {
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: playerRuntime.locomotionMode
        });
    }

    playerRuntime.stateSequence = nextPose.stateSequence;
    playerRuntime.mountedOccupancy = acceptedMountedOccupancy;
    playerRuntime.traversalAuthorityState =
      createMetaverseTraversalAuthoritySnapshot();

    const traversalMountedOccupancy =
      shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
        playerRuntime.mountedOccupancy
      );

    if (playerRuntime.mountedOccupancy === null || !traversalMountedOccupancy) {
      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
      this.#applyPlayerWorldPoseFromPresence(playerRuntime, nextPose, nowMs);

      if (playerRuntime.mountedOccupancy !== null) {
        this.#dependencies.syncVehicleOccupancyAndInitialPoseFromPlayer(
          playerRuntime,
          playerRuntime.mountedOccupancy,
          nowMs
        );
        this.#dependencies.syncUnmountedPlayerToAuthoritativeSurface(
          playerRuntime,
          this.#dependencies.resolveAuthoritativeSurfaceColliders(),
          null
        );
      } else if (requestedMountedOccupancy !== null) {
        this.#dependencies.syncUnmountedPlayerToAuthoritativeSurface(
          playerRuntime,
          this.#dependencies.resolveAuthoritativeSurfaceColliders(),
          requestedMountedEnvironmentAssetId
        );
      } else if (requestedMountedEnvironmentAssetId !== null) {
        this.#dependencies.syncUnmountedPlayerToAuthoritativeSurface(
          playerRuntime,
          this.#dependencies.resolveAuthoritativeSurfaceColliders(),
          requestedMountedEnvironmentAssetId
        );
      }

      this.#syncPlayerLookFromPresence(playerRuntime, nextPose, lookProvided);
      this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (playerRuntime.mountedOccupancy.occupantRole !== "driver") {
      this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
    }

    const previousMountedFacingYawRadians = playerRuntime.yawRadians;

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;

    const vehicleRuntime =
      this.#dependencies.syncVehicleOccupancyAndInitialPoseFromPlayer(
        playerRuntime,
        playerRuntime.mountedOccupancy,
        nowMs
      );

    this.#dependencies.syncMountedPlayerPoseFromVehicle(
      playerRuntime,
      vehicleRuntime,
      nowMs,
      previousMountedFacingYawRadians
    );
    this.#syncPlayerLookFromPresence(playerRuntime, nextPose, lookProvided);
    this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
  }

  #applyPlayerWorldPoseFromPresence(
    playerRuntime: PlayerRuntime,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number
  ): void {
    const deltaSeconds = computeSecondsBetween(playerRuntime.lastPoseAtMs, nowMs);
    const previousPositionX = playerRuntime.positionX;
    const previousPositionY = playerRuntime.positionY;
    const previousPositionZ = playerRuntime.positionZ;
    const previousYawRadians = playerRuntime.yawRadians;
    const kinematicSnapshot = resolveMetaverseTraversalPoseKinematics(
      {
        position: {
          x: previousPositionX,
          y: previousPositionY,
          z: previousPositionZ
        },
        yawRadians: previousYawRadians
      },
      {
        position: nextPose.position,
        yawRadians: nextPose.yawRadians
      },
      deltaSeconds
    );

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;

    if (playerRuntime.locomotionMode === "grounded") {
      playerRuntime.lastGroundedBodySnapshot =
        createMetaverseAuthoritativeLastGroundedBodySnapshot({
          ...playerRuntime.lastGroundedBodySnapshot,
          positionYMeters: nextPose.position.y
        });
    }

    playerRuntime.angularVelocityRadiansPerSecond =
      kinematicSnapshot.angularVelocityRadiansPerSecond;
    playerRuntime.linearVelocityX = kinematicSnapshot.linearVelocity.x;
    playerRuntime.linearVelocityY = kinematicSnapshot.linearVelocity.y;
    playerRuntime.linearVelocityZ = kinematicSnapshot.linearVelocity.z;

    playerRuntime.lastPoseAtMs = nowMs;
    this.#dependencies.syncPlayerTraversalBodyRuntimes(playerRuntime);
  }

  #syncPlayerLookFromPresence(
    playerRuntime: PlayerRuntime,
    nextPose: MetaversePresencePoseSnapshot,
    lookProvided: boolean
  ): void {
    if (!lookProvided) {
      playerRuntime.lastProcessedLookSequence = 0;
      this.#dependencies.syncImplicitPlayerLookFromBodyYaw(playerRuntime);
      return;
    }

    const constrainedLookIntent =
      this.#dependencies.resolveConstrainedPlayerLookIntent(
        playerRuntime,
        nextPose.look.pitchRadians,
        nextPose.look.yawRadians
      );

    playerRuntime.lastProcessedLookSequence = Math.max(1, nextPose.stateSequence);
    playerRuntime.lookPitchRadians = constrainedLookIntent.pitchRadians;
    playerRuntime.lookYawRadians = constrainedLookIntent.yawRadians;
  }
}
