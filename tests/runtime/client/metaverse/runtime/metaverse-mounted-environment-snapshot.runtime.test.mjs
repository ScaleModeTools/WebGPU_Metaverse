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

test("createMetaverseMountedEnvironmentSnapshot projects mounted occupancy over authored seat targets", async () => {
  const mountedEnvironmentSnapshotModule = await clientLoader.load(
    "/src/metaverse/states/metaverse-mounted-environment-snapshot.ts"
  );

  const mountedEnvironment =
    mountedEnvironmentSnapshotModule.createMetaverseMountedEnvironmentSnapshot({
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Harbor skiff",
      occupancyPolicy: {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        entryId: null,
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        occupancyKind: "seat",
        occupantLabel: "Take helm",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      seats: [
        {
          directEntryEnabled: true,
          label: "Take helm",
          seatId: "driver-seat",
          seatRole: "driver"
        },
        {
          directEntryEnabled: false,
          label: "Port bench",
          seatId: "port-bench-seat",
          seatRole: "passenger"
        }
      ]
    });

  assert.deepEqual(mountedEnvironment, {
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directSeatTargets: [
      {
        label: "Take helm",
        seatId: "driver-seat",
        seatRole: "driver"
      }
    ],
    entryId: null,
    environmentAssetId: "metaverse-hub-skiff-v1",
    label: "Harbor skiff",
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantLabel: "Take helm",
    occupantRole: "driver",
    seatId: "driver-seat",
    seatTargets: [
      {
        label: "Take helm",
        seatId: "driver-seat",
        seatRole: "driver"
      },
      {
        label: "Port bench",
        seatId: "port-bench-seat",
        seatRole: "passenger"
      }
    ]
  });
});
