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
  info = {
    render: {
      calls: 0,
      drawCalls: 0,
      triangles: 0
    }
  };
  initCalls = 0;
  pixelRatio = null;
  renderCalls = 0;
  sizes = [];

  async init() {
    this.initCalls += 1;
  }

  render() {
    this.renderCalls += 1;
    this.info.render.calls = 60;
    this.info.render.drawCalls = 6;
    this.info.render.triangles = 24;
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

class ThrowingRenderer extends FakeRenderer {
  render() {
    super.render();
    throw new Error("render boom");
  }
}

function createArenaConfig() {
  return {
    birdAltitudeBounds: {
      min: 0.5,
      max: 6
    },
    camera: {
      initialPitchRadians: 0,
      initialYawRadians: 0,
      lookBounds: {
        maxPitchRadians: 1.2,
        minPitchRadians: -0.18
      },
      lookMotion: {
        deadZoneViewportFraction: 0.22,
        maxSpeedRadiansPerSecond: 1.6,
        responseExponent: 1.55
      },
      position: {
        x: 0,
        y: 1.35,
        z: 0
      }
    },
    enemySeeds: [
      {
        id: "bird-1",
        label: "Bird 1",
        orbitRadius: 18,
        spawn: {
          altitude: 1.35,
          azimuthRadians: 0
        },
        glideVelocity: {
          altitudeUnitsPerSecond: 0,
          azimuthRadiansPerSecond: 0
        },
        radius: 0.9,
        scale: 1,
        wingSpeed: 6
      }
    ],
    feedback: {
      holdDurationMs: 280
    },
    movement: {
      maxStepMs: 64,
      downedDriftSpeed: 1.6,
      scatterDurationMs: 280,
      downedDurationMs: 520,
      downedFallSpeed: 4.6,
      scatterAltitudeSpeed: 1.8,
      scatterAngularSpeed: 0.5
    },
    session: {
      durationLossPerRoundMs: 500,
      minimumRoundDurationMs: 2_000,
      roundDurationMs: 4_000,
      scorePerKill: 100
    },
    targeting: {
      acquireRadius: 0.6,
      hitRadius: 0.42,
      reticleScatterRadius: 3.2,
      shotScatterRadius: 3.6
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      displayName: "Semiautomatic pistol",
      triggerMode: "single",
      triggerGesture: {
        pressAxisAngleDegrees: 68,
        pressEngagementRatio: 0.72,
        releaseAxisAngleDegrees: 72,
        releaseEngagementRatio: 0.95,
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
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
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
    readObservedAimPoint
  } = await clientLoader.load("/src/game/index.ts");
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/game/config/hand-aim-observation.ts"
  );
  const trackingSource = {
    latestPose: {
      trackingState: "tracked",
      sequenceNumber: 1,
      timestampMs: 10,
      pose: createTrackedHandPose(0.5, 0.5, 0)
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
  assert.equal(runtime.telemetrySnapshot.renderer.label, "WebGPU");
  assert.equal(runtime.telemetrySnapshot.renderer.devicePixelRatio, 1.5);
  assert.equal(runtime.telemetrySnapshot.renderer.drawCallCount, 6);
  assert.equal(runtime.telemetrySnapshot.renderer.triangleCount, 24);
  assert.equal(runtime.telemetrySnapshot.trackingSequenceNumber, 1);

  trackingSource.latestPose = {
    trackingState: "tracked",
    sequenceNumber: 2,
    timestampMs: 20,
    pose: createTrackedHandPose(0.5, 0.5, 1)
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
  assert.equal(restartSnapshot.session.roundNumber, 2);
  assert.equal(restartSnapshot.session.score, 100);
  assert.equal(restartSnapshot.session.roundDurationMs, 3_500);
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

test("WebGpuGameplayRuntime publishes throttled UI updates for shell observers", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const trackingSource = {
    latestPose: {
      trackingState: "tracked",
      sequenceNumber: 1,
      timestampMs: 10,
      pose: createTrackedHandPose(0.5, 0.5, 0)
    }
  };
  const renderer = new FakeRenderer();
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  let nowMs = 1_000;
  let scheduledFrame = null;
  const lifecycleUpdates = [];
  const runtime = new WebGpuGameplayRuntime(
    trackingSource,
    arenaSimulation,
    undefined,
    {
      cancelAnimationFrame() {},
      createRenderer: () => renderer,
      devicePixelRatio: 1,
      readNowMs: () => nowMs,
      requestAnimationFrame(callback) {
        scheduledFrame = callback;
        return 1;
      }
    }
  );
  const unsubscribe = runtime.subscribeUiUpdates(() => {
    lifecycleUpdates.push(runtime.hudSnapshot.lifecycle);
  });

  await runtime.start(
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    {
      gpu: {}
    }
  );

  assert.deepEqual(lifecycleUpdates, ["booting", "running"]);
  assert.equal(typeof scheduledFrame, "function");

  nowMs = 1_050;
  scheduledFrame();
  assert.deepEqual(lifecycleUpdates, ["booting", "running"]);

  nowMs = 1_160;
  scheduledFrame();
  assert.deepEqual(lifecycleUpdates, ["booting", "running", "running"]);

  runtime.restartSession(1_165);
  assert.deepEqual(lifecycleUpdates, ["booting", "running", "running", "running"]);

  runtime.dispose();
  assert.deepEqual(lifecycleUpdates, ["booting", "running", "running", "running", "idle"]);

  unsubscribe();
});

test("WebGpuGameplayRuntime publishes reticle updates on every frame", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const trackingSource = {
    latestPose: {
      trackingState: "tracked",
      sequenceNumber: 1,
      timestampMs: 10,
      pose: createTrackedHandPose(0.5, 0.5, 0)
    }
  };
  const renderer = new FakeRenderer();
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  let nowMs = 1_000;
  let scheduledFrame = null;
  const reticleUpdates = [];
  const runtime = new WebGpuGameplayRuntime(
    trackingSource,
    arenaSimulation,
    undefined,
    {
      cancelAnimationFrame() {},
      createRenderer: () => renderer,
      devicePixelRatio: 1,
      readNowMs: () => nowMs,
      requestAnimationFrame(callback) {
        scheduledFrame = callback;
        return 1;
      }
    }
  );
  const unsubscribe = runtime.subscribeReticleUpdates((aimPoint, visualState) => {
    reticleUpdates.push({ aimPoint, visualState });
  });

  await runtime.start(
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    {
      gpu: {}
    }
  );

  assert.equal(reticleUpdates.length, 2);
  assert.equal(reticleUpdates[0].visualState, "hidden");
  assert.notEqual(reticleUpdates[1].aimPoint, null);
  assert.equal(reticleUpdates[1].visualState, "targeted");

  nowMs = 1_050;
  scheduledFrame();
  nowMs = 1_060;
  scheduledFrame();

  assert.equal(reticleUpdates.length, 4);
  assert.equal(reticleUpdates.at(-1)?.visualState, "targeted");

  runtime.dispose();

  assert.equal(reticleUpdates.at(-1)?.visualState, "hidden");

  unsubscribe();
});

test("WebGpuGameplayRuntime ignores stale async boots after disposal", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
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

test("WebGpuGameplayRuntime serializes overlapping start requests", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const firstRenderer = new DeferredRenderer();
  const secondRenderer = new FakeRenderer();
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  const createdRenderers = [];
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
      createRenderer: () => {
        const renderer =
          createdRenderers.length === 0 ? firstRenderer : secondRenderer;

        createdRenderers.push(renderer);
        return renderer;
      },
      devicePixelRatio: 1,
      requestAnimationFrame() {
        return 1;
      }
    }
  );

  const canvasHost = {
    clientHeight: 720,
    clientWidth: 1280
  };
  const firstStartPromise = runtime.start(canvasHost, {
    gpu: {}
  });
  const secondStartPromise = runtime.start(canvasHost, {
    gpu: {}
  });

  await Promise.resolve();

  assert.equal(createdRenderers.length, 1);

  firstRenderer.resolveInit();

  const [firstSnapshot, secondSnapshot] = await Promise.all([
    firstStartPromise,
    secondStartPromise
  ]);

  assert.equal(firstSnapshot.lifecycle, "idle");
  assert.equal(secondSnapshot.lifecycle, "running");
  assert.equal(createdRenderers.length, 2);
  assert.equal(firstRenderer.disposed, true);
  assert.equal(secondRenderer.initCalls, 1);
});

test("WebGpuGameplayRuntime serializes overlapping start requests across runtime instances", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const firstRenderer = new DeferredRenderer();
  const secondRenderer = new FakeRenderer();
  const createdRenderers = [];
  const createRenderer = () => {
    const renderer = createdRenderers.length === 0 ? firstRenderer : secondRenderer;

    createdRenderers.push(renderer);
    return renderer;
  };
  const createRuntime = () =>
    new WebGpuGameplayRuntime(
      {
        latestPose: {
          trackingState: "unavailable",
          sequenceNumber: 0,
          timestampMs: null,
          pose: null
        }
      },
      new LocalArenaSimulation(
        {
          xCoefficients: [1, 0, 0],
          yCoefficients: [0, 1, 0]
        },
        createArenaConfig()
      ),
      undefined,
      {
        cancelAnimationFrame() {},
        createRenderer,
        devicePixelRatio: 1,
        requestAnimationFrame() {
          return 1;
        }
      }
    );

  const firstRuntime = createRuntime();
  const secondRuntime = createRuntime();
  const canvasHost = {
    clientHeight: 720,
    clientWidth: 1280
  };
  const firstStartPromise = firstRuntime.start(canvasHost, {
    gpu: {}
  });
  const secondStartPromise = secondRuntime.start(canvasHost, {
    gpu: {}
  });

  await Promise.resolve();

  assert.equal(createdRenderers.length, 1);

  firstRuntime.dispose();
  firstRenderer.resolveInit();

  const [firstSnapshot, secondSnapshot] = await Promise.all([
    firstStartPromise,
    secondStartPromise
  ]);

  assert.equal(firstSnapshot.lifecycle, "idle");
  assert.equal(secondSnapshot.lifecycle, "running");
  assert.equal(createdRenderers.length, 2);
  assert.equal(firstRenderer.disposed, true);
  assert.equal(secondRenderer.initCalls, 1);
});

test("WebGpuGameplayRuntime binds browser frame APIs before scheduling gameplay", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
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

test("WebGpuGameplayRuntime surfaces render-loop failures as runtime failures", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWebGpuGameplayRuntime: WebGpuGameplayRuntime
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const renderer = new ThrowingRenderer();
  const arenaSimulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  let scheduledFrame = null;
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
      requestAnimationFrame(callback) {
        scheduledFrame = callback;
        return 1;
      }
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

  scheduledFrame();

  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
  assert.match(runtime.hudSnapshot.failureReason ?? "", /render boom/);
  assert.equal(renderer.disposed, true);
});
