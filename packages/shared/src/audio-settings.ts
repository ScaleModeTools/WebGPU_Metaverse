import type { TypeBrand } from "./type-branding.js";

export const audioChannelIds = ["music", "sfx"] as const;

export type AudioChannelId = (typeof audioChannelIds)[number];

export const backgroundMusicEngines = ["strudel-web"] as const;

export type BackgroundMusicEngine = (typeof backgroundMusicEngines)[number];

export const soundEffectEngines = ["web-audio-api"] as const;

export type SoundEffectEngine = (typeof soundEffectEngines)[number];

export type AudioLevel = TypeBrand<number, "AudioLevel">;

export interface AudioMixSnapshot {
  readonly musicVolume: AudioLevel;
  readonly sfxVolume: AudioLevel;
}

export interface AudioSettingsSnapshot {
  readonly bgmEngine: BackgroundMusicEngine;
  readonly sfxEngine: SoundEffectEngine;
  readonly mix: AudioMixSnapshot;
}

export interface AudioSettingsCreateInput {
  readonly musicVolume?: number;
  readonly sfxVolume?: number;
}

function freezeAudioMixSnapshot(mix: AudioMixSnapshot): AudioMixSnapshot {
  return Object.freeze({
    musicVolume: createAudioLevel(mix.musicVolume),
    sfxVolume: createAudioLevel(mix.sfxVolume)
  });
}

function freezeAudioSettingsSnapshot(
  snapshot: AudioSettingsSnapshot
): AudioSettingsSnapshot {
  return Object.freeze({
    bgmEngine: snapshot.bgmEngine,
    sfxEngine: snapshot.sfxEngine,
    mix: freezeAudioMixSnapshot(snapshot.mix)
  });
}

function clampAudioLevel(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, rawValue));
}

export function createAudioLevel(rawValue: number): AudioLevel {
  return clampAudioLevel(rawValue) as AudioLevel;
}

export class AudioSettings {
  readonly #snapshot: AudioSettingsSnapshot;

  private constructor(snapshot: AudioSettingsSnapshot) {
    this.#snapshot = freezeAudioSettingsSnapshot(snapshot);
  }

  static create(input: AudioSettingsCreateInput = {}): AudioSettings {
    return new AudioSettings({
      bgmEngine: "strudel-web",
      sfxEngine: "web-audio-api",
      mix: {
        musicVolume: createAudioLevel(input.musicVolume ?? 0.55),
        sfxVolume: createAudioLevel(input.sfxVolume ?? 0.8)
      }
    });
  }

  static fromSnapshot(snapshot: AudioSettingsSnapshot): AudioSettings {
    return new AudioSettings(freezeAudioSettingsSnapshot(snapshot));
  }

  get snapshot(): AudioSettingsSnapshot {
    return this.#snapshot;
  }

  withMusicVolume(musicVolume: number): AudioSettings {
    return new AudioSettings(freezeAudioSettingsSnapshot({
      ...this.#snapshot,
      mix: {
        ...this.#snapshot.mix,
        musicVolume: createAudioLevel(musicVolume)
      }
    }));
  }

  withSfxVolume(sfxVolume: number): AudioSettings {
    return new AudioSettings(freezeAudioSettingsSnapshot({
      ...this.#snapshot,
      mix: {
        ...this.#snapshot.mix,
        sfxVolume: createAudioLevel(sfxVolume)
      }
    }));
  }
}
