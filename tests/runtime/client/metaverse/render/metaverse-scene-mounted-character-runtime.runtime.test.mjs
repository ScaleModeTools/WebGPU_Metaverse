import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function createCharacterRuntime(threeModule) {
  const { Group } = threeModule;
  const parentAnchor = new Group();
  const characterAnchor = new Group();
  const seatSocketNode = new Group();

  parentAnchor.name = "character-parent";
  characterAnchor.name = "character-anchor";
  seatSocketNode.name = "seat-socket";
  seatSocketNode.position.set(0.1, 0.2, -0.3);
  characterAnchor.position.set(1.2, 0.6, -2.4);
  characterAnchor.rotation.y = 0.35;
  parentAnchor.add(characterAnchor);
  characterAnchor.add(seatSocketNode);

  return {
    characterAnchor,
    characterRuntime: Object.freeze({
      anchorGroup: characterAnchor,
      seatSocketNode
    }),
    parentAnchor,
    seatSocketNode
  };
}

function createEnvironmentAsset(threeModule, seatAnchorGroup) {
  const { Group } = threeModule;

  return Object.freeze({
    anchorGroup: new Group(),
    collider: Object.freeze({
      center: Object.freeze({ x: 0, y: 0, z: 0 }),
      shape: "box",
      size: Object.freeze({ x: 2, y: 2, z: 2 })
    }),
    entries: null,
    environmentAssetId: "metaverse-hub-skiff-v1",
    label: "Metaverse hub skiff",
    seats: Object.freeze([
      Object.freeze({
        anchorGroup: seatAnchorGroup,
        seat: Object.freeze({
          cameraPolicyId: "vehicle-follow",
          controlRoutingPolicyId: "vehicle-surface-drive",
          directEntryEnabled: true,
          dismountOffset: Object.freeze({ x: 0, y: 0, z: 1 }),
          label: "Take helm",
          lookLimitPolicyId: "driver-forward",
          occupancyAnimationId: "seated",
          seatId: "driver-seat",
          seatNodeName: "driver-seat",
          seatRole: "driver"
        })
      })
    ]),
    traversalAffordance: "mount"
  });
}

test("syncMountedCharacterRuntimeFromSelectionReference mounts, follows the seat anchor, and restores the prior parent on dismount", async () => {
  const [
    threeModule,
    {
      applyCharacterMountedAnchorTransform,
      syncMountedCharacterRuntimeFromSelectionReference
    }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/mounts/metaverse-scene-mounted-character-runtime.ts"
    )
  ]);
  const { Group, Quaternion, Vector3 } = threeModule;
  const seatAnchor = new Group();
  const {
    characterAnchor,
    characterRuntime,
    parentAnchor,
    seatSocketNode
  } = createCharacterRuntime(threeModule);
  const originalWorldPosition = characterAnchor.getWorldPosition(new Vector3());
  const originalWorldQuaternion = characterAnchor.getWorldQuaternion(new Quaternion());
  const environmentAsset = createEnvironmentAsset(threeModule, seatAnchor);
  let mountedCharacterRuntime = syncMountedCharacterRuntimeFromSelectionReference(
    characterRuntime,
    null,
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    }),
    () => environmentAsset
  );

  assert.ok(mountedCharacterRuntime);
  assert.equal(characterAnchor.parent, seatAnchor);
  assert.ok(
    seatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(seatSocketNode.getWorldPosition(new Vector3())) < 0.001
  );

  seatAnchor.position.set(3.5, 1.1, -6.2);
  seatAnchor.rotation.y = Math.PI * 0.4;
  seatAnchor.updateMatrixWorld(true);
  applyCharacterMountedAnchorTransform(characterRuntime, mountedCharacterRuntime);

  assert.ok(
    seatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(seatSocketNode.getWorldPosition(new Vector3())) < 0.001
  );

  mountedCharacterRuntime = syncMountedCharacterRuntimeFromSelectionReference(
    characterRuntime,
    mountedCharacterRuntime,
    null,
    () => environmentAsset
  );

  assert.equal(mountedCharacterRuntime, null);
  assert.equal(characterAnchor.parent, parentAnchor);
  assert.ok(
    characterAnchor.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) <
      0.000001
  );
  assert.ok(
    characterAnchor.getWorldQuaternion(new Quaternion()).angleTo(
      originalWorldQuaternion
    ) < 0.000001
  );
});
