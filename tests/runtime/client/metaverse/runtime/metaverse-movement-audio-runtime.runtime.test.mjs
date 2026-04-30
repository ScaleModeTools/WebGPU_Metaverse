import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createCameraSnapshot() {
  return Object.freeze({
    lookDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    pitchRadians: 0,
    position: Object.freeze({
      x: 0,
      y: 1.62,
      z: 0
    }),
    yawRadians: 0
  });
}

function createCharacterPresentation({
  animationCycleId = 0,
  animationPlaybackRateMultiplier = 1.5,
  animationVocabulary = "walk",
  x,
  y = 0,
  z
}) {
  return Object.freeze({
    animationCycleId,
    animationPlaybackRateMultiplier,
    animationVocabulary,
    position: Object.freeze({
      x,
      y,
      z
    }),
    yawRadians: 0
  });
}

function createRemotePresentation({ playerId, presentation }) {
  return Object.freeze({
    aimCamera: null,
    characterId: "mesh2motion-humanoid-v1",
    combatAlive: true,
    look: Object.freeze({
      pitchRadians: 0,
      yawRadians: 0
    }),
    mountedOccupancy: null,
    playerId,
    poseSyncMode: "runtime-server-sampled",
    presentation,
    teamId: "red",
    username: playerId,
    weaponState: null
  });
}

test("MetaverseMovementAudioRuntime emits animation-marked local and spatial remote footsteps", async () => {
  const { MetaverseMovementAudioRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-movement-audio-runtime.ts"
  );
  const audioCalls = [];
  const runtime = new MetaverseMovementAudioRuntime({
    playAudioCue(cueId, options) {
      audioCalls.push({
        cueId,
        options
      });
    }
  });
  const cameraSnapshot = createCameraSnapshot();

  runtime.sync({
    cameraSnapshot,
    deltaSeconds: 0.1,
    localCharacterPresentation: createCharacterPresentation({
      x: 0,
      z: 0
    }),
    localMounted: false,
    nowMs: 0,
    remoteCharacterPresentations: []
  });
  runtime.sync({
    cameraSnapshot,
    deltaSeconds: 0.19,
    localCharacterPresentation: createCharacterPresentation({
      x: 0.5,
      z: 0
    }),
    localMounted: false,
    nowMs: 190,
    remoteCharacterPresentations: []
  });
  runtime.sync({
    cameraSnapshot,
    deltaSeconds: 0.5,
    localCharacterPresentation: createCharacterPresentation({
      x: 1,
      z: 0
    }),
    localMounted: false,
    nowMs: 690,
    remoteCharacterPresentations: []
  });

  assert.equal(audioCalls.length, 2);
  assert.equal(audioCalls[0].cueId, "metaverse-footstep-left");
  assert.equal(audioCalls[0].options, undefined);
  assert.equal(audioCalls[1].cueId, "metaverse-footstep-right");
  assert.equal(audioCalls[1].options, undefined);

  runtime.sync({
    cameraSnapshot,
    deltaSeconds: 0.1,
    localCharacterPresentation: createCharacterPresentation({
      x: 1.25,
      z: 0
    }),
    localMounted: true,
    nowMs: 790,
    remoteCharacterPresentations: [
      createRemotePresentation({
        playerId: "remote-a",
        presentation: createCharacterPresentation({
          x: 6,
          y: 0.9,
          z: -4
        })
      })
    ]
  });
  runtime.sync({
    cameraSnapshot,
    deltaSeconds: 0.19,
    localCharacterPresentation: createCharacterPresentation({
      x: 1.5,
      z: 0
    }),
    localMounted: true,
    nowMs: 980,
    remoteCharacterPresentations: [
      createRemotePresentation({
        playerId: "remote-a",
        presentation: createCharacterPresentation({
          x: 6.55,
          y: 0.9,
          z: -4
        })
      })
    ]
  });

  assert.equal(audioCalls.length, 3);
  assert.equal(audioCalls[2].cueId, "metaverse-footstep-left");
  assert.equal(audioCalls[2].options.spatial.position.x, 6.55);
  assert.equal(audioCalls[2].options.spatial.position.y, 0.96);
  assert.equal(audioCalls[2].options.spatial.position.z, -4);
  assert.equal(audioCalls[2].options.spatial.maxDistanceMeters, 42);
  assert.equal(audioCalls[2].options.spatial.refDistanceMeters, 3.8);
  assert.equal(audioCalls[2].options.spatial.rolloffFactor, 0.82);
});
