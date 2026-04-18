import type { MetaversePresenceMountedOccupancySnapshot } from "@webgpu-metaverse/shared";

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
  readonly aimCamera: MetaverseCameraSnapshot | null;
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
