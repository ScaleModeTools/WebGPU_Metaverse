import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
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
        inputSequence: 2,
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
  const activeBodySnapshot = readPrimaryPlayerActiveBodySnapshot(worldSnapshot);

  assert.equal(activeBodySnapshot.yawRadians, Math.PI * 0.5);
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
        locomotionMode: "grounded",
        orientationSequence: 1
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
        locomotionMode: "grounded",
        orientationSequence: 2
      },
      playerId
    }),
    100
  );

  const preTickSnapshot = runtime.readWorldSnapshot(100, playerId);
  const preTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(preTickSnapshot);

  assert.equal(preTickSnapshot.observerPlayer?.lastProcessedInputSequence, 1);
  assert.equal(
    preTickSnapshot.observerPlayer?.lastProcessedTraversalOrientationSequence,
    1
  );
  assert.equal(preTickSnapshot.players[0]?.stateSequence, 1);
  assert.equal(preTickSnapshot.players[0]?.look.pitchRadians, -0.2);
  assert.equal(preTickSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
  assert.equal(preTickActiveBodySnapshot.yawRadians, 0);

  runtime.advanceToTime(200);

  const postTickSnapshot = runtime.readWorldSnapshot(200, playerId);
  const postTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(postTickSnapshot);

  assert.equal(postTickSnapshot.observerPlayer?.lastProcessedInputSequence, 1);
  assert.equal(
    postTickSnapshot.observerPlayer?.lastProcessedTraversalOrientationSequence,
    2
  );
  assert.equal(postTickSnapshot.players[0]?.stateSequence, 1);
  assert.equal(postTickActiveBodySnapshot.yawRadians, Math.PI * 0.5);
  assert.equal(postTickSnapshot.players[0]?.look.pitchRadians, -0.2);
  assert.equal(postTickSnapshot.players[0]?.look.yawRadians, Math.PI * 0.5);
});

test("MetaverseAuthoritativeWorldRuntime replays short-lived traversal history inside a single authoritative tick", () => {
  const runtime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("short-lived-history-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Short Lived History Pilot"),
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
        inputSequence: 3,
        locomotionMode: "grounded",
        orientationSequence: 1
      },
      playerId,
      recentIntentHistory: [
        {
          durationMs: 30,
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
            inputSequence: 1,
            locomotionMode: "grounded",
            orientationSequence: 1
          }
        },
        {
          durationMs: 30,
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
            inputSequence: 2,
            locomotionMode: "grounded",
            orientationSequence: 1
          }
        },
        {
          durationMs: 30,
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
            inputSequence: 3,
            locomotionMode: "grounded",
            orientationSequence: 1
          }
        }
      ]
    }),
    90
  );

  runtime.advanceToTime(100);

  const postTickSnapshot = runtime.readWorldSnapshot(100, playerId);
  const postTickActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(postTickSnapshot);

  assert.equal(postTickSnapshot.observerPlayer?.lastProcessedInputSequence, 3);
  assert.equal(
    postTickSnapshot.observerPlayer?.lastProcessedTraversalOrientationSequence,
    1
  );
  assert.ok(
    postTickActiveBodySnapshot.position.z < preTickActiveBodySnapshot.position.z - 0.02,
    `expected traversal history to preserve early forward movement, received ${JSON.stringify(postTickActiveBodySnapshot)}`
  );
  assert.ok(
    postTickActiveBodySnapshot.position.x > preTickActiveBodySnapshot.position.x + 0.02,
    `expected traversal history to preserve later strafe movement, received ${JSON.stringify(postTickActiveBodySnapshot)}`
  );
});

test("MetaverseAuthoritativeWorldRuntime anchors delayed traversal history to estimated server time instead of receive time", () => {
  const groundedRuntime = createAuthoritativeRuntime();
  const delayedReceiveRuntime = createAuthoritativeRuntime();
  const anchoredDelayedRuntime = createAuthoritativeRuntime();
  const playerId = requireValue(
    createMetaversePlayerId("short-lived-history-anchor-pilot"),
    "playerId"
  );
  const username = requireValue(
    createUsername("Short Lived History Anchor Pilot"),
    "username"
  );

  joinSurfacePlayer(groundedRuntime, playerId, username, {
    yawRadians: 0
  });
  joinSurfacePlayer(delayedReceiveRuntime, playerId, username, {
    yawRadians: 0
  });
  joinSurfacePlayer(anchoredDelayedRuntime, playerId, username, {
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
      inputSequence: 2,
      locomotionMode: "grounded",
      orientationSequence: 1
    },
    playerId,
    recentIntentHistory: [
      {
        durationMs: 30,
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
          inputSequence: 1,
          locomotionMode: "grounded",
          orientationSequence: 1
        }
      },
      {
        durationMs: 30,
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
          inputSequence: 2,
          locomotionMode: "grounded",
          orientationSequence: 1
        }
      }
    ]
  };

  groundedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand(delayedStopCommandInput),
    60
  );
  delayedReceiveRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand(delayedStopCommandInput),
    90
  );
  anchoredDelayedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      ...delayedStopCommandInput,
      estimatedServerTimeMs: 60
    }),
    90
  );

  groundedRuntime.advanceToTime(100);
  delayedReceiveRuntime.advanceToTime(100);
  anchoredDelayedRuntime.advanceToTime(100);

  const groundedSnapshot = readPrimaryPlayerActiveBodySnapshot(
    groundedRuntime.readWorldSnapshot(100, playerId)
  );
  const delayedReceiveSnapshot = readPrimaryPlayerActiveBodySnapshot(
    delayedReceiveRuntime.readWorldSnapshot(100, playerId)
  );
  const anchoredDelayedSnapshot = readPrimaryPlayerActiveBodySnapshot(
    anchoredDelayedRuntime.readWorldSnapshot(100, playerId)
  );

  assert.ok(
    delayedReceiveSnapshot.linearVelocity.z <
      groundedSnapshot.linearVelocity.z - 0.1,
    `expected receive-time anchored history to leave excess residual forward velocity, grounded=${JSON.stringify(groundedSnapshot)} delayed=${JSON.stringify(delayedReceiveSnapshot)}`
  );
  assert.ok(
    Math.abs(
      anchoredDelayedSnapshot.linearVelocity.z -
        groundedSnapshot.linearVelocity.z
    ) < 0.001 &&
      Math.abs(anchoredDelayedSnapshot.position.z - groundedSnapshot.position.z) <
        0.001,
    `expected estimated server-time anchoring to preserve grounded truth, grounded=${JSON.stringify(groundedSnapshot)} anchored=${JSON.stringify(anchoredDelayedSnapshot)}`
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
        inputSequence: 2,
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
