import type { PhysicsVector3Snapshot } from "@/physics";
import type { MetaverseRealtimePlayerSnapshot } from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalActionStateSnapshot,
  type MetaverseTraversalAuthoritySnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type { MetaverseTelemetrySnapshot } from "../../types/telemetry";

export type AuthoritativeCorrectionTelemetrySnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["surfaceRouting"]["authoritativeCorrection"];
export type LocalAuthorityPoseCorrectionReason =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionReason"];
export type LocalAuthorityPoseCorrectionDetailSnapshot =
  MetaverseTelemetrySnapshot["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"];

export interface LocalTraversalPoseSnapshot {
  readonly locomotionMode: "grounded" | "swim";
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface CorrectionTargetPoseSnapshot {
  readonly locomotionMode: MetaverseRealtimePlayerSnapshot["locomotionMode"];
  readonly position: PhysicsVector3Snapshot;
}

export interface ResolveLocalAuthorityPoseCorrectionDecisionInput {
  readonly authoritativeLocomotionMode: CorrectionTargetPoseSnapshot["locomotionMode"];
  readonly hardSnapDistanceMeters: number;
  readonly localLocomotionMode: LocalTraversalPoseSnapshot["locomotionMode"];
  readonly positionDistance: number;
  readonly verticalDistance: number;
}

export interface LocalAuthorityPoseCorrectionDecision {
  readonly grossPositionDivergence: boolean;
  readonly locomotionMismatch: boolean;
  readonly shouldSnapCorrection: boolean;
}

export interface ShouldSuppressRoutineGroundedCorrectionInput {
  readonly authoritativeGrounded: boolean;
  readonly hardSnapDistanceMeters: number;
  readonly localGrounded: boolean;
  readonly locomotionMismatch: boolean;
  readonly positionDistance: number;
  readonly preserveLocalGroundedContinuity: boolean;
}

export interface ShouldSuppressRoutineGroundedCorrectionForIssuedTraversalActionInput
  extends Omit<
    ShouldSuppressRoutineGroundedCorrectionInput,
    "preserveLocalGroundedContinuity"
  > {
  readonly actionState: MetaverseTraversalActionStateSnapshot;
  readonly currentTick: number;
  readonly issuedTraversalActionSequence: number;
  readonly localTraversalActionAuthority: MetaverseTraversalAuthoritySnapshot;
  readonly localTraversalAction: MetaverseTraversalActiveActionSnapshot;
}

interface LocalAuthorityPoseCorrectionReasonFlags {
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
    localGrounded: null,
    planarMagnitudeMeters: null,
    verticalMagnitudeMeters: null
  });
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
  authoritativeGrounded: boolean | null
): LocalAuthorityPoseCorrectionDetailSnapshot {
  return Object.freeze({
    authoritativeGrounded,
    localGrounded,
    planarMagnitudeMeters: Math.hypot(
      authoritativePosition.x - localTraversalPose.position.x,
      authoritativePosition.z - localTraversalPose.position.z
    ),
    verticalMagnitudeMeters: Math.abs(
      authoritativePosition.y - localTraversalPose.position.y
    )
  });
}

export function resolveLocalAuthorityPoseCorrectionReason({
  grossPositionDivergence
}: LocalAuthorityPoseCorrectionReasonFlags): LocalAuthorityPoseCorrectionReason {
  if (grossPositionDivergence) {
    return "gross-position-divergence";
  }

  return "none";
}

export function resolveLocalAuthorityPoseCorrectionDecision({
  authoritativeLocomotionMode,
  hardSnapDistanceMeters,
  localLocomotionMode,
  positionDistance,
  verticalDistance
}: ResolveLocalAuthorityPoseCorrectionDecisionInput): LocalAuthorityPoseCorrectionDecision {
  const locomotionMismatch =
    authoritativeLocomotionMode !== localLocomotionMode;
  const grossPositionDivergence =
    Math.hypot(positionDistance, verticalDistance) >=
    hardSnapDistanceMeters;

  return Object.freeze({
    grossPositionDivergence,
    locomotionMismatch,
    shouldSnapCorrection: grossPositionDivergence
  });
}

export function shouldSuppressRoutineGroundedCorrection({
  authoritativeGrounded,
  hardSnapDistanceMeters,
  localGrounded,
  locomotionMismatch,
  positionDistance,
  preserveLocalGroundedContinuity
}: ShouldSuppressRoutineGroundedCorrectionInput): boolean {
  return (
    !locomotionMismatch &&
    authoritativeGrounded &&
    !localGrounded &&
    preserveLocalGroundedContinuity &&
    positionDistance < hardSnapDistanceMeters
  );
}

export function shouldSuppressRoutineGroundedCorrectionForIssuedTraversalAction({
  actionState,
  authoritativeGrounded,
  currentTick,
  hardSnapDistanceMeters,
  issuedTraversalActionSequence,
  localGrounded,
  localTraversalActionAuthority,
  localTraversalAction,
  locomotionMismatch,
  positionDistance
}: ShouldSuppressRoutineGroundedCorrectionForIssuedTraversalActionInput): boolean {
  return shouldSuppressRoutineGroundedCorrection({
    authoritativeGrounded,
    hardSnapDistanceMeters,
    localGrounded,
    locomotionMismatch,
    positionDistance,
    preserveLocalGroundedContinuity:
      hasMetaverseTraversalAuthorityLocallyPredictedIssuedAction({
        activeAction: localTraversalAction,
        actionState,
        currentTick,
        issuedActionKind: "jump",
        issuedActionSequence: issuedTraversalActionSequence,
        locomotionMode: "grounded",
        mounted: false,
        previousTraversalAuthority: localTraversalActionAuthority
      })
  });
}
