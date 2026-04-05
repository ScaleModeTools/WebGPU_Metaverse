import assert from "node:assert/strict";
import test from "node:test";

import {
  AudioSettings,
  PlayerProfile,
  calibrationAnchorIds,
  createCalibrationShotSample,
  createNormalizedViewportPoint,
  reticleIds
} from "@thumbshooter/shared";

function createCalibrationSampleFixture() {
  return createCalibrationShotSample({
    anchorId: "center",
    intendedTarget: { x: 0.5, y: 0.5 },
    observedPose: {
      thumbTip: { x: 0.4, y: 0.6 },
      indexTip: { x: 0.55, y: 0.35 }
    }
  });
}

test("PlayerProfile.create uses the default reticle and zero calibration samples", () => {
  const profile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });

  assert.equal(profile.snapshot.selectedReticleId, "default-ring");
  assert.equal(profile.snapshot.audioSettings.bgmEngine, "strudel-web");
  assert.equal(profile.snapshot.audioSettings.sfxEngine, "web-audio-api");
  assert.equal(profile.snapshot.audioSettings.mix.musicVolume, 0.55);
  assert.equal(profile.snapshot.audioSettings.mix.sfxVolume, 0.8);
  assert.equal(profile.calibrationSampleCount, 0);
});

test("PlayerProfile.withSelectedReticle returns a new immutable snapshot", () => {
  const baseProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });
  const updatedProfile = baseProfile.withSelectedReticle("precision-ring");

  assert.notStrictEqual(updatedProfile, baseProfile);
  assert.equal(baseProfile.snapshot.selectedReticleId, "default-ring");
  assert.equal(updatedProfile.snapshot.selectedReticleId, "precision-ring");
});

test("PlayerProfile.withCalibrationShot appends a shot without mutating the old profile", () => {
  const baseProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });
  const updatedProfile = baseProfile.withCalibrationShot(
    createCalibrationSampleFixture()
  );

  assert.equal(baseProfile.calibrationSampleCount, 0);
  assert.equal(updatedProfile.calibrationSampleCount, 1);
  assert.deepEqual(
    updatedProfile.snapshot.calibrationSamples[0],
    createCalibrationSampleFixture()
  );
});

test("AudioSettings clamps mix levels into the supported range", () => {
  const audioSettings = AudioSettings.create({
    musicVolume: -3,
    sfxVolume: 3
  });

  assert.equal(audioSettings.snapshot.mix.musicVolume, 0);
  assert.equal(audioSettings.snapshot.mix.sfxVolume, 1);
});

test("PlayerProfile.withAudioSettings returns a new immutable snapshot", () => {
  const baseProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });
  const updatedProfile = baseProfile.withAudioSettings(
    AudioSettings.create({ musicVolume: 0.25, sfxVolume: 0.9 }).snapshot
  );

  assert.notStrictEqual(updatedProfile, baseProfile);
  assert.equal(baseProfile.snapshot.audioSettings.mix.musicVolume, 0.55);
  assert.equal(updatedProfile.snapshot.audioSettings.mix.musicVolume, 0.25);
  assert.equal(updatedProfile.snapshot.audioSettings.mix.sfxVolume, 0.9);
});

test("shared calibration anchors and reticle ids are unique", () => {
  assert.equal(new Set(calibrationAnchorIds).size, calibrationAnchorIds.length);
  assert.equal(new Set(reticleIds).size, reticleIds.length);
});

test("normalized viewport values clamp into the supported range", () => {
  const point = createNormalizedViewportPoint({ x: -1.25, y: 3.5 });

  assert.equal(point.x, 0);
  assert.equal(point.y, 1);
});

test("PlayerProfile.fromSnapshot rehydrates an immutable cloned snapshot", () => {
  const mutableCalibrationSamples = [createCalibrationSampleFixture()];
  const profile = PlayerProfile.fromSnapshot({
    username: "thumbshooter-test-user",
    selectedReticleId: "default-ring",
    audioSettings: AudioSettings.create({ musicVolume: 3, sfxVolume: -2 }).snapshot,
    calibrationSamples: mutableCalibrationSamples
  });

  mutableCalibrationSamples.push(createCalibrationSampleFixture());

  assert.equal(profile.calibrationSampleCount, 1);
  assert.equal(Object.isFrozen(profile.snapshot), true);
  assert.equal(Object.isFrozen(profile.snapshot.calibrationSamples), true);
  assert.equal(Object.isFrozen(profile.snapshot.audioSettings), true);
});
