import type { PhysicsVector3Snapshot } from "@/physics";
import type { MetaverseRealtimePlayerSnapshot } from "@webgpu-metaverse/shared/metaverse/realtime";

import type { MetaverseTelemetrySnapshot } from "../../types/telemetry";

export type AuthoritativeCorrectionTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeCorrection"];
export type LocalAuthorityPoseCorrectionReason =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionReason"];
export type LocalAuthorityPoseCorrectionDetailSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"];
export type LocalAuthorityPoseCorrectionSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionSnapshot"];

type CorrectionGroundedBodySnapshot =
  MetaverseRealtimePlayerSnapshot["groundedBody"];
type CorrectionSwimBodySnapshot =
  MetaverseRealtimePlayerSnapshot["swimBody"];
type CorrectionLinearVelocitySnapshot =
  MetaverseRealtimePlayerSnapshot["linearVelocity"];

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
  readonly convergenceSettleDistanceMeters: number;
  readonly convergenceStartDistanceMeters: number;
  readonly planarDistance: number;
  readonly verticalDistance: number;
}

export interface LocalAuthorityPoseConvergenceDecision {
  readonly grossPositionDivergence: boolean;
  readonly shouldConvergePose: boolean;
}

interface LocalAuthorityPoseCorrectionReasonFlags {
  readonly bodyStateDivergence: boolean;
  readonly grossPositionDivergence: boolean;
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
    authoritativeGrounded: null,
    bodyStateDivergence: null,
    groundedBodyStateDivergence: null,
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

export function createLocalAuthorityPoseCorrectionDetailSnapshot(
  localTraversalPose: LocalTraversalPoseSnapshot,
  authoritativePosition: PhysicsVector3Snapshot,
  localGrounded: boolean | null,
  authoritativeGrounded: boolean | null,
  authoritativeLinearVelocity: CorrectionLinearVelocitySnapshot,
  groundedBodyStateDivergence: boolean,
  bodyStateDivergence: boolean
): LocalAuthorityPoseCorrectionDetailSnapshot {
  return Object.freeze({
    authoritativeGrounded,
    bodyStateDivergence,
    groundedBodyStateDivergence,
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
  grossPositionDivergence
}: LocalAuthorityPoseCorrectionReasonFlags): LocalAuthorityPoseCorrectionReason {
  if (bodyStateDivergence) {
    return "gross-body-divergence";
  }

  if (grossPositionDivergence) {
    return "gross-position-divergence";
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
    authoritativeGroundedBody.contact.blockedPlanarMovement !==
      localGroundedBody.contact.blockedPlanarMovement ||
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
    authoritativeSwimBody.contact.blockedPlanarMovement !==
      localSwimBody.contact.blockedPlanarMovement ||
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
  convergenceSettleDistanceMeters,
  convergenceStartDistanceMeters,
  planarDistance,
  verticalDistance
}: ResolveLocalAuthorityPoseConvergenceDecisionInput): LocalAuthorityPoseConvergenceDecision {
  const positionDistance = Math.hypot(planarDistance, verticalDistance);
  const grossPositionDivergence =
    positionDistance >= convergenceStartDistanceMeters;
  const shouldConvergePose =
    grossPositionDivergence ||
    (convergenceActive && positionDistance > convergenceSettleDistanceMeters);

  return Object.freeze({
    grossPositionDivergence,
    shouldConvergePose
  });
}
