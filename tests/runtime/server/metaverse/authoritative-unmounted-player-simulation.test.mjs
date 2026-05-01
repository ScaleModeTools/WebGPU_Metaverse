import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaversePlayerId,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativePlayerStateSync } from "../../../../server/dist/metaverse/authority/players/metaverse-authoritative-player-state-sync.js";
import { MetaverseAuthoritativeUnmountedPlayerSimulation } from "../../../../server/dist/metaverse/authority/traversal/metaverse-authoritative-unmounted-player-simulation.js";

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createSupportCollider(surfaceHeightMeters) {
  return Object.freeze({
    halfExtents: createVector3(4, 0.1, 4),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    }),
    rotationYRadians: 0,
    translation: createVector3(0, surfaceHeightMeters - 0.1, 0),
    traversalAffordance: "support"
  });
}

function createGroundedSnapshot({ grounded, linearVelocity, position }) {
  return createMetaverseGroundedBodyRuntimeSnapshot({
    grounded,
    jumpBody: {
      grounded,
      jumpReady: grounded,
      jumpSnapSuppressionActive: false,
      verticalSpeedUnitsPerSecond: grounded ? 0 : linearVelocity.y
    },
    linearVelocity: grounded
      ? createVector3(linearVelocity.x, 0, linearVelocity.z)
      : linearVelocity,
    position,
    yawRadians: 0
  });
}

class FakeGroundedBodyRuntime {
  colliderHandle = Object.freeze({ kind: "grounded-body-collider" });
  snapshot = createGroundedSnapshot({
    grounded: true,
    linearVelocity: createVector3(0, 0, 0),
    position: createVector3(0, 0.6, 0)
  });

  syncAuthoritativeState(snapshot) {
    this.snapshot = createGroundedSnapshot({
      grounded: snapshot.grounded,
      linearVelocity: snapshot.linearVelocity,
      position: snapshot.position
    });
  }
}

class FakeSurfaceDriveBodyRuntime {
  colliderHandle = Object.freeze({ kind: "swim-body-collider" });
  snapshot = createMetaverseSurfaceDriveBodyRuntimeSnapshot({
    position: createVector3(0, 0, 0),
    yawRadians: 0
  });

  advance() {
    return this.snapshot;
  }

  syncAuthoritativeState(snapshot) {
    this.snapshot = createMetaverseSurfaceDriveBodyRuntimeSnapshot(snapshot);
  }
}

test("MetaverseAuthoritativeUnmountedPlayerSimulation publishes deterministic grounded body truth from shared support", () => {
  const playerId = requireValue(
    createMetaversePlayerId("server-grounded-blip"),
    "playerId"
  );
  const username = requireValue(createUsername("Server Grounded Blip"), "username");
  const surfacePolicyConfig = Object.freeze({
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    gravityUnitsPerSecond: 18,
    jumpImpulseUnitsPerSecond: 6.8,
    oceanHeightMeters: 0,
    stepHeightMeters: 0.28
  });
  const playerStateSync = new MetaverseAuthoritativePlayerStateSync({
    addPlayerTraversalColliderHandle: () => {},
    createGroundedBodyRuntime: () => new FakeGroundedBodyRuntime(),
    createInitialPlayerWeaponState: () => null,
    createSwimBodyRuntime: () => new FakeSurfaceDriveBodyRuntime(),
    initialYawRadians: 0,
    readCurrentTick: () => 1,
    resolvePlayerActiveTraversalAction: () =>
      Object.freeze({
        kind: "none",
        phase: "idle"
      })
  });
  const playerRuntime = playerStateSync.createPlayerRuntimeState(
    playerId,
    "mesh2motion-humanoid-v1",
    "neutral",
    username,
    0
  );
  const simulation = new MetaverseAuthoritativeUnmountedPlayerSimulation({
    createWaterborneTraversalColliderPredicate: () => () => true,
    groundedBodyConfig: surfacePolicyConfig,
    groundedBodyRuntimeConfig: Object.freeze({
      controllerOffsetMeters: 0.02,
      maxTurnSpeedRadiansPerSecond: 1.9,
      snapToGroundDistanceMeters: 0.22,
      stepHeightMeters: surfacePolicyConfig.stepHeightMeters
    }),
    playerStateSync,
    playerTraversalIntentsByPlayerId: new Map(),
    playersById: new Map([[playerId, playerRuntime]]),
    resolveAuthoritativeSurfaceColliders: () =>
      Object.freeze([createSupportCollider(0.6)]),
    resolveGroundedTraversalPlayerBlockers: () => Object.freeze([]),
    swimTraversalConfig: Object.freeze({
      accelerationCurveExponent: 1,
      accelerationUnitsPerSecondSquared: 12,
      baseSpeedUnitsPerSecond: 4,
      boostCurveExponent: 1,
      boostMultiplier: 1.5,
      decelerationUnitsPerSecondSquared: 16,
      dragCurveExponent: 1,
      maxTurnSpeedRadiansPerSecond: 1.9
    }),
    waterRegionSnapshots: Object.freeze([])
  });

  simulation.advanceUnmountedPlayerRuntimes(1 / 30, 100);

  assert.equal(playerRuntime.locomotionMode, "grounded");
  assert.equal(playerRuntime.positionY, 0.6);
  assert.equal(playerRuntime.linearVelocityY, 0);
  assert.equal(playerRuntime.groundedBodyRuntime.snapshot.grounded, true);
  assert.equal(playerRuntime.lastGroundedBodySnapshot.jumpBody.grounded, true);
  assert.equal(playerRuntime.lastGroundedBodySnapshot.jumpBody.jumpReady, true);
});
