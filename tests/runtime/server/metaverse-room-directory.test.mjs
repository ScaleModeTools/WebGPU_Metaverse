import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMetaverseRoomId,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseRoomDirectory } from "../../../server/dist/metaverse/classes/metaverse-room-directory.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createGroundedJoinPresenceCommand(playerId, username) {
  return createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      position: {
        x: 0,
        y: 1.62,
        z: 24
      },
      stateSequence: 1,
      yawRadians: 0
    },
    username
  });
}

test("MetaverseRoomDirectory reuses free-roam shards until capacity and then spills into a new room", () => {
  const roomDirectory = new MetaverseRoomDirectory({
    freeRoamCapacity: 2
  });
  const firstPlayerId = requireValue(
    createMetaversePlayerId("free-roam-first"),
    "firstPlayerId"
  );
  const secondPlayerId = requireValue(
    createMetaversePlayerId("free-roam-second"),
    "secondPlayerId"
  );
  const thirdPlayerId = requireValue(
    createMetaversePlayerId("free-roam-third"),
    "thirdPlayerId"
  );

  const firstAssignment = roomDirectory.quickJoinRoom(
    {
      bundleId: null,
      launchVariationId: null,
      matchMode: "free-roam",
      playerId: firstPlayerId
    },
    0
  );
  const secondAssignment = roomDirectory.quickJoinRoom(
    {
      bundleId: null,
      launchVariationId: null,
      matchMode: "free-roam",
      playerId: secondPlayerId
    },
    1
  );
  const thirdAssignment = roomDirectory.quickJoinRoom(
    {
      bundleId: null,
      launchVariationId: null,
      matchMode: "free-roam",
      playerId: thirdPlayerId
    },
    2
  );
  const directorySnapshot = roomDirectory.listRoomDirectorySnapshot(2, "free-roam");
  const connectedPlayerCounts = directorySnapshot.rooms
    .map((roomSnapshot) => roomSnapshot.connectedPlayerCount)
    .sort((leftCount, rightCount) => rightCount - leftCount);

  assert.equal(firstAssignment.roomId, secondAssignment.roomId);
  assert.equal(firstAssignment.bundleId, "private-build");
  assert.notEqual(thirdAssignment.roomId, firstAssignment.roomId);
  assert.equal(directorySnapshot.rooms.length, 2);
  assert.deepEqual(connectedPlayerCounts, [2, 1]);
});

test("MetaverseRoomDirectory transfers TDM leadership and rotates the room session after prune and recreation", () => {
  const roomDirectory = new MetaverseRoomDirectory();
  const roomId = requireValue(createMetaverseRoomId("tdm-hangar"), "roomId");
  const leaderPlayerId = requireValue(
    createMetaversePlayerId("tdm-leader"),
    "leaderPlayerId"
  );
  const wingPlayerId = requireValue(
    createMetaversePlayerId("tdm-wing"),
    "wingPlayerId"
  );
  const replacementPlayerId = requireValue(
    createMetaversePlayerId("tdm-replacement"),
    "replacementPlayerId"
  );

  const leaderAssignment = roomDirectory.joinRoom(
    roomId,
    {
      bundleId: null,
      launchVariationId: null,
      playerId: leaderPlayerId
    },
    0
  );
  roomDirectory.joinRoom(
    roomId,
    {
      bundleId: null,
      launchVariationId: null,
      playerId: wingPlayerId
    },
    1
  );

  roomDirectory.acceptPresenceCommand(
    roomId,
    createGroundedJoinPresenceCommand(
      leaderPlayerId,
      requireValue(createUsername("leader"), "leaderUsername")
    ),
    2
  );
  roomDirectory.acceptPresenceCommand(
    roomId,
    createGroundedJoinPresenceCommand(
      wingPlayerId,
      requireValue(createUsername("wing"), "wingUsername")
    ),
    3
  );
  roomDirectory.acceptPresenceCommand(
    roomId,
    createMetaverseLeavePresenceCommand({
      playerId: leaderPlayerId
    }),
    10
  );

  const leadershipSnapshot = roomDirectory.listRoomDirectorySnapshot(
    10,
    "team-deathmatch"
  );

  assert.equal(leadershipSnapshot.rooms[0]?.leaderPlayerId, wingPlayerId);

  roomDirectory.acceptPresenceCommand(
    roomId,
    createMetaverseLeavePresenceCommand({
      playerId: wingPlayerId
    }),
    20
  );
  roomDirectory.advanceToTime(20);

  assert.equal(
    roomDirectory.listRoomDirectorySnapshot(20, "team-deathmatch").rooms.length,
    0
  );

  const recreatedAssignment = roomDirectory.joinRoom(
    roomId,
    {
      bundleId: null,
      launchVariationId: null,
      playerId: replacementPlayerId
    },
    30
  );

  assert.notEqual(recreatedAssignment.roomSessionId, leaderAssignment.roomSessionId);
  assert.equal(leaderAssignment.bundleId, "deathmatch");
  assert.equal(recreatedAssignment.leaderPlayerId, replacementPlayerId);
});
