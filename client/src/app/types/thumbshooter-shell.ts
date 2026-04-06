import type { AudioMixSnapshot } from "@thumbshooter/shared";

type SliderValue = [number];

export interface ThumbShooterShellViewModel {
  readonly audioMix: AudioMixSnapshot;
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly capabilityReasonLabel: string;
  readonly musicVolumeLabel: string;
  readonly musicVolumeSliderValue: SliderValue;
  readonly reticleCatalogLabel: string;
  readonly runtimeLocks: readonly string[];
  readonly selectedReticleLabel: string;
  readonly sfxVolumeLabel: string;
  readonly sfxVolumeSliderValue: SliderValue;
}
