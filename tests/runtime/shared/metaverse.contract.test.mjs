import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoopJoinRoomCommand,
  createCoopPlayerId,
  createCoopRoomId,
  createCoopRoomSnapshotEvent,
  createCoopSessionId,
  createCoopSyncPlayerPresenceCommand,
  createDuckHuntCoopRoomWebTransportCommandRequest,
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram,
  createDuckHuntCoopRoomWebTransportServerEventMessage,
  createDuckHuntCoopRoomWebTransportSnapshotRequest,
  createMetaverseDriverVehicleControlIntentSnapshot,
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaversePresenceRosterSnapshot,
  createMetaversePresenceWebTransportCommandRequest,
  createMetaversePresenceWebTransportRosterRequest,
  createMetaversePresenceWebTransportServerEventMessage,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseRealtimeWorldSnapshot,
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportServerEventMessage,
  createMetaverseRealtimeWorldWebTransportSnapshotRequest,
  createMetaverseSessionSnapshot,
  createMetaverseVehicleId,
  createPortalLaunchSelectionSnapshot,
  createUsername,
  experienceCatalog,
  readExperienceCatalogEntry,
  readExperienceTickOwner
} from "@webgpu-metaverse/shared";

test("experienceCatalog exposes Duck Hunt as the first metaverse-ready experience", () => {
  assert.equal(experienceCatalog.length, 1);

  const duckHuntEntry = readExperienceCatalogEntry("duck-hunt");

  assert.equal(duckHuntEntry.id, "duck-hunt");
  assert.equal(duckHuntEntry.label, "Duck Hunt!");
  assert.equal(duckHuntEntry.defaultInputMode, "mouse");
  assert.deepEqual(duckHuntEntry.supportedSessionModes, [
    "single-player",
    "co-op"
  ]);
  assert.equal(readExperienceTickOwner("duck-hunt", "single-player"), "client");
  assert.equal(readExperienceTickOwner("duck-hunt", "co-op"), "server");
});

test("createPortalLaunchSelectionSnapshot resolves the authority model from the shared catalog", () => {
  const singlePlayerLaunch = createPortalLaunchSelectionSnapshot({
    experienceId: "duck-hunt",
    inputMode: "mouse",
    sessionMode: "single-player"
  });
  const coopLaunch = createPortalLaunchSelectionSnapshot({
    experienceId: "duck-hunt",
    inputMode: "camera-thumb-trigger",
    sessionMode: "co-op"
  });

  assert.equal(singlePlayerLaunch.tickOwner, "client");
  assert.equal(coopLaunch.tickOwner, "server");
});

test("createMetaverseSessionSnapshot freezes the available experience ids", () => {
  const inputExperienceIds = ["duck-hunt"];
  const sessionSnapshot = createMetaverseSessionSnapshot({
    activeExperienceId: null,
    availableExperienceIds: inputExperienceIds,
    selectedSessionMode: "single-player",
    tickOwner: "server"
  });

  inputExperienceIds.push("duck-hunt");

  assert.deepEqual(sessionSnapshot.availableExperienceIds, ["duck-hunt"]);
  assert.ok(Object.isFrozen(sessionSnapshot.availableExperienceIds));
});

test("metaverse presence contracts freeze roster and normalize ids", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const rosterInput = [
    {
      characterId: " metaverse-mannequin-v1 ",
      playerId,
      pose: {
        animationVocabulary: "walk",
        locomotionMode: "swim",
        mountedOccupancy: {
          environmentAssetId: " metaverse-hub-skiff-v1 ",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "passenger",
          seatId: " port-bench-seat "
        },
        position: {
          x: 2,
          y: 0.5,
          z: -4
        },
        stateSequence: 3.8,
        yawRadians: Math.PI * 3
      },
      username
    }
  ];
  const rosterSnapshot = createMetaversePresenceRosterSnapshot({
    players: rosterInput,
    snapshotSequence: 5.9,
    tickIntervalMs: 120
  });
  const joinCommand = createMetaverseJoinPresenceCommand({
    characterId: " metaverse-mannequin-v1 ",
    playerId,
    pose: {
      position: {
        x: 2,
        y: 0.5,
        z: -4
      },
      mountedOccupancy: {
        environmentAssetId: " metaverse-hub-skiff-v1 ",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: " port-bench-seat "
      },
      yawRadians: Math.PI * 3
    },
    username
  });

  rosterInput.push(rosterInput[0]);

  assert.equal(rosterSnapshot.players.length, 1);
  assert.equal(rosterSnapshot.players[0]?.characterId, "metaverse-mannequin-v1");
  assert.equal(rosterSnapshot.players[0]?.pose.stateSequence, 3);
  assert.equal(rosterSnapshot.players[0]?.pose.yawRadians, Math.PI * 3);
  assert.equal(
    rosterSnapshot.players[0]?.pose.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(
    rosterSnapshot.players[0]?.pose.mountedOccupancy?.seatId,
    "port-bench-seat"
  );
  assert.equal(rosterSnapshot.snapshotSequence, 5);
  assert.ok(Object.isFrozen(rosterSnapshot.players));
  assert.ok(Object.isFrozen(rosterSnapshot.players[0]));
  assert.ok(Object.isFrozen(rosterSnapshot.players[0]?.pose.mountedOccupancy));
  assert.equal(joinCommand.playerId, "harbor-pilot-1");
  assert.equal(joinCommand.pose.animationVocabulary, "idle");
  assert.equal(joinCommand.pose.locomotionMode, "grounded");
  assert.equal(joinCommand.pose.mountedOccupancy?.occupancyKind, "seat");
});

test("metaverse realtime world contracts freeze snapshots and derive seated occupancy from vehicle truth", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");
  const vehicleId = createMetaverseVehicleId(" harbor-skiff-1 ");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);
  assert.notEqual(username, null);

  const playerInputs = [
    {
      characterId: " metaverse-mannequin-v1 ",
      linearVelocity: {
        x: 0,
        y: 0,
        z: -1.5
      },
      playerId,
      position: {
        x: 2,
        y: 0.5,
        z: -4
      },
      stateSequence: 7.8,
      username,
      yawRadians: Math.PI * 3
    }
  ];
  const worldSnapshot = createMetaverseRealtimeWorldSnapshot({
    players: playerInputs,
    snapshotSequence: 9.6,
    tick: {
      currentTick: 42.9,
      serverTimeMs: 7_500.25,
      tickIntervalMs: 100
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 0.6,
        environmentAssetId: " metaverse-hub-skiff-v1 ",
        linearVelocity: {
          x: 0,
          y: 0,
          z: -1.5
        },
        position: {
          x: 2,
          y: 0,
          z: -4
        },
        seats: [
          {
            occupantPlayerId: playerId,
            occupantRole: "driver",
            seatId: " driver-seat "
          }
        ],
        vehicleId,
        yawRadians: Math.PI
      }
    ]
  });

  playerInputs.push(playerInputs[0]);

  assert.equal(worldSnapshot.snapshotSequence, 9);
  assert.equal(worldSnapshot.tick.currentTick, 42);
  assert.equal(worldSnapshot.tick.serverTimeMs, 7_500.25);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.characterId, "metaverse-mannequin-v1");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 7);
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.vehicleId, vehicleId);
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.occupantRole,
    "driver"
  );
  assert.equal(
    worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );
  assert.ok(Object.isFrozen(worldSnapshot.players));
  assert.ok(Object.isFrozen(worldSnapshot.vehicles));
  assert.ok(Object.isFrozen(worldSnapshot.players[0]?.mountedOccupancy));
});

test("metaverse realtime world contracts reject seat occupancy that disagrees with the vehicle tick", () => {
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const vehicleId = createMetaverseVehicleId("harbor-skiff-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(vehicleId, null);
  assert.notEqual(username, null);

  assert.throws(
    () =>
      createMetaverseRealtimeWorldSnapshot({
        players: [
          {
            characterId: "metaverse-mannequin-v1",
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            mountedOccupancy: {
              environmentAssetId: "metaverse-hub-skiff-v1",
              occupancyKind: "seat",
              occupantRole: "passenger",
              seatId: "port-bench-seat",
              vehicleId
            },
            playerId,
            position: {
              x: 0,
              y: 0,
              z: 0
            },
            username,
            yawRadians: 0
          }
        ],
        tick: {
          currentTick: 3,
          serverTimeMs: 300,
          tickIntervalMs: 100
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
              x: 0,
              y: 0,
              z: 0
            },
            seats: [
              {
                occupantPlayerId: playerId,
                occupantRole: "driver",
                seatId: "driver-seat"
              }
            ],
            vehicleId,
            yawRadians: 0
          }
        ]
      }),
    /seat occupancy must match/
  );
});

test("metaverse realtime world driver control commands normalize explicit intent for transport", () => {
  const playerId = createMetaversePlayerId(" harbor-pilot-1 ");

  assert.notEqual(playerId, null);

  const controlIntent = createMetaverseDriverVehicleControlIntentSnapshot({
    boost: true,
    environmentAssetId: " metaverse-hub-skiff-v1 ",
    moveAxis: 2.4,
    strafeAxis: -4,
    yawAxis: 0.5
  });
  const command = createMetaverseSyncDriverVehicleControlCommand({
    controlIntent,
    controlSequence: 3.9,
    playerId
  });
  const webTransportRequest =
    createMetaverseRealtimeWorldWebTransportCommandRequest({
      command
    });

  assert.equal(controlIntent.environmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(controlIntent.moveAxis, 1);
  assert.equal(controlIntent.strafeAxis, -1);
  assert.equal(command.type, "sync-driver-vehicle-control");
  assert.equal(command.controlSequence, 3);
  assert.equal(webTransportRequest.type, "world-command-request");
  assert.equal(
    webTransportRequest.command.controlIntent.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
});

test("webtransport shared contracts wrap presence, world, and Duck Hunt room messages with explicit domain names", () => {
  const metaversePlayerId = createMetaversePlayerId("harbor-pilot-1");
  const metaverseVehicleId = createMetaverseVehicleId("harbor-skiff-1");
  const coopPlayerId = createCoopPlayerId("coop-pilot-1");
  const coopRoomId = createCoopRoomId("co-op-harbor");
  const coopSessionId = createCoopSessionId("co-op-harbor-session-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(metaversePlayerId, null);
  assert.notEqual(metaverseVehicleId, null);
  assert.notEqual(coopPlayerId, null);
  assert.notEqual(coopRoomId, null);
  assert.notEqual(coopSessionId, null);
  assert.notEqual(username, null);

  const presenceServerMessage = createMetaversePresenceWebTransportServerEventMessage({
    event: {
      roster: createMetaversePresenceRosterSnapshot({
        players: [
          {
            characterId: "metaverse-mannequin-v1",
            playerId: metaversePlayerId,
            pose: {
              position: {
                x: 0,
                y: 1.62,
                z: 24
              },
              yawRadians: 0
            },
            username
          }
        ],
        snapshotSequence: 3,
        tickIntervalMs: 150
      }),
      type: "presence-roster"
    }
  });
  const worldServerMessage = createMetaverseRealtimeWorldWebTransportServerEventMessage({
    event: createMetaverseRealtimeWorldEvent({
      world: {
        players: [
          {
            characterId: "metaverse-mannequin-v1",
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            playerId: metaversePlayerId,
            position: {
              x: 0,
              y: 1.62,
              z: 24
            },
            stateSequence: 2,
            username,
            yawRadians: 0
          }
        ],
        snapshotSequence: 4,
        tick: {
          currentTick: 12,
          serverTimeMs: 1_800,
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
            vehicleId: metaverseVehicleId,
            yawRadians: 0
          }
        ]
      }
    })
  });
  const coopServerMessage = createDuckHuntCoopRoomWebTransportServerEventMessage({
    event: createCoopRoomSnapshotEvent(
      {
      birds: [],
      capacity: 4,
      players: [],
      roomId: coopRoomId,
      session: {
        birdsCleared: 0,
        birdsRemaining: 1,
        requiredReadyPlayerCount: 1,
        sessionId: coopSessionId,
        teamHitsLanded: 0,
        teamShotsFired: 0
      },
      tick: {
        currentTick: 0,
        tickIntervalMs: 50
      }
      }
    )
  });

  const presenceCommandRequest = createMetaversePresenceWebTransportCommandRequest({
    command: createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: metaversePlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  });
  const presenceRosterRequest = createMetaversePresenceWebTransportRosterRequest({
    observerPlayerId: metaversePlayerId
  });
  const worldSnapshotRequest =
    createMetaverseRealtimeWorldWebTransportSnapshotRequest({
      observerPlayerId: metaversePlayerId
    });
  const coopCommandRequest = createDuckHuntCoopRoomWebTransportCommandRequest({
    command: createCoopJoinRoomCommand({
      playerId: coopPlayerId,
      ready: false,
      roomId: coopRoomId,
      username
    })
  });
  const coopSnapshotRequest = createDuckHuntCoopRoomWebTransportSnapshotRequest({
    observerPlayerId: coopPlayerId,
    roomId: coopRoomId
  });

  assert.equal(presenceServerMessage.type, "presence-server-event");
  assert.equal(presenceServerMessage.event.type, "presence-roster");
  assert.ok(Object.isFrozen(presenceServerMessage));
  assert.equal(presenceCommandRequest.type, "presence-command-request");
  assert.equal(presenceCommandRequest.command.type, "join-presence");
  assert.equal(presenceRosterRequest.type, "presence-roster-request");
  assert.equal(worldServerMessage.type, "world-server-event");
  assert.equal(worldServerMessage.event.type, "world-snapshot");
  assert.equal(worldSnapshotRequest.type, "world-snapshot-request");
  assert.equal(coopServerMessage.type, "coop-room-server-event");
  assert.equal(coopServerMessage.event.type, "room-snapshot");
  assert.equal(coopCommandRequest.type, "coop-room-command-request");
  assert.equal(coopCommandRequest.command.type, "join-room");
  assert.equal(coopSnapshotRequest.type, "coop-room-snapshot-request");
});

test("webtransport datagram shared contracts wrap latest-wins channels with explicit domain names", () => {
  const metaversePlayerId = createMetaversePlayerId("harbor-pilot-1");
  const coopPlayerId = createCoopPlayerId("coop-pilot-1");
  const coopRoomId = createCoopRoomId("co-op-harbor");

  assert.notEqual(metaversePlayerId, null);
  assert.notEqual(coopPlayerId, null);
  assert.notEqual(coopRoomId, null);

  const driverVehicleControlDatagram =
    createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
      command: createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: true,
          environmentAssetId: " metaverse-hub-skiff-v1 ",
          moveAxis: 2.5,
          strafeAxis: -3,
          yawAxis: 0.75
        },
        controlSequence: 8.2,
        playerId: metaversePlayerId
      })
    });
  const playerPresenceDatagram =
    createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
      command: createCoopSyncPlayerPresenceCommand({
        aimDirection: {
          x: 0,
          y: 0.2,
          z: -1
        },
        pitchRadians: 0.4,
        playerId: coopPlayerId,
        position: {
          x: 1,
          y: 1.35,
          z: 2
        },
        roomId: coopRoomId,
        stateSequence: 5.7,
        weaponId: " semiautomatic-pistol ",
        yawRadians: 0.8
      })
    });

  assert.equal(
    driverVehicleControlDatagram.type,
    "world-driver-vehicle-control-datagram"
  );
  assert.equal(
    driverVehicleControlDatagram.command.type,
    "sync-driver-vehicle-control"
  );
  assert.equal(
    driverVehicleControlDatagram.command.controlSequence,
    8
  );
  assert.equal(
    driverVehicleControlDatagram.command.controlIntent.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.ok(Object.isFrozen(driverVehicleControlDatagram));

  assert.equal(
    playerPresenceDatagram.type,
    "coop-room-player-presence-datagram"
  );
  assert.equal(
    playerPresenceDatagram.command.type,
    "sync-player-presence"
  );
  assert.equal(playerPresenceDatagram.command.stateSequence, 5);
  assert.equal(
    playerPresenceDatagram.command.weaponId,
    "semiautomatic-pistol"
  );
  assert.ok(Object.isFrozen(playerPresenceDatagram));
});
