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

test("BrowserAudioSession unlocks, primes music, and syncs mix buses", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const createdBuses = [];
  const playedCues = [];
  const context = createFakeAudioContext();
  const session = new BrowserAudioSession({
    createAudioContext: () => context,
    createGainBus: (_context, initialGain) => {
      const bus = createFakeGainBus(initialGain, []);
      createdBuses.push(bus);
      return bus;
    },
    async initializeBackgroundMusic() {},
    playCue({ cueId }) {
      playedCues.push(cueId);
    }
  });

  const unlockSnapshot = await session.unlock();
  const mixSnapshot = session.syncMix({
    musicVolume: 0.2,
    sfxVolume: 0.9
  });
  const cueSnapshot = session.playCue("ui-confirm");

  assert.equal(unlockSnapshot.unlockState, "unlocked");
  assert.equal(unlockSnapshot.backgroundMusicState, "primed");
  assert.equal(createdBuses[1]?.gain.value, 0.2);
  assert.equal(createdBuses[2]?.gain.value, 0.9);
  assert.deepEqual(playedCues, ["ui-confirm"]);
  assert.equal(mixSnapshot.mix.musicVolume, 0.2);
  assert.equal(cueSnapshot.lastCueId, "ui-confirm");
});

test("BrowserAudioSession reports unsupported audio contexts deterministically", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const session = new BrowserAudioSession({
    createAudioContext: () => null,
    createGainBus: () => {
      throw new Error("should not create gain buses");
    },
    async initializeBackgroundMusic() {},
    playCue() {}
  });

  const unlockSnapshot = await session.unlock();

  assert.equal(unlockSnapshot.unlockState, "unsupported");
  assert.match(unlockSnapshot.failureReason ?? "", /AudioContext is unavailable/);
});

test("BrowserAudioSession records background music failures without dropping unlock state", async () => {
  const { BrowserAudioSession } = await clientLoader.load(
    "/src/audio/classes/browser-audio-session.ts"
  );
  const session = new BrowserAudioSession({
    createAudioContext: () => createFakeAudioContext(),
    createGainBus: (_context, initialGain) =>
      createFakeGainBus(initialGain, []),
    async initializeBackgroundMusic() {
      throw new Error("bgm init failed");
    },
    playCue() {}
  });

  const unlockSnapshot = await session.unlock();

  assert.equal(unlockSnapshot.unlockState, "unlocked");
  assert.equal(unlockSnapshot.backgroundMusicState, "failed");
  assert.match(unlockSnapshot.failureReason ?? "", /bgm init failed/);
});
