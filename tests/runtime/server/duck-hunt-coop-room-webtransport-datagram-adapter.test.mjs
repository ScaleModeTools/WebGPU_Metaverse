import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopJoinRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram,
  createUsername
} from "@webgpu-metaverse/shared";

import { DuckHuntCoopRoomWebTransportDatagramAdapter } from "../../../server/dist/experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-datagram-adapter.js";
import { CoopRoomDirectory } from "../../../server/dist/experiences/duck-hunt/classes/coop-room-directory.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("DuckHuntCoopRoomWebTransportDatagramAdapter forwards player-presence datagrams into room authority", () => {
  const roomDirectory = new CoopRoomDirectory();
  const adapter = new DuckHuntCoopRoomWebTransportDatagramAdapter(
    roomDirectory
  );
  const session = adapter.openSession();
  const playerId = requireValue(createCoopPlayerId("coop-player-1"), "playerId");
  const roomId = requireValue(createCoopRoomId("co-op-harbor"), "roomId");
  const username = requireValue(createUsername("Co-op Harbor"), "username");

  roomDirectory.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: false,
      roomId,
      username
    }),
    0
  );

  session.receiveClientDatagram(
    createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
      command: {
        aimDirection: {
          x: 0,
          y: 0.25,
          z: -1
        },
        pitchRadians: 0.2,
        playerId,
        position: {
          x: 1,
          y: 1.5,
          z: -2
        },
        roomId,
        stateSequence: 1,
        weaponId: "semiautomatic-pistol",
        yawRadians: 0.4
      }
    }),
    25
  );

  const snapshot = roomDirectory.advanceRoom(roomId, 50, playerId);
  const playerSnapshot = snapshot.players[0];

  assert.equal(snapshot.tick.currentTick, 1);
  assert.equal(playerSnapshot?.playerId, playerId);
  assert.equal(playerSnapshot?.presence.position.x, 1);
  assert.equal(playerSnapshot?.presence.position.y, 1.5);
  assert.equal(playerSnapshot?.presence.position.z, -2);
  assert.equal(playerSnapshot?.presence.pitchRadians, 0.2);
  assert.equal(playerSnapshot?.presence.yawRadians, 0.4);
});

test("DuckHuntCoopRoomWebTransportDatagramAdapter rejects datagrams after disposal", () => {
  const adapter = new DuckHuntCoopRoomWebTransportDatagramAdapter(
    new CoopRoomDirectory()
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createCoopPlayerId("disposed-coop-player"),
    "playerId"
  );
  const roomId = requireValue(
    createCoopRoomId("disposed-coop-room"),
    "roomId"
  );

  session.dispose();

  assert.throws(
    () =>
      session.receiveClientDatagram(
        createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
          command: {
            aimDirection: {
              x: 0,
              y: 0,
              z: -1
            },
            pitchRadians: 0,
            playerId,
            position: {
              x: 0,
              y: 1.35,
              z: 0
            },
            roomId,
            stateSequence: 1,
            weaponId: "semiautomatic-pistol",
            yawRadians: 0
          }
        }),
        0
      ),
    /already been disposed/
  );
});
