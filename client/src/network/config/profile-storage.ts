import type { ProfileStoragePlan } from "../types/profile-storage";

export const profileStoragePlan = {
  usernameStorageKey: "thumbshooter.profile.username",
  profileStorageKey: "thumbshooter.profile.record",
  calibrationStorageKey: "thumbshooter.profile.calibration",
  inputModeStorageKey: "thumbshooter.profile.input-mode",
  calibrationRecordVersion: 2
} as const satisfies ProfileStoragePlan;
