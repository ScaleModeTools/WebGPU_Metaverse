import {
  clamp,
  type MetaverseGroundedBodyInteractionSnapshot,
  type MetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseTraversalKinematicStateSnapshot,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseUnmountedPlayerLookConstraintBounds,
  resolveMetaverseMountedLookConstraintBounds,
  resolveMetaverseTraversalAngularVelocityRadiansPerSecond,
  resolveMetaverseTraversalAuthoritySnapshotForActionState,
  wrapRadians,
  type MetaverseMountedLookLimitPolicyId,
  type MetaversePlayerLookConstraintBounds,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseTraversalKinematicStateSnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  type MetaversePlayerId,
  type MetaversePlayerTeamId,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimePlayerWeaponStateSnapshot,
  MetaversePlayerTraversalIntentSnapshot,
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { PhysicsVector3Snapshot, RapierColliderHandle } from "../../types/metaverse-authoritative-rapier.js";
import {
  captureMetaverseAuthoritativeLastGroundedBodySnapshot,
  type MetaverseAuthoritativeLastGroundedBodySnapshot
} from "./metaverse-authoritative-last-grounded-body-snapshot.js";
import {
  readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot,
  readMetaverseAuthoritativePlayerActiveBodyYawRadians,
  type MetaverseAuthoritativePlayerActiveBodyKinematicRuntimeState
} from "./metaverse-authoritative-player-active-body.js";

export type MetaverseAuthoritativePlayerStateSyncGroundedBodySnapshot =
  MetaverseGroundedBodyRuntimeSnapshot;

export interface MetaverseAuthoritativePlayerStateSyncGroundedBodyRuntime {
  readonly colliderHandle: RapierColliderHandle;
  readonly snapshot: MetaverseAuthoritativePlayerStateSyncGroundedBodySnapshot;
  syncAuthoritativeState(snapshot: {
    readonly driveTarget?:
      | MetaverseGroundedBodyRuntimeSnapshot["driveTarget"]
      | null;
    readonly grounded: boolean;
    readonly interaction?: MetaverseGroundedBodyInteractionSnapshot | null;
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void;
}

export type MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot =
  MetaverseSurfaceDriveBodyRuntimeSnapshot;

export interface MetaverseAuthoritativePlayerStateSyncSurfaceDriveRuntime {
  readonly colliderHandle: RapierColliderHandle;
  readonly snapshot: MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot;
  syncAuthoritativeState(snapshot: {
    readonly linearVelocity: PhysicsVector3Snapshot;
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  }): void;
}

export interface MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState {
  readonly lookLimitPolicyId: MetaverseMountedLookLimitPolicyId;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
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
> extends MetaverseAuthoritativePlayerActiveBodyKinematicRuntimeState {
  angularVelocityRadiansPerSecond: number;
  readonly characterId: string;
  readonly groundedBodyRuntime: GroundedBodyRuntime;
  lastGroundedBodySnapshot: MetaverseAuthoritativeLastGroundedBodySnapshot;
  lastPoseAtMs: number | null;
  lastProcessedLookSequence: number;
  lastProcessedTraversalSequence: number;
  lastProcessedWeaponSequence: number;
  lastSeenAtMs: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MountedOccupancy | null;
  readonly playerId: MetaversePlayerId;
  readonly teamId: MetaversePlayerTeamId;
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  realtimeWorldAuthorityActive: boolean;
  stateSequence: number;
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly swimBodyRuntime: SwimBodyRuntime;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
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
  readonly createInitialPlayerWeaponState: (
    playerId: MetaversePlayerId
  ) => MetaverseRealtimePlayerWeaponStateSnapshot | null;
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

function createPlayerActiveBodyTraversalKinematicStateSnapshot(
  playerRuntime: MetaverseAuthoritativePlayerStateSyncRuntimeState
): MetaverseTraversalKinematicStateSnapshot {
  const activeBodySnapshot =
    readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime);

  return createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond:
      playerRuntime.angularVelocityRadiansPerSecond,
    linearVelocity: activeBodySnapshot.linearVelocity,
    position: activeBodySnapshot.position,
    yawRadians: activeBodySnapshot.yawRadians
  });
}

function createStoppedTraversalKinematicStateSnapshot(
  playerRuntime: MetaverseAuthoritativePlayerStateSyncRuntimeState
): MetaverseTraversalKinematicStateSnapshot {
  const activeBodySnapshot =
    readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime);

  return createMetaverseTraversalKinematicStateSnapshot({
    angularVelocityRadiansPerSecond: 0,
    linearVelocity: createPhysicsVector3Snapshot(0, 0, 0),
    position: activeBodySnapshot.position,
    yawRadians: activeBodySnapshot.yawRadians
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
    teamId: MetaversePlayerTeamId,
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
      groundedBodyRuntime,
      lastGroundedBodySnapshot:
        captureMetaverseAuthoritativeLastGroundedBodySnapshot(
          groundedBodyRuntime.snapshot
        ),
      lastProcessedLookSequence: 0,
      lastProcessedTraversalSequence: 0,
      lastProcessedWeaponSequence: 0,
      lastPoseAtMs: null,
      lastSeenAtMs: nowMs,
      lookPitchRadians: 0,
      lookYawRadians: this.#dependencies.initialYawRadians,
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId,
      teamId,
      presenceAnimationVocabulary: "idle",
      realtimeWorldAuthorityActive: false,
      stateSequence: 0,
      traversalAuthorityState: createMetaverseTraversalAuthoritySnapshot(),
      unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "grounded"
      }),
      swimBodyRuntime,
      username,
      weaponState: this.#dependencies.createInitialPlayerWeaponState(playerId)
    } as PlayerRuntime;
  }

  syncPlayerTraversalBodyRuntimes(
    playerRuntime: PlayerRuntime,
    groundedOverride?: boolean
  ): void {
    this.#syncPlayerTraversalBodyRuntimesToKinematicState(
      playerRuntime,
      createPlayerActiveBodyTraversalKinematicStateSnapshot(playerRuntime),
      groundedOverride
    );
  }

  stopPlayerTraversalBodyRuntimes(playerRuntime: PlayerRuntime): void {
    this.syncPlayerTraversalKinematicState(
      playerRuntime,
      createStoppedTraversalKinematicStateSnapshot(playerRuntime)
    );
  }

  syncPlayerTraversalKinematicState(
    playerRuntime: PlayerRuntime,
    kinematicStateSnapshot: MetaverseTraversalKinematicStateSnapshot,
    groundedOverride?: boolean
  ): void {
    playerRuntime.angularVelocityRadiansPerSecond =
      kinematicStateSnapshot.angularVelocityRadiansPerSecond;
    this.#syncPlayerTraversalBodyRuntimesToKinematicState(
      playerRuntime,
      kinematicStateSnapshot,
      groundedOverride
    );

    if (playerRuntime.locomotionMode === "grounded") {
      playerRuntime.lastGroundedBodySnapshot =
        captureMetaverseAuthoritativeLastGroundedBodySnapshot(
          playerRuntime.groundedBodyRuntime.snapshot
        );
    }
  }

  #syncPlayerTraversalBodyRuntimesToKinematicState(
    playerRuntime: PlayerRuntime,
    kinematicStateSnapshot: MetaverseTraversalKinematicStateSnapshot,
    groundedOverride?: boolean
  ): void {
    const grounded =
      playerRuntime.locomotionMode === "grounded" &&
      (groundedOverride ??
        this.#isGroundedUnmountedPlayerRuntime(
          playerRuntime,
          kinematicStateSnapshot
        ));

    playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
      driveTarget: playerRuntime.lastGroundedBodySnapshot.driveTarget,
      grounded,
      interaction: playerRuntime.lastGroundedBodySnapshot.interaction,
      linearVelocity: kinematicStateSnapshot.linearVelocity,
      position: kinematicStateSnapshot.position,
      yawRadians: kinematicStateSnapshot.yawRadians
    });
    playerRuntime.swimBodyRuntime.syncAuthoritativeState({
      linearVelocity: kinematicStateSnapshot.linearVelocity,
      position: kinematicStateSnapshot.position,
      yawRadians: kinematicStateSnapshot.yawRadians
    });
  }

  syncMountedPlayerPoseFromVehicle(
    playerRuntime: PlayerRuntime,
    vehicleRuntime: VehicleRuntime,
    nowMs: number,
    previousFacingYawRadians: number =
      readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime)
  ): void {
    this.syncPlayerTraversalKinematicState(
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
        mounted: shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
          playerRuntime.mountedOccupancy
        ),
        previousTraversalAuthority: playerRuntime.traversalAuthorityState
      });
  }

  applyGroundedBodySnapshotToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    groundedBodySnapshot: GroundedBodyRuntime["snapshot"],
    deltaSeconds: number,
    previousFacingYawRadians: number =
      readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime)
  ): void {
    const nextKinematicStateSnapshot =
      createMetaverseTraversalKinematicStateSnapshot({
        angularVelocityRadiansPerSecond:
          resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
            previousFacingYawRadians,
            groundedBodySnapshot.yawRadians,
            deltaSeconds
          ),
        linearVelocity: groundedBodySnapshot.linearVelocity,
        position: groundedBodySnapshot.position,
        yawRadians: groundedBodySnapshot.yawRadians
      });

    this.syncPlayerTraversalKinematicState(
      playerRuntime,
      nextKinematicStateSnapshot
    );
    playerRuntime.lastGroundedBodySnapshot =
      captureMetaverseAuthoritativeLastGroundedBodySnapshot(
        groundedBodySnapshot
      );
  }

  applySurfaceDriveSnapshotToPlayerRuntime(
    playerRuntime: PlayerRuntime,
    surfaceDriveSnapshot: MetaverseAuthoritativePlayerStateSyncSurfaceDriveSnapshot,
    deltaSeconds: number,
    previousFacingYawRadians: number =
      readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime)
  ): void {
    const nextKinematicStateSnapshot =
      createMetaverseTraversalKinematicStateSnapshot({
        angularVelocityRadiansPerSecond:
          resolveMetaverseTraversalAngularVelocityRadiansPerSecond(
            previousFacingYawRadians,
            surfaceDriveSnapshot.yawRadians,
            deltaSeconds
          ),
        linearVelocity: surfaceDriveSnapshot.linearVelocity,
        position: surfaceDriveSnapshot.position,
        yawRadians: surfaceDriveSnapshot.yawRadians
      });

    this.syncPlayerTraversalKinematicState(
      playerRuntime,
      nextKinematicStateSnapshot
    );
  }

  syncUnmountedPlayerToGroundedSupport(
    playerRuntime: PlayerRuntime,
    supportHeightMeters: number,
    deltaSeconds: number
  ): void {
    const activeBodySnapshot =
      readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime);
    playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
      driveTarget: playerRuntime.lastGroundedBodySnapshot.driveTarget,
      grounded: true,
      interaction: playerRuntime.lastGroundedBodySnapshot.interaction,
      linearVelocity: createPhysicsVector3Snapshot(
        activeBodySnapshot.linearVelocity.x,
        0,
        activeBodySnapshot.linearVelocity.z
      ),
      position: createPhysicsVector3Snapshot(
        activeBodySnapshot.position.x,
        supportHeightMeters,
        activeBodySnapshot.position.z
      ),
      yawRadians: activeBodySnapshot.yawRadians
    });
    this.applyGroundedBodySnapshotToPlayerRuntime(
      playerRuntime,
      playerRuntime.groundedBodyRuntime.snapshot,
      deltaSeconds
    );
  }

  syncUnmountedPlayerToSwimWaterline(
    playerRuntime: PlayerRuntime,
    waterlineHeightMeters: number,
    deltaSeconds: number
  ): void {
    const activeBodySnapshot =
      readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime);
    playerRuntime.swimBodyRuntime.syncAuthoritativeState({
      linearVelocity: createPhysicsVector3Snapshot(
        activeBodySnapshot.linearVelocity.x,
        0,
        activeBodySnapshot.linearVelocity.z
      ),
      position: createPhysicsVector3Snapshot(
        activeBodySnapshot.position.x,
        waterlineHeightMeters,
        activeBodySnapshot.position.z
      ),
      yawRadians: activeBodySnapshot.yawRadians
    });
    this.applySurfaceDriveSnapshotToPlayerRuntime(
      playerRuntime,
      playerRuntime.swimBodyRuntime.snapshot,
      deltaSeconds
    );
  }

  syncImplicitPlayerLookFromBodyYaw(playerRuntime: PlayerRuntime): void {
    if (playerRuntime.lastProcessedLookSequence > 0) {
      return;
    }

    playerRuntime.lookPitchRadians = 0;
    playerRuntime.lookYawRadians =
      readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime);
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
      wrapRadians(
        yawRadians -
          readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime)
      ),
      -bounds.maxYawOffsetRadians,
      bounds.maxYawOffsetRadians
    );

    return {
      pitchRadians: constrainedPitchRadians,
      yawRadians: wrapRadians(
        readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime) +
          constrainedYawOffsetRadians
      )
    };
  }

  syncAuthoritativePlayerLookToCurrentFacing(playerRuntime: PlayerRuntime): void {
    const activeBodyYawRadians =
      readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime);

    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      activeBodyYawRadians,
      activeBodyYawRadians
    );
  }

  #resolveAuthoritativePlayerLookConstraintBounds(
    playerRuntime: PlayerRuntime
  ): MetaversePlayerLookConstraintBounds {
    const mountedOccupancy = playerRuntime.mountedOccupancy;

    if (
      !shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
        mountedOccupancy
      )
    ) {
      return metaverseUnmountedPlayerLookConstraintBounds;
    }

    return resolveMetaverseMountedLookConstraintBounds(
      mountedOccupancy!.lookLimitPolicyId
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

  #isGroundedUnmountedPlayerRuntime(
    playerRuntime: PlayerRuntime,
    kinematicStateSnapshot: MetaverseTraversalKinematicStateSnapshot
  ): boolean {
    return (
      Math.abs(
        kinematicStateSnapshot.position.y -
          playerRuntime.lastGroundedBodySnapshot.positionYMeters
      ) <=
        groundedSnapToleranceMeters &&
      Math.abs(kinematicStateSnapshot.linearVelocity.y) <=
        groundedSnapToleranceMeters
    );
  }
}
