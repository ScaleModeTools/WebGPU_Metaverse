import {
  AffineAimTransform,
  AudioSettings,
  resolveGameplayInputMode,
  type GameplayInputModeId,
  type PlayerProfile
} from "@webgpu-metaverse/shared";

import { reticleManifest } from "../../assets/config/reticle-manifest";
import { audioFoundationConfig } from "../../audio";
import type { AudioSessionSnapshot } from "../../audio";
import { duckHuntGameFoundationConfig } from "../../experiences/duck-hunt/config";
import { resolveMetaverseControlMode } from "../../metaverse/config/metaverse-control-modes";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse/types/webgpu-capability";
import type { MetaverseControlModeId } from "../../metaverse/types/metaverse-control-mode";
import type { CalibrationShellState } from "../../navigation";

import type { MetaverseShellViewModel } from "../types/metaverse-shell";

interface BuildMetaverseShellViewInput {
  readonly audioSnapshot: AudioSessionSnapshot;
  readonly capabilitySnapshot: WebGpuMetaverseCapabilitySnapshot;
  readonly inputMode: GameplayInputModeId;
  readonly metaverseControlMode: MetaverseControlModeId;
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
  snapshot: WebGpuMetaverseCapabilitySnapshot
): string {
  switch (snapshot.reason) {
    case "adapter-ready":
      return "Gameplay WebGPU adapter ready.";
    case "navigator-gpu-missing":
      return "The browser does not expose navigator.gpu. For local HTTP development, use localhost on the same machine or run HTTPS instead of a LAN IP URL.";
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

function describeCalibrationQuality(
  profile: PlayerProfile | null,
  inputMode: GameplayInputModeId
): string {
  const selectedInputMode = resolveGameplayInputMode(inputMode);

  if (!selectedInputMode.requiresCalibration) {
    return "not required in mouse mode";
  }

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

export function buildMetaverseShellView({
  audioSnapshot,
  capabilitySnapshot,
  inputMode,
  metaverseControlMode,
  profile
}: BuildMetaverseShellViewInput): MetaverseShellViewModel {
  const audioMix =
    profile?.snapshot.audioSettings.mix ?? audioFoundationConfig.defaultMix;
  const selectedInputMode = resolveGameplayInputMode(inputMode);
  const selectedMetaverseControlMode =
    resolveMetaverseControlMode(metaverseControlMode);

  return {
    audioMix,
    audioStatusLabel: describeAudioStatus(audioSnapshot),
    calibrationQualityLabel: describeCalibrationQuality(profile, inputMode),
    calibrationStatusLabel: selectedInputMode.requiresCalibration
      ? profile?.hasAimCalibration === true
        ? "ready"
        : "pending"
      : "not required",
    capabilityReasonLabel: describeCapabilityReason(capabilitySnapshot),
    gameplayInputModeLabel: selectedInputMode.label,
    metaverseControlModeLabel: selectedMetaverseControlMode.label,
    musicVolumeLabel: toPercent(Number(audioMix.musicVolume)),
    musicVolumeSliderValue: toSliderValue(Number(audioMix.musicVolume)),
    reticleCatalogLabel: reticleManifest.reticles
      .map((reticle) => reticle.label)
      .join(" / "),
    runtimeLocks: [
      `Renderer: ${duckHuntGameFoundationConfig.renderer.target}`,
      `Imports: ${duckHuntGameFoundationConfig.renderer.threeImportSurface}`,
      `Shaders: ${duckHuntGameFoundationConfig.renderer.shaderAuthoringModel}`,
      `Tracking: ${duckHuntGameFoundationConfig.runtime.handTrackingExecutionModel}`,
      `Transport: ${duckHuntGameFoundationConfig.runtime.handTrackingTransport}`,
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
