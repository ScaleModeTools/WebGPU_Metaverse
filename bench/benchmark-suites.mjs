function interpolateScalar(startValue, endValue, amount) {
  return startValue + (endValue - startValue) * amount;
}

function interpolatePoint(openPoint, pressedPoint, triggerCurl) {
  return {
    x: interpolateScalar(openPoint.x, pressedPoint.x, triggerCurl),
    y: interpolateScalar(openPoint.y, pressedPoint.y, triggerCurl),
    z: interpolateScalar(openPoint.z, pressedPoint.z, triggerCurl)
  };
}

function createTrackedPose(x, y, triggerCurl = 0) {
  const normalizedTriggerCurl = Math.min(1, Math.max(0, triggerCurl));
  const openPose = {
    handPivot: { x: x - 0.025, y: y + 0.18, z: 0.05 },
    thumbBase: { x: x - 0.105, y: y + 0.1, z: 0.024 },
    thumbKnuckle: { x: x - 0.145, y: y + 0.075, z: 0.018 },
    thumbJoint: { x: x - 0.175, y: y + 0.048, z: 0.012 },
    thumbTip: { x: x - 0.205, y: y + 0.02, z: 0.006 },
    indexBase: { x: x - 0.015, y: y + 0.11, z: 0.03 },
    indexKnuckle: { x: x - 0.01, y: y + 0.075, z: 0.018 },
    indexJoint: { x: x - 0.005, y: y + 0.038, z: 0.008 },
    indexTip: { x, y, z: 0 },
    middlePip: { x: x - 0.03, y: y + 0.02, z: 0.02 }
  };
  const pressedPose = {
    handPivot: openPose.handPivot,
    thumbBase: { x: x - 0.078, y: y + 0.097, z: 0.02 },
    thumbKnuckle: { x: x - 0.06, y: y + 0.075, z: 0.014 },
    thumbJoint: { x: x - 0.045, y: y + 0.048, z: 0.009 },
    thumbTip: { x: x - 0.03, y: y + 0.022, z: 0.003 },
    indexBase: openPose.indexBase,
    indexKnuckle: openPose.indexKnuckle,
    indexJoint: openPose.indexJoint,
    indexTip: openPose.indexTip,
    middlePip: openPose.middlePip
  };

  return {
    handPivot: interpolatePoint(
      openPose.handPivot,
      pressedPose.handPivot,
      normalizedTriggerCurl
    ),
    thumbBase: interpolatePoint(
      openPose.thumbBase,
      pressedPose.thumbBase,
      normalizedTriggerCurl
    ),
    thumbKnuckle: interpolatePoint(
      openPose.thumbKnuckle,
      pressedPose.thumbKnuckle,
      normalizedTriggerCurl
    ),
    thumbJoint: interpolatePoint(
      openPose.thumbJoint,
      pressedPose.thumbJoint,
      normalizedTriggerCurl
    ),
    thumbTip: interpolatePoint(
      openPose.thumbTip,
      pressedPose.thumbTip,
      normalizedTriggerCurl
    ),
    indexBase: interpolatePoint(
      openPose.indexBase,
      pressedPose.indexBase,
      normalizedTriggerCurl
    ),
    indexKnuckle: interpolatePoint(
      openPose.indexKnuckle,
      pressedPose.indexKnuckle,
      normalizedTriggerCurl
    ),
    indexJoint: interpolatePoint(
      openPose.indexJoint,
      pressedPose.indexJoint,
      normalizedTriggerCurl
    ),
    indexTip: interpolatePoint(
      openPose.indexTip,
      pressedPose.indexTip,
      normalizedTriggerCurl
    ),
    middlePip: interpolatePoint(
      openPose.middlePip,
      pressedPose.middlePip,
      normalizedTriggerCurl
    )
  };
}

function createTrackedSnapshot(sequenceNumber, x, y, triggerCurl = 0) {
  return {
    trackingState: "tracked",
    sequenceNumber,
    timestampMs: sequenceNumber * 8,
    pose: createTrackedPose(x, y, triggerCurl)
  };
}

export async function createBenchmarkSuites({ clientLoader }) {
  const {
    DuckHuntLocalArenaSimulation: LocalArenaSimulation,
    DuckHuntWeaponRuntime: WeaponRuntime,
    duckHuntFirstPlayableWeaponDefinition: firstPlayableWeaponDefinition,
    duckHuntLocalArenaSimulationConfig: localArenaSimulationConfig
  } = await clientLoader.load("/src/experiences/duck-hunt/index.ts");
  const { createLatestHandTrackingSnapshot } = await clientLoader.load(
    "/src/tracking/types/hand-tracking.ts"
  );

  return [
    {
      id: "local-arena-simulation.advance",
      iterations: 20000,
      maxMeanNs: 50000,
      setup() {
        const simulation = new LocalArenaSimulation(
          {
            xCoefficients: [1, 0, 0],
            yCoefficients: [0, 1, 0]
          },
          localArenaSimulationConfig
        );
        const snapshots = [
          createTrackedSnapshot(1, 0.22, 0.3),
          createTrackedSnapshot(2, 0.27, 0.34, 0.08),
          createTrackedSnapshot(3, 0.5, 0.45),
          createTrackedSnapshot(4, 0.71, 0.28),
          createTrackedSnapshot(5, 0.65, 0.3, 0.08),
          createTrackedSnapshot(6, 0.43, 0.7)
        ];
        let sequenceIndex = 0;
        let nowMs = 0;

        return () => {
          const snapshot = snapshots[sequenceIndex % snapshots.length];

          sequenceIndex += 1;
          nowMs += 16;
          simulation.advance(snapshot, nowMs);
        };
      }
    },
    {
      id: "create-latest-hand-tracking-snapshot",
      iterations: 120000,
      maxMeanNs: 4500,
      setup() {
        let sequenceNumber = 0;

        return () => {
          sequenceNumber += 1;
          createLatestHandTrackingSnapshot({
            sequenceNumber,
            timestampMs: sequenceNumber * 8,
            pose: createTrackedPose(0.31, 0.37, 0.3)
          });
        };
      }
    },
    {
      id: "weapon-runtime.advance-plus-hud",
      iterations: 120000,
      maxMeanNs: 9000,
      setup() {
        const weaponRuntime = new WeaponRuntime(firstPlayableWeaponDefinition);
        const frameInputs = [
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: false
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: true
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: false
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: false,
            sessionActive: true,
            triggerPressed: true
          },
          {
            hasTrackedHand: true,
            isReticleOffscreen: true,
            sessionActive: true,
            triggerPressed: false
          }
        ];
        let frameIndex = 0;
        let nowMs = 0;

        return () => {
          const frameInput = frameInputs[frameIndex % frameInputs.length];

          frameIndex += 1;
          nowMs += 160;
          weaponRuntime.advance({
            ...frameInput,
            nowMs
          });
          weaponRuntime.createHudSnapshot({
            ...frameInput,
            nowMs
          });
        };
      }
    }
  ];
}
