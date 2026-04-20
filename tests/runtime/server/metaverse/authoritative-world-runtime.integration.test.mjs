import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand as createRawMetaverseSyncPlayerTraversalIntentCommand,
  createMilliseconds,
  metaverseGroundedBodyTraversalCoreConfig,
  metaverseWorldGroundedSpawnPosition,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import {
  authoredGroundedSpawnYawRadians,
  authoredWaterBayDockEntryPosition,
  authoredWaterBayDockEntryYawRadians,
  authoredWaterBayOpenWaterSpawn,
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../metaverse-authored-world-test-fixtures.mjs";

const shippedGroundedSpawnSupportHeightMeters =
  metaverseWorldGroundedSpawnPosition.y;

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function readPrimaryPlayerActionPhase(worldSnapshot) {
  return worldSnapshot.players[0]?.traversalAuthority.currentActionPhase ?? null;
}

function primaryPlayerHasGroundedLocomotion(worldSnapshot) {
  const playerSnapshot = worldSnapshot.players[0];

  return (
    playerSnapshot !== undefined &&
    playerSnapshot.mountedOccupancy === null &&
    playerSnapshot.locomotionMode === "grounded" &&
    playerSnapshot.traversalAuthority.currentActionPhase !== "rising" &&
    playerSnapshot.traversalAuthority.currentActionPhase !== "falling"
  );
}

function offsetLocalPlanarPosition(
  position,
  rotationYRadians,
  localX,
  localZ
) {
  const sine = Math.sin(rotationYRadians);
  const cosine = Math.cos(rotationYRadians);

  return Object.freeze({
    x: position.x + localX * cosine + localZ * sine,
    y: position.y,
    z: position.z - localX * sine + localZ * cosine
  });
}

function resolveLocalPlanarOffset(position, origin, rotationYRadians) {
  const deltaX = position.x - origin.x;
  const deltaZ = position.z - origin.z;
  const sine = Math.sin(-rotationYRadians);
  const cosine = Math.cos(-rotationYRadians);

  return Object.freeze({
    x: deltaX * cosine + deltaZ * sine,
    z: -deltaX * sine + deltaZ * cosine
  });
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
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
        },
        stateSequence: 1,
        yawRadians: authoredGroundedSpawnYawRadians,
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

test("MetaverseAuthoritativeWorldRuntime routes an authored dock entry into the shared water bay", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-water-entry-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Water Entry"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: authoredWaterBayDockEntryPosition,
    yawRadians: authoredWaterBayDockEntryYawRadians
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        yawRadians: authoredWaterBayDockEntryYawRadians,
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
  assert.ok(
    (worldSnapshot.players[0]?.position.x ?? 0) >
      authoredWaterBayDockEntryPosition.x + 3.2
  );
});

test("MetaverseAuthoritativeWorldRuntime holds sustained swim after authored dock entry before shoreline exit", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-sustained-swim-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Swim Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: authoredWaterBayDockEntryPosition,
    yawRadians: authoredWaterBayDockEntryYawRadians
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        yawRadians: authoredWaterBayDockEntryYawRadians,
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
  assert.ok(
    (worldSnapshot.players[0]?.position.x ?? 0) >
      authoredWaterBayDockEntryPosition.x + 4.6
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps idle dynamic skiff collision authoritative for swimmers before any mount claim exists", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("idle-skiff-swim-collision-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Idle Skiff Swimmer"), "username");
  const skiffCenterPosition = Object.freeze({
    x: authoredWaterBaySkiffPlacement.x,
    y: 0,
    z: authoredWaterBaySkiffPlacement.z
  });
  const skiffYawRadians = authoredWaterBaySkiffYawRadians;
  const swimStartPosition = offsetLocalPlanarPosition(
    skiffCenterPosition,
    skiffYawRadians,
    0,
    3.2
  );
  const swimYawRadians = -skiffYawRadians;

  joinSurfacePlayer(runtime, playerId, username, {
    locomotionMode: "swim",
    position: swimStartPosition,
    yawRadians: swimYawRadians
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        inputSequence: 2,
        jump: false,
        locomotionMode: "swim",
        moveAxis: 1,
        yawRadians: swimYawRadians,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    }),
    0
  );

  for (let timeMs = 100; timeMs <= 1_000; timeMs += 100) {
    runtime.advanceToTime(timeMs);
  }

  const worldSnapshot = runtime.readWorldSnapshot(1_000, playerId);
  const swimmerPosition = worldSnapshot.players[0]?.position;

  assert.notEqual(swimmerPosition, undefined);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(worldSnapshot.players[0]?.lastProcessedInputSequence, 2);

  const swimmerLocalOffset = resolveLocalPlanarOffset(
    swimmerPosition,
    skiffCenterPosition,
    skiffYawRadians
  );
  const expectedSkiffBeamClearanceMeters =
    metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
    metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters +
    1.3;

  assert.ok(
    swimmerLocalOffset.z > expectedSkiffBeamClearanceMeters - 0.04,
    `expected swimmer to remain outside the idle skiff hull beam, received local offset ${JSON.stringify(swimmerLocalOffset)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps a grounded-spawn jump airborne before support settles it back to grounded", () => {
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
      shippedGroundedSpawnSupportHeightMeters - 0.02
  );
  assert.ok(
    (settledSupportSnapshot.players[0]?.position.y ?? 0) <
      shippedGroundedSpawnSupportHeightMeters + 0.03
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
  assert.ok((shorelineExitSnapshot.players[0]?.position.y ?? 0) > 0.4);
  assert.ok((shorelineExitSnapshot.players[0]?.position.y ?? 0) < 0.45);
  assert.ok(
    Math.abs(shorelineExitSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.005
  );

  runtime.advanceToTime(2_100);

  const settledSnapshot = runtime.readWorldSnapshot(2_100, playerId);

  assert.equal(settledSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok((settledSnapshot.players[0]?.position.y ?? 0) > 0.4);
  assert.ok((settledSnapshot.players[0]?.position.y ?? 0) < 0.45);
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
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
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
  assert.equal(readPrimaryPlayerActionPhase(jumpAscentSnapshot), "rising");
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
      shippedGroundedSpawnSupportHeightMeters
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

  assert.equal(readPrimaryPlayerActionPhase(jumpDescentSnapshot), "falling");
  assert.equal(
    jumpDescentSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "falling"
  );
  assert.ok(
    (jumpDescentSnapshot.players[0]?.position.y ?? 0) >
      shippedGroundedSpawnSupportHeightMeters
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

  assert.equal(primaryPlayerHasGroundedLocomotion(landedSnapshot), true);
  assert.equal(
    landedSnapshot.players[0]?.traversalAuthority.currentActionKind,
    "none"
  );
  assert.equal(
    landedSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    landedSnapshot.players[0]?.jumpDebug.resolvedActionSequence,
    2
  );
  assert.ok(Math.abs(landedSnapshot.players[0]?.linearVelocity.y ?? 0) < 0.001);
  assert.ok(
    (landedSnapshot.players[0]?.position.y ?? 0) >
      shippedGroundedSpawnSupportHeightMeters - 0.02
  );
  assert.ok(
    (landedSnapshot.players[0]?.position.y ?? 0) <
      shippedGroundedSpawnSupportHeightMeters + 0.03
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

test("MetaverseAuthoritativeWorldRuntime does not let snap-to-ground clip the first grounded-spawn jump tick", () => {
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
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
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

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
  assert.ok(
    (jumpSnapshot.players[0]?.position.y ?? 0) >
      shippedGroundedSpawnSupportHeightMeters
  );
  assert.ok((jumpSnapshot.players[0]?.linearVelocity.y ?? 0) > 0);
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
});

test("MetaverseAuthoritativeWorldRuntime keeps a grounded-spawn jump airborne below snap distance until touchdown", () => {
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
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
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

  let sawFallingNearSpawnTouchdown = false;

  for (let timeMs = 66; timeMs <= 1_000; timeMs += 33) {
    runtime.advanceToTime(timeMs);

    const snapshot = runtime.readWorldSnapshot(timeMs, playerId).players[0];

    if (
      snapshot?.traversalAuthority.currentActionPhase === "falling" &&
      (snapshot.position.y ?? 0) > shippedGroundedSpawnSupportHeightMeters &&
      (snapshot.position.y ?? 0) <
        shippedGroundedSpawnSupportHeightMeters + 0.2 &&
      (snapshot.linearVelocity.y ?? 0) < 0
    ) {
      sawFallingNearSpawnTouchdown = true;
    }

    if (
      snapshot !== undefined &&
      snapshot.mountedOccupancy === null &&
      snapshot.locomotionMode === "grounded" &&
      snapshot.traversalAuthority.currentActionPhase !== "rising" &&
      snapshot.traversalAuthority.currentActionPhase !== "falling"
    ) {
      break;
    }
  }

  assert.ok(sawFallingNearSpawnTouchdown);
});

test("MetaverseAuthoritativeWorldRuntime accepts a grounded-spawn jump after recent grounded travel at hub cadence", () => {
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

  assert.equal(primaryPlayerHasGroundedLocomotion(movingGroundedSnapshot), true);
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

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    3
  );
  assert.equal(
    jumpSnapshot.players[0]?.groundedBody.jumpBody.grounded,
    false
  );
  assert.ok(
    (jumpSnapshot.players[0]?.groundedBody.jumpBody
      .verticalSpeedUnitsPerSecond ?? 0) > 0
  );
  assert.equal(jumpSnapshot.players[0]?.jumpDebug.resolvedActionState, "accepted");
});

test("MetaverseAuthoritativeWorldRuntime accepts a grounded jump when shared spawn support is within snap distance", () => {
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
  const initialHeight = shippedGroundedSpawnSupportHeightMeters + 0.12;

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: initialHeight,
          z: metaverseWorldGroundedSpawnPosition.z
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

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
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
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: metaverseWorldGroundedSpawnPosition.x,
          y: shippedGroundedSpawnSupportHeightMeters,
          z: metaverseWorldGroundedSpawnPosition.z
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

  assert.equal(readPrimaryPlayerActionPhase(bufferedJumpSnapshot), "rising");
  assert.equal(
    bufferedJumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.jumpDebug.pendingActionSequence,
    4
  );
  assert.ok(
    (bufferedJumpSnapshot.players[0]?.jumpDebug.pendingActionBufferAgeMs ?? 0) >= 100
  );
  assert.equal(
    bufferedJumpSnapshot.players[0]?.jumpDebug.resolvedActionState,
    "accepted"
  );
  runtime.advanceToTime(500);

  const rejectedJumpSnapshot = runtime.readWorldSnapshot(500, playerId);

  assert.equal(readPrimaryPlayerActionPhase(rejectedJumpSnapshot), "falling");
  assert.equal(
    rejectedJumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.traversalAuthority.lastRejectedActionSequence,
    4
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.pendingActionSequence,
    0
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.resolvedActionSequence,
    4
  );
  assert.equal(
    rejectedJumpSnapshot.players[0]?.jumpDebug.resolvedActionState,
    "rejected-buffer-expired"
  );
  assert.ok(
    (rejectedJumpSnapshot.players[0]?.position.y ?? 0) >
      shippedGroundedSpawnSupportHeightMeters
  );
});
