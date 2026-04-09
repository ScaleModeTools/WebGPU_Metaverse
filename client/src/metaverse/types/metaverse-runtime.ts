import type { ExperienceId } from "@thumbshooter/shared";

export const metaverseRuntimeLifecycleStates = [
  "idle",
  "booting",
  "running",
  "failed"
] as const;

export type MetaverseRuntimeLifecycleState =
  (typeof metaverseRuntimeLifecycleStates)[number];

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

export interface MetaverseMovementInputSnapshot {
  ascend: boolean;
  boost: boolean;
  descend: boolean;
  moveBackward: boolean;
  moveForward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
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

export interface FocusedExperiencePortalSnapshot {
  readonly distanceFromCamera: number;
  readonly experienceId: ExperienceId;
  readonly label: string;
}

export interface MetaverseHudSnapshot {
  readonly camera: MetaverseCameraSnapshot;
  readonly failureReason: string | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly lifecycle: MetaverseRuntimeLifecycleState;
  readonly pointerLockActive: boolean;
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
    readonly lookSensitivityRadiansPerPixel: number;
    readonly maxAltitude: number;
    readonly maxPitchRadians: number;
    readonly minAltitude: number;
    readonly minPitchRadians: number;
    readonly worldRadius: number;
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
  readonly portals: readonly MetaversePortalConfig[];
}
