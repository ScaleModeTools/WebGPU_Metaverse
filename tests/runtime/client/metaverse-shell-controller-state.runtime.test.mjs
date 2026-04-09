import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { AudioSettings, PlayerProfile } from "@webgpu-metaverse/shared";

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

test("createInitialMetaverseShellControllerState seeds typed shell policy from hydration", async () => {
  const { createInitialMetaverseShellControllerState } = await clientLoader.load(
    "/src/app/states/metaverse-shell-controller-state.ts"
  );
  const profile = PlayerProfile.create({
    username: "shell-user"
  }).withAudioSettings(
    AudioSettings.create({ musicVolume: 0.3, sfxVolume: 0.65 }).snapshot
  );

  const state = createInitialMetaverseShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      inputMode: "mouse",
      profile,
      source: "profile-record"
    }
  });

  assert.equal(state.profile?.snapshot.username, "shell-user");
  assert.equal(state.hydrationSource, "profile-record");
  assert.equal(state.inputMode, "mouse");
  assert.equal(state.usernameDraft, "shell-user");
  assert.equal(state.capabilitySnapshot.status, "checking");
  assert.equal(state.controllerConfiguration.globalBindingPresetId, "standard");
  assert.equal(state.controllerConfiguration.duckHuntControllerSchemeId, "mouse");
  assert.equal(state.controllerConfiguration.metaverseControllerSchemeId, "keyboard");
  assert.equal(state.debugPanelMode, "hidden");
  assert.equal(state.metaverseControlMode, "keyboard");
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.activeExperienceId, null);
  assert.equal(state.permissionState, "prompt");
  assert.equal(state.sessionMode, "single-player");
});

test("reduceMetaverseShellControllerState keeps hub and experience mutations behind typed actions", async () => {
  const {
    createInitialMetaverseShellControllerState,
    reduceMetaverseShellControllerState
  } = await clientLoader.load("/src/app/states/metaverse-shell-controller-state.ts");
  const baseProfile = PlayerProfile.create({
    username: "arena-user"
  });

  let state = createInitialMetaverseShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      inputMode: "camera-thumb-trigger",
      profile: baseProfile,
      source: "username-only"
    }
  });

  state = reduceMetaverseShellControllerState(state, {
    type: "profileConfirmed",
    profile: baseProfile
  });
  assert.equal(
    state.controllerConfiguration.duckHuntControllerSchemeId,
    "camera-thumb-trigger"
  );
  state = reduceMetaverseShellControllerState(state, {
    type: "permissionRequestStarted"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "permissionResolved",
    permissionError: null,
    permissionState: "granted"
  });
  state = reduceMetaverseShellControllerState(state, {
    mode: "aim-inspector",
    type: "gameplayDebugPanelModeChanged"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "gameplayMenuSetOpen",
    open: true
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "sessionModeChanged",
    sessionMode: "co-op"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "bestScoreRaised",
    bestScore: 300
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "musicVolumeChanged",
    sliderValue: 20
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "sfxVolumeChanged",
    sliderValue: 45
  });

  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.permissionState, "granted");
  assert.equal(state.debugPanelMode, "hidden");
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.isMenuOpen, false);
  assert.equal(state.profile?.snapshot.bestScore, 300);
  assert.equal(state.profile?.snapshot.audioSettings.mix.musicVolume, 0.2);
  assert.equal(state.profile?.snapshot.audioSettings.mix.sfxVolume, 0.45);
  assert.equal(state.sessionMode, "co-op");

  state = reduceMetaverseShellControllerState(state, {
    controlMode: "mouse",
    type: "metaverseControlModeChanged"
  });

  assert.equal(state.metaverseControlMode, "mouse");
  assert.equal(state.controllerConfiguration.metaverseControllerSchemeId, "mouse");

  state = reduceMetaverseShellControllerState(state, {
    type: "globalBindingPresetChanged",
    globalBindingPresetId: "swap-primary-secondary"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseControllerSchemeChanged",
    metaverseControllerSchemeId: "gamepad"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "duckHuntControllerSchemeChanged",
    duckHuntControllerSchemeId: "gamepad-right-stick-aim"
  });

  assert.equal(
    state.controllerConfiguration.globalBindingPresetId,
    "swap-primary-secondary"
  );
  assert.equal(state.controllerConfiguration.metaverseControllerSchemeId, "gamepad");
  assert.equal(
    state.controllerConfiguration.duckHuntControllerSchemeId,
    "gamepad-right-stick-aim"
  );

  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseEntryRequested"
  });

  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.activeExperienceId, null);

  state = reduceMetaverseShellControllerState(state, {
    type: "experienceLaunchRequested",
    experienceId: "duck-hunt"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "gameplayMenuSetOpen",
    open: true
  });

  assert.equal(state.shellStage, "gameplay");
  assert.equal(state.activeExperienceId, "duck-hunt");
  assert.equal(state.isMenuOpen, true);

  state = reduceMetaverseShellControllerState(state, {
    type: "inputModeChanged",
    inputMode: "mouse"
  });

  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.inputMode, "mouse");
  assert.equal(state.activeExperienceId, null);
  assert.equal(state.isMenuOpen, false);
  assert.equal(
    state.controllerConfiguration.duckHuntControllerSchemeId,
    "gamepad-right-stick-aim"
  );

  state = reduceMetaverseShellControllerState(state, {
    type: "setupRequested"
  });

  assert.equal(state.shellStage, "main-menu");

  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseEntryRequested"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "inputModeChanged",
    inputMode: "camera-thumb-trigger"
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "calibrationResetRequested"
  });

  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.profile?.hasAimCalibration, false);
  assert.equal(state.isMenuOpen, false);

  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseReturnRequested"
  });

  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.activeExperienceId, null);

  state = reduceMetaverseShellControllerState(state, {
    type: "profileCleared",
    audioSnapshot: createAudioSnapshot()
  });

  assert.equal(state.profile, null);
  assert.equal(state.hydrationSource, "empty");
  assert.equal(state.inputMode, "mouse");
  assert.equal(state.metaverseControlMode, "keyboard");
  assert.equal(state.controllerConfiguration.globalBindingPresetId, "standard");
  assert.equal(state.controllerConfiguration.duckHuntControllerSchemeId, "mouse");
  assert.equal(state.controllerConfiguration.metaverseControllerSchemeId, "keyboard");
  assert.equal(state.usernameDraft, "");
  assert.equal(state.isMenuOpen, false);
  assert.equal(state.sessionMode, "single-player");
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.activeExperienceId, null);
});
