import {
  clamp,
  createMetaverseUnmountedTraversalStateSnapshot,
  prepareMetaverseUnmountedTraversalStep,
  resolveMetaverseUnmountedTraversalStep,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";

import type { MetaverseAuthoritativeSurfaceColliderSnapshot } from "../../config/metaverse-authoritative-world-surface.js";
import { MetaverseAuthoritativeGroundedBodyRuntime } from "../../classes/metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "../../classes/metaverse-authoritative-surface-drive-runtime.js";
import {
  MetaverseAuthoritativePlayerStateSync,
  type MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState,
  type MetaverseAuthoritativePlayerStateSyncRuntimeState,
  type MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
} from "../players/metaverse-authoritative-player-state-sync.js";
import type { MetaverseAuthoritativePlayerTraversalIntentRuntimeState } from "./metaverse-authoritative-player-traversal-authority.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../../types/metaverse-authoritative-rapier.js";

interface MetaverseAuthoritativeGroundedTraversalRuntimeConfig {
  readonly controllerOffsetMeters: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
  readonly stepHeightMeters: number;
}

interface MetaverseAuthoritativeUnmountedPlayerSimulationDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerStateSyncRuntimeState<
    MetaverseAuthoritativeGroundedBodyRuntime,
    MetaverseAuthoritativeSurfaceDriveRuntime,
    MountedOccupancy
  >,
  MountedOccupancy extends MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
> {
  readonly createWaterborneTraversalColliderPredicate: (
    excludedOwnerEnvironmentAssetId?: string | null,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly groundedBodyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly groundedBodyRuntimeConfig: MetaverseAuthoritativeGroundedTraversalRuntimeConfig;
  readonly groundedJumpSupportVerticalSpeedTolerance: number;
  readonly playerStateSync: MetaverseAuthoritativePlayerStateSync<
    PlayerRuntime,
    MetaverseAuthoritativeGroundedBodyRuntime,
    MetaverseAuthoritativeSurfaceDriveRuntime,
    MountedOccupancy,
    VehicleRuntime
  >;
  readonly playerTraversalIntentsByPlayerId: ReadonlyMap<
    MetaversePlayerId,
    MetaverseAuthoritativePlayerTraversalIntentRuntimeState
  >;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly resolveAuthoritativeSurfaceColliders: () => readonly MetaverseAuthoritativeSurfaceColliderSnapshot[];
  readonly shouldConsiderTraversalCollider: (
    collider: RapierColliderHandle
  ) => boolean;
  readonly swimTraversalConfig: MetaverseSurfaceTraversalConfig;
  readonly waterRegionSnapshots: readonly MetaverseWorldPlacedWaterRegionSnapshot[];
}

function clampAxis(rawValue: number): number {
  return clamp(rawValue, -1, 1);
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

export class MetaverseAuthoritativeUnmountedPlayerSimulation<
  PlayerRuntime extends MetaverseAuthoritativePlayerStateSyncRuntimeState<
    MetaverseAuthoritativeGroundedBodyRuntime,
    MetaverseAuthoritativeSurfaceDriveRuntime,
    MountedOccupancy
  >,
  MountedOccupancy extends MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState = MetaverseAuthoritativePlayerStateSyncMountedOccupancyRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState = MetaverseAuthoritativePlayerStateSyncVehicleRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeUnmountedPlayerSimulationDependencies<
    PlayerRuntime,
    MountedOccupancy,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativeUnmountedPlayerSimulationDependencies<
      PlayerRuntime,
      MountedOccupancy,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  advanceUnmountedPlayerRuntimes(deltaSeconds: number, nowMs: number): void {
    const authoritativeSurfaceColliders =
      this.#dependencies.resolveAuthoritativeSurfaceColliders();

    for (const playerRuntime of this.#dependencies.playersById.values()) {
      if (playerRuntime.mountedOccupancy !== null) {
        continue;
      }

      this.#advanceUnmountedPlayerRuntime(
        playerRuntime,
        deltaSeconds,
        nowMs,
        authoritativeSurfaceColliders
      );
    }
  }

  #advanceUnmountedPlayerRuntime(
    playerRuntime: PlayerRuntime,
    deltaSeconds: number,
    nowMs: number,
    authoritativeSurfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[]
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const traversalIntent =
      this.#dependencies.playerTraversalIntentsByPlayerId.get(
        playerRuntime.playerId
      ) ?? null;
    const locomotionMode =
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded";
    const moveAxis = clampAxis(traversalIntent?.bodyControl.moveAxis ?? 0);
    const strafeAxis = clampAxis(traversalIntent?.bodyControl.strafeAxis ?? 0);
    const preferredFacingYawRadians = traversalIntent?.facing.yawRadians ?? null;
    let groundedBodyJumpReady = false;
    let grounded = false;
    let surfaceJumpSupported = false;
    let groundedJumpSupported = false;
    let resolvedLocomotionMode: "grounded" | "swim" = locomotionMode;
    const preparedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: traversalIntent?.bodyControl.boost === true,
        moveAxis,
        strafeAxis,
        turnAxis: traversalIntent?.bodyControl.turnAxis ?? 0
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          this.#dependencies.groundedBodyRuntimeConfig.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          this.#dependencies.groundedBodyRuntimeConfig.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          this.#dependencies.groundedBodyRuntimeConfig.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot:
        locomotionMode === "grounded"
          ? playerRuntime.groundedBodyRuntime.snapshot
          : null,
      jumpSupportVerticalSpeedTolerance:
        this.#dependencies.groundedJumpSupportVerticalSpeedTolerance,
      preferredLookYawRadians: preferredFacingYawRadians,
      surfaceColliderSnapshots: authoritativeSurfaceColliders,
      surfacePolicyConfig: this.#dependencies.groundedBodyConfig,
      swimBodySnapshot:
        locomotionMode === "swim" ? playerRuntime.swimBodyRuntime.snapshot : null,
      traversalState: playerRuntime.unmountedTraversalState,
      waterRegionSnapshots: this.#dependencies.waterRegionSnapshots
    });
    playerRuntime.unmountedTraversalState = preparedTraversalStep.traversalState;

    if (preparedTraversalStep.locomotionMode === "swim") {
      const swimSnapshot = playerRuntime.swimBodyRuntime.advance(
        {
          boost: preparedTraversalStep.bodyControl.boost,
          moveAxis: preparedTraversalStep.bodyControl.moveAxis,
          strafeAxis: preparedTraversalStep.bodyControl.strafeAxis,
          yawAxis: preparedTraversalStep.bodyControl.turnAxis
        },
        this.#dependencies.swimTraversalConfig,
        deltaSeconds,
        preparedTraversalStep.waterlineHeightMeters,
        preferredFacingYawRadians,
        this.#dependencies.createWaterborneTraversalColliderPredicate(),
        Object.freeze({
          surfaceColliderSnapshots: authoritativeSurfaceColliders
        })
      );
      const swimTraversalOutcome = resolveMetaverseUnmountedTraversalStep({
        groundedBodySnapshot: null,
        preparedTraversalStep,
        surfaceColliderSnapshots: authoritativeSurfaceColliders,
        surfacePolicyConfig: this.#dependencies.groundedBodyConfig,
        swimBodySnapshot: swimSnapshot,
        waterRegionSnapshots: this.#dependencies.waterRegionSnapshots
      });
      playerRuntime.unmountedTraversalState = swimTraversalOutcome.traversalState;
      this.#dependencies.playerStateSync.applySurfaceDriveSnapshotToPlayerRuntime(
        playerRuntime,
        {
          linearVelocity: swimSnapshot.linearVelocity,
          position: createPhysicsVector3Snapshot(
            swimSnapshot.position.x,
            swimTraversalOutcome.waterlineHeightMeters,
            swimSnapshot.position.z
          ),
          yawRadians: swimSnapshot.yawRadians
        },
        deltaSeconds
      );

      if (swimTraversalOutcome.grounded) {
        playerRuntime.positionY =
          swimTraversalOutcome.supportHeightMeters ?? playerRuntime.positionY;
        playerRuntime.linearVelocityY = 0;
        grounded = true;
        resolvedLocomotionMode = "grounded";
      }
    } else {
      groundedBodyJumpReady = playerRuntime.groundedBodyRuntime.snapshot.jumpReady;
      surfaceJumpSupported = preparedTraversalStep.surfaceJumpSupported;
      groundedJumpSupported = preparedTraversalStep.groundedJumpSupported;

      playerRuntime.groundedBodyRuntime.setAutostepEnabled(
        preparedTraversalStep.autostepHeightMeters !== null,
        preparedTraversalStep.autostepHeightMeters ??
          this.#dependencies.groundedBodyConfig.stepHeightMeters
      );
      const groundedBodySnapshot = playerRuntime.groundedBodyRuntime.advance(
        preparedTraversalStep.bodyIntent,
        deltaSeconds,
        preferredFacingYawRadians,
        this.#dependencies.shouldConsiderTraversalCollider
      );
      this.#dependencies.playerStateSync.applyGroundedBodySnapshotToPlayerRuntime(
        playerRuntime,
        groundedBodySnapshot,
        deltaSeconds
      );
      const groundedTraversalOutcome = resolveMetaverseUnmountedTraversalStep({
        groundedBodySnapshot,
        preparedTraversalStep,
        surfaceColliderSnapshots: authoritativeSurfaceColliders,
        surfacePolicyConfig: this.#dependencies.groundedBodyConfig,
        swimBodySnapshot: null,
        waterRegionSnapshots: this.#dependencies.waterRegionSnapshots
      });
      playerRuntime.unmountedTraversalState =
        groundedTraversalOutcome.traversalState;

      if (groundedTraversalOutcome.locomotionMode === "swim") {
        playerRuntime.positionY = groundedTraversalOutcome.waterlineHeightMeters;
        playerRuntime.linearVelocityY = 0;
        grounded = false;
        resolvedLocomotionMode = "swim";
      } else {
        resolvedLocomotionMode = "grounded";
        grounded = groundedTraversalOutcome.grounded;
      }
    }

    playerRuntime.lastGroundedBodyJumpReady = groundedBodyJumpReady;
    playerRuntime.lastSurfaceJumpSupported = surfaceJumpSupported;
    playerRuntime.lastGroundedJumpSupported = groundedJumpSupported;

    if (traversalIntent === null) {
      this.#dependencies.playerStateSync.syncImplicitPlayerLookFromBodyYaw(
        playerRuntime
      );
    } else {
      this.#dependencies.playerStateSync.syncUnmountedPlayerLookFromTraversalIntent(
        playerRuntime,
        traversalIntent
      );
    }
    playerRuntime.locomotionMode = resolvedLocomotionMode;
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        actionState: playerRuntime.unmountedTraversalState.actionState,
        locomotionMode: resolvedLocomotionMode
      });
    playerRuntime.lastPoseAtMs = nowMs;

    if (resolvedLocomotionMode === "grounded" && grounded) {
      playerRuntime.lastGroundedPositionY = playerRuntime.positionY;
    }

    this.#dependencies.playerStateSync.syncPlayerTraversalBodyRuntimes(
      playerRuntime,
      resolvedLocomotionMode === "grounded" && grounded
    );

    if (
      traversalIntent !== null &&
      traversalIntent.inputSequence > playerRuntime.lastProcessedInputSequence
    ) {
      playerRuntime.lastProcessedInputSequence = traversalIntent.inputSequence;
      playerRuntime.stateSequence = traversalIntent.inputSequence;
    }

    if (
      traversalIntent !== null &&
      traversalIntent.orientationSequence >
        playerRuntime.lastProcessedTraversalOrientationSequence
    ) {
      playerRuntime.lastProcessedTraversalOrientationSequence =
        traversalIntent.orientationSequence;
    }

    this.#dependencies.playerStateSync.syncPlayerTraversalAuthorityState(
      playerRuntime
    );
  }
}
