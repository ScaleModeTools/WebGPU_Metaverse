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

test("resolveShellNavigation routes completed shell progress into the main menu before gameplay starts", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-shooter",
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed",
    gameplayShell: "main-menu"
  });

  assert.deepEqual(snapshot, {
    activeStep: "main-menu",
    canAdvanceFromPermissions: true,
    canEnterGameplayShell: true,
    isUnsupportedRoute: false
  });
});

test("resolveShellNavigation enters gameplay only after an explicit start request", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-shooter",
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed",
    gameplayShell: "gameplay"
  });

  assert.equal(snapshot.activeStep, "gameplay");
  assert.equal(snapshot.canEnterGameplayShell, true);
});

test("resolveShellNavigation routes unsupported capability into the unsupported screen", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "camera-thumb-shooter",
    webcamPermission: "granted",
    gameplayCapability: "unsupported",
    calibrationShell: "reviewed",
    gameplayShell: "main-menu"
  });

  assert.equal(snapshot.activeStep, "unsupported");
  assert.equal(snapshot.isUnsupportedRoute, true);
});

test("resolveShellNavigation lets mouse mode skip webcam permission and calibration", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    inputMode: "mouse",
    webcamPermission: "prompt",
    gameplayCapability: "supported",
    calibrationShell: "pending",
    gameplayShell: "main-menu"
  });

  assert.equal(snapshot.activeStep, "main-menu");
  assert.equal(snapshot.canEnterGameplayShell, true);
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
