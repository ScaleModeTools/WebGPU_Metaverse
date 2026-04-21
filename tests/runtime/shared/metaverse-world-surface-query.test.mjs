import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseWorldMountedEntryOccupancyPolicySnapshot,
  createMetaverseWorldMountedSeatOccupancyPolicySnapshot,
  createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot,
  readMetaverseWorldMountedEntryAuthoring,
  readMetaverseWorldMountedSeatAuthoring,
  resolveMetaverseTraversalStateFromWorldAffordances,
  resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring,
  resolveMetaverseWorldPlacedSurfaceColliders,
  resolveMetaverseWorldSurfaceHeightMeters,
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

test("shared world surface query derives support height from authored tri-mesh collision", () => {
  const triMeshSupportSnapshot =
    createMetaverseWorldPlacedSurfaceTriMeshSupportSnapshot(
      "test-trimesh-surface",
      {
        indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
        vertices: Float32Array.from([
          -1, 0.6, -1,
          1, 0.6, -1,
          1, 0.6, 1,
          -1, 0.6, 1
        ])
      },
      {
        position: Object.freeze({ x: 8, y: 2, z: -6 }),
        yawRadians: 0
      }
    );

  assert.notEqual(triMeshSupportSnapshot, null);
  assert.equal(triMeshSupportSnapshot?.shape, "trimesh");
  assert.ok(
    Math.abs(
      (resolveMetaverseWorldSurfaceHeightMeters(
        Object.freeze({
          capsuleHalfHeightMeters: 0.48,
          capsuleRadiusMeters: 0.34,
          gravityUnitsPerSecond: 18,
          jumpImpulseUnitsPerSecond: 6.8,
          oceanHeightMeters: 0,
          stepHeightMeters: 0.28
        }),
        Object.freeze([triMeshSupportSnapshot]),
        Object.freeze([]),
        8.1,
        -5.9
      ) ?? 0) - 2.6
    ) < 0.0001
  );
});

test("shared traversal state resolver keeps direct grounded support height above water when step probes are absent", () => {
  const supportHeightMeters = 0.8;
  const traversalState = resolveMetaverseTraversalStateFromWorldAffordances(
    Object.freeze({
      capsuleHalfHeightMeters: 0.48,
      capsuleRadiusMeters: 0.34,
      gravityUnitsPerSecond: 18,
      jumpImpulseUnitsPerSecond: 6.8,
      oceanHeightMeters: 0,
      stepHeightMeters: 0.28
    }),
    Object.freeze([
      Object.freeze({
        halfExtents: Object.freeze({ x: 0.2, y: 0.1, z: 0.2 }),
        ownerEnvironmentAssetId: "test-free-roam-support",
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        rotationYRadians: 0,
        translation: Object.freeze({ x: 0, y: 0.7, z: 0 }),
        traversalAffordance: "support"
      })
    ]),
    Object.freeze([
      Object.freeze({
        halfExtents: Object.freeze({ x: 3, y: 0, z: 3 }),
        rotationYRadians: 0,
        translation: Object.freeze({ x: 0, y: 0, z: 0 }),
        waterRegionId: "test-water"
      })
    ]),
    Object.freeze({ x: 0, y: supportHeightMeters, z: 0 }),
    0,
    "grounded"
  );

  assert.equal(traversalState.decision.locomotionMode, "grounded");
  assert.ok(
    Math.abs(
      traversalState.debug.resolvedSupportHeightMeters - supportHeightMeters
    ) < 0.000001
  );
  assert.notEqual(traversalState.decision.supportHeightMeters, null);
  assert.ok(
    Math.abs(
      traversalState.decision.supportHeightMeters - supportHeightMeters
    ) < 0.000001
  );
});

test("shared world surface query can cap support selection at the active capsule bottom height", () => {
  const config = Object.freeze({
    capsuleHalfHeightMeters: 0.48,
    capsuleRadiusMeters: 0.34,
    gravityUnitsPerSecond: 18,
    jumpImpulseUnitsPerSecond: 6.8,
    oceanHeightMeters: 0,
    stepHeightMeters: 0.28
  });
  const floorSurfaceHeightMeters = 0.1;
  const overheadSurfaceHeightMeters = 1.5;
  const surfaceColliders = Object.freeze([
    Object.freeze({
      halfExtents: Object.freeze({ x: 2, y: 0.1, z: 2 }),
      ownerEnvironmentAssetId: "test-floor-support",
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      rotationYRadians: 0,
      translation: Object.freeze({ x: 0, y: 0, z: 0 }),
      traversalAffordance: "support"
    }),
    Object.freeze({
      halfExtents: Object.freeze({ x: 2, y: 0.15, z: 2 }),
      ownerEnvironmentAssetId: "test-overhead-support",
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      rotationYRadians: 0,
      translation: Object.freeze({ x: 0, y: 1.35, z: 0 }),
      traversalAffordance: "support"
    })
  ]);

  assert.equal(
    resolveMetaverseWorldSurfaceHeightMeters(
      config,
      surfaceColliders,
      Object.freeze([]),
      0,
      0
    ),
    overheadSurfaceHeightMeters
  );
  assert.equal(
    resolveMetaverseWorldSurfaceHeightMeters(
      config,
      surfaceColliders,
      Object.freeze([]),
      0,
      0,
      null,
      floorSurfaceHeightMeters
    ),
    floorSurfaceHeightMeters
  );
});

test("shared world surface query reads authored mounted seat and entry policy from surface assets", () => {
  const surfaceAsset = Object.freeze({
    entries: Object.freeze([
      Object.freeze({
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        entryId: "deck-entry",
        label: "Board deck",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupantRole: "passenger"
      })
    ]),
    seats: Object.freeze([
      Object.freeze({
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatRole: "driver"
      })
    ])
  });

  assert.deepEqual(
    readMetaverseWorldMountedSeatAuthoring(surfaceAsset, "driver-seat"),
    surfaceAsset.seats[0]
  );
  assert.deepEqual(
    readMetaverseWorldMountedEntryAuthoring(surfaceAsset, "deck-entry"),
    surfaceAsset.entries[0]
  );
  assert.equal(
    readMetaverseWorldMountedSeatAuthoring(surfaceAsset, "missing-seat"),
    null
  );
  assert.equal(
    readMetaverseWorldMountedEntryAuthoring(surfaceAsset, "missing-entry"),
    null
  );
});

test("shared world surface query resolves authored mounted occupancy policy snapshots for seats and entries", () => {
  const seatAuthoring = Object.freeze({
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directEntryEnabled: true,
    label: "Take helm",
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    seatId: "driver-seat",
    seatRole: "driver"
  });
  const entryAuthoring = Object.freeze({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    entryId: "deck-entry",
    label: "Board deck",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupantRole: "passenger"
  });

  assert.deepEqual(
    createMetaverseWorldMountedSeatOccupancyPolicySnapshot(seatAuthoring),
    {
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      entryId: null,
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Take helm",
      occupantRole: "driver",
      seatId: "driver-seat"
    }
  );
  assert.deepEqual(
    createMetaverseWorldMountedEntryOccupancyPolicySnapshot(entryAuthoring),
    {
      cameraPolicyId: "seat-follow",
      controlRoutingPolicyId: "look-only",
      entryId: "deck-entry",
      lookLimitPolicyId: "passenger-bench",
      occupancyAnimationId: "standing",
      occupancyKind: "entry",
      occupantLabel: "Board deck",
      occupantRole: "passenger",
      seatId: null
    }
  );
  assert.deepEqual(
    resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
      {
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      seatAuthoring
    ),
    createMetaverseWorldMountedSeatOccupancyPolicySnapshot(seatAuthoring)
  );
  assert.deepEqual(
    resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
      {
        entryId: "deck-entry",
        occupancyKind: "entry",
        occupantRole: "passenger",
        seatId: null
      },
      entryAuthoring
    ),
    createMetaverseWorldMountedEntryOccupancyPolicySnapshot(entryAuthoring)
  );
  assert.equal(
    resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
      {
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: "driver-seat"
      },
      seatAuthoring
    ),
    null
  );
  assert.equal(
    resolveMetaverseWorldMountedOccupancyPolicySnapshotFromAuthoring(
      {
        entryId: "deck-entry",
        occupancyKind: "entry",
        occupantRole: "passenger",
        seatId: null
      },
      seatAuthoring
    ),
    null
  );
});
