import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  metaverseRealtimeWorldCadenceConfig,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  shouldConsiderMetaverseWaterborneTraversalCollider
} from "@webgpu-metaverse/shared";

import { authoredWaterBayOpenWaterSpawn } from "../../../../metaverse-authored-world-test-fixtures.mjs";
import { createFakePhysicsRuntime } from "../../../fake-rapier-runtime.mjs";
import { createClientModuleLoader } from "../../../load-client-module.mjs";

export const groundedFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

export function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

export function translateSyntheticWaterBayVector3(vector) {
  return freezeVector3(
    authoredWaterBayOpenWaterSpawn.x + vector.x,
    vector.y,
    authoredWaterBayOpenWaterSpawn.z + (vector.z - 24)
  );
}

export function createMountedEnvironmentSnapshot(
  environmentAssetId,
  label = "Mounted vehicle",
  overrides = {}
) {
  return Object.freeze({
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directSeatTargets: Object.freeze([]),
    entryId: null,
    environmentAssetId,
    label,
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantLabel: "Take helm",
    occupantRole: "driver",
    seatTargets: Object.freeze([]),
    seatId: "driver-seat",
    ...overrides
  });
}

export function createFlatGroundSurfaceColliderSnapshot() {
  return Object.freeze({
    halfExtents: freezeVector3(4, 0.2, 4),
    rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
    translation: freezeVector3(0, -0.1, 24)
  });
}

export function createMountedAnchorKey(
  environmentAssetId,
  seatId = null,
  entryId = null
) {
  return `${environmentAssetId}:${seatId ?? "entry"}:${entryId ?? "seat"}`;
}

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

function createAuthoritativeLocalPlayerPoseSnapshot(input) {
  const {
    jumpAuthorityState = "grounded",
    lastProcessedInputSequence = 0,
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
    groundedBody:
      authoritativeSnapshot.groundedBody ??
      createMetaverseGroundedBodyRuntimeSnapshot({
        grounded: authoritativeSnapshot.locomotionMode !== "swim",
        linearVelocity: authoritativeSnapshot.linearVelocity,
        position: authoritativeSnapshot.position,
        yawRadians: authoritativeSnapshot.yawRadians
      }),
    lastProcessedInputSequence,
    swimBody:
      authoritativeSnapshot.swimBody ??
      (authoritativeSnapshot.locomotionMode === "swim"
        ? createMetaverseSurfaceDriveBodyRuntimeSnapshot({
            linearVelocity: authoritativeSnapshot.linearVelocity,
            position: authoritativeSnapshot.position,
            yawRadians: authoritativeSnapshot.yawRadians
          })
        : null),
    traversalAuthority:
      authoritativeSnapshot.traversalAuthority ??
      resolveMetaverseTraversalAuthoritySnapshotInput({
        currentTick: 0,
        jumpAuthorityState,
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

export function syncAuthoritativeLocalPlayerPose(
  traversalRuntime,
  authoritativePlayerSnapshot
) {
  traversalRuntime.syncAuthoritativeLocalPlayerPose(
    createAuthoritativeLocalPlayerPoseSnapshot(authoritativePlayerSnapshot)
  );
}

export async function createTraversalFixtureContext() {
  const clientLoader = await createClientModuleLoader();

  async function loadMetaverseRuntimeConfig() {
    const { metaverseRuntimeConfig } = await clientLoader.load(
      "/src/metaverse/config/metaverse-runtime.ts"
    );

    return metaverseRuntimeConfig;
  }

  async function createShippedSurfaceColliderSnapshots() {
    const [{ metaverseEnvironmentProofConfig }, { resolvePlacedCuboidColliders }] =
      await Promise.all([
        clientLoader.load("/src/metaverse/world/proof/index.ts"),
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
    const surfaceColliderSnapshots = (
      options.surfaceColliderSnapshots ?? []
    ).map((collider) =>
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
    const dynamicPresentationPoseMap = new Map(
      Object.entries(options.dynamicEnvironmentPoses ?? {})
    );
    const dynamicCollisionPoseMap = new Map(
      Object.entries(
        options.dynamicEnvironmentCollisionPoses ?? options.dynamicEnvironmentPoses ?? {}
      )
    );
    const mountedEnvironmentAnchorSnapshotsByKey = new Map(
      Object.entries(options.mountedEnvironmentAnchorSnapshots ?? {})
    );
    const mountableEnvironmentConfigById = new Map(
      Object.keys(
        options.dynamicEnvironmentCollisionPoses ?? options.dynamicEnvironmentPoses ?? {}
      ).map((environmentAssetId) => [
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
      readDynamicEnvironmentCollisionPose(environmentAssetId) {
        return dynamicCollisionPoseMap.get(environmentAssetId) ?? null;
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

        const dynamicPose = dynamicPresentationPoseMap.get(
          mountedEnvironment.environmentAssetId
        );

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
          dynamicCollisionPoseMap.delete(environmentAssetId);
          dynamicPresentationPoseMap.delete(environmentAssetId);
          return;
        }

        dynamicCollisionPoseMap.set(environmentAssetId, poseSnapshot);
        dynamicPresentationPoseMap.set(environmentAssetId, poseSnapshot);
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

  async function createShippedTraversalHarness() {
    const [{ metaverseRuntimeConfig }, surfaceColliderSnapshots] = await Promise.all(
      [
        clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
        createShippedSurfaceColliderSnapshots()
      ]
    );

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

  function resolveGroundedEntryFrame(traversalRuntime, maxFrames = 240) {
    for (let frame = 0; frame < maxFrames; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      if (traversalRuntime.locomotionMode === "grounded") {
        return frame + 1;
      }
    }

    return null;
  }

  return Object.freeze({
    createGroundedSpawnOwnedTraversalHarness,
    createOpenWaterTraversalHarness,
    createShippedTraversalHarness,
    createTraversalHarness,
    dispose: async () => {
      await clientLoader.close();
    },
    loadMetaverseRuntimeConfig,
    resolveGroundedEntryFrame
  });
}
