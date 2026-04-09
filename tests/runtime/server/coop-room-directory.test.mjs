import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopJoinRoomCommand,
  createCoopLeaveRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createUsername
} from "@thumbshooter/shared";

import { CoopRoomDirectory } from "../../../server/dist/classes/coop-room-directory.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("CoopRoomDirectory creates isolated runtimes for distinct room ids", () => {
  const roomDirectory = new CoopRoomDirectory();
  const harborRoomId = requireValue(
    createCoopRoomId("co-op-harbor"),
    "harborRoomId"
  );
  const inletRoomId = requireValue(
    createCoopRoomId("co-op-inlet"),
    "inletRoomId"
  );
  const harborPlayerId = requireValue(
    createCoopPlayerId("harbor-player"),
    "harborPlayerId"
  );
  const inletPlayerId = requireValue(
    createCoopPlayerId("inlet-player"),
    "inletPlayerId"
  );

  const harborEvent = roomDirectory.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: harborPlayerId,
      ready: false,
      roomId: harborRoomId,
      username: requireValue(createUsername("alpha"), "alphaUsername")
    }),
    0
  );
  const inletEvent = roomDirectory.acceptCommand(
    createCoopJoinRoomCommand({
      playerId: inletPlayerId,
      ready: false,
      roomId: inletRoomId,
      username: requireValue(createUsername("bravo"), "bravoUsername")
    }),
    0
  );

  assert.equal(harborEvent.room.roomId, harborRoomId);
  assert.equal(inletEvent.room.roomId, inletRoomId);
  assert.equal(
    roomDirectory
      .listRoomSnapshots(0)
      .map((roomSnapshot) => roomSnapshot.roomId)
      .join(","),
    [harborRoomId, inletRoomId].join(",")
  );
});

test("CoopRoomDirectory drops empty rooms after the last player leaves", () => {
  const roomDirectory = new CoopRoomDirectory();
  const roomId = requireValue(createCoopRoomId("co-op-empty"), "roomId");
  const playerId = requireValue(createCoopPlayerId("solo-player"), "playerId");

  roomDirectory.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("solo"), "soloUsername")
    }),
    0
  );
  roomDirectory.acceptCommand(
    createCoopLeaveRoomCommand({
      playerId,
      roomId
    }),
    10
  );

  assert.equal(roomDirectory.listRoomSnapshots(10).length, 0);
  assert.throws(
    () => roomDirectory.advanceRoom(roomId, 10),
    /Unknown co-op room: co-op-empty/
  );
});

test("CoopRoomDirectory prunes rooms once their players stop polling", () => {
  const roomDirectory = new CoopRoomDirectory();
  const roomId = requireValue(createCoopRoomId("co-op-stale"), "roomId");
  const playerId = requireValue(createCoopPlayerId("stale-player"), "playerId");

  roomDirectory.acceptCommand(
    createCoopJoinRoomCommand({
      playerId,
      ready: false,
      roomId,
      username: requireValue(createUsername("solo"), "soloUsername")
    }),
    0
  );

  assert.equal(roomDirectory.listRoomSnapshots(10_500).length, 0);
  assert.throws(
    () => roomDirectory.advanceRoom(roomId, 10_500, playerId),
    /Unknown co-op room: co-op-stale/
  );
});
