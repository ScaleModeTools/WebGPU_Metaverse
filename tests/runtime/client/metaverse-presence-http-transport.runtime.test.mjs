import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaversePresenceRosterEvent,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createJsonResponse(ok, payload) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

test("createMetaversePresenceHttpTransport serializes commands and polls typed roster snapshots", async () => {
  const { createMetaversePresenceHttpTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const requests = [];
  const responseQueue = [
    createMetaversePresenceRosterEvent({
      players: [],
      snapshotSequence: 1,
      tickIntervalMs: 90
    }),
    createMetaversePresenceRosterEvent({
      players: [],
      snapshotSequence: 2,
      tickIntervalMs: 90
    })
  ];
  const transport = createMetaversePresenceHttpTransport(
    {
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        const queuedResponse = responseQueue.shift();

        assert.notEqual(queuedResponse, undefined);
        requests.push({
          body: init?.body ?? null,
          cache: init?.cache ?? null,
          keepalive: init?.keepalive ?? false,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, queuedResponse);
      }
    }
  );

  await transport.sendCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    {
      deliveryHint: "best-effort-disconnect"
    }
  );
  await transport.pollRosterSnapshot(playerId);

  assert.equal(requests[0]?.method, "POST");
  assert.equal(
    requests[0]?.url,
    "http://127.0.0.1:3210/metaverse/presence/commands"
  );
  assert.deepEqual(
    JSON.parse(String(requests[0]?.body)),
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  );
  assert.equal(requests[0]?.keepalive, true);
  assert.equal(requests[1]?.method, "GET");
  assert.equal(requests[1]?.cache, "no-store");
  assert.equal(
    requests[1]?.url,
    "http://127.0.0.1:3210/metaverse/presence?playerId=harbor-pilot-1"
  );
});

test("createMetaversePresenceHttpTransport rejects outdated roster payloads", async () => {
  const { createMetaversePresenceHttpTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const transport = createMetaversePresenceHttpTransport(
    {
      presencePath: "/metaverse/presence",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch() {
        return createJsonResponse(true, {
          type: "presence-roster",
          roster: {
            players: []
          }
        });
      }
    }
  );

  await assert.rejects(
    () => transport.pollRosterSnapshot(playerId),
    /roster snapshot/
  );
});
