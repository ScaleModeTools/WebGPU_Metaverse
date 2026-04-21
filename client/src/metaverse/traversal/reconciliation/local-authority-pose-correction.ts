import type { PhysicsVector3Snapshot } from "@/physics";
import type {
  MetaverseRealtimePlayerSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseTelemetrySnapshot } from "../../types/telemetry";
import type { MetaverseIssuedTraversalIntentSnapshot } from "../types/traversal";

export type AuthoritativeCorrectionTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeCorrection"];
export type LocalAuthorityPoseCorrectionReason =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionReason"];
export type LocalAuthorityPoseIntentionalDiscontinuityCause =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"]["convergenceEpisodeStartIntentionalDiscontinuityCause"];
export type LocalAuthorityPoseHistoricalLocalSampleSelectionReason =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"]["convergenceEpisodeStartHistoricalLocalSampleSelectionReason"];
export type LocalAuthorityPoseCorrectionDetailSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"];
export type LocalAuthorityPoseCorrectionSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"];

type CorrectionGroundedBodySnapshot =
  MetaverseRealtimePlayerSnapshot["groundedBody"];
type CorrectionSwimBodySnapshot =
  MetaverseRealtimePlayerSnapshot["swimBody"];
type CorrectionLinearVelocitySnapshot =
  MetaverseRealtimePlayerSnapshot["groundedBody"]["linearVelocity"];

const localAuthorityPlanarVelocityDivergenceToleranceUnitsPerSecond = 1.5;
const localAuthorityVerticalVelocityDivergenceToleranceUnitsPerSecond = 1;
const localAuthorityDriveAxisDivergenceTolerance = 0.2;
const localAuthorityDriveSpeedDivergenceToleranceUnitsPerSecond = 1;

export interface LocalTraversalPoseSnapshot {
  readonly locomotionMode: "grounded" | "swim";
  readonly linearVelocity: PhysicsVector3Snapshot;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface PredictedLocalReconciliationSample {
  readonly groundedBody: CorrectionGroundedBodySnapshot | null;
  readonly inputSequence: number;
  readonly issuedTraversalIntent: MetaverseIssuedTraversalIntentSnapshot | null;
  readonly localGrounded: boolean | null;
  readonly localPredictionTick: number;
  readonly localWallClockMs: number;
  readonly pose: LocalTraversalPoseSnapshot;
  readonly swimBody: CorrectionSwimBodySnapshot | null;
  readonly traversalSampleId: number;
  readonly traversalOrientationSequence: number;
}

export interface CorrectionTargetPoseSnapshot {
  readonly locomotionMode: MetaverseRealtimePlayerSnapshot["locomotionMode"];
  readonly position: PhysicsVector3Snapshot;
}

export interface ResolveLocalAuthorityPoseDivergenceDiagnosticsInput {
  readonly authoritativeGroundedBody: CorrectionGroundedBodySnapshot | null;
  readonly authoritativeLinearVelocity: CorrectionLinearVelocitySnapshot;
  readonly authoritativeLocomotionMode: CorrectionTargetPoseSnapshot["locomotionMode"];
  readonly authoritativeSwimBody: CorrectionSwimBodySnapshot | null;
  readonly localGroundedBody: CorrectionGroundedBodySnapshot | null;
  readonly localLinearVelocity: CorrectionLinearVelocitySnapshot;
  readonly localLocomotionMode: LocalTraversalPoseSnapshot["locomotionMode"];
  readonly localSwimBody: CorrectionSwimBodySnapshot | null;
}

export interface LocalAuthorityPoseDivergenceDiagnostics {
  readonly bodyStateDivergence: boolean;
  readonly groundedBodyStateDivergence: boolean;
  readonly locomotionMismatch: boolean;
  readonly planarVelocityDivergence: boolean;
  readonly verticalVelocityDivergence: boolean;
}

export interface ResolveLocalAuthorityPoseConvergenceDecisionInput {
  readonly convergenceActive: boolean;
  readonly convergenceSettlePlanarDistanceMeters: number;
  readonly convergenceSettleVerticalDistanceMeters: number;
  readonly convergenceSettleYawRadians: number;
  readonly convergenceStartPlanarDistanceMeters: number;
  readonly convergenceStartVerticalDistanceMeters: number;
  readonly convergenceStartYawRadians: number;
  readonly planarDistance: number;
  readonly verticalDistance: number;
  readonly yawDistance: number;
}

export interface LocalAuthorityPoseConvergenceDecision {
  readonly grossPositionDivergence: boolean;
  readonly grossYawDivergence: boolean;
  readonly shouldConvergePose: boolean;
}

interface LocalAuthorityPoseCorrectionReasonFlags {
  readonly bodyStateDivergence: boolean;
  readonly grossPositionDivergence: boolean;
  readonly grossYawDivergence: boolean;
}

export function createDefaultAuthoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
  return Object.freeze({
    applied: false,
    locomotionMismatch: false,
    planarMagnitudeMeters: 0,
    verticalMagnitudeMeters: 0
  });
}

export function createDefaultLocalAuthorityPoseCorrectionDetailSnapshot(): LocalAuthorityPoseCorrectionDetailSnapshot {
  return Object.freeze({
    authoritativeSnapshotAgeMs: null,
    authoritativeSnapshotSequence: null,
    authoritativeTick: null,
    authoritativeGrounded: null,
    bodyStateDivergence: null,
    convergenceEpisodeStarted: false,
    convergenceEpisodeStartIntentionalDiscontinuityCause: "none",
    convergenceEpisodeStartHistoricalLocalSampleMatched: null,
    convergenceEpisodeStartHistoricalLocalSampleSelectionReason: null,
    convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs: null,
    convergenceEpisodeStartPlanarMagnitudeMeters: null,
    convergenceEpisodeStartReason: "none",
    convergenceEpisodeStartVerticalMagnitudeMeters: null,
    convergenceEpisodeStartYawMagnitudeRadians: null,
    groundedBodyStateDivergence: null,
    lastProcessedInputSequence: null,
    lastProcessedTraversalOrientationSequence: null,
    localGrounded: null,
    planarMagnitudeMeters: null,
    planarVelocityMagnitudeUnitsPerSecond: null,
    verticalMagnitudeMeters: null,
    verticalVelocityMagnitudeUnitsPerSecond: null
  });
}

export function createDefaultLocalAuthorityPoseCorrectionSnapshot(): LocalAuthorityPoseCorrectionSnapshot {
  return null;
}

export function createAuthoritativeCorrectionTelemetrySnapshot(
  localTraversalPose: LocalTraversalPoseSnapshot,
  correctionTargetPose: CorrectionTargetPoseSnapshot,
  applied: boolean
): AuthoritativeCorrectionTelemetrySnapshot {
  return Object.freeze({
    applied,
    locomotionMismatch:
      correctionTargetPose.locomotionMode !== localTraversalPose.locomotionMode,
    planarMagnitudeMeters: Math.hypot(
      correctionTargetPose.position.x - localTraversalPose.position.x,
      correctionTargetPose.position.z - localTraversalPose.position.z
    ),
    verticalMagnitudeMeters: Math.abs(
      correctionTargetPose.position.y - localTraversalPose.position.y
    )
  });
}

export function createLocalAuthorityPoseCorrectionDetailSnapshot({
  authoritativeGrounded,
  authoritativeLinearVelocity,
  authoritativePosition,
  authoritativeSnapshotAgeMs,
  authoritativeSnapshotSequence,
  authoritativeTick,
  bodyStateDivergence,
  convergenceEpisodeStarted,
  convergenceEpisodeStartIntentionalDiscontinuityCause,
  convergenceEpisodeStartHistoricalLocalSampleMatched,
  convergenceEpisodeStartHistoricalLocalSampleSelectionReason,
  convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
  convergenceEpisodeStartPlanarMagnitudeMeters,
  convergenceEpisodeStartReason,
  convergenceEpisodeStartVerticalMagnitudeMeters,
  convergenceEpisodeStartYawMagnitudeRadians,
  groundedBodyStateDivergence,
  lastProcessedInputSequence,
  lastProcessedTraversalOrientationSequence,
  localGrounded,
  localTraversalPose
}: {
  readonly authoritativeGrounded: boolean | null;
  readonly authoritativeLinearVelocity: CorrectionLinearVelocitySnapshot;
  readonly authoritativePosition: PhysicsVector3Snapshot;
  readonly authoritativeSnapshotAgeMs: number | null;
  readonly authoritativeSnapshotSequence: number | null;
  readonly authoritativeTick: number | null;
  readonly bodyStateDivergence: boolean;
  readonly convergenceEpisodeStarted: boolean;
  readonly convergenceEpisodeStartIntentionalDiscontinuityCause: LocalAuthorityPoseIntentionalDiscontinuityCause;
  readonly convergenceEpisodeStartHistoricalLocalSampleMatched: boolean | null;
  readonly convergenceEpisodeStartHistoricalLocalSampleSelectionReason: LocalAuthorityPoseHistoricalLocalSampleSelectionReason;
  readonly convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs:
    | number
    | null;
  readonly convergenceEpisodeStartPlanarMagnitudeMeters: number | null;
  readonly convergenceEpisodeStartReason: LocalAuthorityPoseCorrectionReason;
  readonly convergenceEpisodeStartVerticalMagnitudeMeters: number | null;
  readonly convergenceEpisodeStartYawMagnitudeRadians: number | null;
  readonly groundedBodyStateDivergence: boolean;
  readonly lastProcessedInputSequence: number | null;
  readonly lastProcessedTraversalOrientationSequence: number | null;
  readonly localGrounded: boolean | null;
  readonly localTraversalPose: LocalTraversalPoseSnapshot;
}): LocalAuthorityPoseCorrectionDetailSnapshot {
  return Object.freeze({
    authoritativeSnapshotAgeMs,
    authoritativeSnapshotSequence,
    authoritativeTick,
    authoritativeGrounded,
    bodyStateDivergence,
    convergenceEpisodeStarted,
    convergenceEpisodeStartIntentionalDiscontinuityCause,
    convergenceEpisodeStartHistoricalLocalSampleMatched,
    convergenceEpisodeStartHistoricalLocalSampleSelectionReason,
    convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs,
    convergenceEpisodeStartPlanarMagnitudeMeters,
    convergenceEpisodeStartReason,
    convergenceEpisodeStartVerticalMagnitudeMeters,
    convergenceEpisodeStartYawMagnitudeRadians,
    groundedBodyStateDivergence,
    lastProcessedInputSequence,
    lastProcessedTraversalOrientationSequence,
    localGrounded,
    planarMagnitudeMeters: Math.hypot(
      authoritativePosition.x - localTraversalPose.position.x,
      authoritativePosition.z - localTraversalPose.position.z
    ),
    planarVelocityMagnitudeUnitsPerSecond: Math.hypot(
      authoritativeLinearVelocity.x - localTraversalPose.linearVelocity.x,
      authoritativeLinearVelocity.z - localTraversalPose.linearVelocity.z
    ),
    verticalMagnitudeMeters: Math.abs(
      authoritativePosition.y - localTraversalPose.position.y
    ),
    verticalVelocityMagnitudeUnitsPerSecond: Math.abs(
      authoritativeLinearVelocity.y - localTraversalPose.linearVelocity.y
    )
  });
}

export function resolveLocalAuthorityPoseCorrectionReason({
  bodyStateDivergence,
  grossPositionDivergence,
  grossYawDivergence
}: LocalAuthorityPoseCorrectionReasonFlags): LocalAuthorityPoseCorrectionReason {
  if (bodyStateDivergence) {
    return "gross-body-divergence";
  }

  if (grossPositionDivergence) {
    return "gross-position-divergence";
  }

  if (grossYawDivergence) {
    return "gross-yaw-divergence";
  }

  return "none";
}

function resolveGroundedBodyStateDivergence(
  authoritativeGroundedBody: CorrectionGroundedBodySnapshot | null,
  localGroundedBody: CorrectionGroundedBodySnapshot | null
): boolean {
  if (authoritativeGroundedBody === null && localGroundedBody === null) {
    return false;
  }

  if (authoritativeGroundedBody === null || localGroundedBody === null) {
    return true;
  }

  return (
    authoritativeGroundedBody.contact.supportingContactDetected !==
      localGroundedBody.contact.supportingContactDetected ||
    authoritativeGroundedBody.contact.blockedVerticalMovement !==
      localGroundedBody.contact.blockedVerticalMovement ||
    authoritativeGroundedBody.interaction.applyImpulsesToDynamicBodies !==
      localGroundedBody.interaction.applyImpulsesToDynamicBodies ||
    authoritativeGroundedBody.jumpBody.grounded !==
      localGroundedBody.jumpBody.grounded ||
    authoritativeGroundedBody.driveTarget.boost !==
      localGroundedBody.driveTarget.boost ||
    Math.abs(
      authoritativeGroundedBody.driveTarget.moveAxis -
        localGroundedBody.driveTarget.moveAxis
    ) > localAuthorityDriveAxisDivergenceTolerance ||
    Math.abs(
      authoritativeGroundedBody.driveTarget.strafeAxis -
        localGroundedBody.driveTarget.strafeAxis
    ) > localAuthorityDriveAxisDivergenceTolerance ||
    Math.abs(
      authoritativeGroundedBody.driveTarget.targetForwardSpeedUnitsPerSecond -
        localGroundedBody.driveTarget.targetForwardSpeedUnitsPerSecond
    ) > localAuthorityDriveSpeedDivergenceToleranceUnitsPerSecond ||
    Math.abs(
      authoritativeGroundedBody.driveTarget.targetStrafeSpeedUnitsPerSecond -
        localGroundedBody.driveTarget.targetStrafeSpeedUnitsPerSecond
    ) > localAuthorityDriveSpeedDivergenceToleranceUnitsPerSecond
  );
}

function resolveSwimBodyStateDivergence(
  authoritativeSwimBody: CorrectionSwimBodySnapshot | null,
  localSwimBody: CorrectionSwimBodySnapshot | null
): boolean {
  if (authoritativeSwimBody === null && localSwimBody === null) {
    return false;
  }

  if (authoritativeSwimBody === null || localSwimBody === null) {
    return true;
  }

  return (
    Math.abs(
      authoritativeSwimBody.driveTarget.moveAxis -
        localSwimBody.driveTarget.moveAxis
    ) > localAuthorityDriveAxisDivergenceTolerance ||
    Math.abs(
      authoritativeSwimBody.driveTarget.strafeAxis -
        localSwimBody.driveTarget.strafeAxis
    ) > localAuthorityDriveAxisDivergenceTolerance ||
    Math.abs(
      authoritativeSwimBody.driveTarget.targetForwardSpeedUnitsPerSecond -
        localSwimBody.driveTarget.targetForwardSpeedUnitsPerSecond
    ) > localAuthorityDriveSpeedDivergenceToleranceUnitsPerSecond ||
    Math.abs(
      authoritativeSwimBody.driveTarget.targetStrafeSpeedUnitsPerSecond -
        localSwimBody.driveTarget.targetStrafeSpeedUnitsPerSecond
    ) > localAuthorityDriveSpeedDivergenceToleranceUnitsPerSecond
  );
}

export function resolveLocalAuthorityPoseDivergenceDiagnostics({
  authoritativeGroundedBody,
  authoritativeLinearVelocity,
  authoritativeLocomotionMode,
  authoritativeSwimBody,
  localGroundedBody,
  localLinearVelocity,
  localLocomotionMode,
  localSwimBody
}: ResolveLocalAuthorityPoseDivergenceDiagnosticsInput): LocalAuthorityPoseDivergenceDiagnostics {
  const locomotionMismatch =
    authoritativeLocomotionMode !== localLocomotionMode;
  const planarVelocityDivergence =
    Math.hypot(
      authoritativeLinearVelocity.x - localLinearVelocity.x,
      authoritativeLinearVelocity.z - localLinearVelocity.z
    ) >= localAuthorityPlanarVelocityDivergenceToleranceUnitsPerSecond;
  const verticalVelocityDivergence =
    Math.abs(authoritativeLinearVelocity.y - localLinearVelocity.y) >=
    localAuthorityVerticalVelocityDivergenceToleranceUnitsPerSecond;
  const groundedBodyStateDivergence = resolveGroundedBodyStateDivergence(
    authoritativeGroundedBody,
    localGroundedBody
  );
  const swimBodyStateDivergence = resolveSwimBodyStateDivergence(
    authoritativeSwimBody,
    localSwimBody
  );
  const bodyStateDivergence =
    locomotionMismatch ||
    groundedBodyStateDivergence ||
    swimBodyStateDivergence;

  return Object.freeze({
    bodyStateDivergence,
    groundedBodyStateDivergence,
    locomotionMismatch,
    planarVelocityDivergence,
    verticalVelocityDivergence
  });
}

export function resolveLocalAuthorityPoseConvergenceDecision({
  convergenceActive,
  convergenceSettlePlanarDistanceMeters,
  convergenceSettleVerticalDistanceMeters,
  convergenceSettleYawRadians,
  convergenceStartPlanarDistanceMeters,
  convergenceStartVerticalDistanceMeters,
  convergenceStartYawRadians,
  planarDistance,
  verticalDistance,
  yawDistance
}: ResolveLocalAuthorityPoseConvergenceDecisionInput): LocalAuthorityPoseConvergenceDecision {
  const grossPlanarDivergence =
    planarDistance >= convergenceStartPlanarDistanceMeters;
  const grossVerticalDivergence =
    verticalDistance >= convergenceStartVerticalDistanceMeters;
  const grossPositionDivergence =
    grossPlanarDivergence || grossVerticalDivergence;
  const grossYawDivergence = yawDistance >= convergenceStartYawRadians;
  const shouldConvergePose =
    grossPositionDivergence ||
    grossYawDivergence ||
    (convergenceActive &&
      (planarDistance > convergenceSettlePlanarDistanceMeters ||
        verticalDistance > convergenceSettleVerticalDistanceMeters ||
        yawDistance > convergenceSettleYawRadians));

  return Object.freeze({
    grossPositionDivergence,
    grossYawDivergence,
    shouldConvergePose
  });
}
