import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandPose } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

class FakeRenderer {
  disposed = false;
  initCalls = 0;
  pixelRatio = null;
  renderCalls = 0;
  sizes = [];

  async init() {
    this.initCalls += 1;
  }

  render() {
    this.renderCalls += 1;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = pixelRatio;
  }

  setSize(width, height) {
    this.sizes.push([width, height]);
  }

  dispose() {
    this.disposed = true;
  }
}

class DeferredRenderer extends FakeRenderer {
  constructor() {
    super();
    this.initPromise = new Promise((resolve) => {
      this.resolveInit = resolve;
    });
  }

  async init() {
    this.initCalls += 1;
    await this.initPromise;
  }
}

function createArenaConfig() {
  return {
    arenaBounds: {
      minX: 0.05,
      maxX: 0.95,
      minY: 0.05,
      maxY: 0.95
    },
    enemySeeds: [
      {
        id: "bird-1",
        label: "Bird 1",
        spawn: { x: 0.25, y: 0.4 },
        glideVelocity: { x: 0, y: 0 },
        radius: 0.08,
        scale: 1,
        wingSpeed: 6
      }
    ],
    feedback: {
      holdDurationMs: 280
    },
    movement: {
      maxStepMs: 64,
      scatterDurationMs: 280,
      scatterSpeed: 0.22,
      downedDurationMs: 520,
      downedDriftVelocityY: 0.18
    },
    session: {
      roundDurationMs: 4_000,
      scorePerKill: 100
    },
    targeting: {
      acquireRadius: 0.1,
      hitRadius: 0.1,
      reticleScatterRadius: 0.14,
      shotScatterRadius: 0.2
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      displayName: "Semiautomatic pistol",
      triggerMode: "single",
      triggerGesture: {
        pressAxisAngleDegrees: 26,
        pressEngagementRatio: 0.72,
        releaseAxisAngleDegrees: 32,
        releaseEngagementRatio: 0.92,
        calibration: {
          pressAxisWindowFraction: 0.4,
          pressEngagementWindowFraction: 0.4,
          releaseAxisWindowFraction: 0.82,
          releaseEngagementWindowFraction: 0.82
        }
      },
      cadence: {
        shotIntervalMs: 220
      },
      reload: {
        clipCapacity: 6,
        durationMs: 240,
        rule: "reticle-offscreen"
      },
      spread: {
        baseRadius: 0,
        maxRadius: 0.02,
        sprayGrowthPerShot: 0.0025,
        sprayRecoveryPerSecond: 6
      }
    }
  };
}

test("WebGpuGameplayRuntime rejects unsupported navigators explicitly", async () => {
  const { LocalArenaSimulation, WebGpuGameplayRuntime } = await clientLoader.load(
    "/src/game/index.ts"
  );
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  const runtime = new WebGpuGameplayRuntime(
    {
      latestPose: {
        trackingState: "unavailable",
        sequenceNumber: 0,
        timestampMs: null,
        pose: null
      }
    },
    arenaSimulation,
    undefined,
    {
      cancelAnimationFrame() {},
      createRenderer: () => new FakeRenderer(),
      devicePixelRatio: 1,
      requestAnimationFrame() {
        return 1;
      }
    }
  );

  await assert.rejects(
    runtime.start({ clientHeight: 720, clientWidth: 1280 }, {}),
    /WebGPU is unavailable/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("WebGpuGameplayRuntime renders the calibrated reticle from live tracking snapshots", async () => {
  const {
    LocalArenaSimulation,
    WebGpuGameplayRuntime,
    readObservedAimPoint
  } = await clientLoader.load("/src/game/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/game/config/hand-aim-observation.ts"
  );
  const trackingSource = {
    latestPose: {
      trackingState: "tracked",
      sequenceNumber: 1,
      timestampMs: 10,
      pose: createTrackedHandPose(0.25, 0.4, 0)
    }
  };
  const expectedObservedAimPoint = readObservedAimPoint(
    trackingSource.latestPose.pose,
    handAimObservationConfig
  );
  const renderer = new FakeRenderer();
  let scheduledFrame = null;
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  const runtime = new WebGpuGameplayRuntime(
    trackingSource,
    arenaSimulation,
    undefined,
    {
      cancelAnimationFrame() {
        scheduledFrame = null;
      },
      createRenderer: () => renderer,
      devicePixelRatio: 1.5,
      requestAnimationFrame(callback) {
        scheduledFrame = callback;
        return 1;
      }
    }
  );

  const startSnapshot = await runtime.start(
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    {
      gpu: {}
    }
  );

  assert.equal(startSnapshot.lifecycle, "running");
  assert.equal(typeof scheduledFrame, "function");

  scheduledFrame();

  assert.equal(renderer.initCalls, 1);
  assert.equal(renderer.renderCalls, 1);
  assert.equal(renderer.pixelRatio, 1.5);
  assert.deepEqual(renderer.sizes.at(-1), [1280, 720]);
  assert.equal(runtime.hudSnapshot.trackingState, "tracked");
  assert.equal(runtime.hudSnapshot.targetFeedback.state, "targeted");
  assert.deepEqual(runtime.hudSnapshot.aimPoint, expectedObservedAimPoint);
  assert.equal(runtime.telemetrySnapshot.reticleVisualState, "targeted");
  assert.deepEqual(runtime.telemetrySnapshot.observedAimPoint, expectedObservedAimPoint);
  assert.equal(runtime.telemetrySnapshot.trackingSequenceNumber, 1);

  trackingSource.latestPose = {
    trackingState: "tracked",
    sequenceNumber: 2,
    timestampMs: 20,
    pose: createTrackedHandPose(0.25, 0.4, 1)
  };

  scheduledFrame();

  assert.equal(runtime.hudSnapshot.session.phase, "completed");
  assert.equal(runtime.hudSnapshot.session.score, 100);
  assert.equal(runtime.hudSnapshot.weapon.reload.clipRoundsRemaining, 5);
  assert.equal(runtime.telemetrySnapshot.reticleVisualState, "hit");
  assert.equal(runtime.telemetrySnapshot.targetFeedbackState, "hit");
  assert.equal(runtime.telemetrySnapshot.trackingSequenceNumber, 2);

  const restartSnapshot = runtime.restartSession(500);

  assert.equal(restartSnapshot.lifecycle, "running");
  assert.equal(restartSnapshot.session.phase, "active");
  assert.equal(restartSnapshot.session.score, 0);
  assert.equal(restartSnapshot.arena.liveEnemyCount, 1);
  assert.equal(runtime.telemetrySnapshot.renderedFrameCount >= 2, true);

  trackingSource.latestPose = {
    trackingState: "no-hand",
    sequenceNumber: 3,
    timestampMs: 30,
    pose: null
  };

  scheduledFrame();

  assert.equal(runtime.hudSnapshot.trackingState, "no-hand");
  assert.equal(runtime.hudSnapshot.aimPoint, null);
  assert.equal(runtime.telemetrySnapshot.reticleVisualState, "tracking-unavailable");

  runtime.dispose();

  assert.equal(renderer.disposed, true);
  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
});

test("WebGpuGameplayRuntime ignores stale async boots after disposal", async () => {
  const { LocalArenaSimulation, WebGpuGameplayRuntime } = await clientLoader.load(
    "/src/game/index.ts"
  );
  const renderer = new DeferredRenderer();
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  const runtime = new WebGpuGameplayRuntime(
    {
      latestPose: {
        trackingState: "unavailable",
        sequenceNumber: 0,
        timestampMs: null,
        pose: null
      }
    },
    arenaSimulation,
    undefined,
    {
      cancelAnimationFrame() {},
      createRenderer: () => renderer,
      devicePixelRatio: 1,
      requestAnimationFrame() {
        return 1;
      }
    }
  );

  const startPromise = runtime.start(
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    {
      gpu: {}
    }
  );

  runtime.dispose();
  renderer.resolveInit();

  const snapshot = await startPromise;

  assert.equal(renderer.disposed, true);
  assert.equal(snapshot.lifecycle, "idle");
  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
  assert.equal(runtime.telemetrySnapshot.renderedFrameCount, 0);
});

test("WebGpuGameplayRuntime binds browser frame APIs before scheduling gameplay", async () => {
  const { LocalArenaSimulation, WebGpuGameplayRuntime } = await clientLoader.load(
    "/src/game/index.ts"
  );
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  const renderer = new FakeRenderer();
  const originalWindow = globalThis.window;
  let cancelledFrameHandle = null;
  let scheduledFrame = null;
  const fakeWindow = {
    devicePixelRatio: 2,
    requestAnimationFrame(callback) {
      if (this !== fakeWindow) {
        throw new TypeError("Illegal invocation");
      }

      scheduledFrame = callback;
      return 7;
    },
    cancelAnimationFrame(frameHandle) {
      if (this !== fakeWindow) {
        throw new TypeError("Illegal invocation");
      }

      cancelledFrameHandle = frameHandle;
    }
  };

  globalThis.window = fakeWindow;

  try {
    const runtime = new WebGpuGameplayRuntime(
      {
        latestPose: {
          trackingState: "unavailable",
          sequenceNumber: 0,
          timestampMs: null,
          pose: null
        }
      },
      arenaSimulation,
      undefined,
      {
        createRenderer: () => renderer
      }
    );

    const snapshot = await runtime.start(
      {
        clientHeight: 720,
        clientWidth: 1280
      },
      {
        gpu: {}
      }
    );

    assert.equal(snapshot.lifecycle, "running");
    assert.equal(typeof scheduledFrame, "function");

    runtime.dispose();

    assert.equal(cancelledFrameHandle, 7);
  } finally {
    globalThis.window = originalWindow;
  }
});
