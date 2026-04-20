import type {
  MetaversePlayerTraversalIntentSnapshot,
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
    | "lastProcessedTraversalOrientationSequence"
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
  readonly authoritativePlayerApplicationSnapshot?: AuthoritativeLocalPlayerPoseSnapshot;
  readonly authoritativeSnapshotAgeMs: number | null;
  readonly authoritativeSnapshotSequence: number | null;
  readonly authoritativeTick: number | null;
  readonly createLocalAuthorityPoseCorrectionSnapshot: (input: {
    readonly authoritativePlayerSnapshot: AuthoritativeLocalPlayerPoseSnapshot;
    readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
    readonly localIssuedTraversalIntentSnapshot: MetaversePlayerTraversalIntentSnapshot | null;
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
  readonly localGroundedBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["groundedBody"] | null;
  readonly localSwimBodySnapshot: AuthoritativeLocalPlayerPoseSnapshot["swimBody"] | null;
  readonly localGrounded: boolean | null;
  readonly localTraversalApplicationPose?: LocalTraversalPoseSnapshot;
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
  #lastLocalAuthorityPoseConvergenceEpisodeStarted = false;
  #localAuthorityPoseConvergenceEpisodeCount = 0;
  #localAuthorityPoseConvergenceStepCount = 0;
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
    localGroundedBodySnapshot,
    localSwimBodySnapshot,
    localGrounded,
    localTraversalApplicationPose,
    localTraversalPose
  }: SyncAuthoritativeLocalPlayerPoseInput): boolean {
    this.#lastLocalAuthorityPoseConvergenceEpisodeStarted = false;

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

    if (!convergenceDecision.shouldConvergePose) {
      this.#localAuthorityPoseConvergenceActive = false;
      return false;
    }

    const convergenceEpisodeStarted =
      !this.#localAuthorityPoseConvergenceActive;
    this.#localAuthorityPoseConvergenceActive = true;
    this.#lastLocalAuthorityPoseConvergenceEpisodeStarted =
      convergenceEpisodeStarted;

    if (convergenceEpisodeStarted) {
      this.#localAuthorityPoseConvergenceEpisodeCount += 1;
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
        convergenceEpisodeStartPlanarMagnitudeMeters:
          convergenceEpisodeStarted ? planarDistance : null,
        convergenceEpisodeStartVerticalMagnitudeMeters:
          convergenceEpisodeStarted ? verticalDistance : null,
        convergenceEpisodeStartYawMagnitudeRadians:
          convergenceEpisodeStarted ? yawDistance : null,
        groundedBodyStateDivergence:
          divergenceDiagnostics.groundedBodyStateDivergence,
        lastProcessedInputSequence:
          authoritativePlayerSnapshot.lastProcessedInputSequence ?? null,
        lastProcessedTraversalOrientationSequence:
          authoritativePlayerSnapshot
            .lastProcessedTraversalOrientationSequence ?? null,
        localGrounded,
        localTraversalPose,
      });
    this.#lastLocalAuthorityPoseCorrectionSnapshot =
      createLocalAuthorityPoseCorrectionSnapshot({
        authoritativePlayerSnapshot,
        localGroundedBodySnapshot,
        localIssuedTraversalIntentSnapshot: null,
        localSwimBodySnapshot,
        localTraversalPose
      });
    this.#lastLocalAuthorityPoseCorrectionReason =
      resolveLocalAuthorityPoseCorrectionReason({
        bodyStateDivergence: divergenceDiagnostics.bodyStateDivergence,
        grossPositionDivergence: convergenceDecision.grossPositionDivergence,
        grossYawDivergence: convergenceDecision.grossYawDivergence
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
      authoritativePlayerSnapshot:
        authoritativePlayerApplicationSnapshot ?? authoritativePlayerSnapshot,
      localTraversalPose: localTraversalApplicationPose ?? localTraversalPose,
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
