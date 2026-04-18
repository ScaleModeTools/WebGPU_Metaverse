import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

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

test("resolveFocusedMountableEnvironmentRuntime can use the forward probe and ignores non-mountable assets", async () => {
  const [{ Group }, mountResolution] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/mounts/metaverse-scene-mount-runtime-resolution.ts"
    )
  ]);

  const nonMountableAnchor = new Group();
  nonMountableAnchor.position.set(2, 0, 0);
  nonMountableAnchor.updateMatrixWorld(true);

  const mountAnchor = new Group();
  mountAnchor.position.set(4, 0, 0);
  mountAnchor.updateMatrixWorld(true);

  const resolved = mountResolution.resolveFocusedMountableEnvironmentRuntime(
    {
      dynamicAssets: [
        {
          anchorGroup: nonMountableAnchor,
          collider: {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 2, y: 2, z: 2 }
          },
          entries: null,
          environmentAssetId: "flat-rock",
          label: "Flat rock",
          seats: null,
          traversalAffordance: "walkable"
        },
        {
          anchorGroup: mountAnchor,
          collider: {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 2, y: 2, z: 2 }
          },
          entries: [
            {
              anchorGroup: new Group(),
              entry: createEntryConfig()
            }
          ],
          environmentAssetId: "skiff-v1",
          label: "Skiff",
          seats: [
            {
              anchorGroup: new Group(),
              seat: createSeatConfig()
            }
          ],
          traversalAffordance: "mount"
        }
      ]
    },
    {
      lookDirection: { x: 1, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 }
    },
    4
  );

  assert.ok(resolved !== null);
  assert.equal(resolved.environmentAsset.environmentAssetId, "skiff-v1");
});

test("resolveMountedEnvironmentSelectionByRequest prefers explicit requests, then default entries, then direct seats", async () => {
  const [{ Group }, mountResolution] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/mounts/metaverse-scene-mount-runtime-resolution.ts"
    )
  ]);

  const entryAnchor = new Group();
  const directSeatAnchor = new Group();
  const benchSeatAnchor = new Group();
  const environmentRuntime = {
    anchorGroup: new Group(),
    collider: {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 6, y: 3, z: 4 }
    },
    entries: [
      {
        anchorGroup: entryAnchor,
        entry: createEntryConfig()
      }
    ],
    environmentAssetId: "skiff-v1",
    label: "Skiff",
    seats: [
      {
        anchorGroup: directSeatAnchor,
        seat: createSeatConfig()
      },
      {
        anchorGroup: benchSeatAnchor,
        seat: createSeatConfig({
          directEntryEnabled: false,
          label: "Bench",
          seatId: "bench-seat",
          seatRole: "passenger"
        })
      }
    ],
    traversalAffordance: "mount"
  };

  const requestedSeat =
    mountResolution.resolveMountedEnvironmentSelectionByRequest(
      environmentRuntime,
      { requestedSeatId: "bench-seat" }
    );
  const defaultSelection =
    mountResolution.resolveMountedEnvironmentSelectionByRequest(
      environmentRuntime
    );
  const directSeatFallback =
    mountResolution.resolveMountedEnvironmentSelectionByRequest(
      {
        ...environmentRuntime,
        entries: null
      }
    );

  assert.ok(requestedSeat !== null);
  assert.equal(requestedSeat.anchorGroup, benchSeatAnchor);
  assert.equal(requestedSeat.seatId, "bench-seat");
  assert.equal(requestedSeat.occupancyKind, "seat");

  assert.ok(defaultSelection !== null);
  assert.equal(defaultSelection.anchorGroup, entryAnchor);
  assert.equal(defaultSelection.entryId, "deck-entry");
  assert.equal(defaultSelection.occupancyKind, "entry");

  assert.ok(directSeatFallback !== null);
  assert.equal(directSeatFallback.anchorGroup, directSeatAnchor);
  assert.equal(directSeatFallback.seatId, "driver-seat");
  assert.equal(directSeatFallback.occupancyKind, "seat");
});
