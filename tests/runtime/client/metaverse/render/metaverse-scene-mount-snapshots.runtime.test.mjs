import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function assertClose(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}.`
  );
}

function createSeatConfig(overrides = {}) {
  return {
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directEntryEnabled: true,
    label: "Take helm",
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    seatId: "driver-seat",
    seatRole: "driver",
    ...overrides
  };
}

function createEntryConfig(overrides = {}) {
  return {
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    entryId: "deck-entry",
    label: "Board deck",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupantRole: "passenger",
    ...overrides
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolveFocusedMountableSnapshot exposes the nearest mountable boarding and direct-seat targets", async () => {
  const [{ Group }, mountSnapshots] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/mounts/metaverse-scene-mount-snapshots.ts"
    )
  ]);

  const nearMountAnchor = new Group();
  nearMountAnchor.position.set(1.1, 0, 0);
  const nearEntryAnchor = new Group();
  const nearSeatAnchor = new Group();
  nearMountAnchor.add(nearEntryAnchor, nearSeatAnchor);

  const farMountAnchor = new Group();
  farMountAnchor.position.set(5.5, 0, 0);
  const farSeatAnchor = new Group();
  farMountAnchor.add(farSeatAnchor);

  nearMountAnchor.updateMatrixWorld(true);
  farMountAnchor.updateMatrixWorld(true);

  const snapshot = mountSnapshots.resolveFocusedMountableSnapshot(
    {
      dynamicAssets: [
        {
          anchorGroup: farMountAnchor,
          collider: {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 4, y: 3, z: 4 }
          },
          entries: null,
          environmentAssetId: "far-barge",
          label: "Far barge",
          seats: [
            {
              anchorGroup: farSeatAnchor,
              seat: createSeatConfig({
                label: "Far helm",
                seatId: "far-driver-seat"
              })
            }
          ],
          traversalAffordance: "mount"
        },
        {
          anchorGroup: nearMountAnchor,
          collider: {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 4, y: 3, z: 4 }
          },
          entries: [
            {
              anchorGroup: nearEntryAnchor,
              entry: createEntryConfig()
            }
          ],
          environmentAssetId: "near-skiff",
          label: "Near skiff",
          seats: [
            {
              anchorGroup: nearSeatAnchor,
              seat: createSeatConfig()
            }
          ],
          traversalAffordance: "mount"
        }
      ]
    },
    null,
    {
      lookDirection: { x: 1, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 }
    },
    0
  );

  assert.ok(snapshot !== null);
  assert.equal(snapshot.environmentAssetId, "near-skiff");
  assert.equal(snapshot.label, "Near skiff");
  assert.deepEqual(snapshot.boardingEntries, [
    {
      entryId: "deck-entry",
      label: "Board deck"
    }
  ]);
  assert.deepEqual(snapshot.directSeatTargets, [
    {
      label: "Take helm",
      seatId: "driver-seat",
      seatRole: "driver"
    }
  ]);
  assert.ok(snapshot.distanceFromCamera > 0);
});

test("resolveMountedEnvironmentAnchorSnapshot projects the selected seat anchor after simulation sync", async () => {
  const [{ Group, Quaternion, Vector3 }, mountSnapshots] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/mounts/metaverse-scene-mount-snapshots.ts"
    )
  ]);

  const environmentAnchor = new Group();
  const seatAnchor = new Group();
  seatAnchor.position.set(1.25, 0.9, -0.4);
  seatAnchor.rotation.y = Math.PI * 0.25;
  environmentAnchor.add(seatAnchor);
  environmentAnchor.updateMatrixWorld(true);

  const environmentRuntime = {
    anchorGroup: environmentAnchor,
    collider: {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 6, y: 3, z: 4 }
    },
    entries: null,
    environmentAssetId: "skiff-v1",
    label: "Skiff",
    seats: [
      {
        anchorGroup: seatAnchor,
        seat: createSeatConfig()
      }
    ],
    traversalAffordance: "mount"
  };

  const mountedEnvironment = mountSnapshots.createMountedEnvironmentSnapshot(
    environmentRuntime,
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

  const expectedAnchorPosition = new Vector3();
  const expectedAnchorQuaternion = new Quaternion();
  const expectedForward = new Vector3(0, 0, -1);

  const anchorSnapshot = mountSnapshots.resolveMountedEnvironmentAnchorSnapshot(
    environmentRuntime,
    mountedEnvironment,
    {
      createPositionSnapshot: (x, y, z) => Object.freeze({ x, y, z }),
      syncDynamicEnvironmentSimulationPose: (dynamicEnvironment) => {
        dynamicEnvironment.anchorGroup.position.set(3.2, 0.15, -4.4);
        dynamicEnvironment.anchorGroup.rotation.y = -Math.PI * 0.5;
        dynamicEnvironment.anchorGroup.updateMatrixWorld(true);
      }
    }
  );

  seatAnchor.getWorldPosition(expectedAnchorPosition);
  expectedForward
    .applyQuaternion(seatAnchor.getWorldQuaternion(expectedAnchorQuaternion))
    .normalize();

  assert.ok(anchorSnapshot !== null);
  assertClose(
    anchorSnapshot.position.x,
    expectedAnchorPosition.x,
    1e-6,
    "mounted anchor x"
  );
  assertClose(
    anchorSnapshot.position.y,
    expectedAnchorPosition.y,
    1e-6,
    "mounted anchor y"
  );
  assertClose(
    anchorSnapshot.position.z,
    expectedAnchorPosition.z,
    1e-6,
    "mounted anchor z"
  );
  assertClose(
    anchorSnapshot.yawRadians,
    Math.atan2(expectedForward.x, -expectedForward.z),
    1e-6,
    "mounted anchor yaw"
  );
});
