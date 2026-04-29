import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseIssuePlayerActionCommand,
  createMetaverseJoinPresenceCommand,
  createMilliseconds,
  createMetaversePlayerId,
  createMetaverseQuickJoinRoomRequest,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportSnapshotRequest,
  createMetaverseRoomId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  readMetaverseCombatWeaponProfile,
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseWorldWebTransportAdapter } from "../../../server/dist/metaverse/adapters/metaverse-world-webtransport-adapter.js";
import { MetaverseRoomDirectory } from "../../../server/dist/metaverse/classes/metaverse-room-directory.js";

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function readWorldPlayer(worldSnapshot, playerId) {
  return requireValue(
    worldSnapshot.players.find((playerSnapshot) => playerSnapshot.playerId === playerId) ??
      null,
    `world player ${playerId}`
  );
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
  origin = {
    x: 0,
    y: 3,
    z: 24
  },
  playerId,
  target = {
    x: 0,
    y: 3,
    z: 16
  },
  weaponId,
  yawRadians,
  pitchRadians
}) {
  const forwardDirection = createForwardDirection(origin, target);
  const planarMagnitude = Math.hypot(forwardDirection.x, forwardDirection.z);

  return createMetaverseIssuePlayerActionCommand({
    action: {
      actionSequence,
      aimSnapshot: {
        pitchRadians:
          pitchRadians ?? Math.atan2(forwardDirection.y, planarMagnitude),
        rayForwardWorld: forwardDirection,
        rayOriginWorld: origin,
        yawRadians: yawRadians ?? Math.atan2(forwardDirection.x, -forwardDirection.z)
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId
    },
    playerId
  });
}

function createWorldSessionContext(
  playerId,
  {
    nowMs = 0,
    roomDirectory = new MetaverseRoomDirectory()
  } = {}
) {
  const roomAssignment = roomDirectory.quickJoinRoom(
    createMetaverseQuickJoinRoomRequest({
      matchMode: "free-roam",
      playerId
    }),
    nowMs
  );

  return {
    adapter: new MetaverseWorldWebTransportAdapter(roomDirectory),
    roomAssignment,
    roomDirectory
  };
}

function createTeamDeathmatchWorldSessionContext() {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(50)
    }
  });
  const roomId = requireValue(
    createMetaverseRoomId("webtransport-tdm-authority"),
    "roomId"
  );
  const bluePlayerId = requireValue(
    createMetaversePlayerId("tdm-blue-webtransport"),
    "bluePlayerId"
  );
  const redPlayerId = requireValue(
    createMetaversePlayerId("tdm-red-webtransport"),
    "redPlayerId"
  );
  const blueUsername = requireValue(createUsername("TDM Blue"), "blueUsername");
  const redUsername = requireValue(createUsername("TDM Red"), "redUsername");

  roomDirectory.joinRoom(
    roomId,
    {
      bundleId: "deathmatch",
      launchVariationId: "shell-team-deathmatch",
      playerId: bluePlayerId
    },
    0
  );
  roomDirectory.joinRoom(
    roomId,
    {
      bundleId: "deathmatch",
      launchVariationId: "shell-team-deathmatch",
      playerId: redPlayerId
    },
    1
  );
  roomDirectory.acceptPresenceCommand(
    roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: bluePlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      teamId: "blue",
      username: blueUsername
    }),
    0
  );
  roomDirectory.acceptPresenceCommand(
    roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: redPlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: Math.PI
      },
      teamId: "red",
      username: redUsername
    }),
    1
  );

  return {
    adapter: new MetaverseWorldWebTransportAdapter(roomDirectory),
    bluePlayerId,
    redPlayerId,
    roomDirectory,
    roomId
  };
}

test("MetaverseWorldWebTransportAdapter serves authoritative world snapshots through one session owner", () => {
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const { adapter, roomAssignment, roomDirectory } = createWorldSessionContext(playerId);
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: playerId,
      roomId: roomAssignment.roomId
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.world.players[0]?.playerId, "harbor-pilot-1");
  assert.equal(response.event.world.vehicles.length, 1);
});

test("MetaverseWorldWebTransportAdapter accepts typed driver vehicle control requests", () => {
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const { adapter, roomAssignment, roomDirectory } = createWorldSessionContext(playerId);
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      roomId: roomAssignment.roomId,
      command: createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: false,
          environmentAssetId: "metaverse-hub-skiff-v1",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0
        },
        controlSequence: 1,
        playerId
      })
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.type, "world-snapshot");
});

test("MetaverseWorldWebTransportAdapter accepts typed mounted occupancy requests", () => {
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const { adapter, roomAssignment, roomDirectory } = createWorldSessionContext(playerId);
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      roomId: roomAssignment.roomId,
      command: createMetaverseSyncMountedOccupancyCommand({
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        playerId
      })
    }),
    100
  );

  assert.equal(response.type, "world-server-event");
  assert.equal(response.event.world.observerPlayer?.playerId, playerId);
  assert.equal(response.event.world.players[0]?.locomotionMode, "mounted");
  assert.equal(
    response.event.world.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
});

test("MetaverseWorldWebTransportAdapter returns typed error frames for unknown observers", () => {
  const playerId = createMetaversePlayerId("missing-player");

  assert.notEqual(playerId, null);

  const { adapter, roomAssignment } = createWorldSessionContext(playerId);
  const session = adapter.openSession();

  const response = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: playerId,
      roomId: roomAssignment.roomId
    }),
    0
  );

  assert.equal(response.type, "world-error");
  assert.match(response.message, /Unknown metaverse player/);
});

test("MetaverseWorldWebTransportAdapter keeps team deathmatch authority active across first player actions", () => {
  const {
    adapter,
    bluePlayerId,
    redPlayerId,
    roomId
  } = createTeamDeathmatchWorldSessionContext();
  const session = adapter.openSession();

  const initialResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: bluePlayerId,
      roomId
    }),
    100
  );

  assert.equal(initialResponse.type, "world-server-event");
  assert.equal(initialResponse.event.world.combatMatch?.phase, "active");
  assert.equal(initialResponse.event.world.observerPlayer?.playerId, bluePlayerId);
  assert.equal(initialResponse.event.world.combatFeed.length, 2);

  const initialBluePlayer = readWorldPlayer(
    initialResponse.event.world,
    bluePlayerId
  );
  const initialRedPlayer = readWorldPlayer(
    initialResponse.event.world,
    redPlayerId
  );

  assert.equal(initialBluePlayer.teamId, "blue");
  assert.equal(initialRedPlayer.teamId, "red");
  assert.equal(initialBluePlayer.locomotionMode, "grounded");
  assert.equal(initialBluePlayer.mountedOccupancy, null);
  assert.equal(
    initialBluePlayer.combat?.activeWeapon?.weaponId,
    "metaverse-service-pistol-v2"
  );

  const weaponProfile = readMetaverseCombatWeaponProfile(
    "metaverse-service-pistol-v2"
  );
  const initialBlueBody =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(initialBluePlayer);
  const initialRedBody =
    readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(initialRedPlayer);
  const fireRayOrigin = {
    x: initialBlueBody.position.x,
    y: initialBlueBody.position.y + weaponProfile.firingOriginHeightMeters,
    z: initialBlueBody.position.z
  };
  const fireRayTarget = {
    x: initialRedBody.position.x,
    y: initialRedBody.position.y + 1.58,
    z: initialRedBody.position.z
  };

  const protectedFireResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createFireWeaponPlayerActionCommand({
        actionSequence: 1,
        issuedAtAuthoritativeTimeMs: 100,
        origin: fireRayOrigin,
        playerId: bluePlayerId,
        target: fireRayTarget,
        weaponId: "metaverse-service-pistol-v2"
      }),
      roomId
    }),
    100
  );

  assert.equal(protectedFireResponse.type, "world-server-event");
  assert.equal(protectedFireResponse.event.world.combatMatch?.phase, "active");

  const protectedFireReceipt =
    protectedFireResponse.event.world.observerPlayer?.recentPlayerActionReceipts.find(
      (receipt) => receipt.kind === "fire-weapon" && receipt.actionSequence === 1
    ) ?? null;

  assert.equal(protectedFireReceipt?.status, "rejected");
  assert.equal(protectedFireReceipt?.rejectionReason, "spawn-protected");
  assert.equal(
    readWorldPlayer(protectedFireResponse.event.world, bluePlayerId).combat
      ?.activeWeapon?.weaponId,
    "metaverse-service-pistol-v2"
  );

  const acceptedFireResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createFireWeaponPlayerActionCommand({
        actionSequence: 2,
        issuedAtAuthoritativeTimeMs: 1_250,
        origin: fireRayOrigin,
        playerId: bluePlayerId,
        target: fireRayTarget,
        weaponId: "metaverse-service-pistol-v2"
      }),
      roomId
    }),
    1_250
  );

  assert.equal(acceptedFireResponse.type, "world-server-event");
  assert.equal(acceptedFireResponse.event.world.combatMatch?.phase, "active");

  const acceptedFireReceipt =
    acceptedFireResponse.event.world.observerPlayer?.recentPlayerActionReceipts.find(
      (receipt) => receipt.kind === "fire-weapon" && receipt.actionSequence === 2
    ) ?? null;

  assert.equal(acceptedFireReceipt?.status, "accepted");
  assert.equal(acceptedFireReceipt?.weaponId, "metaverse-service-pistol-v2");
  assert.ok(acceptedFireResponse.event.world.combatFeed.length >= 2);
  assert.ok(Array.isArray(acceptedFireResponse.event.world.projectiles));
  assert.ok(
    readWorldPlayer(acceptedFireResponse.event.world, bluePlayerId).combat
      ?.weaponStats.some(
        (weaponStats) =>
          weaponStats.weaponId === "metaverse-service-pistol-v2" &&
          weaponStats.shotsFired === 1
      )
  );

  const traversalResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command: createMetaverseSyncPlayerTraversalIntentCommand({
        intent: {
          actionIntent: {
            kind: "none",
            pressed: false
          },
          bodyControl: {
            boost: false,
            moveAxis: 1,
            strafeAxis: 0,
            turnAxis: 0
          },
          facing: {
            pitchRadians: 0,
            yawRadians: 0
          },
          locomotionMode: "grounded",
          sequence: 3
        },
        playerId: bluePlayerId
      }),
      roomId
    }),
    1_300
  );

  assert.equal(traversalResponse.type, "world-server-event");
  assert.equal(traversalResponse.event.world.combatMatch?.phase, "active");
  assert.equal(
    traversalResponse.event.world.observerPlayer?.playerId,
    bluePlayerId
  );
  assert.equal(
    readWorldPlayer(traversalResponse.event.world, bluePlayerId).combat
      ?.activeWeapon?.weaponId,
    "metaverse-service-pistol-v2"
  );
});

test("MetaverseWorldWebTransportAdapter keeps a persistent snapshot subscription alive and pushes newer snapshots", async () => {
  const playerId = createMetaversePlayerId("stream-harbor-pilot");
  const username = createUsername("Stream Harbor Pilot");
  const writes = [];
  const closed = createDeferred();

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const { adapter, roomAssignment, roomDirectory } = createWorldSessionContext(playerId);
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
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
    }),
    0
  );

  const streamPromise = session.handleClientStream(
    {
      observerPlayerId: playerId,
      roomId: roomAssignment.roomId,
      type: "world-snapshot-subscribe"
    },
    {
      closed: closed.promise,
      async writeResponse(response) {
        writes.push(response);
      }
    },
    0
  );

  await flushAsyncWork();

  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.type, "world-server-event");
  assert.equal(writes[0]?.event.world.tick.currentTick, 0);

  roomDirectory.advanceToTime(100);
  adapter.publishWorldSnapshots(100);
  await flushAsyncWork();

  assert.equal(writes.length, 2);
  assert.equal(writes[1]?.type, "world-server-event");
  assert.equal(writes[1]?.event.world.tick.currentTick, 3);

  closed.resolve();
  await streamPromise;
});

test("MetaverseWorldWebTransportAdapter binds stream subscriptions to one player identity and keeps only the latest buffered publish for slow subscribers", async () => {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      tickIntervalMs: createMilliseconds(50)
    }
  });
  const playerId = createMetaversePlayerId("latest-wins-harbor-pilot");
  const otherPlayerId = createMetaversePlayerId("other-harbor-pilot");
  const username = createUsername("Latest Wins Pilot");
  const blockedWrite = createDeferred();
  const closed = createDeferred();
  const writes = [];
  let writeCount = 0;

  assert.notEqual(playerId, null);
  assert.notEqual(otherPlayerId, null);
  assert.notEqual(username, null);

  const { adapter, roomAssignment } = createWorldSessionContext(playerId, {
    roomDirectory
  });
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
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
    }),
    0
  );

  const streamPromise = session.handleClientStream(
    {
      observerPlayerId: playerId,
      roomId: roomAssignment.roomId,
      type: "world-snapshot-subscribe"
    },
    {
      closed: closed.promise,
      async writeResponse(response) {
        writes.push(response);
        writeCount += 1;

        if (writeCount === 1) {
          await blockedWrite.promise;
        }
      }
    },
    0
  );

  await flushAsyncWork();

  const identityMismatchResponse = session.receiveClientMessage(
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: otherPlayerId,
      roomId: roomAssignment.roomId
    }),
    0
  );

  assert.equal(identityMismatchResponse.type, "world-error");
  assert.match(identityMismatchResponse.message, /already bound/);

  roomDirectory.advanceToTime(50);
  adapter.publishWorldSnapshots(50);
  roomDirectory.advanceToTime(100);
  adapter.publishWorldSnapshots(100);
  await flushAsyncWork();

  assert.equal(writes.length, 1);

  blockedWrite.resolve();
  await flushAsyncWork();
  await flushAsyncWork();

  assert.equal(writes.length, 2);
  assert.equal(writes[1]?.type, "world-server-event");
  assert.equal(writes[1]?.event.world.tick.currentTick, 2);

  closed.resolve();
  await streamPromise;
});
