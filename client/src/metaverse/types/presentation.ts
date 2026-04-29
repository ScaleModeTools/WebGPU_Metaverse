import type {
  MetaversePlayerTeamId,
  MetaversePresenceMountedOccupancySnapshot,
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared";

export const metaverseCharacterAnimationVocabularyIds = [
  "idle",
  "walk",
  "swim-idle",
  "swim",
  "jump-up",
  "jump-mid",
  "jump-down",
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
  readonly animationCycleId?: number;
  readonly animationPlaybackRateMultiplier: number;
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
  readonly combatAlive: boolean;
  readonly look: MetaverseCharacterLookSnapshot;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null;
  readonly playerId: string;
  readonly presentation: MetaverseCharacterPresentationSnapshot;
  readonly poseSyncMode: MetaverseRemoteCharacterPoseSyncMode;
  readonly teamId: MetaversePlayerTeamId;
  readonly username: string;
  readonly weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
}

export interface MetaverseRemoteVehiclePresentationSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseRemoteEnvironmentBodyPresentationSnapshot {
  readonly environmentAssetId: string;
  readonly position: MetaverseVector3Snapshot;
  readonly yawRadians: number;
}
