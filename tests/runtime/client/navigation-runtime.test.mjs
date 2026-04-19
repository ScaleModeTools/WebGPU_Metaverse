import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolveShellNavigation keeps completed setup in the pre-metaverse screen until entry is requested", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed",
    shellStage: "main-menu"
  });

  assert.deepEqual(snapshot, {
    activeStep: "main-menu",
    canAdvanceFromPermissions: true,
    canEnterMetaverse: true,
    isUnsupportedRoute: false,
    nextMetaverseStep: "metaverse"
  });
});

test("resolveShellNavigation keeps unconfirmed users on the main entry screen instead of a separate login route", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: false,
    inputMode: "mouse",
    webcamPermission: "prompt",
    gameplayCapability: "supported",
    calibrationShell: "pending",
    shellStage: "main-menu"
  });

  assert.equal(snapshot.activeStep, "main-menu");
  assert.equal(snapshot.canEnterMetaverse, true);
  assert.equal(snapshot.nextMetaverseStep, "metaverse");
});

test("resolveShellNavigation enters the metaverse only after an explicit hub request", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed",
    shellStage: "metaverse"
  });

  assert.equal(snapshot.activeStep, "metaverse");
  assert.equal(snapshot.canEnterMetaverse, true);
  assert.equal(snapshot.nextMetaverseStep, "metaverse");
});

test("resolveShellNavigation enters gameplay only when the metaverse prerequisites are already satisfied", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed",
    shellStage: "gameplay"
  });

  assert.equal(snapshot.activeStep, "gameplay");
  assert.equal(snapshot.canEnterMetaverse, true);
  assert.equal(snapshot.nextMetaverseStep, "metaverse");
});

test("resolveShellNavigation routes unsupported capability into the unsupported screen", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "granted",
    gameplayCapability: "unsupported",
    calibrationShell: "reviewed",
    shellStage: "main-menu"
  });

  assert.equal(snapshot.activeStep, "unsupported");
  assert.equal(snapshot.isUnsupportedRoute, true);
  assert.equal(snapshot.nextMetaverseStep, null);
});

test("resolveShellNavigation lets mouse mode skip webcam permission and calibration before metaverse entry", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "mouse",
    webcamPermission: "prompt",
    gameplayCapability: "supported",
    calibrationShell: "pending",
    shellStage: "main-menu"
  });

  assert.equal(snapshot.activeStep, "main-menu");
  assert.equal(snapshot.canEnterMetaverse, true);
  assert.equal(snapshot.nextMetaverseStep, "metaverse");
});

test("resolveShellNavigation keeps camera mode in setup until metaverse entry is requested", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "prompt",
    gameplayCapability: "supported",
    calibrationShell: "pending",
    shellStage: "main-menu"
  });

  assert.equal(snapshot.activeStep, "main-menu");
  assert.equal(snapshot.canEnterMetaverse, false);
  assert.equal(snapshot.nextMetaverseStep, "permissions");
});

test("resolveShellNavigation routes camera mode into permissions after metaverse entry is requested", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-trigger",
    webcamPermission: "prompt",
    gameplayCapability: "supported",
    calibrationShell: "pending",
    shellStage: "metaverse"
  });

  assert.equal(snapshot.activeStep, "permissions");
  assert.equal(snapshot.canEnterMetaverse, false);
  assert.equal(snapshot.nextMetaverseStep, "permissions");
});

test("WebcamPermissionGateway grants permission and stops returned tracks", async () => {
  const { WebcamPermissionGateway } = await clientLoader.load(
    "/src/navigation/adapters/webcam-permission-gateway.ts"
  );
  let stopCallCount = 0;
  const gateway = new WebcamPermissionGateway();

  const snapshot = await gateway.request({
    async getUserMedia() {
      return {
        getTracks() {
          return [
            {
              stop() {
                stopCallCount += 1;
              }
            }
          ];
        }
      };
    }
  });

  assert.equal(snapshot.state, "granted");
  assert.equal(snapshot.failureReason, null);
  assert.equal(stopCallCount, 1);
});

test("WebcamPermissionGateway reports denied permission failures explicitly", async () => {
  const { WebcamPermissionGateway } = await clientLoader.load(
    "/src/navigation/adapters/webcam-permission-gateway.ts"
  );
  const gateway = new WebcamPermissionGateway();

  const snapshot = await gateway.request({
    async getUserMedia() {
      throw new DOMException("denied", "NotAllowedError");
    }
  });

  assert.equal(snapshot.state, "denied");
  assert.match(snapshot.failureReason ?? "", /Camera permission was denied/);
});
