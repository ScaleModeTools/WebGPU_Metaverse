import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId, createUsername } from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  FakeMetaverseWorldClient,
  createRealtimeWorldSnapshot
} from "../runtime/fixtures/fake-world-client.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldConnectionLifecycle swaps client subscriptions cleanly across boot and dispose", async () => {
  const { MetaverseRemoteWorldConnectionLifecycle } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-connection-lifecycle.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");
  const firstClient = new FakeMetaverseWorldClient();
  const secondClient = new FakeMetaverseWorldClient();
  const createdClients = [firstClient, secondClient];
  let updateCount = 0;

  const lifecycle = new MetaverseRemoteWorldConnectionLifecycle({
    createMetaverseWorldClient: () => {
      const nextClient = createdClients.shift();

      if (!nextClient) {
        throw new Error("Expected another fake world client.");
      }

      return nextClient;
    },
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username
    },
    onRemoteWorldUpdate: () => {
      updateCount += 1;
    }
  });

  lifecycle.boot();
  assert.equal(lifecycle.worldClient, firstClient);

  firstClient.publishWorldSnapshotBuffer([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername: username,
      remotePlayerId: createMetaversePlayerId("remote-sailor-2"),
      remotePlayerX: 8,
      remoteUsername: createUsername("Remote Sailor"),
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    })
  ]);
  assert.equal(updateCount, 1);

  lifecycle.boot();
  assert.equal(lifecycle.worldClient, secondClient);
  assert.equal(firstClient.disposeCalls, 1);

  firstClient.publishWorldSnapshotBuffer([]);
  assert.equal(updateCount, 1);

  secondClient.publishWorldSnapshotBuffer([]);
  assert.equal(updateCount, 2);

  lifecycle.dispose();
  assert.equal(secondClient.disposeCalls, 1);
  assert.equal(lifecycle.worldClient, null);

  secondClient.publishWorldSnapshotBuffer([]);
  assert.equal(updateCount, 2);
});

test("MetaverseRemoteWorldConnectionLifecycle only connects once until the active client finishes connecting", async () => {
  const { MetaverseRemoteWorldConnectionLifecycle } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-connection-lifecycle.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");
  const worldClient = new FakeMetaverseWorldClient();
  const lifecycle = new MetaverseRemoteWorldConnectionLifecycle({
    createMetaverseWorldClient: () => worldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username
    },
    onRemoteWorldUpdate() {}
  });

  lifecycle.boot();
  lifecycle.syncConnection(false);
  assert.equal(worldClient.ensureConnectedRequests.length, 0);

  lifecycle.syncConnection(true);
  lifecycle.syncConnection(true);
  assert.equal(worldClient.ensureConnectedRequests.length, 1);
  assert.equal(worldClient.ensureConnectedRequests[0], localPlayerId);

  await Promise.resolve();

  lifecycle.syncConnection(true);
  assert.equal(worldClient.ensureConnectedRequests.length, 1);
});
