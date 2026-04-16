import type {
  ExperienceId,
  MetaversePlayerTraversalActionIntentSnapshot,
  MetaversePlayerTraversalBodyControlSnapshot,
  MetaversePresenceMountedOccupancySnapshot,
  MetaverseRealtimePlayerJumpAuthorityStateId,
  MetaverseRealtimePlayerJumpResolutionStateId,
  MetaverseRealtimePlayerTraversalActionKindId,
  MetaverseRealtimePlayerTraversalActionPhaseId,
  MetaverseRealtimePlayerTraversalActionRejectionReasonId,
  MetaverseWorldAutomaticSurfaceDecisionReasonId
} from "@webgpu-metaverse/shared";

import type {
  MetaverseControlModeId,
  MetaverseFlightInputSnapshot
} from "./metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";
import type {
  MountedVehicleCameraPolicyId,
  MountedVehicleControlRoutingPolicyId,
  MountedVehicleLookLimitPolicyId,
  MountedVehicleOccupancyAnimationId,
  MountedVehicleSeatRoleId
} from "../vehicles";
import type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";

export const metaverseRuntimeLifecycleStates = [
  "idle",
  "booting",
  "running",
  "failed"
] as const;

export const metaversePresenceHudStates = [
  "disabled",
  "idle",
  "joining",
  "connected",
  "error",
  "disposed"
] as const;

export type MetaverseRuntimeLifecycleState =
  (typeof metaverseRuntimeLifecycleStates)[number];
export type MetaversePresenceHudState =
  (typeof metaversePresenceHudStates)[number];

export const metaverseBootPhaseStates = [
  "idle",
  "renderer-init",
  "scene-prewarm",
  "presence-joining",
  "world-connecting",
  "ready",
  "failed"
] as const;

export type MetaverseBootPhaseState =
  (typeof metaverseBootPhaseStates)[number];

export const metaverseCharacterAnimationVocabularyIds = [
  "idle",
  "walk",
  "swim-idle",
  "swim",
  "jump-up",
  "jump-mid",
  "jump-down",
  "aim",
  "interact",
  "seated"
] as const;

export type MetaverseCharacterAnimationVocabularyId =
  (typeof metaverseCharacterAnimationVocabularyIds)[number];

export interface MetaverseVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaverseCameraSnapshot {
  readonly lookDirection: MetaverseVector3Snapshot;
  readonly pitchRadians: number;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseCharacterLookSnapshot {
  readonly pitchRadians: number;
  readonly yawRadians: number;
}

export interface MetaverseCharacterPresentationSnapshot {
  readonly animationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

export type MetaverseRemoteCharacterPoseSyncMode =
  | "scene-arrival-smoothed"
  | "runtime-server-sampled";

export interface MetaverseRemoteCharacterPresentationSnapshot {
  readonly characterId: string;
  readonly look: MetaverseCharacterLookSnapshot;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null;
  readonly playerId: string;
  readonly presentation: MetaverseCharacterPresentationSnapshot;
  readonly poseSyncMode: MetaverseRemoteCharacterPoseSyncMode;
}

export interface MetaverseRemoteVehiclePresentationSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseRendererTelemetrySnapshot {
  readonly active: boolean;
  readonly devicePixelRatio: number;
  readonly drawCallCount: number;
  readonly label: string;
  readonly triangleCount: number;
}

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
      readonly ackedAuthoritativeReplayCorrectionCount: number;
      readonly lastLocalAuthorityPoseCorrectionDetail: {
        readonly authoritativeGrounded: boolean | null;
        readonly localGrounded: boolean | null;
        readonly planarMagnitudeMeters: number | null;
        readonly verticalMagnitudeMeters: number | null;
      };
      readonly lastLocalAuthorityPoseCorrectionReason:
        | "none"
        | "ground-state-mismatch"
        | "gross-position-divergence"
        | "jump-rejected"
        | "locomotion-mismatch";
      readonly lastCorrectionSource:
        | "none"
        | "mounted-vehicle-authority"
        | "local-authority-snap"
        | "acked-authority-replay";
      readonly lastCorrectionAgeMs: number | null;
      readonly localAuthorityPoseCorrectionCount: number;
      readonly mountedVehicleAuthorityCorrectionCount: number;
      readonly recentAckedAuthoritativeReplayCorrectionCountPast5Seconds: number;
      readonly recentCorrectionCountPast5Seconds: number;
      readonly recentLocalAuthorityPoseCorrectionCountPast5Seconds: number;
      readonly recentMountedVehicleAuthorityCorrectionCountPast5Seconds: number;
      readonly totalCorrectionCount: number;
    };
    readonly localReconciliationCorrectionCount: number;
    readonly shoreline: {
      readonly authoritativeCorrection: {
        readonly applied: boolean;
        readonly locomotionMismatch: boolean;
        readonly planarMagnitudeMeters: number;
        readonly verticalMagnitudeMeters: number;
      };
      readonly authoritativeLocalPlayer: {
        readonly correctionPlanarMagnitudeMeters: number | null;
        readonly correctionVerticalMagnitudeMeters: number | null;
        readonly jumpAuthorityState: MetaverseRealtimePlayerJumpAuthorityStateId | null;
        readonly jumpDebug: {
          readonly groundedBodyJumpReady: boolean | null;
          readonly pendingJumpActionSequence: number | null;
          readonly pendingJumpBufferAgeMs: number | null;
          readonly resolvedJumpActionSequence: number | null;
          readonly resolvedJumpActionState: MetaverseRealtimePlayerJumpResolutionStateId | null;
          readonly surfaceJumpSupported: boolean | null;
          readonly supported: boolean | null;
        };
        readonly lastProcessedInputSequence: number | null;
        readonly locomotionMismatch: boolean;
        readonly locomotionMode: MetaverseLocomotionModeId | null;
        readonly position: MetaverseVector3Snapshot | null;
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
          readonly blockerOverlap: boolean | null;
          readonly decisionReason: MetaverseWorldAutomaticSurfaceDecisionReasonId | null;
          readonly resolvedSupportHeightMeters: number | null;
          readonly stepSupportedProbeCount: number | null;
        };
      };
      readonly local: {
        readonly autostepHeightMeters: number | null;
        readonly blockerOverlap: boolean;
        readonly locomotionMode: MetaverseLocomotionModeId;
        readonly jumpDebug: {
          readonly groundedBodyGrounded: boolean | null;
          readonly groundedBodyJumpReady: boolean | null;
          readonly surfaceJumpSupported: boolean | null;
          readonly supported: boolean | null;
          readonly verticalSpeedUnitsPerSecond: number | null;
        };
        readonly resolvedSupportHeightMeters: number;
        readonly stepSupportedProbeCount: number;
        readonly decisionReason: MetaverseWorldAutomaticSurfaceDecisionReasonId;
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
        readonly inputSequence: number;
        readonly locomotionMode: "grounded" | "swim";
      } | null;
    };
    readonly latestSimulationAgeMs: number | null;
    readonly latestSnapshotUpdateRateHz: number | null;
  };
}

export interface MetaverseCharacterAnimationClipProofConfig {
  readonly clipName: string;
  readonly sourcePath: string;
  readonly vocabulary: MetaverseCharacterAnimationVocabularyId;
}

export const metaverseHumanoidV2PistolPoseIds = [
  "down",
  "neutral",
  "up"
] as const;

export type MetaverseHumanoidV2PistolPoseId =
  (typeof metaverseHumanoidV2PistolPoseIds)[number];

export interface MetaverseHumanoidV2PistolPoseProofConfig {
  readonly clipNamesByPoseId: Readonly<
    Record<MetaverseHumanoidV2PistolPoseId, string>
  >;
  readonly sourcePath: string;
}

export const metaverseCharacterSkeletonIds = [
  "humanoid_v1",
  "humanoid_v2"
] as const;

export type MetaverseCharacterSkeletonId =
  (typeof metaverseCharacterSkeletonIds)[number];

export const metaverseCanonicalSocketNames = [
  "hand_r_socket",
  "hand_l_socket",
  "head_socket",
  "hip_socket",
  "seat_socket"
] as const;

export type MetaverseCanonicalSocketName =
  (typeof metaverseCanonicalSocketNames)[number];

export interface MetaversePortalConfig {
  readonly beamColor: readonly [number, number, number];
  readonly experienceId: ExperienceId;
  readonly highlightRadius: number;
  readonly interactionRadius: number;
  readonly label: string;
  readonly position: MetaverseVector3Snapshot;
  readonly ringColor: readonly [number, number, number];
}

export interface MetaverseCharacterProofConfig {
  readonly animationClips: readonly MetaverseCharacterAnimationClipProofConfig[];
  readonly characterId: string;
  readonly humanoidV2PistolPoseProofConfig?:
    | MetaverseHumanoidV2PistolPoseProofConfig
    | null;
  readonly label: string;
  readonly modelPath: string;
  readonly skeletonId: MetaverseCharacterSkeletonId;
  readonly socketNames: readonly MetaverseCanonicalSocketName[];
}

interface MetaverseAttachmentSocketGripAlignmentConfig {
  readonly attachmentGripMarkerNodeName: string | null;
  readonly socketForwardAxis: MetaverseVector3Snapshot;
  readonly socketOffset: MetaverseVector3Snapshot;
  readonly socketUpAxis: MetaverseVector3Snapshot;
}

export interface MetaverseAttachmentGripAlignmentAxisConfig
  extends MetaverseAttachmentSocketGripAlignmentConfig {
  readonly attachmentForwardAxis: MetaverseVector3Snapshot;
  readonly attachmentUpAxis: MetaverseVector3Snapshot;
}

export interface MetaverseAttachmentGripAlignmentMarkerConfig
  extends MetaverseAttachmentSocketGripAlignmentConfig {
  readonly attachmentForwardMarkerNodeName: string;
  readonly attachmentUpMarkerNodeName: string;
}

export type MetaverseAttachmentGripAlignmentConfig =
  | MetaverseAttachmentGripAlignmentAxisConfig
  | MetaverseAttachmentGripAlignmentMarkerConfig;

export const metaverseSyntheticSocketNames = [
  "back_socket",
  "grip_l_socket",
  "grip_r_socket",
  "palm_l_socket",
  "palm_r_socket"
] as const;

export type MetaverseSyntheticSocketName =
  (typeof metaverseSyntheticSocketNames)[number];

export type MetaverseAttachmentSocketName =
  | MetaverseCanonicalSocketName
  | MetaverseSyntheticSocketName;

export interface MetaverseAttachmentMountProofConfig {
  readonly offHandSupportPointId?: string | null;
  readonly gripAlignment: MetaverseAttachmentGripAlignmentConfig;
  readonly socketName: MetaverseAttachmentSocketName;
}

export interface MetaverseAttachmentProofConfig {
  readonly attachmentId: string;
  readonly heldMount: MetaverseAttachmentMountProofConfig;
  readonly label: string;
  readonly modelPath: string;
  readonly mountedHolsterMount: MetaverseAttachmentMountProofConfig | null;
  readonly supportPoints: readonly {
    readonly localPosition: MetaverseVector3Snapshot;
    readonly supportPointId: string;
  }[] | null;
}

export interface MetaverseEnvironmentColliderProofConfig {
  readonly center: MetaverseVector3Snapshot;
  readonly shape: "box";
  readonly size: MetaverseVector3Snapshot;
}

export interface MetaverseEnvironmentPhysicsColliderProofConfig
  extends MetaverseEnvironmentColliderProofConfig {
  readonly traversalAffordance: "blocker" | "support";
}

export interface MetaverseEnvironmentSeatProofConfig {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directEntryEnabled: boolean;
  readonly dismountOffset: MetaverseVector3Snapshot;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly seatId: string;
  readonly seatNodeName: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface MetaverseEnvironmentEntryProofConfig {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly dismountOffset: MetaverseVector3Snapshot;
  readonly entryId: string;
  readonly entryNodeName: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupantRole: MountedVehicleSeatRoleId;
}

export interface MetaverseEnvironmentOrientationProofConfig {
  readonly forwardModelYawRadians: number;
}

export interface MetaverseEnvironmentPlacementProofConfig {
  readonly position: MetaverseVector3Snapshot;
  readonly rotationYRadians: number;
  readonly scale: number;
}

export interface MetaverseEnvironmentLodProofConfig {
  readonly maxDistanceMeters: number | null;
  readonly modelPath: string;
  readonly tier: string;
}

export type MetaverseEnvironmentTraversalAffordanceId =
  | "support"
  | "blocker"
  | "mount"
  | "pushable";

export interface MetaverseEnvironmentAssetProofConfig {
  readonly collisionPath: string | null;
  readonly collider: MetaverseEnvironmentColliderProofConfig | null;
  readonly entries: readonly MetaverseEnvironmentEntryProofConfig[] | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly lods: readonly MetaverseEnvironmentLodProofConfig[];
  readonly orientation: MetaverseEnvironmentOrientationProofConfig | null;
  readonly placement: "dynamic" | "instanced" | "static";
  readonly placements: readonly MetaverseEnvironmentPlacementProofConfig[];
  readonly physicsColliders:
    | readonly MetaverseEnvironmentPhysicsColliderProofConfig[]
    | null;
  readonly seats: readonly MetaverseEnvironmentSeatProofConfig[] | null;
  readonly traversalAffordance: MetaverseEnvironmentTraversalAffordanceId;
}

export interface MetaverseEnvironmentProofConfig {
  readonly assets: readonly MetaverseEnvironmentAssetProofConfig[];
}

export interface FocusedExperiencePortalSnapshot {
  readonly distanceFromCamera: number;
  readonly experienceId: ExperienceId;
  readonly label: string;
}

export interface MountableBoardingEntrySnapshot {
  readonly entryId: string;
  readonly label: string;
}

export interface MountableSeatSelectionSnapshot {
  readonly label: string;
  readonly seatId: string;
  readonly seatRole: MountedVehicleSeatRoleId;
}

export interface FocusedMountableSnapshot {
  readonly boardingEntries: readonly MountableBoardingEntrySnapshot[];
  readonly distanceFromCamera: number;
  readonly directSeatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly environmentAssetId: string;
  readonly label: string;
}

export type MountedEnvironmentOccupancyKind = "entry" | "seat";

export interface MountedEnvironmentSnapshot {
  readonly cameraPolicyId: MountedVehicleCameraPolicyId;
  readonly controlRoutingPolicyId: MountedVehicleControlRoutingPolicyId;
  readonly directSeatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly label: string;
  readonly lookLimitPolicyId: MountedVehicleLookLimitPolicyId;
  readonly occupancyAnimationId: MountedVehicleOccupancyAnimationId;
  readonly occupancyKind: MountedEnvironmentOccupancyKind;
  readonly occupantLabel: string;
  readonly occupantRole: MountedVehicleSeatRoleId;
  readonly seatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly seatId: string | null;
}

export interface MetaverseHudSnapshot {
  readonly boot: {
    readonly authoritativeWorldConnected: boolean;
    readonly phase: MetaverseBootPhaseState;
    readonly presenceJoined: boolean;
    readonly rendererInitialized: boolean;
    readonly scenePrewarmed: boolean;
  };
  readonly camera: MetaverseCameraSnapshot;
  readonly controlMode: MetaverseControlModeId;
  readonly failureReason: string | null;
  readonly focusedMountable: FocusedMountableSnapshot | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly lifecycle: MetaverseRuntimeLifecycleState;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
  readonly presence: {
    readonly joined: boolean;
    readonly lastError: string | null;
    readonly remotePlayerCount: number;
    readonly state: MetaversePresenceHudState;
  };
  readonly telemetry: MetaverseTelemetrySnapshot;
  readonly transport: {
    readonly presenceReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldDriverDatagram: RealtimeDatagramTransportStatusSnapshot;
    readonly worldReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldSnapshotStream: MetaverseWorldSnapshotStreamTelemetrySnapshot;
  };
}

export interface MetaverseRuntimeConfig {
  readonly camera: {
    readonly far: number;
    readonly fieldOfViewDegrees: number;
    readonly initialPitchRadians: number;
    readonly initialYawRadians: number;
    readonly near: number;
    readonly spawnPosition: MetaverseVector3Snapshot;
  };
  readonly bodyPresentation: {
    readonly groundedFirstPersonForwardOffsetMeters: number;
    readonly swimIdleBodySubmersionDepthMeters: number;
    readonly swimMovingBodySubmersionDepthMeters: number;
    readonly swimThirdPersonFollowDistanceMeters: number;
    readonly swimThirdPersonHeightOffsetMeters: number;
  };
  readonly environment: {
    readonly domeRadius: number;
    readonly fogColor: readonly [number, number, number];
    readonly fogDensity: number;
    readonly horizonColor: readonly [number, number, number];
    readonly sunColor: readonly [number, number, number];
    readonly sunDirection: MetaverseVector3Snapshot;
    readonly zenithColor: readonly [number, number, number];
  };
  readonly movement: {
    readonly baseSpeedUnitsPerSecond: number;
    readonly boostMultiplier: number;
    readonly maxAltitude: number;
    readonly minAltitude: number;
    readonly worldRadius: number;
  };
  readonly groundedBody: {
    readonly accelerationCurveExponent: number;
    readonly accelerationUnitsPerSecondSquared: number;
    readonly airborneMovementDampingFactor: number;
    readonly baseSpeedUnitsPerSecond: number;
    readonly boostCurveExponent: number;
    readonly boostMultiplier: number;
    readonly capsuleHalfHeightMeters: number;
    readonly capsuleRadiusMeters: number;
    readonly controllerOffsetMeters: number;
    readonly decelerationUnitsPerSecondSquared: number;
    readonly dragCurveExponent: number;
    readonly eyeHeightMeters: number;
    readonly gravityUnitsPerSecond: number;
    readonly jumpGroundContactGraceSeconds?: number;
    readonly jumpImpulseUnitsPerSecond: number;
    readonly maxSlopeClimbAngleRadians: number;
    readonly minSlopeSlideAngleRadians: number;
    readonly maxTurnSpeedRadiansPerSecond: number;
    readonly snapToGroundDistanceMeters: number;
    readonly stepHeightMeters: number;
    readonly stepWidthMeters: number;
    readonly spawnPosition: MetaverseVector3Snapshot;
  };
  readonly orientation: {
    readonly maxPitchRadians: number;
    readonly maxTurnSpeedRadiansPerSecond: number;
    readonly minPitchRadians: number;
    readonly mouseEdgeTurn: {
      readonly deadZoneViewportFraction: number;
      readonly responseExponent: number;
    };
  };
  readonly ocean: {
    readonly emissiveColor: readonly [number, number, number];
    readonly farColor: readonly [number, number, number];
    readonly height: number;
    readonly nearColor: readonly [number, number, number];
    readonly planeDepth: number;
    readonly planeWidth: number;
    readonly roughness: number;
    readonly segmentCount: number;
    readonly waveAmplitude: number;
    readonly waveFrequencies: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
    readonly waveSpeeds: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
  };
  readonly skiff: {
    readonly accelerationCurveExponent: number;
    readonly accelerationUnitsPerSecondSquared: number;
    readonly authoritativeCorrection: {
      readonly grossSnapDistanceThresholdMeters: number;
      readonly grossSnapYawThresholdRadians: number;
      readonly routineBlendAlpha: number;
      readonly routinePositionBlendThresholdMeters: number;
      readonly routineYawBlendThresholdRadians: number;
    };
    readonly baseSpeedUnitsPerSecond: number;
    readonly boostCurveExponent: number;
    readonly boostMultiplier: number;
    readonly cameraFollowDistanceMeters: number;
    readonly cameraHeightOffsetMeters: number;
    readonly cameraEyeHeightMeters: number;
    readonly decelerationUnitsPerSecondSquared: number;
    readonly dragCurveExponent: number;
    readonly maxTurnSpeedRadiansPerSecond: number;
    readonly waterContactProbeRadiusMeters: number;
    readonly waterlineHeightMeters: number;
  };
  readonly swim: {
    readonly accelerationCurveExponent: number;
    readonly accelerationUnitsPerSecondSquared: number;
    readonly baseSpeedUnitsPerSecond: number;
    readonly boostCurveExponent: number;
    readonly boostMultiplier: number;
    readonly cameraEyeHeightMeters: number;
    readonly decelerationUnitsPerSecondSquared: number;
    readonly dragCurveExponent: number;
    readonly maxTurnSpeedRadiansPerSecond: number;
  };
  readonly portals: readonly MetaversePortalConfig[];
}

export type { MetaverseFlightInputSnapshot };
