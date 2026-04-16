import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseSurfaceTraversalMotion,
  advanceMetaverseSurfaceTraversalSnapshot,
  createMetaverseSurfaceTraversalSnapshot,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubShorelineEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaverseWorldPlacedWaterRegions,
  metaverseWorldStaticSurfaceAssets,
  readMetaverseWorldSurfaceAssetAuthoring,
  resolveMetaverseWorldDynamicSurfaceColliders,
  resolveMetaverseWorldAutomaticSurfaceLocomotion,
  resolveMetaverseWorldPlacedSurfaceColliders
} from "@webgpu-metaverse/shared";

const metaverseSurfacePolicyConfig = Object.freeze({
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  gravityUnitsPerSecond: 18,
  jumpImpulseUnitsPerSecond: 6.8,
  oceanHeightMeters: 0,
  stepHeightMeters: 0.28
});

const staticSurfaceColliders = Object.freeze(
  metaverseWorldStaticSurfaceAssets.flatMap((surfaceAsset) =>
    resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset)
  )
);

const metaverseSurfaceTraversalConfig = Object.freeze({
  accelerationCurveExponent: 1,
  accelerationUnitsPerSecondSquared: 8,
  baseSpeedUnitsPerSecond: 4,
  boostCurveExponent: 1,
  boostMultiplier: 2,
  decelerationUnitsPerSecondSquared: 10,
  dragCurveExponent: 1,
  maxTurnSpeedRadiansPerSecond: Math.PI
});
const shippedDockSupportHeightMeters = 0.6;

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("shared metaverse surface authoring and queries expose placements, static colliders, and dynamic collider derivation", () => {
  const dockSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaverseHubDockEnvironmentAssetId
  );

  assert.notEqual(dockSurfaceAsset, null);
  assert.equal(dockSurfaceAsset?.placement, "static");
  assert.equal(dockSurfaceAsset?.placements.length, 4);
  assert.equal(
    staticSurfaceColliders.length,
    staticSurfaceColliders.length
  );
  assert.ok(metaverseWorldPlacedWaterRegions.length > 0);

  const dynamicSurfaceColliders = resolveMetaverseWorldDynamicSurfaceColliders(
    metaverseHubSkiffEnvironmentAssetId,
    {
      position: {
        x: 12,
        y: 0.25,
        z: -4
      },
      yawRadians: Math.PI * 0.5
    }
  );

  assert.equal(dynamicSurfaceColliders.length, 8);
  assert.ok(
    dynamicSurfaceColliders.every(
      (surfaceCollider) =>
        surfaceCollider.ownerEnvironmentAssetId === "metaverse-hub-skiff-v1"
    )
  );
});

test("shared metaverse surface authoring exposes the shipped shoreline slice with static placements", () => {
  const shorelineSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaverseHubShorelineEnvironmentAssetId
  );

  assert.notEqual(shorelineSurfaceAsset, null);
  assert.equal(shorelineSurfaceAsset?.placement, "static");
  assert.equal(shorelineSurfaceAsset?.placements.length, 1);
  assert.equal(
    shorelineSurfaceAsset?.surfaceColliders.filter(
      (collider) => collider.traversalAffordance === "support"
    ).length,
    3
  );
  assert.equal(
    shorelineSurfaceAsset?.surfaceColliders.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    3
  );
});

test("shared metaverse dock traversal uses one simple static support cuboid per dock placement", () => {
  const dockSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaverseHubDockEnvironmentAssetId
  );
  const dockSurfaceColliders =
    dockSurfaceAsset === null
      ? []
      : resolveMetaverseWorldPlacedSurfaceColliders(dockSurfaceAsset);

  assert.notEqual(dockSurfaceAsset, null);
  assert.equal(dockSurfaceAsset?.placement, "static");
  assert.equal(dockSurfaceAsset?.placements.length, 4);
  assert.equal(dockSurfaceAsset?.surfaceColliders.length, 1);
  assert.equal(
    dockSurfaceAsset?.surfaceColliders[0]?.traversalAffordance,
    "support"
  );
  assert.deepEqual(dockSurfaceAsset?.surfaceColliders[0]?.size, {
    x: 8.4,
    y: 0.34,
    z: 4.2
  });
  assert.equal(dockSurfaceColliders.length, 4);
  assert.ok(
    dockSurfaceColliders.every(
      (surfaceCollider) =>
        surfaceCollider.ownerEnvironmentAssetId ===
          metaverseHubDockEnvironmentAssetId &&
        surfaceCollider.traversalAffordance === "support"
    )
  );
});

test("shared metaverse surface policy keeps dock support, open water, shoreline exit, and side-lane swim distinct", () => {
  const dockDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: -8.2,
      y: shippedDockSupportHeightMeters,
      z: -14.8
    },
    Math.PI * 0.06,
    "grounded"
  );
  const openWaterDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: -8.2,
      y: 0,
      z: -20
    },
    Math.PI * 0.06,
    "swim"
  );
  const shorelineExitDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: -8.45,
      y: 0,
      z: -24
    },
    Math.PI * 0.06,
    "swim"
  );
  const blockedSideDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: -4.2,
      y: 0,
      z: -23.5
    },
    Math.PI * 0.06,
    "swim"
  );

  assert.equal(dockDecision.decision.locomotionMode, "grounded");
  assert.equal(dockDecision.debug.reason, "grounded-hold");

  assert.equal(openWaterDecision.decision.locomotionMode, "swim");
  assert.equal(openWaterDecision.debug.reason, "shoreline-exit-blocked");
  assert.equal(openWaterDecision.debug.blockerOverlap, false);

  assert.equal(shorelineExitDecision.decision.locomotionMode, "grounded");
  assert.equal(shorelineExitDecision.debug.reason, "shoreline-exit-success");

  assert.equal(blockedSideDecision.decision.locomotionMode, "swim");
  assert.equal(blockedSideDecision.debug.reason, "shoreline-exit-blocked");
  assert.equal(blockedSideDecision.debug.blockerOverlap, false);
  assert.ok(blockedSideDecision.debug.stepSupportedProbeCount > 0);
});

test("shared surface traversal snapshot applies the shared planar model before world-radius clamping", () => {
  const nextTraversalState = advanceMetaverseSurfaceTraversalSnapshot(
    createMetaverseSurfaceTraversalSnapshot(
      {
        x: 9.5,
        y: 0.4,
        z: 0
      },
      0
    ),
    {
      forwardSpeedUnitsPerSecond: 0,
      strafeSpeedUnitsPerSecond: 0
    },
    {
      boost: true,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 1
    },
    metaverseSurfaceTraversalConfig,
    0.5,
    10,
    0.4
  );

  assertApprox(nextTraversalState.snapshot.yawRadians, Math.PI * 0.5);
  assertApprox(nextTraversalState.snapshot.position.x, 10);
  assertApprox(nextTraversalState.snapshot.position.y, 0.4);
  assertApprox(nextTraversalState.snapshot.position.z, 0);
  assertApprox(nextTraversalState.snapshot.planarSpeedUnitsPerSecond, 1);
  assertApprox(nextTraversalState.speedSnapshot.forwardSpeedUnitsPerSecond, 1);
  assertApprox(nextTraversalState.speedSnapshot.strafeSpeedUnitsPerSecond, 0);
});

test("shared surface traversal motion can turn toward an explicit yaw target instead of raw yaw-axis input", () => {
  const motionSnapshot = advanceMetaverseSurfaceTraversalMotion(
    0,
    {
      forwardSpeedUnitsPerSecond: 0,
      strafeSpeedUnitsPerSecond: 0
    },
    {
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: -1
    },
    metaverseSurfaceTraversalConfig,
    0.25,
    true,
    1,
    Math.PI
  );

  assertApprox(motionSnapshot.yawRadians, Math.PI);
  assertApprox(motionSnapshot.forwardSpeedUnitsPerSecond, 2);
  assertApprox(motionSnapshot.strafeSpeedUnitsPerSecond, 0);
  assertApprox(motionSnapshot.velocityX, 0);
  assertApprox(motionSnapshot.velocityZ, 2);
});
