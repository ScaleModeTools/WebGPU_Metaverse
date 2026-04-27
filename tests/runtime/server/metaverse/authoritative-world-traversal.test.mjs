import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseIssuePlayerActionCommand,
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  metaverseGroundedBodyTraversalCoreConfig,
  createUsername
} from "@webgpu-metaverse/shared";

import { authoredWaterBayOpenWaterSpawn } from "../../metaverse-authored-world-test-fixtures.mjs";
import {
  createAuthoritativeRuntime,
  createMetaverseSyncPlayerTraversalIntentCommand,
  joinSurfacePlayer,
  readPlayerActiveBodySnapshot,
  readPrimaryPlayerActiveBodySnapshot,
  requireValue,
  shippedGroundedSpawnSupportHeightMeters
} from "./authoritative-world-test-fixtures.mjs";

function createForwardDirection(origin, target) {
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  const deltaZ = target.z - origin.z;
  const length = Math.hypot(deltaX, deltaY, deltaZ);

  return Object.freeze({
    x: deltaX / length,
    y: deltaY / length,
    z: deltaZ / length
  });
}

function createFireWeaponPlayerActionCommand({
  actionSequence,
  issuedAtAuthoritativeTimeMs,
  origin,
  playerId,
  target
}) {
  const forwardDirection = createForwardDirection(origin, target);
  const planarMagnitude = Math.hypot(forwardDirection.x, forwardDirection.z);

  return createMetaverseIssuePlayerActionCommand({
    action: {
      actionSequence,
      aimSnapshot: {
        pitchRadians: Math.atan2(forwardDirection.y, planarMagnitude),
        yawRadians: Math.atan2(forwardDirection.x, -forwardDirection.z)
      },
      issuedAtAuthoritativeTimeMs,
      kind: "fire-weapon",
      weaponId: "metaverse-service-pistol-v2"
    },
    playerId
  });
}

test("MetaverseAuthoritativeWorldRuntime simulates unmounted grounded and swim traversal from authoritative traversal intent commands", () => {
  const groundedRuntime = createAuthoritativeRuntime();
  const groundedPlayerId = requireValue(
    createMetaversePlayerId("world-traversal-harbor-pilot"),
    "playerId"
  );
  const groundedUsername = requireValue(
    createUsername("World Traversal Pilot"),
    "username"
  );

  joinSurfacePlayer(groundedRuntime, groundedPlayerId, groundedUsername, {
    yawRadians: 0
  });
  groundedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: false,
        sequence: 2,
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
  const groundedActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(groundedWorldSnapshot);

  assert.equal(groundedWorldSnapshot.tick.currentTick, 2);
  assert.equal(groundedWorldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);
  assert.equal(groundedWorldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.ok(groundedActiveBodySnapshot.position.y > 0.4);
  assert.ok(
    groundedActiveBodySnapshot.position.y <
      shippedGroundedSpawnSupportHeightMeters
  );
  assert.ok(groundedActiveBodySnapshot.position.z < -14.8);
  assert.ok(groundedActiveBodySnapshot.linearVelocity.z < 0);
  assert.equal(groundedWorldSnapshot.players[0]?.stateSequence, 2);

  const swimRuntime = createAuthoritativeRuntime();
  const swimPlayerId = requireValue(
    createMetaversePlayerId("world-swim-harbor-pilot"),
    "swimPlayerId"
  );
  const swimUsername = requireValue(
    createUsername("World Swim Pilot"),
    "swimUsername"
  );

  swimRuntime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: swimPlayerId,
      pose: {
        position: authoredWaterBayOpenWaterSpawn,
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
        sequence: 3,
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
  const swimActiveBodySnapshot =
    readPrimaryPlayerActiveBodySnapshot(swimWorldSnapshot);

  assert.equal(swimWorldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 3);
  assert.equal(swimWorldSnapshot.players[0]?.locomotionMode, "swim");
  assert.equal(swimActiveBodySnapshot.position.y, 0);
  assert.equal(swimActiveBodySnapshot.linearVelocity.y, 0);
  assert.ok(swimActiveBodySnapshot.position.z < authoredWaterBayOpenWaterSpawn.z);
  assert.ok(swimActiveBodySnapshot.linearVelocity.z < 0);
  assert.equal(swimWorldSnapshot.players[0]?.stateSequence, 3);
});

test("MetaverseAuthoritativeWorldRuntime keeps other grounded players as solid traversal blockers while excluding self", () => {
  const blockedRuntime = createAuthoritativeRuntime();
  const blockedMoverPlayerId = requireValue(
    createMetaversePlayerId("blocked-grounded-mover"),
    "blockedMoverPlayerId"
  );
  const blockedStaticPlayerId = requireValue(
    createMetaversePlayerId("grounded-blocker-player"),
    "blockedStaticPlayerId"
  );
  const blockedMoverUsername = requireValue(
    createUsername("Blocked Grounded Mover"),
    "blockedMoverUsername"
  );
  const blockedStaticUsername = requireValue(
    createUsername("Grounded Blocker"),
    "blockedStaticUsername"
  );
  const moverSpawnPosition = {
    x: -8.2,
    y: shippedGroundedSpawnSupportHeightMeters,
    z: -14.8
  };
  const blockerSpawnPosition = {
    x: moverSpawnPosition.x,
    y: moverSpawnPosition.y,
    z: -16.2
  };

  joinSurfacePlayer(
    blockedRuntime,
    blockedMoverPlayerId,
    blockedMoverUsername,
    {
      position: moverSpawnPosition,
      yawRadians: 0
    }
  );
  joinSurfacePlayer(
    blockedRuntime,
    blockedStaticPlayerId,
    blockedStaticUsername,
    {
      position: blockerSpawnPosition,
      yawRadians: 0
    }
  );
  blockedRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        sequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: blockedMoverPlayerId
    }),
    0
  );
  blockedRuntime.advanceToTime(500);

  const blockedWorldSnapshot = blockedRuntime.readWorldSnapshot(
    500,
    blockedMoverPlayerId
  );
  const blockedPlayers = blockedWorldSnapshot.players;
  const blockedMover = blockedPlayers.find(
    (player) => player.playerId === blockedMoverPlayerId
  );
  const blockedStaticPlayer = blockedPlayers.find(
    (player) => player.playerId === blockedStaticPlayerId
  );

  assert.notEqual(blockedMover, undefined);
  assert.notEqual(blockedStaticPlayer, undefined);
  assert.equal(
    blockedWorldSnapshot.observerPlayer?.lastProcessedTraversalSequence,
    2
  );
  assert.equal(blockedMover?.locomotionMode, "grounded");
  assert.ok(
    readPlayerActiveBodySnapshot(blockedMover).position.z > blockerSpawnPosition.z
  );
  assert.ok(
    Math.abs(
      readPlayerActiveBodySnapshot(blockedStaticPlayer).position.z -
        blockerSpawnPosition.z
    ) < 0.05
  );

  const soloRuntime = createAuthoritativeRuntime();
  const soloMoverPlayerId = requireValue(
    createMetaversePlayerId("solo-grounded-mover"),
    "soloMoverPlayerId"
  );
  const soloMoverUsername = requireValue(
    createUsername("Solo Grounded Mover"),
    "soloMoverUsername"
  );

  joinSurfacePlayer(soloRuntime, soloMoverPlayerId, soloMoverUsername, {
    position: moverSpawnPosition,
    yawRadians: 0
  });
  soloRuntime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        sequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: soloMoverPlayerId
    }),
    0
  );
  soloRuntime.advanceToTime(500);

  const soloMover = soloRuntime
    .readWorldSnapshot(500, soloMoverPlayerId)
    .players.find((player) => player.playerId === soloMoverPlayerId);
  const soloMoverActiveBodySnapshot = readPlayerActiveBodySnapshot(soloMover);
  const blockedMoverActiveBodySnapshot = readPlayerActiveBodySnapshot(blockedMover);
  const blockedStaticActiveBodySnapshot =
    readPlayerActiveBodySnapshot(blockedStaticPlayer);
  const playerBodyClearanceMeters =
    metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters * 2 +
    metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters;

  assert.notEqual(soloMover, undefined);
  assert.ok(
    Math.hypot(
      blockedMoverActiveBodySnapshot.position.x -
        blockedStaticActiveBodySnapshot.position.x,
      blockedMoverActiveBodySnapshot.position.z -
        blockedStaticActiveBodySnapshot.position.z
    ) >= playerBodyClearanceMeters - 0.05
  );
  assert.ok(soloMoverActiveBodySnapshot.position.z < blockerSpawnPosition.z);
  assert.ok(
    blockedMoverActiveBodySnapshot.position.z >
      soloMoverActiveBodySnapshot.position.z + 1.5
  );
});

test("MetaverseAuthoritativeWorldRuntime stops using dead players as traversal blockers", () => {
  const runtime = createAuthoritativeRuntime();
  const moverPlayerId = requireValue(
    createMetaversePlayerId("dead-blocker-mover"),
    "moverPlayerId"
  );
  const blockerPlayerId = requireValue(
    createMetaversePlayerId("dead-blocker-target"),
    "blockerPlayerId"
  );
  const moverUsername = requireValue(
    createUsername("Dead Blocker Mover"),
    "moverUsername"
  );
  const blockerUsername = requireValue(
    createUsername("Dead Blocker Target"),
    "blockerUsername"
  );
  const moverSpawnPosition = {
    x: -8.2,
    y: shippedGroundedSpawnSupportHeightMeters,
    z: -14.8
  };
  const blockerSpawnPosition = {
    x: moverSpawnPosition.x,
    y: moverSpawnPosition.y,
    z: -16.2
  };

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: moverPlayerId,
      pose: {
        position: moverSpawnPosition,
        stateSequence: 1,
        yawRadians: 0
      },
      teamId: "red",
      username: moverUsername
    }),
    0
  );
  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId: blockerPlayerId,
      pose: {
        position: blockerSpawnPosition,
        stateSequence: 1,
        yawRadians: 0
      },
      teamId: "blue",
      username: blockerUsername
    }),
    0
  );
  runtime.advanceToTime(1_200);

  const muzzleOrigin = Object.freeze({
    x: moverSpawnPosition.x,
    y: moverSpawnPosition.y + 1.62,
    z: moverSpawnPosition.z
  });
  const blockerBodyTarget = Object.freeze({
    x: blockerSpawnPosition.x,
    y: blockerSpawnPosition.y + 0.95,
    z: blockerSpawnPosition.z
  });
  const blockerHeadTarget = Object.freeze({
    x: blockerSpawnPosition.x,
    y: blockerSpawnPosition.y + 1.58,
    z: blockerSpawnPosition.z
  });

  runtime.acceptWorldCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 1,
      issuedAtAuthoritativeTimeMs: 1_200,
      origin: muzzleOrigin,
      playerId: moverPlayerId,
      target: blockerBodyTarget
    }),
    1_200
  );
  runtime.acceptWorldCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 2,
      issuedAtAuthoritativeTimeMs: 1_400,
      origin: muzzleOrigin,
      playerId: moverPlayerId,
      target: blockerHeadTarget
    }),
    1_400
  );
  runtime.acceptWorldCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 3,
      issuedAtAuthoritativeTimeMs: 1_600,
      origin: muzzleOrigin,
      playerId: moverPlayerId,
      target: blockerHeadTarget
    }),
    1_600
  );
  runtime.acceptWorldCommand(
    createFireWeaponPlayerActionCommand({
      actionSequence: 4,
      issuedAtAuthoritativeTimeMs: 1_800,
      origin: muzzleOrigin,
      playerId: moverPlayerId,
      target: blockerHeadTarget
    }),
    1_800
  );

  const postKillSnapshot = runtime.readWorldSnapshot(1_800, moverPlayerId);
  const deadBlocker = postKillSnapshot.players.find(
    (player) => player.playerId === blockerPlayerId
  );

  assert.equal(deadBlocker?.combat?.alive, false);

  runtime.acceptWorldCommand(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        boost: true,
        sequence: 2,
        jump: false,
        locomotionMode: "grounded",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId: moverPlayerId
    }),
    1_800
  );
  runtime.advanceToTime(2_300);

  const movedSnapshot = runtime.readWorldSnapshot(2_300, moverPlayerId);
  const mover = movedSnapshot.players.find(
    (player) => player.playerId === moverPlayerId
  );
  const moverActiveBodySnapshot = readPlayerActiveBodySnapshot(mover);

  assert.ok(moverActiveBodySnapshot.position.z < blockerSpawnPosition.z);
});
