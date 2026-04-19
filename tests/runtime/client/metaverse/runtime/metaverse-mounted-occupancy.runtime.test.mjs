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

test("resolveMetaverseMountedOccupancyPresentationStateSnapshot keeps driver seats anchored and vehicle-followed", async () => {
  const mountedOccupancyStateModule = await clientLoader.load(
    "/src/metaverse/states/mounted-occupancy.ts"
  );

  const presentationState =
    mountedOccupancyStateModule
      .resolveMetaverseMountedOccupancyPresentationStateSnapshot({
        cameraPolicyId: "vehicle-follow",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        occupancyKind: "seat",
        occupantRole: "driver"
      });

  assert.deepEqual(presentationState, {
    constrainToAnchor: true,
    holsterHeldAttachment: true,
    keepFreeRoam: false,
    lookConstraintBounds: {
      maxPitchRadians: 0.6,
      maxYawOffsetRadians: 0,
      minPitchRadians: -0.6
    },
    mountedCharacterAnimationVocabulary: "seated",
    usesMountedAnchorCamera: false,
    usesVehicleFollowCamera: true
  });
});

test("resolveMetaverseMountedOccupancyPresentationStateSnapshot keeps standing passenger entries free-roam and idle", async () => {
  const mountedOccupancyStateModule = await clientLoader.load(
    "/src/metaverse/states/mounted-occupancy.ts"
  );

  const presentationState =
    mountedOccupancyStateModule
      .resolveMetaverseMountedOccupancyPresentationStateSnapshot({
        cameraPolicyId: "seat-follow",
        lookLimitPolicyId: "passenger-bench",
        occupancyAnimationId: "standing",
        occupancyKind: "entry",
        occupantRole: "passenger"
      });

  assert.deepEqual(presentationState, {
    constrainToAnchor: false,
    holsterHeldAttachment: false,
    keepFreeRoam: true,
    lookConstraintBounds: {
      maxPitchRadians: 0.42,
      maxYawOffsetRadians: Math.PI * 0.45,
      minPitchRadians: -0.42
    },
    mountedCharacterAnimationVocabulary: "idle",
    usesMountedAnchorCamera: false,
    usesVehicleFollowCamera: false
  });
  assert.equal(
    mountedOccupancyStateModule.shouldKeepMountedOccupancyFreeRoam({
      occupancyKind: "entry",
      occupantRole: "passenger"
    }),
    true
  );
  assert.equal(
    mountedOccupancyStateModule.shouldHolsterHeldAttachmentWhileMounted({
      occupancyKind: "entry",
      occupantRole: "passenger"
    }),
    false
  );
});
