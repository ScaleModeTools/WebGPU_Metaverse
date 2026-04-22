import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";
import {
  createManualTimerScheduler,
  flushAsyncWork
} from "./fixtures/metaverse-world-network-test-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseWorldLatestWinsCommandLane resolves send results from the actual write attempt and supersedes stale queued commands", async () => {
  const { MetaverseWorldLatestWinsCommandLane } = await clientLoader.load(
    "/src/network/classes/metaverse-world-latest-wins-command-lane.ts"
  );
  const scheduler = createManualTimerScheduler();
  const sentCommands = [];
  const pendingResolvers = [];
  const lane = new MetaverseWorldLatestWinsCommandLane({
    clearTimeout: scheduler.clearTimeout,
    onStateChange() {},
    recoveryDelayMs: 50,
    async sendDatagram(command) {
      sentCommands.push(command);
      return new Promise((resolve) => {
        pendingResolvers.push(resolve);
      });
    },
    setTimeout: scheduler.setTimeout
  });

  const firstSendPromise = lane.send({ sequence: 1 }, "send failed");
  await flushAsyncWork();

  assert.deepEqual(sentCommands, [{ sequence: 1 }]);

  const secondSendPromise = lane.send({ sequence: 2 }, "send failed");
  const thirdSendPromise = lane.send({ sequence: 3 }, "send failed");

  assert.equal(await secondSendPromise, "superseded");

  pendingResolvers.shift()?.();
  assert.equal(await firstSendPromise, "datagram");
  await flushAsyncWork();

  assert.deepEqual(sentCommands, [{ sequence: 1 }, { sequence: 3 }]);

  pendingResolvers.shift()?.();
  assert.equal(await thirdSendPromise, "datagram");
});

test("MetaverseWorldLatestWinsCommandLane enters reliable fallback after a stalled datagram send", async () => {
  const { MetaverseWorldLatestWinsCommandLane } = await clientLoader.load(
    "/src/network/classes/metaverse-world-latest-wins-command-lane.ts"
  );
  const scheduler = createManualTimerScheduler();
  const lane = new MetaverseWorldLatestWinsCommandLane({
    clearTimeout: scheduler.clearTimeout,
    onStateChange() {},
    recoveryDelayMs: 50,
    async sendDatagram() {
      return new Promise(() => {});
    },
    setTimeout: scheduler.setTimeout
  });

  const sendPromise = lane.send({ sequence: 1 }, "send failed");
  await flushAsyncWork();
  assert.equal(lane.usingReliableFallback, false);

  scheduler.runNext(50);
  await flushAsyncWork();

  assert.equal(await sendPromise, "reliable-fallback");
  assert.equal(lane.usingReliableFallback, true);
  assert.equal(await lane.send({ sequence: 2 }, "send failed"), "reliable-fallback");
});
