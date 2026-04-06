import assert from "node:assert/strict";
import test from "node:test";

import {
  AffineAimTransform,
  AudioSettings,
  PlayerProfile,
  calibrationAnchorIds,
  createCalibrationShotSample,
  createNormalizedViewportPoint,
  createUsername,
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
  assert.equal(profile.snapshot.aimCalibration, null);
  assert.equal(profile.snapshot.bestScore, 0);
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

test("PlayerProfile.withRaisedBestScore only raises the persisted best score", () => {
  const baseProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });
  const raisedProfile = baseProfile.withRaisedBestScore(250.8);
  const unchangedProfile = raisedProfile.withRaisedBestScore(180);

  assert.equal(baseProfile.snapshot.bestScore, 0);
  assert.equal(raisedProfile.snapshot.bestScore, 250);
  assert.equal(unchangedProfile, raisedProfile);
});

test("AffineAimTransform.fit reconstructs an affine screen-space mapping", () => {
  const transform = AffineAimTransform.fit([
    createCalibrationShotSample({
      anchorId: "center",
      intendedTarget: { x: 0.3, y: 0.25 },
      observedPose: {
        thumbTip: { x: 0.1, y: 0.3 },
        indexTip: { x: 0.2, y: 0.2 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-left",
      intendedTarget: { x: 0.7, y: 0.25 },
      observedPose: {
        thumbTip: { x: 0.5, y: 0.3 },
        indexTip: { x: 0.6, y: 0.2 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-right",
      intendedTarget: { x: 0.3, y: 0.65 },
      observedPose: {
        thumbTip: { x: 0.1, y: 0.7 },
        indexTip: { x: 0.2, y: 0.6 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "bottom-left",
      intendedTarget: { x: 0.7, y: 0.65 },
      observedPose: {
        thumbTip: { x: 0.5, y: 0.7 },
        indexTip: { x: 0.6, y: 0.6 }
      }
    })
  ]);

  assert.notEqual(transform, null);
  assert.equal(transform?.apply({ x: 0.4, y: 0.4 }).x, 0.5);
  assert.ok(
    Math.abs((transform?.apply({ x: 0.4, y: 0.4 }).y ?? 0) - 0.45) < 1e-9
  );
});

test("AffineAimTransform.fit tolerates one bad calibration outlier and exposes diagnostics", () => {
  const samples = [
    createCalibrationShotSample({
      anchorId: "center",
      intendedTarget: { x: 0.2, y: 0.2 },
      observedPose: {
        thumbTip: { x: 0.2, y: 0.3 },
        indexTip: { x: 0.2, y: 0.2 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-left",
      intendedTarget: { x: 0.8, y: 0.2 },
      observedPose: {
        thumbTip: { x: 0.8, y: 0.3 },
        indexTip: { x: 0.8, y: 0.2 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-right",
      intendedTarget: { x: 0.2, y: 0.8 },
      observedPose: {
        thumbTip: { x: 0.2, y: 0.9 },
        indexTip: { x: 0.2, y: 0.8 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "bottom-left",
      intendedTarget: { x: 0.8, y: 0.8 },
      observedPose: {
        thumbTip: { x: 0.8, y: 0.9 },
        indexTip: { x: 0.8, y: 0.8 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "top-center",
      intendedTarget: { x: 0.5, y: 0.2 },
      observedPose: {
        thumbTip: { x: 0.5, y: 0.3 },
        indexTip: { x: 0.5, y: 0.2 }
      }
    }),
    createCalibrationShotSample({
      anchorId: "mid-right",
      intendedTarget: { x: 0.92, y: 0.92 },
      observedPose: {
        thumbTip: { x: 0.5, y: 0.3 },
        indexTip: { x: 0.5, y: 0.2 }
      }
    })
  ];
  const transform = AffineAimTransform.fit(samples);
  const diagnostics =
    transform === null ? null : AffineAimTransform.summarizeFit(samples, transform);

  assert.notEqual(transform, null);
  assert.notEqual(diagnostics, null);
  assert.ok(Math.abs((transform?.apply({ x: 0.35, y: 0.45 }).x ?? 0) - 0.35) < 1e-3);
  assert.ok(Math.abs((transform?.apply({ x: 0.35, y: 0.45 }).y ?? 0) - 0.45) < 1e-3);
  assert.equal(diagnostics?.inlierSampleCount, 5);
  assert.equal(diagnostics?.sampleCount, 6);
  assert.equal(diagnostics?.quality, "degraded");
});

test("AffineAimTransform.projectUnclamped preserves off-screen projections", () => {
  const transform = AffineAimTransform.fromSnapshot({
    xCoefficients: [2, 0, -0.5],
    yCoefficients: [0, 1, 0]
  });

  assert.deepEqual(transform.projectUnclamped({ x: 0.9, y: 0.2 }), {
    x: 1.3,
    y: 0.2
  });
  assert.deepEqual(transform.apply({ x: 0.9, y: 0.2 }), {
    x: 1,
    y: 0.2
  });
});

test("PlayerProfile.withAimCalibration stores an immutable fitted transform", () => {
  const baseProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  });
  const transform = AffineAimTransform.fromSnapshot({
    xCoefficients: [1, 0, 0],
    yCoefficients: [0, 1, 0]
  });
  const updatedProfile = baseProfile.withAimCalibration(transform.snapshot);

  assert.equal(baseProfile.snapshot.aimCalibration, null);
  assert.deepEqual(updatedProfile.snapshot.aimCalibration, transform.snapshot);
  assert.equal(Object.isFrozen(updatedProfile.snapshot.aimCalibration), true);
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
    aimCalibration: {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    bestScore: 325.4,
    calibrationSamples: mutableCalibrationSamples
  });

  mutableCalibrationSamples.push(createCalibrationSampleFixture());

  assert.equal(profile.calibrationSampleCount, 1);
  assert.equal(profile.snapshot.bestScore, 325);
  assert.equal(Object.isFrozen(profile.snapshot), true);
  assert.equal(Object.isFrozen(profile.snapshot.aimCalibration), true);
  assert.equal(Object.isFrozen(profile.snapshot.calibrationSamples), true);
  assert.equal(Object.isFrozen(profile.snapshot.audioSettings), true);
});

test("createUsername trims whitespace and rejects blank names", () => {
  assert.equal(createUsername("  ThumbShooter  "), "ThumbShooter");
  assert.equal(createUsername("   "), null);
});

test("PlayerProfile.resetCalibration clears stored calibration samples", () => {
  const resetProfile = PlayerProfile.create({
    username: "thumbshooter-test-user"
  })
    .withCalibrationShot(createCalibrationSampleFixture())
    .withAimCalibration({
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    })
    .resetCalibration();

  assert.equal(resetProfile.calibrationSampleCount, 0);
  assert.equal(resetProfile.snapshot.aimCalibration, null);
  assert.deepEqual(resetProfile.snapshot.calibrationSamples, []);
});
