export type ActiveProfileStorageNamespace = "webgpu-metaverse.profile";
export type LegacyProfileStorageNamespace = "thumbshooter.profile";
export type ProfileStorageNamespace =
  | ActiveProfileStorageNamespace
  | LegacyProfileStorageNamespace;

export type ProfileStorageSegment =
  | "username"
  | "record"
  | "calibration"
  | "input-mode";
export type CalibrationRecordVersion = 1 | 2;

export type ProfileStorageKey<TSegment extends ProfileStorageSegment> =
  `${ProfileStorageNamespace}.${TSegment}`;

export interface ProfileStoragePlan {
  readonly usernameStorageKey: ProfileStorageKey<"username">;
  readonly profileStorageKey: ProfileStorageKey<"record">;
  readonly calibrationStorageKey: ProfileStorageKey<"calibration">;
  readonly inputModeStorageKey: ProfileStorageKey<"input-mode">;
  readonly calibrationRecordVersion: CalibrationRecordVersion;
}
