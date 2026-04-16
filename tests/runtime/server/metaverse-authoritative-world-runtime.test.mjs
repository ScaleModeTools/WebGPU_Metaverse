import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand,
  createMetaverseSyncPresenceCommand,
  createMilliseconds,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

const shippedDockSupportHeightMeters = 0.6;

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
          y: shippedDockSupportHeightMeters,
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

function createMetaverseSyncPlayerTraversalIntentCommand(input) {
  const nextIntent = input.intent;
  const normalizedFacing =
    nextIntent.facing ?? {
      pitchRadians: nextIntent.pitchRadians ?? 0,
      yawRadians:
        nextIntent.bodyYawRadians ??
        nextIntent.lookYawRadians ??
        nextIntent.yawRadians ??
        0
    };

  if ("bodyControl" in nextIntent || "actionIntent" in nextIntent) {
    return createRawMetaverseSyncPlayerTraversalIntentCommand({
      ...input,
      intent: {
        ...nextIntent,
        facing: normalizedFacing
      }
    });
  }

  return createRawMetaverseSyncPlayerTraversalIntentCommand({
    ...input,
    intent: {
      actionIntent: {
        kind: nextIntent.jump === true ? "jump" : "none",
        pressed: nextIntent.jump === true,
        ...(nextIntent.jumpActionSequence === undefined
          ? {}
          : { sequence: nextIntent.jumpActionSequence })
      },
      bodyControl: {
        boost: nextIntent.boost,
        moveAxis: nextIntent.moveAxis,
        strafeAxis: nextIntent.strafeAxis,
        turnAxis: nextIntent.yawAxis
      },
      facing: normalizedFacing,
      inputSequence: nextIntent.inputSequence,
      locomotionMode: nextIntent.locomotionMode
    }
  });
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
          y: shippedDockSupportHeightMeters,
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
        yawRadians: 0.36,
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

test("MetaverseAuthoritativeWorldRuntime stores explicit unmounted traversal facing without rewriting authoritative body yaw before the next tick", () => {
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
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        },
        facing: {
          pitchRadians: -0.35,
          yawRadians: Math.PI * 0.75
        },
        inputSequence: 2,
        locomotionMode: "grounded"
      },
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

test("MetaverseAuthoritativeWorldRuntime aligns unmounted authoritative body yaw to explicit traversal facing", () => {
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
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0.2,
          yawRadians: Math.PI * 0.5
        },
        inputSequence: 1,
        locomotionMode: "grounded"
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.players[0]?.yawRadians, Math.PI * 0.5);
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.2);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
});

test("MetaverseAuthoritativeWorldRuntime accepts same-sequence unmounted facing refreshes without advancing movement ack", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("same-sequence-facing-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Same Sequence Facing Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: 0
  });

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        inputSequence: 1,
        locomotionMode: "grounded"
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0.3
        },
        facing: {
          pitchRadians: -0.2,
          yawRadians: Math.PI * 0.5
        },
        inputSequence: 1,
        locomotionMode: "grounded"
      },
      playerId
    }),
    100
  );

  const preTickSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(preTickSnapshot.players[0]?.lastProcessedInputSequence, 1);
  assert.equal(preTickSnapshot.players[0]?.stateSequence, 1);
  assert.equal(preTickSnapshot.players[0]?.look.pitchRadians, -0.2);
  assert.equal(preTickSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
  assert.equal(preTickSnapshot.players[0]?.yawRadians, 0);

  runtime.advanceToTime(200);

  const postTickSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(postTickSnapshot.players[0]?.lastProcessedInputSequence, 1);
  assert.equal(postTickSnapshot.players[0]?.stateSequence, 1);
  assert.equal(postTickSnapshot.players[0]?.yawRadians, Math.PI * 0.5);
  assert.equal(postTickSnapshot.players[0]?.look.pitchRadians, -0.2);
  assert.equal(postTickSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
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
          y: shippedDockSupportHeightMeters,
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
  assert.equal(groundedWorldSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(
    Math.abs(
      (groundedWorldSnapshot.players[0]?.position.y ?? 0) -
        shippedDockSupportHeightMeters
    ) < 0.001
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
        yawRadians: Math.PI * 0.06,
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
        yawRadians: Math.PI * 0.06,
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
        yawRadians: Math.PI * 0.06,
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
  assert.ok((airborneSnapshot.players[0]?.position.y ?? 0) > 0.05);

  runtime.advanceToTime(800);

  const settledSupportSnapshot = runtime.readWorldSnapshot(800, playerId);

  assert.equal(settledSupportSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(
    (settledSupportSnapshot.players[0]?.position.y ?? 0) >
      shippedDockSupportHeightMeters - 0.02
  );
  assert.ok(
    (settledSupportSnapshot.players[0]?.position.y ?? 0) <
      shippedDockSupportHeightMeters + 0.03
  );
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
        yawRadians: Math.PI * 0.06,
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
          y: shippedDockSupportHeightMeters,
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
  assert.equal(jumpAscentSnapshot.players[0]?.jumpAuthorityState, "rising");
  assert.equal(
    jumpAscentSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    jumpAscentSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "rising"
  );
  assert.equal(
    jumpAscentSnapshot.players[0]?.traversalAuthority.currentActionSequence,
    2
  );
  assert.ok(
    (jumpAscentSnapshot.players[0]?.position.y ?? 0) >
      shippedDockSupportHeightMeters
  );
  assert.ok((jumpAscentSnapshot.players[0]?.linearVelocity.y ?? 0) > 0);
  assert.equal(jumpAscentSnapshot.players[0]?.lastProcessedInputSequence, 2);
  assert.equal(
    jumpAscentSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );

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

  assert.equal(jumpDescentSnapshot.players[0]?.jumpAuthorityState, "falling");
  assert.equal(
    jumpDescentSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "falling"
  );
  assert.ok(
    (jumpDescentSnapshot.players[0]?.position.y ?? 0) >
      shippedDockSupportHeightMeters
  );
  assert.ok((jumpDescentSnapshot.players[0]?.linearVelocity.y ?? 0) < 0);
  assert.equal(jumpDescentSnapshot.players[0]?.lastProcessedInputSequence, 3);
  assert.equal(
    jumpDescentSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(jumpDescentSnapshot.players[0]?.stateSequence, 3);

  runtime.advanceToTime(1_000);

  const landedSnapshot = runtime.readWorldSnapshot(1_000, playerId);

  assert.equal(landedSnapshot.players[0]?.jumpAuthorityState, "grounded");
  assert.equal(
    landedSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "none"
  );
  assert.equal(
    landedSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    landedSnapshot.players[0]?.jumpDebug.resolvedJumpActionSequence,
    2
  );
  assert.ok(Math.abs(landedSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.001);
  assert.ok(
    (landedSnapshot.players[0]?.position.y ?? 0) >
      shippedDockSupportHeightMeters - 0.02
  );
  assert.ok(
    (landedSnapshot.players[0]?.position.y ?? 0) <
      shippedDockSupportHeightMeters + 0.03
  );
  assert.equal(
    landedSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
});

test("MetaverseAuthoritativeWorldRuntime exposes buffered jump startup as traversal authority before the first jump tick", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("jump-startup-buffered-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Jump Startup Buffered"), "username");

  joinSurfacePlayer(runtime, playerId, username);
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

  const bufferedJumpSnapshot = runtime.readWorldSnapshot(0, playerId);

  assert.equal(
    bufferedJumpSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "jump"
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "startup"
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.traversalAuthority.currentActionSequence,
    2
  );
});

test("MetaverseAuthoritativeWorldRuntime does not let snap-to-ground clip the first dock jump tick", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(33)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-first-tick-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Jump First Tick Pilot"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: shippedDockSupportHeightMeters,
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
  runtime.advanceToTime(33);

  const jumpSnapshot = runtime.readWorldSnapshot(33, playerId);

  assert.equal(jumpSnapshot.players[0]?.jumpAuthorityState, "rising");
  assert.ok(
    (jumpSnapshot.players[0]?.position.y ?? 0) > shippedDockSupportHeightMeters
  );
  assert.ok((jumpSnapshot.players[0]?.linearVelocity.y ?? 0) > 0);
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps a dock jump airborne below snap distance until touchdown", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(33)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-landing-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Jump Landing Pilot"),
    "username"
  );

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: shippedDockSupportHeightMeters,
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
  runtime.advanceToTime(33);
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
    33
  );

  let sawFallingNearDockTouchdown = false;

  for (let timeMs = 66; timeMs <= 1_000; timeMs += 33) {
    runtime.advanceToTime(timeMs);

    const snapshot = runtime.readWorldSnapshot(timeMs, playerId).players[0];

    if (
      snapshot?.jumpAuthorityState === "falling" &&
      (snapshot.position.y ?? 0) > shippedDockSupportHeightMeters &&
      (snapshot.position.y ?? 0) < shippedDockSupportHeightMeters + 0.2 &&
      (snapshot.linearVelocity.y ?? 0) < 0
    ) {
      sawFallingNearDockTouchdown = true;
    }

    if (snapshot?.jumpAuthorityState === "grounded") {
      break;
    }
  }

  assert.ok(sawFallingNearDockTouchdown);
});

test("MetaverseAuthoritativeWorldRuntime accepts a dock jump after recent grounded travel at hub cadence", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(33)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-after-travel-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Jump After Travel Pilot"),
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
  runtime.advanceToTime(132);

  const movingGroundedSnapshot = runtime.readWorldSnapshot(132, playerId);

  assert.equal(movingGroundedSnapshot.players[0]?.jumpAuthorityState, "grounded");
  assert.equal(movingGroundedSnapshot.players[0]?.jumpDebug.supported, true);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 3,
        jump: true,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    132
  );
  runtime.advanceToTime(165);

  const jumpSnapshot = runtime.readWorldSnapshot(165, playerId);

  assert.equal(jumpSnapshot.players[0]?.jumpAuthorityState, "rising");
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    3
  );
  assert.equal(jumpSnapshot.players[0]?.jumpDebug.resolvedJumpActionState, "accepted");
});

test("MetaverseAuthoritativeWorldRuntime accepts a grounded jump when dock support is within snap distance", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-support-window-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Jump Support Window Pilot"),
    "username"
  );
  const initialHeight = shippedDockSupportHeightMeters + 0.12;

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: initialHeight,
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

  const jumpSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(jumpSnapshot.players[0]?.jumpAuthorityState, "rising");
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.ok((jumpSnapshot.players[0]?.position.y ?? 0) > initialHeight);
  assert.ok((jumpSnapshot.players[0]?.linearVelocity.y ?? 0) > 0);
});

test("MetaverseAuthoritativeWorldRuntime briefly buffers an airborne jump edge before rejecting it", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-reject-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("World Jump Reject Pilot"), "username");

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "metaverse-mannequin-v1",
      playerId,
      pose: {
        position: {
          x: -8.2,
          y: shippedDockSupportHeightMeters,
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
  runtime.advanceToTime(200);
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 4,
        jump: true,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    200
  );
  runtime.advanceToTime(300);

  const bufferedJumpSnapshot = runtime.readWorldSnapshot(300, playerId);

  assert.equal(bufferedJumpSnapshot.players[0]?.jumpAuthorityState, "rising");
  assert.equal(
    bufferedJumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.jumpDebug.pendingJumpActionSequence,
    4
  );
  assert.ok(
    (bufferedJumpSnapshot.players[0]?.jumpDebug.pendingJumpBufferAgeMs ?? 0) >= 100
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.jumpDebug.resolvedJumpActionState,
    "accepted"
  );
  runtime.advanceToTime(500);

  const rejectedJumpSnapshot = runtime.readWorldSnapshot(500, playerId);

  assert.equal(rejectedJumpSnapshot.players[0]?.jumpAuthorityState, "falling");
  assert.equal(
    rejectedJumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.traversalAuthority.lastRejectedActionSequence,
    4
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.pendingJumpActionSequence,
    0
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.resolvedJumpActionSequence,
    4
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.resolvedJumpActionState,
    "rejected-buffer-expired"
  );
  assert.ok(
    (rejectedJumpSnapshot.players[0]?.position.y ?? 0) >
      shippedDockSupportHeightMeters
  );
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
