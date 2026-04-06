import {
  AffineAimTransform,
  AudioSettings,
  type PlayerProfile
} from "@thumbshooter/shared";

import { reticleManifest } from "../../assets";
import { audioFoundationConfig } from "../../audio";
import type { AudioSessionSnapshot } from "../../audio";
import { gameFoundationConfig } from "../../game/config/game-foundation";
import type { WebGpuGameplayCapabilitySnapshot } from "../../game/types/webgpu-capability";
import type { CalibrationShellState } from "../../navigation";

import type { ThumbShooterShellViewModel } from "../types/thumbshooter-shell";

interface BuildThumbShooterShellViewInput {
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly capabilitySnapshot: WebGpuGameplayCapabilitySnapshot;
  readonly profile: PlayerProfile | null;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function toSliderValue(value: number): [number] {
  return [Math.round(value * 100)];
}

function toResidualPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function describeCapabilityReason(
  snapshot: WebGpuGameplayCapabilitySnapshot
): string {
  switch (snapshot.reason) {
    case "adapter-ready":
      return "Gameplay WebGPU adapter ready.";
    case "navigator-gpu-missing":
      return "The browser does not expose navigator.gpu.";
    case "adapter-unavailable":
      return "A WebGPU adapter was not returned for gameplay.";
    case "probe-failed":
      return "The WebGPU probe failed before gameplay could start.";
    case "pending":
      return "Checking gameplay WebGPU support.";
  }
}

function describeAudioStatus(snapshot: AudioSessionSnapshot): string {
  if (snapshot.unlockState === "unlocked") {
    return snapshot.backgroundMusicState === "primed"
      ? "Audio unlocked, Strudel primed"
      : "Audio unlocked";
  }

  if (snapshot.unlockState === "unsupported") {
    return "Audio unavailable";
  }

  if (snapshot.unlockState === "failed") {
    return "Audio unlock failed";
  }

  if (snapshot.unlockState === "unlocking") {
    return "Unlocking audio";
  }

  return "Awaiting user gesture";
}

function describeCalibrationQuality(profile: PlayerProfile | null): string {
  if (profile === null || profile.snapshot.aimCalibration === null) {
    return "pending";
  }

  const diagnostics = AffineAimTransform.summarizeFit(
    profile.snapshot.calibrationSamples,
    profile.snapshot.aimCalibration
  );

  if (diagnostics === null) {
    return "pending";
  }

  const qualityLabel =
    diagnostics.quality === "stable"
      ? "stable"
      : diagnostics.quality === "usable"
        ? "usable"
        : "review";

  return `${qualityLabel} · ${diagnostics.inlierSampleCount}/${diagnostics.sampleCount} inliers · max ${toResidualPercent(diagnostics.maxResidual)}`;
}

export function resolveCalibrationShellState(
  profile: PlayerProfile | null
): CalibrationShellState {
  return profile?.hasAimCalibration === true ? "reviewed" : "pending";
}

export function updateProfileMix(
  profile: PlayerProfile,
  updater: (audioSettings: AudioSettings) => AudioSettings
): PlayerProfile {
  return profile.withAudioSettings(
    updater(AudioSettings.fromSnapshot(profile.snapshot.audioSettings)).snapshot
  );
}

export function buildThumbShooterShellView({
  audioSnapshot,
  capabilitySnapshot,
  profile
}: BuildThumbShooterShellViewInput): ThumbShooterShellViewModel {
  const audioMix =
    profile?.snapshot.audioSettings.mix ?? audioFoundationConfig.defaultMix;

  return {
    audioMix,
    audioStatusLabel: describeAudioStatus(audioSnapshot),
    calibrationQualityLabel: describeCalibrationQuality(profile),
    capabilityReasonLabel: describeCapabilityReason(capabilitySnapshot),
    musicVolumeLabel: toPercent(Number(audioMix.musicVolume)),
    musicVolumeSliderValue: toSliderValue(Number(audioMix.musicVolume)),
    reticleCatalogLabel: reticleManifest.reticles
      .map((reticle) => reticle.label)
      .join(" / "),
    runtimeLocks: [
      `Renderer: ${gameFoundationConfig.renderer.target}`,
      `Imports: ${gameFoundationConfig.renderer.threeImportSurface}`,
      `Shaders: ${gameFoundationConfig.renderer.shaderAuthoringModel}`,
      `Tracking: ${gameFoundationConfig.runtime.handTrackingExecutionModel}`,
      `Transport: ${gameFoundationConfig.runtime.handTrackingTransport}`,
      `BGM: ${audioFoundationConfig.music.engine}`,
      `SFX: ${audioFoundationConfig.soundEffects.engine}`
    ],
    selectedReticleLabel:
      reticleManifest.reticles.find(
        (reticle) => reticle.id === profile?.snapshot.selectedReticleId
      )?.label ?? "Default ring",
    sfxVolumeLabel: toPercent(Number(audioMix.sfxVolume)),
    sfxVolumeSliderValue: toSliderValue(Number(audioMix.sfxVolume))
  };
}
