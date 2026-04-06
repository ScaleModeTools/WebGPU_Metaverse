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
    "/src/game/classes/hand-tracking-runtime.ts"
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
  assert.equal(runtime.snapshot.lifecycle, "idle");
});

test("HandTrackingRuntime keeps the newest validated pose snapshot and ignores stale worker frames", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/game/classes/hand-tracking-runtime.ts"
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
    pose: {
      thumbTip: { x: -1, y: 2 },
      indexTip: { x: 1.4, y: -0.5 }
    },
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

test("HandTrackingRuntime fails cleanly when webcam media devices are unavailable", async () => {
  const { HandTrackingRuntime } = await clientLoader.load(
    "/src/game/classes/hand-tracking-runtime.ts"
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
