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
  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.hydrationSource, "profile-record");
  assert.equal(state.inputMode, "mouse");
  assert.equal(state.usernameDraft, "shell-user");
  assert.equal(state.capabilitySnapshot.status, "checking");
  assert.equal(state.controllerConfiguration.globalBindingPresetId, "standard");
  assert.equal(state.controllerConfiguration.duckHuntControllerSchemeId, "mouse");
  assert.equal(state.controllerConfiguration.metaverseControllerSchemeId, "keyboard");
  assert.equal(state.metaverseControlMode, "keyboard");
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.activeExperienceId, null);
  assert.equal(state.permissionState, "prompt");
  assert.equal(state.matchMode, "team-deathmatch");
});

test("metaverse entry and tool preview auto-confirm a guest profile when none is stored", async () => {
  const {
    createInitialMetaverseShellControllerState,
    reduceMetaverseShellControllerState
  } = await clientLoader.load("/src/app/states/metaverse-shell-controller-state.ts");
  const { registerMetaverseWorldBundlePreviewEntry } = await clientLoader.load(
    "/src/metaverse/world/bundle-registry/index.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/index.ts"
  );
  const stagingGroundBundle = loadMetaverseMapBundle("staging-ground").bundle;
  const customPreviewBundle = Object.freeze({
    ...stagingGroundBundle,
    label: "Custom Preview",
    mapId: "custom-preview-bundle"
  });

  registerMetaverseWorldBundlePreviewEntry(
    Object.freeze({
      bundle: customPreviewBundle,
      bundleId: customPreviewBundle.mapId,
      label: customPreviewBundle.label,
      mapEditorProjectSettings: null,
      sourceBundleId: "staging-ground"
    })
  );

  let state = createInitialMetaverseShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      inputMode: "mouse",
      profile: null,
      source: "empty"
    }
  });

  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseEntryRequested"
  });

  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.profile?.snapshot.username, "Unknown");
  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.activeMetaverseBundleId, "private-build");
  assert.equal(state.activeMetaverseLaunchVariationId, "shell-team-deathmatch");

  state = reduceMetaverseShellControllerState(state, {
    type: "toolPreviewRequested",
    launchSelection: {
      bundleId: "custom-preview-bundle",
      bundleLabel: "Custom Preview",
      experienceId: null,
      gameplayVariationId: null,
      matchMode: null,
      sourceBundleId: "staging-ground",
      variationId: "custom-free-roam",
      variationLabel: "Custom Free Roam",
      vehicleLayoutId: null,
      weaponLayoutId: null
    }
  });

  state = reduceMetaverseShellControllerState(state, {
    type: "metaverseEntryRequested"
  });

  assert.equal(state.activeMetaverseBundleId, "custom-preview-bundle");
  assert.equal(state.activeMetaverseLaunchVariationId, "custom-free-roam");

  state = reduceMetaverseShellControllerState(state, {
    type: "profileCleared",
    audioSnapshot: createAudioSnapshot()
  });

  state = reduceMetaverseShellControllerState(state, {
    type: "toolPreviewRequested",
    launchSelection: {
      bundleId: "staging-ground",
      bundleLabel: "Staging Ground",
      experienceId: null,
      gameplayVariationId: null,
      matchMode: null,
      sourceBundleId: "staging-ground",
      variationId: "shell-free-roam",
      variationLabel: "Free Roam",
      vehicleLayoutId: null,
      weaponLayoutId: null
    }
  });

  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.profile?.snapshot.username, "Unknown");
  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.activeMetaverseLaunchVariationId, "shell-free-roam");
});

test("deathmatch bundle removes the Duck Hunt portal and keeps the shell TDM launch", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/index.ts"
  );
  const deathmatchBundle = loadMetaverseMapBundle("deathmatch").bundle;

  assert.equal(
    deathmatchBundle.sceneObjects.some(
      (sceneObject) => sceneObject.objectId === "duck-hunt-launch-portal"
    ),
    false
  );
  assert.equal(deathmatchBundle.launchVariations.length, 1);
  assert.equal(
    deathmatchBundle.launchVariations[0]?.variationId,
    "shell-team-deathmatch"
  );
});

test("metaverse launch playlists default team deathmatch to private-build", async () => {
  const {
    defaultMetaverseMapLaunchPlaylistSnapshot,
    normalizeMetaverseMapLaunchPlaylistSnapshot,
    resolveMetaverseMapLaunchSelection
  } = await clientLoader.load("/src/metaverse/world/playlists/index.ts");

  assert.deepEqual(
    defaultMetaverseMapLaunchPlaylistSnapshot.teamDeathmatchBundleIds,
    ["private-build"]
  );
  assert.deepEqual(
    normalizeMetaverseMapLaunchPlaylistSnapshot({
      metaverseDefaultBundleId: null,
      teamDeathmatchBundleIds: ["deathmatch"]
    }).teamDeathmatchBundleIds,
    ["private-build"]
  );
  assert.deepEqual(
    resolveMetaverseMapLaunchSelection(
      defaultMetaverseMapLaunchPlaylistSnapshot,
      "team-deathmatch"
    ),
    {
      bundleId: "private-build",
      launchVariationId: "shell-team-deathmatch"
    }
  );
});

test("calibration reset auto-confirms a guest profile before entering calibration flow", async () => {
  const {
    createInitialMetaverseShellControllerState,
    reduceMetaverseShellControllerState
  } = await clientLoader.load("/src/app/states/metaverse-shell-controller-state.ts");

  let state = createInitialMetaverseShellControllerState({
    audioSnapshot: createAudioSnapshot(),
    hydratedProfile: {
      inputMode: "camera-thumb-trigger",
      profile: null,
      source: "empty"
    }
  });

  state = reduceMetaverseShellControllerState(state, {
    type: "calibrationResetRequested"
  });

  assert.equal(state.hasConfirmedProfile, true);
  assert.equal(state.profile?.snapshot.username, "Unknown");
  assert.equal(state.shellStage, "metaverse");
  assert.equal(state.profile?.hasAimCalibration, false);
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
    type: "gameplayMenuSetOpen",
    open: true
  });
  state = reduceMetaverseShellControllerState(state, {
    type: "matchModeChanged",
    matchMode: "free-roam"
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
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.isMenuOpen, false);
  assert.equal(state.profile?.snapshot.bestScore, 300);
  assert.equal(state.profile?.snapshot.audioSettings.mix.musicVolume, 0.2);
  assert.equal(state.profile?.snapshot.audioSettings.mix.sfxVolume, 0.45);
  assert.equal(state.matchMode, "free-roam");

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
  assert.equal(state.activeMetaverseBundleId, "private-build");
  assert.equal(state.activeMetaverseLaunchVariationId, "shell-free-roam");

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
    type: "gamePlaylistsRequested"
  });

  assert.equal(state.shellStage, "playlists");

  state = reduceMetaverseShellControllerState(state, {
    type: "toolEditorExited"
  });

  assert.equal(state.shellStage, "main-menu");

  state = reduceMetaverseShellControllerState(state, {
    matchMode: "team-deathmatch",
    type: "metaverseEntryRequested"
  });

  assert.equal(state.matchMode, "team-deathmatch");
  assert.equal(state.activeMetaverseBundleId, "private-build");
  assert.equal(state.activeMetaverseLaunchVariationId, "shell-team-deathmatch");

  state = reduceMetaverseShellControllerState(state, {
    bundleId: "deathmatch",
    launchVariationId: "shell-team-deathmatch",
    matchMode: "team-deathmatch",
    type: "metaverseEntryRequested"
  });

  assert.equal(state.activeMetaverseBundleId, "deathmatch");
  assert.equal(state.activeMetaverseLaunchVariationId, "shell-team-deathmatch");

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
  assert.equal(state.matchMode, "team-deathmatch");
  assert.equal(state.shellStage, "main-menu");
  assert.equal(state.activeExperienceId, null);
  assert.equal(state.activeMetaverseBundleId, "private-build");
});
