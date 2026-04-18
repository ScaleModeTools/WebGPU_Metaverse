import {
  clamp,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseTraversalActiveActionSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseUnmountedPlayerLookConstraintBounds,
  resolveMetaverseMountedOccupantRoleLookConstraintBounds,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  wrapRadians,
  type MetaversePlayerLookConstraintBounds,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type {
  MetaversePlayerId,
  MetaversePresenceMountedOccupantRoleId,
  MetaversePresencePlayerSnapshot,
  MetaversePresencePoseSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaversePlayerTraversalIntentSnapshot,
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseTraversalActionPhaseId
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type { PhysicsVector3Snapshot, RapierColliderHandle } from "../../types/metaverse-authoritative-rapier.js";

export interface MetaverseAuthoritativePlayerStateSyncGroundedBodySnapshot {
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly position: PhysicsVector3Snapshot;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime {
  readonly colliderHandle: RapierColliderHandle;
  readonly snapshot: MetaverseAuthoritativePlayerStateSyncGroundedBodySnapshot;
  syncAuthoritativeState(snapshot: {
    readonly grounded: boolean;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void;
}

export interface MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot {
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime {
  readonly colliderHandle: RapierColliderHandle;
  syncAuthoritativeState(snapshot: {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void;
}

export interface MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState {
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
}

export interface MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState {
  angularVelocityRadiansPerSecond: number;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  strafeSpeedUnitsPerSecond: number;
  yawRadians: number;
}

export interface MetaverseAuthoritativePlayerStateSyncRuntimeState<
  GroundedBodyRuntime extends MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime = MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime,
  SwimBodyRuntime extends MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime = MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime,
  MountedOccupancy extends MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState = MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState
> {
  angularVelocityRadiansPerSecond: number;
  readonly characterId: string;
  forwardSpeedUnitsPerSecond: number;
  readonly groundedBodyRuntime: GroundedBodyRuntime;
  lastGroundedBodyJumpReady: boolean;
  lastGroundedJumpSupported: boolean;
  lastGroundedPositionY: number;
  lastPoseAtMs: number | null;
  lastProcessedInputSequence: number;
  lastProcessedLookSequence: number;
  lastProcessedTraversalOrientationSequence: number;
  lastSurfaceJumpSupported: boolean;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  positionX: number;
  positionY: number;
  positionZ: number;
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  realtimeWorldAuthorityActive: boolean;
  stateSequence: number;
  strafeSpeedUnitsPerSecond: number;
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly swimBodyRuntime: SwimBodyRuntime;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  yawRadians: number;
}

interface MetaverseAuthoritativePlayerStateSyncDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerStateSyncRuntimeState<
    GroundedBodyRuntime,
    SwimBodyRuntime,
    MountedOccupancy
  >,
  GroundedBodyRuntime extends MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime,
  SwimBodyRuntime extends MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime,
  MountedOccupancy extends MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
> {
  readonly addPlayerTraversalColliderHandle: (
    handle: RapierColliderHandle
  ) => void;
  readonly createGroundedBodyRuntime: () => GroundedBodyRuntime;
  readonly createSwimBodyRuntime: () => SwimBodyRuntime;
  readonly initialYawRadians: number;
  readonly readCurrentTick: () => number;
  readonly resolvePlayerActiveTraversalAction: (
    playerRuntime: PlayerRuntime
  ) => MetaverseTraversalActiveActionSnapshot;
}

function createPhysicsVector3Snapshot(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x,
    y,
    z
  });
}

function createPlayerLinearVelocitySnapshot(
  playerRuntime: Pick<
    MetaverseAuthoritativePlayerStateSyncRuntimeState,
    "linearVelocityX" | "linearVelocityY" | "linearVelocityZ"
  >
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    playerRuntime.linearVelocityX,
    playerRuntime.linearVelocityY,
    playerRuntime.linearVelocityZ
  );
}

function normalizeAngularDeltaRadians(rawValue: number): number {
  return wrapRadians(rawValue);
}

const groundedSnapToleranceMeters = 0.0001;

export class MetaverseAuthoritativePlayerStateSync<
  PlayerRuntime extends MetaverseAuthoritativePlayerStateSyncRuntimeState<
    GroundedBodyRuntime,
    SwimBodyRuntime,
    MountedOccupancy
  >,
  GroundedBodyRuntime extends MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime,
  SwimBodyRuntime extends MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime,
  MountedOccupancy extends MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativePlayerStateSyncDependencies<
    PlayerRuntime,
    GroundedBodyRuntime,
    SwimBodyRuntime,
    MountedOccupancy,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativePlayerStateSyncDependencies<
      PlayerRuntime,
      GroundedBodyRuntime,
      SwimBodyRuntime,
      MountedOccupancy,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  createPlayerRuntimeState(
    playerId: MetaversePlayerId,
    characterId: string,
    username: MetaversePresencePlayerSnapshot["username"],
    nowMs: number
  ): PlayerRuntime {
    const groundedBodyRuntime = this.#dependencies.createGroundedBodyRuntime();
    const swimBodyRuntime = this.#dependencies.createSwimBodyRuntime();

    this.#dependencies.addPlayerTraversalColliderHandle(
      groundedBodyRuntime.colliderHandle
    );
    this.#dependencies.addPlayerTraversalColliderHandle(
      swimBodyRuntime.colliderHandle
    );

    return {
      angularVelocityRadiansPerSecond: 0,
      characterId,
      forwardSpeedUnitsPerSecond: 0,
      groundedBodyRuntime,
      lastGroundedBodyJumpReady: false,
      lastGroundedJumpSupported: false,
      lastProcessedInputSequence: 0,
      lastProcessedLookSequence: 0,
      lastProcessedTraversalOrientationSequence: 0,
      lastSurfaceJumpSupported: false,
      lastGroundedPositionY: 0,
      lastPoseAtMs: null,
      lastSeenAtMs: nowMs,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      lookPitchRadians: 0,
      lookYawRadians: this.#dependencies.initialYawRadians,
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      presenceAnimationVocabulary: "idle",
      realtimeWorldAuthorityActive: false,
      stateSequence: 0,
      strafeSpeedUnitsPerSecond: 0,
      traversalAuthorityState: createMetaverseTraversalAuthoritySnapshot(),
      unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "grounded"
      }),
      swimBodyRuntime,
      username,
      yawRadians: this.#dependencies.initialYawRadians
    } as PlayerRuntime;
  }

  syncPlayerTraversalBodyRuntimes(
    playerRuntime: PlayerRuntime,
    groundedOverride?: boolean
  ): void {
    const grounded =
      playerRuntime.locomotionMode === "grounded" &&
      (groundedOverride ?? this.#isGroundedUnmountedPlayerRuntime(playerRuntime));
    const position = createPhysicsVector3Snapshot(
      playerRuntime.positionX,
      playerRuntime.positionY,
      playerRuntime.positionZ
    );
    const linearVelocity = createPlayerLinearVelocitySnapshot(playerRuntime);

    playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
      grounded,
      linearVelocity,
      position,
      yawRadians: playerRuntime.yawRadians
    });
    playerRuntime.swimBodyRuntime.syncAuthoritativeState({
      linearVelocity,
      position,
      yawRadians: playerRuntime.yawRadians
    });
  }

  syncMountedPlayerPoseFromVehicle(
    playerRuntime: PlayerRuntime,
    vehicleRuntime: VehicleRuntime,
    nowMs: number,
    previousFacingYawRadians: number = playerRuntime.yawRadians
  ): void {
    playerRuntime.positionX = vehicleRuntime.positionX;
    playerRuntime.positionY = vehicleRuntime.positionY;
    playerRuntime.positionZ = vehicleRuntime.positionZ;
    playerRuntime.yawRadians = vehicleRuntime.yawRadians;
    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      previousFacingYawRadians,
      vehicleRuntime.yawRadians
    );
    playerRuntime.angularVelocityRadiansPerSecond =
      vehicleRuntime.angularVelocityRadiansPerSecond;
    playerRuntime.forwardSpeedUnitsPerSecond =
      vehicleRuntime.forwardSpeedUnitsPerSecond;
    playerRuntime.linearVelocityX = vehicleRuntime.linearVelocityX;
    playerRuntime.linearVelocityY = vehicleRuntime.linearVelocityY;
    playerRuntime.linearVelocityZ = vehicleRuntime.linearVelocityZ;
    playerRuntime.strafeSpeedUnitsPerSecond =
      vehicleRuntime.strafeSpeedUnitsPerSecond;
    playerRuntime.lastPoseAtMs = nowMs;
    this.syncPlayerTraversalBodyRuntimes(playerRuntime);
    this.syncPlayerTraversalAuthorityState(playerRuntime);
  }

  syncPlayerTraversalAuthorityState(playerRuntime: PlayerRuntime): void {
    playerRuntime.traversalAuthorityState =
      resolveMetaverseTraversalAuthoritySnapshotForActionState({
        activeAction:
          this.#dependencies.resolvePlayerActiveTraversalAction(playerRuntime),
        actionState: playerRuntime.unmountedTraversalState.actionState,
        currentTick: this.#dependencies.readCurrentTick(),
        locomotionMode:
          playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
        mounted: playerRuntime.mountedOccupancy !== null,
        previousTraversalAuthority: playerRuntime.traversalAuthorityState
      });
  }

  applyGroundedBodySnapshotToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    groundedBodySnapshot: GroundedBodyRuntime["snapshot"],
    deltaSeconds: number
  ): void {
    const previousYawRadians = playerRuntime.yawRadians;
    const nextPosition = groundedBodySnapshot.position;
    const deltaX = nextPosition.x - playerRuntime.positionX;
    const deltaY = nextPosition.y - playerRuntime.positionY;
    const deltaZ = nextPosition.z - playerRuntime.positionZ;
    const forwardX = Math.sin(groundedBodySnapshot.yawRadians);
    const forwardZ = -Math.cos(groundedBodySnapshot.yawRadians);
    const rightX = Math.cos(groundedBodySnapshot.yawRadians);
    const rightZ = Math.sin(groundedBodySnapshot.yawRadians);

    playerRuntime.positionX = nextPosition.x;
    playerRuntime.positionY = nextPosition.y;
    playerRuntime.positionZ = nextPosition.z;
    playerRuntime.yawRadians = groundedBodySnapshot.yawRadians;
    playerRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(
        groundedBodySnapshot.yawRadians - previousYawRadians
      ) / deltaSeconds;
    playerRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds : 0;
    playerRuntime.linearVelocityX = deltaSeconds > 0 ? deltaX / deltaSeconds : 0;
    playerRuntime.linearVelocityY = deltaSeconds > 0 ? deltaY / deltaSeconds : 0;
    playerRuntime.linearVelocityZ = deltaSeconds > 0 ? deltaZ / deltaSeconds : 0;
    playerRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
  }

  applySurfaceDriveSnapshotToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    surfaceDriveSnapshot: MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot,
    deltaSeconds: number
  ): void {
    const previousYawRadians = playerRuntime.yawRadians;
    const nextPosition = surfaceDriveSnapshot.position;
    const deltaX = nextPosition.x - playerRuntime.positionX;
    const deltaY = nextPosition.y - playerRuntime.positionY;
    const deltaZ = nextPosition.z - playerRuntime.positionZ;
    const forwardX = Math.sin(surfaceDriveSnapshot.yawRadians);
    const forwardZ = -Math.cos(surfaceDriveSnapshot.yawRadians);
    const rightX = Math.cos(surfaceDriveSnapshot.yawRadians);
    const rightZ = Math.sin(surfaceDriveSnapshot.yawRadians);

    playerRuntime.positionX = nextPosition.x;
    playerRuntime.positionY = nextPosition.y;
    playerRuntime.positionZ = nextPosition.z;
    playerRuntime.yawRadians = surfaceDriveSnapshot.yawRadians;
    playerRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(
        surfaceDriveSnapshot.yawRadians - previousYawRadians
      ) / deltaSeconds;
    playerRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds : 0;
    playerRuntime.linearVelocityX = surfaceDriveSnapshot.linearVelocity.x;
    playerRuntime.linearVelocityY = surfaceDriveSnapshot.linearVelocity.y;
    playerRuntime.linearVelocityZ = surfaceDriveSnapshot.linearVelocity.z;
    playerRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
  }

  syncImplicitPlayerLookFromBodyYaw(playerRuntime: PlayerRuntime): void {
    if (playerRuntime.lastProcessedLookSequence > 0) {
      return;
    }

    playerRuntime.lookPitchRadians = 0;
    playerRuntime.lookYawRadians = playerRuntime.yawRadians;
  }

  syncUnmountedPlayerLookFromTraversalIntent(
    playerRuntime: PlayerRuntime,
    traversalIntent: Pick<MetaversePlayerTraversalIntentSnapshot, "facing">
  ): void {
    playerRuntime.lookPitchRadians = traversalIntent.facing.pitchRadians;
    playerRuntime.lookYawRadians = traversalIntent.facing.yawRadians;
  }

  resolveConstrainedPlayerLookIntent(
    playerRuntime: PlayerRuntime,
    pitchRadians: number,
    yawRadians: number
  ): {
    readonly pitchRadians: number;
    readonly yawRadians: number;
  } {
    const bounds = this.#resolveAuthoritativePlayerLookConstraintBounds(
      playerRuntime
    );
    const constrainedPitchRadians = clamp(
      pitchRadians,
      bounds.minPitchRadians,
      bounds.maxPitchRadians
    );

    if (bounds.maxYawOffsetRadians === null) {
      return {
        pitchRadians: constrainedPitchRadians,
        yawRadians: wrapRadians(yawRadians)
      };
    }

    const constrainedYawOffsetRadians = clamp(
      normalizeAngularDeltaRadians(yawRadians - playerRuntime.yawRadians),
      -bounds.maxYawOffsetRadians,
      bounds.maxYawOffsetRadians
    );

    return {
      pitchRadians: constrainedPitchRadians,
      yawRadians: wrapRadians(
        playerRuntime.yawRadians + constrainedYawOffsetRadians
      )
    };
  }

  syncAuthoritativePlayerLookToCurrentFacing(playerRuntime: PlayerRuntime): void {
    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      playerRuntime.yawRadians,
      playerRuntime.yawRadians
    );
  }

  #resolveAuthoritativePlayerLookConstraintBounds(
    playerRuntime: PlayerRuntime
  ): MetaversePlayerLookConstraintBounds {
    if (playerRuntime.mountedOccupancy === null) {
      return metaverseUnmountedPlayerLookConstraintBounds;
    }

    return resolveMetaverseMountedOccupantRoleLookConstraintBounds(
      playerRuntime.mountedOccupancy.occupantRole
    );
  }

  #syncAuthoritativePlayerLookForFacingChange(
    playerRuntime: PlayerRuntime,
    previousFacingYawRadians: number,
    nextFacingYawRadians: number
  ): void {
    if (playerRuntime.lastProcessedLookSequence === 0) {
      this.syncImplicitPlayerLookFromBodyYaw(playerRuntime);
      return;
    }

    const bounds = this.#resolveAuthoritativePlayerLookConstraintBounds(
      playerRuntime
    );

    playerRuntime.lookPitchRadians = clamp(
      playerRuntime.lookPitchRadians,
      bounds.minPitchRadians,
      bounds.maxPitchRadians
    );

    if (bounds.maxYawOffsetRadians === null) {
      playerRuntime.lookYawRadians = wrapRadians(playerRuntime.lookYawRadians);
      return;
    }

    const constrainedYawOffsetRadians = clamp(
      normalizeAngularDeltaRadians(
        playerRuntime.lookYawRadians - previousFacingYawRadians
      ),
      -bounds.maxYawOffsetRadians,
      bounds.maxYawOffsetRadians
    );

    playerRuntime.lookYawRadians = wrapRadians(
      nextFacingYawRadians + constrainedYawOffsetRadians
    );
  }

  #isGroundedUnmountedPlayerRuntime(playerRuntime: PlayerRuntime): boolean {
    return (
      Math.abs(playerRuntime.positionY - playerRuntime.lastGroundedPositionY) <=
        groundedSnapToleranceMeters &&
      Math.abs(playerRuntime.linearVelocityY) <= groundedSnapToleranceMeters
    );
  }
}
