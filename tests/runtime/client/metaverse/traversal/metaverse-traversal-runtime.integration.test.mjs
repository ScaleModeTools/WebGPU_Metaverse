import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  metaverseRealtimeWorldCadenceConfig,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  shouldConsiderMetaverseWaterborneTraversalCollider,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "@webgpu-metaverse/shared";

import { authoredWaterBayOpenWaterSpawn } from "../../../metaverse-authored-world-test-fixtures.mjs";
import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createFakePhysicsRuntime } from "../../fake-rapier-runtime.mjs";

let clientLoader;
const groundedFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function createTraversalAuthoritySnapshot(
  previousPose,
  nextPose,
  groundedBodySnapshot,
  deltaSeconds
) {
  const sanitizedDeltaSeconds = Math.max(deltaSeconds, 0.000001);
  const jumpAuthorityState =
    nextPose.locomotionMode === "swim"
      ? "none"
      : groundedBodySnapshot.grounded
        ? "grounded"
        : groundedBodySnapshot.verticalSpeedUnitsPerSecond > 0.05
          ? "rising"
          : "falling";

  return Object.freeze({
    jumpAuthorityState,
    linearVelocity: freezeVector3(
      (nextPose.position.x - previousPose.position.x) / sanitizedDeltaSeconds,
      (nextPose.position.y - previousPose.position.y) / sanitizedDeltaSeconds,
      (nextPose.position.z - previousPose.position.z) / sanitizedDeltaSeconds
    ),
    locomotionMode: nextPose.locomotionMode,
    mountedOccupancy: null,
    position: nextPose.position,
    traversalAuthority: resolveMetaverseTraversalAuthoritySnapshotInput({
      currentTick: 0,
      jumpAuthorityState,
      locomotionMode: nextPose.locomotionMode,
      mounted: false,
      pendingActionKind: "none",
      pendingActionSequence: 0,
      resolvedActionKind: "none",
      resolvedActionSequence: 0,
      resolvedActionState: "none"
    }),
    yawRadians: nextPose.yawRadians
  });
}

function createAuthoritativeLocalPlayerPoseSnapshot(input) {
  const {
    lastAcceptedJumpActionSequence = 0,
    lastProcessedJumpActionSequence = 0,
    pendingActionSequence: pendingActionSequenceOverride = 0,
    ...authoritativeSnapshot
  } = input;
  const mounted =
    authoritativeSnapshot.mountedOccupancy !== null ||
    authoritativeSnapshot.locomotionMode === "mounted";
  const resolvedActionSequence =
    lastProcessedJumpActionSequence > lastAcceptedJumpActionSequence
      ? lastProcessedJumpActionSequence
      : lastAcceptedJumpActionSequence;
  const resolvedActionState =
    lastProcessedJumpActionSequence > lastAcceptedJumpActionSequence
      ? "rejected-buffer-expired"
      : lastAcceptedJumpActionSequence > 0
        ? "accepted"
        : "none";
  const pendingActionSequence = pendingActionSequenceOverride;

  return Object.freeze({
    ...authoritativeSnapshot,
    traversalAuthority:
      authoritativeSnapshot.traversalAuthority ??
      resolveMetaverseTraversalAuthoritySnapshotInput({
        currentTick: 0,
        jumpAuthorityState: authoritativeSnapshot.jumpAuthorityState,
        locomotionMode: authoritativeSnapshot.locomotionMode,
        mounted,
        pendingActionKind:
          pendingActionSequence > 0 ? "jump" : "none",
        pendingActionSequence: pendingActionSequence,
        resolvedActionKind:
          resolvedActionSequence > 0 ? "jump" : "none",
        resolvedActionSequence: resolvedActionSequence,
        resolvedActionState: resolvedActionState
      })
  });
}

function syncAuthoritativeLocalPlayerPose(
  traversalRuntime,
  authoritativePlayerSnapshot
) {
  traversalRuntime.syncAuthoritativeLocalPlayerPose(
    createAuthoritativeLocalPlayerPoseSnapshot(authoritativePlayerSnapshot)
  );
}

function createMountedAnchorKey(
  environmentAssetId,
  seatId = null,
  entryId = null
) {
  return `${environmentAssetId}:${seatId ?? "entry"}:${entryId ?? "seat"}`;
}

const forwardTravelInput = Object.freeze({
  boost: false,
  moveAxis: 1,
  pitchAxis: 0,
  yawAxis: 0
});

function createGroundColliderConfig(config) {
  return {
    halfExtents: freezeVector3(
      Math.max(config.movement.worldRadius, config.ocean.planeWidth * 0.5),
      0.5,
      Math.max(config.movement.worldRadius, config.ocean.planeDepth * 0.5)
    ),
    translation: freezeVector3(0, config.ocean.height - 0.5, 0)
  };
}

async function createTraversalHarness(options = {}) {
  const [
    { MetaverseTraversalRuntime },
    { metaverseRuntimeConfig },
    { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-traversal-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const defaultTestConfig = {
    ...metaverseRuntimeConfig,
    camera: {
      ...metaverseRuntimeConfig.camera,
      initialYawRadians: 0,
      spawnPosition: {
        x: 0,
        y: 6.5,
        z: 24
      }
    },
    groundedBody: {
      ...metaverseRuntimeConfig.groundedBody,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 24
      }
    }
  };
  const config = {
    ...defaultTestConfig,
    ...options.config,
    camera: {
      ...defaultTestConfig.camera,
      ...(options.config?.camera ?? {})
    },
    groundedBody: {
      ...defaultTestConfig.groundedBody,
      ...(options.config?.groundedBody ?? {})
    }
  };
  const surfaceColliderSnapshots = (options.surfaceColliderSnapshots ?? []).map(
    (collider) =>
      Object.freeze({
        ownerEnvironmentAssetId: collider.ownerEnvironmentAssetId ?? null,
        traversalAffordance: collider.traversalAffordance ?? "support",
        halfExtents: collider.halfExtents,
        rotationYRadians: collider.rotationYRadians ?? 0,
        rotation: collider.rotation,
        translation: collider.translation
      })
  );
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);
  const colliderMetadataByHandle = new Map();

  await physicsRuntime.init();

  if (options.includeGroundCollider !== false) {
    const groundCollider = createGroundColliderConfig(config);
    const groundColliderHandle = physicsRuntime.createFixedCuboidCollider(
      groundCollider.halfExtents,
      groundCollider.translation
    );

    colliderMetadataByHandle.set(
      groundColliderHandle,
      Object.freeze({
        ownerEnvironmentAssetId: null,
        traversalAffordance: "support"
      })
    );
  }

  for (const collider of surfaceColliderSnapshots) {
    const colliderHandle = physicsRuntime.createFixedCuboidCollider(
      collider.halfExtents,
      collider.translation,
      collider.rotation
    );

    colliderMetadataByHandle.set(colliderHandle, collider);
  }

  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      ...config.groundedBody,
      worldRadius: config.movement.worldRadius
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init(config.camera.initialYawRadians);

  const dynamicPoseWrites = [];
  const dynamicPoseMap = new Map(
    Object.entries(options.dynamicEnvironmentPoses ?? {})
  );
  const mountedEnvironmentAnchorSnapshotsByKey = new Map(
    Object.entries(options.mountedEnvironmentAnchorSnapshots ?? {})
  );
  const mountableEnvironmentConfigById = new Map(
    Object.keys(options.dynamicEnvironmentPoses ?? {}).map((environmentAssetId) => [
      environmentAssetId,
      Object.freeze({
        collider: Object.freeze({
          center: freezeVector3(0, 0.72, 0),
          shape: "box",
          size: freezeVector3(3, 1.44, 2)
        }),
        entries: null,
        environmentAssetId,
        label: "Mounted vehicle",
        seats: Object.freeze([
          Object.freeze({
            cameraPolicyId: "vehicle-follow",
            controlRoutingPolicyId: "vehicle-surface-drive",
            directEntryEnabled: true,
            dismountOffset: freezeVector3(0, 0, 1),
            label: "Take helm",
            lookLimitPolicyId: "driver-forward",
            occupancyAnimationId: "seated",
            seatId: "driver-seat",
            seatNodeName: "driver_seat",
            seatRole: "driver"
          })
        ])
      })
    ])
  );

  for (const [environmentAssetId, seatConfig] of Object.entries(
    options.mountableEnvironmentConfigs ?? {}
  )) {
    mountableEnvironmentConfigById.set(
      environmentAssetId,
      Object.freeze({
        collider:
          seatConfig.collider ??
          Object.freeze({
            center: freezeVector3(0, 0.72, 0),
            shape: "box",
            size: freezeVector3(3, 1.44, 2)
          }),
        entries: Object.freeze(seatConfig.entries ?? []),
        environmentAssetId,
        label: seatConfig.label ?? "Mounted vehicle",
        seats: Object.freeze(seatConfig.seats)
      })
    );
  }
  const traversalRuntime = new MetaverseTraversalRuntime(config, {
    groundedBodyRuntime,
    physicsRuntime,
    readDynamicEnvironmentPose(environmentAssetId) {
      return dynamicPoseMap.get(environmentAssetId) ?? null;
    },
    readMountedEnvironmentAnchorSnapshot(mountedEnvironment) {
      const anchorSnapshot =
        mountedEnvironmentAnchorSnapshotsByKey.get(
          createMountedAnchorKey(
            mountedEnvironment.environmentAssetId,
            mountedEnvironment.seatId,
            mountedEnvironment.entryId
          )
        ) ?? null;

      if (anchorSnapshot !== null) {
        return anchorSnapshot;
      }

      const dynamicPose = dynamicPoseMap.get(mountedEnvironment.environmentAssetId);

      return dynamicPose === undefined
        ? null
        : Object.freeze({
            position: dynamicPose.position,
            yawRadians: dynamicPose.yawRadians
          });
    },
    readMountableEnvironmentConfig(environmentAssetId) {
      return mountableEnvironmentConfigById.get(environmentAssetId) ?? null;
    },
    resolveGroundedTraversalFilterPredicate(excludedColliders = []) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => !excludedColliderSet.has(collider);
    },
    resolveWaterborneTraversalFilterPredicate(
      excludedOwnerEnvironmentAssetId = null,
      excludedColliders = []
    ) {
      const excludedColliderSet = new Set(excludedColliders);

      return (collider) => {
        if (excludedColliderSet.has(collider)) {
          return false;
        }

        const colliderMetadata = colliderMetadataByHandle.get(collider);

        if (colliderMetadata === undefined) {
          return true;
        }
        return shouldConsiderMetaverseWaterborneTraversalCollider(
          colliderMetadata,
          excludedOwnerEnvironmentAssetId
        );
      };
    },
    setDynamicEnvironmentPose(environmentAssetId, poseSnapshot) {
      dynamicPoseWrites.push({
        environmentAssetId,
        poseSnapshot
      });

      if (poseSnapshot === null) {
        dynamicPoseMap.delete(environmentAssetId);
        return;
      }

      dynamicPoseMap.set(environmentAssetId, poseSnapshot);
    },
    surfaceColliderSnapshots
  });

  return {
    config,
    dynamicPoseWrites,
    groundedBodyRuntime,
    mountableEnvironmentConfigById,
    traversalRuntime
  };
}

async function createOpenWaterTraversalHarness(options = {}) {
  const nextConfig = options.config ?? {};

  return createTraversalHarness({
    ...options,
    includeGroundCollider: options.includeGroundCollider ?? false,
    config: {
      ...nextConfig,
      camera: {
        ...(nextConfig.camera ?? {}),
        initialYawRadians: 0,
        spawnPosition: {
          x: authoredWaterBayOpenWaterSpawn.x,
          y: authoredWaterBayOpenWaterSpawn.y + 1.62,
          z: authoredWaterBayOpenWaterSpawn.z,
          ...(nextConfig.camera?.spawnPosition ?? {})
        }
      },
      groundedBody: {
        ...(nextConfig.groundedBody ?? {}),
        spawnPosition: {
          x: authoredWaterBayOpenWaterSpawn.x,
          y: authoredWaterBayOpenWaterSpawn.y,
          z: authoredWaterBayOpenWaterSpawn.z,
          ...(nextConfig.groundedBody?.spawnPosition ?? {})
        }
      }
    }
  });
}

async function createAuthoritativeGroundedSimulationHarness(
  options = {}
) {
  const spawnPosition = options.spawnPosition ?? freezeVector3(0, 0, 24);
  const spawnYawRadians = options.spawnYawRadians ?? 0;
  const surfaceColliderSnapshots =
    options.surfaceColliderSnapshots ??
    [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 20),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ];
  const [
    { metaverseRuntimeConfig },
    { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  for (const surfaceColliderSnapshot of surfaceColliderSnapshots) {
    physicsRuntime.createFixedCuboidCollider(
      surfaceColliderSnapshot.halfExtents,
      surfaceColliderSnapshot.translation,
      surfaceColliderSnapshot.rotation
    );
  }

  const groundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    {
      ...metaverseRuntimeConfig.groundedBody,
      spawnPosition,
      worldRadius: metaverseRuntimeConfig.movement.worldRadius
    },
    physicsRuntime
  );

  await groundedBodyRuntime.init(spawnYawRadians);
  groundedBodyRuntime.syncAuthoritativeState({
    grounded: true,
    linearVelocity: freezeVector3(0, 0, 0),
    position: spawnPosition,
    yawRadians: spawnYawRadians
  });

  return {
    groundedBodyRuntime,
    physicsRuntime
  };
}

async function createShippedSurfaceColliderSnapshots() {
  const [{ metaverseEnvironmentProofConfig }, { resolvePlacedCuboidColliders }] =
    await Promise.all([
      clientLoader.load("/src/app/states/metaverse-asset-proof.ts"),
      clientLoader.load("/src/metaverse/states/metaverse-environment-collision.ts")
    ]);

  return Object.freeze(
    metaverseEnvironmentProofConfig.assets.flatMap((environmentAsset) =>
      environmentAsset.placement === "dynamic"
        ? []
        : resolvePlacedCuboidColliders(environmentAsset)
    )
  );
}

async function createShippedTraversalHarness() {
  const [{ metaverseRuntimeConfig }, surfaceColliderSnapshots] = await Promise.all([
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    createShippedSurfaceColliderSnapshots()
  ]);

  return createTraversalHarness({
    config: {
      camera: {
        ...metaverseRuntimeConfig.camera
      },
      groundedBody: {
        ...metaverseRuntimeConfig.groundedBody
      }
    },
    includeGroundCollider: false,
    surfaceColliderSnapshots
  });
}

async function createGroundedSpawnOwnedTraversalHarness() {
  const groundedSpawnPosition = freezeVector3(
    metaverseWorldGroundedSpawnPosition.x,
    metaverseWorldGroundedSpawnPosition.y,
    metaverseWorldGroundedSpawnPosition.z
  );
  const harness = await createTraversalHarness({
    config: {
      camera: {
        initialYawRadians: metaverseWorldInitialYawRadians,
        spawnPosition: {
          x: groundedSpawnPosition.x + 74,
          y: groundedSpawnPosition.y + 5.4,
          z: groundedSpawnPosition.z + 28
        }
      },
      groundedBody: {
        spawnPosition: groundedSpawnPosition
      }
    },
    includeGroundCollider: false,
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(36, 0.3, 41),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, 0.3, 0),
        traversalAffordance: "support"
      })
    ]
  });

  return {
    groundedSpawnPosition,
    ...harness
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseTraversalRuntime keeps sustained grounded planar movement reconciliation-free against fixed-tick authority on flat support", async () => {
  const localHarness = await createTraversalHarness({
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 20),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ]
  });
  const authoritativeHarness = await createAuthoritativeGroundedSimulationHarness();
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

        authoritativeHarness.physicsRuntime.stepSimulation(groundedFixedStepSeconds);

        const nextAuthoritativeSnapshot =
          authoritativeHarness.groundedBodyRuntime.advance(
            Object.freeze({
              boost: false,
              jump: false,
              moveAxis: 1,
              strafeAxis: 0,
              turnAxis: 0
            }),
            groundedFixedStepSeconds,
            undefined,
            0
          );

        latestAuthoritativeSnapshot = Object.freeze({
          jumpAuthorityState: nextAuthoritativeSnapshot.grounded
            ? "grounded"
            : nextAuthoritativeSnapshot.verticalSpeedUnitsPerSecond > 0.05
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
  const { groundedBodyRuntime, traversalRuntime } = await createTraversalHarness({
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
    await createTraversalHarness({
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
    await createOpenWaterTraversalHarness();

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
    await createTraversalHarness({
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
    await createTraversalHarness({
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
  const localHarness = await createShippedTraversalHarness();
  const authoritativeHarness = await createShippedTraversalHarness();
  const correctionEvents = [];
  let authoritativeAccumulatorSeconds = 0;

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    const groundedStartZ = localHarness.traversalRuntime.cameraSnapshot.position.z;

    let latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
      authoritativeHarness.groundedBodyRuntime.snapshot,
      groundedFixedStepSeconds
    );

    for (let frame = 0; frame < 20; frame += 1) {
      localHarness.traversalRuntime.advance(forwardTravelInput, 1 / 60);
      assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");

      authoritativeAccumulatorSeconds += 1 / 60;

      while (
        authoritativeAccumulatorSeconds + 0.000001 >= groundedFixedStepSeconds
      ) {
        const previousAuthoritativePose =
          authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot;

        authoritativeHarness.traversalRuntime.advance(
          forwardTravelInput,
          groundedFixedStepSeconds
        );
        assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");

        latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
          previousAuthoritativePose,
          authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
          authoritativeHarness.groundedBodyRuntime.snapshot,
          groundedFixedStepSeconds
        );
        authoritativeAccumulatorSeconds = Math.max(
          0,
          authoritativeAccumulatorSeconds - groundedFixedStepSeconds
        );
      }

      syncAuthoritativeLocalPlayerPose(
        localHarness.traversalRuntime,
        latestAuthoritativeSnapshot
      );

      if (
        localHarness.traversalRuntime.localReconciliationCorrectionCount >
        correctionEvents.length
      ) {
        correctionEvents.push(
          Object.freeze({
            correction: localHarness.traversalRuntime
              .authoritativeCorrectionTelemetrySnapshot,
            frame: frame + 1,
            surfaceRouting:
              localHarness.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
          })
        );
      }
    }

    assert.equal(
      localHarness.traversalRuntime.localReconciliationCorrectionCount,
      0,
      `expected zero shipped grounded-spawn authority corrections, received ${localHarness.traversalRuntime.localReconciliationCorrectionCount} with events ${JSON.stringify(correctionEvents)}`
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

test("MetaverseTraversalRuntime keeps sustained swim reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await createOpenWaterTraversalHarness();
  const authoritativeHarness = await createOpenWaterTraversalHarness();
  const correctionEvents = [];
  let authoritativeAccumulatorSeconds = 0;

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "swim");
    const swimStartZ = localHarness.traversalRuntime.cameraSnapshot.position.z;

    let latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
      authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
      authoritativeHarness.groundedBodyRuntime.snapshot,
      groundedFixedStepSeconds
    );

    for (let frame = 0; frame < 240; frame += 1) {
      localHarness.traversalRuntime.advance(forwardTravelInput, 1 / 60);
      authoritativeAccumulatorSeconds += 1 / 60;

      while (
        authoritativeAccumulatorSeconds + 0.000001 >= groundedFixedStepSeconds
      ) {
        const previousAuthoritativePose =
          authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot;

        authoritativeHarness.traversalRuntime.advance(
          forwardTravelInput,
          groundedFixedStepSeconds
        );

        latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
          previousAuthoritativePose,
          authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
          authoritativeHarness.groundedBodyRuntime.snapshot,
          groundedFixedStepSeconds
        );
        authoritativeAccumulatorSeconds = Math.max(
          0,
          authoritativeAccumulatorSeconds - groundedFixedStepSeconds
        );
      }

      syncAuthoritativeLocalPlayerPose(
        localHarness.traversalRuntime,
        latestAuthoritativeSnapshot
      );

      if (
        localHarness.traversalRuntime.localReconciliationCorrectionCount >
        correctionEvents.length
      ) {
        correctionEvents.push(
          Object.freeze({
            correction: localHarness.traversalRuntime
              .authoritativeCorrectionTelemetrySnapshot,
            frame: frame + 1,
            surfaceRouting:
              localHarness.traversalRuntime.surfaceRoutingLocalTelemetrySnapshot
          })
        );
      }
    }

    assert.equal(
      localHarness.traversalRuntime.localReconciliationCorrectionCount,
      0,
      `expected zero sustained swim authority corrections, received ${localHarness.traversalRuntime.localReconciliationCorrectionCount} with events ${JSON.stringify(correctionEvents)}`
    );
    assert.ok(localHarness.traversalRuntime.cameraSnapshot.position.z < swimStartZ - 0.9);
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});
