import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseRealtimeWorldWebTransportDatagramAdapter } from "../../../server/dist/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards driver-control datagrams into authoritative world state", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
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
          x: 0,
          y: 0.4,
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
      }
    }),
    100
  );
  runtime.advanceToTime(1_000);

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.ok(Math.abs(worldSnapshot.vehicles[0]?.position.z - 18.63) < 0.0001);
  assert.ok(
    Math.abs(worldSnapshot.players[0]?.linearVelocity.z + 10.5) < 0.0001
  );
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter rejects datagrams after disposal", () => {
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    new MetaverseAuthoritativeWorldRuntime()
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createMetaversePlayerId("disposed-harbor-pilot"),
    "playerId"
  );

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
          }
        }),
        0
      ),
    /already been disposed/
  );
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards traversal-intent datagrams into authoritative world state", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-traversal-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
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
          inputSequence: 2,
          locomotionMode: "grounded",
        },
        playerId
      })
    }),
    0
  );
  runtime.advanceToTime(200);

  const worldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(worldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);
  assert.ok((worldSnapshot.players[0]?.position.y ?? 0) > 0);
  assert.ok((worldSnapshot.players[0]?.position.z ?? 24) < 24);
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter forwards player-look datagrams into authoritative world state", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const session = adapter.openSession();
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot-look-datagram"),
    "playerId"
  );
  const username = requireValue(createUsername("Harbor Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
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
      })
    }),
    50
  );

  const worldSnapshot = runtime.readWorldSnapshot(50, playerId);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.3);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, 1.1);
  assert.equal(worldSnapshot.players[0]?.yawRadians, 0.2);
});

test("MetaverseRealtimeWorldWebTransportDatagramAdapter binds the session to the first datagram player identity", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseRealtimeWorldWebTransportDatagramAdapter(
    runtime
  );
  const session = adapter.openSession();
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

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
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
          }
        }),
        0
      );
      session.receiveClientDatagram(
        createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
          command: {
            intent: {
              boost: false,
              inputSequence: 1,
              jump: false,
              locomotionMode: "grounded",
              moveAxis: 0,
              strafeAxis: 0,
              yawAxis: 0
            },
            playerId: secondPlayerId
          }
        }),
        0
      );
    },
    /already bound/
  );
});
