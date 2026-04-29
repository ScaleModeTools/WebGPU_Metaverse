import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

const runtimeConfig = Object.freeze({
  camera: Object.freeze({
    fieldOfViewDegrees: 70
  })
});

const mountedEnvironmentSnapshot = Object.freeze({
  cameraPolicyId: "seat-follow",
  controlRoutingPolicyId: "vehicle-surface-drive",
  directSeatTargets: Object.freeze([]),
  entryId: null,
  environmentAssetId: "metaverse-hub-skiff-v1",
  label: "Harbor Skiff",
  lookLimitPolicyId: "passenger-bench",
  occupancyAnimationId: "standing",
  occupancyKind: "seat",
  occupantLabel: "Driver",
  occupantRole: "driver",
  seatId: "driver-seat",
  seatTargets: Object.freeze([])
});

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseWeaponPresentationRuntime stays hidden without an attachment proof", async () => {
  const { MetaverseWeaponPresentationRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-weapon-presentation-runtime.ts"
  );
  const runtime = new MetaverseWeaponPresentationRuntime(runtimeConfig);
  let updateCount = 0;

  runtime.subscribeUiUpdates(() => {
    updateCount += 1;
  });

  runtime.advance({
    deltaSeconds: 1,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: true
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.weaponId, null);
  assert.equal(runtime.weaponState, null);
  assert.equal(updateCount, 0);

  runtime.reset();

  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(runtime.weaponState, null);
  assert.equal(updateCount, 0);
});

test("MetaverseWeaponPresentationRuntime keeps loaded weapon proof unequipped when weapon id is null", async () => {
  const [{ MetaverseWeaponPresentationRuntime }, { metaverseAttachmentProofConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/classes/metaverse-weapon-presentation-runtime.ts"),
      clientLoader.load("/src/metaverse/world/proof/index.ts")
    ]);
  const runtime = new MetaverseWeaponPresentationRuntime(runtimeConfig, {
    attachmentProofConfig: metaverseAttachmentProofConfig,
    equippedWeaponId: null
  });
  let updateCount = 0;

  runtime.subscribeUiUpdates(() => {
    updateCount += 1;
  });

  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.weaponId, null);
  assert.equal(runtime.weaponState, null);

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: true
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.weaponId, null);
  assert.equal(runtime.weaponState, null);
  assert.equal(updateCount, 0);
});

test("MetaverseWeaponPresentationRuntime publishes hip-fire, ADS, and mounted suppression from the shipped weapon proof", async () => {
  const [{ MetaverseWeaponPresentationRuntime }, { metaverseAttachmentProofConfig }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/classes/metaverse-weapon-presentation-runtime.ts"),
      clientLoader.load("/src/metaverse/world/proof/index.ts")
    ]);
  const runtime = new MetaverseWeaponPresentationRuntime(runtimeConfig, {
    attachmentProofConfig: metaverseAttachmentProofConfig
  });
  let updateCount = 0;

  runtime.subscribeUiUpdates(() => {
    updateCount += 1;
  });

  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.weaponId, metaverseAttachmentProofConfig.attachmentId);
  assert.equal(runtime.weaponState, null);

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.fireTriggerHeld, true);
  assert.equal(runtime.firePressedThisFrame, true);
  assert.equal(runtime.hudSnapshot.visible, true);
  assert.equal(runtime.hudSnapshot.aimMode, "hip-fire");
  assert.equal(runtime.weaponState?.aimMode, "hip-fire");
  assert.equal(runtime.weaponState?.weaponId, metaverseAttachmentProofConfig.attachmentId);
  assert.equal(updateCount, 1);

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.firePressedThisFrame, false);
  assert.equal(updateCount, 1);

  runtime.advance({
    deltaSeconds: 10,
    flightInput: Object.freeze({
      primaryAction: false,
      secondaryAction: true
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, true);
  assert.equal(runtime.hudSnapshot.aimMode, "ads");
  assert.equal(runtime.weaponState?.aimMode, "ads");
  assert.ok(runtime.cameraFieldOfViewDegrees < 70);
  assert.equal(updateCount, 2);

  runtime.setCombatPresentationSuppressed(true);

  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.aimMode, "hip-fire");
  assert.equal(runtime.weaponState, null);
  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(updateCount, 3);

  runtime.advance({
    deltaSeconds: 10,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.weaponState, null);
  assert.equal(updateCount, 3);

  runtime.setCombatPresentationSuppressed(false);
  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.fireTriggerHeld, true);
  assert.equal(runtime.hudSnapshot.visible, true);
  assert.equal(runtime.hudSnapshot.aimMode, "hip-fire");
  assert.equal(runtime.weaponState?.aimMode, "hip-fire");
  assert.equal(updateCount, 4);

  runtime.advance({
    deltaSeconds: 10,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: true
    }),
    mountedEnvironment: mountedEnvironmentSnapshot
  });

  assert.equal(runtime.fireTriggerHeld, false);
  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.hudSnapshot.aimMode, "hip-fire");
  assert.equal(runtime.weaponState, null);
  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(updateCount, 5);

  runtime.reset();

  assert.equal(runtime.hudSnapshot.visible, false);
  assert.equal(runtime.weaponState, null);
  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(updateCount, 5);
});

test("MetaverseWeaponPresentationRuntime equips rocket launcher from plural attachment proofs", async () => {
  const [
    { MetaverseWeaponPresentationRuntime },
    { metaverseAttachmentProofConfigs }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-weapon-presentation-runtime.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts")
  ]);
  const runtime = new MetaverseWeaponPresentationRuntime(runtimeConfig, {
    attachmentProofConfigs: metaverseAttachmentProofConfigs,
    equippedWeaponId: "metaverse-rocket-launcher-v1",
    weaponLayoutId: "metaverse-tdm-pistol-rocket-layout"
  });

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false,
      weaponSwitchPressedCount: 0
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.fireTriggerHeld, true);
  assert.equal(runtime.firePressedThisFrame, true);
  assert.equal(runtime.hudSnapshot.visible, true);
  assert.equal(runtime.hudSnapshot.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(runtime.weaponState?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(runtime.weaponState?.activeSlotId, "secondary");
  assert.equal(runtime.weaponState?.slots.length, 2);
});

test("MetaverseWeaponPresentationRuntime toggles pistol and rocket slots and resets ADS", async () => {
  const [
    { MetaverseWeaponPresentationRuntime },
    { metaverseAttachmentProofConfigs }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-weapon-presentation-runtime.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts")
  ]);
  const runtime = new MetaverseWeaponPresentationRuntime(runtimeConfig, {
    attachmentProofConfigs: metaverseAttachmentProofConfigs,
    weaponLayoutId: "metaverse-tdm-pistol-rocket-layout"
  });

  runtime.advance({
    deltaSeconds: 10,
    flightInput: Object.freeze({
      primaryAction: false,
      secondaryAction: true,
      weaponSwitchPressedCount: 0
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.hudSnapshot.weaponId, "metaverse-service-pistol-v2");
  assert.equal(runtime.hudSnapshot.aimMode, "ads");
  assert.equal(runtime.weaponState?.activeSlotId, "primary");
  assert.equal(runtime.weaponState?.slots.length, 2);

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: true,
      secondaryAction: false,
      weaponSwitchPressedCount: 1
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.hudSnapshot.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(runtime.hudSnapshot.aimMode, "hip-fire");
  assert.equal(runtime.cameraFieldOfViewDegrees, 70);
  assert.equal(runtime.firePressedThisFrame, true);
  assert.equal(runtime.weaponState?.activeSlotId, "secondary");

  runtime.advance({
    deltaSeconds: 0.016,
    flightInput: Object.freeze({
      primaryAction: false,
      secondaryAction: false,
      weaponSwitchPressedCount: 1
    }),
    mountedEnvironment: null
  });

  assert.equal(runtime.hudSnapshot.weaponId, "metaverse-service-pistol-v2");
  assert.equal(runtime.weaponState?.activeSlotId, "primary");
});
