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

test("resolveShellNavigation routes completed shell progress into gameplay", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    webcamPermission: "granted",
    gameplayCapability: "supported",
    calibrationShell: "reviewed"
  });

  assert.deepEqual(snapshot, {
    activeStep: "gameplay",
    canAdvanceFromPermissions: true,
    canEnterGameplayShell: true,
    isUnsupportedRoute: false
  });
});

test("resolveShellNavigation routes unsupported capability into the unsupported screen", async () => {
  const { resolveShellNavigation } = await clientLoader.load(
    "/src/navigation/guards/resolve-shell-navigation.ts"
  );

  const snapshot = resolveShellNavigation({
    hasConfirmedProfile: true,
    webcamPermission: "granted",
    gameplayCapability: "unsupported",
    calibrationShell: "reviewed"
  });

  assert.equal(snapshot.activeStep, "unsupported");
  assert.equal(snapshot.isUnsupportedRoute, true);
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
