import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { AudioSettings, PlayerProfile } from "@thumbshooter/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createAudioSnapshot() {
  return {
    backgroundTrackId: "shell-attract-loop",
    unlockState: "locked",
    backgroundMusicState: "idle",
    mix: {
      musicVolume: 0.55,
      sfxVolume: 0.8
    },
    lastCueId: null,
    failureReason: null
  };
}

test("createInitialThumbShooterShellControllerState seeds typed shell policy from hydration", async () => {
  const { createInitialThumbShooterShellControllerState } = await clientLoader.load(
    "/src/app/states/thumbshooter-shell-controller-state.ts"
  );
  const profile = PlayerProfile.create({
    username: "shell-user"
  }).withAudioSettings(
    AudioSettings.create({ musicVolume: 0.3, sfxVolume: 0.65 }).snapshot
  );

  const state = createInitialThumbShooterShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      profile,
      source: "profile-record"
    }
  });

  assert.equal(state.profile?.snapshot.username, "shell-user");
  assert.equal(state.hydrationSource, "profile-record");
  assert.equal(state.usernameDraft, "shell-user");
  assert.equal(state.capabilitySnapshot.status, "checking");
  assert.equal(state.permissionState, "prompt");
});

test("reduceThumbShooterShellControllerState keeps shell mutations behind typed actions", async () => {
  const {
    createInitialThumbShooterShellControllerState,
    reduceThumbShooterShellControllerState
  } = await clientLoader.load("/src/app/states/thumbshooter-shell-controller-state.ts");
  const baseProfile = PlayerProfile.create({
    username: "arena-user"
  });

  let state = createInitialThumbShooterShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      profile: baseProfile,
      source: "username-only"
    }
  });

  state = reduceThumbShooterShellControllerState(state, {
    type: "profileConfirmed",
    profile: baseProfile
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "permissionRequestStarted"
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "permissionResolved",
    permissionError: null,
    permissionState: "granted"
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "gameplayMenuAutoOpened",
    audioSnapshot: {
      ...createAudioSnapshot(),
      backgroundTrackId: "birds-arena-loop",
      lastCueId: "ui-menu-open"
    }
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "bestScoreRaised",
    bestScore: 300
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "musicVolumeChanged",
    sliderValue: 20
  });
  state = reduceThumbShooterShellControllerState(state, {
    type: "sfxVolumeChanged",
    sliderValue: 45
  });

  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.permissionState, "granted");
  assert.equal(state.isMenuOpen, true);
  assert.equal(state.hasAutoOpenedMenu, true);
  assert.equal(state.profile?.snapshot.bestScore, 300);
  assert.equal(state.profile?.snapshot.audioSettings.mix.musicVolume, 0.2);
  assert.equal(state.profile?.snapshot.audioSettings.mix.sfxVolume, 0.45);

  state = reduceThumbShooterShellControllerState(state, {
    type: "profileCleared",
    audioSnapshot: createAudioSnapshot()
  });

  assert.equal(state.profile, null);
  assert.equal(state.hydrationSource, "empty");
  assert.equal(state.usernameDraft, "");
  assert.equal(state.isMenuOpen, false);
});
