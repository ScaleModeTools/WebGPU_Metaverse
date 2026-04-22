import {
  shouldKeepMetaverseMountedOccupancyFreeRoam
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  hasMetaverseTraversalAuthorityConsumedAction,
  hasMetaverseTraversalAuthorityRejectedAction,
  isMetaverseTraversalAuthorityActionPendingOrActive,
  isMetaverseTraversalAuthorityGroundedLocomotion,
  readMetaverseTraversalAuthorityLatestActionSequence,
  type MetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import {
  createAuthoritativeCorrectionTelemetrySnapshot,
  createDefaultAuthoritativeCorrectionTelemetrySnapshot,
  createDefaultLocalAuthorityPoseCorrectionDetailSnapshot,
  createDefaultLocalAuthorityPoseCorrectionSnapshot,
  createLocalAuthorityPoseCorrectionDetailSnapshot,
  resolveLocalAuthorityPoseConvergenceDecision,
  resolveLocalAuthorityPoseDivergenceDiagnostics,
  resolveLocalAuthorityPoseCorrectionReason,
  type AuthoritativeCorrectionTelemetrySnapshot,
  type LocalAuthorityPoseCorrectionSnapshot,
  type LocalAuthorityPoseCorrectionDetailSnapshot,
  type LocalAuthorityPoseIntentionalDiscontinuityCause,
  type LocalAuthorityPoseHistoricalLocalSampleSelectionReason,
  type LocalAuthorityPoseCorrectionReason,
  type LocalTraversalPoseSnapshot
} from "../local-authority-pose-correction";
import type {
  AuthoritativeLocalPlayerReconciliationSnapshot
} from "../authoritative-local-player-reconciliation";
import type { MetaverseIssuedTraversalIntentSnapshot } from "../../types/traversal";

export interface AuthoritativeLocalPlayerPoseSnapshot
  extends AuthoritativeLocalPlayerReconciliationSnapshot {
  readonly lastProcessedTraversalSequence: number;
}

export interface ApplyAuthoritativeUnmountedPoseInput {
  readonly authoritativeGrounded: boolean;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly localTraversalPose: LocalTraversalPoseSnapshot;
  readonly positionBlendAlpha: number;
  readonly syncAuthoritativeLook?: boolean;
  readonly yawBlendAlpha: number;
}

export interface SyncAuthoritativeLocalPlayerPoseInput {
  readonly applyAuthoritativeUnmountedPose: (
    input: ApplyAuthoritativeUnmountedPoseInput
  ) => void;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly authoritativePlayerApplicationSnapshot?: AuthoritativeLocalPlayerPoseSnapshot;
  readonly authoritativeSnapshotAgeMs: number | null;
  readonly authoritativeSnapshotSequence: number | null;
  readonly authoritativeTick: number | null;
  readonly createLocalAuthorityPoseCorrectionSnapshot: (input: {
    readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
    readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
    readonly localIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null;
    readonly localSwimBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["swimBody"] | null;
    readonly localTraversalPose: LocalTraversalPoseSnapshot;
  }) => LocalAuthorityPoseCorrectionSnapshot;
  readonly convergenceMaxPositionStepMeters: number;
  readonly convergenceMaxYawStepRadians: number;
  readonly convergenceSettlePlanarDistanceMeters: number;
  readonly convergenceSettleVerticalDistanceMeters: number;
  readonly convergenceSettleYawRadians: number;
  readonly convergenceStartPlanarDistanceMeters: number;
  readonly convergenceStartVerticalDistanceMeters: number;
  readonly convergenceStartYawRadians: number;
  readonly historicalLocalSampleMatched?: boolean | null;
  readonly historicalLocalSampleSelectionReason?:
    | LocalAuthorityPoseHistoricalLocalSampleSelectionReason
    | null;
  readonly historicalLocalSampleTimeDeltaMs?: number | null;
  readonly forceSnap?: boolean;
  readonly forceSnapIntentionalDiscontinuityCause?:
    | LocalAuthorityPoseIntentionalDiscontinuityCause
    | null;
  readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
  readonly localIssuedTraversalIntentSnapshot?: MetaverseIssuedTraversalIntentSnapshot | null;
  readonly localTraversalAuthoritySnapshot?: MetaverseTraversalAuthoritySnapshot | null;
  readonly localSwimBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["swimBody"] | null;
  readonly localGrounded: boolean | null;
  readonly localTraversalApplicationPose?: LocalTraversalPoseSnapshot;
  readonly localTraversalPose: LocalTraversalPoseSnapshot | null;
  readonly syncAuthoritativeLook?: boolean;
}

export interface AuthoritativeLocalPlayerPoseSyncOptions {
  readonly forceSnap?: boolean;
  readonly intentionalDiscontinuityCause?:
    | LocalAuthorityPoseIntentionalDiscontinuityCause
    | null;
  readonly syncAuthoritativeLook?: boolean;
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let wrappedValue = rawValue;

  while (wrappedValue > Math.PI) {
    wrappedValue -= Math.PI * 2;
  }

  while (wrappedValue <= -Math.PI) {
    wrappedValue += Math.PI * 2;
  }

  return wrappedValue;
}

function resolveBoundedConvergenceBlendAlpha(
  magnitude: number,
  maxStep: number
): number {
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return 1;
  }

  if (!Number.isFinite(maxStep) || maxStep <= 0) {
    return 0;
  }

  return Math.min(1, maxStep / magnitude);
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function resolveIssuedJumpActionSequence(
  localIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null
): number {
  if (localIssuedTraversalIntentSnapshot?.actionIntent.kind !== "jump") {
    return 0;
  }

  return normalizePositiveInteger(
    localIssuedTraversalIntentSnapshot.actionIntent.sequence
  );
}

function resolveLocalPredictedJumpActionSequence({
  localIssuedTraversalIntentSnapshot,
  localTraversalAuthoritySnapshot
}: {
  readonly localIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null;
  readonly localTraversalAuthoritySnapshot: MetaverseTraversalAuthoritySnapshot | null;
}): number {
  const issuedJumpActionSequence = resolveIssuedJumpActionSequence(
    localIssuedTraversalIntentSnapshot
  );

  if (issuedJumpActionSequence > 0) {
    return issuedJumpActionSequence;
  }

  if (localTraversalAuthoritySnapshot?.currentActionKind !== "jump") {
    return 0;
  }

  return normalizePositiveInteger(
    localTraversalAuthoritySnapshot.currentActionSequence
  );
}

function shouldForceRejectedLocalJumpCorrection({
  authoritativePlayerSnapshot,
  localGroundedBodySnapshot,
  localIssuedTraversalIntentSnapshot,
  localTraversalAuthoritySnapshot,
  localTraversalPose
}: {
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
  readonly localIssuedTraversalIntentSnapshot: MetaverseIssuedTraversalIntentSnapshot | null;
  readonly localTraversalAuthoritySnapshot: MetaverseTraversalAuthoritySnapshot | null;
  readonly localTraversalPose: LocalTraversalPoseSnapshot | null;
}): boolean {
  if (
    localTraversalPose?.locomotionMode !== "grounded" ||
    localGroundedBodySnapshot?.grounded !== false
  ) {
    return false;
  }

  const issuedJumpActionSequence = resolveLocalPredictedJumpActionSequence({
    localIssuedTraversalIntentSnapshot,
    localTraversalAuthoritySnapshot
  });

  if (issuedJumpActionSequence <= 0) {
    return false;
  }

  if (
    hasMetaverseTraversalAuthorityRejectedAction(
      authoritativePlayerSnapshot.traversalAuthority,
      "jump",
      issuedJumpActionSequence
    )
  ) {
    return true;
  }

  if (localIssuedTraversalIntentSnapshot === null) {
    return false;
  }

  const authoritativeProcessedIssuedInput =
    authoritativePlayerSnapshot.lastProcessedTraversalSequence >=
    localIssuedTraversalIntentSnapshot.sequence;

  if (!authoritativeProcessedIssuedInput) {
    return false;
  }

  if (
    readMetaverseTraversalAuthorityLatestActionSequence(
      authoritativePlayerSnapshot.traversalAuthority,
      "jump"
    ) < issuedJumpActionSequence
  ) {
    return false;
  }

  if (
    hasMetaverseTraversalAuthorityConsumedAction(
      authoritativePlayerSnapshot.traversalAuthority,
      "jump",
      issuedJumpActionSequence
    ) ||
    isMetaverseTraversalAuthorityActionPendingOrActive(
      authoritativePlayerSnapshot.traversalAuthority,
      "jump",
      issuedJumpActionSequence
    )
  ) {
    return false;
  }

  return (
    authoritativePlayerSnapshot.traversalAuthority.currentActionKind === "none"
  );
}

export class MetaverseLocalAuthorityReconciliationState {
  #latestAuthoritativeCorrectionTelemetrySnapshot =
    createDefaultAuthoritativeCorrectionTelemetrySnapshot();
  #lastLocalAuthorityPoseConvergenceEpisodeStarted = false;
  #localAuthorityPoseConvergenceEpisodeCount = 0;
  #localAuthorityPoseConvergenceStepCount = 0;
  #lastLocalAuthorityPoseCorrectionDetail =
    createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
  #lastLocalAuthorityPoseCorrectionSnapshot =
    createDefaultLocalAuthorityPoseCorrectionSnapshot();
  #lastLocalAuthorityPoseCorrectionReason: LocalAuthorityPoseCorrectionReason =
    "none";
  #pendingIntentionalDiscontinuityCause: LocalAuthorityPoseIntentionalDiscontinuityCause =
    "none";
  #localAuthorityPoseConvergenceEpisodeStartIntentionalDiscontinuityCause:
    LocalAuthorityPoseIntentionalDiscontinuityCause = "none";
  #localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleMatched:
    | boolean
    | null = null;
  #localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleSelectionReason:
    | LocalAuthorityPoseHistoricalLocalSampleSelectionReason
    | null = null;
  #localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs:
    | number
    | null = null;
  #localAuthorityPoseConvergenceEpisodeStartPlanarMagnitudeMeters:
    | number
    | null = null;
  #localAuthorityPoseConvergenceEpisodeStartReason: LocalAuthorityPoseCorrectionReason =
    "none";
  #localAuthorityPoseConvergenceEpisodeStartVerticalMagnitudeMeters:
    | number
    | null = null;
  #localAuthorityPoseConvergenceEpisodeStartYawMagnitudeRadians:
    | number
    | null = null;
  #localAuthorityPoseConvergenceActive = false;

  get authoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
    return this.#latestAuthoritativeCorrectionTelemetrySnapshot;
  }

  get lastLocalAuthorityPoseConvergenceEpisodeStarted(): boolean {
    return this.#lastLocalAuthorityPoseConvergenceEpisodeStarted;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#localAuthorityPoseConvergenceStepCount;
  }

  get localAuthorityPoseConvergenceEpisodeCount(): number {
    return this.#localAuthorityPoseConvergenceEpisodeCount;
  }

  get localAuthorityPoseConvergenceStepCount(): number {
    return this.#localAuthorityPoseConvergenceStepCount;
  }

  get lastLocalAuthorityPoseCorrectionDetail(): LocalAuthorityPoseCorrectionDetailSnapshot {
    return this.#lastLocalAuthorityPoseCorrectionDetail;
  }

  get lastLocalAuthorityPoseCorrectionSnapshot(): LocalAuthorityPoseCorrectionSnapshot {
    return this.#lastLocalAuthorityPoseCorrectionSnapshot;
  }

  get lastLocalAuthorityPoseCorrectionReason(): LocalAuthorityPoseCorrectionReason {
    return this.#lastLocalAuthorityPoseCorrectionReason;
  }

  noteIntentionalDiscontinuity(
    cause: LocalAuthorityPoseIntentionalDiscontinuityCause
  ): void {
    this.#pendingIntentionalDiscontinuityCause = cause;
  }

  reset(): void {
    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createDefaultAuthoritativeCorrectionTelemetrySnapshot();
    this.#lastLocalAuthorityPoseConvergenceEpisodeStarted = false;
    this.#localAuthorityPoseConvergenceEpisodeCount = 0;
    this.#localAuthorityPoseConvergenceStepCount = 0;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
    this.#lastLocalAuthorityPoseCorrectionSnapshot =
      createDefaultLocalAuthorityPoseCorrectionSnapshot();
    this.#lastLocalAuthorityPoseCorrectionReason = "none";
    this.#pendingIntentionalDiscontinuityCause = "none";
    this.#localAuthorityPoseConvergenceEpisodeStartIntentionalDiscontinuityCause =
      "none";
    this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleMatched =
      null;
    this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleSelectionReason =
      null;
    this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs =
      null;
    this.#localAuthorityPoseConvergenceEpisodeStartPlanarMagnitudeMeters = null;
    this.#localAuthorityPoseConvergenceEpisodeStartReason = "none";
    this.#localAuthorityPoseConvergenceEpisodeStartVerticalMagnitudeMeters = null;
    this.#localAuthorityPoseConvergenceEpisodeStartYawMagnitudeRadians = null;
    this.#localAuthorityPoseConvergenceActive = false;
  }

  syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose,
    authoritativePlayerApplicationSnapshot,
    authoritativePlayerSnapshot,
    authoritativeSnapshotAgeMs,
    authoritativeSnapshotSequence,
    authoritativeTick,
    createLocalAuthorityPoseCorrectionSnapshot,
    convergenceMaxPositionStepMeters,
    convergenceMaxYawStepRadians,
    convergenceSettlePlanarDistanceMeters,
    convergenceSettleVerticalDistanceMeters,
    convergenceSettleYawRadians,
    convergenceStartPlanarDistanceMeters,
    convergenceStartVerticalDistanceMeters,
    convergenceStartYawRadians,
    forceSnap = false,
    forceSnapIntentionalDiscontinuityCause = null,
    historicalLocalSampleMatched = null,
    historicalLocalSampleSelectionReason = null,
    historicalLocalSampleTimeDeltaMs = null,
    localGroundedBodySnapshot,
    localIssuedTraversalIntentSnapshot = null,
    localTraversalAuthoritySnapshot = null,
    localSwimBodySnapshot,
    localGrounded,
    localTraversalApplicationPose,
    localTraversalPose,
    syncAuthoritativeLook = false
  }: SyncAuthoritativeLocalPlayerPoseInput): boolean {
    this.#lastLocalAuthorityPoseConvergenceEpisodeStarted = false;
    const keepMountedOccupancyFreeRoam =
      shouldKeepMetaverseMountedOccupancyFreeRoam(
        authoritativePlayerSnapshot.mountedOccupancy
      );

    if (
      (authoritativePlayerSnapshot.mountedOccupancy !== null &&
        !keepMountedOccupancyFreeRoam) ||
      authoritativePlayerSnapshot.locomotionMode === "mounted" ||
      localTraversalPose === null
    ) {
      this.#localAuthorityPoseConvergenceActive = false;
      return false;
    }

    const authoritativeActiveBodySnapshot =
      readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
        authoritativePlayerSnapshot
      );
    const planarDistance = Math.hypot(
      authoritativeActiveBodySnapshot.position.x - localTraversalPose.position.x,
      authoritativeActiveBodySnapshot.position.z - localTraversalPose.position.z
    );
    const verticalDistance = Math.abs(
      authoritativeActiveBodySnapshot.position.y - localTraversalPose.position.y
    );
    const authoritativeGrounded =
      isMetaverseTraversalAuthorityGroundedLocomotion({
        locomotionMode:
          authoritativePlayerSnapshot.locomotionMode === "swim"
            ? "swim"
            : "grounded",
        mounted:
          authoritativePlayerSnapshot.mountedOccupancy !== null &&
          !keepMountedOccupancyFreeRoam,
        traversalAuthority: authoritativePlayerSnapshot.traversalAuthority
      });
    const divergenceDiagnostics = resolveLocalAuthorityPoseDivergenceDiagnostics({
      authoritativeGroundedBody:
        authoritativePlayerSnapshot.locomotionMode === "grounded"
          ? authoritativePlayerSnapshot.groundedBody
          : null,
      authoritativeLinearVelocity: authoritativeActiveBodySnapshot.linearVelocity,
      authoritativeLocomotionMode: authoritativePlayerSnapshot.locomotionMode,
      authoritativeSwimBody:
        authoritativePlayerSnapshot.locomotionMode === "swim"
          ? authoritativePlayerSnapshot.swimBody
          : null,
      localGroundedBody: localGroundedBodySnapshot,
      localLinearVelocity: localTraversalPose.linearVelocity,
      localLocomotionMode: localTraversalPose.locomotionMode,
      localSwimBody: localSwimBodySnapshot
    });
    const positionDistance = Math.hypot(planarDistance, verticalDistance);
    const yawDistance = Math.abs(
      wrapRadians(
        authoritativeActiveBodySnapshot.yawRadians -
          localTraversalPose.yawRadians
      )
    );
    const convergenceDecision = resolveLocalAuthorityPoseConvergenceDecision({
      convergenceActive: this.#localAuthorityPoseConvergenceActive,
      convergenceSettlePlanarDistanceMeters,
      convergenceSettleVerticalDistanceMeters,
      convergenceSettleYawRadians,
      convergenceStartPlanarDistanceMeters,
      convergenceStartVerticalDistanceMeters,
      convergenceStartYawRadians,
      planarDistance,
      verticalDistance,
      yawDistance
    });

    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createAuthoritativeCorrectionTelemetrySnapshot(
        localTraversalPose,
        Object.freeze({
          locomotionMode: authoritativePlayerSnapshot.locomotionMode,
          position: authoritativeActiveBodySnapshot.position
        }),
        false
      );

    const shouldForceCorrection =
      forceSnap ||
      shouldForceRejectedLocalJumpCorrection({
        authoritativePlayerSnapshot,
        localGroundedBodySnapshot,
        localIssuedTraversalIntentSnapshot,
        localTraversalAuthoritySnapshot,
        localTraversalPose
      });

    if (
      shouldForceCorrection &&
      forceSnap &&
      forceSnapIntentionalDiscontinuityCause !== null
    ) {
      this.#pendingIntentionalDiscontinuityCause =
        forceSnapIntentionalDiscontinuityCause;
    }

    if (!shouldForceCorrection && !convergenceDecision.shouldConvergePose) {
      this.#pendingIntentionalDiscontinuityCause = "none";
      this.#localAuthorityPoseConvergenceActive = false;
      return false;
    }

    const correctionReason = resolveLocalAuthorityPoseCorrectionReason({
      bodyStateDivergence: divergenceDiagnostics.bodyStateDivergence,
      grossPositionDivergence: convergenceDecision.grossPositionDivergence,
      grossYawDivergence: convergenceDecision.grossYawDivergence
    });

    if (shouldForceCorrection) {
      this.#localAuthorityPoseConvergenceActive = false;
    }

    const convergenceEpisodeStarted = !this.#localAuthorityPoseConvergenceActive;
    this.#localAuthorityPoseConvergenceActive = true;
    this.#lastLocalAuthorityPoseConvergenceEpisodeStarted =
      convergenceEpisodeStarted;

    if (convergenceEpisodeStarted) {
      this.#localAuthorityPoseConvergenceEpisodeCount += 1;
      this.#localAuthorityPoseConvergenceEpisodeStartIntentionalDiscontinuityCause =
        this.#pendingIntentionalDiscontinuityCause;
      this.#pendingIntentionalDiscontinuityCause = "none";
      this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleMatched =
        historicalLocalSampleMatched;
      this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleSelectionReason =
        historicalLocalSampleSelectionReason;
      this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs =
        historicalLocalSampleTimeDeltaMs;
      this.#localAuthorityPoseConvergenceEpisodeStartPlanarMagnitudeMeters =
        planarDistance;
      this.#localAuthorityPoseConvergenceEpisodeStartReason = correctionReason;
      this.#localAuthorityPoseConvergenceEpisodeStartVerticalMagnitudeMeters =
        verticalDistance;
      this.#localAuthorityPoseConvergenceEpisodeStartYawMagnitudeRadians =
        yawDistance;
    }

    this.#localAuthorityPoseConvergenceStepCount += 1;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createLocalAuthorityPoseCorrectionDetailSnapshot({
        authoritativeGrounded:
          authoritativePlayerSnapshot.locomotionMode === "grounded"
            ? authoritativeGrounded
            : null,
        authoritativeLinearVelocity:
          authoritativeActiveBodySnapshot.linearVelocity,
        authoritativePosition: authoritativeActiveBodySnapshot.position,
        authoritativeSnapshotAgeMs,
        authoritativeSnapshotSequence,
        authoritativeTick,
        bodyStateDivergence: divergenceDiagnostics.bodyStateDivergence,
        convergenceEpisodeStarted,
        convergenceEpisodeStartIntentionalDiscontinuityCause:
          this.#localAuthorityPoseConvergenceEpisodeStartIntentionalDiscontinuityCause,
        convergenceEpisodeStartHistoricalLocalSampleMatched:
          this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleMatched,
        convergenceEpisodeStartHistoricalLocalSampleSelectionReason:
          this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleSelectionReason,
        convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs:
          this.#localAuthorityPoseConvergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
        convergenceEpisodeStartPlanarMagnitudeMeters:
          this.#localAuthorityPoseConvergenceEpisodeStartPlanarMagnitudeMeters,
        convergenceEpisodeStartReason:
          this.#localAuthorityPoseConvergenceEpisodeStartReason,
        convergenceEpisodeStartVerticalMagnitudeMeters:
          this.#localAuthorityPoseConvergenceEpisodeStartVerticalMagnitudeMeters,
        convergenceEpisodeStartYawMagnitudeRadians:
          this.#localAuthorityPoseConvergenceEpisodeStartYawMagnitudeRadians,
        groundedBodyStateDivergence:
          divergenceDiagnostics.groundedBodyStateDivergence,
        lastProcessedTraversalSequence:
          authoritativePlayerSnapshot.lastProcessedTraversalSequence ?? null,
        localGrounded,
        localTraversalPose,
      });
    this.#lastLocalAuthorityPoseCorrectionSnapshot =
      createLocalAuthorityPoseCorrectionSnapshot({
        authoritativePlayerSnapshot,
        localGroundedBodySnapshot,
        localIssuedTraversalIntentSnapshot,
        localSwimBodySnapshot,
        localTraversalPose
      });
    this.#lastLocalAuthorityPoseCorrectionReason =
      correctionReason;
    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createAuthoritativeCorrectionTelemetrySnapshot(
        localTraversalPose,
        Object.freeze({
          locomotionMode: authoritativePlayerSnapshot.locomotionMode,
          position: authoritativeActiveBodySnapshot.position
        }),
        true
      );

    applyAuthoritativeUnmountedPose({
      authoritativeGrounded,
      authoritativePlayerSnapshot:
        authoritativePlayerApplicationSnapshot ?? authoritativePlayerSnapshot,
      localTraversalPose: localTraversalApplicationPose ?? localTraversalPose,
      positionBlendAlpha: shouldForceCorrection
        ? 1
        : resolveBoundedConvergenceBlendAlpha(
            positionDistance,
            convergenceMaxPositionStepMeters
          ),
      syncAuthoritativeLook,
      yawBlendAlpha: shouldForceCorrection
        ? 1
        : resolveBoundedConvergenceBlendAlpha(
            yawDistance,
            convergenceMaxYawStepRadians
          )
    });

    return true;
  }
}
