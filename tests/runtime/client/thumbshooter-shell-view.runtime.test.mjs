import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  AffineAimTransform,
  AudioSettings,
  PlayerProfile
} from "@thumbshooter/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("buildThumbShooterShellView derives stable shell labels from typed state", async () => {
  const { buildThumbShooterShellView } = await clientLoader.load(
    "/src/app/states/thumbshooter-shell-view.ts"
  );
  const profile = PlayerProfile.create({
    username: "shell-user"
  }).withAudioSettings(
    AudioSettings.create({ musicVolume: 0.3, sfxVolume: 0.65 }).snapshot
  );

  const shellView = buildThumbShooterShellView({
    audioSnapshot: {
      backgroundTrackId: "shell-attract-loop",
      unlockState: "unlocked",
      backgroundMusicState: "primed",
      mix: profile.snapshot.audioSettings.mix,
      lastCueId: null,
      failureReason: null
    },
    capabilitySnapshot: {
      status: "supported",
      reason: "adapter-ready"
    },
    profile
  });

  assert.equal(shellView.audioStatusLabel, "Audio unlocked, Strudel primed");
  assert.equal(shellView.capabilityReasonLabel, "Gameplay WebGPU adapter ready.");
  assert.equal(shellView.musicVolumeLabel, "30%");
  assert.equal(shellView.sfxVolumeLabel, "65%");
  assert.deepEqual(shellView.musicVolumeSliderValue, [30]);
  assert.equal(shellView.selectedReticleLabel, "Default ring");
  assert.match(shellView.reticleCatalogLabel, /Precision ring/);
  assert.deepEqual(shellView.runtimeLocks.slice(0, 2), [
    "Renderer: webgpu",
    "Imports: three/webgpu"
  ]);
});

test("resolveCalibrationShellState reports reviewed only after a fitted calibration exists", async () => {
  const { resolveCalibrationShellState } = await clientLoader.load(
    "/src/app/states/thumbshooter-shell-view.ts"
  );
  const pendingProfile = PlayerProfile.create({
    username: "pending-user"
  });
  const reviewedProfile = pendingProfile.withAimCalibration(
    AffineAimTransform.fromSnapshot({
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    }).snapshot
  );

  assert.equal(resolveCalibrationShellState(null), "pending");
  assert.equal(resolveCalibrationShellState(pendingProfile), "pending");
  assert.equal(resolveCalibrationShellState(reviewedProfile), "reviewed");
});

test("updateProfileMix returns a new player profile without mutating the previous snapshot", async () => {
  const { updateProfileMix } = await clientLoader.load(
    "/src/app/states/thumbshooter-shell-view.ts"
  );
  const profile = PlayerProfile.create({
    username: "mix-user"
  });

  const nextProfile = updateProfileMix(profile, (audioSettings) =>
    audioSettings.withMusicVolume(0.2).withSfxVolume(0.4)
  );

  assert.notEqual(nextProfile, profile);
  assert.equal(profile.snapshot.audioSettings.mix.musicVolume, 0.55);
  assert.equal(profile.snapshot.audioSettings.mix.sfxVolume, 0.8);
  assert.equal(nextProfile.snapshot.audioSettings.mix.musicVolume, 0.2);
  assert.equal(nextProfile.snapshot.audioSettings.mix.sfxVolume, 0.4);
});
