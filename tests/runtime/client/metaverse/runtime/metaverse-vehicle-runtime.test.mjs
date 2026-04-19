import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { authoredWaterBayOpenWaterSpawn } from "../../../metaverse-authored-world-test-fixtures.mjs";
import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createFakePhysicsRuntime } from "../../fake-rapier-runtime.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseVehicleRuntime ignores self-owned support colliders when resolving waterborne motion", async () => {
  const [
    { MetaverseVehicleRuntime },
    { RapierPhysicsRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    driveCollider: Object.freeze({
      center: Object.freeze({ x: 0, y: 0.72, z: 0 }),
      size: Object.freeze({ x: 4.2, y: 1.44, z: 1.8 })
    }),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    physicsRuntime,
    poseSnapshot: {
      position: {
        x: authoredWaterBayOpenWaterSpawn.x,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: authoredWaterBayOpenWaterSpawn.z
      },
      yawRadians: Math.PI
    },
    resolveWaterborneTraversalFilterPredicate(
      _excludedOwnerEnvironmentAssetId = null,
      excludedColliders = []
    ) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => !excludedColliderSet.has(collider);
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: Object.freeze({
          x: 2.1,
          y: 0.06,
          z: 0.9
        }),
        ownerEnvironmentAssetId: "metaverse-hub-skiff-v1",
        rotation: Object.freeze({
          x: 0,
          y: 0,
          z: 0,
          w: 1
        }),
        translation: Object.freeze({
          x: authoredWaterBayOpenWaterSpawn.x,
          y: 0.62,
          z: authoredWaterBayOpenWaterSpawn.z
        }),
        traversalAffordance: "support"
      })
    ],
    waterRegionSnapshots: metaverseRuntimeConfig.waterRegionSnapshots,
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
    worldRadius: metaverseRuntimeConfig.movement.worldRadius
  });
  const startingSnapshot = vehicleRuntime.snapshot;

  assert.equal(startingSnapshot.waterborne, true);

  const advancedSnapshot = vehicleRuntime.advance(
    {
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0
    },
    metaverseRuntimeConfig.skiff,
    0.25,
    metaverseRuntimeConfig.movement.worldRadius
  );

  assert.equal(advancedSnapshot.waterborne, true);
  assert.ok(
    Math.hypot(
      advancedSnapshot.position.x - startingSnapshot.position.x,
      advancedSnapshot.position.z - startingSnapshot.position.z
    ) > 0.01
  );
});

test("MetaverseVehicleRuntime blends routine authoritative correction and preserves authoritative motion continuity", async () => {
  const [
    { MetaverseVehicleRuntime },
    { RapierPhysicsRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    driveCollider: Object.freeze({
      center: Object.freeze({ x: 0, y: 0.72, z: 0 }),
      size: Object.freeze({ x: 4.2, y: 1.44, z: 1.8 })
    }),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    physicsRuntime,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: 0
    },
    resolveWaterborneTraversalFilterPredicate(
      _excludedOwnerEnvironmentAssetId = null,
      excludedColliders = []
    ) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => !excludedColliderSet.has(collider);
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [],
    waterRegionSnapshots: metaverseRuntimeConfig.waterRegionSnapshots,
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
    worldRadius: metaverseRuntimeConfig.movement.worldRadius
  });

  const correctedSnapshot = vehicleRuntime.syncAuthoritativePose({
    linearVelocity: {
      x: 0,
      y: 0,
      z: -metaverseRuntimeConfig.skiff.baseSpeedUnitsPerSecond
    },
    position: {
      x: 0.6,
      y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
      z: 23.4
    },
    yawRadians: 0.12
  });

  assert.ok(correctedSnapshot.position.x > 0);
  assert.ok(correctedSnapshot.position.x < 0.6);
  assert.ok(correctedSnapshot.position.z < 24);
  assert.ok(correctedSnapshot.position.z > 23.4);
  assert.ok(correctedSnapshot.yawRadians > 0);
  assert.ok(correctedSnapshot.yawRadians < 0.12);

  const advancedSnapshot = vehicleRuntime.advance(
    {
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    },
    metaverseRuntimeConfig.skiff,
    1 / 60,
    metaverseRuntimeConfig.movement.worldRadius
  );

  assert.ok(advancedSnapshot.position.z < correctedSnapshot.position.z);
});

test("MetaverseVehicleRuntime snaps gross authoritative divergence instead of blending it", async () => {
  const [
    { MetaverseVehicleRuntime },
    { RapierPhysicsRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    driveCollider: Object.freeze({
      center: Object.freeze({ x: 0, y: 0.72, z: 0 }),
      size: Object.freeze({ x: 4.2, y: 1.44, z: 1.8 })
    }),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    physicsRuntime,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: 0
    },
    resolveWaterborneTraversalFilterPredicate(
      _excludedOwnerEnvironmentAssetId = null,
      excludedColliders = []
    ) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => !excludedColliderSet.has(collider);
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [],
    waterRegionSnapshots: metaverseRuntimeConfig.waterRegionSnapshots,
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
    worldRadius: metaverseRuntimeConfig.movement.worldRadius
  });

  const correctedSnapshot = vehicleRuntime.syncAuthoritativePose({
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    position: {
      x: 5,
      y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
      z: 20
    },
    yawRadians: 1
  });

  assert.equal(correctedSnapshot.position.x, 5);
  assert.equal(correctedSnapshot.position.z, 20);
  assert.equal(correctedSnapshot.yawRadians, 1);
});

test("MetaverseVehicleRuntime resolves mounted occupancy snapshots from shared authored seat and entry policy", async () => {
  const [
    { MetaverseVehicleRuntime },
    { RapierPhysicsRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/physics/index.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    driveCollider: Object.freeze({
      center: Object.freeze({ x: 0, y: 0.72, z: 0 }),
      size: Object.freeze({ x: 4.2, y: 1.44, z: 1.8 })
    }),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: [
      {
        cameraPolicyId: "seat-follow",
        controlRoutingPolicyId: "look-only",
        dismountOffset: { x: 0, y: 0, z: -1 },
        entryId: "deck-entry",
        entryNodeName: "deck_entry",
        label: "Board deck",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupantRole: "passenger"
      }
    ],
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    physicsRuntime,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: 0
    },
    resolveWaterborneTraversalFilterPredicate(
      _excludedOwnerEnvironmentAssetId = null,
      excludedColliders = []
    ) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => !excludedColliderSet.has(collider);
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [],
    waterRegionSnapshots: metaverseRuntimeConfig.waterRegionSnapshots,
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
    worldRadius: metaverseRuntimeConfig.movement.worldRadius
  });

  const occupiedSeat = vehicleRuntime.occupySeat("driver-seat");
  const seatedSnapshot = vehicleRuntime.snapshot;

  assert.equal(occupiedSeat?.seatId, "driver-seat");
  assert.deepEqual(seatedSnapshot.occupancy, {
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    dismountOffset: { x: 0, y: 0, z: 1 },
    entryId: null,
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantLabel: "Take helm",
    occupantRole: "driver",
    seatId: "driver-seat"
  });

  const occupiedEntry = vehicleRuntime.occupyEntry("deck-entry");
  const boardedSnapshot = vehicleRuntime.snapshot;

  assert.equal(occupiedEntry?.entryId, "deck-entry");
  assert.deepEqual(boardedSnapshot.occupancy, {
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    dismountOffset: { x: 0, y: 0, z: -1 },
    entryId: "deck-entry",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupancyKind: "entry",
    occupantLabel: "Board deck",
    occupantRole: "passenger",
    seatId: null
  });
});
