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
        spawn: { x: 0.22, y: 0.28 },
        glideVelocity: { x: 0.12, y: 0.03 },
        radius: 0.08,
        scale: 1.05,
        wingSpeed: 6.4
      },
      {
        id: "bird-2",
        label: "Bird 2",
        spawn: { x: 0.78, y: 0.24 },
        glideVelocity: { x: -0.11, y: 0.04 },
        radius: 0.082,
        scale: 0.98,
        wingSpeed: 5.8
      },
      {
        id: "bird-3",
        label: "Bird 3",
        spawn: { x: 0.32, y: 0.7 },
        glideVelocity: { x: 0.1, y: -0.05 },
        radius: 0.078,
        scale: 1.1,
        wingSpeed: 6.9
      },
      {
        id: "bird-4",
        label: "Bird 4",
        spawn: { x: 0.74, y: 0.74 },
        glideVelocity: { x: -0.12, y: -0.03 },
        radius: 0.08,
        scale: 1.02,
        wingSpeed: 6.1
      }
    ],
    movement: {
      maxStepMs: 48,
      scatterDurationMs: 820,
      scatterSpeed: 0.24,
      downedDurationMs: 960,
      downedDriftVelocityY: 0.18
    },
    targeting: {
      acquireRadius: 0.1,
      hitRadius: 0.09,
      reticleScatterRadius: 0.17,
      shotScatterRadius: 0.24
    },
    weapon: {
      weaponId: "semiautomatic-pistol",
      pressThreshold: 0.055,
      releaseThreshold: 0.02,
      fireCooldownMs: 260,
      feedbackHoldMs: 380
    }
  };
}

function createTrackedSnapshot(sequenceNumber, x, y, thumbDrop = 0) {
  return {
    trackingState: "tracked",
    sequenceNumber,
    timestampMs: sequenceNumber * 8,
    pose: {
      thumbTip: {
        x,
        y: y + thumbDrop
      },
      indexTip: {
        x,
        y
      }
    }
  };
}

export async function createBenchmarkSuites({ clientLoader }) {
  const { LocalArenaSimulation } = await clientLoader.load("/src/game/index.ts");
  const { createLatestHandTrackingSnapshot } = await clientLoader.load(
    "/src/game/types/hand-tracking.ts"
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
          createArenaConfig()
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
            pose: {
              thumbTip: {
                x: 0.34,
                y: 0.44
              },
              indexTip: {
                x: 0.31,
                y: 0.37
              }
            }
          });
        };
      }
    }
  ];
}
