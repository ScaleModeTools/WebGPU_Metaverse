import {
  MetaverseGroundedBodyRuntime,
  MetaverseSurfaceDriveBodyRuntime,
  type PhysicsVector3Snapshot,
  type RapierColliderHandle,
  type RapierPhysicsRuntime
} from "@/physics";
import {
  clearMetaverseUnmountedTraversalPendingActions,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  hasMetaverseTraversalAuthorityConsumedJump,
  hasMetaverseTraversalAuthorityRejectedJump,
  isMetaverseTraversalAuthorityJumpAirborne,
  isMetaverseTraversalAuthorityJumpPendingOrActive,
  metaverseWorldPlacedWaterRegions,
  queueMetaverseUnmountedTraversalAction,
  prepareMetaverseUnmountedTraversalStep,
  resolveMetaverseUnmountedGroundedJumpSupport,
  resolveMetaverseUnmountedTraversalStep,
  metaverseRealtimeWorldCadenceConfig,
  resolveMetaverseTraversalAuthorityIssuedJumpResolution,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  type MetaversePlayerTraversalIntentSnapshot,
  type MetaverseRealtimePlayerSnapshot,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared";
import { defaultMetaverseLocomotionMode } from "../config/metaverse-locomotion-modes";
import {
  advanceMetaverseCameraSnapshot,
  createMetaverseCameraSnapshot
} from "../states/metaverse-flight";
import type { MetaverseFlightInputSnapshot } from "../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../types/metaverse-locomotion-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseRuntimeConfig,
  MetaverseTelemetrySnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import {
  advanceTraversalCameraPresentationPitchRadians,
  advanceTraversalMountedOccupancyLookYawRadians,
  clampTraversalMountedOccupancyPitchRadians,
  createTraversalGroundedCameraPresentationSnapshot,
  createTraversalMountedVehicleCameraPresentationSnapshot,
  createTraversalSwimCameraPresentationSnapshot
} from "../traversal/presentation/camera-presentation";
import {
  projectGroundedTraversalPresentationPosition,
  projectTraversalPresentationPosition
} from "../traversal/presentation/presentation-projection";
import { MetaverseMovementAnimationPolicyRuntime } from "../traversal/presentation/metaverse-movement-animation-policy";
import {
  shouldConstrainMountedOccupancyToAnchor,
  shouldKeepMountedOccupancyFreeRoam
} from "../states/mounted-occupancy";
import { createTraversalCharacterPresentationSnapshot } from "../traversal/presentation/character-presentation";
import {
  clamp,
  createSurfaceLocomotionSnapshot,
  freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "../traversal/policies/surface-locomotion";
import {
  resolveAutomaticSurfaceLocomotionSnapshot,
  readMetaverseSurfacePolicyConfig,
  resolveSurfaceHeightMeters,
  resolveWaterSurfaceHeightMeters
} from "../traversal/policies/surface-routing";
import type {
  MetaverseTraversalRuntimeDependencies,
  RoutedDriverVehicleControlIntentSnapshot,
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../traversal/types/traversal";
import {
  MetaverseVehicleRuntime,
  type MountedVehicleControlIntent
} from "../vehicles";

const metaverseWaterRegionSnapshots = metaverseWorldPlacedWaterRegions;

function createIdleGroundedBodyIntentSnapshot() {
  return Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    strafeAxis: 0,
    turnAxis: 0
  });
}

function createDefaultTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
  return createMetaverseTraversalAuthoritySnapshot();
}

type LocalShorelineTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["shoreline"]["local"];
type LocalJumpGateTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["shoreline"]["local"]["jumpDebug"];
type AuthoritativeCorrectionTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["shoreline"]["authoritativeCorrection"];
type LocalAuthorityPoseCorrectionReason =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionReason"];
type LocalAuthorityPoseCorrectionDetailSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"];
type LocalReconciliationCorrectionSource =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"];

interface LocalTraversalPoseSnapshot {
  readonly locomotionMode: "grounded" | "swim";
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

interface CorrectionTargetPoseSnapshot {
  readonly locomotionMode: MetaverseRealtimePlayerSnapshot["locomotionMode"];
  readonly position: PhysicsVector3Snapshot;
}

interface AuthoritativeLocalPlayerPoseSnapshot
  extends Pick<
    MetaverseRealtimePlayerSnapshot,
    | "jumpAuthorityState"
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "position"
    | "traversalAuthority"
    | "yawRadians"
  > {}

interface LocalAuthorityPoseCorrectionReasonFlags {
  readonly authoritativeGroundStateMismatchShouldSnap: boolean;
  readonly authoritativeJumpRejected: boolean;
  readonly grossPositionDivergence: boolean;
}

function createDefaultAuthoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
  return Object.freeze({
    applied: false,
    locomotionMismatch: false,
    planarMagnitudeMeters: 0,
    verticalMagnitudeMeters: 0
  });
}

function createDefaultLocalAuthorityPoseCorrectionDetailSnapshot(): LocalAuthorityPoseCorrectionDetailSnapshot {
  return Object.freeze({
    authoritativeGrounded: null,
    localGrounded: null,
    planarMagnitudeMeters: null,
    verticalMagnitudeMeters: null
  });
}

function resolveLocalAuthorityPoseCorrectionReason({
  authoritativeGroundStateMismatchShouldSnap,
  authoritativeJumpRejected,
  grossPositionDivergence
}: LocalAuthorityPoseCorrectionReasonFlags): LocalAuthorityPoseCorrectionReason {
  if (authoritativeJumpRejected) {
    return "jump-rejected";
  }

  if (authoritativeGroundStateMismatchShouldSnap) {
    return "ground-state-mismatch";
  }

  if (grossPositionDivergence) {
    return "gross-position-divergence";
  }

  return "none";
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function resolveMovementInputMagnitude(
  movementInput: Pick<MetaverseFlightInputSnapshot, "moveAxis" | "strafeAxis">
): number {
  return Math.hypot(
    clamp(toFiniteNumber(movementInput.moveAxis, 0), -1, 1),
    clamp(toFiniteNumber(movementInput.strafeAxis, 0), -1, 1)
  );
}

const localPlayerAuthoritativeHardSnapDistanceMeters = 2.5;
const localPlayerAuthoritativeNoopCorrectionDistanceMeters = 0.001;
const localPlayerAuthoritativeNoopVerticalSpeedUnitsPerSecond = 0.05;
const localGroundedJumpSupportVerticalSpeedTolerance = 0.5;
const groundedJumpIntentBufferSeconds = 0.2;
const authoritativeTraversalFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;
const authoritativeTraversalFixedStepEpsilon = 0.000001;

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

function didMountedVehiclePoseChange(
  previousMountedVehicleState: TraversalMountedVehicleSnapshot,
  nextMountedVehicleState: TraversalMountedVehicleSnapshot
): boolean {
  return (
    Math.abs(
      previousMountedVehicleState.position.x - nextMountedVehicleState.position.x
    ) > 0.000001 ||
    Math.abs(
      previousMountedVehicleState.position.y - nextMountedVehicleState.position.y
    ) > 0.000001 ||
    Math.abs(
      previousMountedVehicleState.position.z - nextMountedVehicleState.position.z
    ) > 0.000001 ||
    Math.abs(
      wrapRadians(
        previousMountedVehicleState.yawRadians - nextMountedVehicleState.yawRadians
      )
    ) > 0.000001
  );
}

function resolveMountedEnvironmentDirectSeatTargets(
  mountableEnvironmentConfig: Pick<MetaverseEnvironmentAssetProofConfig, "seats">
): MountedEnvironmentSnapshot["directSeatTargets"] {
  return Object.freeze(
    (mountableEnvironmentConfig.seats ?? [])
      .filter((seat) => seat.directEntryEnabled)
      .map((seat) =>
        Object.freeze({
          label: seat.label,
          seatId: seat.seatId,
          seatRole: seat.seatRole
        })
      )
  );
}

function resolveMountedEnvironmentSeatTargets(
  mountableEnvironmentConfig: Pick<MetaverseEnvironmentAssetProofConfig, "seats">
): MountedEnvironmentSnapshot["seatTargets"] {
  return Object.freeze(
    (mountableEnvironmentConfig.seats ?? []).map((seat) =>
      Object.freeze({
        label: seat.label,
        seatId: seat.seatId,
        seatRole: seat.seatRole
      })
    )
  );
}

export class MetaverseTraversalRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #physicsRuntime: RapierPhysicsRuntime;
  readonly #readDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["readDynamicEnvironmentPose"];
  readonly #readMountedEnvironmentAnchorSnapshot: MetaverseTraversalRuntimeDependencies["readMountedEnvironmentAnchorSnapshot"];
  readonly #readMountableEnvironmentConfig: MetaverseTraversalRuntimeDependencies["readMountableEnvironmentConfig"];
  readonly #resolveGroundedTraversalFilterPredicate: MetaverseTraversalRuntimeDependencies["resolveGroundedTraversalFilterPredicate"];
  readonly #resolveWaterborneTraversalFilterPredicate: MetaverseTraversalRuntimeDependencies["resolveWaterborneTraversalFilterPredicate"];
  readonly #setDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["setDynamicEnvironmentPose"];
  readonly #surfaceColliderSnapshots: MetaverseTraversalRuntimeDependencies["surfaceColliderSnapshots"];

  #cameraSnapshot: MetaverseCameraSnapshot;
  #characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null =
    null;
  readonly #movementAnimationRuntime = new MetaverseMovementAnimationPolicyRuntime();
  #latestAuthoritativeCorrectionTelemetrySnapshot =
    createDefaultAuthoritativeCorrectionTelemetrySnapshot();
  #latestAutomaticSurfaceDecisionReason: LocalShorelineTelemetrySnapshot["decisionReason"] =
    "grounded-hold";
  #latestBlockerOverlap = false;
  #latestResolvedSupportHeightMeters = 0;
  #latestStepSupportedProbeCount = 0;
  #latestAutostepHeightMeters: number | null = null;
  #latestMovementInputMagnitude = 0;
  #localAuthorityPoseCorrectionCount = 0;
  #lastLocalAuthorityPoseCorrectionDetail =
    createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
  #lastLocalAuthorityPoseCorrectionReason: LocalAuthorityPoseCorrectionReason = "none";
  #lastResolvedJumpActionSequence = 0;
  #locomotionMode = defaultMetaverseLocomotionMode;
  #groundedLocomotionAccumulatorSeconds = 0;
  #swimLocomotionAccumulatorSeconds = 0;
  #lastLocalReconciliationCorrectionSource: LocalReconciliationCorrectionSource =
    "none";
  #lastJumpInputPressed = false;
  #unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot({
    locomotionMode:
      defaultMetaverseLocomotionMode === "swim" ? "swim" : "grounded"
  });
  #mountedVehicleAuthorityCorrectionCount = 0;
  #localTraversalAuthorityState = createDefaultTraversalAuthoritySnapshot();
  #localTraversalAuthorityTick = 0;
  #latestIssuedTraversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null =
    null;
  #mountedEnvironmentConfig: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "collider" | "entries" | "environmentAssetId" | "label" | "seats"
  > | null = null;
  #mountedOccupancyLookYawRadians = 0;
  #localReconciliationCorrectionCount = 0;
  #routedDriverVehicleControlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null =
    null;
  #mountedVehicleRuntime: MetaverseVehicleRuntime | null = null;
  #swimBodyRuntime: MetaverseSurfaceDriveBodyRuntime | null = null;
  #traversalCameraPitchRadians: number;
  #unmountedLookYawRadians: number;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: MetaverseTraversalRuntimeDependencies
  ) {
    this.#config = config;
    this.#groundedBodyRuntime = dependencies.groundedBodyRuntime;
    this.#physicsRuntime = dependencies.physicsRuntime;
    this.#readDynamicEnvironmentPose = dependencies.readDynamicEnvironmentPose;
    this.#readMountedEnvironmentAnchorSnapshot =
      dependencies.readMountedEnvironmentAnchorSnapshot;
    this.#readMountableEnvironmentConfig =
      dependencies.readMountableEnvironmentConfig;
    this.#resolveGroundedTraversalFilterPredicate =
      dependencies.resolveGroundedTraversalFilterPredicate;
    this.#resolveWaterborneTraversalFilterPredicate =
      dependencies.resolveWaterborneTraversalFilterPredicate;
    this.#setDynamicEnvironmentPose = dependencies.setDynamicEnvironmentPose;
    this.#surfaceColliderSnapshots = dependencies.surfaceColliderSnapshots;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#traversalCameraPitchRadians = config.camera.initialPitchRadians;
    const groundedSpawnPosition = this.#readCanonicalGroundedSpawnPosition();

    this.#latestResolvedSupportHeightMeters =
      resolveSurfaceHeightMeters(
        this.#config,
        this.#surfaceColliderSnapshots,
        groundedSpawnPosition.x,
        groundedSpawnPosition.z
      ) ?? groundedSpawnPosition.y;
    this.#unmountedLookYawRadians = config.camera.initialYawRadians;
  }

  get cameraSnapshot(): MetaverseCameraSnapshot {
    return this.#cameraSnapshot;
  }

  get characterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#characterPresentationSnapshot;
  }

  get locomotionMode(): MetaverseLocomotionModeId {
    return this.#locomotionMode;
  }

  get latestPredictedJumpActionSequence(): number {
    if (this.#locomotionMode !== "grounded") {
      return 0;
    }

    const latestIssuedJumpActionSequence =
      this.#latestIssuedTraversalIntentSnapshot?.actionIntent?.kind === "jump"
        ? this.#latestIssuedTraversalIntentSnapshot.actionIntent.sequence
        : 0;

    if (latestIssuedJumpActionSequence > 0) {
      return latestIssuedJumpActionSequence;
    }

    const groundedTraversalActionState = this.#unmountedTraversalState.actionState;
    const pendingJumpActionSequence =
      groundedTraversalActionState.pendingActionKind === "jump"
        ? groundedTraversalActionState.pendingActionSequence
        : 0;
    const localJumpAuthorityState = this.#resolveLocalPredictedJumpAuthorityState();
    const resolvedAirborneJumpActionSequence =
      groundedTraversalActionState.resolvedActionKind === "jump" &&
      localJumpAuthorityState !== "grounded"
        ? groundedTraversalActionState.resolvedActionSequence
        : 0;

    return Math.max(
      pendingJumpActionSequence,
      resolvedAirborneJumpActionSequence
    );
  }

  get mountedEnvironmentSnapshot(): MountedEnvironmentSnapshot | null {
    if (
      this.#mountedVehicleRuntime === null ||
      this.#mountedEnvironmentConfig === null
    ) {
      return null;
    }

    const mountedVehicleSnapshot = this.#mountedVehicleRuntime.snapshot;
    const occupancy = mountedVehicleSnapshot.occupancy;

    if (occupancy === null) {
      return null;
    }

    return Object.freeze({
      cameraPolicyId: occupancy.cameraPolicyId,
      controlRoutingPolicyId: occupancy.controlRoutingPolicyId,
      directSeatTargets: resolveMountedEnvironmentDirectSeatTargets(
        this.#mountedEnvironmentConfig
      ),
      entryId: occupancy.entryId,
      environmentAssetId: mountedVehicleSnapshot.environmentAssetId,
      label: mountedVehicleSnapshot.label,
      lookLimitPolicyId: occupancy.lookLimitPolicyId,
      occupancyAnimationId: occupancy.occupancyAnimationId,
      occupancyKind: occupancy.occupancyKind,
      occupantLabel: occupancy.occupantLabel,
      occupantRole: occupancy.occupantRole,
      seatTargets: resolveMountedEnvironmentSeatTargets(
        this.#mountedEnvironmentConfig
      ),
      seatId: occupancy.seatId
    });
  }

  get routedDriverVehicleControlIntentSnapshot():
    | RoutedDriverVehicleControlIntentSnapshot
    | null {
    return this.#routedDriverVehicleControlIntentSnapshot;
  }

  get localReconciliationCorrectionCount(): number {
    return this.#localReconciliationCorrectionCount;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#localAuthorityPoseCorrectionCount;
  }

  get lastLocalAuthorityPoseCorrectionReason(): LocalAuthorityPoseCorrectionReason {
    return this.#lastLocalAuthorityPoseCorrectionReason;
  }

  get lastLocalAuthorityPoseCorrectionDetail(): LocalAuthorityPoseCorrectionDetailSnapshot {
    return this.#lastLocalAuthorityPoseCorrectionDetail;
  }

  get mountedVehicleAuthorityCorrectionCount(): number {
    return this.#mountedVehicleAuthorityCorrectionCount;
  }

  get lastLocalReconciliationCorrectionSource(): LocalReconciliationCorrectionSource {
    return this.#lastLocalReconciliationCorrectionSource;
  }

  get localTraversalPoseSnapshot(): LocalTraversalPoseSnapshot | null {
    return this.#readLocalTraversalPoseForReconciliation();
  }

  get localTraversalAuthoritySnapshot(): MetaverseTraversalAuthoritySnapshot {
    return this.#localTraversalAuthorityState;
  }

  get shorelineLocalTelemetrySnapshot(): LocalShorelineTelemetrySnapshot {
    return Object.freeze({
      autostepHeightMeters: this.#latestAutostepHeightMeters,
      blockerOverlap: this.#latestBlockerOverlap,
      decisionReason: this.#latestAutomaticSurfaceDecisionReason,
      jumpDebug: this.localGroundedJumpGateTelemetrySnapshot,
      locomotionMode: this.#locomotionMode,
      resolvedSupportHeightMeters: this.#latestResolvedSupportHeightMeters,
      stepSupportedProbeCount: this.#latestStepSupportedProbeCount,
      traversalAuthority: this.#localTraversalAuthorityState
    });
  }

  get localGroundedJumpGateTelemetrySnapshot(): LocalJumpGateTelemetrySnapshot {
    if (!this.#groundedBodyRuntime.isInitialized || this.#locomotionMode !== "grounded") {
      return Object.freeze({
        groundedBodyGrounded: null,
        groundedBodyJumpReady: null,
        surfaceJumpSupported: null,
        supported: null,
        verticalSpeedUnitsPerSecond: null
      });
    }

    const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const groundedJumpSupport = resolveMetaverseUnmountedGroundedJumpSupport({
      controllerOffsetMeters: this.#config.groundedBody.controllerOffsetMeters,
      groundedBodySnapshot,
      jumpSupportVerticalSpeedTolerance:
        localGroundedJumpSupportVerticalSpeedTolerance,
      snapToGroundDistanceMeters:
        this.#config.groundedBody.snapToGroundDistanceMeters,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(this.#config),
      waterRegionSnapshots: metaverseWaterRegionSnapshots
    });

    return Object.freeze({
      groundedBodyGrounded: groundedBodySnapshot.grounded,
      groundedBodyJumpReady: groundedBodySnapshot.jumpReady,
      surfaceJumpSupported: groundedJumpSupport.surfaceJumpSupported,
      supported: groundedJumpSupport.groundedJumpSupported,
      verticalSpeedUnitsPerSecond:
        groundedBodySnapshot.verticalSpeedUnitsPerSecond
    });
  }

  get authoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
    return this.#latestAuthoritativeCorrectionTelemetrySnapshot;
  }

  #resolveLocalPredictedJumpAuthorityState():
    | MetaverseRealtimePlayerSnapshot["jumpAuthorityState"] {
    if (this.#locomotionMode !== "grounded" || !this.#groundedBodyRuntime.isInitialized) {
      return "none";
    }

    const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;

    if (groundedBodySnapshot.grounded) {
      return "grounded";
    }

    return groundedBodySnapshot.verticalSpeedUnitsPerSecond > 0.05
      ? "rising"
      : "falling";
  }

  #resolveLatestPredictedJumpActionSequence(
    jumpPressedThisFrame: boolean
  ): number {
    const latestIssuedJumpActionSequence = this.latestPredictedJumpActionSequence;

    if (latestIssuedJumpActionSequence > 0) {
      return latestIssuedJumpActionSequence;
    }

    if (!jumpPressedThisFrame) {
      return 0;
    }

    const groundedTraversalActionState = this.#unmountedTraversalState.actionState;

    return Math.max(
      groundedTraversalActionState.pendingActionKind === "jump"
        ? groundedTraversalActionState.pendingActionSequence
        : 0,
      groundedTraversalActionState.resolvedActionKind === "jump"
        ? groundedTraversalActionState.resolvedActionSequence
        : 0
    ) + 1;
  }

  #syncPredictedGroundedTraversalActionStateFromAuthoritativeTraversal(
    authoritativeTraversalAuthority: MetaverseTraversalAuthoritySnapshot,
    latestIssuedJumpActionSequence: number
  ): void {
    if (this.#locomotionMode !== "grounded") {
      return;
    }

    const normalizedJumpActionSequence =
      Number.isFinite(latestIssuedJumpActionSequence) &&
      latestIssuedJumpActionSequence > 0
        ? Math.floor(latestIssuedJumpActionSequence)
        : 0;

    if (normalizedJumpActionSequence <= 0) {
      return;
    }

    const authoritativeJumpAcceptedOrActive =
      isMetaverseTraversalAuthorityJumpPendingOrActive(
        authoritativeTraversalAuthority,
        normalizedJumpActionSequence
      ) ||
      hasMetaverseTraversalAuthorityConsumedJump(
        authoritativeTraversalAuthority,
        normalizedJumpActionSequence
      );
    const authoritativeJumpRejected = hasMetaverseTraversalAuthorityRejectedJump(
      authoritativeTraversalAuthority,
      normalizedJumpActionSequence
    );

    if (!authoritativeJumpAcceptedOrActive && !authoritativeJumpRejected) {
      return;
    }

    const groundedTraversalActionState = this.#unmountedTraversalState.actionState;
    const nextPendingActionSequence =
      groundedTraversalActionState.pendingActionKind === "jump" &&
      groundedTraversalActionState.pendingActionSequence >
        normalizedJumpActionSequence
        ? groundedTraversalActionState.pendingActionSequence
        : 0;
    const nextPendingActionBufferSecondsRemaining =
      nextPendingActionSequence > 0
        ? groundedTraversalActionState.pendingActionBufferSecondsRemaining
        : 0;
    const nextResolvedActionSequence = Math.max(
      groundedTraversalActionState.resolvedActionKind === "jump"
        ? groundedTraversalActionState.resolvedActionSequence
        : 0,
      normalizedJumpActionSequence
    );
    const nextResolvedActionState = authoritativeJumpRejected
      ? "rejected-buffer-expired"
      : "accepted";

    if (
      nextPendingActionSequence ===
        (groundedTraversalActionState.pendingActionKind === "jump"
          ? groundedTraversalActionState.pendingActionSequence
          : 0) &&
      nextPendingActionBufferSecondsRemaining ===
        (groundedTraversalActionState.pendingActionKind === "jump"
          ? groundedTraversalActionState.pendingActionBufferSecondsRemaining
          : 0) &&
      nextResolvedActionSequence ===
        (groundedTraversalActionState.resolvedActionKind === "jump"
          ? groundedTraversalActionState.resolvedActionSequence
          : 0) &&
      nextResolvedActionState ===
        (groundedTraversalActionState.resolvedActionKind === "jump"
          ? groundedTraversalActionState.resolvedActionState
          : "none")
    ) {
      return;
    }

    this.#unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot({
      actionState: {
        pendingActionBufferSecondsRemaining:
          nextPendingActionBufferSecondsRemaining,
        pendingActionKind: nextPendingActionSequence > 0 ? "jump" : "none",
        pendingActionSequence: nextPendingActionSequence,
        resolvedActionKind: nextResolvedActionSequence > 0 ? "jump" : "none",
        resolvedActionSequence: nextResolvedActionSequence,
        resolvedActionState: nextResolvedActionState
      },
      locomotionMode: this.#unmountedTraversalState.locomotionMode
    });
    this.#syncLocalTraversalAuthorityState(false);
  }

  #syncLocalTraversalAuthorityState(advanceTick: boolean): void {
    if (advanceTick) {
      this.#localTraversalAuthorityTick += 1;
    }

    const previousTraversalAuthority = this.#localTraversalAuthorityState;
    const localJumpAuthorityState = this.#resolveLocalPredictedJumpAuthorityState();
    this.#localTraversalAuthorityState =
      resolveMetaverseTraversalAuthoritySnapshotInput({
        currentTick: this.#localTraversalAuthorityTick,
        jumpAuthorityState: localJumpAuthorityState,
        locomotionMode: this.#locomotionMode === "swim" ? "swim" : "grounded",
        mounted: this.#locomotionMode === "mounted",
        pendingActionKind: this.#unmountedTraversalState.actionState.pendingActionKind,
        pendingActionSequence:
          this.#unmountedTraversalState.actionState.pendingActionSequence,
        previousTraversalAuthority,
        resolvedActionKind:
          this.#unmountedTraversalState.actionState.resolvedActionKind,
        resolvedActionSequence:
          this.#unmountedTraversalState.actionState.resolvedActionSequence,
        resolvedActionState:
          this.#unmountedTraversalState.actionState.resolvedActionState
      });
  }

  reset(): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#characterPresentationSnapshot = null;
    this.#locomotionMode = defaultMetaverseLocomotionMode;
    this.#swimBodyRuntime?.dispose();
    this.#swimBodyRuntime = null;
    this.#clearMountedVehicleState();
    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createDefaultAuthoritativeCorrectionTelemetrySnapshot();
    this.#latestAutomaticSurfaceDecisionReason = "grounded-hold";
    this.#latestAutostepHeightMeters = null;
    this.#latestBlockerOverlap = false;
    const groundedSpawnPosition = this.#readCanonicalGroundedSpawnPosition();

    this.#latestResolvedSupportHeightMeters =
      resolveSurfaceHeightMeters(
        this.#config,
        this.#surfaceColliderSnapshots,
        groundedSpawnPosition.x,
        groundedSpawnPosition.z
      ) ?? groundedSpawnPosition.y;
    this.#latestStepSupportedProbeCount = 0;
    this.#latestMovementInputMagnitude = 0;
    this.#localReconciliationCorrectionCount = 0;
    this.#localAuthorityPoseCorrectionCount = 0;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
    this.#lastLocalAuthorityPoseCorrectionReason = "none";
    this.#lastResolvedJumpActionSequence = 0;
    this.#unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode:
        defaultMetaverseLocomotionMode === "swim" ? "swim" : "grounded"
    });
    this.#localTraversalAuthorityState = createDefaultTraversalAuthoritySnapshot();
    this.#localTraversalAuthorityTick = 0;
    this.#latestIssuedTraversalIntentSnapshot = null;
    this.#groundedLocomotionAccumulatorSeconds = 0;
    this.#swimLocomotionAccumulatorSeconds = 0;
    this.#lastLocalReconciliationCorrectionSource = "none";
    this.#lastJumpInputPressed = false;
    this.#mountedVehicleAuthorityCorrectionCount = 0;
    this.#movementAnimationRuntime.reset();
    this.#mountedOccupancyLookYawRadians = 0;
    this.#routedDriverVehicleControlIntentSnapshot = null;
    this.#traversalCameraPitchRadians = this.#config.camera.initialPitchRadians;
    this.#unmountedLookYawRadians = this.#config.camera.initialYawRadians;
  }

  syncIssuedTraversalIntentSnapshot(
    traversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null
  ): void {
    this.#latestIssuedTraversalIntentSnapshot = traversalIntentSnapshot;
    this.#syncLocalTraversalAuthorityState(false);
  }

  boot(): void {
    this.#enterGroundedLocomotion(
      freezeVector3(
        this.#config.groundedBody.spawnPosition.x,
        this.#config.groundedBody.spawnPosition.y,
        this.#config.groundedBody.spawnPosition.z
      ),
      this.#cameraSnapshot.yawRadians,
      null,
      this.#cameraSnapshot.yawRadians
    );
    this.#syncAutomaticSurfaceLocomotion(
      this.#groundedBodyRuntime.snapshot.position,
      this.#groundedBodyRuntime.snapshot.yawRadians,
      null,
      this.#cameraSnapshot.yawRadians
    );
    this.#syncCharacterPresentationSnapshot();
  }

  syncMountedEnvironment(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    if (mountedEnvironment !== null) {
      if (
        mountedEnvironment.occupancyKind === "seat" &&
        mountedEnvironment.seatId !== null
      ) {
        this.occupySeat(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.seatId
        );
      } else if (
        mountedEnvironment.occupancyKind === "entry" &&
        mountedEnvironment.entryId !== null
      ) {
        this.boardEnvironment(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.entryId
        );
      }
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    this.leaveMountedEnvironment();
  }

  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId);

    if (mountedVehicleRuntimeContext === null) {
      return this.mountedEnvironmentSnapshot;
    }

    const { mountableEnvironmentConfig, mountedVehicleRuntime } =
      mountedVehicleRuntimeContext;
    const occupiedRuntime =
      requestedEntryId !== null
        ? mountedVehicleRuntime.occupyEntry(requestedEntryId)
        : mountableEnvironmentConfig.entries?.[0] !== undefined
          ? mountedVehicleRuntime.occupyEntry(
              mountableEnvironmentConfig.entries[0].entryId
            )
          : (() => {
              const directSeat =
                mountableEnvironmentConfig.seats?.find(
                  (seat) => seat.directEntryEnabled
                ) ?? null;

              return directSeat === null
                ? null
                : mountedVehicleRuntime.occupySeat(directSeat.seatId);
            })();

    if (occupiedRuntime === null) {
      this.#syncCharacterPresentationSnapshot();
      return this.mountedEnvironmentSnapshot;
    }

    this.#resetMountedOccupancyLookState();
    this.#enterMountedOccupancyTraversalState();
    this.#syncCharacterPresentationSnapshot();

    return this.mountedEnvironmentSnapshot;
  }

  occupySeat(
    environmentAssetId: string,
    seatId: string
  ): MountedEnvironmentSnapshot | null {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId);

    if (mountedVehicleRuntimeContext === null) {
      return this.mountedEnvironmentSnapshot;
    }

    const occupiedSeatRuntime =
      mountedVehicleRuntimeContext.mountedVehicleRuntime.occupySeat(seatId);

    if (occupiedSeatRuntime === null) {
      this.#syncCharacterPresentationSnapshot();
      return this.mountedEnvironmentSnapshot;
    }

    this.#resetMountedOccupancyLookState();
    this.#enterMountedOccupancyTraversalState();
    this.#syncCharacterPresentationSnapshot();

    return this.mountedEnvironmentSnapshot;
  }

  leaveMountedEnvironment(): void {
    if (this.#mountedVehicleRuntime !== null) {
      const previousMountedVehicleState = this.#mountedVehicleRuntime.snapshot;
      const freeRoamMountedOccupancy = this.#mountedOccupancyKeepsFreeRoam();
      const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;
      const excludedEnvironmentAssetId = freeRoamMountedOccupancy
        ? null
        : previousMountedVehicleState.environmentAssetId;

      this.#clearMountedVehicleState();
      this.#syncAutomaticSurfaceLocomotion(
        freeRoamMountedOccupancy
          ? groundedBodySnapshot.position
          : previousMountedVehicleState.position,
        freeRoamMountedOccupancy
          ? groundedBodySnapshot.yawRadians
          : previousMountedVehicleState.yawRadians,
        excludedEnvironmentAssetId,
        this.#cameraSnapshot.yawRadians
      );
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    if (this.#locomotionMode === "mounted") {
      this.#syncAutomaticSurfaceLocomotion(
        freezeVector3(
          this.#cameraSnapshot.position.x,
          this.#resolveWaterSurfaceHeightMeters(this.#cameraSnapshot.position),
          this.#cameraSnapshot.position.z
        ),
        this.#cameraSnapshot.yawRadians,
        null,
        this.#cameraSnapshot.yawRadians
      );
    }

    this.#syncCharacterPresentationSnapshot();
  }

  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    this.#latestMovementInputMagnitude = resolveMovementInputMagnitude(movementInput);
    const jumpInputPressed = movementInput.jump === true;
    const jumpPressedThisFrame = jumpInputPressed && !this.#lastJumpInputPressed;

    this.#lastJumpInputPressed = jumpInputPressed;
    const constrainedMountedOccupancy =
      this.#mountedVehicleRuntime !== null &&
      shouldConstrainMountedOccupancyToAnchor(this.#mountedVehicleOccupancy());

    if (constrainedMountedOccupancy) {
      this.#clearGroundedPredictionAccumulator();
      this.#cameraSnapshot = this.#advanceMountedVehicleLocomotion(
        movementInput,
        deltaSeconds
      );
    } else if (this.#locomotionMode === "grounded") {
      this.#cameraSnapshot = this.#advanceGroundedLocomotion(
        movementInput,
        deltaSeconds,
        jumpPressedThisFrame
      );
    } else if (this.#locomotionMode === "swim") {
      this.#clearGroundedPredictionAccumulator();
      this.#cameraSnapshot = this.#advanceSwimLocomotion(
        movementInput,
        deltaSeconds
      );
    } else {
      this.#clearGroundedPredictionAccumulator();
      this.#cameraSnapshot = advanceMetaverseCameraSnapshot(
        this.#cameraSnapshot,
        movementInput,
        this.#config,
        deltaSeconds
      );
    }
    this.#syncCharacterPresentationSnapshot(deltaSeconds);

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
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;
    const mountedEnvironmentConfig = this.#mountedEnvironmentConfig;

    if (
      mountedVehicleRuntime !== null &&
      mountedEnvironmentConfig?.environmentAssetId === environmentAssetId
    ) {
      const previousMountedVehicleState = mountedVehicleRuntime.snapshot;

      mountedVehicleRuntime.syncAuthoritativePose(poseSnapshot);
      const nextMountedVehicleState = mountedVehicleRuntime.snapshot;

      if (
        didMountedVehiclePoseChange(
          previousMountedVehicleState,
          nextMountedVehicleState
        )
      ) {
        this.#localReconciliationCorrectionCount += 1;
        this.#mountedVehicleAuthorityCorrectionCount += 1;
        this.#lastLocalReconciliationCorrectionSource =
          "mounted-vehicle-authority";
      }

      if (this.#mountedOccupancyKeepsFreeRoam()) {
        this.#setDynamicEnvironmentPose(nextMountedVehicleState.environmentAssetId, {
          position: nextMountedVehicleState.position,
          yawRadians: nextMountedVehicleState.yawRadians
        });
        this.#carryFreeRoamMountedOccupancyWithVehicle(
          previousMountedVehicleState,
          nextMountedVehicleState
        );
      } else {
        this.#syncMountedVehiclePresentation();
      }
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    this.#setDynamicEnvironmentPose(environmentAssetId, poseSnapshot);
  }

  syncAuthoritativeLocalPlayerPose(
    authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot,
    latestIssuedJumpActionSequence: number = 0
  ): void {
    if (
      authoritativePlayerSnapshot.mountedOccupancy !== null ||
      authoritativePlayerSnapshot.locomotionMode === "mounted"
    ) {
      return;
    }

    const localTraversalPose = this.#readLocalTraversalPoseForReconciliation();

    if (localTraversalPose === null) {
      return;
    }

    const positionDistance = Math.hypot(
      authoritativePlayerSnapshot.position.x - localTraversalPose.position.x,
      authoritativePlayerSnapshot.position.y - localTraversalPose.position.y,
      authoritativePlayerSnapshot.position.z - localTraversalPose.position.z
    );
    const verticalDistance = Math.abs(
      authoritativePlayerSnapshot.position.y - localTraversalPose.position.y
    );
    const locomotionMismatch =
      authoritativePlayerSnapshot.locomotionMode !==
      localTraversalPose.locomotionMode;
    const authoritativeGrounded =
      authoritativePlayerSnapshot.locomotionMode === "grounded"
        ? this.#isAuthoritativeGroundedPlayerSnapshot(authoritativePlayerSnapshot)
        : false;
    const authoritativeTraversalAuthority =
      authoritativePlayerSnapshot.traversalAuthority;
    this.#syncPredictedGroundedTraversalActionStateFromAuthoritativeTraversal(
      authoritativeTraversalAuthority,
      latestIssuedJumpActionSequence
    );
    const authoritativeAirborneJumpPhase =
      isMetaverseTraversalAuthorityJumpAirborne(
        authoritativeTraversalAuthority,
        latestIssuedJumpActionSequence
      );
    const authoritativeJumpResolution =
      this.#resolveAuthoritativeIssuedJumpResolution(
        authoritativeTraversalAuthority,
        latestIssuedJumpActionSequence
      );
    const authoritativeJumpRejected =
      authoritativeJumpResolution === "rejected";
    const localGroundedBodySnapshot =
      localTraversalPose.locomotionMode === "grounded" &&
      this.#groundedBodyRuntime.isInitialized
        ? this.#groundedBodyRuntime.snapshot
        : null;
    const authoritativeGroundStateMismatch =
      authoritativePlayerSnapshot.locomotionMode === "grounded" &&
      localGroundedBodySnapshot !== null &&
      authoritativeGrounded !== localGroundedBodySnapshot.grounded;
    const authoritativeJumpRejectedShouldSnap =
      authoritativeJumpRejected &&
      (locomotionMismatch ||
        positionDistance > localPlayerAuthoritativeNoopCorrectionDistanceMeters ||
        verticalDistance > localPlayerAuthoritativeNoopCorrectionDistanceMeters ||
        (localGroundedBodySnapshot !== null &&
          (!localGroundedBodySnapshot.grounded ||
            Math.abs(
              localGroundedBodySnapshot.verticalSpeedUnitsPerSecond
            ) > localPlayerAuthoritativeNoopVerticalSpeedUnitsPerSecond)));
    const authoritativeAirborneJumpPhaseShouldSnap =
      authoritativeAirborneJumpPhase &&
      (latestIssuedJumpActionSequence > 0 ||
        positionDistance > localPlayerAuthoritativeNoopCorrectionDistanceMeters ||
        verticalDistance > localPlayerAuthoritativeNoopCorrectionDistanceMeters ||
        Math.abs(authoritativePlayerSnapshot.linearVelocity.y) >
          localPlayerAuthoritativeNoopVerticalSpeedUnitsPerSecond);
    const authoritativeGroundStateMismatchShouldSnap =
      authoritativeGroundStateMismatch &&
      (authoritativeJumpRejectedShouldSnap ||
        authoritativeAirborneJumpPhaseShouldSnap);

    this.#syncAuthoritativeCorrectionTelemetry(
      localTraversalPose,
      authoritativePlayerSnapshot,
      false
    );

    if (
      !locomotionMismatch &&
      authoritativePlayerSnapshot.locomotionMode === "grounded" &&
      localGroundedBodySnapshot !== null &&
      this.#shouldPreserveLocalAirborneJumpArc(
        localGroundedBodySnapshot,
        authoritativeGrounded,
        authoritativeJumpRejected,
        latestIssuedJumpActionSequence,
        locomotionMismatch,
        positionDistance
      )
    ) {
      // Let a routine grounded server pose lag one jump behind without
      // flattening a local airborne arc back onto the floor.
      return;
    }

    const grossPositionDivergence =
      positionDistance >= localPlayerAuthoritativeHardSnapDistanceMeters;
    const shouldSnapCorrection =
      authoritativeJumpRejectedShouldSnap ||
      authoritativeGroundStateMismatchShouldSnap ||
      grossPositionDivergence;

    // Grounded/swim classification is derived from shoreline surface queries, so
    // slight predicted-vs-authoritative drift near the waterline can disagree
    // without indicating an invalid local state.

    if (!shouldSnapCorrection) {
      return;
    }
    const correctionLinearVelocity = authoritativePlayerSnapshot.linearVelocity;

    this.#localReconciliationCorrectionCount += 1;
    this.#localAuthorityPoseCorrectionCount += 1;
    this.#lastLocalAuthorityPoseCorrectionDetail = Object.freeze({
      authoritativeGrounded:
        authoritativePlayerSnapshot.locomotionMode === "grounded"
          ? authoritativeGrounded
          : null,
      localGrounded: localGroundedBodySnapshot?.grounded ?? null,
      planarMagnitudeMeters: Math.hypot(
        authoritativePlayerSnapshot.position.x - localTraversalPose.position.x,
        authoritativePlayerSnapshot.position.z - localTraversalPose.position.z
      ),
      verticalMagnitudeMeters: verticalDistance
    });
    this.#lastLocalAuthorityPoseCorrectionReason =
      resolveLocalAuthorityPoseCorrectionReason({
        authoritativeGroundStateMismatchShouldSnap,
        authoritativeJumpRejected: authoritativeJumpRejectedShouldSnap,
        grossPositionDivergence
      });
    this.#lastLocalReconciliationCorrectionSource = "local-authority-snap";
    this.#syncAuthoritativeCorrectionTelemetry(
      localTraversalPose,
      authoritativePlayerSnapshot,
      true
    );

    if (authoritativePlayerSnapshot.locomotionMode === "swim") {
      this.#syncAuthoritativeSwimLocomotion(
        authoritativePlayerSnapshot.position,
        localTraversalPose.yawRadians,
        correctionLinearVelocity,
        1,
        1
      );
    } else {
      this.#syncAuthoritativeGroundedLocomotion(
        authoritativePlayerSnapshot.position,
        localTraversalPose.yawRadians,
        correctionLinearVelocity,
        authoritativeGrounded,
        1,
        1
      );
    }

    this.#syncCharacterPresentationSnapshot();
  }

  #setLocomotionMode(locomotionMode: MetaverseLocomotionModeId): void {
    if (this.#locomotionMode !== locomotionMode) {
      this.#clearGroundedPredictionAccumulator();
      this.#clearSwimPredictionAccumulator();
    }

    this.#locomotionMode = locomotionMode;

    if (locomotionMode === "grounded" || locomotionMode === "swim") {
      this.#unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot({
        actionState: this.#unmountedTraversalState.actionState,
        locomotionMode
      });
    }

    if (locomotionMode === "mounted") {
      this.#movementAnimationRuntime.reset("idle");
    }
  }

  #mountedVehicleOccupancy() {
    return this.#mountedVehicleRuntime?.snapshot.occupancy ?? null;
  }

  #mountedOccupancyKeepsFreeRoam(): boolean {
    return shouldKeepMountedOccupancyFreeRoam(this.#mountedVehicleOccupancy());
  }

  #resolveGroundedSupportHeightMeters(
    position: PhysicsVector3Snapshot,
    fallbackHeightMeters: number | null = null
  ): number {
    const resolvedSupportHeightMeters =
      this.#readGroundedSupportHeightMeters(position, fallbackHeightMeters);

    if (resolvedSupportHeightMeters === null) {
      return fallbackHeightMeters ?? position.y;
    }

    return resolvedSupportHeightMeters;
  }

  #readGroundedSupportHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "z">,
    fallbackHeightMeters: number | null = null
  ): number | null {
    const localWaterSurfaceHeightMeters = this.#readWaterSurfaceHeightMeters(
      position,
      this.#config.groundedBody.capsuleRadiusMeters
    );
    const resolvedSurfaceHeightMeters = resolveSurfaceHeightMeters(
      this.#config,
      this.#surfaceColliderSnapshots,
      position.x,
      position.z
    );

    if (resolvedSurfaceHeightMeters === null) {
      return fallbackHeightMeters;
    }

    return fallbackHeightMeters !== null &&
      localWaterSurfaceHeightMeters !== null &&
      resolvedSurfaceHeightMeters <=
        localWaterSurfaceHeightMeters +
          this.#config.groundedBody.controllerOffsetMeters
      ? fallbackHeightMeters
      : resolvedSurfaceHeightMeters;
  }

  #readWaterSurfaceHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "z">,
    paddingMeters = 0
  ): number | null {
    return resolveWaterSurfaceHeightMeters(
      this.#config,
      position,
      paddingMeters
    );
  }

  #resolveWaterSurfaceHeightMeters(
    position: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
    paddingMeters = 0
  ): number {
    return (
      this.#readWaterSurfaceHeightMeters(position, paddingMeters) ??
      toFiniteNumber(position.y, this.#config.camera.spawnPosition.y)
    );
  }

  #readCanonicalGroundedSpawnPosition(): PhysicsVector3Snapshot {
    return freezeVector3(
      this.#config.groundedBody.spawnPosition.x,
      this.#config.groundedBody.spawnPosition.y,
      this.#config.groundedBody.spawnPosition.z
    );
  }

  #ensureSwimBodyRuntime(): MetaverseSurfaceDriveBodyRuntime {
    if (this.#swimBodyRuntime !== null) {
      return this.#swimBodyRuntime;
    }

    const groundedSpawnPosition = this.#readCanonicalGroundedSpawnPosition();
    const spawnPosition = freezeVector3(
      groundedSpawnPosition.x,
      this.#resolveWaterSurfaceHeightMeters(groundedSpawnPosition),
      groundedSpawnPosition.z
    );

    this.#swimBodyRuntime = new MetaverseSurfaceDriveBodyRuntime(
      {
        controllerOffsetMeters: this.#config.groundedBody.controllerOffsetMeters,
        shape: Object.freeze({
          halfHeightMeters: this.#config.groundedBody.capsuleHalfHeightMeters,
          kind: "capsule",
          radiusMeters: this.#config.groundedBody.capsuleRadiusMeters
        }),
        spawnPosition,
        spawnYawRadians: this.#config.camera.initialYawRadians,
        worldRadius: this.#config.movement.worldRadius
      },
      this.#physicsRuntime
    );

    return this.#swimBodyRuntime;
  }

  #readSwimSnapshot() {
    return this.#swimBodyRuntime?.snapshot ?? null;
  }

  #readGroundedTraversalExcludedColliders(): readonly RapierColliderHandle[] {
    const excludedColliders: RapierColliderHandle[] = [];
    const groundedColliderHandle = this.#groundedBodyRuntime.colliderHandle;

    if (groundedColliderHandle !== null) {
      excludedColliders.push(groundedColliderHandle);
    }

    if (this.#swimBodyRuntime !== null) {
      excludedColliders.push(this.#swimBodyRuntime.colliderHandle);
    }

    if (this.#mountedVehicleRuntime !== null) {
      excludedColliders.push(this.#mountedVehicleRuntime.colliderHandle);
    }

    return excludedColliders;
  }

  #readWaterborneTraversalExcludedColliders(
    colliderHandle: RapierColliderHandle
  ): readonly RapierColliderHandle[] {
    const excludedColliders = [...this.#readGroundedTraversalExcludedColliders()];

    excludedColliders.push(colliderHandle);

    return excludedColliders;
  }

  #enterGroundedLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    supportHeightMeters: number | null = null,
    lookYawRadians: number = this.#unmountedLookYawRadians
  ): void {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return;
    }

    this.#syncUnmountedLookYawRadians(lookYawRadians);
    this.#clearGroundedPredictionAccumulator();
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#swimBodyRuntime?.dispose();
    this.#swimBodyRuntime = null;
    this.#groundedBodyRuntime.teleport(
      freezeVector3(
        position.x,
        supportHeightMeters ?? this.#resolveGroundedSupportHeightMeters(position),
        position.z
      ),
      yawRadians
    );
    this.#physicsRuntime.stepSimulation(1 / 60);
    this.#groundedBodyRuntime.advance(
      createIdleGroundedBodyIntentSnapshot(),
      1 / 60,
      this.#resolveGroundedTraversalFilterPredicate(
        this.#readGroundedTraversalExcludedColliders()
      ),
      this.#unmountedLookYawRadians
    );
    this.#setLocomotionMode("grounded");
    this.#syncLocalTraversalAuthorityState(false);
    this.#cameraSnapshot = createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveGroundedPresentationPosition()
    );
  }

  #enterSwimLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    lookYawRadians: number = this.#unmountedLookYawRadians
  ): void {
    const swimBodyRuntime = this.#ensureSwimBodyRuntime();

    this.#syncUnmountedLookYawRadians(lookYawRadians);
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    swimBodyRuntime.teleport(
      freezeVector3(
        position.x,
        this.#resolveWaterSurfaceHeightMeters(position),
        position.z
      ),
      yawRadians
    );
    const swimSnapshot = swimBodyRuntime.snapshot;

    this.#setLocomotionMode("swim");
    this.#syncLocalTraversalAuthorityState(false);
    this.#cameraSnapshot = createTraversalSwimCameraPresentationSnapshot(
      swimSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveSwimPresentationPosition(swimSnapshot)
    );
  }

  #syncAuthoritativeGroundedLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    linearVelocity: PhysicsVector3Snapshot,
    grounded: boolean,
    positionBlendAlpha = 1,
    yawBlendAlpha = 1
  ): void {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return;
    }

    const currentBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const blendedYawRadians = wrapRadians(
      currentBodySnapshot.yawRadians +
        wrapRadians(yawRadians - currentBodySnapshot.yawRadians) * yawBlendAlpha
    );
    const blendedPosition = freezeVector3(
      lerp(currentBodySnapshot.position.x, position.x, positionBlendAlpha),
      lerp(currentBodySnapshot.position.y, position.y, positionBlendAlpha),
      lerp(currentBodySnapshot.position.z, position.z, positionBlendAlpha)
    );

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#groundedBodyRuntime.syncAuthoritativeState({
      grounded,
      linearVelocity,
      position: blendedPosition,
      yawRadians: blendedYawRadians
    });
    this.#setLocomotionMode("grounded");
    this.#syncLocalTraversalAuthorityState(false);
    this.#syncGroundedCameraPresentation();
  }

  #syncAuthoritativeSwimLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    linearVelocity: PhysicsVector3Snapshot,
    positionBlendAlpha = 1,
    yawBlendAlpha = 1
  ): void {
    const swimBodyRuntime = this.#ensureSwimBodyRuntime();
    const currentSwimSnapshot = swimBodyRuntime.snapshot;
    const wrappedYawRadians = wrapRadians(
      currentSwimSnapshot.yawRadians +
        wrapRadians(yawRadians - currentSwimSnapshot.yawRadians) * yawBlendAlpha
    );

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    swimBodyRuntime.syncAuthoritativeState({
      linearVelocity,
      position: freezeVector3(
        lerp(currentSwimSnapshot.position.x, position.x, positionBlendAlpha),
        this.#resolveWaterSurfaceHeightMeters(position),
        lerp(currentSwimSnapshot.position.z, position.z, positionBlendAlpha)
      ),
      yawRadians: wrappedYawRadians
    });
    this.#setLocomotionMode("swim");
    this.#syncLocalTraversalAuthorityState(false);
    this.#cameraSnapshot = createTraversalSwimCameraPresentationSnapshot(
      swimBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveSwimPresentationPosition(swimBodyRuntime.snapshot)
    );
  }

  #syncAutomaticSurfaceTelemetry(
    automaticSurfaceSnapshot: ReturnType<typeof resolveAutomaticSurfaceLocomotionSnapshot>,
    autostepHeightMeters: number | null
  ): void {
    this.#latestAutostepHeightMeters = autostepHeightMeters;
    this.#latestBlockerOverlap = automaticSurfaceSnapshot.debug.blockerOverlap;
    this.#latestResolvedSupportHeightMeters =
      automaticSurfaceSnapshot.debug.resolvedSupportHeightMeters;
    this.#latestStepSupportedProbeCount =
      automaticSurfaceSnapshot.debug.stepSupportedProbeCount;

    this.#latestAutomaticSurfaceDecisionReason =
      automaticSurfaceSnapshot.debug.reason;
  }

  #syncAuthoritativeCorrectionTelemetry(
    localTraversalPose: LocalTraversalPoseSnapshot,
    correctionTargetPose: CorrectionTargetPoseSnapshot,
    applied: boolean
  ): void {
    this.#latestAuthoritativeCorrectionTelemetrySnapshot = Object.freeze({
      applied,
      locomotionMismatch:
        correctionTargetPose.locomotionMode !==
        localTraversalPose.locomotionMode,
      planarMagnitudeMeters: Math.hypot(
        correctionTargetPose.position.x - localTraversalPose.position.x,
        correctionTargetPose.position.z - localTraversalPose.position.z
      ),
      verticalMagnitudeMeters: Math.abs(
        correctionTargetPose.position.y - localTraversalPose.position.y
      )
    });
  }

  #syncAutomaticSurfaceLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    excludedOwnerEnvironmentAssetId: string | null = null,
    lookYawRadians: number = this.#unmountedLookYawRadians
  ): void {
    const locomotionSnapshot = resolveAutomaticSurfaceLocomotionSnapshot(
      this.#config,
      this.#surfaceColliderSnapshots,
      position,
      yawRadians,
      this.#locomotionMode === "grounded" ? "grounded" : "swim",
      excludedOwnerEnvironmentAssetId
    );
    const locomotionDecision = locomotionSnapshot.decision;

    this.#syncAutomaticSurfaceTelemetry(locomotionSnapshot, null);

    if (locomotionDecision.locomotionMode === "grounded") {
      this.#enterGroundedLocomotion(
        position,
        yawRadians,
        locomotionDecision.supportHeightMeters,
        lookYawRadians
      );
      return;
    }

    this.#enterSwimLocomotion(position, yawRadians, lookYawRadians);
  }

  #syncGroundedCameraPresentation(): void {
    if (
      !this.#groundedBodyRuntime.isInitialized ||
      this.#locomotionMode !== "grounded"
    ) {
      return;
    }

    this.#cameraSnapshot = createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveGroundedPresentationPosition()
    );
  }

  #syncSwimCameraPresentation(): void {
    if (this.#locomotionMode !== "swim") {
      return;
    }

    const swimSnapshot = this.#ensureSwimBodyRuntime().snapshot;

    this.#cameraSnapshot = createTraversalSwimCameraPresentationSnapshot(
      swimSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveSwimPresentationPosition(swimSnapshot)
    );
  }

  #syncUnmountedLookYawRadians(yawRadians: number): void {
    this.#unmountedLookYawRadians = wrapRadians(yawRadians);
  }

  #advanceUnmountedLookYawRadians(
    movementInput: Pick<MetaverseFlightInputSnapshot, "yawAxis">,
    deltaSeconds: number,
    maxTurnSpeedRadiansPerSecond: number
  ): void {
    this.#syncUnmountedLookYawRadians(
      wrapRadians(
        this.#unmountedLookYawRadians +
          clamp(toFiniteNumber(movementInput.yawAxis, 0), -1, 1) *
            Math.max(0, toFiniteNumber(maxTurnSpeedRadiansPerSecond, 0)) *
            deltaSeconds
      )
    );
  }

  #isAuthoritativeGroundedPlayerSnapshot(
    authoritativePlayerSnapshot: Pick<
      MetaverseRealtimePlayerSnapshot,
      "jumpAuthorityState"
    >
  ): boolean {
    return authoritativePlayerSnapshot.jumpAuthorityState === "grounded";
  }

  #resolveAuthoritativeIssuedJumpResolution(
    authoritativeTraversalAuthority: Pick<
      MetaverseTraversalAuthoritySnapshot,
      | "currentActionKind"
      | "currentActionPhase"
      | "currentActionSequence"
      | "lastConsumedActionKind"
      | "lastConsumedActionSequence"
      | "lastRejectedActionKind"
      | "lastRejectedActionSequence"
    >,
    latestIssuedJumpActionSequence: number
  ): "none" | "pending-or-active" | "accepted" | "rejected" {
    const issuedJumpResolution =
      resolveMetaverseTraversalAuthorityIssuedJumpResolution(
        authoritativeTraversalAuthority,
        latestIssuedJumpActionSequence,
        this.#lastResolvedJumpActionSequence
      );

    if (
      issuedJumpResolution.resolution === "accepted" ||
      issuedJumpResolution.resolution === "rejected"
    ) {
      this.#lastResolvedJumpActionSequence =
        issuedJumpResolution.jumpActionSequence;
    }

    return issuedJumpResolution.resolution;
  }

  #hasLocallyPredictedJumpSequence(
    latestIssuedJumpActionSequence: number
  ): boolean {
    const localJumpAuthorityState = this.#resolveLocalPredictedJumpAuthorityState();
    const localTraversalAuthority =
      this.#resolveLocalTraversalAuthoritySnapshotForIssuedJumpSequence(
        latestIssuedJumpActionSequence
      );
    const issuedJumpResolution = resolveMetaverseTraversalAuthorityIssuedJumpResolution(
      localTraversalAuthority,
      latestIssuedJumpActionSequence
    ).resolution;

    return (
      issuedJumpResolution === "pending-or-active" ||
      (issuedJumpResolution === "accepted" &&
        localJumpAuthorityState !== "grounded")
    );
  }

  #shouldPreserveLocalAirborneJumpArc(
    localGroundedBodySnapshot: MetaverseGroundedBodyRuntime["snapshot"],
    authoritativeGrounded: boolean,
    authoritativeJumpRejected: boolean,
    latestIssuedJumpActionSequence: number,
    locomotionMismatch: boolean,
    positionDistance: number
  ): boolean {
    return (
      !locomotionMismatch &&
      authoritativeGrounded &&
      !localGroundedBodySnapshot.grounded &&
      !authoritativeJumpRejected &&
      this.#hasLocallyPredictedJumpSequence(latestIssuedJumpActionSequence) &&
      positionDistance < localPlayerAuthoritativeHardSnapDistanceMeters
    );
  }

  #resolveLocalTraversalAuthoritySnapshotForIssuedJumpSequence(
    latestIssuedJumpActionSequence: number
  ): MetaverseTraversalAuthoritySnapshot {
    if (
      latestIssuedJumpActionSequence <= 0 ||
      this.#locomotionMode !== "grounded" ||
      !this.#groundedBodyRuntime.isInitialized
    ) {
      return this.#localTraversalAuthorityState;
    }

    const localJumpAuthorityState = this.#resolveLocalPredictedJumpAuthorityState();
    const localIssuedJumpResolution =
      resolveMetaverseTraversalAuthorityIssuedJumpResolution(
        this.#localTraversalAuthorityState,
        latestIssuedJumpActionSequence
      );

    if (
      localIssuedJumpResolution.resolution === "pending-or-active" ||
      (localIssuedJumpResolution.resolution === "accepted" &&
        localJumpAuthorityState === "grounded")
    ) {
      return this.#localTraversalAuthorityState;
    }

    return resolveMetaverseTraversalAuthoritySnapshotInput({
      currentTick: this.#localTraversalAuthorityTick,
      jumpAuthorityState: localJumpAuthorityState,
      locomotionMode: "grounded",
      mounted: false,
      pendingActionKind:
        localJumpAuthorityState === "grounded"
          ? this.#unmountedTraversalState.actionState.pendingActionKind
          : "none",
      pendingActionSequence:
        localJumpAuthorityState === "grounded"
          ? this.#unmountedTraversalState.actionState.pendingActionSequence
          : 0,
      previousTraversalAuthority: this.#localTraversalAuthorityState,
      resolvedActionKind:
        this.#unmountedTraversalState.actionState.resolvedActionKind === "jump" &&
        localJumpAuthorityState !== "grounded"
          ? "jump"
          : "none",
      resolvedActionSequence:
        this.#unmountedTraversalState.actionState.resolvedActionKind === "jump" &&
        this.#unmountedTraversalState.actionState.resolvedActionSequence > 0 &&
        localJumpAuthorityState !== "grounded"
          ? Math.max(
              latestIssuedJumpActionSequence,
              this.#unmountedTraversalState.actionState.resolvedActionSequence
            )
          : 0,
      resolvedActionState:
        this.#unmountedTraversalState.actionState.resolvedActionState
    });
  }

  #readLocalTraversalPoseForReconciliation(): LocalTraversalPoseSnapshot | null {
    if (this.#mountedVehicleRuntime !== null || this.#locomotionMode === "mounted") {
      return null;
    }

    if (this.#locomotionMode === "swim") {
      const swimSnapshot = this.#readSwimSnapshot();

      if (swimSnapshot === null) {
        return null;
      }

      return {
        locomotionMode: "swim",
        position: swimSnapshot.position,
        yawRadians: swimSnapshot.yawRadians
      };
    }

    if (!this.#groundedBodyRuntime.isInitialized) {
      return null;
    }

    return {
      locomotionMode: "grounded",
      position: this.#groundedBodyRuntime.snapshot.position,
      yawRadians: this.#groundedBodyRuntime.snapshot.yawRadians
    };
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
        this.#resolveGroundedSupportHeightMeters(
          carriedPosition,
          carriedPosition.y
        ),
        carriedPosition.z
      ),
      wrapRadians(groundedBodySnapshot.yawRadians + deltaYawRadians)
    );
    this.#physicsRuntime.stepSimulation(1 / 60);
    this.#groundedBodyRuntime.advance(
      createIdleGroundedBodyIntentSnapshot(),
      1 / 60,
      this.#resolveGroundedTraversalFilterPredicate(
        this.#readGroundedTraversalExcludedColliders()
      ),
      this.#unmountedLookYawRadians
    );
    this.#syncLocalTraversalAuthorityState(false);
    this.#syncGroundedCameraPresentation();
  }

  #enterMountedOccupancyTraversalState(): void {
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedVehicleSnapshot = this.#mountedVehicleRuntime?.snapshot ?? null;

    if (mountedEnvironment === null || mountedVehicleSnapshot === null) {
      return;
    }

    if (shouldKeepMountedOccupancyFreeRoam(mountedEnvironment)) {
      const anchorSnapshot =
        this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment);
      const groundedEntryPosition =
        anchorSnapshot?.position ?? mountedVehicleSnapshot.position;

      this.#enterGroundedLocomotion(
        groundedEntryPosition,
        anchorSnapshot?.yawRadians ?? mountedVehicleSnapshot.yawRadians,
        this.#resolveGroundedSupportHeightMeters(
          groundedEntryPosition,
          anchorSnapshot?.position.y ?? mountedVehicleSnapshot.position.y
        )
      );
      return;
    }

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#setLocomotionMode("mounted");
    this.#syncLocalTraversalAuthorityState(false);
    this.#traversalCameraPitchRadians = this.#cameraSnapshot.pitchRadians;
    this.#syncMountedVehiclePresentation();
  }

  #ensureMountedVehicleRuntime(
    environmentAssetId: string
  ): {
    readonly mountableEnvironmentConfig: Pick<
      MetaverseEnvironmentAssetProofConfig,
      "collider" | "entries" | "environmentAssetId" | "label" | "seats"
    >;
    readonly mountedVehicleRuntime: MetaverseVehicleRuntime;
  } | null {
    if (
      this.#mountedVehicleRuntime !== null &&
      this.#mountedEnvironmentConfig !== null &&
      this.#mountedEnvironmentConfig.environmentAssetId === environmentAssetId
    ) {
      return {
        mountableEnvironmentConfig: this.#mountedEnvironmentConfig,
        mountedVehicleRuntime: this.#mountedVehicleRuntime
      };
    }

    const mountableEnvironmentConfig = this.#readMountableEnvironmentConfig(
      environmentAssetId
    );
    const dynamicEnvironmentPose =
      this.#readDynamicEnvironmentPose(environmentAssetId);

    if (
      dynamicEnvironmentPose === null ||
      mountableEnvironmentConfig === null ||
      mountableEnvironmentConfig.seats === null
    ) {
      return null;
    }

    this.#clearMountedVehicleState();
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#traversalCameraPitchRadians = this.#cameraSnapshot.pitchRadians;
    this.#mountedVehicleRuntime = new MetaverseVehicleRuntime({
      authoritativeCorrection: this.#config.skiff.authoritativeCorrection,
      driveCollider:
        mountableEnvironmentConfig.collider === null
          ? null
          : Object.freeze({
              center: freezeVector3(
                mountableEnvironmentConfig.collider.center.x,
                mountableEnvironmentConfig.collider.center.y,
                mountableEnvironmentConfig.collider.center.z
              ),
              size: freezeVector3(
                mountableEnvironmentConfig.collider.size.x,
                mountableEnvironmentConfig.collider.size.y,
                mountableEnvironmentConfig.collider.size.z
              )
            }),
      entries: mountableEnvironmentConfig.entries,
      environmentAssetId: mountableEnvironmentConfig.environmentAssetId,
      label: mountableEnvironmentConfig.label,
      oceanHeightMeters: this.#config.ocean.height,
      physicsRuntime: this.#physicsRuntime,
      poseSnapshot: dynamicEnvironmentPose,
      resolveWaterborneTraversalFilterPredicate: (
        excludedOwnerEnvironmentAssetId,
        excludedColliders = []
      ) =>
        this.#resolveWaterborneTraversalFilterPredicate(
          excludedOwnerEnvironmentAssetId,
          Object.freeze([
            ...this.#readGroundedTraversalExcludedColliders(),
            ...excludedColliders
          ])
        ),
      seats: mountableEnvironmentConfig.seats,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      waterContactProbeRadiusMeters:
        this.#config.skiff.waterContactProbeRadiusMeters,
      waterlineHeightMeters: this.#config.skiff.waterlineHeightMeters,
      worldRadius: this.#config.movement.worldRadius
    });
    this.#mountedEnvironmentConfig = mountableEnvironmentConfig;

    return {
      mountableEnvironmentConfig,
      mountedVehicleRuntime: this.#mountedVehicleRuntime
    };
  }

  #clearMountedVehicleState(): void {
    this.#mountedVehicleRuntime?.clearOccupancy();
    this.#mountedVehicleRuntime?.dispose();
    this.#mountedEnvironmentConfig = null;
    this.#mountedOccupancyLookYawRadians = 0;
    this.#routedDriverVehicleControlIntentSnapshot = null;
    this.#mountedVehicleRuntime = null;
  }

  #resetMountedOccupancyLookState(): void {
    this.#mountedOccupancyLookYawRadians = 0;
  }

  #syncMountedVehiclePresentation(): void {
    const mountedVehicleSnapshot = this.#mountedVehicleRuntime?.snapshot;

    if (mountedVehicleSnapshot === undefined) {
      return;
    }

    this.#setDynamicEnvironmentPose(mountedVehicleSnapshot.environmentAssetId, {
      position: mountedVehicleSnapshot.position,
      yawRadians: mountedVehicleSnapshot.yawRadians
    });
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment);

    this.#cameraSnapshot = createTraversalMountedVehicleCameraPresentationSnapshot(
      mountedVehicleSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      mountedEnvironmentAnchorSnapshot,
      this.#mountedOccupancyLookYawRadians
    );
  }

  #advanceGroundedLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number,
    jumpPressedThisFrame: boolean
  ): MetaverseCameraSnapshot {
    if (jumpPressedThisFrame) {
      this.#unmountedTraversalState = queueMetaverseUnmountedTraversalAction(
        this.#unmountedTraversalState,
        {
          actionIntent: Object.freeze({
            kind: "jump",
            pressed: true,
            sequence: this.#resolveLatestPredictedJumpActionSequence(true)
          }),
          bufferSeconds: groundedJumpIntentBufferSeconds,
        }
      );
      this.#syncLocalTraversalAuthorityState(false);
    }
    this.#advanceUnmountedLookYawRadians(
      movementInput,
      deltaSeconds,
      this.#config.groundedBody.maxTurnSpeedRadiansPerSecond
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#config,
        deltaSeconds
      );
    this.#groundedLocomotionAccumulatorSeconds += Math.max(
      0,
      toFiniteNumber(deltaSeconds, 0)
    );

    while (
      this.#groundedLocomotionAccumulatorSeconds +
        authoritativeTraversalFixedStepEpsilon >=
        authoritativeTraversalFixedStepSeconds &&
      this.#locomotionMode === "grounded"
    ) {
      const groundedCameraSnapshot = this.#advanceGroundedLocomotionStep(
        movementInput,
        authoritativeTraversalFixedStepSeconds
      );

      this.#groundedLocomotionAccumulatorSeconds = Math.max(
        0,
        this.#groundedLocomotionAccumulatorSeconds -
          authoritativeTraversalFixedStepSeconds
      );

      if (this.#locomotionMode !== "grounded") {
        this.#clearGroundedPredictionAccumulator();
        return groundedCameraSnapshot;
      }
    }

    return createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveGroundedPresentationPosition()
    );
  }

  #advanceGroundedLocomotionStep(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const currentBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const surfacePolicyConfig = readMetaverseSurfacePolicyConfig(this.#config);
    const groundedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: movementInput.boost,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        turnAxis: toFiniteNumber(movementInput.yawAxis, 0)
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          this.#config.groundedBody.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          this.#config.groundedBody.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot: currentBodySnapshot,
      jumpSupportVerticalSpeedTolerance:
        localGroundedJumpSupportVerticalSpeedTolerance,
      preferredLookYawRadians: this.#unmountedLookYawRadians,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfacePolicyConfig,
      swimBodySnapshot: null,
      traversalState: this.#unmountedTraversalState,
      waterRegionSnapshots: metaverseWaterRegionSnapshots
    });
    if (groundedTraversalStep.locomotionMode !== "grounded") {
      throw new Error(
        "prepareMetaverseUnmountedTraversalStep returned a swim step while grounded"
      );
    }
    this.#unmountedTraversalState = groundedTraversalStep.traversalState;

    this.#groundedBodyRuntime.setAutostepEnabled(
      groundedTraversalStep.autostepHeightMeters !== null,
      groundedTraversalStep.autostepHeightMeters ??
        this.#config.groundedBody.stepHeightMeters
    );
    this.#physicsRuntime.stepSimulation(deltaSeconds);

    const bodySnapshot = this.#groundedBodyRuntime.advance(
      groundedTraversalStep.bodyIntent,
      deltaSeconds,
      this.#resolveGroundedTraversalFilterPredicate(
        this.#readGroundedTraversalExcludedColliders()
      ),
      this.#unmountedLookYawRadians
    );

    const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
      groundedBodySnapshot: bodySnapshot,
      preparedTraversalStep: groundedTraversalStep,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfacePolicyConfig,
      swimBodySnapshot: null,
      waterRegionSnapshots: metaverseWaterRegionSnapshots
    });
    this.#unmountedTraversalState = locomotionOutcome.traversalState;

    this.#syncAutomaticSurfaceTelemetry(
      locomotionOutcome.automaticSurfaceSnapshot,
      groundedTraversalStep.autostepHeightMeters
    );

    if (locomotionOutcome.locomotionMode === "swim") {
      if (this.#mountedOccupancyKeepsFreeRoam()) {
        return createTraversalGroundedCameraPresentationSnapshot(
          bodySnapshot,
          this.#traversalCameraPitchRadians,
          this.#config,
          this.#unmountedLookYawRadians,
          bodySnapshot.position
        );
      }

      this.#enterSwimLocomotion(
        freezeVector3(
          bodySnapshot.position.x,
          locomotionOutcome.waterlineHeightMeters,
          bodySnapshot.position.z
        ),
        bodySnapshot.yawRadians,
        this.#unmountedLookYawRadians
      );

      return this.#cameraSnapshot;
    }

    this.#syncLocalTraversalAuthorityState(true);

    return createTraversalGroundedCameraPresentationSnapshot(
      bodySnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      bodySnapshot.position
    );
  }

  #advanceSwimLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    this.#advanceUnmountedLookYawRadians(
      movementInput,
      deltaSeconds,
      this.#config.swim.maxTurnSpeedRadiansPerSecond
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#config,
        deltaSeconds
      );
    this.#swimLocomotionAccumulatorSeconds += Math.max(
      0,
      toFiniteNumber(deltaSeconds, 0)
    );

    while (
      this.#swimLocomotionAccumulatorSeconds +
        authoritativeTraversalFixedStepEpsilon >=
        authoritativeTraversalFixedStepSeconds &&
      this.#locomotionMode === "swim"
    ) {
      const swimCameraSnapshot = this.#advanceSwimLocomotionStep(
        movementInput,
        authoritativeTraversalFixedStepSeconds
      );

      this.#swimLocomotionAccumulatorSeconds = Math.max(
        0,
        this.#swimLocomotionAccumulatorSeconds -
          authoritativeTraversalFixedStepSeconds
      );

      if (this.#locomotionMode !== "swim") {
        this.#clearSwimPredictionAccumulator();
        return swimCameraSnapshot;
      }
    }

    return createTraversalSwimCameraPresentationSnapshot(
      this.#ensureSwimBodyRuntime().snapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      this.#resolveSwimPresentationPosition()
    );
  }

  #advanceSwimLocomotionStep(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const swimBodyRuntime = this.#ensureSwimBodyRuntime();
    const preparedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: movementInput.boost,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        turnAxis: toFiniteNumber(movementInput.yawAxis, 0)
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          this.#config.groundedBody.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          this.#config.groundedBody.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot: null,
      jumpSupportVerticalSpeedTolerance:
        localGroundedJumpSupportVerticalSpeedTolerance,
      preferredLookYawRadians: this.#unmountedLookYawRadians,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(this.#config),
      swimBodySnapshot: swimBodyRuntime.snapshot,
      traversalState: this.#unmountedTraversalState,
      waterRegionSnapshots: metaverseWaterRegionSnapshots
    });
    if (preparedTraversalStep.locomotionMode !== "swim") {
      throw new Error(
        "prepareMetaverseUnmountedTraversalStep returned a grounded step while swimming"
      );
    }
    const nextSwimSnapshot = swimBodyRuntime.advance(
      Object.freeze({
        boost: preparedTraversalStep.bodyControl.boost,
        moveAxis: preparedTraversalStep.bodyControl.moveAxis,
        strafeAxis: preparedTraversalStep.bodyControl.strafeAxis,
        yawAxis: preparedTraversalStep.bodyControl.turnAxis
      }),
      this.#config.swim,
      deltaSeconds,
      preparedTraversalStep.waterlineHeightMeters,
      this.#unmountedLookYawRadians,
      this.#resolveWaterborneTraversalFilterPredicate(
        null,
        this.#readWaterborneTraversalExcludedColliders(
          swimBodyRuntime.colliderHandle
        )
      )
    );

    const locomotionOutcome = resolveMetaverseUnmountedTraversalStep({
      groundedBodySnapshot: null,
      preparedTraversalStep,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      surfacePolicyConfig: readMetaverseSurfacePolicyConfig(this.#config),
      swimBodySnapshot: nextSwimSnapshot,
      waterRegionSnapshots: metaverseWaterRegionSnapshots
    });
    this.#unmountedTraversalState = locomotionOutcome.traversalState;

    this.#syncAutomaticSurfaceTelemetry(
      locomotionOutcome.automaticSurfaceSnapshot,
      null
    );

    if (locomotionOutcome.locomotionMode === "grounded") {
      this.#enterGroundedLocomotion(
        nextSwimSnapshot.position,
        nextSwimSnapshot.yawRadians,
        locomotionOutcome.supportHeightMeters,
        this.#unmountedLookYawRadians
      );

      return this.#cameraSnapshot;
    }

    this.#syncLocalTraversalAuthorityState(true);

    return createTraversalSwimCameraPresentationSnapshot(
      nextSwimSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      this.#unmountedLookYawRadians,
      nextSwimSnapshot.position
    );
  }

  #advanceMountedVehicleLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;

    if (mountedVehicleRuntime === null) {
      return this.#cameraSnapshot;
    }

    const mountedVehicleState = mountedVehicleRuntime.snapshot;
    this.#traversalCameraPitchRadians =
      clampTraversalMountedOccupancyPitchRadians(
        advanceTraversalCameraPresentationPitchRadians(
          this.#traversalCameraPitchRadians,
          movementInput,
          this.#config,
          deltaSeconds
        ),
        mountedVehicleState,
        this.#config
      );
    this.#mountedOccupancyLookYawRadians =
      advanceTraversalMountedOccupancyLookYawRadians(
        this.#mountedOccupancyLookYawRadians,
        movementInput,
        mountedVehicleState,
        this.#config,
        deltaSeconds
      );
    const mountedVehicleLocomotionInput = this.#resolveMountedVehicleLocomotionInput(
      mountedVehicleState,
      movementInput
    );

    this.#routedDriverVehicleControlIntentSnapshot =
      this.#resolveRoutedDriverVehicleControlIntentSnapshot(
        mountedVehicleState,
        mountedVehicleLocomotionInput
      );

    const mountedVehicleSnapshot = mountedVehicleRuntime.advance(
      mountedVehicleLocomotionInput,
      this.#config.skiff,
      deltaSeconds,
      this.#config.movement.worldRadius
    );
    this.#setDynamicEnvironmentPose(mountedVehicleSnapshot.environmentAssetId, {
      position: mountedVehicleSnapshot.position,
      yawRadians: mountedVehicleSnapshot.yawRadians
    });
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment);

    return createTraversalMountedVehicleCameraPresentationSnapshot(
      mountedVehicleSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      mountedEnvironmentAnchorSnapshot,
      this.#mountedOccupancyLookYawRadians
    );
  }

  #resolveMountedVehicleLocomotionInput(
    mountedVehicleState: TraversalMountedVehicleSnapshot,
    movementInput: MetaverseFlightInputSnapshot
  ): MountedVehicleControlIntent {
    const occupancy = mountedVehicleState.occupancy;

    if (
      occupancy === null ||
      occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
      occupancy.occupantRole !== "driver" ||
      !mountedVehicleState.waterborne
    ) {
      return Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      });
    }

    return Object.freeze({
      boost: movementInput.boost,
      moveAxis: movementInput.moveAxis,
      strafeAxis: 0,
      yawAxis: clamp(
        toFiniteNumber(movementInput.yawAxis, 0) +
          toFiniteNumber(movementInput.strafeAxis, 0),
        -1,
        1
      )
    });
  }

  #resolveRoutedDriverVehicleControlIntentSnapshot(
    mountedVehicleState: TraversalMountedVehicleSnapshot,
    controlIntent: MountedVehicleControlIntent
  ): RoutedDriverVehicleControlIntentSnapshot | null {
    const occupancy = mountedVehicleState.occupancy;

    if (
      occupancy === null ||
      occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
      occupancy.occupantRole !== "driver"
    ) {
      return null;
    }

    return Object.freeze({
      controlIntent,
      environmentAssetId: mountedVehicleState.environmentAssetId
    });
  }

  #resolveLocalAnimationVocabulary(
    deltaSeconds: number
  ): MetaverseCharacterPresentationSnapshot["animationVocabulary"] {
    if (this.#locomotionMode === "grounded" && this.#groundedBodyRuntime.isInitialized) {
      const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;

      return this.#movementAnimationRuntime.advance(
        {
          grounded: groundedBodySnapshot.grounded,
          inputMagnitude: this.#latestMovementInputMagnitude,
          locomotionMode: "grounded",
          planarSpeedUnitsPerSecond: groundedBodySnapshot.planarSpeedUnitsPerSecond,
          verticalSpeedUnitsPerSecond:
            groundedBodySnapshot.verticalSpeedUnitsPerSecond
        },
        deltaSeconds
      );
    }

    if (this.#locomotionMode === "swim") {
      const swimSnapshot = this.#readSwimSnapshot();

      if (swimSnapshot === null) {
        this.#movementAnimationRuntime.reset("idle");
        return this.#movementAnimationRuntime.animationVocabulary;
      }

      return this.#movementAnimationRuntime.advance(
        {
          grounded: false,
          inputMagnitude: this.#latestMovementInputMagnitude,
          locomotionMode: "swim",
          planarSpeedUnitsPerSecond: swimSnapshot.planarSpeedUnitsPerSecond,
          verticalSpeedUnitsPerSecond: 0
        },
        deltaSeconds
      );
    }

    this.#movementAnimationRuntime.reset("idle");
    return this.#movementAnimationRuntime.animationVocabulary;
  }

  #clearGroundedPredictionAccumulator(): void {
    this.#groundedLocomotionAccumulatorSeconds = 0;
    this.#unmountedTraversalState =
      clearMetaverseUnmountedTraversalPendingActions(
        this.#unmountedTraversalState
      );
  }

  #clearSwimPredictionAccumulator(): void {
    this.#swimLocomotionAccumulatorSeconds = 0;
  }

  #resolveGroundedPresentationPosition(): PhysicsVector3Snapshot {
    const groundedBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const predictionSeconds = this.#groundedLocomotionAccumulatorSeconds;
    const linearVelocitySnapshot = this.#groundedBodyRuntime.linearVelocitySnapshot;
    const planarProjectedPosition = projectTraversalPresentationPosition(
      groundedBodySnapshot.position,
      freezeVector3(
        linearVelocitySnapshot.x,
        0,
        linearVelocitySnapshot.z
      ),
      predictionSeconds
    );
    const supportHeightMeters = groundedBodySnapshot.grounded
      ? groundedBodySnapshot.position.y
      : this.#readGroundedSupportHeightMeters(planarProjectedPosition);

    return projectGroundedTraversalPresentationPosition(
      groundedBodySnapshot.position,
      linearVelocitySnapshot,
      predictionSeconds,
      groundedBodySnapshot.grounded,
      this.#config.groundedBody.gravityUnitsPerSecond,
      supportHeightMeters
    );
  }

  #resolveSwimPresentationPosition(
    swimSnapshot: SurfaceLocomotionSnapshot | null = this.#readSwimSnapshot()
  ): PhysicsVector3Snapshot {
    const resolvedSwimSnapshot = swimSnapshot ?? this.#ensureSwimBodyRuntime().snapshot;
    const swimMotionSnapshot = resolvedSwimSnapshot as SurfaceLocomotionSnapshot & {
      readonly linearVelocity?: PhysicsVector3Snapshot;
    };
    const linearVelocity =
      swimMotionSnapshot.linearVelocity ?? freezeVector3(0, 0, 0);

    return projectTraversalPresentationPosition(
      resolvedSwimSnapshot.position,
      linearVelocity,
      this.#swimLocomotionAccumulatorSeconds
    );
  }

  #syncCharacterPresentationSnapshot(deltaSeconds = 0): void {
    const groundedSpawnPosition = this.#readCanonicalGroundedSpawnPosition();
    const swimSnapshot =
      this.#readSwimSnapshot() ??
      createSurfaceLocomotionSnapshot(
        freezeVector3(
          groundedSpawnPosition.x,
          this.#resolveWaterSurfaceHeightMeters(groundedSpawnPosition),
          groundedSpawnPosition.z
        ),
        this.#config.camera.initialYawRadians
      );

    this.#characterPresentationSnapshot = createTraversalCharacterPresentationSnapshot({
      animationVocabulary: this.#resolveLocalAnimationVocabulary(deltaSeconds),
      config: this.#config,
      groundedBodySnapshot: this.#groundedBodyRuntime.isInitialized
        ? this.#groundedBodyRuntime.snapshot
        : null,
      groundedPresentationPosition: this.#groundedBodyRuntime.isInitialized
        ? this.#resolveGroundedPresentationPosition()
        : null,
      locomotionMode: this.#locomotionMode,
      mountedVehicleSnapshot:
        this.#mountedVehicleRuntime?.snapshot ?? null,
      presentationYawRadians:
        this.#mountedVehicleRuntime === null ? this.#unmountedLookYawRadians : null,
      swimPresentationPosition:
        this.#locomotionMode === "swim"
          ? this.#resolveSwimPresentationPosition(swimSnapshot)
          : swimSnapshot.position,
      swimSnapshot
    });
  }
}
