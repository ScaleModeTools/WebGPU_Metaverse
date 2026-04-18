import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseSyncPresenceCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldCommandIntake } from "../../../../server/dist/metaverse/authority/commands/metaverse-authoritative-world-command-intake.js";

function createCommandIntakeHarness() {
  const presenceEvent = Object.freeze({ kind: "presence-event" });
  const worldEvent = Object.freeze({ kind: "world-event" });
  const calls = [];
  const commandIntake = new MetaverseAuthoritativeWorldCommandIntake({
    advanceToTime: (nowMs) => {
      calls.push(["advance", nowMs]);
    },
    mountedOccupancyAuthority: {
      acceptSyncMountedOccupancyCommand(command, nowMs) {
        calls.push(["mounted", command.type, nowMs]);
      }
    },
    playerLifecycleAuthority: {
      acceptLeaveCommand(command) {
        calls.push(["leave", command.type]);
      }
    },
    playerPoseAuthority: {
      acceptJoinCommand(command, nowMs) {
        calls.push(["join", command.type, nowMs]);
      },
      acceptSyncCommand(command, nowMs) {
        calls.push(["sync", command.type, nowMs]);
      }
    },
    playerTraversalAuthority: {
      acceptSyncPlayerLookIntentCommand(command, nowMs) {
        calls.push(["look", command.type, nowMs]);
      },
      acceptSyncPlayerTraversalIntentCommand(command, nowMs) {
        calls.push(["traversal", command.type, nowMs]);
      }
    },
    readPresenceRosterEvent: (nowMs) => {
      calls.push(["read-presence", nowMs]);
      return presenceEvent;
    },
    readWorldEvent: (nowMs) => {
      calls.push(["read-world", nowMs]);
      return worldEvent;
    },
    vehicleDriveAuthority: {
      acceptSyncDriverVehicleControlCommand(command, nowMs) {
        calls.push(["driver", command.type, nowMs]);
      }
    }
  });

  return {
    calls,
    commandIntake,
    presenceEvent,
    worldEvent
  };
}

test("MetaverseAuthoritativeWorldCommandIntake routes presence commands through the delegated owners", () => {
  const { calls, commandIntake, presenceEvent } = createCommandIntakeHarness();
  const playerId = createMetaversePlayerId("command-intake-presence-player");
  const username = createUsername("Presence Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  assert.equal(
    commandIntake.acceptPresenceCommand(
      createMetaverseJoinPresenceCommand({
        characterId: "metaverse-mannequin-v1",
        playerId,
        pose: {
          animationVocabulary: "idle",
          locomotionMode: "grounded",
          position: { x: 0, y: 0.6, z: 24 },
          stateSequence: 1,
          yawRadians: 0
        },
        username
      }),
      -10
    ),
    presenceEvent
  );
  assert.equal(
    commandIntake.acceptPresenceCommand(
      createMetaverseSyncPresenceCommand({
        playerId,
        pose: {
          animationVocabulary: "walk",
          locomotionMode: "grounded",
          position: { x: 1, y: 0.6, z: 24 },
          stateSequence: 2,
          yawRadians: 0.4
        }
      }),
      25
    ),
    presenceEvent
  );
  assert.equal(
    commandIntake.acceptPresenceCommand(
      createMetaverseLeavePresenceCommand({ playerId }),
      Number.NaN
    ),
    presenceEvent
  );

  assert.deepEqual(calls, [
    ["advance", 0],
    ["join", "join-presence", 0],
    ["read-presence", 0],
    ["advance", 25],
    ["sync", "sync-presence", 25],
    ["read-presence", 25],
    ["advance", 0],
    ["leave", "leave-presence"],
    ["read-presence", 0]
  ]);
});

test("MetaverseAuthoritativeWorldCommandIntake routes world commands through the delegated owners", () => {
  const { calls, commandIntake, worldEvent } = createCommandIntakeHarness();
  const playerId = createMetaversePlayerId("command-intake-world-player");

  assert.notEqual(playerId, null);

  assert.equal(
    commandIntake.acceptWorldCommand(
      createMetaverseSyncPlayerTraversalIntentCommand({
        intent: {
          actionIntent: { kind: "jump", pressed: true, sequence: 3 },
          bodyControl: {
            boost: false,
            moveAxis: 1,
            strafeAxis: 0,
            turnAxis: 0
          },
          facing: { pitchRadians: 0, yawRadians: 0.2 },
          inputSequence: 3,
          locomotionMode: "grounded"
        },
        playerId
      }),
      50
    ),
    worldEvent
  );
  assert.equal(
    commandIntake.acceptWorldCommand(
      createMetaverseSyncPlayerLookIntentCommand({
        lookIntent: { pitchRadians: 0.1, yawRadians: 0.3 },
        lookSequence: 1,
        playerId
      }),
      75
    ),
    worldEvent
  );
  assert.equal(
    commandIntake.acceptWorldCommand(
      createMetaverseSyncMountedOccupancyCommand({
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        playerId
      }),
      100
    ),
    worldEvent
  );
  assert.equal(
    commandIntake.acceptWorldCommand(
      createMetaverseSyncDriverVehicleControlCommand({
        controlIntent: {
          boost: true,
          environmentAssetId: "metaverse-hub-skiff-v1",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: -0.5
        },
        controlSequence: 1,
        playerId,
      }),
      125
    ),
    worldEvent
  );

  assert.deepEqual(calls, [
    ["advance", 50],
    ["traversal", "sync-player-traversal-intent", 50],
    ["read-world", 50],
    ["advance", 75],
    ["look", "sync-player-look-intent", 75],
    ["read-world", 75],
    ["advance", 100],
    ["mounted", "sync-mounted-occupancy", 100],
    ["read-world", 100],
    ["advance", 125],
    ["driver", "sync-driver-vehicle-control", 125],
    ["read-world", 125]
  ]);
});

test("MetaverseAuthoritativeWorldCommandIntake rejects unsupported command types", () => {
  const { commandIntake } = createCommandIntakeHarness();

  assert.throws(
    () =>
      commandIntake.acceptPresenceCommand(
        { type: "not-a-real-command" },
        0
      ),
    /Unsupported metaverse presence command type/
  );
  assert.throws(
    () =>
      commandIntake.acceptWorldCommand(
        { type: "not-a-real-world-command" },
        0
      ),
    /Unsupported metaverse realtime world command type/
  );
});
