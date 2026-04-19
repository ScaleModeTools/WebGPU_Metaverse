import type { FocusedExperiencePortalSnapshot } from "./mounted";
import type { MetaverseCameraSnapshot } from "./presentation";

export const metaverseRuntimeCameraPhaseIds = [
  "entry-preview",
  "spawn-wait",
  "live",
  "death-hold",
  "respawn-wait"
] as const;

export type MetaverseRuntimeCameraPhaseId =
  (typeof metaverseRuntimeCameraPhaseIds)[number];

export interface MetaverseRuntimeCameraPhaseConfig {
  readonly entryPreview: {
    readonly enabled: boolean;
    readonly framingPadding: number;
    readonly minDistanceMeters: number;
    readonly minHeightMeters: number;
    readonly minimumDwellMs: number;
    readonly pitchRadians: number;
  };
}

export interface MetaverseRuntimeCameraPhasePresentationSnapshot {
  readonly cameraSnapshot: MetaverseCameraSnapshot;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
}

export interface MetaverseRuntimeCameraPhaseStateSnapshot {
  readonly blocksMovementInput: boolean;
  readonly hidesLocalCharacter: boolean;
  readonly phaseId: MetaverseRuntimeCameraPhaseId;
  readonly presentationSnapshot: MetaverseRuntimeCameraPhasePresentationSnapshot | null;
  readonly suppressesInteractionFocus: boolean;
}
