import {
  advanceMetaverseDeterministicUnmountedGroundedBodyStep,
  advanceMetaverseUnmountedTraversalBodyStep,
  clamp,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseTraversalActionBufferSeconds,
  queueMetaverseUnmountedTraversalAction,
  type MetaverseGroundedBodyConfigSnapshot,
  type MetaverseTraversalPlayerBodyBlockerSnapshot,
  type MetaverseSurfaceTraversalConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  type MetaversePlayerId
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaversePlayerTraversalIntentSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
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
    playerRuntime: PlayerRuntime,
    excludedOwnerEnvironmentAssetId?: string | null,
    excludedColliders?: readonly RapierColliderHandle[]
  ) => RapierQueryFilterPredicate;
  readonly groundedBodyConfig: MetaverseWorldSurfacePolicyConfig;
  readonly groundedBodyRuntimeConfig: MetaverseGroundedBodyConfigSnapshot;
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
  readonly resolveGroundedTraversalPlayerBlockers: (
    playerRuntime: PlayerRuntime
  ) => readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];
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

interface MetaverseAuthoritativePlayerTraversalIntentSegmentRuntimeState {
  readonly deltaSeconds: number;
  readonly nowMs: number;
  readonly traversalIntent: MetaversePlayerTraversalIntentSnapshot | null;
}

function resolveTraversalIntentSequence(
  intent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "sequence"
  >
): number {
  return intent.sequence;
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
      if (
        shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
          playerRuntime.mountedOccupancy
        )
      ) {
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

    const traversalIntentRuntime =
      this.#dependencies.playerTraversalIntentsByPlayerId.get(
        playerRuntime.playerId
      ) ?? null;
    const traversalIntentSegments = this.#consumeTraversalIntentSegments(
      playerRuntime,
      traversalIntentRuntime,
      nowMs - deltaSeconds * 1_000,
      nowMs
    );

    for (const traversalIntentSegment of traversalIntentSegments) {
      this.#advanceUnmountedPlayerRuntimeSegment(
        playerRuntime,
        traversalIntentSegment.deltaSeconds,
        traversalIntentSegment.nowMs,
        authoritativeSurfaceColliders,
        traversalIntentSegment.traversalIntent
      );
    }
  }

  #advanceUnmountedPlayerRuntimeSegment(
    playerRuntime: PlayerRuntime,
    deltaSeconds: number,
    nowMs: number,
    authoritativeSurfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[],
    traversalIntent: MetaversePlayerTraversalIntentSnapshot | null
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const locomotionMode =
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded";
    const moveAxis = clampAxis(traversalIntent?.bodyControl.moveAxis ?? 0);
    const strafeAxis = clampAxis(traversalIntent?.bodyControl.strafeAxis ?? 0);
    const preferredFacingYawRadians = traversalIntent?.facing.yawRadians ?? null;
    let lastGroundedBodySnapshot = playerRuntime.lastGroundedBodySnapshot;
    let grounded = false;
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
        const deterministicGroundedBodySnapshot =
          advanceMetaverseDeterministicUnmountedGroundedBodyStep({
            autostepHeightMeters,
            bodyIntent,
            currentGroundedBodySnapshot:
              playerRuntime.groundedBodyRuntime.snapshot,
            deltaSeconds,
            groundedBodyConfig:
              this.#dependencies.groundedBodyRuntimeConfig,
            playerBlockers:
              this.#dependencies.resolveGroundedTraversalPlayerBlockers(
                playerRuntime
              ),
            preferredLookYawRadians: resolvedLookYawRadians,
            preferredSupport:
              playerRuntime.unmountedTraversalState.groundedSupport,
            surfaceColliderSnapshots: authoritativeSurfaceColliders,
            surfacePolicyConfig: this.#dependencies.groundedBodyConfig
          });

        playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
          contact: deterministicGroundedBodySnapshot.contact,
          driveTarget: deterministicGroundedBodySnapshot.driveTarget,
          grounded: deterministicGroundedBodySnapshot.grounded,
          interaction: deterministicGroundedBodySnapshot.interaction,
          jumpBody: deterministicGroundedBodySnapshot.jumpBody,
          linearVelocity: deterministicGroundedBodySnapshot.linearVelocity,
          position: deterministicGroundedBodySnapshot.position,
          yawRadians: deterministicGroundedBodySnapshot.yawRadians
        });

        return playerRuntime.groundedBodyRuntime.snapshot;
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
      syncResolvedGroundedBodySnapshot: ({
        grounded,
        groundedBodySnapshot
      }) =>
        this.#syncGroundedBodySupportState(
          playerRuntime,
          groundedBodySnapshot,
          grounded
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
      preferredLookYawRadians: preferredFacingYawRadians,
      surfaceColliderSnapshots: authoritativeSurfaceColliders,
      surfacePolicyConfig: this.#dependencies.groundedBodyConfig,
      swimBodySnapshot:
        locomotionMode === "swim" ? playerRuntime.swimBodyRuntime.snapshot : null,
      traversalState: playerRuntime.unmountedTraversalState,
      waterRegionSnapshots: this.#dependencies.waterRegionSnapshots
    });
    const preparedTraversalStep = traversalBodyStep.preparedTraversalStep;
    const resolvedTraversalState =
      traversalBodyStep.locomotionOutcome.traversalState;
    playerRuntime.unmountedTraversalState = resolvedTraversalState;
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
        this.#dependencies.playerStateSync.syncUnmountedPlayerToGroundedSupport(
          playerRuntime,
          swimTraversalOutcome.supportHeightMeters ?? playerRuntime.positionY,
          deltaSeconds
        );
        lastGroundedBodySnapshot = playerRuntime.lastGroundedBodySnapshot;
      }

      grounded = transitionSnapshot.grounded;
      resolvedLocomotionMode = transitionSnapshot.locomotionMode;
    } else {
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
        this.#dependencies.playerStateSync.syncUnmountedPlayerToSwimWaterline(
          playerRuntime,
          traversalBodyStep.locomotionOutcome.waterlineHeightMeters,
          deltaSeconds
        );
      }

      resolvedLocomotionMode = transitionSnapshot.locomotionMode;
      grounded = transitionSnapshot.grounded;
      lastGroundedBodySnapshot =
        captureMetaverseAuthoritativeLastGroundedBodySnapshot(
          playerRuntime.groundedBodyRuntime.snapshot
        );
    }

    playerRuntime.lastGroundedBodySnapshot = lastGroundedBodySnapshot;

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
        actionState: resolvedTraversalState.actionState,
        groundedSupport: resolvedTraversalState.groundedSupport,
        locomotionMode: resolvedTraversalState.locomotionMode
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

    if (traversalIntent !== null) {
      const traversalSequence =
        resolveTraversalIntentSequence(traversalIntent);

      if (traversalSequence > playerRuntime.lastProcessedTraversalSequence) {
        playerRuntime.lastProcessedTraversalSequence = traversalSequence;
        playerRuntime.stateSequence = traversalSequence;
      }
    }

    this.#dependencies.playerStateSync.syncPlayerTraversalAuthorityState(
      playerRuntime
    );
  }

  #activateTraversalIntentTimelineEntry(
    playerRuntime: PlayerRuntime,
    traversalIntentRuntime: MetaverseAuthoritativePlayerTraversalIntentRuntimeState,
    currentIntent: MetaversePlayerTraversalIntentSnapshot,
    nextTimelineEntry: MetaverseAuthoritativePlayerTraversalIntentRuntimeState["pendingIntentTimeline"][number]
  ): MetaversePlayerTraversalIntentSnapshot {
    const nextIntent = nextTimelineEntry.intent;

    traversalIntentRuntime.pendingIntentTimeline.shift();
    playerRuntime.lookPitchRadians = nextIntent.facing.pitchRadians;
    playerRuntime.lookYawRadians = nextIntent.facing.yawRadians;
    playerRuntime.unmountedTraversalState =
      queueMetaverseUnmountedTraversalAction(
        playerRuntime.unmountedTraversalState,
        {
          actionIntent: nextIntent.actionIntent,
          bufferSeconds: metaverseTraversalActionBufferSeconds
        }
      );

    if (nextIntent === currentIntent) {
      return currentIntent;
    }

    return nextIntent;
  }

  #consumeTraversalIntentSegments(
    playerRuntime: PlayerRuntime,
    traversalIntentRuntime: MetaverseAuthoritativePlayerTraversalIntentRuntimeState | null,
    tickStartedAtMs: number,
    tickEndedAtMs: number
  ): readonly MetaverseAuthoritativePlayerTraversalIntentSegmentRuntimeState[] {
    if (!Number.isFinite(tickStartedAtMs) || !Number.isFinite(tickEndedAtMs)) {
      return Object.freeze([]);
    }

    const clampedTickStartedAtMs = Math.max(0, tickStartedAtMs);

    if (tickEndedAtMs <= clampedTickStartedAtMs) {
      return Object.freeze([]);
    }

    if (traversalIntentRuntime === null) {
      return Object.freeze([
        Object.freeze({
          deltaSeconds: (tickEndedAtMs - clampedTickStartedAtMs) / 1_000,
          nowMs: tickEndedAtMs,
          traversalIntent: null
        })
      ]);
    }

    let currentIntent = traversalIntentRuntime.currentIntent;
    const traversalIntentSegments:
      MetaverseAuthoritativePlayerTraversalIntentSegmentRuntimeState[] = [];
    let segmentStartedAtMs = clampedTickStartedAtMs;

    while (true) {
      const nextTimelineEntry =
        traversalIntentRuntime.pendingIntentTimeline[0];

      if (
        nextTimelineEntry === undefined ||
        nextTimelineEntry.effectiveAtMs > clampedTickStartedAtMs
      ) {
        break;
      }

      currentIntent = this.#activateTraversalIntentTimelineEntry(
        playerRuntime,
        traversalIntentRuntime,
        currentIntent,
        nextTimelineEntry
      );
    }

    traversalIntentRuntime.currentIntent = currentIntent;

    while (true) {
      const nextTimelineEntry =
        traversalIntentRuntime.pendingIntentTimeline[0];

      if (
        nextTimelineEntry === undefined ||
        nextTimelineEntry.effectiveAtMs >= tickEndedAtMs
      ) {
        break;
      }

      const segmentEndedAtMs = Math.max(
        segmentStartedAtMs,
        nextTimelineEntry.effectiveAtMs
      );
      const segmentDeltaMs = segmentEndedAtMs - segmentStartedAtMs;

      if (segmentDeltaMs > 0) {
        traversalIntentSegments.push(
          Object.freeze({
            deltaSeconds: segmentDeltaMs / 1_000,
            nowMs: segmentEndedAtMs,
            traversalIntent: currentIntent
          })
        );
      }

      currentIntent = this.#activateTraversalIntentTimelineEntry(
        playerRuntime,
        traversalIntentRuntime,
        currentIntent,
        nextTimelineEntry
      );
      traversalIntentRuntime.currentIntent = currentIntent;
      segmentStartedAtMs = segmentEndedAtMs;
    }

    const remainingDeltaMs = tickEndedAtMs - segmentStartedAtMs;

    if (remainingDeltaMs > 0) {
      traversalIntentSegments.push(
        Object.freeze({
          deltaSeconds: remainingDeltaMs / 1_000,
          nowMs: tickEndedAtMs,
          traversalIntent: currentIntent
        })
      );
    }

    return Object.freeze([
      ...traversalIntentSegments
    ]);
  }

  #syncGroundedBodySupportState(
    playerRuntime: PlayerRuntime,
    groundedBodySnapshot: MetaverseAuthoritativeGroundedBodyRuntime["snapshot"],
    grounded: boolean
  ): MetaverseAuthoritativeGroundedBodyRuntime["snapshot"] {
    playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
      contact: groundedBodySnapshot.contact,
      driveTarget: groundedBodySnapshot.driveTarget,
      grounded,
      interaction: groundedBodySnapshot.interaction,
      jumpBody: groundedBodySnapshot.jumpBody,
      linearVelocity: groundedBodySnapshot.linearVelocity,
      position: groundedBodySnapshot.position,
      yawRadians: groundedBodySnapshot.yawRadians
    });

    return playerRuntime.groundedBodyRuntime.snapshot;
  }
}
