import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMetaverseWorldPlacedSurfaceColliders,
  resolveMetaverseWorldPlacedWaterRegionAtPlanarPosition,
  resolveMetaverseWorldWaterSurfaceHeightMeters
} from "@webgpu-metaverse/shared";

test("shared world surface query resolves placed colliders without shipped document state", () => {
  const colliders = resolveMetaverseWorldPlacedSurfaceColliders({
    environmentAssetId: "test-surface",
    placements: Object.freeze([
      Object.freeze({
        position: Object.freeze({ x: 10, y: 2, z: -3 }),
        rotationYRadians: Math.PI * 0.5,
        scale: 2
      })
    ]),
    surfaceColliders: Object.freeze([
      Object.freeze({
        center: Object.freeze({ x: 1, y: 0.5, z: 0 }),
        size: Object.freeze({ x: 4, y: 2, z: 6 }),
        traversalAffordance: "support"
      })
    ])
  });

  assert.equal(colliders.length, 1);
  assert.deepEqual(colliders[0]?.halfExtents, {
    x: 4,
    y: 2,
    z: 6
  });
  assert.deepEqual(colliders[0]?.translation, {
    x: 10,
    y: 3,
    z: -5
  });
  assert.equal(colliders[0]?.ownerEnvironmentAssetId, "test-surface");
  assert.equal(colliders[0]?.traversalAffordance, "support");
});

test("shared world surface query resolves water regions from explicit query snapshots", () => {
  const waterRegions = Object.freeze([
    Object.freeze({
      halfExtents: Object.freeze({ x: 3, y: 0.5, z: 4 }),
      rotationYRadians: 0,
      translation: Object.freeze({ x: 5, y: 1, z: -2 }),
      waterRegionId: "harbor-water"
    })
  ]);

  const matchedWaterRegion = resolveMetaverseWorldPlacedWaterRegionAtPlanarPosition(
    waterRegions,
    6,
    -1
  );
  const waterHeight = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegions,
    6,
    -1
  );
  const noWaterHeight = resolveMetaverseWorldWaterSurfaceHeightMeters(
    waterRegions,
    20,
    20
  );

  assert.equal(matchedWaterRegion?.waterRegionId, "harbor-water");
  assert.equal(waterHeight, 1.5);
  assert.equal(noWaterHeight, null);
});
