import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseSyncPresenceCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createAuthoritativeRuntime() {
  return new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
}

function joinSurfacePlayer(runtime, playerId, username, poseOverrides = {}) {
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: 0.15,
          z: -14.8
        },
        stateSequence: 1,
        yawRadians: Math.PI * 0.06,
        ...poseOverrides
      },
      username
    }),
    0
  );
}

test("MetaverseAuthoritativeWorldRuntime simulates driver-controlled vehicles from authoritative world commands", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("harbor-pilot"),
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
      }
    }),
    0
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId,
    }),
    100
  );
  runtime.advanceToTime(1_000);

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 10);
  assert.equal(worldSnapshot.tick.emittedAtServerTimeMs, 1_000);
  assert.equal(worldSnapshot.tick.simulationTimeMs, 1_000);
  assert.equal(worldSnapshot.players.length, 1);
  assert.equal(worldSnapshot.players[0]?.animationVocabulary, "seated");
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(worldSnapshot.players[0]?.position.x, 0);
  assert.equal(worldSnapshot.players[0]?.position.y, 0.4);
  assert.ok(Math.abs(worldSnapshot.players[0]?.position.z - 18.63) < 0.0001);
  assert.equal(worldSnapshot.players[0]?.linearVelocity.x, 0);
  assert.ok(
    Math.abs(worldSnapshot.players[0]?.linearVelocity.z + 10.5) < 0.0001
  );
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(worldSnapshot.players[0]?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    worldSnapshot.players[0]?.mountedOccupancy?.vehicleId,
    worldSnapshot.vehicles[0]?.vehicleId
  );
  assert.equal(worldSnapshot.vehicles.length, 1);
  assert.equal(
    worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );
  assert.equal(worldSnapshot.vehicles[0]?.position.x, 0);
  assert.ok(Math.abs(worldSnapshot.vehicles[0]?.position.z - 18.63) < 0.0001);
  assert.equal(worldSnapshot.vehicles[0]?.yawRadians, 0);
  assert.ok(
    Math.abs(worldSnapshot.vehicles[0]?.linearVelocity.z + 10.5) < 0.0001
  );
});

test("MetaverseAuthoritativeWorldRuntime prunes inactive players while keeping vehicle state and presence projection coherent", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(500),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("watchful-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Watchful Pilot"), "username");

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
  runtime.advanceToTime(200);

  assert.equal(runtime.readPresenceRosterSnapshot(200, playerId).players.length, 1);

  runtime.advanceToTime(800);
  const prunedWorldSnapshot = runtime.readWorldSnapshot(800);

  assert.equal(prunedWorldSnapshot.players.length, 0);
  assert.equal(prunedWorldSnapshot.vehicles.length, 1);
  assert.equal(
    prunedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    null
  );
  assert.equal(runtime.readPresenceRosterSnapshot(800).players.length, 0);
  assert.throws(
    () => runtime.readWorldSnapshot(800, playerId),
    /Unknown metaverse player: watchful-harbor-pilot/
  );
});

test("MetaverseAuthoritativeWorldRuntime includes player turn rate in authoritative world snapshots", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("turn-rate-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Turn Rate Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: 0.15,
          z: -14.8
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 1
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.angularVelocityRadiansPerSecond ?? 0) - 3.6
    ) < 0.000001
  );
});

test("MetaverseAuthoritativeWorldRuntime stores explicit player look intent without rewriting authoritative body yaw", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("look-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Look Harbor Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: Math.PI * 0.25
  });

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.35,
        yawRadians: Math.PI * 0.75
      },
      lookSequence: 3,
      playerId
    }),
    100
  );

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.35);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.75);
  assert.equal(worldSnapshot.players[0]?.yawRadians, Math.PI * 0.25);
});

test("MetaverseAuthoritativeWorldRuntime preserves explicit mounted passenger look through presence fallback snapshots", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("presence-look-passenger"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Presence Look Passenger"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "seated",
        look: {
          pitchRadians: 0.3,
          yawRadians: 0.5
        },
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
        yawRadians: 0.2
      },
      username
    }),
    0
  );

  const presenceSnapshot = runtime.readPresenceRosterSnapshot(0, playerId);

  assert.equal(presenceSnapshot.players[0]?.pose.yawRadians, 0.2);
  assert.equal(presenceSnapshot.players[0]?.pose.look.pitchRadians, 0.3);
  assert.equal(presenceSnapshot.players[0]?.pose.look.yawRadians, 0.5);
});

test("MetaverseAuthoritativeWorldRuntime turns unmounted authoritative body yaw toward explicit look intent", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("look-facing-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Look Facing Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: 0
  });

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: 0.2,
        yawRadians: Math.PI * 0.5
      },
      lookSequence: 1,
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.ok(Math.abs((worldSnapshot.players[0]?.yawRadians ?? 0) - 0.36) < 0.000001);
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.2);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
});

test("MetaverseAuthoritativeWorldRuntime keeps mounted driver look constrained to mount-facing yaw while preserving explicit pitch", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("driver-look-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Driver Look Pilot"), "username");

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

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: 0.3,
        yawRadians: 1.2
      },
      lookSequence: 1,
      playerId
    }),
    0
  );

  let worldSnapshot = runtime.readWorldSnapshot(0, playerId);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.3);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, 0);

  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 1
      },
      controlSequence: 1,
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.ok(Math.abs((worldSnapshot.players[0]?.yawRadians ?? 0) - 0.095) < 0.000001);
  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.look.yawRadians ?? 0) -
        (worldSnapshot.players[0]?.yawRadians ?? 0)
    ) < 0.000001
  );
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.3);
});

test("MetaverseAuthoritativeWorldRuntime clamps mounted passenger look arc and pitch separately from body yaw", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("passenger-look-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Passenger Look Pilot"),
    "username"
  );

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
          occupantRole: "passenger",
          seatId: "port-bench-seat"
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

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: 1.2,
        yawRadians: Math.PI
      },
      lookSequence: 1,
      playerId
    }),
    0
  );

  const worldSnapshot = runtime.readWorldSnapshot(0, playerId);

  assert.equal(worldSnapshot.players[0]?.yawRadians, 0);
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.42);
  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.look.yawRadians ?? 0) - Math.PI * 0.45
    ) < 0.000001
  );
});

test("MetaverseAuthoritativeWorldRuntime simulates unmounted grounded and swim traversal from authoritative traversal intent commands", () => {
  const groundedRuntime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const groundedPlayerId = requireValue(
    createMetaversePlayerId("world-traversal-harbor-pilot"),
    "playerId"
  );
  const groundedUsername = requireValue(
    createUsername("World Traversal Pilot"),
    "username"
  );

  groundedRuntime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: groundedPlayerId,
      pose: {
        position: {
          x: -8.2,
          y: 0.15,
          z: -14.8
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username: groundedUsername
    }),
    0
  );
  groundedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "swim",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: groundedPlayerId
    }),
    0
  );
  groundedRuntime.advanceToTime(200);

  const groundedWorldSnapshot =
    groundedRuntime.readWorldSnapshot(200, groundedPlayerId);

  assert.equal(groundedWorldSnapshot.tick.currentTick, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.animationVocabulary, "walk");
  assert.equal(groundedWorldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(
    Math.abs((groundedWorldSnapshot.players[0]?.position.y ?? 0) - 0.15) <
      0.001
  );
  assert.ok((groundedWorldSnapshot.players[0]?.position.z ?? -14.8) < -14.8);
  assert.ok((groundedWorldSnapshot.players[0]?.linearVelocity.z ?? 0) < 0);
  assert.equal(groundedWorldSnapshot.players[0]?.stateSequence, 2);

  const swimRuntime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const swimPlayerId = requireValue(
    createMetaversePlayerId("world-swim-harbor-pilot"),
    "swimPlayerId"
  );
  const swimUsername = requireValue(createUsername("World Swim Pilot"), "swimUsername");

  swimRuntime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: swimPlayerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username: swimUsername
    }),
    0
  );
  swimRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        inputSequence: 3,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: swimPlayerId
    }),
    0
  );
  swimRuntime.advanceToTime(500);

  const swimWorldSnapshot = swimRuntime.readWorldSnapshot(500, swimPlayerId);

  assert.equal(swimWorldSnapshot.players[0]?.animationVocabulary, "swim");
  assert.equal(swimWorldSnapshot.players[0]?.lastProcessedInputSequence, 3);
  assert.equal(swimWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(swimWorldSnapshot.players[0]?.position.y, 0);
  assert.ok(
    (swimWorldSnapshot.players[0]?.position.z ?? Number.POSITIVE_INFINITY) <
      24
  );
  assert.ok((swimWorldSnapshot.players[0]?.linearVelocity.z ?? 0) < 0);
  assert.equal(swimWorldSnapshot.players[0]?.stateSequence, 3);
});

test("MetaverseAuthoritativeWorldRuntime keeps presence resyncs from overriding realtime world pose authority", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("presence-authority-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Presence Authority Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(200);

  const authoritativeWorldSnapshot = runtime.readWorldSnapshot(200, playerId);
  const authoritativePlayerSnapshot = authoritativeWorldSnapshot.players[0];

  assert.notEqual(authoritativePlayerSnapshot, undefined);
  assert.equal(authoritativePlayerSnapshot?.lastProcessedInputSequence, 2);
  assert.equal(authoritativePlayerSnapshot?.stateSequence, 2);

  runtime.acceptPresenceCommand(
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "jump-down",
        locomotionMode: "fly",
        look: {
          pitchRadians: 0.45,
          yawRadians: 1.1
        },
        position: {
          x: 42,
          y: 12,
          z: 96
        },
        stateSequence: 99,
        yawRadians: 1.4
      }
    }),
    200
  );

  let worldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.deepEqual(worldSnapshot.players[0]?.position, authoritativePlayerSnapshot?.position);
  assert.equal(worldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);

  let presenceSnapshot = runtime.readPresenceRosterSnapshot(200, playerId);

  assert.deepEqual(
    presenceSnapshot.players[0]?.pose.position,
    authoritativePlayerSnapshot?.position
  );
  assert.equal(presenceSnapshot.players[0]?.pose.stateSequence, 2);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        animationVocabulary: "swim",
        locomotionMode: "swim",
        look: {
          pitchRadians: -0.25,
          yawRadians: -1.2
        },
        position: {
          x: -33,
          y: 4,
          z: 18
        },
        stateSequence: 100,
        yawRadians: -0.7
      },
      username
    }),
    200
  );

  worldSnapshot = runtime.readWorldSnapshot(200, playerId);
  presenceSnapshot = runtime.readPresenceRosterSnapshot(200, playerId);

  assert.deepEqual(worldSnapshot.players[0]?.position, authoritativePlayerSnapshot?.position);
  assert.equal(worldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);
  assert.deepEqual(
    presenceSnapshot.players[0]?.pose.position,
    authoritativePlayerSnapshot?.position
  );
  assert.equal(presenceSnapshot.players[0]?.pose.stateSequence, 2);
});

test("MetaverseAuthoritativeWorldRuntime routes the shipped dock spawn into water on the shared shoreline slice", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-water-entry-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Water Entry"), "username");

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  let worldSnapshot = null;

  for (let timeMs = 100; timeMs <= 1_000; timeMs += 100) {
    runtime.advanceToTime(timeMs);
    const candidateSnapshot = runtime.readWorldSnapshot(timeMs, playerId);

    if (candidateSnapshot.players[0]?.locomotionMode === "swim") {
      worldSnapshot = candidateSnapshot;
      break;
    }
  }

  assert.notEqual(worldSnapshot, null);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(worldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.ok((worldSnapshot.players[0]?.position.z ?? 0) < -19.2);
});

test("MetaverseAuthoritativeWorldRuntime holds sustained swim after dock entry before the shipped shoreline exit lane", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-sustained-swim-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Swim Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  let swimEntryTimeMs = null;

  for (let timeMs = 100; timeMs <= 1_000; timeMs += 100) {
    runtime.advanceToTime(timeMs);

    if (runtime.readWorldSnapshot(timeMs, playerId).players[0]?.locomotionMode === "swim") {
      swimEntryTimeMs = timeMs;
      break;
    }
  }

  assert.notEqual(swimEntryTimeMs, null);

  const sustainedSwimTimeMs = swimEntryTimeMs + 200;

  runtime.advanceToTime(sustainedSwimTimeMs);

  const worldSnapshot = runtime.readWorldSnapshot(sustainedSwimTimeMs, playerId);

  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(worldSnapshot.players[0]?.position.y, 0);
  assert.ok((worldSnapshot.players[0]?.position.z ?? 0) < -20);
});

test("MetaverseAuthoritativeWorldRuntime keeps a dock jump airborne before Rapier shoreline support settles it back to grounded", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-jump-arc-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Jump Arc"), "username");

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: true,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(300);

  const airborneSnapshot = runtime.readWorldSnapshot(300, playerId);

  assert.equal(airborneSnapshot.players[0]?.locomotionMode, "grounded");
  assert.match(airborneSnapshot.players[0]?.animationVocabulary ?? "", /^jump-/);
  assert.ok((airborneSnapshot.players[0]?.position.y ?? 0) > 0.05);

  runtime.advanceToTime(800);

  const settledSupportSnapshot = runtime.readWorldSnapshot(800, playerId);

  assert.equal(settledSupportSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok((settledSupportSnapshot.players[0]?.position.y ?? 0) > 0.16);
  assert.ok((settledSupportSnapshot.players[0]?.position.y ?? 0) < 0.22);
});

test("MetaverseAuthoritativeWorldRuntime exits onto the shipped shoreline support lane without vertical seam ejection", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-exit-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Exit Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(1_700);

  const shorelineExitSnapshot = runtime.readWorldSnapshot(1_700, playerId);

  assert.equal(shorelineExitSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok((shorelineExitSnapshot.players[0]?.position.y ?? 0) > 0.17);
  assert.ok((shorelineExitSnapshot.players[0]?.position.y ?? 0) < 0.35);
  assert.ok(
    Math.abs(shorelineExitSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.005
  );

  runtime.advanceToTime(2_100);

  const settledSnapshot = runtime.readWorldSnapshot(2_100, playerId);

  assert.equal(settledSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok((settledSnapshot.players[0]?.position.y ?? 0) > 0.17);
  assert.ok((settledSnapshot.players[0]?.position.y ?? 0) < 0.35);
  assert.ok(Math.abs(settledSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.005);
});

test("MetaverseAuthoritativeWorldRuntime simulates grounded jump ascent, descent, and landing on authoritative ticks", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("World Jump Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: 0.15,
          z: -14.8
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: true,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const jumpAscentSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(jumpAscentSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(jumpAscentSnapshot.players[0]?.animationVocabulary, "jump-up");
  assert.ok((jumpAscentSnapshot.players[0]?.position.y ?? 0) > 0.15);
  assert.ok((jumpAscentSnapshot.players[0]?.linearVelocity.y ?? 0) > 0);
  assert.equal(jumpAscentSnapshot.players[0]?.lastProcessedInputSequence, 2);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 3,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    100
  );
  runtime.advanceToTime(500);

  const jumpDescentSnapshot = runtime.readWorldSnapshot(500, playerId);

  assert.equal(jumpDescentSnapshot.players[0]?.animationVocabulary, "jump-down");
  assert.ok((jumpDescentSnapshot.players[0]?.position.y ?? 0) > 0.15);
  assert.ok((jumpDescentSnapshot.players[0]?.linearVelocity.y ?? 0) < 0);
  assert.equal(jumpDescentSnapshot.players[0]?.lastProcessedInputSequence, 3);
  assert.equal(jumpDescentSnapshot.players[0]?.stateSequence, 3);

  runtime.advanceToTime(1_000);

  const landedSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(landedSnapshot.players[0]?.animationVocabulary, "idle");
  assert.ok(Math.abs(landedSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.001);
  assert.ok((landedSnapshot.players[0]?.position.y ?? 0) > 0.16);
  assert.ok((landedSnapshot.players[0]?.position.y ?? 0) < 0.18);
});

test("MetaverseAuthoritativeWorldRuntime accepts mounted occupancy updates through reliable world commands", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-mounted-occupancy-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Mounted Occupancy Pilot"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: 12.2,
          y: 0.4,
          z: -13.8
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );
  runtime.acceptWorldCommand(
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
  );

  const mountedWorldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(mountedWorldSnapshot.players[0]?.lastProcessedInputSequence, 1);
  assert.equal(mountedWorldSnapshot.players[0]?.locomotionMode, "mounted");
  assert.equal(
    mountedWorldSnapshot.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    mountedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    playerId
  );

  runtime.acceptWorldCommand(
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: null,
      playerId
    }),
    200
  );

  const dismountedWorldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(dismountedWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(dismountedWorldSnapshot.players[0]?.mountedOccupancy, null);
  assert.equal(dismountedWorldSnapshot.players[0]?.position.y, 0);
  assert.equal(
    dismountedWorldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId,
    null
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps simulation time stable between repeated reads inside one tick", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("stable-tick-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Stable Tick Pilot"), "username");

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

  runtime.advanceToTime(150);

  const firstSnapshot = runtime.readWorldSnapshot(160, playerId);
  const secondSnapshot = runtime.readWorldSnapshot(190, playerId);

  assert.equal(firstSnapshot.tick.currentTick, 1);
  assert.equal(secondSnapshot.tick.currentTick, 1);
  assert.equal(firstSnapshot.tick.simulationTimeMs, 100);
  assert.equal(secondSnapshot.tick.simulationTimeMs, 100);
  assert.equal(firstSnapshot.tick.emittedAtServerTimeMs, 160);
  assert.equal(secondSnapshot.tick.emittedAtServerTimeMs, 190);
});

test("MetaverseAuthoritativeWorldRuntime does not advance simulation when snapshots are only read", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("read-only-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Read Only Pilot"), "username");

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
  runtime.advanceToTime(150);

  const firstSnapshot = runtime.readWorldSnapshot(260, playerId);
  const secondSnapshot = runtime.readWorldSnapshot(290, playerId);

  assert.equal(firstSnapshot.tick.currentTick, 1);
  assert.equal(secondSnapshot.tick.currentTick, 1);
  assert.equal(firstSnapshot.tick.simulationTimeMs, 100);
  assert.equal(secondSnapshot.tick.simulationTimeMs, 100);
});

test("MetaverseAuthoritativeWorldRuntime coalesces driver control per tick and rejects duplicate or stale sequences", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("coalesced-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Coalesced Pilot"), "username");

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

  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId
    }),
    10
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: -1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 2,
      playerId
    }),
    20
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 2,
      playerId
    }),
    30
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId
    }),
    40
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.tick.currentTick, 1);
  assert.ok((worldSnapshot.vehicles[0]?.position.z ?? 0) > 24);
  assert.ok((worldSnapshot.vehicles[0]?.linearVelocity.z ?? 0) > 0);
  assert.ok((worldSnapshot.players[0]?.position.z ?? 0) > 24);
  assert.ok((worldSnapshot.players[0]?.linearVelocity.z ?? 0) > 0);
});

test("MetaverseAuthoritativeWorldRuntime keeps a claimed driver seat exclusive and ignores conflicting driver control", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const firstDriverPlayerId = requireValue(
    createMetaversePlayerId("first-harbor-pilot"),
    "first driver playerId"
  );
  const conflictingDriverPlayerId = requireValue(
    createMetaversePlayerId("conflicting-harbor-pilot"),
    "conflicting driver playerId"
  );
  const firstDriverUsername = requireValue(
    createUsername("First Harbor Pilot"),
    "first driver username"
  );
  const conflictingDriverUsername = requireValue(
    createUsername("Conflicting Harbor Pilot"),
    "conflicting driver username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: firstDriverPlayerId,
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
      username: firstDriverUsername
    }),
    0
  );
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId: conflictingDriverPlayerId,
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
          x: 1,
          y: 0.4,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username: conflictingDriverUsername
    }),
    10
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId: conflictingDriverPlayerId
    }),
    20
  );
  runtime.advanceToTime(200);

  const worldSnapshot = runtime.readWorldSnapshot(200, firstDriverPlayerId);
  const firstDriverSnapshot = worldSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === firstDriverPlayerId
  );
  const conflictingDriverSnapshot = worldSnapshot.players.find(
    (playerSnapshot) => playerSnapshot.playerId === conflictingDriverPlayerId
  );

  assert.equal(worldSnapshot.vehicles[0]?.seats[0]?.occupantPlayerId, firstDriverPlayerId);
  assert.equal(worldSnapshot.vehicles[0]?.position.z, 24);
  assert.equal(worldSnapshot.vehicles[0]?.linearVelocity.z, 0);
  assert.equal(firstDriverSnapshot?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(conflictingDriverSnapshot?.mountedOccupancy, null);
  assert.equal(conflictingDriverSnapshot?.locomotionMode, "swim");
});
