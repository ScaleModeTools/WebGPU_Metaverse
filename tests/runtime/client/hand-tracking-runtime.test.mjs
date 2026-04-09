import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { runInNewContext } from "node:vm";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandPose } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

class FakeMediaStreamTrack {
  stopped = false;

  stop() {
    this.stopped = true;
  }
}

class FakeMediaStream {
  #tracks = [new FakeMediaStreamTrack(), new FakeMediaStreamTrack()];

  getTracks() {
    return this.#tracks;
  }
}

class FakeVideoElement {
  autoplay = false;
  muted = false;
  pauseCalled = false;
  playsInline = false;
  readyState = 2;
  srcObject = null;
  videoHeight = 720;
  videoWidth = 1280;

  async play() {}

  pause() {
    this.pauseCalled = true;
  }
}

class FakeWorker {
  listeners = new Set();
  messages = [];
  terminated = false;

  addEventListener(type, listener) {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type, listener) {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  dispatch(data) {
    for (const listener of this.listeners) {
      listener({ data });
    }
  }
}

class FakeVideoFrame {
  closed = false;
  source = null;
  timestamp = null;

  constructor(source, init = {}) {
    this.source = source;
    this.timestamp = init.timestamp ?? null;
  }

  close() {
    this.closed = true;
  }
}

async function waitForBootMessage(worker) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (worker.messages[0]?.kind === "boot") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test("HandTrackingRuntime boots the worker, pumps frames, and disposes owned resources", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const worker = new FakeWorker();
  const videoElement = new FakeVideoElement();
  const stream = new FakeMediaStream();
  let scheduledFrame = null;

  const runtime = new HandTrackingRuntime(undefined, {
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    createImageBitmap: async () => ({
      close() {}
    }),
    createVideoElement: () => videoElement,
    createWorker: () => worker,
    mediaDevices: {
      async getUserMedia() {
        return stream;
      }
    },
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  });

  const startPromise = runtime.ensureStarted();

  await waitForBootMessage(worker);

  assert.equal(worker.messages[0]?.kind, "boot");

  worker.dispatch({ kind: "ready" });

  const snapshot = await startPromise;

  assert.equal(snapshot.lifecycle, "ready");
  assert.equal(runtime.cameraStream, stream);
  assert.equal(typeof scheduledFrame, "function");

  scheduledFrame();
  await Promise.resolve();

  assert.equal(worker.messages.at(-1)?.kind, "process-frame");
  assert.equal(runtime.telemetrySnapshot.framesDispatched, 1);
  assert.equal(runtime.telemetrySnapshot.inFlightFrameSkips, 0);

  runtime.dispose();

  assert.equal(worker.terminated, true);
  assert.equal(videoElement.pauseCalled, true);
  assert.equal(stream.getTracks().every((track) => track.stopped), true);
  assert.equal(runtime.cameraStream, null);
  assert.equal(runtime.snapshot.lifecycle, "idle");
});

test("HandTrackingRuntime invokes browser frame scheduling through the bound global methods", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const worker = new FakeWorker();
  const stream = new FakeMediaStream();
  let scheduledFrame = null;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = function requestAnimationFrame(callback) {
    assert.equal(this, globalThis);
    scheduledFrame = callback;
    return 9;
  };
  globalThis.cancelAnimationFrame = function cancelAnimationFrame(frameHandle) {
    assert.equal(this, globalThis);
    assert.equal(frameHandle, 9);
  };

  try {
    const runtime = new HandTrackingRuntime(undefined, {
      createImageBitmap: async () => ({
        close() {}
      }),
      createVideoElement: () => new FakeVideoElement(),
      createWorker: () => worker,
      mediaDevices: {
        async getUserMedia() {
          return stream;
        }
      }
    });

    const startPromise = runtime.ensureStarted();

    await waitForBootMessage(worker);
    worker.dispatch({ kind: "ready" });
    await startPromise;

    assert.equal(typeof scheduledFrame, "function");

    runtime.dispose();
  } finally {
    if (originalRequestAnimationFrame === undefined) {
      delete globalThis.requestAnimationFrame;
    } else {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    if (originalCancelAnimationFrame === undefined) {
      delete globalThis.cancelAnimationFrame;
    } else {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  }
});

test("HandTrackingRuntime prefers VideoFrame transport when the browser supports it", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const worker = new FakeWorker();
  const videoElement = new FakeVideoElement();
  const stream = new FakeMediaStream();
  let scheduledFrame = null;
  const originalVideoFrame = globalThis.VideoFrame;

  globalThis.VideoFrame = FakeVideoFrame;

  try {
    const runtime = new HandTrackingRuntime(undefined, {
      cancelAnimationFrame() {
        scheduledFrame = null;
      },
      createImageBitmap: async () => {
        throw new Error("ImageBitmap fallback should not run when VideoFrame is available.");
      },
      createVideoElement: () => videoElement,
      createWorker: () => worker,
      mediaDevices: {
        async getUserMedia() {
          return stream;
        }
      },
      requestAnimationFrame(callback) {
        scheduledFrame = callback;
        return 1;
      }
    });

    const startPromise = runtime.ensureStarted();

    await waitForBootMessage(worker);
    worker.dispatch({ kind: "ready" });
    await startPromise;

    scheduledFrame();
    await Promise.resolve();

    assert.equal(worker.messages.at(-1)?.kind, "process-frame");
    assert.equal(worker.messages.at(-1)?.frame instanceof FakeVideoFrame, true);
    assert.equal(worker.messages.at(-1)?.frame.source, videoElement);
    assert.equal(typeof worker.messages.at(-1)?.frame.timestamp, "number");

    runtime.dispose();
  } finally {
    if (originalVideoFrame === undefined) {
      delete globalThis.VideoFrame;
    } else {
      globalThis.VideoFrame = originalVideoFrame;
    }
  }
});

test("HandTrackingRuntime keeps the newest validated pose snapshot and ignores stale worker frames", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const worker = new FakeWorker();

  const runtime = new HandTrackingRuntime(undefined, {
    cancelAnimationFrame() {},
    createImageBitmap: async () => ({
      close() {}
    }),
    createVideoElement: () => new FakeVideoElement(),
    createWorker: () => worker,
    mediaDevices: {
      async getUserMedia() {
        return new FakeMediaStream();
      }
    },
    requestAnimationFrame() {
      return 1;
    }
  });

  const startPromise = runtime.ensureStarted();

  await waitForBootMessage(worker);
  worker.dispatch({ kind: "ready" });
  await startPromise;

  worker.dispatch({
    kind: "snapshot",
    pose: createTrackedHandPose(1.4, -0.5, 0.6),
    sequenceNumber: 2,
    timestampMs: 10
  });

  assert.equal(runtime.latestPose.trackingState, "tracked");
  assert.equal(runtime.latestPose.sequenceNumber, 2);
  assert.equal(runtime.latestPose.pose.indexTip.x, 1);
  assert.equal(runtime.latestPose.pose.indexTip.y, 0);

  worker.dispatch({
    kind: "snapshot",
    pose: null,
    sequenceNumber: 1,
    timestampMs: 11
  });

  assert.equal(runtime.latestPose.trackingState, "tracked");
  assert.equal(runtime.latestPose.sequenceNumber, 2);

  worker.dispatch({
    kind: "snapshot",
    pose: null,
    sequenceNumber: 3,
    timestampMs: 12
  });

  assert.equal(runtime.latestPose.trackingState, "no-hand");
  assert.equal(runtime.latestPose.sequenceNumber, 3);
  assert.equal(runtime.telemetrySnapshot.framesProcessed, 2);
  assert.equal(runtime.telemetrySnapshot.staleSnapshotsIgnored, 1);
  assert.equal(runtime.telemetrySnapshot.latestSequenceNumber, 3);
  assert.equal(runtime.telemetrySnapshot.trackingState, "no-hand");
  assert.notEqual(runtime.telemetrySnapshot.workerLatencyMs, null);

  runtime.dispose();
});

test("HandTrackingRuntime surfaces worker boot failures without masking the reason", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const worker = new FakeWorker();

  const runtime = new HandTrackingRuntime(undefined, {
    cancelAnimationFrame() {},
    createImageBitmap: async () => ({
      close() {}
    }),
    createVideoElement: () => new FakeVideoElement(),
    createWorker: () => worker,
    mediaDevices: {
      async getUserMedia() {
        return new FakeMediaStream();
      }
    },
    requestAnimationFrame() {
      return 1;
    }
  });

  const startPromise = runtime.ensureStarted();

  await waitForBootMessage(worker);
  worker.dispatch({
    kind: "error",
    reason: "MediaPipe Hand Landmarker boot or inference failed: Failed to fetch hand_landmarker.task"
  });

  await assert.rejects(startPromise, /Failed to fetch hand_landmarker\.task/);
  assert.equal(runtime.snapshot.lifecycle, "failed");
  assert.match(runtime.snapshot.failureReason ?? "", /Failed to fetch/);

  runtime.dispose();
});

test("MediaPipe loader bridge preserves the classic custom_dbg fallback inside module workers", async () => {
  const { buildMediaPipeLoaderScript } = await clientLoader.load(
    "/src/tracking/workers/mediapipe-loader-bridge.ts"
  );
  const warningCalls = [];
  const workerScope = {
    console: {
      warn(...args) {
        warningCalls.push(args);
      }
    }
  };

  workerScope.globalThis = workerScope;
  workerScope.self = workerScope;

  runInNewContext(
    buildMediaPipeLoaderScript(
      `var ModuleFactory = (() => {
  return async function ModuleFactory() {
    function UTF8ToString(value) {
      return value;
    }

    function custom_emscripten_dbgn(str, len) {
      if (typeof (dbg) !== "undefined") {
        dbg(UTF8ToString(str, len));
      } else {
        if (typeof (custom_dbg) === "undefined") {
          function custom_dbg(text) {
            console.warn.apply(console, arguments);
          }
        }

        custom_dbg(UTF8ToString(str, len));
      }
    }

    custom_emscripten_dbgn("bridge ok", 9);
    return "ready";
  };
})();`,
      "https://example.com/vision_wasm_internal.js"
    ),
    workerScope
  );

  assert.equal(typeof workerScope.ModuleFactory, "function");
  assert.equal(await workerScope.ModuleFactory(), "ready");
  assert.deepEqual(warningCalls, [["bridge ok"]]);
});

test("HandTrackingRuntime fails cleanly when webcam media devices are unavailable", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/tracking/classes/hand-tracking-runtime.ts"
  );
  const runtime = new HandTrackingRuntime(undefined, {
    cancelAnimationFrame() {},
    createImageBitmap: async () => ({
      close() {}
    }),
    createVideoElement: () => new FakeVideoElement(),
    createWorker: () => new FakeWorker(),
    mediaDevices: null,
    requestAnimationFrame() {
      return 1;
    }
  });

  await assert.rejects(
    runtime.ensureStarted(),
    /Webcam mediaDevices\.getUserMedia is unavailable/
  );
  assert.equal(runtime.snapshot.lifecycle, "failed");
  runtime.dispose();
});
