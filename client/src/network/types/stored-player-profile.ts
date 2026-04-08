import type {
  CalibrationShotSample,
  GameplayInputModeId,
  PlayerProfile,
  PlayerProfileSnapshot,
  Username
} from "@thumbshooter/shared";

import type { CalibrationRecordVersion } from "./profile-storage";

export interface StoredPlayerProfileRecord {
  readonly username: Username;
  readonly selectedReticleId: PlayerProfileSnapshot["selectedReticleId"];
  readonly audioSettings: PlayerProfileSnapshot["audioSettings"];
  readonly bestScore: PlayerProfileSnapshot["bestScore"];
}

export interface StoredCalibrationRecord {
  readonly version: CalibrationRecordVersion;
  readonly aimCalibration: PlayerProfileSnapshot["aimCalibration"];
  readonly calibrationSamples: readonly CalibrationShotSample[];
  readonly triggerCalibration: PlayerProfileSnapshot["triggerCalibration"];
}

export interface StoredProfileHydrationResult {
  readonly inputMode: GameplayInputModeId;
  readonly profile: PlayerProfile | null;
  readonly source: "empty" | "username-only" | "profile-record";
}
