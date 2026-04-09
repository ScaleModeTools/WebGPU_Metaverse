import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  AffineAimTransform,
  AudioSettings,
  PlayerProfile,
  createCalibrationShotSample,
  createHandTriggerCalibrationSnapshot
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

class MemoryStorage {
  #entries = new Map();

  getItem(key) {
    return this.#entries.has(key) ? this.#entries.get(key) : null;
  }

  removeItem(key) {
    this.#entries.delete(key);
  }

  setItem(key, value) {
    this.#entries.set(key, String(value));
  }
}

function createCalibrationFixture() {
  return createCalibrationShotSample({
    anchorId: "center",
    intendedTarget: { x: 0.5, y: 0.5 },
    observedPose: {
      thumbTip: { x: 0.4, y: 0.6 },
      indexTip: { x: 0.55, y: 0.35 }
    }
  });
}

test("LocalProfileStorage saves and reloads a persisted player profile", async () => {
  const { LocalProfileStorage } = await clientLoader.load(
    "/src/network/classes/local-profile-storage.ts"
  );
  const storage = new MemoryStorage();
  const profileStorage = new LocalProfileStorage();
  const profile = PlayerProfile.create({
    username: "webgpu-metaverse-user"
  })
    .withRaisedBestScore(400)
    .withAudioSettings(AudioSettings.create({ musicVolume: 0.3, sfxVolume: 0.6 }).snapshot)
    .withCalibrationShot(createCalibrationFixture())
    .withTriggerCalibration(
      createHandTriggerCalibrationSnapshot({
        sampleCount: 1,
        pressedAxisAngleDegreesMax: 15,
        pressedEngagementRatioMax: 0.48,
        readyAxisAngleDegreesMin: 34,
        readyEngagementRatioMin: 1.02
      })
    )
    .withAimCalibration(
      AffineAimTransform.fromSnapshot({
        xCoefficients: [1, 0, 0],
        yCoefficients: [0, 1, 0]
      }).snapshot
    );

  profileStorage.saveProfile(storage, profile.snapshot, "mouse");

  const hydration = profileStorage.loadProfile(storage);

  assert.equal(hydration.source, "profile-record");
  assert.equal(hydration.inputMode, "mouse");
  assert.equal(hydration.profile?.snapshot.username, "webgpu-metaverse-user");
  assert.equal(hydration.profile?.snapshot.audioSettings.mix.musicVolume, 0.3);
  assert.equal(hydration.profile?.snapshot.bestScore, 400);
  assert.equal(hydration.profile?.calibrationSampleCount, 1);
  assert.deepEqual(hydration.profile?.snapshot.aimCalibration, {
    xCoefficients: [1, 0, 0],
    yCoefficients: [0, 1, 0]
  });
  assert.deepEqual(hydration.profile?.snapshot.triggerCalibration, {
    sampleCount: 1,
    pressedAxisAngleDegreesMax: 15,
    pressedEngagementRatioMax: 0.48,
    readyAxisAngleDegreesMin: 34,
    readyEngagementRatioMin: 1.02
  });
});

test("LocalProfileStorage rehydrates username-only storage into a fresh profile", async () => {
  const { LocalProfileStorage } = await clientLoader.load(
    "/src/network/classes/local-profile-storage.ts"
  );
  const { profileStoragePlan } = await clientLoader.load(
    "/src/network/config/profile-storage.ts"
  );
  const storage = new MemoryStorage();

  storage.setItem(profileStoragePlan.usernameStorageKey, "  shell-user  ");

  const hydration = new LocalProfileStorage().loadProfile(storage);

  assert.equal(hydration.source, "username-only");
  assert.equal(hydration.inputMode, "mouse");
  assert.equal(hydration.profile?.snapshot.username, "shell-user");
  assert.equal(hydration.profile?.snapshot.aimCalibration, null);
  assert.equal(hydration.profile?.snapshot.bestScore, 0);
  assert.equal(hydration.profile?.calibrationSampleCount, 0);
});

test("LocalProfileStorage defaults unknown gameplay input mode ids back to mouse", async () => {
  const { LocalProfileStorage } = await clientLoader.load(
    "/src/network/classes/local-profile-storage.ts"
  );
  const { profileStoragePlan } = await clientLoader.load(
    "/src/network/config/profile-storage.ts"
  );
  const storage = new MemoryStorage();

  storage.setItem(profileStoragePlan.usernameStorageKey, "shell-user");
  storage.setItem(profileStoragePlan.inputModeStorageKey, "camera-thumb-shooter");

  const hydration = new LocalProfileStorage().loadProfile(storage);

  assert.equal(hydration.inputMode, "mouse");
  assert.equal(hydration.profile?.snapshot.username, "shell-user");
});

test("LocalProfileStorage ignores outdated calibration records without the current version", async () => {
  const { LocalProfileStorage } = await clientLoader.load(
    "/src/network/classes/local-profile-storage.ts"
  );
  const { profileStoragePlan } = await clientLoader.load(
    "/src/network/config/profile-storage.ts"
  );
  const storage = new MemoryStorage();

  storage.setItem(
    profileStoragePlan.profileStorageKey,
    JSON.stringify({
      username: "legacy-user",
      selectedReticleId: "default-ring",
      audioSettings: AudioSettings.create().snapshot
    })
  );
  storage.setItem(
    profileStoragePlan.calibrationStorageKey,
    JSON.stringify({
      calibrationSamples: [createCalibrationFixture()]
    })
  );

  const hydration = new LocalProfileStorage().loadProfile(storage);

  assert.equal(hydration.inputMode, "mouse");
  assert.equal(hydration.profile?.snapshot.username, "legacy-user");
  assert.equal(hydration.profile?.snapshot.aimCalibration, null);
  assert.equal(hydration.profile?.snapshot.bestScore, 0);
  assert.equal(hydration.profile?.calibrationSampleCount, 0);
  assert.equal(hydration.profile?.snapshot.triggerCalibration, null);
});

test("LocalProfileStorage clears all persisted keys", async () => {
  const { LocalProfileStorage } = await clientLoader.load(
    "/src/network/classes/local-profile-storage.ts"
  );
  const { profileStoragePlan } = await clientLoader.load(
    "/src/network/config/profile-storage.ts"
  );
  const storage = new MemoryStorage();
  const profileStorage = new LocalProfileStorage();

  profileStorage.saveProfile(
    storage,
    PlayerProfile.create({ username: "clear-me" }).snapshot,
    "mouse"
  );
  profileStorage.clearProfile(storage);

  assert.equal(storage.getItem(profileStoragePlan.usernameStorageKey), null);
  assert.equal(storage.getItem(profileStoragePlan.profileStorageKey), null);
  assert.equal(storage.getItem(profileStoragePlan.calibrationStorageKey), null);
  assert.equal(storage.getItem(profileStoragePlan.inputModeStorageKey), null);
});
