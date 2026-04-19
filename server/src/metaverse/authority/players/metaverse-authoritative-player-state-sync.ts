import {
  clamp,
  createMetaverseTraversalKinematicStateSnapshot,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseUnmountedPlayerLookConstraintBounds,
  resolveMetaverseMountedLookConstraintBounds,
  resolveMetaverseTraversalAngularVelocityRadiansPerSecond,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  resolveMetaverseTraversalKinematicState,
  wrapRadians,
  type MetaverseMountedLookLimitPolicyId,
  type MetaversePlayerLookConstraintBounds,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseTraversalKinematicStateSnapshot,
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
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
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
    playerId: MetaversePlayerId,
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

const groundedSnapToleranceMeters = 0.0001;

function createVehicleTraversalKinematicStateSnapshot(
  vehicleRuntime: MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
): MetaverseTraversalKinematicStateSnapshot {
  return createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond:
      vehicleRuntime.angularVelocityRadiansPerSecond,
    linearVelocity: createPhysicsVector3Snapshot(
      vehicleRuntime.linearVelocityX,
      vehicleRuntime.linearVelocityY,
      vehicleRuntime.linearVelocityZ
    ),
    position: createPhysicsVector3Snapshot(
      vehicleRuntime.positionX,
      vehicleRuntime.positionY,
      vehicleRuntime.positionZ
    ),
    yawRadians: vehicleRuntime.yawRadians
  });
}

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
      playerId,
      groundedBodyRuntime.colliderHandle
    );
    this.#dependencies.addPlayerTraversalColliderHandle(
      playerId,
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
    this.#applyTraversalKinematicStateToPlayerRuntime(
      playerRuntime,
      createVehicleTraversalKinematicStateSnapshot(vehicleRuntime)
    );
    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      previousFacingYawRadians,
      vehicleRuntime.yawRadians
    );
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
    const nextKinematicStateSnapshot = resolveMetaverseTraversalKinematicState(
      {
        position: createPhysicsVector3Snapshot(
          playerRuntime.positionX,
          playerRuntime.positionY,
          playerRuntime.positionZ
        ),
        yawRadians: playerRuntime.yawRadians
      },
      {
        position: groundedBodySnapshot.position,
        yawRadians: groundedBodySnapshot.yawRadians
      },
      deltaSeconds
    );

    this.#applyTraversalKinematicStateToPlayerRuntime(
      playerRuntime,
      nextKinematicStateSnapshot
    );
  }

  applySurfaceDriveSnapshotToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    surfaceDriveSnapshot: MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot,
    deltaSeconds: number
  ): void {
    const previousYawRadians = playerRuntime.yawRadians;
    const nextKinematicStateSnapshot =
      createMetaverseTraversalKinematicStateSnapshot({
        angularVelocityRadiansPerSecond:
          resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
            previousYawRadians,
            surfaceDriveSnapshot.yawRadians,
            deltaSeconds
          ),
        linearVelocity: surfaceDriveSnapshot.linearVelocity,
        position: surfaceDriveSnapshot.position,
        yawRadians: surfaceDriveSnapshot.yawRadians
      });

    this.#applyTraversalKinematicStateToPlayerRuntime(
      playerRuntime,
      nextKinematicStateSnapshot
    );
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
      wrapRadians(yawRadians - playerRuntime.yawRadians),
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

    return resolveMetaverseMountedLookConstraintBounds(
      playerRuntime.mountedOccupancy.lookLimitPolicyId
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
      wrapRadians(
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

  #applyTraversalKinematicStateToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    kinematicStateSnapshot: MetaverseTraversalKinematicStateSnapshot
  ): void {
    playerRuntime.positionX = kinematicStateSnapshot.position.x;
    playerRuntime.positionY = kinematicStateSnapshot.position.y;
    playerRuntime.positionZ = kinematicStateSnapshot.position.z;
    playerRuntime.yawRadians = kinematicStateSnapshot.yawRadians;
    playerRuntime.angularVelocityRadiansPerSecond =
      kinematicStateSnapshot.angularVelocityRadiansPerSecond;
    playerRuntime.forwardSpeedUnitsPerSecond =
      kinematicStateSnapshot.forwardSpeedUnitsPerSecond;
    playerRuntime.linearVelocityX = kinematicStateSnapshot.linearVelocity.x;
    playerRuntime.linearVelocityY = kinematicStateSnapshot.linearVelocity.y;
    playerRuntime.linearVelocityZ = kinematicStateSnapshot.linearVelocity.z;
    playerRuntime.strafeSpeedUnitsPerSecond =
      kinematicStateSnapshot.strafeSpeedUnitsPerSecond;
  }
}
