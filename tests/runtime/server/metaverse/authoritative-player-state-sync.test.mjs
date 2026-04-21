import assert from "node:assert/strict";
import test from "node:test";

import {
  MetaverseAuthoritativePlayerStateSync
} from "../../../../server/dist/metaverse/authority/players/metaverse-authoritative-player-state-sync.js";

function createVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createGroundedBodySnapshot({
  grounded = true,
  linearVelocity = createVector3(0, 0, 0),
  position = createVector3(0, 0, 0),
  yawRadians = 0,
  driveTarget = Object.freeze({
    boost: false,
    moveAxis: 0,
    movementMagnitude: 0,
    strafeAxis: 0,
    targetForwardSpeedUnitsPerSecond: 0,
    targetPlanarSpeedUnitsPerSecond: 0,
    targetStrafeSpeedUnitsPerSecond: 0
  }),
  interaction = Object.freeze({
    applyImpulsesToDynamicBodies: true
  })
} = {}) {
  return Object.freeze({
    contact: Object.freeze({
      appliedMovementDelta: createVector3(0, 0, 0),
      blockedPlanarMovement: false,
      blockedVerticalMovement: grounded,
      desiredMovementDelta: createVector3(0, 0, 0),
      supportingContactDetected: grounded
    }),
    driveTarget,
    grounded,
    interaction,
    jumpBody: Object.freeze({
      grounded,
      jumpGroundContactGraceSecondsRemaining: 0,
      jumpReady: grounded,
      jumpSnapSuppressionActive: false,
      verticalSpeedUnitsPerSecond: linearVelocity.y
    }),
    linearVelocity,
    position,
    yawRadians
  });
}

class FakeGroundedBodyRuntime {
  constructor() {
    this.colliderHandle = 101;
    this.snapshot = createGroundedBodySnapshot();
  }

  syncAuthoritativeState(snapshot) {
    this.snapshot = createGroundedBodySnapshot({
      driveTarget: snapshot.driveTarget ?? null,
      grounded: snapshot.grounded,
      interaction:
        snapshot.interaction ?? Object.freeze({ applyImpulsesToDynamicBodies: true }),
      linearVelocity: createVector3(
        snapshot.linearVelocity.x,
        snapshot.linearVelocity.y,
        snapshot.linearVelocity.z
      ),
      position: createVector3(
        snapshot.position.x,
        snapshot.position.y,
        snapshot.position.z
      ),
      yawRadians: snapshot.yawRadians
    });
  }
}

class FakeSwimBodyRuntime {
  constructor() {
    this.colliderHandle = 202;
    this.snapshot = Object.freeze({
      linearVelocity: createVector3(0, 0, 0),
      position: createVector3(0, 0, 0),
      yawRadians: 0
    });
  }

  syncAuthoritativeState(snapshot) {
    this.snapshot = Object.freeze({
      linearVelocity: createVector3(
        snapshot.linearVelocity.x,
        snapshot.linearVelocity.y,
        snapshot.linearVelocity.z
      ),
      position: createVector3(
        snapshot.position.x,
        snapshot.position.y,
        snapshot.position.z
      ),
      yawRadians: snapshot.yawRadians
    });
  }
}

function createPlayerStateSync() {
  return new MetaverseAuthoritativePlayerStateSync({
    addPlayerTraversalColliderHandle: () => {},
    createGroundedBodyRuntime: () => new FakeGroundedBodyRuntime(),
    createSwimBodyRuntime: () => new FakeSwimBodyRuntime(),
    initialYawRadians: 0,
    readCurrentTick: () => 0,
    resolvePlayerActiveTraversalAction: () => null
  });
}

test("Metaverse authoritative player state sync drives swim waterline snaps through the swim body owner", () => {
  const playerStateSync = createPlayerStateSync();
  const playerRuntime = playerStateSync.createPlayerRuntimeState(
    "waterline-player",
    "mesh2motion-humanoid-v1",
    "blue",
    "Waterline Player",
    0
  );

  playerRuntime.positionX = 3.25;
  playerRuntime.positionY = 0.61;
  playerRuntime.positionZ = -4.5;
  playerRuntime.linearVelocityX = 2.1;
  playerRuntime.linearVelocityY = -3.4;
  playerRuntime.linearVelocityZ = 1.6;
  playerRuntime.yawRadians = Math.PI * 0.4;

  playerStateSync.syncUnmountedPlayerToSwimWaterline(playerRuntime, 0, 1 / 30);

  assert.equal(playerRuntime.positionX, 3.25);
  assert.equal(playerRuntime.positionY, 0);
  assert.equal(playerRuntime.positionZ, -4.5);
  assert.equal(playerRuntime.linearVelocityX, 2.1);
  assert.equal(playerRuntime.linearVelocityY, 0);
  assert.equal(playerRuntime.linearVelocityZ, 1.6);
  assert.equal(playerRuntime.swimBodyRuntime.snapshot.position.y, 0);
  assert.equal(playerRuntime.swimBodyRuntime.snapshot.linearVelocity.y, 0);
});

test("Metaverse authoritative player state sync drives grounded support snaps through the grounded body owner", () => {
  const playerStateSync = createPlayerStateSync();
  const playerRuntime = playerStateSync.createPlayerRuntimeState(
    "support-player",
    "mesh2motion-humanoid-v1",
    "red",
    "Support Player",
    0
  );

  playerRuntime.locomotionMode = "swim";
  playerRuntime.positionX = -6.75;
  playerRuntime.positionY = 0;
  playerRuntime.positionZ = 8.5;
  playerRuntime.linearVelocityX = -1.8;
  playerRuntime.linearVelocityY = 2.2;
  playerRuntime.linearVelocityZ = 4.4;
  playerRuntime.yawRadians = -Math.PI * 0.3;

  playerStateSync.syncUnmountedPlayerToGroundedSupport(
    playerRuntime,
    0.42,
    1 / 30
  );

  assert.equal(playerRuntime.positionX, -6.75);
  assert.equal(playerRuntime.positionY, 0.42);
  assert.equal(playerRuntime.positionZ, 8.5);
  assert.equal(playerRuntime.linearVelocityX, -1.8);
  assert.equal(playerRuntime.linearVelocityY, 0);
  assert.equal(playerRuntime.linearVelocityZ, 4.4);
  assert.equal(playerRuntime.groundedBodyRuntime.snapshot.position.y, 0.42);
  assert.equal(playerRuntime.groundedBodyRuntime.snapshot.linearVelocity.y, 0);
  assert.equal(playerRuntime.lastGroundedBodySnapshot.positionYMeters, 0.42);
  assert.equal(playerRuntime.lastGroundedBodySnapshot.jumpBody.grounded, true);
  assert.equal(playerRuntime.lastGroundedBodySnapshot.jumpBody.jumpReady, true);
});
