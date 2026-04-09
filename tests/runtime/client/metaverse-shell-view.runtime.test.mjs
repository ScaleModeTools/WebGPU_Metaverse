import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  AffineAimTransform,
  AudioSettings,
  PlayerProfile,
  createCalibrationShotSample
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("buildMetaverseShellView derives stable shell labels from typed state", async () => {
  const { buildMetaverseShellView } = await clientLoader.load(
    "/src/app/states/metaverse-shell-view.ts"
  );
  const profile = PlayerProfile.create({
    username: "shell-user"
  }).withAudioSettings(
    AudioSettings.create({ musicVolume: 0.3, sfxVolume: 0.65 }).snapshot
  );

  const shellView = buildMetaverseShellView({
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
    inputMode: "mouse",
    metaverseControlMode: "keyboard",
    profile
  });

  assert.equal(shellView.audioStatusLabel, "Audio unlocked, Strudel primed");
  assert.equal(shellView.calibrationQualityLabel, "not required in mouse mode");
  assert.equal(shellView.capabilityReasonLabel, "Gameplay WebGPU adapter ready.");
  assert.equal(shellView.gameplayInputModeLabel, "Mouse");
  assert.equal(shellView.metaverseControlModeLabel, "Keyboard");
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

test("buildMetaverseShellView explains the localhost versus LAN IP WebGPU constraint", async () => {
  const { buildMetaverseShellView } = await clientLoader.load(
    "/src/app/states/metaverse-shell-view.ts"
  );

  const shellView = buildMetaverseShellView({
    audioSnapshot: {
      backgroundTrackId: "shell-attract-loop",
      unlockState: "locked",
      backgroundMusicState: "idle",
      mix: {
        musicVolume: 0.5,
        sfxVolume: 0.5
      },
      lastCueId: null,
      failureReason: null
    },
    capabilitySnapshot: {
      status: "unsupported",
      reason: "navigator-gpu-missing"
    },
    inputMode: "mouse",
    metaverseControlMode: "keyboard",
    profile: null
  });

  assert.match(shellView.capabilityReasonLabel, /localhost/);
  assert.match(shellView.capabilityReasonLabel, /LAN IP URL/);
});

test("resolveCalibrationShellState reports reviewed only after a fitted calibration exists", async () => {
  const { resolveCalibrationShellState } = await clientLoader.load(
    "/src/app/states/metaverse-shell-view.ts"
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

test("buildMetaverseShellView summarizes stored calibration quality", async () => {
  const { buildMetaverseShellView } = await clientLoader.load(
    "/src/app/states/metaverse-shell-view.ts"
  );
  const profile = PlayerProfile.create({
    username: "calibrated-user"
  })
    .withCalibrationShot(
      createCalibrationShotSample({
        anchorId: "center",
        intendedTarget: { x: 0.3, y: 0.3 },
        observedPose: {
          thumbTip: { x: 0.3, y: 0.4 },
          indexTip: { x: 0.3, y: 0.3 }
        }
      })
    )
    .withCalibrationShot(
      createCalibrationShotSample({
        anchorId: "top-left",
        intendedTarget: { x: 0.7, y: 0.3 },
        observedPose: {
          thumbTip: { x: 0.7, y: 0.4 },
          indexTip: { x: 0.7, y: 0.3 }
        }
      })
    )
    .withCalibrationShot(
      createCalibrationShotSample({
        anchorId: "top-right",
        intendedTarget: { x: 0.3, y: 0.7 },
        observedPose: {
          thumbTip: { x: 0.3, y: 0.8 },
          indexTip: { x: 0.3, y: 0.7 }
        }
      })
    )
    .withCalibrationShot(
      createCalibrationShotSample({
        anchorId: "bottom-left",
        intendedTarget: { x: 0.7, y: 0.7 },
        observedPose: {
          thumbTip: { x: 0.7, y: 0.8 },
          indexTip: { x: 0.7, y: 0.7 }
        }
      })
    )
    .withAimCalibration(
      AffineAimTransform.fromSnapshot({
        xCoefficients: [1, 0, 0],
        yCoefficients: [0, 1, 0]
      }).snapshot
    );

  const shellView = buildMetaverseShellView({
    audioSnapshot: {
      backgroundTrackId: "birds-arena-loop",
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
    inputMode: "camera-thumb-trigger",
    metaverseControlMode: "mouse",
    profile
  });

  assert.match(shellView.calibrationQualityLabel, /^stable · 4\/4 inliers/);
});

test("updateProfileMix returns a new player profile without mutating the previous snapshot", async () => {
  const { updateProfileMix } = await clientLoader.load(
    "/src/app/states/metaverse-shell-view.ts"
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
