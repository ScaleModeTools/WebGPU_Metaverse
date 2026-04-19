import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createCameraSnapshot({
  x = 0,
  y = 1.6,
  z = 0,
  pitchRadians = 0,
  yawRadians = 0
} = {}) {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians,
    position: Object.freeze({
      x,
      y,
      z
    }),
    yawRadians
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRuntimeCameraPhaseState resolves entry preview, spawn wait, respawn, and death hold in the expected precedence order", async () => {
  const { MetaverseRuntimeCameraPhaseState } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-runtime-camera-phase-state.ts"
  );
  const state = new MetaverseRuntimeCameraPhaseState({
    cameraConfig: Object.freeze({
      far: 200,
      fieldOfViewDegrees: 60,
      initialPitchRadians: 0,
      initialYawRadians: 0.35,
      near: 0.1,
      spawnPosition: Object.freeze({
        x: 2,
        y: 1.7,
        z: 4
      })
    }),
    config: Object.freeze({
      entryPreview: Object.freeze({
        enabled: true,
        framingPadding: 1.2,
        minDistanceMeters: 8,
        minHeightMeters: 6,
        minimumDwellMs: 100,
        pitchRadians: -0.7
      })
    }),
    environmentProofConfig: null,
    portals: Object.freeze([])
  });
  const liveCameraSnapshot = createCameraSnapshot({
    x: 3,
    y: 1.7,
    z: 5,
    yawRadians: 0.35
  });

  state.startEntryPreview(100);

  assert.notEqual(state.resolveBootPresentationSnapshot(100), null);
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 100,
      presenceReady: false,
      worldReady: false
    }).phaseId,
    "entry-preview"
  );

  state.markEntryPreviewLiveReady(200);

  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 250,
      presenceReady: true,
      worldReady: true
    }).phaseId,
    "entry-preview"
  );
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 300,
      presenceReady: false,
      worldReady: true
    }).phaseId,
    "spawn-wait"
  );

  state.setGameplayControlLocked(true);
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 320,
      presenceReady: true,
      worldReady: true
    }).phaseId,
    "spawn-wait"
  );

  state.setGameplayControlLocked(false);
  state.setRespawnControlLocked(true);
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 330,
      presenceReady: true,
      worldReady: true
    }).phaseId,
    "respawn-wait"
  );

  state.setDeathCameraSnapshot(
    createCameraSnapshot({
      x: 9,
      y: 2,
      z: 11,
      pitchRadians: -0.1,
      yawRadians: 1.1
    })
  );
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 340,
      presenceReady: true,
      worldReady: true
    }).phaseId,
    "death-hold"
  );

  state.setDeathCameraSnapshot(null);
  state.setRespawnControlLocked(false);
  assert.equal(
    state.resolveRuntimeCameraPhaseState({
      liveCameraSnapshot,
      liveFocusedPortal: null,
      nowMs: 350,
      presenceReady: true,
      worldReady: true
    }).phaseId,
    "live"
  );
});
