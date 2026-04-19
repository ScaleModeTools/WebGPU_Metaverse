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

test("createMetaverseMountedInteractionSnapshot reuses focused mountable boarding and direct-seat selection while unmounted", async () => {
  const { createMetaverseMountedInteractionSnapshot } = await clientLoader.load(
    "/src/metaverse/states/metaverse-mounted-interaction-snapshot.ts"
  );
  const focusedMountable = Object.freeze({
    boardingEntries: Object.freeze([
      Object.freeze({
        entryId: "deck-entry",
        label: "Board deck"
      })
    ]),
    directSeatTargets: Object.freeze([
      Object.freeze({
        label: "Take helm",
        seatId: "driver-seat",
        seatRole: "driver"
      })
    ]),
    distanceFromCamera: 1.25,
    environmentAssetId: "harbor-skiff",
    label: "Harbor Skiff"
  });

  const snapshot = createMetaverseMountedInteractionSnapshot(
    focusedMountable,
    null
  );

  assert.equal(snapshot.focusedMountable, focusedMountable);
  assert.equal(snapshot.mountedEnvironment, null);
  assert.equal(snapshot.seatTargetEnvironmentAssetId, "harbor-skiff");
  assert.equal(snapshot.boardingEntries, focusedMountable.boardingEntries);
  assert.equal(
    snapshot.selectableSeatTargets,
    focusedMountable.directSeatTargets
  );
});

test("createMetaverseMountedInteractionSnapshot filters the currently occupied seat while mounted", async () => {
  const { createMetaverseMountedInteractionSnapshot } = await clientLoader.load(
    "/src/metaverse/states/metaverse-mounted-interaction-snapshot.ts"
  );
  const mountedEnvironment = Object.freeze({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "look-only",
    directSeatTargets: Object.freeze([]),
    entryId: null,
    environmentAssetId: "harbor-skiff",
    label: "Harbor Skiff",
    lookLimitPolicyId: "wide",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantLabel: "Driver",
    occupantRole: "driver",
    seatId: "driver-seat",
    seatTargets: Object.freeze([
      Object.freeze({
        label: "Take helm",
        seatId: "driver-seat",
        seatRole: "driver"
      }),
      Object.freeze({
        label: "Port bench",
        seatId: "port-bench-seat",
        seatRole: "passenger"
      })
    ])
  });

  const snapshot = createMetaverseMountedInteractionSnapshot(
    null,
    mountedEnvironment
  );

  assert.equal(snapshot.focusedMountable, null);
  assert.equal(snapshot.mountedEnvironment, mountedEnvironment);
  assert.equal(snapshot.seatTargetEnvironmentAssetId, "harbor-skiff");
  assert.deepEqual(snapshot.boardingEntries, []);
  assert.deepEqual(snapshot.selectableSeatTargets, [
    Object.freeze({
      label: "Port bench",
      seatId: "port-bench-seat",
      seatRole: "passenger"
    })
  ]);
});
