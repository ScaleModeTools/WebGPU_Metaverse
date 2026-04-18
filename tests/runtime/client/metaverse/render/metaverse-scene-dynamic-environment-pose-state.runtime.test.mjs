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

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseSceneDynamicEnvironmentPoseState normalizes stored overrides and clears back to base pose", async () => {
  const { MetaverseSceneDynamicEnvironmentPoseState } = await clientLoader.load(
    "/src/metaverse/render/environment/metaverse-scene-dynamic-environment-pose-state.ts"
  );
  const poseState = new MetaverseSceneDynamicEnvironmentPoseState();
  const environmentProofRuntime = {
    dynamicAssets: [
      {
        basePlacement: {
          position: { x: 1, y: 0.25, z: -3 },
          rotationYRadians: 0.35,
          scale: 1
        },
        environmentAssetId: "crate-v1",
        orientation: null
      }
    ]
  };

  poseState.setDynamicEnvironmentPose("crate-v1", {
    position: { x: Number.NaN, y: 2.5, z: Number.POSITIVE_INFINITY },
    yawRadians: Math.PI * 5
  });

  const overriddenPose = poseState.readDynamicEnvironmentPose(
    environmentProofRuntime,
    "crate-v1"
  );

  assert.ok(overriddenPose !== null);
  assert.deepEqual(overriddenPose.position, { x: 0, y: 2.5, z: 0 });
  assertClose(overriddenPose.yawRadians, Math.PI, 1e-6, "wrapped yaw");

  poseState.clear();

  const basePose = poseState.readDynamicEnvironmentPose(
    environmentProofRuntime,
    "crate-v1"
  );

  assert.ok(basePose !== null);
  assert.deepEqual(basePose.position, { x: 1, y: 0.25, z: -3 });
  assertClose(basePose.yawRadians, 0.35, 1e-6, "base yaw");
});

test("MetaverseSceneDynamicEnvironmentPoseState projects mounted anchor snapshots from overridden dynamic poses", async () => {
  const [{ Group, Quaternion, Vector3 }, { MetaverseSceneDynamicEnvironmentPoseState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/environment/metaverse-scene-dynamic-environment-pose-state.ts"
      )
    ]);
  const poseState = new MetaverseSceneDynamicEnvironmentPoseState();
  const anchorGroup = new Group();
  const seatAnchor = new Group();
  const expectedAnchorPosition = new Vector3();
  const expectedAnchorQuaternion = new Quaternion();
  const expectedForward = new Vector3(0, 0, -1);

  seatAnchor.position.set(1.4, 1.05, -0.35);
  seatAnchor.rotation.y = Math.PI * 0.25;
  anchorGroup.add(seatAnchor);

  const environmentRuntime = {
    anchorGroup,
    basePlacement: {
      position: { x: 0, y: 0.1, z: 0 },
      rotationYRadians: 0,
      scale: 1
    },
    collider: {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 6, y: 3, z: 4 }
    },
    entries: null,
    environmentAssetId: "skiff-v1",
    label: "Skiff",
    motionPhase: 0,
    orientation: null,
    presentationGroup: new Group(),
    scene: new Group(),
    seats: [
      {
        anchorGroup: seatAnchor,
        seat: {
          cameraPolicyId: "vehicle-follow",
          controlRoutingPolicyId: "vehicle-surface-drive",
          directEntryEnabled: true,
          label: "Take helm",
          lookLimitPolicyId: "driver-forward",
          occupancyAnimationId: "seated",
          seatId: "driver-seat",
          seatRole: "driver"
        }
      }
    ],
    traversalAffordance: "mount"
  };

  poseState.setDynamicEnvironmentPose("skiff-v1", {
    position: { x: 3.2, y: 0.2, z: -4.5 },
    yawRadians: 0.4
  });

  const mountedAnchorSnapshot = poseState.readMountedEnvironmentAnchorSnapshot(
    {
      dynamicAssets: [environmentRuntime]
    },
    {
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      directSeatTargets: [],
      entryId: null,
      environmentAssetId: "skiff-v1",
      label: "Skiff",
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Take helm",
      occupantRole: "driver",
      seatId: "driver-seat",
      seatTargets: []
    }
  );

  anchorGroup.updateMatrixWorld(true);
  seatAnchor.getWorldPosition(expectedAnchorPosition);
  expectedForward
    .applyQuaternion(seatAnchor.getWorldQuaternion(expectedAnchorQuaternion))
    .normalize();

  assert.ok(mountedAnchorSnapshot !== null);
  assertClose(
    mountedAnchorSnapshot.position.x,
    expectedAnchorPosition.x,
    1e-6,
    "mounted anchor x"
  );
  assertClose(
    mountedAnchorSnapshot.position.y,
    expectedAnchorPosition.y,
    1e-6,
    "mounted anchor y"
  );
  assertClose(
    mountedAnchorSnapshot.position.z,
    expectedAnchorPosition.z,
    1e-6,
    "mounted anchor z"
  );
  assertClose(
    mountedAnchorSnapshot.yawRadians,
    Math.atan2(expectedForward.x, -expectedForward.z),
    1e-6,
    "mounted anchor yaw"
  );
});
