import type { ProfileStoragePlan } from "../types/profile-storage";

export const profileStoragePlan = {
  usernameStorageKey: "webgpu-metaverse.profile.username",
  profileStorageKey: "webgpu-metaverse.profile.record",
  calibrationStorageKey: "webgpu-metaverse.profile.calibration",
  inputModeStorageKey: "webgpu-metaverse.profile.input-mode",
  calibrationRecordVersion: 2
} as const satisfies ProfileStoragePlan;

export const legacyProfileStoragePlans = [
  {
    usernameStorageKey: "thumbshooter.profile.username",
    profileStorageKey: "thumbshooter.profile.record",
    calibrationStorageKey: "thumbshooter.profile.calibration",
    inputModeStorageKey: "thumbshooter.profile.input-mode",
    calibrationRecordVersion: 2
  }
] as const satisfies readonly ProfileStoragePlan[];
