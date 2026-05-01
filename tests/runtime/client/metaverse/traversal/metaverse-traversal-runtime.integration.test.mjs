import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  advanceMetaverseDeterministicUnmountedGroundedBodyStep,
  metaverseBuilderFloorTileEnvironmentAssetId,
  metaverseBuilderStepTileEnvironmentAssetId,
  metaverseBuilderWallTileEnvironmentAssetId,
  metaverseGroundedBodyTraversalCoreConfig,
  metaverseGroundedSurfacePolicyConfig,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId,
  metaverseWorldGroundedSpawnPosition,
  readMetaverseWorldSurfaceAssetAuthoring
} from "@webgpu-metaverse/shared";

import {
  authoredWaterBayDockEntryPosition,
  authoredWaterBayDockEntryYawRadians,
  authoredWaterBayOpenWaterSpawn,
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../../../metaverse-authored-world-test-fixtures.mjs";
import {
  assertReconciliationFreeAuthorityScenario,
  boostedForwardTravelInput,
  createPlacedSurfaceAssetColliderSnapshots,
  createTraversalAuthoritySnapshot,
  createTraversalFixtureContext,
  forwardTravelInput,
  freezeVector3,
  groundedFixedStepSeconds,
  offsetLocalPlanarPosition,
  resolveLocalPlanarOffset,
  runReconciliationFreeAuthorityCourse,
  runReconciliationFreeAuthorityScenario,
  syncAuthoritativeLocalPlayerPose
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

const idleTraversalInput = Object.freeze({
  ...forwardTravelInput,
  moveAxis: 0
});
const forwardJumpTraversalInput = Object.freeze({
  ...forwardTravelInput,
  jump: true
});
const boostedForwardJumpTraversalInput = Object.freeze({
  ...boostedForwardTravelInput,
  jump: true
});

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

function createBuilderCourseHarnessOptions({
  cameraSpawnPosition,
  groundedSpawnPosition,
  initialYawRadians = 0,
  surfaceColliderSnapshots
}) {
  return Object.freeze({
    config: {
      camera: {
        initialYawRadians,
        spawnPosition: cameraSpawnPosition
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    includeGroundCollider: false,
    surfaceColliderSnapshots
  });
}

function createBuilderStairCourseColliders() {
  return createPlacedSurfaceAssetColliderSnapshots([
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 28)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 24)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.3, 20)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.1, 16)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, 0.1, 12)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, 0.1, 8)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, 0.1, 4)
    })
  ]);
}

function resolveMovingSkiffDynamicPose(elapsedSeconds) {
  return Object.freeze({
    position: offsetLocalPlanarPosition(
      authoredWaterBaySkiffPlacement,
      authoredWaterBaySkiffYawRadians,
      0,
      Math.min(elapsedSeconds * 0.42, 0.9)
    ),
    yawRadians: authoredWaterBaySkiffYawRadians
  });
}

test("MetaverseTraversalRuntime keeps sustained grounded planar movement reconciliation-free against fixed-tick authority on flat support", async () => {
  const flatSurfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 20),
      ownerEnvironmentAssetId: null,
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      rotationYRadians: 0,
      translation: freezeVector3(0, -0.1, 24),
      traversalAffordance: "support"
    })
  ];
  const localHarness = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: flatSurfaceColliderSnapshots
  });
  const authoritativeHarness =
    await fixtureContext.createAuthoritativeGroundedSimulationHarness({
      surfaceColliderSnapshots: flatSurfaceColliderSnapshots
    });
  const moveForwardInput = Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 1,
    pitchAxis: 0,
    primaryAction: false,
    secondaryAction: false,
    strafeAxis: 0,
    yawAxis: 0
  });
  let authoritativeAccumulatorSeconds = 0;
  let latestAuthoritativeSnapshot = Object.freeze({
    jumpAuthorityState: "grounded",
    lastAcceptedJumpActionSequence: 0,
    lastProcessedJumpActionSequence: 0,
    linearVelocity: freezeVector3(0, 0, 0),
    locomotionMode: "grounded",
    mountedOccupancy: null,
    position: authoritativeHarness.groundedBodyRuntime.snapshot.position,
    yawRadians: authoritativeHarness.groundedBodyRuntime.snapshot.yawRadians
  });
  const correctionEvents = [];

  try {
    localHarness.traversalRuntime.boot();

    for (let frame = 0; frame < 60; frame += 1) {
      localHarness.traversalRuntime.advance(moveForwardInput, 1 / 60);
      authoritativeAccumulatorSeconds += 1 / 60;

      while (
        authoritativeAccumulatorSeconds + 0.000001 >= groundedFixedStepSeconds
      ) {
        const previousAuthoritativeSnapshot =
          authoritativeHarness.groundedBodyRuntime.snapshot;

        const deterministicAuthoritativeSnapshot =
          advanceMetaverseDeterministicUnmountedGroundedBodyStep({
            autostepHeightMeters: null,
            bodyIntent: Object.freeze({
              boost: false,
              jump: false,
              moveAxis: 1,
              strafeAxis: 0,
              turnAxis: 0
            }),
            currentGroundedBodySnapshot: previousAuthoritativeSnapshot,
            deltaSeconds: groundedFixedStepSeconds,
            groundedBodyConfig: Object.freeze({
              ...metaverseGroundedBodyTraversalCoreConfig,
              spawnPosition: metaverseWorldGroundedSpawnPosition,
              worldRadius: 110
            }),
            preferredLookYawRadians: 0,
            surfaceColliderSnapshots: flatSurfaceColliderSnapshots,
            surfacePolicyConfig: metaverseGroundedSurfacePolicyConfig
          });

        authoritativeHarness.groundedBodyRuntime.syncAuthoritativeState({
          contact: deterministicAuthoritativeSnapshot.contact,
          driveTarget: deterministicAuthoritativeSnapshot.driveTarget,
          grounded: deterministicAuthoritativeSnapshot.grounded,
          interaction: deterministicAuthoritativeSnapshot.interaction,
          jumpBody: deterministicAuthoritativeSnapshot.jumpBody,
          linearVelocity: deterministicAuthoritativeSnapshot.linearVelocity,
          position: deterministicAuthoritativeSnapshot.position,
          yawRadians: deterministicAuthoritativeSnapshot.yawRadians
        });

        const nextAuthoritativeSnapshot =
          authoritativeHarness.groundedBodyRuntime.snapshot;

        latestAuthoritativeSnapshot = Object.freeze({
          jumpAuthorityState: nextAuthoritativeSnapshot.grounded
            ? "grounded"
            : nextAuthoritativeSnapshot.jumpBody.verticalSpeedUnitsPerSecond >
              0.05
              ? "rising"
              : "falling",
          lastAcceptedJumpActionSequence: 0,
          lastProcessedJumpActionSequence: 0,
          linearVelocity: freezeVector3(
            (nextAuthoritativeSnapshot.position.x -
              previousAuthoritativeSnapshot.position.x) /
              groundedFixedStepSeconds,
            (nextAuthoritativeSnapshot.position.y -
              previousAuthoritativeSnapshot.position.y) /
              groundedFixedStepSeconds,
            (nextAuthoritativeSnapshot.position.z -
              previousAuthoritativeSnapshot.position.z) /
              groundedFixedStepSeconds
          ),
          locomotionMode: "grounded",
          mountedOccupancy: null,
          position: nextAuthoritativeSnapshot.position,
          yawRadians: nextAuthoritativeSnapshot.yawRadians
        });

        authoritativeAccumulatorSeconds = Math.max(
          0,
          authoritativeAccumulatorSeconds - groundedFixedStepSeconds
        );
      }

      syncAuthoritativeLocalPlayerPose(localHarness.traversalRuntime, 
        latestAuthoritativeSnapshot
      );

      if (
        localHarness.traversalRuntime.localReconciliationCorrectionCount >
        correctionEvents.length
      ) {
        correctionEvents.push(
          Object.freeze({
            frame: frame + 1,
            ...localHarness.traversalRuntime.authoritativeCorrectionTelemetrySnapshot
          })
        );
      }
    }

    assert.equal(
      localHarness.traversalRuntime.localReconciliationCorrectionCount,
      0,
      `expected zero flat-ground reconciliations, received ${localHarness.traversalRuntime.localReconciliationCorrectionCount} with events ${JSON.stringify(correctionEvents)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores tiny routine grounded-state disagreements without snapping local movement", async () => {
  const { groundedBodyRuntime, traversalRuntime } = await fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 20),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ]
  });

  try {
    traversalRuntime.boot();
    const groundedSnapshot = groundedBodyRuntime.snapshot;

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, 0, 0),
      position: freezeVector3(
        groundedSnapshot.position.x,
        groundedSnapshot.position.y + 0.02,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    });

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    });

    assert.equal(
      traversalRuntime.localReconciliationCorrectionCount,
      0,
      JSON.stringify(traversalRuntime.authoritativeCorrectionTelemetrySnapshot)
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - (groundedSnapshot.position.y + 0.02)
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime does not greedily re-trigger grounded jumps from a held spacebar after landing", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.2, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.1, 24)
        })
      ]
    });
  const heldJumpInput = Object.freeze({
    boost: false,
    jump: true,
    moveAxis: 0,
    pitchAxis: 0,
    primaryAction: false,
    secondaryAction: false,
    strafeAxis: 0,
    yawAxis: 0
  });

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    let observedAirborne = false;
    let observedLanding = false;
    let observedGreedyRejump = false;

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(heldJumpInput, groundedFixedStepSeconds);

      if (!observedAirborne && !groundedBodyRuntime.snapshot.grounded) {
        observedAirborne = true;
        continue;
      }

      if (observedAirborne && !observedLanding && groundedBodyRuntime.snapshot.grounded) {
        observedLanding = true;
        continue;
      }

      if (observedLanding && !groundedBodyRuntime.snapshot.grounded) {
        observedGreedyRejump = true;
        break;
      }
    }

    assert.equal(observedAirborne, true);
    assert.equal(observedLanding, true);
    assert.equal(observedGreedyRejump, false);
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps local swim presentation client-owned against routine authoritative swim drift", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "swim");
    const swimSnapshot = traversalRuntime.localTraversalPoseSnapshot;

    assert.notEqual(swimSnapshot, null);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: -3.2
      }),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: Object.freeze({
        x: swimSnapshot.position.x,
        y: swimSnapshot.position.y,
        z: swimSnapshot.position.z - 0.6
      }),
      yawRadians: swimSnapshot.yawRadians
    });

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "swim-idle"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a local grounded jump above water against routine authoritative swim corrections", async () => {
  const elevatedSupportHeightMeters = 0.42;
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      config: {
        camera: {
          spawnPosition: {
            x: 0,
            y: elevatedSupportHeightMeters + 1.62,
            z: 24
          }
        },
        groundedBody: {
          spawnPosition: {
            x: 0,
            y: elevatedSupportHeightMeters,
            z: 24
          }
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.2, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, elevatedSupportHeightMeters - 0.2, 24)
        })
      ]
    });

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: true,
        moveAxis: 0,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      groundedFixedStepSeconds
    );

    const localJumpSnapshot = groundedBodyRuntime.snapshot;

    assert.equal(localJumpSnapshot.grounded, false);
    assert.ok(localJumpSnapshot.position.y > elevatedSupportHeightMeters);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "none",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "swim",
        mountedOccupancy: null,
        position: Object.freeze({
          x: localJumpSnapshot.position.x,
          y: 0,
          z: localJumpSnapshot.position.z
        }),
        yawRadians: localJumpSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - localJumpSnapshot.position.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps repeated shoreline locomotion disagreement correction-free while a local jump over water stays airborne", async () => {
  const elevatedSupportHeightMeters = 0.42;
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      config: {
        camera: {
          spawnPosition: {
            x: 0,
            y: elevatedSupportHeightMeters + 1.62,
            z: 24
          }
        },
        groundedBody: {
          spawnPosition: {
            x: 0,
            y: elevatedSupportHeightMeters,
            z: 24
          }
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.2, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, elevatedSupportHeightMeters - 0.2, 24)
        })
      ]
    });

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: true,
        moveAxis: 0,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      groundedFixedStepSeconds
    );

    const localJumpSnapshot = groundedBodyRuntime.snapshot;
    const authoritativeWaterEntrySnapshot = Object.freeze({
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 1,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: Object.freeze({
        x: localJumpSnapshot.position.x,
        y: 0,
        z: localJumpSnapshot.position.z
      }),
      yawRadians: localJumpSnapshot.yawRadians
    });

    for (let snapshotIndex = 0; snapshotIndex < 5; snapshotIndex += 1) {
      syncAuthoritativeLocalPlayerPose(
        traversalRuntime,
        authoritativeWaterEntrySnapshot,
        1
      );
    }

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.lastLocalAuthorityPoseCorrectionReason, "none");
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - localJumpSnapshot.position.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps shipped grounded-spawn travel reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await fixtureContext.createShippedTraversalHarness();
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness();

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    const groundedStartZ = localHarness.traversalRuntime.cameraSnapshot.position.z;
    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 20,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(
      result,
      "shipped grounded-spawn travel"
    );
    assert.ok(
      localHarness.traversalRuntime.cameraSnapshot.position.z <
        groundedStartZ - 0.3
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps shipped grounded sprint-jump-land traversal reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await fixtureContext.createShippedTraversalHarness();
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness();

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const groundedSpawnPosition =
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position;
    const result = await runReconciliationFreeAuthorityCourse({
      authoritativeHarness,
      localHarness,
      phases: Object.freeze([
        Object.freeze({
          frameCount: 20,
          input: boostedForwardTravelInput,
          label: "sprint run-up"
        }),
        Object.freeze({
          frameCount: 10,
          input: boostedForwardJumpTraversalInput,
          label: "jump launch"
        }),
        Object.freeze({
          frameCount: 24,
          input: boostedForwardTravelInput,
          label: "airborne carry"
        }),
        Object.freeze({
          frameCount: 42,
          input: boostedForwardTravelInput,
          label: "landing recovery"
        })
      ]),
      recordSurfaceRouting: true
    });
    const phaseSnapshotByLabel = new Map(
      result.phaseSnapshots.map((phaseSnapshot) => [
        phaseSnapshot.phaseLabel,
        phaseSnapshot
      ])
    );
    const jumpLaunchHeight =
      phaseSnapshotByLabel.get("jump launch")?.localPose.position.y ??
      groundedSpawnPosition.y;
    const finalGroundedTravelDistance = Math.hypot(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.x -
        groundedSpawnPosition.x,
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.z -
        groundedSpawnPosition.z
    );

    assertReconciliationFreeAuthorityScenario(
      result,
      "shipped grounded sprint-jump-land course"
    );
    assert.ok(
      finalGroundedTravelDistance > 1.2,
      `expected sprint-jump-land course to move materially across the shipped spawn support, received ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      jumpLaunchHeight > groundedSpawnPosition.y + 0.18,
      `expected jump launch to lift above shipped ground support, received ${JSON.stringify(phaseSnapshotByLabel.get("jump launch"))}`
    );
    assert.equal(
      phaseSnapshotByLabel.get("landing recovery")?.localLocomotionMode,
      "grounded"
    );
    assert.equal(
      phaseSnapshotByLabel.get("landing recovery")?.authoritativeLocomotionMode,
      "grounded"
    );
    assert.ok(localHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(authoritativeHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      Math.abs(
        localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y -
          groundedSpawnPosition.y
      ) < 0.08,
      `expected landing recovery to settle back onto shipped support, received ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps rapid WASD tap churn reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await fixtureContext.createShippedTraversalHarness();
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness();
  const spawnPosition = metaverseWorldGroundedSpawnPosition;
  const rapidTapPhases = Array.from({ length: 3 }, (_, cycleIndex) =>
    Object.freeze([
      Object.freeze({
        frameCount: 6,
        input: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        label: `tap-forward-${cycleIndex + 1}`
      }),
      Object.freeze({
        frameCount: 5,
        input: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: -1,
          yawAxis: 0
        }),
        label: `tap-left-${cycleIndex + 1}`
      }),
      Object.freeze({
        frameCount: 6,
        input: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: -1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        label: `tap-back-${cycleIndex + 1}`
      }),
      Object.freeze({
        frameCount: 5,
        input: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 1,
          yawAxis: 0
        }),
        label: `tap-right-${cycleIndex + 1}`
      }),
      Object.freeze({
        frameCount: 6,
        input: Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: cycleIndex % 2 === 0 ? -1 : 1,
          yawAxis: 0
        }),
        label: `tap-diagonal-${cycleIndex + 1}`
      })
    ])
  ).flat();

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    const result = await runReconciliationFreeAuthorityCourse({
      authoritativeHarness,
      localHarness,
      phases: Object.freeze([
        ...rapidTapPhases,
        Object.freeze({
          frameCount: 18,
          input: idleTraversalInput,
          label: "settle"
        })
      ]),
      recordSurfaceRouting: true
    });
    const maxPlanarPhaseDisplacement = result.phaseSnapshots.reduce(
      (maxDistance, phaseSnapshot) =>
        Math.max(
          maxDistance,
          Math.hypot(
            phaseSnapshot.localPose.position.x - spawnPosition.x,
            phaseSnapshot.localPose.position.z - spawnPosition.z
          )
        ),
      0
    );

    assertReconciliationFreeAuthorityScenario(result, "rapid WASD tap course");
    assert.equal(
      result.phaseSnapshots.every(
        (phaseSnapshot) => phaseSnapshot.localLocomotionMode === "grounded"
      ),
      true,
      `expected rapid WASD tap course to remain grounded, received ${JSON.stringify(result.phaseSnapshots)}`
    );
    assert.equal(
      result.phaseSnapshots.every(
        (phaseSnapshot) =>
          phaseSnapshot.authoritativeLocomotionMode === "grounded"
      ),
      true,
      `expected authoritative rapid WASD tap course to remain grounded, received ${JSON.stringify(result.phaseSnapshots)}`
    );
    assert.ok(
      maxPlanarPhaseDisplacement > 0.45,
      `expected rapid WASD tap course to move materially despite the input churn, received ${maxPlanarPhaseDisplacement}`
    );
    assert.ok(localHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(authoritativeHarness.groundedBodyRuntime.snapshot.grounded);
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps sustained swim reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await fixtureContext.createOpenWaterTraversalHarness();
  const authoritativeHarness = await fixtureContext.createOpenWaterTraversalHarness();

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    const swimStartZ = localHarness.traversalRuntime.cameraSnapshot.position.z;
    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 240,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(result, "sustained swim");
    assert.ok(localHarness.traversalRuntime.cameraSnapshot.position.z < swimStartZ - 0.9);
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps boosted shoreline water entry reconciliation-free against fixed-tick authority when a render frame spans the transition", async () => {
  const localHarness = await fixtureContext.createShorelineTransitionTraversalHarness();
  const authoritativeHarness = await fixtureContext.createShorelineTransitionTraversalHarness();
  const localDeltaSeconds = 0.12;

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    const groundedStartX =
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.x;

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: boostedForwardTravelInput,
      frameCount: 20,
      localDeltaSeconds,
      localHarness,
      localInput: boostedForwardTravelInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(
      result,
      "boosted shoreline-entry"
    );
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.x >
        groundedStartX + 0.6
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored dock water entry reconciliation-free against fixed-tick authority", async () => {
  const authoredDockEdgeEntryPosition = offsetLocalPlanarPosition(
    authoredWaterBayDockEntryPosition,
    authoredWaterBayDockEntryYawRadians,
    0,
    3.5
  );
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredWaterBayDockEntryYawRadians,
        spawnPosition: {
          x: authoredDockEdgeEntryPosition.x - 0.24,
          y: authoredDockEdgeEntryPosition.y + 1.62,
          z: authoredDockEdgeEntryPosition.z
        }
      },
      groundedBody: {
        spawnPosition: authoredDockEdgeEntryPosition
      }
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredWaterBayDockEntryYawRadians,
        spawnPosition: {
          x: authoredDockEdgeEntryPosition.x - 0.24,
          y: authoredDockEdgeEntryPosition.y + 1.62,
          z: authoredDockEdgeEntryPosition.z
        }
      },
      groundedBody: {
        spawnPosition: authoredDockEdgeEntryPosition
      }
    }
  });

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 120,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const dockEntryOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      authoredDockEdgeEntryPosition,
      authoredWaterBayDockEntryYawRadians
    );

    assertReconciliationFreeAuthorityScenario(result, "authored dock-entry");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      dockEntryOffset.z > 3.2,
      `expected authored dock entry to travel into the water bay, received local offset ${JSON.stringify(dockEntryOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored dock run-jump-water traversal reconciliation-free against fixed-tick authority", async () => {
  const authoredDockRunJumpSpawnPosition = offsetLocalPlanarPosition(
    authoredWaterBayDockEntryPosition,
    authoredWaterBayDockEntryYawRadians,
    0,
    -4.5
  );
  const harnessOptions = {
    config: {
      camera: {
        initialYawRadians: authoredWaterBayDockEntryYawRadians,
        spawnPosition: {
          x: authoredDockRunJumpSpawnPosition.x - 0.24,
          y: authoredDockRunJumpSpawnPosition.y + 1.62,
          z: authoredDockRunJumpSpawnPosition.z
        }
      },
      groundedBody: {
        spawnPosition: authoredDockRunJumpSpawnPosition
      }
    }
  };
  const localHarness = await fixtureContext.createShippedTraversalHarness(
    harnessOptions
  );
  const authoritativeHarness =
    await fixtureContext.createShippedTraversalHarness(harnessOptions);

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityCourse({
      authoritativeHarness,
      localHarness,
      phases: Object.freeze([
        Object.freeze({
          frameCount: 16,
          input: forwardTravelInput,
          label: "dock departure"
        }),
        Object.freeze({
          frameCount: 12,
          input: forwardJumpTraversalInput,
          label: "jump launch"
        }),
        Object.freeze({
          frameCount: 40,
          input: forwardTravelInput,
          label: "water descent"
        }),
        Object.freeze({
          frameCount: 64,
          input: forwardTravelInput,
          label: "swim continuation"
        })
      ]),
      recordSurfaceRouting: true
    });
    const phaseSnapshotByLabel = new Map(
      result.phaseSnapshots.map((phaseSnapshot) => [
        phaseSnapshot.phaseLabel,
        phaseSnapshot
      ])
    );
    const dockDeparturePose =
      phaseSnapshotByLabel.get("dock departure")?.localPose.position ??
      authoredDockRunJumpSpawnPosition;
    const dockDeparturePlanarDistance = Math.hypot(
      dockDeparturePose.x - authoredDockRunJumpSpawnPosition.x,
      dockDeparturePose.z - authoredDockRunJumpSpawnPosition.z
    );
    const finalDockRunJumpOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      authoredDockRunJumpSpawnPosition,
      authoredWaterBayDockEntryYawRadians
    );

    assertReconciliationFreeAuthorityScenario(
      result,
      "authored dock run-jump-water course"
    );
    assert.ok(
      dockDeparturePlanarDistance > 0.35,
      `expected dock departure phase to advance the capsule away from the authored spawn, received ${JSON.stringify(phaseSnapshotByLabel.get("dock departure"))}`
    );
    assert.ok(
      (phaseSnapshotByLabel.get("jump launch")?.localPose.position.y ?? 0) >
        authoredDockRunJumpSpawnPosition.y + 0.12,
      `expected local jump launch to stay airborne above authored dock support, received ${JSON.stringify(phaseSnapshotByLabel.get("jump launch"))}`
    );
    assert.equal(
      phaseSnapshotByLabel.get("swim continuation")?.localLocomotionMode,
      "swim"
    );
    assert.equal(
      phaseSnapshotByLabel.get("swim continuation")?.authoritativeLocomotionMode,
      "swim"
    );
    assert.ok(
      finalDockRunJumpOffset.z > 5.4,
      `expected authored dock run-jump-water course to carry the capsule into open water, received local offset ${JSON.stringify(finalDockRunJumpOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored dock swim exit reconciliation-free against fixed-tick authority", async () => {
  const authoredDockExitSwimSpawnPosition = Object.freeze({
    x: authoredWaterBayDockEntryPosition.x,
    y: authoredWaterBayOpenWaterSpawn.y,
    z: authoredWaterBayDockEntryPosition.z
  });
  const authoredDockExitSwimSpawn = offsetLocalPlanarPosition(
    authoredDockExitSwimSpawnPosition,
    authoredWaterBayDockEntryYawRadians,
    0,
    4.8
  );
  const authoredDockExitYawRadians =
    authoredWaterBayDockEntryYawRadians + Math.PI;
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredDockExitYawRadians,
        spawnPosition: {
          x: authoredDockExitSwimSpawn.x,
          y: authoredDockExitSwimSpawn.y + 1.62,
          z: authoredDockExitSwimSpawn.z
        }
      },
      groundedBody: {
        spawnPosition: authoredDockExitSwimSpawn
      }
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredDockExitYawRadians,
        spawnPosition: {
          x: authoredDockExitSwimSpawn.x,
          y: authoredDockExitSwimSpawn.y + 1.62,
          z: authoredDockExitSwimSpawn.z
        }
      },
      groundedBody: {
        spawnPosition: authoredDockExitSwimSpawn
      }
    }
  });

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 180,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const dockExitOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      authoredDockExitSwimSpawn,
      authoredDockExitYawRadians
    );

    assertReconciliationFreeAuthorityScenario(result, "authored dock-exit");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.ok(localHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y >
        authoredWaterBayOpenWaterSpawn.y + 0.35,
      `expected authored dock exit to settle onto support, received pose ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      dockExitOffset.z > 3.6,
      `expected authored dock exit to travel back onto support, received local offset ${JSON.stringify(dockExitOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored idle skiff swim collision reconciliation-free against fixed-tick authority", async () => {
  const skiffCenterPosition = Object.freeze({
    x: authoredWaterBaySkiffPlacement.x,
    y: authoredWaterBayOpenWaterSpawn.y,
    z: authoredWaterBaySkiffPlacement.z
  });
  const skiffSwimStartPosition = offsetLocalPlanarPosition(
    skiffCenterPosition,
    authoredWaterBaySkiffYawRadians,
    0,
    3.2
  );
  const skiffSwimYawRadians = -authoredWaterBaySkiffYawRadians;
  const skiffDynamicPose = Object.freeze({
    position: authoredWaterBaySkiffPlacement,
    yawRadians: authoredWaterBaySkiffYawRadians
  });
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: skiffSwimYawRadians,
        spawnPosition: {
          x: skiffSwimStartPosition.x,
          y: skiffSwimStartPosition.y + 1.62,
          z: skiffSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: skiffSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: skiffDynamicPose
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: skiffSwimYawRadians,
        spawnPosition: {
          x: skiffSwimStartPosition.x,
          y: skiffSwimStartPosition.y + 1.62,
          z: skiffSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: skiffSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: skiffDynamicPose
    }
  });

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 120,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const swimmerLocalOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      skiffCenterPosition,
      authoredWaterBaySkiffYawRadians
    );
    const expectedSkiffBeamClearanceMeters =
      metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
      metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters +
      1.3;

    assertReconciliationFreeAuthorityScenario(
      result,
      "authored idle skiff swim-collision"
    );
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      swimmerLocalOffset.z > expectedSkiffBeamClearanceMeters - 0.04,
      `expected swimmer capsule to remain outside the authored idle skiff hull beam, received local offset ${JSON.stringify(swimmerLocalOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps moving authored skiff swim collision reconciliation-free against fixed-tick authority", async () => {
  const initialSkiffDynamicPose = resolveMovingSkiffDynamicPose(0);
  const skiffSwimStartPosition = offsetLocalPlanarPosition(
    initialSkiffDynamicPose.position,
    authoredWaterBaySkiffYawRadians,
    0,
    3.2
  );
  const skiffSwimYawRadians = -authoredWaterBaySkiffYawRadians;
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: skiffSwimYawRadians,
        spawnPosition: {
          x: skiffSwimStartPosition.x,
          y: skiffSwimStartPosition.y + 1.62,
          z: skiffSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: skiffSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: initialSkiffDynamicPose
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: skiffSwimYawRadians,
        spawnPosition: {
          x: skiffSwimStartPosition.x,
          y: skiffSwimStartPosition.y + 1.62,
          z: skiffSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: skiffSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: initialSkiffDynamicPose
    }
  });
  const movingSkiffForwardInput = ({ elapsedSeconds, harness }) => {
    harness.syncDynamicEnvironmentPoses(
      metaverseHubSkiffEnvironmentAssetId,
      resolveMovingSkiffDynamicPose(elapsedSeconds)
    );

    return forwardTravelInput;
  };

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: movingSkiffForwardInput,
      frameCount: 132,
      localDeltaSeconds: 1 / 55,
      localHarness,
      localInput: movingSkiffForwardInput,
      recordSurfaceRouting: true
    });
    const finalSkiffDynamicPose = resolveMovingSkiffDynamicPose((132 - 1) / 55);
    const swimmerLocalOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      finalSkiffDynamicPose.position,
      authoredWaterBaySkiffYawRadians
    );
    const expectedSkiffBeamClearanceMeters =
      metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
      metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters +
      1.3;

    assertReconciliationFreeAuthorityScenario(
      result,
      "moving authored skiff swim-collision"
    );
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      swimmerLocalOffset.z > expectedSkiffBeamClearanceMeters - 0.04,
      `expected swimmer capsule to remain outside the moving authored skiff hull beam, received local offset ${JSON.stringify(swimmerLocalOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime releases authored skiff deck support once the moving hull translates away", async () => {
  const initialSkiffDynamicPose = Object.freeze({
    position: authoredWaterBaySkiffPlacement,
    yawRadians: authoredWaterBaySkiffYawRadians
  });
  const skiffSupportReleasePose = Object.freeze({
    position: offsetLocalPlanarPosition(
      authoredWaterBaySkiffPlacement,
      authoredWaterBaySkiffYawRadians,
      0,
      8
    ),
    yawRadians: authoredWaterBaySkiffYawRadians
  });
  const groundedSpawnPosition = freezeVector3(
    initialSkiffDynamicPose.position.x,
    authoredWaterBaySkiffPlacement.y + 0.62 + 0.06,
    initialSkiffDynamicPose.position.z
  );
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredWaterBaySkiffYawRadians,
        spawnPosition: {
          x: groundedSpawnPosition.x,
          y: groundedSpawnPosition.y + 1.62,
          z: groundedSpawnPosition.z
        }
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: initialSkiffDynamicPose
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: authoredWaterBaySkiffYawRadians,
        spawnPosition: {
          x: groundedSpawnPosition.x,
          y: groundedSpawnPosition.y + 1.62,
          z: groundedSpawnPosition.z
        }
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: initialSkiffDynamicPose
    }
  });
  const releaseSkiffSupportInput = ({ harness }) => {
    harness.syncDynamicEnvironmentPoses(
      metaverseHubSkiffEnvironmentAssetId,
      skiffSupportReleasePose
    );

    return idleTraversalInput;
  };

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      localHarness.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
        .resolvedSupportHeightMeters,
      groundedSpawnPosition.y
    );

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: releaseSkiffSupportInput,
      frameCount: 60,
      localHarness,
      localInput: releaseSkiffSupportInput
    });

    assertReconciliationFreeAuthorityScenario(
      result,
      "moving skiff support release"
    );
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(
      localHarness.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
        .resolvedSupportHeightMeters,
      0
    );
    assert.ok(
      Math.abs(
        localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y
      ) < 0.000001
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps moving authored skiff support-release-to-swim traversal reconciliation-free against fixed-tick authority", async () => {
  const initialSkiffDynamicPose = Object.freeze({
    position: authoredWaterBaySkiffPlacement,
    yawRadians: authoredWaterBaySkiffYawRadians
  });
  const groundedSpawnPosition = freezeVector3(
    initialSkiffDynamicPose.position.x,
    authoredWaterBaySkiffPlacement.y + 0.62 + 0.06,
    initialSkiffDynamicPose.position.z
  );
  const finalSkiffReleasePose = Object.freeze({
    position: offsetLocalPlanarPosition(
      authoredWaterBaySkiffPlacement,
      authoredWaterBaySkiffYawRadians,
      0,
      8
    ),
    yawRadians: authoredWaterBaySkiffYawRadians
  });
  const harnessOptions = {
    config: {
      camera: {
        initialYawRadians: authoredWaterBaySkiffYawRadians,
        spawnPosition: {
          x: groundedSpawnPosition.x,
          y: groundedSpawnPosition.y + 1.62,
          z: groundedSpawnPosition.z
        }
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubSkiffEnvironmentAssetId]: initialSkiffDynamicPose
    }
  };
  const localHarness = await fixtureContext.createShippedTraversalHarness(
    harnessOptions
  );
  const authoritativeHarness =
    await fixtureContext.createShippedTraversalHarness(harnessOptions);
  const syncMovingSkiffSupportReleasePose = ({ harness, phaseElapsedSeconds }) => {
    const releaseProgress = Math.min(phaseElapsedSeconds / 0.9, 1);

    harness.syncDynamicEnvironmentPoses(
      metaverseHubSkiffEnvironmentAssetId,
      Object.freeze({
        position: offsetLocalPlanarPosition(
          authoredWaterBaySkiffPlacement,
          authoredWaterBaySkiffYawRadians,
          0,
          8 * releaseProgress
        ),
        yawRadians: authoredWaterBaySkiffYawRadians
      })
    );
  };

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityCourse({
      authoritativeHarness,
      localHarness,
      phases: Object.freeze([
        Object.freeze({
          frameCount: 18,
          input(context) {
            context.harness.syncDynamicEnvironmentPoses(
              metaverseHubSkiffEnvironmentAssetId,
              initialSkiffDynamicPose
            );

            return idleTraversalInput;
          },
          label: "deck support"
        }),
        Object.freeze({
          frameCount: 54,
          input(context) {
            syncMovingSkiffSupportReleasePose(context);
            return idleTraversalInput;
          },
          label: "support translation"
        }),
        Object.freeze({
          frameCount: 48,
          input(context) {
            context.harness.syncDynamicEnvironmentPoses(
              metaverseHubSkiffEnvironmentAssetId,
              finalSkiffReleasePose
            );

            return forwardTravelInput;
          },
          label: "swim continuation"
        })
      ])
    });
    const phaseSnapshotByLabel = new Map(
      result.phaseSnapshots.map((phaseSnapshot) => [
        phaseSnapshot.phaseLabel,
        phaseSnapshot
      ])
    );
    const finalTravelDistance = Math.hypot(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.x -
        groundedSpawnPosition.x,
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.z -
        groundedSpawnPosition.z
    );

    assertReconciliationFreeAuthorityScenario(
      result,
      "moving authored skiff support-release course"
    );
    assert.equal(
      phaseSnapshotByLabel.get("deck support")?.localLocomotionMode,
      "grounded"
    );
    assert.equal(
      phaseSnapshotByLabel.get("deck support")?.authoritativeLocomotionMode,
      "grounded"
    );
    assert.equal(
      phaseSnapshotByLabel.get("support translation")?.localLocomotionMode,
      "swim"
    );
    assert.equal(
      phaseSnapshotByLabel.get("support translation")?.authoritativeLocomotionMode,
      "swim"
    );
    assert.equal(
      phaseSnapshotByLabel.get("swim continuation")?.localLocomotionMode,
      "swim"
    );
    assert.equal(
      phaseSnapshotByLabel.get("swim continuation")?.authoritativeLocomotionMode,
      "swim"
    );
    assert.equal(
      localHarness.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
        .resolvedSupportHeightMeters,
      0
    );
    assert.ok(
      Math.abs(
        localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y
      ) < 0.000001,
      `expected moving skiff support-release course to settle on the waterline, received ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      finalTravelDistance > 0.8,
      `expected moving skiff support-release course to continue swimming after support loss, received ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps builder step jump-up reconciliation-free against fixed-tick authority", async () => {
  const builderStepCourseColliders = createPlacedSurfaceAssetColliderSnapshots([
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 24)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 20)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderStepTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 16)
    })
  ]);
  const groundedSpawnPosition = freezeVector3(0, 0, 24);
  const cameraSpawnPosition = freezeVector3(0, 5.4, 24);
  const harnessOptions = createBuilderCourseHarnessOptions({
    cameraSpawnPosition,
    groundedSpawnPosition,
    surfaceColliderSnapshots: builderStepCourseColliders
  });
  const localHarness = await fixtureContext.createTraversalHarness(harnessOptions);
  const authoritativeHarness = await fixtureContext.createTraversalHarness(
    harnessOptions
  );
  const builderStepJumpInput = ({ elapsedSeconds }) =>
    elapsedSeconds < 0.9
      ? elapsedSeconds >= 0.55 && elapsedSeconds < 0.62
        ? forwardJumpTraversalInput
        : forwardTravelInput
      : idleTraversalInput;

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: builderStepJumpInput,
      frameCount: 96,
      localHarness,
      localInput: builderStepJumpInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(result, "builder step jump-up");
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y > 0.45,
      `expected local capsule to clear the exact-match builder step top, received pose ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot.position.y >
        0.45,
      `expected authoritative capsule to clear the exact-match builder step top, received pose ${JSON.stringify(authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps builder wall collision reconciliation-free against fixed-tick authority", async () => {
  const wallPosition = freezeVector3(0, -0.5, 16);
  const builderWallCourseColliders = createPlacedSurfaceAssetColliderSnapshots([
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 24)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 20)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      position: freezeVector3(0, -0.5, 16)
    }),
    Object.freeze({
      environmentAssetId: metaverseBuilderWallTileEnvironmentAssetId,
      position: wallPosition
    })
  ]);
  const groundedSpawnPosition = freezeVector3(0, 0, 24);
  const cameraSpawnPosition = freezeVector3(0, 5.4, 24);
  const harnessOptions = createBuilderCourseHarnessOptions({
    cameraSpawnPosition,
    groundedSpawnPosition,
    surfaceColliderSnapshots: builderWallCourseColliders
  });
  const localHarness = await fixtureContext.createTraversalHarness(harnessOptions);
  const authoritativeHarness = await fixtureContext.createTraversalHarness(
    harnessOptions
  );

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 216,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const wallLocalOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      wallPosition,
      0
    );
    const requiredWallClearanceMeters =
      0.25 +
      metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
      metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters;

    assertReconciliationFreeAuthorityScenario(result, "builder wall collision");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.ok(
      wallLocalOffset.z > requiredWallClearanceMeters - 0.05,
      `expected player capsule to remain in front of the builder wall, received local offset ${JSON.stringify(wallLocalOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps builder stair ascent reconciliation-free against fixed-tick authority", async () => {
  const builderStairCourseColliders = createBuilderStairCourseColliders();
  const groundedSpawnPosition = freezeVector3(0, 0, 28);
  const cameraSpawnPosition = freezeVector3(0, 5.4, 28);
  const harnessOptions = createBuilderCourseHarnessOptions({
    cameraSpawnPosition,
    groundedSpawnPosition,
    surfaceColliderSnapshots: builderStairCourseColliders
  });
  const localHarness = await fixtureContext.createTraversalHarness(harnessOptions);
  const authoritativeHarness = await fixtureContext.createTraversalHarness(
    harnessOptions
  );

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 168,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(result, "builder stair ascent");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.ok(localHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(authoritativeHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y > 0.55,
      `expected local capsule to finish on the upper builder stair landing, received pose ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot.position.y >
        0.55,
      `expected authoritative capsule to finish on the upper builder stair landing, received pose ${JSON.stringify(authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps builder stair descent reconciliation-free against fixed-tick authority", async () => {
  const builderStairCourseColliders = createBuilderStairCourseColliders();
  const groundedSpawnPosition = freezeVector3(0, 0.6, 8);
  const cameraSpawnPosition = freezeVector3(0, 6, 8);
  const harnessOptions = createBuilderCourseHarnessOptions({
    cameraSpawnPosition,
    groundedSpawnPosition,
    initialYawRadians: Math.PI,
    surfaceColliderSnapshots: builderStairCourseColliders
  });
  const localHarness = await fixtureContext.createTraversalHarness(harnessOptions);
  const authoritativeHarness = await fixtureContext.createTraversalHarness(
    harnessOptions
  );

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 216,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });

    assertReconciliationFreeAuthorityScenario(result, "builder stair descent");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.ok(localHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(authoritativeHarness.groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.y < 0.08,
      `expected local capsule to finish on the lower builder stair landing, received pose ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot.position.y <
        0.08,
      `expected authoritative capsule to finish on the lower builder stair landing, received pose ${JSON.stringify(authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored pushable crate collision reconciliation-free against fixed-tick authority", async () => {
  const crateCenterPosition = freezeVector3(-8, 0.46, 14);
  const groundedSpawnPosition = freezeVector3(
    crateCenterPosition.x,
    metaverseWorldGroundedSpawnPosition.y,
    crateCenterPosition.z + 6
  );
  const cameraSpawnPosition = freezeVector3(
    groundedSpawnPosition.x,
    groundedSpawnPosition.y + 4.8,
    groundedSpawnPosition.z
  );
  const harnessOptions = Object.freeze({
    config: {
      camera: {
        initialYawRadians: 0,
        spawnPosition: cameraSpawnPosition
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    dynamicBodyEnvironmentAssetIds: [
      metaverseHubPushableCrateEnvironmentAssetId
    ]
  });
  const localHarness = await fixtureContext.createShippedTraversalHarness(
    harnessOptions
  );
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness(
    harnessOptions
  );

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 120,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const requiredCrateClearanceMeters =
      0.46 +
      metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
      metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters;

    assertReconciliationFreeAuthorityScenario(result, "authored pushable crate");
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    assert.ok(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position.z >
        crateCenterPosition.z + requiredCrateClearanceMeters - 0.05,
      `expected local capsule to remain in front of the authored pushable crate, received pose ${JSON.stringify(localHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
    assert.ok(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot.position.z >
        crateCenterPosition.z + requiredCrateClearanceMeters - 0.05,
      `expected authoritative capsule to remain in front of the authored pushable crate, received pose ${JSON.stringify(authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot)}`
    );
  } finally {
    for (const dynamicBodyRuntime of localHarness.dynamicBodyRuntimesByEnvironmentAssetId.values()) {
      dynamicBodyRuntime.dispose();
    }
    for (const dynamicBodyRuntime of authoritativeHarness.dynamicBodyRuntimesByEnvironmentAssetId.values()) {
      dynamicBodyRuntime.dispose();
    }
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authored idle dive boat swim collision reconciliation-free against fixed-tick authority", async () => {
  const diveBoatSurfaceAsset = readMetaverseWorldSurfaceAssetAuthoring(
    metaverseHubDiveBoatEnvironmentAssetId
  );

  assert.notEqual(
    diveBoatSurfaceAsset,
    null,
    "dive boat surface asset should resolve"
  );
  const diveBoatPlacement = diveBoatSurfaceAsset.placements[0];

  assert.notEqual(
    diveBoatPlacement,
    undefined,
    "dive boat placement should resolve"
  );

  const diveBoatCenterPosition = Object.freeze({
    x: diveBoatPlacement.position.x,
    y: authoredWaterBayOpenWaterSpawn.y,
    z: diveBoatPlacement.position.z
  });
  const diveBoatSwimStartPosition = offsetLocalPlanarPosition(
    diveBoatCenterPosition,
    diveBoatPlacement.rotationYRadians,
    0,
    5.6
  );
  const diveBoatSwimYawRadians = -diveBoatPlacement.rotationYRadians;
  const diveBoatDynamicPose = Object.freeze({
    position: diveBoatPlacement.position,
    yawRadians: diveBoatPlacement.rotationYRadians
  });
  const localHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: diveBoatSwimYawRadians,
        spawnPosition: {
          x: diveBoatSwimStartPosition.x,
          y: diveBoatSwimStartPosition.y + 1.62,
          z: diveBoatSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: diveBoatSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubDiveBoatEnvironmentAssetId]: diveBoatDynamicPose
    }
  });
  const authoritativeHarness = await fixtureContext.createShippedTraversalHarness({
    config: {
      camera: {
        initialYawRadians: diveBoatSwimYawRadians,
        spawnPosition: {
          x: diveBoatSwimStartPosition.x,
          y: diveBoatSwimStartPosition.y + 1.62,
          z: diveBoatSwimStartPosition.z
        }
      },
      groundedBody: {
        spawnPosition: diveBoatSwimStartPosition
      }
    },
    dynamicEnvironmentPoses: {
      [metaverseHubDiveBoatEnvironmentAssetId]: diveBoatDynamicPose
    }
  });

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();

    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");

    const result = await runReconciliationFreeAuthorityScenario({
      authoritativeHarness,
      authoritativeInput: forwardTravelInput,
      frameCount: 180,
      localHarness,
      localInput: forwardTravelInput,
      recordSurfaceRouting: true
    });
    const swimmerLocalOffset = resolveLocalPlanarOffset(
      localHarness.traversalRuntime.localTraversalPoseSnapshot.position,
      diveBoatCenterPosition,
      diveBoatPlacement.rotationYRadians
    );
    const expectedDiveBoatClearanceMeters =
      1.8 +
      metaverseGroundedBodyTraversalCoreConfig.capsuleRadiusMeters +
      metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters;

    assertReconciliationFreeAuthorityScenario(
      result,
      "authored idle dive boat swim-collision"
    );
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      swimmerLocalOffset.z > expectedDiveBoatClearanceMeters - 0.05,
      `expected swimmer capsule to remain outside the authored idle dive boat hull, received local offset ${JSON.stringify(swimmerLocalOffset)}`
    );
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});
