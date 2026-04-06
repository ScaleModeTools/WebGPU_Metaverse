import type {
  AudioSettingsCreateInput,
  AudioSettingsSnapshot
} from "./audio-settings.js";
import {
  AffineAimTransform,
  type AffineAimTransformSnapshot
} from "./affine-aim-transform.js";
import { AudioSettings } from "./audio-settings.js";
import {
  createCalibrationShotSample,
  type CalibrationShotSample
} from "./calibration-types.js";
import {
  createHandTriggerCalibrationSnapshot,
  type HandTriggerCalibrationSnapshot
} from "./hand-trigger-calibration.js";
import type { ReticleId } from "./reticle-types.js";
import type { TypeBrand } from "./type-branding.js";

export type Username = TypeBrand<string, "Username">;

export function createUsername(rawValue: string): Username | null {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as Username;
}

export interface PlayerProfileSnapshot {
  readonly username: Username;
  readonly selectedReticleId: ReticleId;
  readonly audioSettings: AudioSettingsSnapshot;
  readonly aimCalibration: AffineAimTransformSnapshot | null;
  readonly bestScore: number;
  readonly calibrationSamples: readonly CalibrationShotSample[];
  readonly triggerCalibration: HandTriggerCalibrationSnapshot | null;
}

export interface PlayerProfileCreateInput {
  readonly username: Username;
  readonly selectedReticleId?: ReticleId;
  readonly audioSettings?: AudioSettingsCreateInput;
}

function freezePlayerProfileSnapshot(
  snapshot: PlayerProfileSnapshot
): PlayerProfileSnapshot {
  return Object.freeze({
    username: snapshot.username,
    selectedReticleId: snapshot.selectedReticleId,
    audioSettings: AudioSettings.fromSnapshot(snapshot.audioSettings).snapshot,
    aimCalibration:
      snapshot.aimCalibration === null
        ? null
        : AffineAimTransform.fromSnapshot(snapshot.aimCalibration).snapshot,
    bestScore: normalizeBestScore(snapshot.bestScore),
    calibrationSamples: Object.freeze(
      snapshot.calibrationSamples.map((sample) => createCalibrationShotSample(sample))
    ),
    triggerCalibration:
      snapshot.triggerCalibration === null
        ? null
        : createHandTriggerCalibrationSnapshot(snapshot.triggerCalibration)
  });
}

function normalizeBestScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export class PlayerProfile {
  readonly #snapshot: PlayerProfileSnapshot;

  private constructor(snapshot: PlayerProfileSnapshot) {
    this.#snapshot = freezePlayerProfileSnapshot(snapshot);
  }

  static create(input: PlayerProfileCreateInput): PlayerProfile {
    return new PlayerProfile({
      username: input.username,
      selectedReticleId: input.selectedReticleId ?? "default-ring",
      audioSettings: AudioSettings.create(input.audioSettings).snapshot,
      aimCalibration: null,
      bestScore: 0,
      calibrationSamples: [],
      triggerCalibration: null
    });
  }

  static fromSnapshot(snapshot: PlayerProfileSnapshot): PlayerProfile {
    return new PlayerProfile(snapshot);
  }

  get snapshot(): PlayerProfileSnapshot {
    return this.#snapshot;
  }

  get calibrationSampleCount(): number {
    return this.#snapshot.calibrationSamples.length;
  }

  get audioSettings(): AudioSettings {
    return AudioSettings.fromSnapshot(this.#snapshot.audioSettings);
  }

  get hasAimCalibration(): boolean {
    return this.#snapshot.aimCalibration !== null;
  }

  get bestScore(): number {
    return this.#snapshot.bestScore;
  }

  resetCalibration(): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      aimCalibration: null,
      calibrationSamples: [],
      triggerCalibration: null
    });
  }

  withSelectedReticle(selectedReticleId: ReticleId): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      selectedReticleId
    });
  }

  withCalibrationShot(sample: CalibrationShotSample): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      aimCalibration: null,
      calibrationSamples: [...this.#snapshot.calibrationSamples, sample],
      triggerCalibration: null
    });
  }

  withAimCalibration(
    aimCalibration: AffineAimTransformSnapshot | null
  ): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      aimCalibration:
        aimCalibration === null
          ? null
          : AffineAimTransform.fromSnapshot(aimCalibration).snapshot
    });
  }

  withTriggerCalibration(
    triggerCalibration: HandTriggerCalibrationSnapshot | null
  ): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      triggerCalibration:
        triggerCalibration === null
          ? null
          : createHandTriggerCalibrationSnapshot(triggerCalibration)
    });
  }

  withAudioSettings(audioSettings: AudioSettingsSnapshot): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      audioSettings: AudioSettings.fromSnapshot(audioSettings).snapshot
    });
  }

  withRaisedBestScore(bestScore: number): PlayerProfile {
    const normalizedBestScore = normalizeBestScore(bestScore);

    if (normalizedBestScore <= this.#snapshot.bestScore) {
      return this;
    }

    return new PlayerProfile({
      ...this.#snapshot,
      bestScore: normalizedBestScore
    });
  }
}
