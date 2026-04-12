import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCoopPlayerId,
  createCoopRoomId,
  createCoopSyncPlayerPresenceCommand,
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport sends explicit player-presence datagrams", async () => {
  const {
    createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");
  const playerId = createCoopPlayerId("coop-player-1");
  const roomId = createCoopRoomId("co-op-harbor");

  assert.notEqual(playerId, null);
  assert.notEqual(roomId, null);

  const sentDatagrams = [];
  const transport =
    createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport(
      {
        webTransportUrl: "https://example.test/duck-hunt/coop"
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

  await transport.sendPlayerPresenceDatagram(
    createCoopSyncPlayerPresenceCommand({
      aimDirection: {
        x: 0,
        y: 0.2,
        z: -1
      },
      pitchRadians: 0.2,
      playerId,
      position: {
        x: 1,
        y: 1.35,
        z: -2
      },
      roomId,
      stateSequence: 2,
      weaponId: "semiautomatic-pistol",
      yawRadians: 0.4
    })
  );

  assert.deepEqual(
    sentDatagrams[0],
    createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
      command: createCoopSyncPlayerPresenceCommand({
        aimDirection: {
          x: 0,
          y: 0.2,
          z: -1
        },
        pitchRadians: 0.2,
        playerId,
        position: {
          x: 1,
          y: 1.35,
          z: -2
        },
        roomId,
        stateSequence: 2,
        weaponId: "semiautomatic-pistol",
        yawRadians: 0.4
      })
    })
  );
});

test("createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport disposes the underlying datagram channel", async () => {
  const {
    createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport
  } = await clientLoader.load("/src/network/index.ts");

  let disposed = false;
  const transport =
    createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport(
      {
        webTransportUrl: "https://example.test/duck-hunt/coop"
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
