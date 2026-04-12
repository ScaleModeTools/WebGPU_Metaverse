import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
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

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.ok(Math.abs(worldSnapshot.vehicles[0]?.position.z - 18.63) < 0.000001);
  assert.ok(
    Math.abs(worldSnapshot.players[0]?.linearVelocity.z + 10.5) < 0.000001
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
