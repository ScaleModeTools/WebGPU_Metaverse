import {
  advanceMetaverseUnmountedTraversalBodyStep,
  clamp,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseWorldPlacedWaterRegionSnapshot,
  MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";

import type { MetaverseAuthoritativeSurfaceColliderSnapshot } from "../../world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
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
import {
  createMetaverseAuthoritativeLastGroundedBodySnapshot,
  captureMetaverseAuthoritativeLastGroundedBodySnapshot
} from "../players/metaverse-authoritative-last-grounded-body-snapshot.js";

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
  readonly createGroundedTraversalColliderPredicate: (
    playerRuntime: PlayerRuntime,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly createWaterborneTraversalColliderPredicate: (
    playerRuntime: PlayerRuntime,
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
    let lastGroundedBodySnapshot = playerRuntime.lastGroundedBodySnapshot;
    let grounded = false;
    let surfaceJumpSupported = false;
    let groundedJumpSupported = false;
    let resolvedLocomotionMode: "grounded" | "swim" = locomotionMode;
    if (locomotionMode === "grounded") {
      lastGroundedBodySnapshot =
        captureMetaverseAuthoritativeLastGroundedBodySnapshot(
          playerRuntime.groundedBodyRuntime.snapshot
        );
    }

    const traversalBodyStep = advanceMetaverseUnmountedTraversalBodyStep({
      advanceGroundedBodySnapshot: ({
        autostepHeightMeters,
        bodyIntent,
        preferredLookYawRadians: resolvedLookYawRadians
      }) => {
        playerRuntime.groundedBodyRuntime.setAutostepEnabled(
          autostepHeightMeters !== null,
          autostepHeightMeters ??
            this.#dependencies.groundedBodyConfig.stepHeightMeters
        );

        return playerRuntime.groundedBodyRuntime.advance(
          bodyIntent,
          deltaSeconds,
          resolvedLookYawRadians,
          this.#dependencies.createGroundedTraversalColliderPredicate(
            playerRuntime
          )
        );
      },
      advanceSwimBodySnapshot: ({
        bodyControl,
        preferredLookYawRadians: resolvedLookYawRadians,
        waterlineHeightMeters
      }) =>
        playerRuntime.swimBodyRuntime.advance(
          {
            boost: bodyControl.boost,
            moveAxis: bodyControl.moveAxis,
            strafeAxis: bodyControl.strafeAxis,
            yawAxis: bodyControl.turnAxis
          },
          this.#dependencies.swimTraversalConfig,
          deltaSeconds,
          waterlineHeightMeters,
          resolvedLookYawRadians,
          this.#dependencies.createWaterborneTraversalColliderPredicate(
            playerRuntime
          ),
          Object.freeze({
            surfaceColliderSnapshots: authoritativeSurfaceColliders
          })
        ),
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
    const preparedTraversalStep = traversalBodyStep.preparedTraversalStep;
    playerRuntime.unmountedTraversalState =
      traversalBodyStep.locomotionOutcome.traversalState;
    const transitionSnapshot = traversalBodyStep.transitionSnapshot;

    if (preparedTraversalStep.locomotionMode === "swim") {
      const swimSnapshot = traversalBodyStep.swimBodySnapshot;
      const swimTraversalOutcome = traversalBodyStep.locomotionOutcome;

      if (swimSnapshot === null) {
        throw new Error(
          "advanceMetaverseUnmountedTraversalBodyStep returned a grounded snapshot while swimming"
        );
      }

      this.#dependencies.playerStateSync.applySurfaceDriveSnapshotToPlayerRuntime(
        playerRuntime,
        createMetaverseSurfaceDriveBodyRuntimeSnapshot({
          ...swimSnapshot,
          position: createPhysicsVector3Snapshot(
            swimSnapshot.position.x,
            swimTraversalOutcome.waterlineHeightMeters,
            swimSnapshot.position.z
          ),
          yawRadians: swimSnapshot.yawRadians
        }),
        deltaSeconds
      );

      if (transitionSnapshot.enteredGrounded) {
        playerRuntime.positionY =
          transitionSnapshot.positionYMeters ?? playerRuntime.positionY;
      }

      if (transitionSnapshot.resetVerticalVelocity) {
        playerRuntime.linearVelocityY = 0;
      }

      grounded = transitionSnapshot.grounded;
      resolvedLocomotionMode = transitionSnapshot.locomotionMode;
    } else {
      surfaceJumpSupported = preparedTraversalStep.surfaceJumpSupported;
      groundedJumpSupported = preparedTraversalStep.groundedJumpSupported;
      const groundedBodySnapshot = traversalBodyStep.groundedBodySnapshot;

      if (groundedBodySnapshot === null) {
        throw new Error(
          "advanceMetaverseUnmountedTraversalBodyStep returned a swim snapshot while grounded"
        );
      }

      this.#dependencies.playerStateSync.applyGroundedBodySnapshotToPlayerRuntime(
        playerRuntime,
        groundedBodySnapshot,
        deltaSeconds
      );

      if (transitionSnapshot.enteredSwim) {
        playerRuntime.positionY =
          transitionSnapshot.positionYMeters ?? playerRuntime.positionY;
      }

      if (transitionSnapshot.resetVerticalVelocity) {
        playerRuntime.linearVelocityY = 0;
      }

      resolvedLocomotionMode = transitionSnapshot.locomotionMode;
      grounded = transitionSnapshot.grounded;
      lastGroundedBodySnapshot =
        captureMetaverseAuthoritativeLastGroundedBodySnapshot(
          playerRuntime.groundedBodyRuntime.snapshot
        );
    }

    playerRuntime.lastGroundedBodySnapshot = lastGroundedBodySnapshot;
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
      playerRuntime.lastGroundedBodySnapshot =
        createMetaverseAuthoritativeLastGroundedBodySnapshot({
          ...playerRuntime.lastGroundedBodySnapshot,
          positionYMeters: playerRuntime.positionY
        });
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
