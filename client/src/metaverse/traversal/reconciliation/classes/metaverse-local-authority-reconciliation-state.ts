import type {
  MetaverseRealtimePlayerSnapshot,
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseTraversalActiveActionSnapshot,
  MetaverseTraversalAuthoritySnapshot,
  MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  isMetaverseTraversalAuthorityGroundedLocomotion
} from "@webgpu-metaverse/shared/metaverse/traversal";

import {
  createAuthoritativeCorrectionTelemetrySnapshot,
  createDefaultAuthoritativeCorrectionTelemetrySnapshot,
  createDefaultLocalAuthorityPoseCorrectionDetailSnapshot,
  createLocalAuthorityPoseCorrectionDetailSnapshot,
  resolveLocalAuthorityPoseCorrectionDecision,
  resolveLocalAuthorityPoseCorrectionReason,
  shouldSuppressRoutineGroundedCorrectionForIssuedTraversalAction,
  type AuthoritativeCorrectionTelemetrySnapshot,
  type LocalAuthorityPoseCorrectionDetailSnapshot,
  type LocalAuthorityPoseCorrectionReason,
  type LocalTraversalPoseSnapshot
} from "../local-authority-pose-correction";

interface LocalGroundedBodyAuthoritySnapshot {
  readonly grounded: boolean;
}

interface TraversalStateLike
  extends Pick<MetaverseUnmountedTraversalStateSnapshot, "actionState"> {}

export interface AuthoritativeLocalPlayerPoseSnapshot
  extends Pick<
    MetaverseRealtimePlayerSnapshot,
    | "linearVelocity"
    | "locomotionMode"
    | "mountedOccupancy"
    | "position"
    | "traversalAuthority"
    | "yawRadians"
  > {}

export interface ApplyAuthoritativeUnmountedPoseInput {
  readonly authoritativeGrounded: boolean;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly localTraversalPose: LocalTraversalPoseSnapshot;
}

export interface SyncAuthoritativeLocalPlayerPoseInput {
  readonly applyAuthoritativeUnmountedPose: (
    input: ApplyAuthoritativeUnmountedPoseInput
  ) => void;
  readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
  readonly currentTick: number;
  readonly hardSnapDistanceMeters: number;
  readonly latestIssuedTraversalActionSequence: number;
  readonly localGroundedBodySnapshot: LocalGroundedBodyAuthoritySnapshot | null;
  readonly localPredictedTraversalAction: MetaverseTraversalActiveActionSnapshot;
  readonly localTraversalAuthority: MetaverseTraversalAuthoritySnapshot;
  readonly localTraversalPose: LocalTraversalPoseSnapshot | null;
  readonly traversalState: TraversalStateLike;
}

export class MetaverseLocalAuthorityReconciliationState {
  #latestAuthoritativeCorrectionTelemetrySnapshot =
    createDefaultAuthoritativeCorrectionTelemetrySnapshot();
  #localAuthorityPoseCorrectionCount = 0;
  #lastLocalAuthorityPoseCorrectionDetail =
    createDefaultLocalAuthorityPoseCorrectionDetailSnapshot();
  #lastLocalAuthorityPoseCorrectionReason: LocalAuthorityPoseCorrectionReason =
    "none";

  get authoritativeCorrectionTelemetrySnapshot(): AuthoritativeCorrectionTelemetrySnapshot {
    return this.#latestAuthoritativeCorrectionTelemetrySnapshot;
  }

  get localAuthorityPoseCorrectionCount(): number {
    return this.#localAuthorityPoseCorrectionCount;
  }

  get lastLocalAuthorityPoseCorrectionDetail(): LocalAuthorityPoseCorrectionDetailSnapshot {
    return this.#lastLocalAuthorityPoseCorrectionDetail;
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
    this.#lastLocalAuthorityPoseCorrectionReason = "none";
  }

  syncAuthoritativeLocalPlayerPose({
    applyAuthoritativeUnmountedPose,
    authoritativePlayerSnapshot,
    currentTick,
    hardSnapDistanceMeters,
    latestIssuedTraversalActionSequence,
    localGroundedBodySnapshot,
    localPredictedTraversalAction,
    localTraversalAuthority,
    localTraversalPose,
    traversalState
  }: SyncAuthoritativeLocalPlayerPoseInput): boolean {
    if (
      authoritativePlayerSnapshot.mountedOccupancy !== null ||
      authoritativePlayerSnapshot.locomotionMode === "mounted" ||
      localTraversalPose === null
    ) {
      return false;
    }

    const positionDistance = Math.hypot(
      authoritativePlayerSnapshot.position.x - localTraversalPose.position.x,
      authoritativePlayerSnapshot.position.y - localTraversalPose.position.y,
      authoritativePlayerSnapshot.position.z - localTraversalPose.position.z
    );
    const verticalDistance = Math.abs(
      authoritativePlayerSnapshot.position.y - localTraversalPose.position.y
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
    const correctionDecision = resolveLocalAuthorityPoseCorrectionDecision({
      authoritativeLocomotionMode: authoritativePlayerSnapshot.locomotionMode,
      hardSnapDistanceMeters,
      localLocomotionMode: localTraversalPose.locomotionMode,
      positionDistance,
      verticalDistance
    });

    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createAuthoritativeCorrectionTelemetrySnapshot(
        localTraversalPose,
        authoritativePlayerSnapshot,
        false
      );

    if (
      authoritativePlayerSnapshot.locomotionMode === "grounded" &&
      localGroundedBodySnapshot !== null &&
      shouldSuppressRoutineGroundedCorrectionForIssuedTraversalAction({
        actionState: traversalState.actionState,
        authoritativeGrounded,
        currentTick,
        hardSnapDistanceMeters,
        issuedTraversalActionSequence: latestIssuedTraversalActionSequence,
        localGrounded: localGroundedBodySnapshot.grounded,
        localTraversalActionAuthority: localTraversalAuthority,
        localTraversalAction: localPredictedTraversalAction,
        locomotionMismatch: correctionDecision.locomotionMismatch,
        positionDistance
      })
    ) {
      return false;
    }

    if (!correctionDecision.shouldSnapCorrection) {
      return false;
    }

    this.#localAuthorityPoseCorrectionCount += 1;
    this.#lastLocalAuthorityPoseCorrectionDetail =
      createLocalAuthorityPoseCorrectionDetailSnapshot(
        localTraversalPose,
        authoritativePlayerSnapshot.position,
        localGroundedBodySnapshot?.grounded ?? null,
        authoritativePlayerSnapshot.locomotionMode === "grounded"
          ? authoritativeGrounded
          : null
      );
    this.#lastLocalAuthorityPoseCorrectionReason =
      resolveLocalAuthorityPoseCorrectionReason({
        grossPositionDivergence: correctionDecision.grossPositionDivergence
      });
    this.#latestAuthoritativeCorrectionTelemetrySnapshot =
      createAuthoritativeCorrectionTelemetrySnapshot(
        localTraversalPose,
        authoritativePlayerSnapshot,
        true
      );

    applyAuthoritativeUnmountedPose({
      authoritativeGrounded,
      authoritativePlayerSnapshot,
      localTraversalPose
    });

    return true;
  }
}
