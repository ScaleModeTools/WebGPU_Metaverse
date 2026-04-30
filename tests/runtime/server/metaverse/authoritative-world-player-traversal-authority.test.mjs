import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerWeaponStateCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  readPrimaryPlayerActiveBodySnapshot,
  requireValue
} from "./authoritative-world-test-fixtures.mjs";

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
        sequence: 2,
        locomotionMode: "grounded"
      },
      playerId
    }),
    100
  );

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.35);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.75);
  assert.equal(activeBodySnapshot.yawRadians, Math.PI * 0.25);
});

test("MetaverseAuthoritativeWorldRuntime accepts armed unmounted look intent for weapon aim", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("armed-look-harbor-pilot"),
    "playerId"
  );
  const username = requireValue(createUsername("Armed Look Pilot"), "username");

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: Math.PI * 0.2
  });

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.45,
        yawRadians: Math.PI * 0.55
      },
      lookSequence: 1,
      playerId
    }),
    100
  );

  let worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.2);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerWeaponStateCommand({
      playerId,
      weaponState: {
        aimMode: "hip-fire",
        slots: [
          {
            attachmentId: "metaverse-service-pistol-v2",
            equipped: true,
            slotId: "primary",
            weaponId: "metaverse-service-pistol-v2",
            weaponInstanceId: `test-player:primary:metaverse-service-pistol-v2`
          }
        ],
        weaponId: "metaverse-service-pistol-v2"
      },
      weaponSequence: 1
    }),
    110
  );
  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.45,
        yawRadians: Math.PI * 0.55
      },
      lookSequence: 2,
      playerId
    }),
    120
  );

  worldSnapshot = runtime.readWorldSnapshot(120, playerId);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.45);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.55);
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
        sequence: 1,
        locomotionMode: "grounded"
      },
      playerId
    }),
    0
  );
  runtime.advanceToTime(100);

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(activeBodySnapshot.yawRadians, Math.PI * 0.5);
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.2);
  assert.equal(worldSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
});

test("MetaverseAuthoritativeWorldRuntime does not backfill a mid-tick traversal intent to tick start", () => {
  const immediateRuntime = createAuthoritativeRuntime();
  const delayedRuntime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("mid-tick-traversal-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Mid Tick Traversal Pilot"),
    "username"
  );

  joinSurfacePlayer(immediateRuntime, playerId, username, {
    yawRadians: 0
  });
  joinSurfacePlayer(delayedRuntime, playerId, username, {
    yawRadians: 0
  });

  const traversalCommand = createMetaverseSyncPlayerTraversalIntentCommand({
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
      sequence: 1,
      locomotionMode: "grounded",
      sequence: 1
    },
    playerId
  });

  immediateRuntime.acceptWorldCommand(traversalCommand, 0);
  delayedRuntime.acceptWorldCommand(traversalCommand, 90);

  immediateRuntime.advanceToTime(100);
  delayedRuntime.advanceToTime(100);

  const immediateSnapshot = readPrimaryPlayerActiveBodySnapshot(
    immediateRuntime.readWorldSnapshot(100, playerId)
  );
  const delayedSnapshot = readPrimaryPlayerActiveBodySnapshot(
    delayedRuntime.readWorldSnapshot(100, playerId)
  );

  assert.ok(
    delayedSnapshot.position.z > immediateSnapshot.position.z + 0.02,
    `expected a mid-tick traversal command to preserve materially less forward travel, immediate=${JSON.stringify(immediateSnapshot)} delayed=${JSON.stringify(delayedSnapshot)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime catches bundled traversal samples up inside the open authoritative tick", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("bundled-traversal-samples-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Bundled Traversal Samples Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: 0
  });

  const preTickSnapshot = runtime.readWorldSnapshot(90, playerId);
  const preTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(preTickSnapshot);

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
          strafeAxis: 1,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        sequence: 1,
        sequence: 3
      },
      pendingIntentSamples: [
        {
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
          sequence: 1,
          sequence: 1
        },
        {
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
          locomotionMode: "grounded",
          sequence: 1,
          sequence: 2
        }
      ],
      playerId
    }),
    90
  );

  runtime.advanceToTime(100);

  const firstTickSnapshot = runtime.readWorldSnapshot(100, playerId);
  const firstTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(firstTickSnapshot);

  assert.equal(firstTickSnapshot.observerPlayer?.lastProcessedTraversalSequence, 3);
  assert.ok(
    firstTickActiveBodySnapshot.linearVelocity.x > 0,
    `expected the latest bundled traversal sample to be active inside the open authoritative tick, received ${JSON.stringify(firstTickActiveBodySnapshot)}`
  );

  runtime.advanceToTime(200);

  const secondTickSnapshot = runtime.readWorldSnapshot(200, playerId);
  const secondTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(secondTickSnapshot);

  assert.equal(
    secondTickSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    3
  );
  assert.ok(
    secondTickActiveBodySnapshot.position.x >
      preTickActiveBodySnapshot.position.x + 0.02,
    `expected bundled traversal to continue from the latest sample without replay backlog, received ${JSON.stringify(secondTickActiveBodySnapshot)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime does not backlog rapid boosted diagonal traversal switches", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("boosted-diagonal-switch-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Boosted Diagonal Switch Pilot"),
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
          boost: true,
          moveAxis: 1,
          strafeAxis: 1,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        sequence: 4
      },
      pendingIntentSamples: [
        {
          actionIntent: {
            kind: "none",
            pressed: false
          },
          bodyControl: {
            boost: true,
            moveAxis: 1,
            strafeAxis: 1,
            turnAxis: 0
          },
          facing: {
            pitchRadians: 0,
            yawRadians: 0
          },
          locomotionMode: "grounded",
          sequence: 2
        },
        {
          actionIntent: {
            kind: "none",
            pressed: false
          },
          bodyControl: {
            boost: true,
            moveAxis: 1,
            strafeAxis: -1,
            turnAxis: 0
          },
          facing: {
            pitchRadians: 0,
            yawRadians: 0
          },
          locomotionMode: "grounded",
          sequence: 3
        }
      ],
      playerId
    }),
    90
  );

  runtime.advanceToTime(100);

  const firstTickSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.equal(
    firstTickSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    4
  );
  assert.deepEqual(firstTickSnapshot.players[0]?.presentationIntent, {
    moveAxis: 1,
    strafeAxis: 1
  });

  runtime.advanceToTime(200);

  const secondTickSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(
    secondTickSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    4
  );
  assert.deepEqual(secondTickSnapshot.players[0]?.presentationIntent, {
    moveAxis: 1,
    strafeAxis: 1
  });
});

test("MetaverseAuthoritativeWorldRuntime preserves mid-tick receipt timing for bundled traversal samples", () => {
  const earlierReceiveRuntime = createAuthoritativeRuntime();
  const laterReceiveRuntime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("bundled-traversal-anchor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Bundled Traversal Anchor Pilot"),
    "username"
  );

  joinSurfacePlayer(earlierReceiveRuntime, playerId, username, {
    yawRadians: 0
  });
  joinSurfacePlayer(laterReceiveRuntime, playerId, username, {
    yawRadians: 0
  });

  const delayedStopCommandInput = {
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
      locomotionMode: "grounded",
      sequence: 1,
      sequence: 2
    },
    pendingIntentSamples: [
      {
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
        sequence: 1,
        sequence: 1
      }
    ],
    playerId
  };

  earlierReceiveRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand(delayedStopCommandInput),
    60
  );
  laterReceiveRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand(delayedStopCommandInput),
    90
  );

  earlierReceiveRuntime.advanceToTime(300);
  laterReceiveRuntime.advanceToTime(300);

  const earlierReceiveSnapshot = readPrimaryPlayerActiveBodySnapshot(
    earlierReceiveRuntime.readWorldSnapshot(300, playerId)
  );
  const laterReceiveSnapshot = readPrimaryPlayerActiveBodySnapshot(
    laterReceiveRuntime.readWorldSnapshot(300, playerId)
  );

  assert.ok(
    laterReceiveSnapshot.position.z < earlierReceiveSnapshot.position.z - 0.02,
    `expected later receipt to preserve more forward travel before the stop sample, earlier=${JSON.stringify(earlierReceiveSnapshot)} later=${JSON.stringify(laterReceiveSnapshot)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime does not replay duplicate bundled traversal samples when the same accepted intent is resent before ack", () => {
  const singleSendRuntime = createAuthoritativeRuntime();
  const duplicateSendRuntime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("duplicate-traversal-history-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Duplicate Traversal History Pilot"),
    "username"
  );

  joinSurfacePlayer(singleSendRuntime, playerId, username, {
    yawRadians: 0
  });
  joinSurfacePlayer(duplicateSendRuntime, playerId, username, {
    yawRadians: 0
  });

  const delayedStopCommand = createMetaverseSyncPlayerTraversalIntentCommand({
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
      locomotionMode: "grounded",
      sequence: 1,
      sequence: 2
    },
    pendingIntentSamples: [
      {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 0,
          strafeAxis: 1,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        sequence: 1,
        sequence: 1
      }
    ],
    playerId
  });

  singleSendRuntime.acceptWorldCommand(delayedStopCommand, 90);
  duplicateSendRuntime.acceptWorldCommand(delayedStopCommand, 90);

  singleSendRuntime.advanceToTime(100);
  duplicateSendRuntime.advanceToTime(100);

  duplicateSendRuntime.acceptWorldCommand(delayedStopCommand, 140);

  singleSendRuntime.advanceToTime(200);
  duplicateSendRuntime.advanceToTime(200);

  const singleSendSnapshot = readPrimaryPlayerActiveBodySnapshot(
    singleSendRuntime.readWorldSnapshot(200, playerId)
  );
  const duplicateSendSnapshot = readPrimaryPlayerActiveBodySnapshot(
    duplicateSendRuntime.readWorldSnapshot(200, playerId)
  );

  assert.ok(
    Math.abs(duplicateSendSnapshot.position.x - singleSendSnapshot.position.x) <
      0.001 &&
      Math.abs(duplicateSendSnapshot.position.z - singleSendSnapshot.position.z) <
        0.001 &&
      Math.abs(
        duplicateSendSnapshot.linearVelocity.x -
          singleSendSnapshot.linearVelocity.x
      ) < 0.001 &&
      Math.abs(
        duplicateSendSnapshot.linearVelocity.z -
          singleSendSnapshot.linearVelocity.z
      ) < 0.001,
    `expected duplicate resend to preserve single-send authority truth, single=${JSON.stringify(singleSendSnapshot)} duplicate=${JSON.stringify(duplicateSendSnapshot)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime republishes presentation intent and explicit look for remote pose consumers", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("observed-traversal-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Observed Traversal Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username);
  runtime.advanceToTime(100);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: true,
          moveAxis: 1,
          strafeAxis: -0.25,
          turnAxis: 0.4
        },
        facing: {
          pitchRadians: -0.2,
          yawRadians: Math.PI * 0.5
        },
        sequence: 2,
        locomotionMode: "grounded"
      },
      playerId
    }),
    100
  );

  const worldSnapshot = runtime.readWorldSnapshot(100, playerId);

  assert.deepEqual(worldSnapshot.players[0]?.presentationIntent, {
    moveAxis: 1,
    strafeAxis: -0.25
  });
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, -0.2);
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
  let activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.3);
  assert.equal(
    worldSnapshot.players[0]?.look.yawRadians,
    activeBodySnapshot.yawRadians
  );

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
  activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.ok(Math.abs((worldSnapshot.players[0]?.look.yawRadians ?? 0) - 1.2) > 0.000001);
  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.look.yawRadians ?? 0) -
        activeBodySnapshot.yawRadians
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
      characterId: "mesh2motion-humanoid-v1",
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
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.ok(
    Math.abs(activeBodySnapshot.yawRadians - Math.PI * 0.5) < 0.000001
  );
  assert.equal(worldSnapshot.players[0]?.look.pitchRadians, 0.42);
  assert.ok(
    Math.abs(
      (worldSnapshot.players[0]?.look.yawRadians ?? 0) -
        (activeBodySnapshot.yawRadians + Math.PI * 0.45)
    ) < 0.000001
  );
});

test("MetaverseAuthoritativeWorldRuntime activates traversal intent received exactly at the tick boundary on that boundary tick", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("boundary-tick-traversal-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Boundary Tick Traversal Pilot"),
    "username"
  );

  joinSurfacePlayer(runtime, playerId, username, {
    yawRadians: 0
  });

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
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0
        },
        locomotionMode: "grounded",
        sequence: 1
      },
      playerId
    }),
    100
  );

  const boundarySnapshot = runtime.readWorldSnapshot(100, playerId);
  const boundaryActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(boundarySnapshot);

  assert.equal(
    boundarySnapshot.observerPlayer?.lastProcessedTraversalSequence,
    1
  );

  runtime.advanceToTime(200);

  const activatedSnapshot = runtime.readWorldSnapshot(200, playerId);
  const activatedActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(activatedSnapshot);
  const movedPlanarDistance = Math.hypot(
    activatedActiveBodySnapshot.position.x -
      boundaryActiveBodySnapshot.position.x,
    activatedActiveBodySnapshot.position.z -
      boundaryActiveBodySnapshot.position.z
  );

  assert.equal(
    activatedSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    1
  );
  assert.ok(movedPlanarDistance > 0);
});
