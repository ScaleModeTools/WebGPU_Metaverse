import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createFakeGainBus(initialGain, connectionLog) {
  return {
    gain: {
      value: initialGain
    },
    connect(target) {
      connectionLog.push(target);
    }
  };
}

function createFakeAudioContext() {
  const context = {
    currentTime: 12,
    destination: {},
    state: "suspended",
    async resume() {
      context.state = "running";
    }
  };

  return context;
}

function createTestAudioSessionConfig() {
  return {
    contentCatalog: {
      backgroundTracks: {
        "birds-arena-loop": {
          buildPattern() {
            throw new Error("background track pattern should not run in this test");
          },
          label: "Birds arena loop"
        },
        "shell-attract-loop": {
          buildPattern() {
            throw new Error("background track pattern should not run in this test");
          },
          label: "Shell attract loop"
        }
      },
      cues: {
        "ui-confirm": {
          label: "UI confirm",
          play() {}
        }
      }
    },
    foundation: {
      defaultMix: {
        musicVolume: 1,
        sfxVolume: 1
      },
      music: {
        engine: "strudel-web",
        licenseConstraint: "agpl-open-source-required",
        mode: "procedural-reactive-bgm",
        startPolicy: "shell-load-play-after-unlock"
      },
      runtime: {
        graphOwnership: "single-shared-audio-context",
        settingsPersistence: "player-profile",
        unlockPolicy: "first-user-gesture"
      },
      soundEffects: {
        engine: "web-audio-api",
        synthesisStrategy: "typed-procedural-cues"
      }
    },
    initialBackgroundTrackId: "shell-attract-loop"
  };
}

test("BrowserAudioSession unlocks, primes music, switches typed tracks, and syncs mix buses", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const createdBuses = [];
  const playedCues = [];
  const playedTracks = [];
  let stopCalls = 0;
  const context = createFakeAudioContext();
  const session = new BrowserAudioSession(
    createTestAudioSessionConfig(),
    {
      createAudioContext: () => context,
      createGainBus: (_context, initialGain) => {
        const bus = createFakeGainBus(initialGain, []);
        createdBuses.push(bus);
        return bus;
      },
      async initializeBackgroundMusic() {
        return {
          playTrack(trackId) {
            playedTracks.push(trackId);
          },
          stop() {
            stopCalls += 1;
          }
        };
      },
      playCue({ cueId, options }) {
        playedCues.push({
          cueId,
          spatial: options?.spatial?.position ?? null
        });
      }
    }
  );

  const deferredTrackSnapshot = session.syncBackgroundTrack("birds-arena-loop");
  const unlockSnapshot = await session.unlock();
  const shellTrackSnapshot = session.syncBackgroundTrack("shell-attract-loop");
  const mixSnapshot = session.syncMix({
    musicVolume: 0.2,
    sfxVolume: 0.9
  });
  const cueSnapshot = session.playCue("ui-confirm", {
    spatial: {
      listener: {
        forward: { x: 0, y: 0, z: -1 },
        position: { x: 0, y: 1.6, z: 0 },
        up: { x: 0, y: 1, z: 0 }
      },
      position: { x: 3, y: 1.6, z: -4 }
    }
  });
  const stoppedTrackSnapshot = session.syncBackgroundTrack(null);

  assert.equal(unlockSnapshot.unlockState, "unlocked");
  assert.equal(unlockSnapshot.backgroundMusicState, "primed");
  assert.equal(deferredTrackSnapshot.backgroundTrackId, "birds-arena-loop");
  assert.equal(shellTrackSnapshot.backgroundTrackId, "shell-attract-loop");
  assert.equal(stoppedTrackSnapshot.backgroundTrackId, null);
  assert.equal(createdBuses[1]?.gain.value, 0.2);
  assert.equal(createdBuses[2]?.gain.value, 0.9);
  assert.deepEqual(playedTracks, ["birds-arena-loop", "shell-attract-loop"]);
  assert.equal(stopCalls, 1);
  assert.deepEqual(playedCues, [
    {
      cueId: "ui-confirm",
      spatial: { x: 3, y: 1.6, z: -4 }
    }
  ]);
  assert.equal(mixSnapshot.mix.musicVolume, 0.2);
  assert.equal(cueSnapshot.lastCueId, "ui-confirm");
});

test("BrowserAudioSession reports unsupported audio contexts deterministically", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const session = new BrowserAudioSession(
    createTestAudioSessionConfig(),
    {
      createAudioContext: () => null,
      createGainBus: () => {
        throw new Error("should not create gain buses");
      },
      async initializeBackgroundMusic() {
        throw new Error("should not initialize background music");
      },
      playCue() {}
    }
  );

  const unlockSnapshot = await session.unlock();

  assert.equal(unlockSnapshot.unlockState, "unsupported");
  assert.match(unlockSnapshot.failureReason ?? "", /AudioContext is unavailable/);
});

test("BrowserAudioSession records background music failures without dropping unlock state", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const session = new BrowserAudioSession(
    createTestAudioSessionConfig(),
    {
      createAudioContext: () => createFakeAudioContext(),
      createGainBus: (_context, initialGain) =>
        createFakeGainBus(initialGain, []),
      async initializeBackgroundMusic() {
        throw new Error("bgm init failed");
      },
      playCue() {}
    }
  );

  const unlockSnapshot = await session.unlock();

  assert.equal(unlockSnapshot.unlockState, "unlocked");
  assert.equal(unlockSnapshot.backgroundMusicState, "failed");
  assert.match(unlockSnapshot.failureReason ?? "", /bgm init failed/);
});
