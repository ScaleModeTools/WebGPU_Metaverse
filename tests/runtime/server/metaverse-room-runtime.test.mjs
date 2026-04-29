import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseIssuePlayerActionCommand,
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseRoomId,
  createMetaverseRoomSessionId,
  readMetaverseCombatWeaponProfile,
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseRoomRuntime } from "../../../server/dist/metaverse/classes/metaverse-room-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createGroundedJoinPresenceCommand(playerId, username, x = 0, teamId) {
  return createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
    pose: {
      position: {
        x,
        y: 1.62,
        z: 24
      },
      stateSequence: 1,
      yawRadians: 0
    },
    ...(teamId === undefined ? {} : { teamId }),
    username
  });
}

function createForwardDirection(origin, target) {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const deltaZ = target.z - origin.z;
  const length = Math.hypot(deltaX, deltaY, deltaZ);

  return Object.freeze({
    x: deltaX / length,
    y: deltaY / length,
    z: deltaZ / length
  });
}

function createFireWeaponPlayerActionCommand({
  actionSequence,
  issuedAtAuthoritativeTimeMs,
  origin,
  playerId,
  target,
  weaponId
}) {
  const forwardDirection = createForwardDirection(origin, target);
  const planarMagnitude = Math.hypot(forwardDirection.x, forwardDirection.z);

  return createMetaverseIssuePlayerActionCommand({
    action: {
      actionSequence,
      aimSnapshot: {
        pitchRadians: Math.atan2(forwardDirection.y, planarMagnitude),
        rayForwardWorld: forwardDirection,
        rayOriginWorld: origin,
        yawRadians: Math.atan2(forwardDirection.x, -forwardDirection.z)
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId
    },
    playerId
  });
}

function readPlayerSnapshot(worldSnapshot, playerId) {
  return requireValue(
    worldSnapshot.players.find(
      (playerSnapshot) => playerSnapshot.playerId === playerId
    ),
    "playerSnapshot"
  );
}

function createTeamDeathmatchRoomRuntime() {
  return new MetaverseRoomRuntime({
    bundleId: "deathmatch",
    capacity: 8,
    launchVariationId: "shell-team-deathmatch",
    leaderPlayerId: requireValue(
      createMetaversePlayerId("tdm-leader"),
      "leaderPlayerId"
    ),
    matchMode: "team-deathmatch",
    roomId: requireValue(createMetaverseRoomId("tdm-room-runtime"), "roomId"),
    roomSessionId: requireValue(
      createMetaverseRoomSessionId("tdm-room-runtime-session-1"),
      "roomSessionId"
    )
  });
}

test("MetaverseRoomRuntime exposes assignment and directory metadata for team deathmatch rooms", () => {
  const roomRuntime = createTeamDeathmatchRoomRuntime();
  const firstPlayerId = requireValue(
    createMetaversePlayerId("tdm-first"),
    "firstPlayerId"
  );
  const secondPlayerId = requireValue(
    createMetaversePlayerId("tdm-second"),
    "secondPlayerId"
  );

  roomRuntime.acceptPresenceCommand(
    createGroundedJoinPresenceCommand(
      firstPlayerId,
      requireValue(createUsername("alpha"), "alphaUsername"),
      0,
      "red"
    ),
    0
  );
  roomRuntime.acceptPresenceCommand(
    createGroundedJoinPresenceCommand(
      secondPlayerId,
      requireValue(createUsername("bravo"), "bravoUsername"),
      4,
      "blue"
    ),
    0
  );

  const assignmentSnapshot = roomRuntime.readAssignmentSnapshot(2);
  const directoryEntry = roomRuntime.readDirectoryEntry(0, 2, "available");
  const worldSnapshot = roomRuntime.readWorldSnapshot(0);
  const firstPlayerActiveBody =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
      readPlayerSnapshot(worldSnapshot, firstPlayerId)
    );

  assert.equal(assignmentSnapshot.bundleId, "deathmatch");
  assert.equal(assignmentSnapshot.launchVariationId, "shell-team-deathmatch");
  assert.equal(assignmentSnapshot.matchMode, "team-deathmatch");
  assert.equal(assignmentSnapshot.connectedPlayerCount, 2);
  assert.equal(directoryEntry.roomId, assignmentSnapshot.roomId);
  assert.equal(directoryEntry.leaderPlayerId, assignmentSnapshot.leaderPlayerId);
  assert.equal(directoryEntry.connectedPlayerCount, 2);
  assert.equal(directoryEntry.phase !== null, true);
  assert.equal(
    directoryEntry.redTeamPlayerCount + directoryEntry.blueTeamPlayerCount,
    2
  );
  assert.equal(directoryEntry.phase, "active");
  assert.equal(firstPlayerActiveBody.position.x, 0.8);
  assert.equal(firstPlayerActiveBody.position.y, 0.6);
  assert.equal(firstPlayerActiveBody.position.z, -22.2);
});

test("MetaverseRoomRuntime balances same-lane team deathmatch joins before combat authority resolves hits", () => {
  const roomRuntime = createTeamDeathmatchRoomRuntime();
  const firstPlayerId = requireValue(
    createMetaversePlayerId("tdm-same-lane-first"),
    "firstPlayerId"
  );
  const secondPlayerId = requireValue(
    createMetaversePlayerId("tdm-same-lane-second"),
    "secondPlayerId"
  );
  const weaponId = "metaverse-service-pistol-v2";

  roomRuntime.acceptPresenceCommand(
    createGroundedJoinPresenceCommand(
      firstPlayerId,
      requireValue(createUsername("same lane one"), "firstUsername"),
      0,
      "red"
    ),
    0
  );
  roomRuntime.acceptPresenceCommand(
    createGroundedJoinPresenceCommand(
      secondPlayerId,
      requireValue(createUsername("same lane two"), "secondUsername"),
      4,
      "red"
    ),
    0
  );

  roomRuntime.advanceToTime(1_200);

  const readyWorldSnapshot = roomRuntime.readWorldSnapshot(1_200, firstPlayerId);
  const firstPlayerSnapshot = readPlayerSnapshot(
    readyWorldSnapshot,
    firstPlayerId
  );
  const secondPlayerSnapshot = readPlayerSnapshot(
    readyWorldSnapshot,
    secondPlayerId
  );
  const firstPlayerBody =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(firstPlayerSnapshot);
  const secondPlayerBody =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(secondPlayerSnapshot);
  const weaponProfile = readMetaverseCombatWeaponProfile(weaponId);

  assert.equal(firstPlayerSnapshot.teamId, "red");
  assert.equal(secondPlayerSnapshot.teamId, "blue");

  roomRuntime.acceptWorldCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: {
        x: firstPlayerBody.position.x,
        y: firstPlayerBody.position.y + weaponProfile.firingOriginHeightMeters,
        z: firstPlayerBody.position.z
      },
      playerId: firstPlayerId,
      target: {
        x: secondPlayerBody.position.x,
        y: secondPlayerBody.position.y + 1.58,
        z: secondPlayerBody.position.z
      },
      weaponId
    }),
    1_250
  );

  const hitWorldSnapshot = roomRuntime.readWorldSnapshot(1_250, firstPlayerId);
  const hitFirstPlayerSnapshot = readPlayerSnapshot(
    hitWorldSnapshot,
    firstPlayerId
  );
  const hitSecondPlayerSnapshot = readPlayerSnapshot(
    hitWorldSnapshot,
    secondPlayerId
  );
  const weaponStats =
    hitFirstPlayerSnapshot.combat?.weaponStats.find(
      (candidateStats) => candidateStats.weaponId === weaponId
    ) ?? null;
  const fireReceipt =
    hitWorldSnapshot.observerPlayer?.recentPlayerActionReceipts.find(
      (receipt) => receipt.kind === "fire-weapon" && receipt.actionSequence === 1
    ) ?? null;

  assert.equal(fireReceipt?.status, "accepted");
  assert.equal(weaponStats?.shotsFired, 1);
  assert.equal(weaponStats?.shotsHit, 1);
  assert.equal(
    (hitSecondPlayerSnapshot.combat?.health ?? 100) <
      (hitSecondPlayerSnapshot.combat?.maxHealth ?? 100),
    true
  );
});

test("MetaverseRoomRuntime forceRemovePlayer clears the authoritative room roster", () => {
  const roomRuntime = createTeamDeathmatchRoomRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("tdm-removable"),
    "playerId"
  );

  roomRuntime.acceptPresenceCommand(
    createGroundedJoinPresenceCommand(
      playerId,
      requireValue(createUsername("solo"), "soloUsername")
    ),
    0
  );

  assert.equal(roomRuntime.readWorldSnapshot(0).players.length, 1);

  roomRuntime.forceRemovePlayer(playerId, 10);

  assert.equal(roomRuntime.readWorldSnapshot(10).players.length, 0);
});
