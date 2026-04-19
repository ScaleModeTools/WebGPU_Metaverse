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

test("createMetaverseSceneMountedPresentationSnapshot keeps scene-local mounted handoff on one snapshot", async () => {
  const [{ createMetaverseSceneMountedPresentationSnapshot }] =
    await Promise.all([
      clientLoader.load(
        "/src/metaverse/render/mounts/metaverse-scene-mounted-presentation-snapshot.ts"
      )
    ]);
  const mountedEnvironment = Object.freeze({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directSeatTargets: Object.freeze([]),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entryId: null,
    label: "Metaverse hub skiff",
    lookLimitPolicyId: "passenger-bench",
    occupancyAnimationId: "standing",
    occupancyKind: "seat",
    occupantLabel: "Port bench",
    occupantRole: "passenger",
    seatId: "port_bench_seat",
    seatTargets: Object.freeze([])
  });

  const mountedPresentationSnapshot =
    createMetaverseSceneMountedPresentationSnapshot(mountedEnvironment);

  assert.equal(
    mountedPresentationSnapshot.mountedEnvironment,
    mountedEnvironment
  );
  assert.deepEqual(mountedPresentationSnapshot.mountedOccupancyPresentationState, {
    constrainToAnchor: true,
    holsterHeldAttachment: true,
    keepFreeRoam: false,
    lookConstraintBounds: Object.freeze({
      maxPitchRadians: 0.42,
      maxYawOffsetRadians: Math.PI * 0.45,
      minPitchRadians: -0.42
    }),
    mountedCharacterAnimationVocabulary: "idle",
    usesMountedAnchorCamera: true,
    usesVehicleFollowCamera: false
  });
});
