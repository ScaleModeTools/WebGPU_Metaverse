import type {
  MetaverseCombatActionKindId,
  MetaverseCombatActionReceiptStatusId,
  MetaverseCombatActionRejectionReasonId,
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
import type {
  MetaverseRealtimePlayerWeaponAimModeId
} from "@webgpu-metaverse/shared/metaverse/realtime";

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

export const metaverseLocalHeldWeaponGripDebugPhases = [
  "no-character-runtime",
  "no-attachment-runtime",
  "no-held-weapon-pose-runtime",
  "no-character-presentation",
  "mounted",
  "no-weapon-state",
  "attachment-not-held",
  "grip-target-solve-failed",
  "no-offhand-grip-mount",
  "solved"
] as const;

export const metaverseLocalHeldWeaponGripDebugStabilities = [
  "inactive",
  "stable",
  "warning",
  "bad"
] as const;

export const metaverseLocalHeldWeaponGripDebugHandSocketIds = [
  "none",
  "grip",
  "palm",
  "support"
] as const;

export const metaverseLocalHeldWeaponGripDebugSolveFailureReasons = [
  "look-direction-degenerate",
  "grip-up-direction-degenerate",
  "grip-across-direction-degenerate"
] as const;

export type MetaverseLocalHeldWeaponGripDebugPhase =
  (typeof metaverseLocalHeldWeaponGripDebugPhases)[number];
export type MetaverseLocalHeldWeaponGripDebugStability =
  (typeof metaverseLocalHeldWeaponGripDebugStabilities)[number];
export type MetaverseLocalHeldWeaponGripDebugHandSocketId =
  (typeof metaverseLocalHeldWeaponGripDebugHandSocketIds)[number];
export type MetaverseLocalHeldWeaponGripDebugSolveFailureReason =
  (typeof metaverseLocalHeldWeaponGripDebugSolveFailureReasons)[number];

export interface MetaverseLocalHeldWeaponGripTelemetrySnapshot {
  readonly adsBlend: number | null;
  readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId | null;
  readonly attachmentMountKind: "held" | "mounted-holster" | "none";
  readonly degradedFrameCount: number;
  readonly gripTargetSolveFailureReason:
    | MetaverseLocalHeldWeaponGripDebugSolveFailureReason
    | null;
  readonly heldSupportMarkerAvailable: boolean;
  readonly heldMountSocketName: string | null;
  readonly lastDegradedAgeMs: number | null;
  readonly lastDegradedReason: string | null;
  readonly mainHandGripErrorMeters: number | null;
  readonly mainHandGripSocketComparisonErrorMeters: number | null;
  readonly mainHandMaxReachMeters: number | null;
  readonly mainHandPalmSocketComparisonErrorMeters: number | null;
  readonly mainHandPoleAngleRadians: number | null;
  readonly mainHandPostPoleBiasErrorMeters: number | null;
  readonly mainHandReachClampDeltaMeters: number | null;
  readonly mainHandReachSlackMeters: number | null;
  readonly mainHandSolveErrorMeters: number | null;
  readonly mainHandSocket: MetaverseLocalHeldWeaponGripDebugHandSocketId;
  readonly mainHandTargetDistanceMeters: number | null;
  readonly offHandFinalErrorMeters: number | null;
  readonly offHandGripMounted: boolean;
  readonly offHandInitialSolveErrorMeters: number | null;
  readonly offHandPoleAngleRadians: number | null;
  readonly offHandPreSolveErrorMeters: number | null;
  readonly offHandRefinementPassCount: number;
  readonly offHandSocket: MetaverseLocalHeldWeaponGripDebugHandSocketId;
  readonly offHandSupportMarkerAvailable: boolean;
  readonly phase: MetaverseLocalHeldWeaponGripDebugPhase;
  readonly servicePistolAdsPoseActive: boolean;
  readonly servicePistolSupportPalmPoseActive: boolean;
  readonly stability: MetaverseLocalHeldWeaponGripDebugStability;
  readonly weaponId: string | null;
  readonly weaponStatePresent: boolean;
  readonly worstMainHandGripErrorMeters: number;
  readonly worstOffHandFinalErrorMeters: number;
}

export interface MetaverseTelemetrySnapshot {
  readonly frameDeltaMs: number;
  readonly frameRate: number;
  readonly localHeldWeaponGrip: MetaverseLocalHeldWeaponGripTelemetrySnapshot;
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
        readonly combatAction: {
          readonly actionSequence: number | null;
          readonly kind: MetaverseCombatActionKindId | null;
          readonly highestProcessedPlayerActionSequence: number | null;
          readonly processedAtTimeMs: number | null;
          readonly sourceProjectileId: string | null;
          readonly rejectionReason: MetaverseCombatActionRejectionReasonId | null;
          readonly status: MetaverseCombatActionReceiptStatusId | null;
          readonly weaponId: string | null;
        };
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
