import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseDeterministicUnmountedGroundedBodyStep,
  createMetaverseGroundedBodyRuntimeSnapshot,
  metaverseRealtimeWorldCadenceConfig,
  resolveMetaverseWorldSurfaceSupportSnapshot
} from "@webgpu-metaverse/shared";

const fixedDeltaSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

const surfacePolicyConfig = Object.freeze({
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  gravityUnitsPerSecond: 18,
  jumpImpulseUnitsPerSecond: 6.8,
  oceanHeightMeters: 0,
  stepHeightMeters: 0.28
});

const groundedBodyConfig = Object.freeze({
  accelerationCurveExponent: 1.2,
  accelerationUnitsPerSecondSquared: 20,
  airborneMovementDampingFactor: 0.42,
  baseSpeedUnitsPerSecond: 6,
  boostCurveExponent: 1.1,
  boostMultiplier: 1.65,
  capsuleHalfHeightMeters: surfacePolicyConfig.capsuleHalfHeightMeters,
  capsuleRadiusMeters: surfacePolicyConfig.capsuleRadiusMeters,
  controllerOffsetMeters: 0.01,
  decelerationUnitsPerSecondSquared: 26,
  dragCurveExponent: 1.45,
  gravityUnitsPerSecond: surfacePolicyConfig.gravityUnitsPerSecond,
  jumpGroundContactGraceSeconds: 0.2,
  jumpImpulseUnitsPerSecond: surfacePolicyConfig.jumpImpulseUnitsPerSecond,
  maxSlopeClimbAngleRadians: Math.PI * 0.26,
  maxTurnSpeedRadiansPerSecond: 1.9,
  minSlopeSlideAngleRadians: Math.PI * 0.34,
  snapToGroundDistanceMeters: 0.22,
  spawnPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
  stepHeightMeters: surfacePolicyConfig.stepHeightMeters,
  stepWidthMeters: 0.24,
  worldRadius: 110
});

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function assertApprox(actual, expected, message, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function createSupportCollider(surfaceHeightMeters) {
  return Object.freeze({
    halfExtents: freezeVector3(8, 0.1, 24),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
    rotationYRadians: 0,
    translation: freezeVector3(0, surfaceHeightMeters - 0.1, 0),
    traversalAffordance: "support"
  });
}

function createHeightfieldSupportCollider() {
  return Object.freeze({
    halfExtents: freezeVector3(3, 0.45, 3),
    heightSamples: Float32Array.from([
      0.4, 0.8, 0.7, 0.3,
      0.7, 1.2, 1.2, 0.6,
      0.8, 1.2, 1.2, 0.5,
      0.5, 0.9, 0.6, 0.2
    ]),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
    rotationYRadians: 0,
    sampleCountX: 4,
    sampleCountZ: 4,
    sampleSpacingMeters: 2,
    shape: "heightfield",
    translation: freezeVector3(0, 0, 0),
    traversalAffordance: "support"
  });
}

function createGroundedSnapshot(position, overrides = {}) {
  return createMetaverseGroundedBodyRuntimeSnapshot({
    grounded: true,
    linearVelocity: freezeVector3(0, 0, 0),
    position,
    yawRadians: 0,
    ...overrides
  });
}

test("deterministic grounded step keeps a supported spawn on exported map support", () => {
  const spawnPosition = freezeVector3(0, 10.34, 0);
  const supportCollider = createSupportCollider(spawnPosition.y);
  const resolvedSnapshot = advanceMetaverseDeterministicUnmountedGroundedBodyStep({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: false,
      jump: false,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    }),
    currentGroundedBodySnapshot: createGroundedSnapshot(spawnPosition),
    deltaSeconds: fixedDeltaSeconds,
    groundedBodyConfig,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([supportCollider]),
    surfacePolicyConfig
  });

  assert.equal(resolvedSnapshot.grounded, true);
  assert.equal(resolvedSnapshot.contact.supportingContactDetected, true);
  assert.equal(resolvedSnapshot.contact.blockedVerticalMovement, false);
  assertApprox(resolvedSnapshot.position.y, spawnPosition.y, "spawn support");
});

test("deterministic grounded step uses heightfield support normals for jumps", () => {
  const heightfieldCollider = createHeightfieldSupportCollider();
  const support = resolveMetaverseWorldSurfaceSupportSnapshot(
    surfacePolicyConfig,
    Object.freeze([heightfieldCollider]),
    0,
    0
  );

  assert.notEqual(support, null);
  assert.equal(support.supportKind, "heightfield");
  assertApprox(support.supportHeightMeters, 1.2, "heightfield support", 0.0001);
  assert.ok(support.supportNormal.y < 1);

  const jumpSnapshot = advanceMetaverseDeterministicUnmountedGroundedBodyStep({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: false,
      jump: true,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    }),
    currentGroundedBodySnapshot: createGroundedSnapshot(
      freezeVector3(0, support.supportHeightMeters, 0)
    ),
    deltaSeconds: fixedDeltaSeconds,
    groundedBodyConfig,
    preferredLookYawRadians: null,
    preferredSupport: support,
    surfaceColliderSnapshots: Object.freeze([heightfieldCollider]),
    surfacePolicyConfig
  });

  assert.equal(jumpSnapshot.grounded, false);
  assert.ok(jumpSnapshot.jumpBody.verticalSpeedUnitsPerSecond > 0);
  assert.ok(
    Math.hypot(jumpSnapshot.linearVelocity.x, jumpSnapshot.linearVelocity.z) > 0,
    "expected heightfield support normal to contribute planar jump velocity"
  );
});
