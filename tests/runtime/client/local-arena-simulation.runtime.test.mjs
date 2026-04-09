import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createHandTriggerCalibrationSnapshot } from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";
import { createTrackedHandSnapshot } from "./tracked-hand-pose-fixture.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

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

test("LocalArenaSimulation publishes calibrated aim, arena counts, and early scatter state", async () => {
  const { readObservedAimPoint } = await clientLoader.load("/src/tracking/index.ts");
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const { handAimObservationConfig } = await clientLoader.load(
    "/src/tracking/config/hand-aim-observation.ts"
  );
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );
  const trackingSnapshot = createTrackedHandSnapshot(1, 0.5, 0.5);

  const snapshot = simulation.advance(trackingSnapshot, 0);

  assert.deepEqual(
    snapshot.aimPoint,
    readObservedAimPoint(trackingSnapshot.pose, handAimObservationConfig)
  );
  assert.equal(snapshot.arena.liveEnemyCount, 1);
  assert.equal(snapshot.session.phase, "active");
  assert.equal(snapshot.targetFeedback.state, "targeted");
  assert.equal(snapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.equal(snapshot.weapon.reload.clipRoundsRemaining, 6);
  assert.equal(snapshot.weapon.readiness, "ready");
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "scatter");
});

test("LocalArenaSimulation completes the round and restartSession advances to a harder round", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const emittedSignals = [];
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig(),
    {
      emitGameplaySignal(signal) {
        emittedSignals.push(signal);
      }
    }
  );

  simulation.advance(createTrackedHandSnapshot(1, 0.5, 0.5), 0);

  const firedSnapshot = simulation.advance(
    createTrackedHandSnapshot(2, 0.5, 0.5, 1),
    16
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedSnapshot.weapon.hitsLanded, 1);
  assert.equal(firedSnapshot.weapon.reload.clipRoundsRemaining, 5);
  assert.equal(firedSnapshot.session.score, 100);
  assert.equal(firedSnapshot.session.killsThisSession, 1);
  assert.equal(firedSnapshot.session.streak, 1);
  assert.equal(firedSnapshot.session.phase, "completed");
  assert.equal(firedSnapshot.session.roundNumber, 1);
  assert.equal(firedSnapshot.session.restartReady, true);
  assert.equal(firedSnapshot.targetFeedback.state, "hit");
  assert.equal(firedSnapshot.targetFeedback.enemyLabel, "Bird 1");
  assert.deepEqual(emittedSignals, [
    {
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    },
    {
      enemyId: "bird-1",
      type: "enemy-hit-confirmed"
    }
  ]);
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");

  const postCompletionSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.5, 0.5, 1),
    1_200
  );

  assert.equal(postCompletionSnapshot.weapon.shotsFired, 1);
  assert.equal(simulation.enemyRenderStates[0]?.behavior, "downed");

  simulation.restartSession();

  const resetSnapshot = simulation.hudSnapshot;

  assert.equal(resetSnapshot.session.phase, "active");
  assert.equal(resetSnapshot.session.roundNumber, 2);
  assert.equal(resetSnapshot.session.score, 100);
  assert.equal(resetSnapshot.session.killsThisSession, 0);
  assert.equal(resetSnapshot.session.roundDurationMs, 3_500);
  assert.equal(resetSnapshot.session.roundTimeRemainingMs, 3_500);
  assert.equal(resetSnapshot.arena.liveEnemyCount, 1);
  assert.equal(resetSnapshot.weapon.triggerHeld, false);
  assert.equal(resetSnapshot.weapon.hitsLanded, 0);
  assert.equal(resetSnapshot.weapon.reload.clipRoundsRemaining, 6);
});

test("LocalArenaSimulation applies trigger calibration before a shot becomes valid", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig(),
    {
      triggerCalibration: createHandTriggerCalibrationSnapshot({
        sampleCount: 9,
        pressedAxisAngleDegreesMax: 30,
        pressedEngagementRatioMax: 0.31,
        readyAxisAngleDegreesMin: 55,
        readyEngagementRatioMin: 0.75
      })
    }
  );

  simulation.advance(createTrackedHandSnapshot(1, 0.5, 0.5), 0);

  const borderlineSnapshot = simulation.advance(
    createTrackedHandSnapshot(2, 0.5, 0.5, 0.75),
    16
  );

  assert.equal(borderlineSnapshot.weapon.shotsFired, 0);
  assert.equal(borderlineSnapshot.session.score, 0);

  simulation.advance(createTrackedHandSnapshot(3, 0.5, 0.5), 40);

  const firedSnapshot = simulation.advance(
    createTrackedHandSnapshot(4, 0.5, 0.5, 1),
    64
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedSnapshot.session.score, 100);
});

test("LocalArenaSimulation requires a ready state before a tracked press can fire", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  const reacquiredPressedSnapshot = simulation.advance(
    createTrackedHandSnapshot(1, 0.5, 0.5, 1),
    0
  );

  assert.equal(reacquiredPressedSnapshot.weapon.shotsFired, 0);
  assert.equal(reacquiredPressedSnapshot.session.score, 0);

  simulation.advance(createTrackedHandSnapshot(2, 0.5, 0.5), 16);

  const firedSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.5, 0.5, 1),
    32
  );

  assert.equal(firedSnapshot.weapon.shotsFired, 1);
  assert.equal(firedSnapshot.session.score, 100);
});

test("LocalArenaSimulation exposes reload state and completes off-screen reloads", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const emittedSignals = [];
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    {
      ...createArenaConfig(),
      weapon: {
        ...createArenaConfig().weapon,
        reload: {
          ...createArenaConfig().weapon.reload,
          clipCapacity: 1,
          durationMs: 180
        }
      }
    },
    {
      emitGameplaySignal(signal) {
        emittedSignals.push(signal);
      }
    }
  );

  simulation.advance(createTrackedHandSnapshot(1, 0.8, 0.8), 0);

  const emptyClipSnapshot = simulation.advance(
    createTrackedHandSnapshot(2, 0.8, 0.8, 1),
    16
  );

  assert.equal(emptyClipSnapshot.targetFeedback.state, "miss");
  assert.equal(emptyClipSnapshot.weapon.reload.clipRoundsRemaining, 0);
  assert.equal(emptyClipSnapshot.weapon.reload.requiresReload, true);
  assert.equal(emptyClipSnapshot.weapon.reload.state, "blocked");
  assert.equal(emptyClipSnapshot.weapon.readiness, "reload-required");

  const reloadingSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 1.15, 0.4),
    200
  );

  assert.equal(reloadingSnapshot.aimPoint, null);
  assert.equal(reloadingSnapshot.targetFeedback.state, "miss");
  assert.equal(reloadingSnapshot.weapon.reload.state, "reloading");
  assert.equal(reloadingSnapshot.weapon.reload.isReloadReady, true);
  assert.equal(reloadingSnapshot.weapon.readiness, "reloading");

  const offscreenSnapshot = simulation.advance(
    createTrackedHandSnapshot(4, 1.15, 0.4),
    320
  );

  assert.equal(offscreenSnapshot.targetFeedback.state, "offscreen");

  const reloadedSnapshot = simulation.advance(
    createTrackedHandSnapshot(5, 1.15, 0.4),
    400
  );

  assert.equal(reloadedSnapshot.weapon.reload.clipRoundsRemaining, 1);
  assert.equal(reloadedSnapshot.weapon.reload.requiresReload, false);
  assert.equal(reloadedSnapshot.weapon.reload.state, "full");
  assert.deepEqual(emittedSignals, [
    {
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    },
    {
      type: "weapon-reloaded",
      weaponId: "semiautomatic-pistol"
    }
  ]);
});

test("LocalArenaSimulation turns the camera when the reticle rides the screen edge dead zone", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  simulation.advance(
    createTrackedHandSnapshot(1, 0.92, 0.5),
    0,
    { width: 1280, height: 720 }
  );
  simulation.advance(
    createTrackedHandSnapshot(2, 0.92, 0.5),
    32,
    { width: 1280, height: 720 }
  );
  simulation.advance(
    createTrackedHandSnapshot(3, 0.92, 0.5),
    64,
    { width: 1280, height: 720 }
  );

  assert.ok(simulation.cameraSnapshot.yawRadians > 0.02);
  assert.ok(Math.abs(simulation.cameraSnapshot.pitchRadians) < 0.01);
});

test("LocalArenaSimulation keeps the camera fixed after the round is no longer active", async () => {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const simulation = new LocalArenaSimulation(
    {
      xCoefficients: [1, 0, 0],
      yCoefficients: [0, 1, 0]
    },
    createArenaConfig()
  );

  simulation.advance(
    createTrackedHandSnapshot(1, 0.5, 0.5),
    0,
    { width: 1280, height: 720 }
  );
  simulation.advance(
    createTrackedHandSnapshot(2, 0.5, 0.5, 1),
    16,
    { width: 1280, height: 720 }
  );

  assert.equal(simulation.hudSnapshot.session.phase, "completed");

  const yawBeforeInactiveAdvance = simulation.cameraSnapshot.yawRadians;
  const pitchBeforeInactiveAdvance = simulation.cameraSnapshot.pitchRadians;

  const inactiveSnapshot = simulation.advance(
    createTrackedHandSnapshot(3, 0.92, 0.12),
    64,
    { width: 1280, height: 720 }
  );

  assert.equal(inactiveSnapshot.session.phase, "completed");
  assert.equal(simulation.cameraSnapshot.yawRadians, yawBeforeInactiveAdvance);
  assert.equal(simulation.cameraSnapshot.pitchRadians, pitchBeforeInactiveAdvance);
});
