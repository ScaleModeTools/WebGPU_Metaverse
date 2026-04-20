import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportErrorMessage,
  createMetaverseRealtimeWorldWebTransportServerEventMessage,
  createMetaverseVehicleId,
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

test("createMetaverseWorldWebTransportTransport sends explicit realtime world snapshot requests", async () => {
  const { createMetaverseWorldWebTransportTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const vehicleId = createMetaverseVehicleId("harbor-skiff-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);
  assert.notEqual(username, null);

  const requests = [];
  const transport = createMetaverseWorldWebTransportTransport(
    {
      webTransportUrl: "https://example.test/metaverse/world"
    },
    {
      channel: {
        dispose() {},
        async sendRequest(request) {
          requests.push(request);
          return createMetaverseRealtimeWorldWebTransportServerEventMessage({
            event: createMetaverseRealtimeWorldEvent({
              world: {
                players: [
                  {
                    characterId: "mesh2motion-humanoid-v1",
                    linearVelocity: {
                      x: 0,
                      y: 0,
                      z: 0
                    },
                    playerId,
                    position: {
                      x: 0,
                      y: 1.62,
                      z: 24
                    },
                    stateSequence: 1,
                    username,
                    yawRadians: 0
                  }
                ],
                snapshotSequence: 1,
                tick: {
                  currentTick: 10,
                  serverTimeMs: 1_500,
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
            })
          });
        }
      }
    }
  );

  const event = await transport.pollWorldSnapshot(playerId);

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.type, "world-snapshot-request");
  assert.equal(requests[0]?.observerPlayerId, playerId);
  assert.equal(event.type, "world-snapshot");
  assert.equal(event.world.tick.currentTick, 10);
});

test("createMetaverseWorldWebTransportTransport surfaces typed error frames as errors", async () => {
  const { createMetaverseWorldWebTransportTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("missing-player");

  assert.notEqual(playerId, null);

  const transport = createMetaverseWorldWebTransportTransport(
    {
      webTransportUrl: "https://example.test/metaverse/world"
    },
    {
      channel: {
        dispose() {},
        async sendRequest() {
          return createMetaverseRealtimeWorldWebTransportErrorMessage({
            message: "Unknown metaverse player: missing-player"
          });
        }
      }
    }
  );

  await assert.rejects(
    () => transport.pollWorldSnapshot(playerId),
    /Unknown metaverse player/
  );
});

test("createMetaverseWorldWebTransportTransport sends explicit driver vehicle control requests", async () => {
  const { createMetaverseWorldWebTransportTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");

  assert.notEqual(playerId, null);

  const requests = [];
  const transport = createMetaverseWorldWebTransportTransport(
    {
      webTransportUrl: "https://example.test/metaverse/world"
    },
    {
      channel: {
        dispose() {},
        async sendRequest(request) {
          requests.push(request);
          return createMetaverseRealtimeWorldWebTransportServerEventMessage({
            event: createMetaverseRealtimeWorldEvent({
              world: {
                players: [],
                snapshotSequence: 1,
                tick: {
                  currentTick: 10,
                  serverTimeMs: 1_500,
                  tickIntervalMs: 150
                },
                vehicles: []
              }
            })
          });
        }
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

  assert.deepEqual(
    requests[0],
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createMetaverseSyncDriverVehicleControlCommand({
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
    })
  );
});
