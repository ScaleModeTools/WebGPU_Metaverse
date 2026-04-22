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
import {
  readMetaverseRealtimePlayerActiveBodyKinematicSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";

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

function readPrimaryPlayerActiveBodySnapshot(worldSnapshot) {
  return readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
    requireValue(worldSnapshot.players[0], "playerSnapshot")
  );
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
      sequence: nextIntent.sequence,
      locomotionMode: nextIntent.locomotionMode
    }
  });
}

test("MetaverseAuthoritativeWorldRuntime routes an authored dock entry into the shared water bay", () => {
  const runtime = createAuthoritativeRuntime();
  const authoredDockEdgeEntryPosition = offsetLocalPlanarPosition(
    authoredWaterBayDockEntryPosition,
    authoredWaterBayDockEntryYawRadians,
    0,
    3.5
  );
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-water-entry-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Water Entry"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: authoredDockEdgeEntryPosition,
    yawRadians: authoredWaterBayDockEntryYawRadians
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 2,
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
  assert.equal(worldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);
  const dockEntryOffset = resolveLocalPlanarOffset(
    readPrimaryPlayerActiveBodySnapshot(worldSnapshot).position,
    authoredDockEdgeEntryPosition,
    authoredWaterBayDockEntryYawRadians
  );
  assert.ok(
    dockEntryOffset.z > 3.2,
    `expected authored dock entry to travel into the water bay, received offset ${JSON.stringify(dockEntryOffset)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime holds sustained swim after authored dock entry before shoreline exit", () => {
  const runtime = createAuthoritativeRuntime();
  const authoredDockEdgeEntryPosition = offsetLocalPlanarPosition(
    authoredWaterBayDockEntryPosition,
    authoredWaterBayDockEntryYawRadians,
    0,
    3.5
  );
  const playerId = requireValue(
    createMetaversePlayerId("shoreline-sustained-swim-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Shoreline Swim Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    position: authoredDockEdgeEntryPosition,
    yawRadians: authoredWaterBayDockEntryYawRadians
  });
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 2,
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
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);
  const sustainedSwimOffset = resolveLocalPlanarOffset(
    activeBodySnapshot.position,
    authoredDockEdgeEntryPosition,
    authoredWaterBayDockEntryYawRadians
  );

  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(activeBodySnapshot.position.y, 0);
  assert.ok(
    sustainedSwimOffset.z > 4.6,
    `expected sustained swim to hold beyond the dock edge, received offset ${JSON.stringify(sustainedSwimOffset)}`
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
        sequence: 2,
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
  const swimmerPosition = readPrimaryPlayerActiveBodySnapshot(worldSnapshot).position;

  assert.notEqual(swimmerPosition, undefined);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(worldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);

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
        sequence: 2,
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
  const airborneActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(airborneSnapshot);

  assert.equal(airborneSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(airborneActiveBodySnapshot.position.y > 0.05);

  runtime.advanceToTime(800);

  const settledSupportSnapshot = runtime.readWorldSnapshot(800, playerId);
  const settledSupportActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(settledSupportSnapshot);

  assert.equal(settledSupportSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(
    settledSupportActiveBodySnapshot.position.y >
      shippedGroundedSpawnSupportHeightMeters - 0.02
  );
  assert.ok(
    settledSupportActiveBodySnapshot.position.y <
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
        sequence: 2,
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
  const shorelineExitActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(shorelineExitSnapshot);

  assert.equal(shorelineExitSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(shorelineExitActiveBodySnapshot.position.y > 0.4);
  assert.ok(shorelineExitActiveBodySnapshot.position.y < 0.45);
  assert.ok(Math.abs(shorelineExitActiveBodySnapshot.linearVelocity.y) < 0.005);

  runtime.advanceToTime(2_100);

  const settledSnapshot = runtime.readWorldSnapshot(2_100, playerId);
  const settledActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(settledSnapshot);

  assert.equal(settledSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(settledActiveBodySnapshot.position.y > 0.4);
  assert.ok(settledActiveBodySnapshot.position.y < 0.45);
  assert.ok(Math.abs(settledActiveBodySnapshot.linearVelocity.y) < 0.005);
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
        sequence: 2,
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
  const jumpAscentActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(jumpAscentSnapshot);

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
    jumpAscentActiveBodySnapshot.position.y >
      shippedGroundedSpawnSupportHeightMeters
  );
  assert.ok(jumpAscentActiveBodySnapshot.linearVelocity.y > 0);
  assert.equal(jumpAscentSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);
  assert.equal(
    jumpAscentSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 3,
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
  const jumpDescentActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(jumpDescentSnapshot);

  assert.equal(readPrimaryPlayerActionPhase(jumpDescentSnapshot), "falling");
  assert.equal(
    jumpDescentSnapshot.players[0]?.traversalAuthority.currentActionPhase,
    "falling"
  );
  assert.ok(
    jumpDescentActiveBodySnapshot.position.y >
      shippedGroundedSpawnSupportHeightMeters
  );
  assert.ok(jumpDescentActiveBodySnapshot.linearVelocity.y < 0);
  assert.equal(jumpDescentSnapshot.observerPlayer?.lastProcessedTraversalSequence, 3);
  assert.equal(
    jumpDescentSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(jumpDescentSnapshot.players[0]?.stateSequence, 3);

  runtime.advanceToTime(1_000);

  const landedSnapshot = runtime.readWorldSnapshot(1_000, playerId);
  const landedActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(landedSnapshot);

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
    landedSnapshot.observerPlayer?.jumpDebug.resolvedActionSequence,
    2
  );
  assert.ok(Math.abs(landedActiveBodySnapshot.linearVelocity.y) < 0.001);
  assert.ok(
    landedActiveBodySnapshot.position.y >
      shippedGroundedSpawnSupportHeightMeters - 0.02
  );
  assert.ok(
    landedActiveBodySnapshot.position.y <
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
        sequence: 2,
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
        sequence: 2,
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
  const jumpActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(jumpSnapshot);

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
  assert.ok(jumpActiveBodySnapshot.position.y > shippedGroundedSpawnSupportHeightMeters);
  assert.ok(jumpActiveBodySnapshot.linearVelocity.y > 0);
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
        sequence: 2,
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
        sequence: 3,
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

    const worldSnapshot = runtime.readWorldSnapshot(timeMs, playerId);
    const snapshot = worldSnapshot.players[0];
    const activeBodySnapshot =
      snapshot === undefined
        ? null
        : readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

    if (
      snapshot?.traversalAuthority.currentActionPhase === "falling" &&
      (activeBodySnapshot?.position.y ?? 0) >
        shippedGroundedSpawnSupportHeightMeters &&
      (activeBodySnapshot?.position.y ?? 0) <
        shippedGroundedSpawnSupportHeightMeters + 0.2 &&
      (activeBodySnapshot?.linearVelocity.y ?? 0) < 0
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
        sequence: 2,
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
  assert.equal(
    movingGroundedSnapshot.players[0]?.groundedBody.jumpBody.jumpReady,
    true
  );

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 3,
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
  assert.equal(jumpSnapshot.observerPlayer?.jumpDebug.resolvedActionState, "accepted");
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
        sequence: 2,
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
  const jumpActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(jumpSnapshot);

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.ok(jumpActiveBodySnapshot.position.y > initialHeight);
  assert.ok(jumpActiveBodySnapshot.linearVelocity.y > 0);
});

test("MetaverseAuthoritativeWorldRuntime accepts a grounded jump from a latest-wins compressed release packet", () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime({
    playerInactivityTimeoutMs: createMilliseconds(5_000),
    tickIntervalMs: createMilliseconds(100)
  });
  const playerId = requireValue(
    createMetaversePlayerId("world-jump-latest-wins-release-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("World Jump Latest Wins Release Pilot"),
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
        actionIntent: {
          kind: "jump",
          pressed: false,
          sequence: 2
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
        sequence: 2,
        locomotionMode: "grounded"
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const jumpSnapshot = runtime.readWorldSnapshot(100, playerId);
  const jumpActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(jumpSnapshot);

  assert.equal(readPrimaryPlayerActionPhase(jumpSnapshot), "rising");
  assert.equal(
    jumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(jumpSnapshot.observerPlayer?.jumpDebug.resolvedActionState, "accepted");
  assert.ok(jumpActiveBodySnapshot.position.y > initialHeight);
  assert.ok(jumpActiveBodySnapshot.linearVelocity.y > 0);
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
        sequence: 2,
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
        sequence: 3,
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
        sequence: 4,
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
    bufferedJumpSnapshot.observerPlayer?.jumpDebug.pendingActionSequence,
    4
  );
  assert.ok(
    (bufferedJumpSnapshot.observerPlayer?.jumpDebug.pendingActionBufferAgeMs ?? 0) >= 100
  );
  assert.equal(
    bufferedJumpSnapshot.observerPlayer?.jumpDebug.resolvedActionState,
    "accepted"
  );
  runtime.advanceToTime(500);

  const clearedBufferedJumpSnapshot = runtime.readWorldSnapshot(500, playerId);
  const clearedBufferedJumpActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(clearedBufferedJumpSnapshot);

  assert.equal(readPrimaryPlayerActionPhase(clearedBufferedJumpSnapshot), "falling");
  assert.equal(
    clearedBufferedJumpSnapshot.players[0]?.traversalAuthority.lastConsumedActionSequence,
    2
  );
  assert.equal(
    clearedBufferedJumpSnapshot.players[0]?.traversalAuthority.lastRejectedActionSequence,
    0
  );
  assert.equal(
    clearedBufferedJumpSnapshot.observerPlayer?.jumpDebug.pendingActionSequence,
    0
  );
  assert.equal(
    clearedBufferedJumpSnapshot.observerPlayer?.jumpDebug.resolvedActionSequence,
    2
  );
  assert.equal(
    clearedBufferedJumpSnapshot.observerPlayer?.jumpDebug.resolvedActionState,
    "accepted"
  );
  assert.ok(
    clearedBufferedJumpActiveBodySnapshot.position.y >
      shippedGroundedSpawnSupportHeightMeters
  );
});
