import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseRoomId
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport sends driver-control, look, and traversal-intent datagrams", async () => {
  const {
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const roomId = createMetaverseRoomId("tdm-harbor");

  assert.notEqual(playerId, null);
  assert.notEqual(roomId, null);

  const sentDatagrams = [];
  const transport =
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
      {
        roomId,
        webTransportUrl: "https://example.test/metaverse/world"
      },
      {
        channel: {
          dispose() {},
          async sendDatagram(datagram) {
            sentDatagrams.push(datagram);
          }
        }
      }
    );

  const driverControlCommand = createMetaverseSyncDriverVehicleControlCommand({
    controlIntent: {
      boost: true,
      environmentAssetId: "metaverse-hub-skiff-v1",
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0.2
    },
    controlSequence: 2,
    playerId
  });
  const playerTraversalIntentCommand =
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        sequence: 5,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        pitchRadians: -0.25,
        strafeAxis: 0.25,
        yawRadians: 1.1,
        yawAxis: 0.5
      },
      playerId
    });
  const playerLookIntentCommand = createMetaverseSyncPlayerLookIntentCommand({
    lookIntent: {
      pitchRadians: -0.25,
      yawRadians: 1.1
    },
    lookSequence: 3,
    playerId
  });
  await transport.sendDriverVehicleControlDatagram(driverControlCommand);
  await transport.sendPlayerLookIntentDatagram(playerLookIntentCommand);
  await transport.sendPlayerTraversalIntentDatagram(playerTraversalIntentCommand);

  assert.deepEqual(
    sentDatagrams[0],
    createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
      command: driverControlCommand,
      roomId
    })
  );
  assert.deepEqual(
    sentDatagrams[1],
    createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram({
      command: playerLookIntentCommand,
      roomId
    })
  );
  assert.deepEqual(
    sentDatagrams[2],
    createMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram({
      command: playerTraversalIntentCommand,
      roomId
    })
  );
});

test("createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport disposes the underlying datagram channel", async () => {
  const {
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");
  const roomId = createMetaverseRoomId("tdm-harbor");

  assert.notEqual(roomId, null);

  let disposed = false;
  const transport =
    createMetaverseRealtimeWorldLatestWinsWebTransportDatagramTransport(
      {
        roomId,
        webTransportUrl: "https://example.test/metaverse/world"
      },
      {
        channel: {
          dispose() {
            disposed = true;
          },
          async sendDatagram() {}
        }
      }
    );

  transport.dispose();

  assert.equal(disposed, true);
});
