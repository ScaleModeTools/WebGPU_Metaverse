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

test("createMetaverseMountedInteractionHudSnapshot stays hidden when no mounted interaction target exists", async () => {
  const { createMetaverseMountedInteractionHudSnapshot } =
    await clientLoader.load(
      "/src/metaverse/states/metaverse-mounted-interaction-hud-snapshot.ts"
    );

  const snapshot = createMetaverseMountedInteractionHudSnapshot(
    Object.freeze({
      boardingEntries: Object.freeze([]),
      focusedMountable: null,
      mountedEnvironment: null,
      seatTargetEnvironmentAssetId: null,
      selectableSeatTargets: Object.freeze([])
    })
  );

  assert.equal(snapshot.visible, false);
  assert.equal(snapshot.heading, null);
  assert.equal(snapshot.detail, null);
  assert.equal(snapshot.leaveActionLabel, null);
  assert.equal(snapshot.boardingEntries.length, 0);
  assert.equal(snapshot.seatTargets.length, 0);
});

test("createMetaverseMountedInteractionHudSnapshot resolves focused mountable access copy for the HUD", async () => {
  const { createMetaverseMountedInteractionHudSnapshot } =
    await clientLoader.load(
      "/src/metaverse/states/metaverse-mounted-interaction-hud-snapshot.ts"
    );
  const boardingEntries = Object.freeze([
    Object.freeze({
      entryId: "deck-entry",
      label: "Board deck"
    })
  ]);
  const seatTargets = Object.freeze([
    Object.freeze({
      label: "Take helm",
      seatId: "driver-seat",
      seatRole: "driver"
    })
  ]);
  const snapshot = createMetaverseMountedInteractionHudSnapshot(
    Object.freeze({
      boardingEntries,
      focusedMountable: Object.freeze({
        boardingEntries,
        directSeatTargets: seatTargets,
        distanceFromCamera: 1.25,
        environmentAssetId: "harbor-skiff",
        label: "Harbor Skiff"
      }),
      mountedEnvironment: null,
      seatTargetEnvironmentAssetId: "harbor-skiff",
      selectableSeatTargets: seatTargets
    })
  );

  assert.equal(snapshot.visible, true);
  assert.equal(snapshot.heading, "Harbor Skiff is in range.");
  assert.equal(
    snapshot.detail,
    "Board the deck first or take a direct seat now."
  );
  assert.equal(snapshot.boardingEntries, boardingEntries);
  assert.equal(snapshot.seatTargets, seatTargets);
  assert.equal(snapshot.seatTargetButtonVariant, "outline");
  assert.equal(snapshot.leaveActionLabel, null);
});

test("createMetaverseMountedInteractionHudSnapshot resolves mounted driver copy for the HUD", async () => {
  const { createMetaverseMountedInteractionHudSnapshot } =
    await clientLoader.load(
      "/src/metaverse/states/metaverse-mounted-interaction-hud-snapshot.ts"
    );
  const seatTargets = Object.freeze([
    Object.freeze({
      label: "Port bench",
      seatId: "port-bench-seat",
      seatRole: "passenger"
    })
  ]);
  const mountedEnvironment = Object.freeze({
    cameraPolicyId: "seat-follow",
    controlRoutingPolicyId: "vehicle-drive",
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
    seatTargets
  });
  const snapshot = createMetaverseMountedInteractionHudSnapshot(
    Object.freeze({
      boardingEntries: Object.freeze([]),
      focusedMountable: null,
      mountedEnvironment,
      seatTargetEnvironmentAssetId: "harbor-skiff",
      selectableSeatTargets: seatTargets
    })
  );

  assert.equal(snapshot.visible, true);
  assert.equal(snapshot.heading, "Harbor Skiff: Driver.");
  assert.equal(
    snapshot.detail,
    "Hub movement controls now drive this vehicle. Propulsion cuts out when the hull is beached on hard ground."
  );
  assert.equal(snapshot.seatTargets, seatTargets);
  assert.equal(snapshot.seatTargetButtonVariant, "default");
  assert.equal(snapshot.leaveActionLabel, "Leave Harbor Skiff");
});
