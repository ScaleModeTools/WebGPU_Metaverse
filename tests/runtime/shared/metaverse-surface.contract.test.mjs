import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseSurfaceTraversalMotion,
  advanceMetaverseSurfaceTraversalSnapshot,
  createMetaverseSurfaceTraversalSnapshot,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaversePlaygroundRangeBarrierEnvironmentAssetId,
  metaversePlaygroundRangeFloorEnvironmentAssetId,
  metaverseWorldGroundedSpawnPosition,
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
const shippedPlaygroundFloorSupportHeightMeters = metaverseWorldGroundedSpawnPosition.y;

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("shared metaverse surface authoring and queries expose placements, static colliders, and dynamic collider derivation", () => {
  const floorSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaversePlaygroundRangeFloorEnvironmentAssetId
  );
  const barrierSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaversePlaygroundRangeBarrierEnvironmentAssetId
  );

  assert.notEqual(floorSurfaceAsset, null);
  assert.notEqual(barrierSurfaceAsset, null);
  assert.equal(floorSurfaceAsset?.placement, "static");
  assert.equal(floorSurfaceAsset?.placements.length, 1);
  assert.equal(barrierSurfaceAsset?.placement, "instanced");
  assert.equal(barrierSurfaceAsset?.placements.length, 6);
  assert.ok(staticSurfaceColliders.length > 0);
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

test("shared metaverse surface authoring exposes the shipped range floor slice with one support slab", () => {
  const floorSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaversePlaygroundRangeFloorEnvironmentAssetId
  );

  assert.notEqual(floorSurfaceAsset, null);
  assert.equal(floorSurfaceAsset?.placement, "static");
  assert.equal(floorSurfaceAsset?.placements.length, 1);
  assert.equal(
    floorSurfaceAsset?.surfaceColliders.filter(
      (collider) => collider.traversalAffordance === "support"
    ).length,
    1
  );
});

test("shared metaverse barrier authoring stays instanced and blocker-only", () => {
  const barrierSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaversePlaygroundRangeBarrierEnvironmentAssetId
  );

  assert.notEqual(barrierSurfaceAsset, null);
  assert.equal(barrierSurfaceAsset?.placement, "instanced");
  assert.equal(barrierSurfaceAsset?.placements.length, 6);
  assert.equal(
    barrierSurfaceAsset?.surfaceColliders.length,
    1
  );
  assert.equal(
    barrierSurfaceAsset?.surfaceColliders[0]?.traversalAffordance,
    "blocker"
  );
});

test("shared metaverse surface policy keeps range support, open water, and bay-edge exit distinct", () => {
  const floorDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    metaverseWorldGroundedSpawnPosition,
    0,
    "grounded"
  );
  const openWaterDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: 66,
      y: 0,
      z: 10
    },
    0,
    "swim"
  );
  const bayEdgeExitDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
    metaverseSurfacePolicyConfig,
    staticSurfaceColliders,
    metaverseWorldPlacedWaterRegions,
    {
      x: 36,
      y: 0,
      z: 10
    },
    0,
    "swim"
  );

  assert.equal(floorDecision.decision.locomotionMode, "grounded");
  assert.equal(floorDecision.debug.reason, "grounded-hold");

  assert.equal(openWaterDecision.decision.locomotionMode, "swim");
  assert.equal(openWaterDecision.debug.reason, "shoreline-exit-blocked");
  assert.equal(openWaterDecision.debug.blockerOverlap, false);

  assert.equal(bayEdgeExitDecision.decision.locomotionMode, "grounded");
  assert.equal(bayEdgeExitDecision.debug.reason, "shoreline-exit-success");
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
