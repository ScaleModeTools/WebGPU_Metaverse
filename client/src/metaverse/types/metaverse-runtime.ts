import type { ExperienceId } from "@webgpu-metaverse/shared";

import type {
  MetaverseControlModeId,
  MetaverseFlightInputSnapshot
} from "./metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";

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

export const metaverseCharacterAnimationVocabularyIds = [
  "idle",
  "walk",
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

export interface MetaverseCharacterPresentationSnapshot {
  readonly animationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseRemoteCharacterPresentationSnapshot {
  readonly characterId: string;
  readonly playerId: string;
  readonly presentation: MetaverseCharacterPresentationSnapshot;
}

export interface MetaverseCharacterAnimationClipProofConfig {
  readonly clipName: string;
  readonly sourcePath: string;
  readonly vocabulary: MetaverseCharacterAnimationVocabularyId;
}

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
  readonly label: string;
  readonly modelPath: string;
  readonly socketNames: readonly string[];
}

export interface MetaverseAttachmentProofConfig {
  readonly attachmentId: string;
  readonly label: string;
  readonly modelPath: string;
  readonly socketName: string;
}

export interface MetaverseEnvironmentColliderProofConfig {
  readonly center: MetaverseVector3Snapshot;
  readonly shape: "box";
  readonly size: MetaverseVector3Snapshot;
}

export interface MetaverseEnvironmentMountProofConfig {
  readonly seatSocketName: string;
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
  readonly environmentAssetId: string;
  readonly label: string;
  readonly lods: readonly MetaverseEnvironmentLodProofConfig[];
  readonly mount: MetaverseEnvironmentMountProofConfig | null;
  readonly placement: "dynamic" | "instanced" | "static";
  readonly placements: readonly MetaverseEnvironmentPlacementProofConfig[];
  readonly physicsColliders: readonly MetaverseEnvironmentColliderProofConfig[] | null;
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

export interface FocusedMountableSnapshot {
  readonly distanceFromCamera: number;
  readonly environmentAssetId: string;
  readonly label: string;
}

export interface MountedEnvironmentSnapshot {
  readonly environmentAssetId: string;
  readonly label: string;
}

export interface MetaverseHudSnapshot {
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
    readonly baseSpeedUnitsPerSecond: number;
    readonly boostCurveExponent: number;
    readonly boostMultiplier: number;
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
