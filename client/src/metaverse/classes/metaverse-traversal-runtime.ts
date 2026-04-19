import {
  MetaverseGroundedBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierPhysicsRuntime
} from "@/physics";
import {
  createMetaverseUnmountedTraversalStateSnapshot,
  metaverseRealtimeWorldCadenceConfig,
  type MetaversePlayerTraversalIntentSnapshot,
  type MetaversePlayerTraversalIntentSnapshotInput,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared";
import { defaultMetaverseLocomotionMode } from "../config/metaverse-locomotion-modes";
import {
  createMetaverseCameraSnapshot
} from "../states/metaverse-flight";
import type { MetaverseFlightInputSnapshot } from "../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../types/metaverse-locomotion-mode";
import type { MountedEnvironmentSnapshot } from "../types/mounted";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot
} from "../types/presentation";
import type { MetaverseRuntimeConfig } from "../types/runtime-config";
import type { MetaverseTelemetrySnapshot } from "../types/telemetry";
import { MetaverseTraversalCharacterPresentationState } from "../traversal/presentation/metaverse-traversal-character-presentation-state";
import {
  freezeVector3,
  wrapRadians
} from "../traversal/policies/surface-locomotion";
import { MetaverseMountedVehicleTraversalState } from "../traversal/mounted/metaverse-mounted-vehicle-traversal-state";
import { MetaverseMountedTraversalTransitionState } from "../traversal/mounted/metaverse-mounted-traversal-transition-state";
import { MetaverseLocalTraversalAuthorityState } from "../traversal/classes/metaverse-local-traversal-authority-state";
import { MetaverseUnmountedTraversalOrchestrationState } from "../traversal/classes/metaverse-unmounted-traversal-orchestration-state";
import { MetaverseUnmountedTraversalMotionState } from "../traversal/classes/metaverse-unmounted-traversal-motion-state";
import { MetaverseTraversalTelemetryState } from "../traversal/classes/metaverse-traversal-telemetry-state";
import {
  type AuthoritativeCorrectionTelemetrySnapshot,
  type LocalAuthorityPoseCorrectionDetailSnapshot,
  type LocalAuthorityPoseCorrectionSnapshot,
  type LocalAuthorityPoseCorrectionReason,
  type LocalTraversalPoseSnapshot
} from "../traversal/reconciliation/local-authority-pose-correction";
import {
  MetaverseLocalAuthorityReconciliationState,
  type AuthoritativeLocalPlayerPoseSnapshot
} from "../traversal/reconciliation/classes/metaverse-local-authority-reconciliation-state";
import { MetaverseUnmountedSurfaceLocomotionState } from "../traversal/surface/metaverse-unmounted-surface-locomotion-state";
import type {
  MetaverseTraversalRuntimeDependencies,
  RoutedDriverVehicleControlIntentSnapshot,
  TraversalMountedVehicleSnapshot,
} from "../traversal/types/traversal";

type LocalSurfaceRoutingTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"];
type LocalJumpGateTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["local"]["jumpDebug"];
type LocalReconciliationCorrectionSource =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"];

const authoritativeTraversalFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

function createIdleGroundedBodyIntentSnapshot() {
  return Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    strafeAxis: 0,
    turnAxis: 0
  });
}

function createVehicleDeltaCarriedPosition(
  currentPosition: PhysicsVector3Snapshot,
  previousVehiclePosition: PhysicsVector3Snapshot,
  nextVehiclePosition: PhysicsVector3Snapshot,
  deltaYawRadians: number
): PhysicsVector3Snapshot {
  const cosYaw = Math.cos(deltaYawRadians);
  const sinYaw = Math.sin(deltaYawRadians);
  const relativeX = currentPosition.x - previousVehiclePosition.x;
  const relativeZ = currentPosition.z - previousVehiclePosition.z;

  return freezeVector3(
    nextVehiclePosition.x + relativeX * cosYaw + relativeZ * sinYaw,
    currentPosition.y + (nextVehiclePosition.y - previousVehiclePosition.y),
    nextVehiclePosition.z - relativeX * sinYaw + relativeZ * cosYaw
  );
}

export class MetaverseTraversalRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #readDynamicEnvironmentCollisionPose:
    MetaverseTraversalRuntimeDependencies["readDynamicEnvironmentCollisionPose"];
  readonly #readMountedEnvironmentAnchorSnapshot: MetaverseTraversalRuntimeDependencies["readMountedEnvironmentAnchorSnapshot"];
  readonly #readMountableEnvironmentConfig: MetaverseTraversalRuntimeDependencies["readMountableEnvironmentConfig"];
  readonly #resolveGroundedTraversalFilterPredicate: MetaverseTraversalRuntimeDependencies["resolveGroundedTraversalFilterPredicate"];
  readonly #setDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["setDynamicEnvironmentPose"];
  readonly #surfaceColliderSnapshots: MetaverseTraversalRuntimeDependencies["surfaceColliderSnapshots"];
  readonly #surfaceLocomotionState: MetaverseUnmountedSurfaceLocomotionState;

  #cameraSnapshot: MetaverseCameraSnapshot;
  readonly #characterPresentationState: MetaverseTraversalCharacterPresentationState;
  readonly #localAuthorityReconciliationState: MetaverseLocalAuthorityReconciliationState;
  readonly #telemetryState: MetaverseTraversalTelemetryState;
  readonly #unmountedTraversalOrchestrationState: MetaverseUnmountedTraversalOrchestrationState;
  readonly #unmountedTraversalMotionState: MetaverseUnmountedTraversalMotionState;
  #locomotionMode: MetaverseLocomotionModeId = defaultMetaverseLocomotionMode;
  #unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly #localTraversalAuthorityState: MetaverseLocalTraversalAuthorityState;
  readonly #mountedTraversalTransitionState: MetaverseMountedTraversalTransitionState;
  readonly #mountedVehicleState: MetaverseMountedVehicleTraversalState;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: MetaverseTraversalRuntimeDependencies
  ) {
    this.#config = config;
    this.#groundedBodyRuntime = dependencies.groundedBodyRuntime;
    this.#physicsRuntime = dependencies.physicsRuntime;
    this.#readDynamicEnvironmentCollisionPose =
      dependencies.readDynamicEnvironmentCollisionPose;
    this.#readMountedEnvironmentAnchorSnapshot =
      dependencies.readMountedEnvironmentAnchorSnapshot;
    this.#readMountableEnvironmentConfig =
      dependencies.readMountableEnvironmentConfig;
    this.#resolveGroundedTraversalFilterPredicate =
      dependencies.resolveGroundedTraversalFilterPredicate;
    this.#setDynamicEnvironmentPose = dependencies.setDynamicEnvironmentPose;
    this.#surfaceColliderSnapshots = dependencies.surfaceColliderSnapshots;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#characterPresentationState =
      new MetaverseTraversalCharacterPresentationState(config);
    this.#mountedVehicleState = new MetaverseMountedVehicleTraversalState(
      config,
      dependencies
    );
    this.#localTraversalAuthorityState =
      new MetaverseLocalTraversalAuthorityState();
    this.#unmountedTraversalState = this.#createInitialUnmountedTraversalState();
    this.#surfaceLocomotionState = new MetaverseUnmountedSurfaceLocomotionState(
      {
        config,
        dependencies,
        groundedBodyRuntime: this.#groundedBodyRuntime,
        physicsRuntime: this.#physicsRuntime,
        readMountedVehicleColliderHandle: () =>
          this.#mountedVehicleState.colliderHandle
      }
    );
    this.#unmountedTraversalMotionState = new MetaverseUnmountedTraversalMotionState({
      characterPresentationState: this.#characterPresentationState,
      config,
      groundedBodyRuntime: this.#groundedBodyRuntime,
      localTraversalAuthorityState: this.#localTraversalAuthorityState,
      readLocomotionMode: () => this.#locomotionMode,
      readMountedOccupancyKeepsFreeRoam: () =>
        this.#mountedOccupancyKeepsFreeRoam(),
      readMountedVehicleActive: () =>
        this.#mountedVehicleState.mountedVehicleSnapshot !== null,
      setLocomotionMode: (locomotionMode) => {
        this.#setLocomotionMode(locomotionMode);
      },
      surfaceLocomotionState: this.#surfaceLocomotionState,
      syncLocalTraversalAuthorityState: (advanceTick) =>
        this.#syncLocalTraversalAuthorityState(advanceTick),
      writeTraversalState: (traversalState) => {
        this.#unmountedTraversalState = traversalState;
      }
    });
    this.#mountedTraversalTransitionState =
      new MetaverseMountedTraversalTransitionState({
        groundedBodyRuntime: this.#groundedBodyRuntime,
        mountedVehicleState: this.#mountedVehicleState,
        readCameraSnapshot: () => this.#cameraSnapshot,
        readLocomotionMode: () => this.#locomotionMode,
        readMountedEnvironmentAnchorSnapshot: (mountedEnvironment) =>
          this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment),
        readTraversalCameraPitchRadians: () =>
          this.#unmountedTraversalMotionState.traversalCameraPitchRadians,
        readUnmountedLookYawRadians: () =>
          this.#unmountedTraversalMotionState.unmountedLookYawRadians,
        resolveGroundedPresentationPosition: () =>
          this.#unmountedTraversalMotionState.resolveGroundedPresentationPosition(),
        resolveSwimPresentationPosition: (swimSnapshot) =>
          this.#unmountedTraversalMotionState.resolveSwimPresentationPosition(
            swimSnapshot
          ),
        setCameraSnapshot: (cameraSnapshot) => {
          this.#cameraSnapshot = cameraSnapshot;
        },
        setLocomotionMode: (locomotionMode) => {
          this.#setLocomotionMode(locomotionMode);
        },
        setTraversalCameraPitchRadians: (pitchRadians) => {
          this.#unmountedTraversalMotionState.setTraversalCameraPitchRadians(
            pitchRadians
          );
        },
        surfaceLocomotionState: this.#surfaceLocomotionState,
        syncCharacterPresentationSnapshot: () =>
          this.#unmountedTraversalOrchestrationState
            .syncCharacterPresentationSnapshot(),
        syncLocalTraversalAuthorityState: (advanceTick) =>
          this.#syncLocalTraversalAuthorityState(advanceTick)
      });
    this.#localAuthorityReconciliationState =
      new MetaverseLocalAuthorityReconciliationState();
    this.#telemetryState = new MetaverseTraversalTelemetryState({
      config,
      groundedBodyRuntime: this.#groundedBodyRuntime,
      localAuthorityReconciliationState: this.#localAuthorityReconciliationState,
      localTraversalAuthorityState: this.#localTraversalAuthorityState,
      readLocomotionMode: () => this.#locomotionMode,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfaceLocomotionState: this.#surfaceLocomotionState
    });
    this.#unmountedTraversalOrchestrationState =
      new MetaverseUnmountedTraversalOrchestrationState({
        characterPresentationState: this.#characterPresentationState,
        config,
        groundedBodyRuntime: this.#groundedBodyRuntime,
        localAuthorityReconciliationState: this.#localAuthorityReconciliationState,
        localTraversalAuthorityState: this.#localTraversalAuthorityState,
        readLocomotionMode: () => this.#locomotionMode,
        readMountedOccupancyPresentationState: () =>
          this.#mountedVehicleState.mountedOccupancyPresentationState,
        readMountedVehicleSnapshot: () =>
          this.#mountedVehicleState.mountedVehicleSnapshot,
        readTraversalState: () => this.#unmountedTraversalState,
        resolveGroundedPresentationPosition: () =>
          this.#unmountedTraversalMotionState.resolveGroundedPresentationPosition(),
        resolveSwimPresentationPosition: () =>
          this.#unmountedTraversalMotionState.resolveSwimPresentationPosition(),
        setLocomotionMode: (locomotionMode) => {
          this.#setLocomotionMode(locomotionMode);
        },
        surfaceLocomotionState: this.#surfaceLocomotionState,
        syncLocalTraversalAuthorityState: (advanceTick) =>
          this.#syncLocalTraversalAuthorityState(advanceTick),
        telemetryState: this.#telemetryState,
        unmountedTraversalMotionState: this.#unmountedTraversalMotionState,
        writeLocomotionModeRaw: (locomotionMode) => {
          this.#locomotionMode = locomotionMode;
        },
        writeTraversalState: (traversalState) => {
          this.#unmountedTraversalState = traversalState;
        }
      });
  }

  get cameraSnapshot(): MetaverseCameraSnapshot {
    return this.#cameraSnapshot;
  }

  get characterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#unmountedTraversalOrchestrationState.characterPresentationSnapshot;
  }

  get locomotionMode(): MetaverseLocomotionModeId {
    return this.#locomotionMode;
  }

  get mountedEnvironmentSnapshot(): MountedEnvironmentSnapshot | null {
    return this.#mountedVehicleState.mountedEnvironmentSnapshot;
  }

  get routedDriverVehicleControlIntentSnapshot():
    | RoutedDriverVehicleControlIntentSnapshot
    | null {
    return this.#mountedVehicleState.routedDriverVehicleControlIntentSnapshot;
  }

  get localReconciliationCorrectionCount(): number {
    return this.#telemetryState.localReconciliationCorrectionCount;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#telemetryState.localAuthorityPoseCorrectionCount;
  }

  get lastLocalAuthorityPoseCorrectionReason(): LocalAuthorityPoseCorrectionReason {
    return this.#telemetryState.lastLocalAuthorityPoseCorrectionReason;
  }

  get lastLocalAuthorityPoseCorrectionDetail(): LocalAuthorityPoseCorrectionDetailSnapshot {
    return this.#telemetryState.lastLocalAuthorityPoseCorrectionDetail;
  }

  get lastLocalAuthorityPoseCorrectionSnapshot(): LocalAuthorityPoseCorrectionSnapshot {
    return this.#telemetryState.lastLocalAuthorityPoseCorrectionSnapshot;
  }

  get mountedVehicleAuthorityCorrectionCount(): number {
    return this.#telemetryState.mountedVehicleAuthorityCorrectionCount;
  }

  get lastLocalReconciliationCorrectionSource(): LocalReconciliationCorrectionSource {
    return this.#telemetryState.lastLocalReconciliationCorrectionSource;
  }

  get localTraversalPoseSnapshot(): LocalTraversalPoseSnapshot | null {
    return this.#unmountedTraversalOrchestrationState.localTraversalPoseSnapshot;
  }

  get localTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#unmountedTraversalOrchestrationState
      .localTraversalAuthoritySnapshot;
  }

  get surfaceRoutingLocalTelemetrySnapshot(): LocalSurfaceRoutingTelemetrySnapshot {
    return this.#telemetryState.surfaceRoutingLocalTelemetrySnapshot;
  }

  get localGroundedJumpGateTelemetrySnapshot(): LocalJumpGateTelemetrySnapshot {
    return this.#telemetryState.localGroundedJumpGateTelemetrySnapshot;
  }

  get authoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
    return this.#telemetryState.authoritativeCorrectionTelemetrySnapshot;
  }

  #syncLocalTraversalAuthorityState(advanceTick: boolean): void {
    this.#localTraversalAuthorityState.sync({
      advanceTick,
      localActiveTraversalAction:
        this.#unmountedTraversalMotionState.resolveLocalPredictedTraversalAction(),
      locomotionMode: this.#locomotionMode,
      traversalState: this.#unmountedTraversalState
    });
  }

  reset(): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#locomotionMode = defaultMetaverseLocomotionMode;
    this.#mountedVehicleState.clear();
    this.#unmountedTraversalOrchestrationState.reset();
  }

  syncIssuedTraversalIntentSnapshot(
    traversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null
  ): void {
    this.#unmountedTraversalOrchestrationState
      .syncIssuedTraversalIntentSnapshot(traversalIntentSnapshot);
  }

  resolveLocalTraversalIntentInput(
    movementInput: Pick<
      MetaverseFlightInputSnapshot,
      "boost" | "jump" | "moveAxis" | "pitchAxis" | "strafeAxis" | "yawAxis"
    >,
    deltaSeconds: number
  ): MetaversePlayerTraversalIntentSnapshotInput | null {
    return this.#unmountedTraversalMotionState.resolvePredictedTraversalIntentInput(
      movementInput,
      deltaSeconds
    );
  }

  boot(): void {
    this.#cameraSnapshot = this.#unmountedTraversalOrchestrationState.boot(
      this.#cameraSnapshot
    );
  }

  syncMountedEnvironment(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    this.#mountedTraversalTransitionState.syncMountedEnvironment(
      mountedEnvironment
    );
  }

  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    return this.#mountedTraversalTransitionState.boardEnvironment(
      environmentAssetId,
      requestedEntryId
    );
  }

  occupySeat(
    environmentAssetId: string,
    seatId: string
  ): MountedEnvironmentSnapshot | null {
    return this.#mountedTraversalTransitionState.occupySeat(
      environmentAssetId,
      seatId
    );
  }

  leaveMountedEnvironment(): void {
    this.#mountedTraversalTransitionState.leaveMountedEnvironment();
  }

  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    traversalIntentInput: MetaversePlayerTraversalIntentSnapshotInput | null =
      null
  ): MetaverseCameraSnapshot {
    const jumpPressedThisFrame =
      this.#unmountedTraversalOrchestrationState.captureJumpPressedThisFrame(
        movementInput,
        traversalIntentInput
      );
    const constrainedMountedOccupancy =
      this.#mountedVehicleState.mountedVehicleSnapshot !== null &&
      this.#mountedVehicleState.mountedOccupancyPresentationState
        ?.constrainToAnchor === true;

    if (constrainedMountedOccupancy) {
      this.#unmountedTraversalOrchestrationState.clearGroundedPredictionAccumulator();
      this.#cameraSnapshot = this.#advanceMountedVehicleLocomotion(
        movementInput,
        deltaSeconds
      );
    } else {
      this.#cameraSnapshot = this.#unmountedTraversalOrchestrationState.advance(
        this.#cameraSnapshot,
        movementInput,
        deltaSeconds,
        jumpPressedThisFrame,
        traversalIntentInput
      );
    }
    this.#unmountedTraversalOrchestrationState.syncCharacterPresentationSnapshot(
      deltaSeconds
    );

    return this.#cameraSnapshot;
  }

  syncAuthoritativeVehiclePose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly linearVelocity?: PhysicsVector3Snapshot | null;
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }
  ): void {
    const authoritativeSyncResult =
        this.#mountedVehicleState.syncAuthoritativeVehiclePose(
        environmentAssetId,
        poseSnapshot,
        this.#unmountedTraversalMotionState.traversalCameraPitchRadians
      );

    if (authoritativeSyncResult.applied) {
      if (authoritativeSyncResult.poseChanged) {
        this.#telemetryState.recordMountedVehicleAuthorityCorrection();
      }

      if (authoritativeSyncResult.keepsFreeRoam) {
        if (
          authoritativeSyncResult.previousMountedVehicleSnapshot !== null &&
          authoritativeSyncResult.nextMountedVehicleSnapshot !== null
        ) {
          this.#carryFreeRoamMountedOccupancyWithVehicle(
            authoritativeSyncResult.previousMountedVehicleSnapshot,
            authoritativeSyncResult.nextMountedVehicleSnapshot
          );
        }
      } else if (authoritativeSyncResult.presentationCameraSnapshot !== null) {
        this.#cameraSnapshot =
          authoritativeSyncResult.presentationCameraSnapshot;
      }
      this.#unmountedTraversalOrchestrationState
        .syncCharacterPresentationSnapshot();
      return;
    }
  }

  syncAuthoritativeLocalPlayerPose(
    authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot
  ): void {
    this.#cameraSnapshot =
      this.#unmountedTraversalOrchestrationState
        .syncAuthoritativeLocalPlayerPose(
          this.#cameraSnapshot,
          authoritativePlayerSnapshot
        );
  }

  #setLocomotionMode(locomotionMode: MetaverseLocomotionModeId): void {
    if (this.#locomotionMode !== locomotionMode) {
      this.#unmountedTraversalState =
        this.#unmountedTraversalMotionState.clearGroundedPredictionAccumulator(
          this.#unmountedTraversalState
        );
      this.#unmountedTraversalMotionState.clearSwimPredictionAccumulator();
    }

    this.#locomotionMode = locomotionMode;

    if (locomotionMode === "grounded" || locomotionMode === "swim") {
      this.#unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot({
        actionState: this.#unmountedTraversalState.actionState,
        locomotionMode
      });
    }

    if (locomotionMode === "mounted") {
      this.#characterPresentationState.resetAnimation("idle");
    }
  }

  #mountedOccupancyKeepsFreeRoam(): boolean {
    return this.#mountedVehicleState.keepsFreeRoam;
  }

  #carryFreeRoamMountedOccupancyWithVehicle(
    previousMountedVehicleState: TraversalMountedVehicleSnapshot,
    nextMountedVehicleState: TraversalMountedVehicleSnapshot
  ): void {
    if (
      !this.#mountedOccupancyKeepsFreeRoam() ||
      !this.#groundedBodyRuntime.isInitialized ||
      this.#locomotionMode !== "grounded"
    ) {
      return;
    }

    const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const deltaYawRadians = wrapRadians(
      nextMountedVehicleState.yawRadians - previousMountedVehicleState.yawRadians
    );
    const carriedPosition = createVehicleDeltaCarriedPosition(
      groundedBodySnapshot.position,
      previousMountedVehicleState.position,
      nextMountedVehicleState.position,
      deltaYawRadians
    );

    this.#groundedBodyRuntime.teleport(
      freezeVector3(
        carriedPosition.x,
        this.#surfaceLocomotionState.resolveGroundedSupportHeightMeters(
          carriedPosition,
          carriedPosition.y
        ),
        carriedPosition.z
      ),
      wrapRadians(groundedBodySnapshot.yawRadians + deltaYawRadians)
    );
    this.#physicsRuntime.stepSimulation(authoritativeTraversalFixedStepSeconds);
    this.#groundedBodyRuntime.advance(
      createIdleGroundedBodyIntentSnapshot(),
      authoritativeTraversalFixedStepSeconds,
      this.#resolveGroundedTraversalFilterPredicate(
        this.#surfaceLocomotionState.readGroundedTraversalExcludedColliders()
      ),
      this.#unmountedTraversalMotionState.unmountedLookYawRadians
    );
    this.#syncLocalTraversalAuthorityState(false);
    const groundedCameraSnapshot =
      this.#surfaceLocomotionState.syncGroundedCameraPresentation({
        locomotionMode: this.#locomotionMode,
        lookYawRadians: this.#unmountedTraversalMotionState.unmountedLookYawRadians,
        resolveGroundedPresentationPosition: () =>
          this.#unmountedTraversalMotionState.resolveGroundedPresentationPosition(),
        traversalCameraPitchRadians:
          this.#unmountedTraversalMotionState.traversalCameraPitchRadians
      });

    if (groundedCameraSnapshot !== null) {
      this.#cameraSnapshot = groundedCameraSnapshot;
    }
  }

  #advanceMountedVehicleLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const mountedVehicleAdvanceResult = this.#mountedVehicleState.advance(
      movementInput,
      deltaSeconds,
      this.#unmountedTraversalMotionState.traversalCameraPitchRadians
    );

    if (mountedVehicleAdvanceResult.cameraSnapshot === null) {
      return this.#cameraSnapshot;
    }

    this.#unmountedTraversalMotionState.setTraversalCameraPitchRadians(
      mountedVehicleAdvanceResult.traversalCameraPitchRadians
    );

    return mountedVehicleAdvanceResult.cameraSnapshot;
  }

  #createInitialUnmountedTraversalState():
    MetaverseUnmountedTraversalStateSnapshot {
    return createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode:
        defaultMetaverseLocomotionMode === "swim" ? "swim" : "grounded"
    });
  }
}
