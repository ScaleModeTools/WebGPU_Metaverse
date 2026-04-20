import type {
  MetaverseRealtimePlayerSnapshot,
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  isMetaverseTraversalAuthorityGroundedLocomotion
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
  type LocalAuthorityPoseCorrectionReason,
  type LocalTraversalPoseSnapshot
} from "../local-authority-pose-correction";

export interface AuthoritativeLocalPlayerPoseSnapshot
  extends Pick<
    MetaverseRealtimePlayerSnapshot,
    | "groundedBody"
    | "lastProcessedInputSequence"
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "position"
    | "swimBody"
    | "traversalAuthority"
    | "yawRadians"
  > {}

export interface ApplyAuthoritativeUnmountedPoseInput {
  readonly authoritativeGrounded: boolean;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly localTraversalPose: LocalTraversalPoseSnapshot;
  readonly positionBlendAlpha: number;
  readonly yawBlendAlpha: number;
}

export interface SyncAuthoritativeLocalPlayerPoseInput {
  readonly applyAuthoritativeUnmountedPose: (
    input: ApplyAuthoritativeUnmountedPoseInput
  ) => void;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly createLocalAuthorityPoseCorrectionSnapshot: (input: {
    readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
    readonly localTraversalPose: LocalTraversalPoseSnapshot;
  }) => LocalAuthorityPoseCorrectionSnapshot;
  readonly convergenceMaxPositionStepMeters: number;
  readonly convergenceMaxYawStepRadians: number;
  readonly convergenceSettleDistanceMeters: number;
  readonly convergenceStartDistanceMeters: number;
  readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
  readonly localSwimBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["swimBody"] | null;
  readonly localGrounded: boolean | null;
  readonly localTraversalPose: LocalTraversalPoseSnapshot | null;
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

export class MetaverseLocalAuthorityReconciliationState {
  #latestAuthoritativeCorrectionTelemetrySnapshot =
    createDefaultAuthoritativeCorrectionTelemetrySnapshot();
  #localAuthorityPoseCorrectionCount = 0;
  #lastLocalAuthorityPoseCorrectionDetail =
    createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
  #lastLocalAuthorityPoseCorrectionSnapshot =
    createDefaultLocalAuthorityPoseCorrectionSnapshot();
  #lastLocalAuthorityPoseCorrectionReason: LocalAuthorityPoseCorrectionReason =
    "none";
  #localAuthorityPoseConvergenceActive = false;

  get authoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
    return this.#latestAuthoritativeCorrectionTelemetrySnapshot;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#localAuthorityPoseCorrectionCount;
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

  reset(): void {
    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createDefaultAuthoritativeCorrectionTelemetrySnapshot();
    this.#localAuthorityPoseCorrectionCount = 0;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
    this.#lastLocalAuthorityPoseCorrectionSnapshot =
      createDefaultLocalAuthorityPoseCorrectionSnapshot();
    this.#lastLocalAuthorityPoseCorrectionReason = "none";
    this.#localAuthorityPoseConvergenceActive = false;
  }

  syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose,
    authoritativePlayerSnapshot,
    createLocalAuthorityPoseCorrectionSnapshot,
    convergenceMaxPositionStepMeters,
    convergenceMaxYawStepRadians,
    convergenceSettleDistanceMeters,
    convergenceStartDistanceMeters,
    localGroundedBodySnapshot,
    localSwimBodySnapshot,
    localGrounded,
    localTraversalPose
  }: SyncAuthoritativeLocalPlayerPoseInput): boolean {
    if (
      authoritativePlayerSnapshot.mountedOccupancy !== null ||
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
        mounted: authoritativePlayerSnapshot.mountedOccupancy !== null,
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
    const convergenceDecision = resolveLocalAuthorityPoseConvergenceDecision({
      convergenceActive: this.#localAuthorityPoseConvergenceActive,
      convergenceSettleDistanceMeters,
      convergenceStartDistanceMeters,
      planarDistance,
      verticalDistance
    });
    const positionDistance = Math.hypot(planarDistance, verticalDistance);
    const yawDistance = Math.abs(
      wrapRadians(
        authoritativeActiveBodySnapshot.yawRadians -
          localTraversalPose.yawRadians
      )
    );

    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createAuthoritativeCorrectionTelemetrySnapshot(
        localTraversalPose,
        Object.freeze({
          locomotionMode: authoritativePlayerSnapshot.locomotionMode,
          position: authoritativeActiveBodySnapshot.position
        }),
        false
      );

    if (!convergenceDecision.shouldConvergePose) {
      this.#localAuthorityPoseConvergenceActive = false;
      return false;
    }

    this.#localAuthorityPoseConvergenceActive = true;
    this.#localAuthorityPoseCorrectionCount += 1;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createLocalAuthorityPoseCorrectionDetailSnapshot(
        localTraversalPose,
        authoritativeActiveBodySnapshot.position,
        localGrounded,
        authoritativePlayerSnapshot.locomotionMode === "grounded"
          ? authoritativeGrounded
          : null,
        authoritativeActiveBodySnapshot.linearVelocity,
        divergenceDiagnostics.groundedBodyStateDivergence,
        divergenceDiagnostics.bodyStateDivergence
      );
    this.#lastLocalAuthorityPoseCorrectionSnapshot =
      createLocalAuthorityPoseCorrectionSnapshot({
        authoritativePlayerSnapshot,
        localTraversalPose
      });
    this.#lastLocalAuthorityPoseCorrectionReason =
      resolveLocalAuthorityPoseCorrectionReason({
        bodyStateDivergence: divergenceDiagnostics.bodyStateDivergence,
        grossPositionDivergence: convergenceDecision.grossPositionDivergence
      });
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
      authoritativePlayerSnapshot,
      localTraversalPose,
      positionBlendAlpha: resolveBoundedConvergenceBlendAlpha(
        positionDistance,
        convergenceMaxPositionStepMeters
      ),
      yawBlendAlpha: resolveBoundedConvergenceBlendAlpha(
        yawDistance,
        convergenceMaxYawStepRadians
      )
    });

    return true;
  }
}
