export type ProfileStorageNamespace = "webgpu-metaverse.profile";

export type ProfileStorageSegment =
  | "username"
  | "record"
  | "calibration"
  | "input-mode";
export type CalibrationRecordVersion = 2;

export type ProfileStorageKey<TSegment extends ProfileStorageSegment> =
  `${ProfileStorageNamespace}.${TSegment}`;

export interface ProfileStoragePlan {
  readonly usernameStorageKey: ProfileStorageKey<"username">;
  readonly profileStorageKey: ProfileStorageKey<"record">;
  readonly calibrationStorageKey: ProfileStorageKey<"calibration">;
  readonly inputModeStorageKey: ProfileStorageKey<"input-mode">;
  readonly calibrationRecordVersion: CalibrationRecordVersion;
}
