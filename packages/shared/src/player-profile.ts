import type {
  AudioSettingsCreateInput,
  AudioSettingsSnapshot
} from "./audio-settings.js";
import { AudioSettings } from "./audio-settings.js";
import {
  createCalibrationShotSample,
  type CalibrationShotSample
} from "./calibration-types.js";
import type { ReticleId } from "./reticle-types.js";
import type { TypeBrand } from "./type-branding.js";

export type Username = TypeBrand<string, "Username">;

export interface PlayerProfileSnapshot {
  readonly username: Username;
  readonly selectedReticleId: ReticleId;
  readonly audioSettings: AudioSettingsSnapshot;
  readonly calibrationSamples: readonly CalibrationShotSample[];
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
    calibrationSamples: Object.freeze(
      snapshot.calibrationSamples.map((sample) => createCalibrationShotSample(sample))
    )
  });
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
      calibrationSamples: []
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

  withSelectedReticle(selectedReticleId: ReticleId): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      selectedReticleId
    });
  }

  withCalibrationShot(sample: CalibrationShotSample): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      calibrationSamples: [...this.#snapshot.calibrationSamples, sample]
    });
  }

  withAudioSettings(audioSettings: AudioSettingsSnapshot): PlayerProfile {
    return new PlayerProfile({
      ...this.#snapshot,
      audioSettings: AudioSettings.fromSnapshot(audioSettings).snapshot
    });
  }
}
