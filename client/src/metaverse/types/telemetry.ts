import type {
  MetaversePlayerTraversalActionIntentSnapshot,
  MetaversePlayerTraversalBodyControlSnapshot,
  MetaverseRealtimePlayerTraversalActionResolutionStateId,
  MetaverseRealtimePlayerTraversalActionKindId,
  MetaverseRealtimePlayerTraversalActionPhaseId,
  MetaverseRealtimePlayerTraversalActionRejectionReasonId,
  MetaverseTraversalStateResolutionReasonId
} from "@webgpu-metaverse/shared";
import type {
  MetaverseGroundedBodyContactSnapshot,
  MetaverseGroundedBodyInteractionSnapshot,
  MetaverseGroundedJumpBodySnapshot,
  MetaverseSurfaceDriveBodyRuntimeSnapshot,
  MetaverseSurfaceTraversalDriveTargetSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";

import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";
import type { MetaverseVector3Snapshot } from "./presentation";
import type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";

export interface MetaverseRendererTelemetrySnapshot {
  readonly active: boolean;
  readonly devicePixelRatio: number;
  readonly drawCallCount: number;
  readonly label: string;
  readonly triangleCount: number;
}

export interface MetaverseTelemetryGroundedBodySnapshot {
  readonly contact: MetaverseGroundedBodyContactSnapshot;
  readonly driveTarget: MetaverseSurfaceTraversalDriveTargetSnapshot;
  readonly interaction: MetaverseGroundedBodyInteractionSnapshot;
  readonly jumpBody: MetaverseGroundedJumpBodySnapshot;
}

export type MetaverseTelemetrySwimBodySnapshot =
  MetaverseSurfaceDriveBodyRuntimeSnapshot;

export interface MetaverseTelemetrySnapshot {
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly renderedFrameCount: number;
  readonly renderer: MetaverseRendererTelemetrySnapshot;
  readonly worldCadence: {
    readonly authoritativeTickIntervalMs: number | null;
    readonly localAuthoritativeFreshnessMaxAgeMs: number;
    readonly maxExtrapolationMs: number;
    readonly remoteInterpolationDelayMs: number;
    readonly worldPollIntervalMs: number;
  };
  readonly worldSnapshot: {
    readonly bufferDepth: number;
    readonly cameraPresentation: {
      readonly renderedOffset: {
        readonly lookAngleRadians: number;
        readonly planarMagnitudeMeters: number;
        readonly verticalMagnitudeMeters: number;
      };
      readonly renderedSnap: {
        readonly lastAgeMs: number | null;
        readonly maxLookAngleRadiansPast5Seconds: number;
        readonly maxPlanarMagnitudeMetersPast5Seconds: number;
        readonly maxVerticalMagnitudeMetersPast5Seconds: number;
        readonly recentCountPast5Seconds: number;
        readonly totalCount: number;
      };
    };
    readonly clockOffsetEstimateMs: number | null;
    readonly currentExtrapolationMs: number;
    readonly datagramSendFailureCount: number;
    readonly extrapolatedFramePercent: number;
    readonly localReconciliation: {
      readonly lastLocalAuthorityPoseCorrectionDetail: {
        readonly authoritativeSnapshotAgeMs: number | null;
        readonly authoritativeSnapshotSequence: number | null;
        readonly authoritativeTick: number | null;
        readonly authoritativeGrounded: boolean | null;
        readonly bodyStateDivergence: boolean | null;
        readonly convergenceEpisodeStarted: boolean;
        readonly convergenceEpisodeStartIntentionalDiscontinuityCause:
          | "none"
          | "spawn"
          | "moving-support-carry"
          | "mounted-boarding"
          | "mounted-unboarding";
        readonly convergenceEpisodeStartHistoricalLocalSampleMatched:
          | boolean
          | null;
        readonly convergenceEpisodeStartHistoricalLocalSampleSelectionReason:
          | "exact-traversal-sample-id"
          | "latest-at-or-before-authoritative-time"
          | "earliest-after-authoritative-time"
          | "latest-matching-sample"
          | null;
        readonly convergenceEpisodeStartHistoricalLocalSampleTimeDeltaMs:
          | number
          | null;
        readonly convergenceEpisodeStartPlanarMagnitudeMeters: number | null;
        readonly convergenceEpisodeStartReason:
          | "none"
          | "gross-body-divergence"
          | "gross-position-divergence"
          | "gross-yaw-divergence";
        readonly convergenceEpisodeStartVerticalMagnitudeMeters: number | null;
        readonly convergenceEpisodeStartYawMagnitudeRadians: number | null;
        readonly groundedBodyStateDivergence: boolean | null;
        readonly lastProcessedTraversalSequence: number | null;
        readonly localGrounded: boolean | null;
        readonly planarMagnitudeMeters: number | null;
        readonly planarVelocityMagnitudeUnitsPerSecond: number | null;
        readonly verticalMagnitudeMeters: number | null;
        readonly verticalVelocityMagnitudeUnitsPerSecond: number | null;
      };
      readonly lastLocalAuthorityPoseCorrectionSnapshot: {
        readonly authoritative: {
          readonly groundedBody: MetaverseTelemetryGroundedBodySnapshot | null;
          readonly lastProcessedTraversalSequence: number;
          readonly linearVelocity: MetaverseVector3Snapshot;
          readonly locomotionMode: MetaverseLocomotionModeId;
          readonly position: MetaverseVector3Snapshot;
          readonly swimBody: MetaverseTelemetrySwimBodySnapshot | null;
          readonly surfaceRouting: {
            readonly blockingAffordanceDetected: boolean;
            readonly decisionReason: MetaverseTraversalStateResolutionReasonId;
            readonly resolvedSupportHeightMeters: number | null;
            readonly supportingAffordanceSampleCount: number;
          };
        };
        readonly local: {
          readonly groundedBody: MetaverseTelemetryGroundedBodySnapshot | null;
          readonly issuedTraversalIntent: {
            readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
            readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
            readonly sequence: number;
            readonly locomotionMode: "grounded" | "swim";
          } | null;
          readonly linearVelocity: MetaverseVector3Snapshot;
          readonly locomotionMode: MetaverseLocomotionModeId;
          readonly position: MetaverseVector3Snapshot;
          readonly swimBody: MetaverseTelemetrySwimBodySnapshot | null;
          readonly surfaceRouting: {
            readonly autostepHeightMeters: number | null;
            readonly blockingAffordanceDetected: boolean;
            readonly decisionReason: MetaverseTraversalStateResolutionReasonId;
            readonly groundedBody: MetaverseTelemetryGroundedBodySnapshot | null;
            readonly locomotionMode: MetaverseLocomotionModeId;
            readonly resolvedSupportHeightMeters: number;
            readonly swimBody: MetaverseTelemetrySwimBodySnapshot | null;
            readonly supportingAffordanceSampleCount: number;
            readonly traversalAuthority: {
              readonly currentActionKind: MetaverseRealtimePlayerTraversalActionKindId;
              readonly currentActionPhase: MetaverseRealtimePlayerTraversalActionPhaseId;
              readonly currentActionSequence: number;
              readonly lastConsumedActionSequence: number;
              readonly lastRejectedActionReason: MetaverseRealtimePlayerTraversalActionRejectionReasonId;
              readonly lastRejectedActionSequence: number;
              readonly phaseStartedAtTick: number;
            };
          };
        };
      } | null;
      readonly lastLocalAuthorityPoseCorrectionReason:
        | "none"
        | "gross-body-divergence"
        | "gross-position-divergence"
        | "gross-yaw-divergence";
      readonly lastCorrectionSource:
        | "none"
        | "mounted-vehicle-authority"
        | "local-authority-convergence-episode"
        | "local-authority-convergence-step";
      readonly lastCorrectionAgeMs: number | null;
      readonly localAuthorityPoseCorrectionCount: number;
      readonly localAuthorityPoseConvergenceEpisodeCount: number;
      readonly localAuthorityPoseConvergenceStepCount: number;
      readonly mountedVehicleAuthorityCorrectionCount: number;
      readonly recentCorrectionCountPast5Seconds: number;
      readonly recentLocalAuthorityPoseCorrectionCountPast5Seconds: number;
      readonly recentLocalAuthorityPoseConvergenceEpisodeCountPast5Seconds: number;
      readonly recentLocalAuthorityPoseConvergenceStepCountPast5Seconds: number;
      readonly recentMountedVehicleAuthorityCorrectionCountPast5Seconds: number;
      readonly totalCorrectionCount: number;
    };
    readonly localReconciliationCorrectionCount: number;
    readonly surfaceRouting: {
      readonly authoritativeCorrection: {
        readonly applied: boolean;
        readonly locomotionMismatch: boolean;
        readonly planarMagnitudeMeters: number;
        readonly verticalMagnitudeMeters: number;
      };
      readonly authoritativeLocalPlayer: {
        readonly correctionPlanarMagnitudeMeters: number | null;
        readonly correctionVerticalMagnitudeMeters: number | null;
        readonly groundedBody: MetaverseTelemetryGroundedBodySnapshot | null;
        readonly jumpDebug: {
          readonly pendingActionSequence: number | null;
          readonly pendingActionBufferAgeMs: number | null;
          readonly resolvedActionSequence: number | null;
          readonly resolvedActionState: MetaverseRealtimePlayerTraversalActionResolutionStateId | null;
        };
        readonly lastProcessedTraversalSequence: number | null;
        readonly locomotionMismatch: boolean;
        readonly locomotionMode: MetaverseLocomotionModeId | null;
        readonly position: MetaverseVector3Snapshot | null;
        readonly swimBody: MetaverseTelemetrySwimBodySnapshot | null;
        readonly traversalAuthority: {
          readonly currentActionKind: MetaverseRealtimePlayerTraversalActionKindId | null;
          readonly currentActionPhase: MetaverseRealtimePlayerTraversalActionPhaseId | null;
          readonly currentActionSequence: number | null;
          readonly lastConsumedActionSequence: number | null;
          readonly lastRejectedActionReason: MetaverseRealtimePlayerTraversalActionRejectionReasonId | null;
          readonly lastRejectedActionSequence: number | null;
          readonly phaseStartedAtTick: number | null;
        };
        readonly surfaceRouting: {
          readonly blockingAffordanceDetected: boolean | null;
          readonly decisionReason: MetaverseTraversalStateResolutionReasonId | null;
          readonly resolvedSupportHeightMeters: number | null;
          readonly supportingAffordanceSampleCount: number | null;
        };
      };
      readonly local: {
        readonly autostepHeightMeters: number | null;
        readonly blockingAffordanceDetected: boolean;
        readonly decisionReason: MetaverseTraversalStateResolutionReasonId;
        readonly groundedBody: MetaverseTelemetryGroundedBodySnapshot | null;
        readonly locomotionMode: MetaverseLocomotionModeId;
        readonly resolvedSupportHeightMeters: number;
        readonly swimBody: MetaverseTelemetrySwimBodySnapshot | null;
        readonly supportingAffordanceSampleCount: number;
        readonly traversalAuthority: {
          readonly currentActionKind: MetaverseRealtimePlayerTraversalActionKindId;
          readonly currentActionPhase: MetaverseRealtimePlayerTraversalActionPhaseId;
          readonly currentActionSequence: number;
          readonly lastConsumedActionSequence: number;
          readonly lastRejectedActionReason: MetaverseRealtimePlayerTraversalActionRejectionReasonId;
          readonly lastRejectedActionSequence: number;
          readonly phaseStartedAtTick: number;
        };
      };
      readonly issuedTraversalIntent: {
        readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
        readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
        readonly sequence: number;
        readonly locomotionMode: "grounded" | "swim";
      } | null;
    };
    readonly latestSimulationAgeMs: number | null;
    readonly latestSnapshotUpdateRateHz: number | null;
  };
}

export type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
};
