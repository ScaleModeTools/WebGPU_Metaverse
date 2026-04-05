import {
  PlayerProfile,
  calibrationAnchorIds,
  createUsername,
  reticleIds
} from "@thumbshooter/shared";
import type {
  AudioSettingsSnapshot,
  CalibrationShotSample,
  PlayerProfileSnapshot
} from "@thumbshooter/shared";

import { profileStoragePlan } from "../config/profile-storage";
import type { ProfileStoragePlan } from "../types/profile-storage";
import type {
  StoredCalibrationRecord,
  StoredPlayerProfileRecord,
  StoredProfileHydrationResult
} from "../types/stored-player-profile";

const reticleIdSet = new Set<string>(reticleIds);
const calibrationAnchorIdSet = new Set<string>(calibrationAnchorIds);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readParsedStorageValue(rawValue: string | null): unknown | null {
  if (rawValue === null) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

function isAudioSettingsSnapshot(value: unknown): value is AudioSettingsSnapshot {
  if (!isRecord(value) || !isRecord(value.mix)) {
    return false;
  }

  return (
    value.bgmEngine === "strudel-web" &&
    value.sfxEngine === "web-audio-api" &&
    typeof value.mix.musicVolume === "number" &&
    typeof value.mix.sfxVolume === "number"
  );
}

function isReticleId(
  value: unknown
): value is PlayerProfileSnapshot["selectedReticleId"] {
  return typeof value === "string" && reticleIdSet.has(value);
}

function isCalibrationAnchorId(
  value: unknown
): value is CalibrationShotSample["anchorId"] {
  return typeof value === "string" && calibrationAnchorIdSet.has(value);
}

function isCalibrationShotSample(
  value: unknown
): value is CalibrationShotSample {
  if (!isRecord(value) || !isRecord(value.intendedTarget) || !isRecord(value.observedPose)) {
    return false;
  }

  return (
    isCalibrationAnchorId(value.anchorId) &&
    typeof value.intendedTarget.x === "number" &&
    typeof value.intendedTarget.y === "number" &&
    isRecord(value.observedPose.thumbTip) &&
    isRecord(value.observedPose.indexTip) &&
    typeof value.observedPose.thumbTip.x === "number" &&
    typeof value.observedPose.thumbTip.y === "number" &&
    typeof value.observedPose.indexTip.x === "number" &&
    typeof value.observedPose.indexTip.y === "number"
  );
}

function parseStoredPlayerProfileRecord(
  rawValue: string | null
): StoredPlayerProfileRecord | null {
  const parsedValue = readParsedStorageValue(rawValue);

  if (!isRecord(parsedValue)) {
    return null;
  }

  const username =
    typeof parsedValue.username === "string"
      ? createUsername(parsedValue.username)
      : null;

  if (
    username === null ||
    !isReticleId(parsedValue.selectedReticleId) ||
    !isAudioSettingsSnapshot(parsedValue.audioSettings)
  ) {
    return null;
  }

  return {
    username,
    selectedReticleId: parsedValue.selectedReticleId,
    audioSettings: parsedValue.audioSettings
  };
}

function parseStoredCalibrationRecord(
  rawValue: string | null
): StoredCalibrationRecord | null {
  const parsedValue = readParsedStorageValue(rawValue);

  if (
    !isRecord(parsedValue) ||
    !Array.isArray(parsedValue.calibrationSamples) ||
    !parsedValue.calibrationSamples.every(isCalibrationShotSample)
  ) {
    return null;
  }

  return {
    calibrationSamples: parsedValue.calibrationSamples
  };
}

function readStoredUsername(rawValue: string | null): PlayerProfileSnapshot["username"] | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  return createUsername(rawValue);
}

export class LocalProfileStorage {
  readonly #plan: ProfileStoragePlan;

  constructor(plan: ProfileStoragePlan = profileStoragePlan) {
    this.#plan = plan;
  }

  loadProfile(storage: Storage | null | undefined): StoredProfileHydrationResult {
    if (storage == null) {
      return {
        profile: null,
        source: "empty"
      };
    }

    const storedProfileRecord = parseStoredPlayerProfileRecord(
      storage.getItem(this.#plan.profileStorageKey)
    );
    const storedCalibrationRecord = parseStoredCalibrationRecord(
      storage.getItem(this.#plan.calibrationStorageKey)
    );

    if (storedProfileRecord !== null) {
      return {
        profile: PlayerProfile.fromSnapshot({
          username: storedProfileRecord.username,
          selectedReticleId: storedProfileRecord.selectedReticleId,
          audioSettings: storedProfileRecord.audioSettings,
          calibrationSamples: storedCalibrationRecord?.calibrationSamples ?? []
        }),
        source: "profile-record"
      };
    }

    const storedUsername = readStoredUsername(
      storage.getItem(this.#plan.usernameStorageKey)
    );

    if (storedUsername === null) {
      return {
        profile: null,
        source: "empty"
      };
    }

    return {
      profile: PlayerProfile.create({
        username: storedUsername
      }),
      source: "username-only"
    };
  }

  saveProfile(
    storage: Storage | null | undefined,
    snapshot: PlayerProfileSnapshot
  ): void {
    if (storage == null) {
      return;
    }

    const storedProfileRecord: StoredPlayerProfileRecord = {
      username: snapshot.username,
      selectedReticleId: snapshot.selectedReticleId,
      audioSettings: snapshot.audioSettings
    };
    const storedCalibrationRecord: StoredCalibrationRecord = {
      calibrationSamples: snapshot.calibrationSamples
    };

    storage.setItem(this.#plan.usernameStorageKey, snapshot.username);
    storage.setItem(
      this.#plan.profileStorageKey,
      JSON.stringify(storedProfileRecord)
    );
    storage.setItem(
      this.#plan.calibrationStorageKey,
      JSON.stringify(storedCalibrationRecord)
    );
  }

  clearProfile(storage: Storage | null | undefined): void {
    if (storage == null) {
      return;
    }

    storage.removeItem(this.#plan.usernameStorageKey);
    storage.removeItem(this.#plan.profileStorageKey);
    storage.removeItem(this.#plan.calibrationStorageKey);
  }
}
