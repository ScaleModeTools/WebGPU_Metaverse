import {
  PlayerProfile,
  calibrationAnchorIds,
  createCalibrationShotSample,
  createHandTriggerCalibrationSnapshot,
  createUsername,
  reticleIds
} from "@webgpu-metaverse/shared";
import type {
  AudioSettingsSnapshot,
  AffineAimTransformSnapshot,
  CalibrationShotSample,
  HandTriggerCalibrationSnapshot,
  GameplayInputModeId,
  PlayerProfileSnapshot
} from "@webgpu-metaverse/shared";
import {
  defaultGameplayInputMode,
  gameplayInputModeIds
} from "@webgpu-metaverse/shared";
import {
  legacyProfileStoragePlans,
  profileStoragePlan
} from "../config/profile-storage";
import type { ProfileStoragePlan } from "../types/profile-storage";
import type {
  StoredCalibrationRecord,
  StoredPlayerProfileRecord,
  StoredProfileHydrationResult
} from "../types/stored-player-profile";

const reticleIdSet = new Set<string>(reticleIds);
const calibrationAnchorIdSet = new Set<string>(calibrationAnchorIds);
const gameplayInputModeIdSet = new Set<string>(gameplayInputModeIds);
const legacyGameplayInputModeAliases = new Map<string, GameplayInputModeId>([
  ["camera-thumb-shooter", "camera-thumb-trigger"]
]);
const persistedProfileStorageKeys = [
  "usernameStorageKey",
  "profileStorageKey",
  "calibrationStorageKey",
  "inputModeStorageKey"
] as const satisfies readonly (keyof ProfileStoragePlan)[];

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

function isGameplayInputMode(value: unknown): value is GameplayInputModeId {
  return typeof value === "string" && gameplayInputModeIdSet.has(value);
}

function readCompatibleGameplayInputMode(
  value: unknown
): GameplayInputModeId | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = legacyGameplayInputModeAliases.get(value) ?? value;

  return isGameplayInputMode(normalizedValue) ? normalizedValue : null;
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
    typeof value.observedPose.indexTip.y === "number" &&
    (value.observedPose.aimPoint === undefined ||
      (isRecord(value.observedPose.aimPoint) &&
        typeof value.observedPose.aimPoint.x === "number" &&
        typeof value.observedPose.aimPoint.y === "number")) &&
    (value.readyTriggerMetrics === undefined ||
      value.readyTriggerMetrics === null ||
      isHandTriggerMetricSnapshot(value.readyTriggerMetrics)) &&
    (value.pressedTriggerMetrics === undefined ||
      value.pressedTriggerMetrics === null ||
      isHandTriggerMetricSnapshot(value.pressedTriggerMetrics))
  );
}

function isHandTriggerMetricSnapshot(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.axisAngleDegrees === "number" &&
    Number.isFinite(value.axisAngleDegrees) &&
    typeof value.engagementRatio === "number" &&
    Number.isFinite(value.engagementRatio)
  );
}

function isHandTriggerCalibrationSnapshot(
  value: unknown
): value is HandTriggerCalibrationSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.sampleCount === "number" &&
    Number.isFinite(value.sampleCount) &&
    typeof value.pressedAxisAngleDegreesMax === "number" &&
    Number.isFinite(value.pressedAxisAngleDegreesMax) &&
    typeof value.pressedEngagementRatioMax === "number" &&
    Number.isFinite(value.pressedEngagementRatioMax) &&
    typeof value.readyAxisAngleDegreesMin === "number" &&
    Number.isFinite(value.readyAxisAngleDegreesMin) &&
    typeof value.readyEngagementRatioMin === "number" &&
    Number.isFinite(value.readyEngagementRatioMin)
  );
}

function isAffineAimTransformSnapshot(
  value: unknown
): value is AffineAimTransformSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const { xCoefficients, yCoefficients } = value;

  return (
    Array.isArray(xCoefficients) &&
    xCoefficients.length === 3 &&
    xCoefficients.every((entry) => typeof entry === "number") &&
    Array.isArray(yCoefficients) &&
    yCoefficients.length === 3 &&
    yCoefficients.every((entry) => typeof entry === "number")
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
    audioSettings: parsedValue.audioSettings,
    bestScore:
      typeof parsedValue.bestScore === "number" && Number.isFinite(parsedValue.bestScore)
        ? Math.max(0, Math.floor(parsedValue.bestScore))
        : 0
  };
}

function parseStoredCalibrationRecord(
  rawValue: string | null,
  expectedVersion: ProfileStoragePlan["calibrationRecordVersion"]
): StoredCalibrationRecord | null {
  const parsedValue = readParsedStorageValue(rawValue);

  if (!isRecord(parsedValue)) {
    return null;
  }

  if (
    parsedValue.version === undefined &&
    Array.isArray(parsedValue.calibrationSamples) &&
    parsedValue.calibrationSamples.every(isCalibrationShotSample)
  ) {
    return {
      version: expectedVersion,
      aimCalibration: null,
      calibrationSamples: parsedValue.calibrationSamples.map((sample) =>
        createCalibrationShotSample(sample)
      ),
      triggerCalibration: null
    };
  }

  if (
    (parsedValue.version !== 1 && parsedValue.version !== expectedVersion) ||
    !Array.isArray(parsedValue.calibrationSamples) ||
    !parsedValue.calibrationSamples.every(isCalibrationShotSample)
  ) {
    return null;
  }

  return {
    version: expectedVersion,
    aimCalibration:
      parsedValue.aimCalibration === null ||
      isAffineAimTransformSnapshot(parsedValue.aimCalibration)
        ? parsedValue.aimCalibration
        : null,
    calibrationSamples: parsedValue.calibrationSamples.map((sample) =>
      createCalibrationShotSample(sample)
    ),
    triggerCalibration:
      parsedValue.version === expectedVersion &&
      (parsedValue.triggerCalibration === null ||
        isHandTriggerCalibrationSnapshot(parsedValue.triggerCalibration))
        ? parsedValue.triggerCalibration === null
          ? null
          : createHandTriggerCalibrationSnapshot(parsedValue.triggerCalibration)
        : null
  };
}

function readStoredUsername(rawValue: string | null): PlayerProfileSnapshot["username"] | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  return createUsername(rawValue);
}

function readStoredInputMode(rawValue: string | null): GameplayInputModeId {
  return readCompatibleGameplayInputMode(rawValue) ?? defaultGameplayInputMode;
}

function readCompatibleStorageValue(
  storage: Storage,
  primaryPlan: ProfileStoragePlan,
  keyName: (typeof persistedProfileStorageKeys)[number]
): string | null {
  for (const plan of [primaryPlan, ...legacyProfileStoragePlans]) {
    const storedValue = storage.getItem(plan[keyName]);

    if (storedValue !== null) {
      return storedValue;
    }
  }

  return null;
}

function clearCompatibleStorageValues(
  storage: Storage,
  primaryPlan: ProfileStoragePlan
): void {
  const removedKeys = new Set<string>();

  for (const plan of [primaryPlan, ...legacyProfileStoragePlans]) {
    for (const keyName of persistedProfileStorageKeys) {
      const storageKey = plan[keyName];

      if (removedKeys.has(storageKey)) {
        continue;
      }

      removedKeys.add(storageKey);
      storage.removeItem(storageKey);
    }
  }
}

function clearLegacyStorageValues(
  storage: Storage,
  primaryPlan: ProfileStoragePlan
): void {
  for (const plan of legacyProfileStoragePlans) {
    for (const keyName of persistedProfileStorageKeys) {
      const legacyStorageKey = plan[keyName];

      if (legacyStorageKey === primaryPlan[keyName]) {
        continue;
      }

      storage.removeItem(legacyStorageKey);
    }
  }
}

export class LocalProfileStorage {
  readonly #plan: ProfileStoragePlan;

  constructor(plan: ProfileStoragePlan = profileStoragePlan) {
    this.#plan = plan;
  }

  loadProfile(storage: Storage | null | undefined): StoredProfileHydrationResult {
    if (storage == null) {
      return {
        inputMode: defaultGameplayInputMode,
        profile: null,
        source: "empty"
      };
    }

    const inputMode = readStoredInputMode(
      readCompatibleStorageValue(storage, this.#plan, "inputModeStorageKey")
    );
    const storedProfileRecord = parseStoredPlayerProfileRecord(
      readCompatibleStorageValue(storage, this.#plan, "profileStorageKey")
    );
    const storedCalibrationRecord = parseStoredCalibrationRecord(
      readCompatibleStorageValue(storage, this.#plan, "calibrationStorageKey"),
      this.#plan.calibrationRecordVersion
    );

    if (storedProfileRecord !== null) {
      return {
        inputMode,
        profile: PlayerProfile.fromSnapshot({
          username: storedProfileRecord.username,
          selectedReticleId: storedProfileRecord.selectedReticleId,
          audioSettings: storedProfileRecord.audioSettings,
          aimCalibration: storedCalibrationRecord?.aimCalibration ?? null,
          bestScore: storedProfileRecord.bestScore,
          calibrationSamples: storedCalibrationRecord?.calibrationSamples ?? [],
          triggerCalibration: storedCalibrationRecord?.triggerCalibration ?? null
        }),
        source: "profile-record"
      };
    }

    const storedUsername = readStoredUsername(
      readCompatibleStorageValue(storage, this.#plan, "usernameStorageKey")
    );

    if (storedUsername === null) {
      return {
        inputMode,
        profile: null,
        source: "empty"
      };
    }

    return {
      inputMode,
      profile: PlayerProfile.create({
        username: storedUsername
      }),
      source: "username-only"
    };
  }

  saveProfile(
    storage: Storage | null | undefined,
    snapshot: PlayerProfileSnapshot,
    inputMode: GameplayInputModeId
  ): void {
    if (storage == null) {
      return;
    }

    const storedProfileRecord: StoredPlayerProfileRecord = {
      username: snapshot.username,
      selectedReticleId: snapshot.selectedReticleId,
      audioSettings: snapshot.audioSettings,
      bestScore: snapshot.bestScore
    };
    const storedCalibrationRecord: StoredCalibrationRecord = {
      version: this.#plan.calibrationRecordVersion,
      aimCalibration: snapshot.aimCalibration,
      calibrationSamples: snapshot.calibrationSamples,
      triggerCalibration: snapshot.triggerCalibration
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
    storage.setItem(this.#plan.inputModeStorageKey, inputMode);
    clearLegacyStorageValues(storage, this.#plan);
  }

  clearProfile(storage: Storage | null | undefined): void {
    if (storage == null) {
      return;
    }

    clearCompatibleStorageValues(storage, this.#plan);
  }
}
