import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseQuickJoinRoomRequest,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram,
  createMetaverseRoomId,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

import {
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../metaverse-authored-world-test-fixtures.mjs";
import { MetaverseRealtimeWorldWebTransportDatagramAdapter } from "../../../server/dist/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import { MetaverseRoomDirectory } from "../../../server/dist/metaverse/classes/metaverse-room-directory.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function readPrimaryPlayerActiveBodySnapshot(worldSnapshot) {
  return readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    requireValue(worldSnapshot.players[0], "playerSnapshot")
  );
}

function createDatagramTestContext(
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
    adapter: new MetaverseRealtimeWorldWebTransportDatagramAdapter(roomDirectory),
    roomAssignment,
    roomDirectory
  };
}

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards driver-control datagrams into authoritative world state", () => {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(100)
    }
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  const { adapter, roomAssignment } = createDatagramTestContext(playerId, {
    roomDirectory
  });
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: authoredWaterBaySkiffPlacement.x,
          y: 0.4,
          z: authoredWaterBaySkiffPlacement.z
        },
        stateSequence: 1,
        yawRadians: authoredWaterBaySkiffYawRadians
      },
      username
    }),
    0
  );

  session.receiveClientDatagram(
    createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
      command: {
        controlIntent: {
          boost: false,
          environmentAssetId: "metaverse-hub-skiff-v1",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0
        },
        controlSequence: 1,
        playerId
      },
      roomId: roomAssignment.roomId
    }),
    100
  );
  roomDirectory.advanceToTime(1_000);

  const worldSnapshot = roomDirectory.readWorldSnapshot(
    roomAssignment.roomId,
    1_000,
    playerId
  );
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.ok(
    (worldSnapshot.vehicles[0]?.position.x ?? Number.NEGATIVE_INFINITY) >
      authoredWaterBaySkiffPlacement.x
  );
  assert.ok(activeBodySnapshot.linearVelocity.x > 0);
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter rejects datagrams after disposal", () => {
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    new MetaverseRoomDirectory()
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createMetaversePlayerId("disposed-harbor-pilot"),
    "playerId"
  );
  const roomId = requireValue(createMetaverseRoomId("disposed-room"), "roomId");

  session.dispose();

  assert.throws(
    () =>
      session.receiveClientDatagram(
        createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
          command: {
            controlIntent: {
              boost: false,
              environmentAssetId: "metaverse-hub-skiff-v1",
              moveAxis: 0,
              strafeAxis: 0,
              yawAxis: 0
            },
            controlSequence: 1,
            playerId
          },
          roomId
        }),
        0
      ),
    /already been disposed/
  );
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards traversal-intent datagrams into authoritative world state", () => {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(100)
    }
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-traversal-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  const { adapter, roomAssignment } = createDatagramTestContext(playerId, {
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

  session.receiveClientDatagram(
    createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
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
          sequence: 2,
          locomotionMode: "grounded",
        },
        playerId
      }),
      roomId: roomAssignment.roomId
    }),
    0
  );
  roomDirectory.advanceToTime(200);

  const worldSnapshot = roomDirectory.readWorldSnapshot(
    roomAssignment.roomId,
    200,
    playerId
  );
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);
  assert.ok(activeBodySnapshot.position.y > 0);
  assert.ok(activeBodySnapshot.position.z < 24);
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter rejects datagrams for a stale room binding", () => {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(100)
    }
  });
  const playerId = requireValue(
    createMetaversePlayerId("stale-room-datagram-player"),
    "playerId"
  );
  const username = requireValue(createUsername("Stale Room"), "username");
  const firstRoomId = requireValue(createMetaverseRoomId("tdm-first"), "firstRoomId");
  const secondRoomId = requireValue(createMetaverseRoomId("tdm-second"), "secondRoomId");
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    roomDirectory
  );
  const session = adapter.openSession();

  roomDirectory.joinRoom(
    firstRoomId,
    {
      bundleId: "deathmatch",
      launchVariationId: "shell-team-deathmatch",
      playerId
    },
    0
  );
  roomDirectory.acceptPresenceCommand(
    firstRoomId,
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
  roomDirectory.joinRoom(
    secondRoomId,
    {
      bundleId: "deathmatch",
      launchVariationId: "shell-team-deathmatch",
      playerId
    },
    10
  );
  roomDirectory.acceptPresenceCommand(
    secondRoomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 2,
        yawRadians: 0
      },
      username
    }),
    10
  );

  assert.throws(
    () =>
      session.receiveClientDatagram(
        createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
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
              sequence: 3,
              locomotionMode: "grounded"
            },
            playerId
          }),
          roomId: firstRoomId
        }),
        20
      ),
    /not bound to room/
  );
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards player-look datagrams into authoritative world state", () => {
  const roomDirectory = new MetaverseRoomDirectory({
    runtimeConfig: {
      playerInactivityTimeoutMs: createMilliseconds(5_000),
      tickIntervalMs: createMilliseconds(100)
    }
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-look-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  const { adapter, roomAssignment } = createDatagramTestContext(playerId, {
    roomDirectory
  });
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
          occupantRole: "passenger",
          seatId: "port-bench-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0.2
      },
      username
    }),
    0
  );

  session.receiveClientDatagram(
    createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram({
      command: createMetaverseSyncPlayerLookIntentCommand({
        lookIntent: {
          pitchRadians: -0.3,
          yawRadians: 1.1
        },
        lookSequence: 2,
        playerId
      }),
      roomId: roomAssignment.roomId
    }),
    50
  );

  const worldSnapshot = roomDirectory.readWorldSnapshot(
    roomAssignment.roomId,
    50,
    playerId
  );
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.3);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, 1.1);
  assert.equal(activeBodySnapshot.yawRadians, authoredWaterBaySkiffYawRadians);
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter binds the session to the first datagram player identity", () => {
  const roomDirectory = new MetaverseRoomDirectory();
  const firstPlayerId = requireValue(
    createMetaversePlayerId("first-harbor-pilot"),
    "first playerId"
  );
  const secondPlayerId = requireValue(
    createMetaversePlayerId("second-harbor-pilot"),
    "second playerId"
  );
  const firstUsername = requireValue(
    createUsername("First Harbor Pilot"),
    "first username"
  );

  const { adapter, roomAssignment } = createDatagramTestContext(firstPlayerId, {
    roomDirectory
  });
  const session = adapter.openSession();

  roomDirectory.acceptPresenceCommand(
    roomAssignment.roomId,
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: firstPlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username: firstUsername
    }),
    0
  );

  assert.throws(
    () => {
      session.receiveClientDatagram(
        createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
          command: {
            controlIntent: {
              boost: false,
              environmentAssetId: "metaverse-hub-skiff-v1",
              moveAxis: 0,
              strafeAxis: 0,
              yawAxis: 0
            },
            controlSequence: 1,
            playerId: firstPlayerId
          },
          roomId: roomAssignment.roomId
        }),
        0
      );
      session.receiveClientDatagram(
        createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
          command: {
            intent: {
              boost: false,
              sequence: 1,
              jump: false,
              locomotionMode: "grounded",
              moveAxis: 0,
              strafeAxis: 0,
              yawAxis: 0
            },
            playerId: secondPlayerId
          },
          roomId: roomAssignment.roomId
        }),
        0
      );
    },
    /already bound/
  );
});
