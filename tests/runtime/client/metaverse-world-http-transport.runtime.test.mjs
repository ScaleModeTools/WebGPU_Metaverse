import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseRealtimeWorldEvent,
  createMetaverseVehicleId
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

function createWorldEvent(playerId, snapshotSequence, currentTick, serverTimeMs) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(vehicleId, null);

  return createMetaverseRealtimeWorldEvent({
    world: {
      players: [
        {
          characterId: "mesh2motion-humanoid-v1",
          groundedBody: {
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: 0,
              y: 1.62,
              z: 24
            },
            yawRadians: 0
          },
          locomotionMode: "grounded",
          playerId,
          stateSequence: snapshotSequence,
          username: "Harbor Pilot"
        }
      ],
      snapshotSequence,
      tick: {
        currentTick,
        serverTimeMs,
        tickIntervalMs: 150
      },
      vehicles: [
        {
          angularVelocityRadiansPerSecond: 0,
          environmentAssetId: "metaverse-hub-skiff-v1",
          linearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          position: {
            x: 8,
            y: 0.4,
            z: 12
          },
          seats: [],
          vehicleId,
          yawRadians: 0
        }
      ]
    }
  });
}

test("createMetaverseWorldHttpTransport polls typed realtime world snapshots", async () => {
  const { createMetaverseWorldHttpTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const requests = [];
  const responseQueue = [
    createWorldEvent(playerId, 1, 10, 10_000),
    createWorldEvent(playerId, 2, 11, 10_150)
  ];
  const transport = createMetaverseWorldHttpTransport(
    {
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      async fetch(input, init) {
        const queuedResponse = responseQueue.shift();

        assert.notEqual(queuedResponse, undefined);
        requests.push({
          cache: init?.cache ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, queuedResponse);
      }
    }
  );

  const firstSnapshot = await transport.pollWorldSnapshot(playerId);
  const secondSnapshot = await transport.pollWorldSnapshot(playerId);

  assert.equal(firstSnapshot.world.snapshotSequence, 1);
  assert.equal(secondSnapshot.world.tick.currentTick, 11);
  assert.equal(requests[0]?.method, "GET");
  assert.equal(requests[0]?.cache, "no-store");
  assert.equal(
    requests[0]?.url,
    "http://127.0.0.1:3210/metaverse/world?playerId=harbor-pilot-1"
  );
});

test("createMetaverseWorldHttpTransport rejects invalid realtime world payloads", async () => {
  const { createMetaverseWorldHttpTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const transport = createMetaverseWorldHttpTransport(
    {
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      async fetch() {
        return createJsonResponse(true, {
          type: "world-snapshot",
          world: {
            players: []
          }
        });
      }
    }
  );

  await assert.rejects(
    () => transport.pollWorldSnapshot(playerId),
    /realtime world snapshot/
  );
});

test("createMetaverseWorldHttpTransport posts explicit driver vehicle control commands", async () => {
  const { createMetaverseWorldHttpTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const requests = [];
  const transport = createMetaverseWorldHttpTransport(
    {
      serverOrigin: "http://127.0.0.1:3210",
      worldCommandPath: "/metaverse/world/commands",
      worldPath: "/metaverse/world"
    },
    {
      async fetch(input, init) {
        requests.push({
          body: init?.body ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });

        return createJsonResponse(true, createWorldEvent(playerId, 1, 10, 10_000));
      }
    }
  );

  await transport.sendCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: true,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0.2
      },
      controlSequence: 2,
      playerId
    })
  );

  assert.equal(requests[0]?.method, "POST");
  assert.equal(
    requests[0]?.url,
    "http://127.0.0.1:3210/metaverse/world/commands"
  );
  assert.match(String(requests[0]?.body), /sync-driver-vehicle-control/);
});
