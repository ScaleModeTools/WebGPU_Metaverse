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

test("shouldSuppressMediaPipeConsoleMessage matches known MediaPipe worker chatter", async () => {
  const { shouldSuppressMediaPipeConsoleMessage } = await clientLoader.load(
    "/src/tracking/workers/mediapipe-console-filter.ts"
  );

  assert.equal(
    shouldSuppressMediaPipeConsoleMessage([
      "W0408 13:40:25.943000 landmark_projection_calculator.cc:81]",
      "Using NORM_RECT without IMAGE_DIMENSIONS is only supported for the square ROI. Provide IMAGE_DIMENSIONS or use PROJECTION_MATRIX."
    ]),
    true
  );
  assert.equal(
    shouldSuppressMediaPipeConsoleMessage([
      "I0408 13:40:25.728000 gl_context.cc:407]",
      "GL version:",
      "3.0"
    ]),
    true
  );
  assert.equal(
    shouldSuppressMediaPipeConsoleMessage(["WebGPU Metaverse runtime ready"]),
    false
  );
});

test("installMediaPipeConsoleFilter drops only known MediaPipe noise", async () => {
  const { installMediaPipeConsoleFilter } = await clientLoader.load(
    "/src/tracking/workers/mediapipe-console-filter.ts"
  );
  const observedMessages = [];
  const fakeConsole = {
    info(...args) {
      observedMessages.push(["info", ...args]);
    },
    log(...args) {
      observedMessages.push(["log", ...args]);
    },
    warn(...args) {
      observedMessages.push(["warn", ...args]);
    }
  };

  installMediaPipeConsoleFilter(fakeConsole);

  fakeConsole.info("Graph successfully started running.");
  fakeConsole.warn(
    "W0408 13:40:25.785999 inference_feedback_manager.cc:121]",
    "Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors."
  );
  fakeConsole.warn("WebGPU Metaverse gameplay warning");
  fakeConsole.log("Tracking worker ready");

  assert.deepEqual(observedMessages, [
    ["warn", "WebGPU Metaverse gameplay warning"],
    ["log", "Tracking worker ready"]
  ]);
});
