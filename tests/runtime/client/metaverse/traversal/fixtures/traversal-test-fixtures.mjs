import assert from "node:assert/strict";

import {
  resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset,
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  metaverseRealtimeWorldCadenceConfig,
  metaverseWorldSurfaceAssets,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  readMetaverseWorldSurfaceAssetAuthoring,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  resolveMetaverseWorldDynamicSurfaceColliders,
  resolveMetaverseWorldPlacedSurfaceColliders,
  shouldKeepMetaverseMountedOccupancyFreeRoam,
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

export const forwardTravelInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 1,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

export const boostedForwardTravelInput = Object.freeze({
  ...forwardTravelInput,
  boost: true
});

export function translateSyntheticWaterBayVector3(vector) {
  return freezeVector3(
    authoredWaterBayOpenWaterSpawn.x + vector.x,
    vector.y,
    authoredWaterBayOpenWaterSpawn.z + (vector.z - 24)
  );
}

export function offsetLocalPlanarPosition(
  position,
  rotationYRadians,
  localX,
  localZ
) {
  const sine = Math.sin(rotationYRadians);
  const cosine = Math.cos(rotationYRadians);

  return Object.freeze({
    x: position.x + localX * cosine + localZ * sine,
    y: position.y,
    z: position.z - localX * sine + localZ * cosine
  });
}

export function resolveLocalPlanarOffset(position, origin, rotationYRadians) {
  const deltaX = position.x - origin.x;
  const deltaZ = position.z - origin.z;
  const sine = Math.sin(-rotationYRadians);
  const cosine = Math.cos(-rotationYRadians);

  return Object.freeze({
    x: deltaX * cosine + deltaZ * sine,
    z: -deltaX * sine + deltaZ * cosine
  });
}

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function resolveSurfaceAsset(environmentAssetId) {
  return requireValue(
    readMetaverseWorldSurfaceAssetAuthoring(environmentAssetId),
    `${environmentAssetId} surface asset`
  );
}

export function createPlacedSurfaceAssetColliderSnapshots(assetPlacements) {
  return Object.freeze(
    assetPlacements.flatMap((assetPlacement) => {
      const surfaceAsset = resolveSurfaceAsset(assetPlacement.environmentAssetId);

      return resolveMetaverseWorldPlacedSurfaceColliders({
        environmentAssetId: surfaceAsset.environmentAssetId,
        placements: Object.freeze([
          Object.freeze({
            position: assetPlacement.position,
            rotationYRadians: assetPlacement.rotationYRadians ?? 0,
            scale: assetPlacement.scale ?? 1
          })
        ]),
        surfaceColliders: surfaceAsset.surfaceColliders
      });
    })
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
    lastProcessedTraversalSequence = 0,
    lastAcceptedJumpActionSequence = 0,
    lastProcessedJumpActionSequence = 0,
    pendingActionSequence: pendingActionSequenceOverride = 0,
    ...authoritativeSnapshot
  } = input;
  const mounted =
    (authoritativeSnapshot.mountedOccupancy !== null &&
      !shouldKeepMetaverseMountedOccupancyFreeRoam(
        authoritativeSnapshot.mountedOccupancy
      )) ||
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
    lastProcessedTraversalSequence,
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

export function createTraversalAuthoritySnapshot(
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
        : groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond > 0.05
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

export async function createTraversalFixtureContext() {
  const clientLoader = await createClientModuleLoader();

  async function loadMetaverseRuntimeConfig() {
    const { metaverseRuntimeConfig } = await clientLoader.load(
      "/src/metaverse/config/metaverse-runtime.ts"
    );

    return metaverseRuntimeConfig;
  }

  async function createShippedSurfaceColliderSnapshots() {
    return Object.freeze(
      metaverseWorldSurfaceAssets.flatMap((surfaceAsset) =>
        surfaceAsset.placement === "dynamic"
          ? []
          : resolveMetaverseWorldPlacedSurfaceColliders(surfaceAsset)
      )
    );
  }

  async function createTraversalHarness(options = {}) {
    const [
      { MetaverseTraversalRuntime },
      { metaverseRuntimeConfig },
      {
        MetaverseDynamicCuboidBodyRuntime,
        MetaverseGroundedBodyRuntime,
        RapierPhysicsRuntime
      }
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
    const staticSurfaceColliderSnapshots = (
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
    const surfaceColliderSnapshots = [...staticSurfaceColliderSnapshots];
    const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);
    const colliderMetadataByHandle = new Map();
    const dynamicSurfaceColliderHandlesByEnvironmentAssetId = new Map();
    const dynamicSurfaceColliderSnapshotsByEnvironmentAssetId = new Map();

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

    for (const collider of staticSurfaceColliderSnapshots) {
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
    const dynamicBodyRuntimesByEnvironmentAssetId = new Map();
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

    for (const environmentAssetId of options.dynamicBodyEnvironmentAssetIds ?? []) {
      const dynamicBodySurfaceAsset = resolveSurfaceAsset(environmentAssetId);

      assert.equal(
        dynamicBodySurfaceAsset.placement,
        "dynamic",
        `${environmentAssetId} should resolve to a dynamic environment asset`
      );
      assert.notEqual(
        dynamicBodySurfaceAsset.dynamicBody,
        null,
        `${environmentAssetId} should expose authored dynamic-body config`
      );
      assert.notEqual(
        dynamicBodySurfaceAsset.collider,
        null,
        `${environmentAssetId} should expose authored collider config`
      );
      assert.equal(
        dynamicBodySurfaceAsset.placements.length,
        1,
        `${environmentAssetId} should expose exactly one authored placement`
      );

      const dynamicBodyConfig =
        resolveMetaverseDynamicCuboidBodyConfigSnapshotFromSurfaceAsset(
          dynamicBodySurfaceAsset
        );

      assert.notEqual(
        dynamicBodyConfig,
        null,
        `${environmentAssetId} should expose one fully authored dynamic-body placement`
      );
      const dynamicBodyRuntime = new MetaverseDynamicCuboidBodyRuntime(
        dynamicBodyConfig,
        physicsRuntime
      );

      await dynamicBodyRuntime.init();
      dynamicBodyRuntime.syncSnapshot();
      dynamicBodyRuntimesByEnvironmentAssetId.set(
        environmentAssetId,
        dynamicBodyRuntime
      );
      dynamicCollisionPoseMap.set(
        environmentAssetId,
        Object.freeze({
          position: dynamicBodyRuntime.snapshot.position,
          yawRadians: dynamicBodyRuntime.snapshot.yawRadians
        })
      );
      dynamicPresentationPoseMap.set(
        environmentAssetId,
        Object.freeze({
          position: dynamicBodyRuntime.snapshot.position,
          yawRadians: dynamicBodyRuntime.snapshot.yawRadians
        })
      );
    }

    function syncTraversalHarnessSurfaceColliderSnapshots() {
      surfaceColliderSnapshots.length = 0;
      surfaceColliderSnapshots.push(...staticSurfaceColliderSnapshots);

      for (const dynamicSurfaceColliderSnapshots of
        dynamicSurfaceColliderSnapshotsByEnvironmentAssetId.values()) {
        surfaceColliderSnapshots.push(...dynamicSurfaceColliderSnapshots);
      }
    }

    function disposeDynamicSurfaceColliders(environmentAssetId) {
      const dynamicSurfaceColliderHandles =
        dynamicSurfaceColliderHandlesByEnvironmentAssetId.get(
          environmentAssetId
        ) ?? [];

      for (const collider of dynamicSurfaceColliderHandles) {
        colliderMetadataByHandle.delete(collider);
        physicsRuntime.removeCollider(collider);
      }

      dynamicSurfaceColliderHandlesByEnvironmentAssetId.delete(
        environmentAssetId
      );
      dynamicSurfaceColliderSnapshotsByEnvironmentAssetId.delete(
        environmentAssetId
      );
    }

    function syncDynamicSurfaceColliders(
      environmentAssetId,
      collisionPoseSnapshot
    ) {
      disposeDynamicSurfaceColliders(environmentAssetId);

      if (collisionPoseSnapshot === null) {
        syncTraversalHarnessSurfaceColliderSnapshots();
        return;
      }

      const dynamicSurfaceColliderSnapshots =
        resolveMetaverseWorldDynamicSurfaceColliders(
          environmentAssetId,
          collisionPoseSnapshot
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

      if (dynamicSurfaceColliderSnapshots.length === 0) {
        syncTraversalHarnessSurfaceColliderSnapshots();
        return;
      }

      const dynamicSurfaceColliderHandles = dynamicSurfaceColliderSnapshots.map(
        (colliderSnapshot) => {
          const colliderHandle = physicsRuntime.createFixedCuboidCollider(
            colliderSnapshot.halfExtents,
            colliderSnapshot.translation,
            colliderSnapshot.rotation
          );

          colliderMetadataByHandle.set(colliderHandle, colliderSnapshot);

          return colliderHandle;
        }
      );

      dynamicSurfaceColliderHandlesByEnvironmentAssetId.set(
        environmentAssetId,
        dynamicSurfaceColliderHandles
      );
      dynamicSurfaceColliderSnapshotsByEnvironmentAssetId.set(
        environmentAssetId,
        dynamicSurfaceColliderSnapshots
      );
      syncTraversalHarnessSurfaceColliderSnapshots();
    }

    for (const [environmentAssetId, collisionPoseSnapshot] of
      dynamicCollisionPoseMap.entries()) {
      syncDynamicSurfaceColliders(environmentAssetId, collisionPoseSnapshot);
    }

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
      readGroundedTraversalPlayerBlockers:
        options.readGroundedTraversalPlayerBlockers,
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
        syncDynamicEnvironmentPoses(environmentAssetId, poseSnapshot);
      },
      surfaceColliderSnapshots
    });

    function syncDynamicEnvironmentPoses(
      environmentAssetId,
      presentationPoseSnapshot,
      collisionPoseSnapshot = presentationPoseSnapshot
    ) {
      dynamicPoseWrites.push({
        environmentAssetId,
        poseSnapshot: presentationPoseSnapshot
      });

      syncDynamicSurfaceColliders(environmentAssetId, collisionPoseSnapshot);

      if (collisionPoseSnapshot === null) {
        dynamicCollisionPoseMap.delete(environmentAssetId);
      } else {
        dynamicCollisionPoseMap.set(environmentAssetId, collisionPoseSnapshot);
      }

      if (presentationPoseSnapshot === null) {
        dynamicPresentationPoseMap.delete(environmentAssetId);
        return;
      }

      dynamicPresentationPoseMap.set(
        environmentAssetId,
        presentationPoseSnapshot
      );
    }

    return {
      config,
      dynamicPoseWrites,
      dynamicBodyRuntimesByEnvironmentAssetId,
      groundedBodyRuntime,
      mountableEnvironmentConfigById,
      syncDynamicEnvironmentPoses,
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

  async function createShorelineTransitionTraversalHarness(options = {}) {
    const nextConfig = options.config ?? {};
    const elevatedSupportHeightMeters = authoredWaterBayOpenWaterSpawn.y + 0.42;
    const supportCenterX = authoredWaterBayOpenWaterSpawn.x - 1.25;
    const supportCenterZ = authoredWaterBayOpenWaterSpawn.z;

    return createTraversalHarness({
      ...options,
      includeGroundCollider: false,
      config: {
        ...nextConfig,
        camera: {
          ...(nextConfig.camera ?? {}),
          initialYawRadians: Math.PI / 2,
          spawnPosition: {
            x: supportCenterX,
            y: elevatedSupportHeightMeters + 1.62,
            z: supportCenterZ,
            ...(nextConfig.camera?.spawnPosition ?? {})
          }
        },
        groundedBody: {
          ...(nextConfig.groundedBody ?? {}),
          spawnPosition: {
            x: supportCenterX,
            y: elevatedSupportHeightMeters,
            z: supportCenterZ,
            ...(nextConfig.groundedBody?.spawnPosition ?? {})
          }
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(1.25, 0.21, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(
            supportCenterX,
            elevatedSupportHeightMeters - 0.21,
            supportCenterZ
          ),
          traversalAffordance: "support"
        }),
        ...(options.surfaceColliderSnapshots ?? [])
      ]
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

  async function createAuthoritativeGroundedSimulationHarness(options = {}) {
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

  async function createShippedTraversalHarness(options = {}) {
    const [{ metaverseRuntimeConfig }, surfaceColliderSnapshots] = await Promise.all(
      [
        clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
        createShippedSurfaceColliderSnapshots()
      ]
    );
    const nextConfig = options.config ?? {};

    return createTraversalHarness({
      ...options,
      config: {
        ...nextConfig,
        camera: {
          ...metaverseRuntimeConfig.camera,
          ...(nextConfig.camera ?? {})
        },
        groundedBody: {
          ...metaverseRuntimeConfig.groundedBody,
          ...(nextConfig.groundedBody ?? {})
        }
      },
      includeGroundCollider: false,
      surfaceColliderSnapshots:
        options.surfaceColliderSnapshots === undefined
          ? surfaceColliderSnapshots
          : [...surfaceColliderSnapshots, ...options.surfaceColliderSnapshots]
    });
  }

  function resolveGroundedEntryFrame(traversalRuntime, maxFrames = 240) {
    for (let frame = 0; frame < maxFrames; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);

      if (traversalRuntime.locomotionMode === "grounded") {
        return frame + 1;
      }
    }

    return null;
  }

  return Object.freeze({
    createAuthoritativeGroundedSimulationHarness,
    createGroundedSpawnOwnedTraversalHarness,
    createOpenWaterTraversalHarness,
    createShorelineTransitionTraversalHarness,
    createShippedTraversalHarness,
    createTraversalHarness,
    dispose: async () => {
      await clientLoader.close();
    },
    loadMetaverseRuntimeConfig,
    resolveGroundedEntryFrame
  });
}

export async function runReconciliationFreeAuthorityScenario({
  authoritativeHarness,
  authoritativeInput,
  frameCount,
  localDeltaSeconds = 1 / 60,
  localHarness,
  localInput,
  onAfterFrame = null,
  recordSurfaceRouting = false,
  resolveFrameMetadata = null
}) {
  const correctionEvents = [];
  let authoritativeAccumulatorSeconds = 0;
  let authoritativeElapsedSeconds = 0;
  let latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
    authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
    authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
    authoritativeHarness.groundedBodyRuntime.snapshot,
    groundedFixedStepSeconds
  );
  const createFrameMetadata = (frame, deltaSeconds, elapsedSeconds) =>
    resolveFrameMetadata?.(
      Object.freeze({
        authoritativeElapsedSeconds,
        authoritativeHarness,
        deltaSeconds,
        elapsedSeconds,
        frame,
        localHarness
      })
    ) ?? null;

  const resolveScenarioInput = (
    input,
    frame,
    deltaSeconds,
    harness,
    frameMetadata
  ) =>
    typeof input === "function"
      ? input(
          Object.freeze({
            deltaSeconds,
            elapsedSeconds: frame * deltaSeconds,
            frame,
            frameMetadata,
            harness
          })
        )
      : input;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const localElapsedSeconds = frame * localDeltaSeconds;
    const frameMetadata = createFrameMetadata(
      frame,
      localDeltaSeconds,
      localElapsedSeconds
    );

    localHarness.traversalRuntime.advance(
      resolveScenarioInput(
        localInput,
        frame,
        localDeltaSeconds,
        localHarness,
        frameMetadata
      ),
      localDeltaSeconds
    );
    authoritativeAccumulatorSeconds += localDeltaSeconds;

    while (
      authoritativeAccumulatorSeconds + 0.000001 >= groundedFixedStepSeconds
    ) {
      const previousAuthoritativePose =
        authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot;

      authoritativeHarness.traversalRuntime.advance(
        resolveScenarioInput(
          authoritativeInput,
          Math.round(authoritativeElapsedSeconds / groundedFixedStepSeconds),
          groundedFixedStepSeconds,
          authoritativeHarness,
          createFrameMetadata(
            Math.round(authoritativeElapsedSeconds / groundedFixedStepSeconds),
            groundedFixedStepSeconds,
            authoritativeElapsedSeconds
          )
        ),
        groundedFixedStepSeconds
      );

      latestAuthoritativeSnapshot = createTraversalAuthoritySnapshot(
        previousAuthoritativePose,
        authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
        authoritativeHarness.groundedBodyRuntime.snapshot,
        groundedFixedStepSeconds
      );
      authoritativeElapsedSeconds += groundedFixedStepSeconds;
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
          localPose: localHarness.traversalRuntime.localTraversalPoseSnapshot,
          locomotionMode: localHarness.traversalRuntime.locomotionMode,
          ...(frameMetadata === null ? {} : frameMetadata),
          reason:
            localHarness.traversalRuntime
              .lastLocalAuthorityPoseCorrectionReason,
          ...(recordSurfaceRouting
            ? {
                surfaceRouting:
                  localHarness.traversalRuntime
                    .surfaceRoutingLocalTelemetrySnapshot
              }
            : {})
        })
      );
    }

    onAfterFrame?.(
      Object.freeze({
        authoritativeElapsedSeconds,
        authoritativeHarness,
        correctionEvents,
        deltaSeconds: localDeltaSeconds,
        frame,
        frameMetadata,
        latestAuthoritativeSnapshot,
        localElapsedSeconds: (frame + 1) * localDeltaSeconds,
        localHarness
      })
    );
  }

  return Object.freeze({
    correctionEvents,
    latestAuthoritativeSnapshot
  });
}

export function formatAuthorityCorrectionEvents(correctionEvents) {
  return JSON.stringify(
    correctionEvents.map((event) =>
      Object.freeze({
        correction: event.correction,
        frame: event.frame,
        locomotionMode: event.locomotionMode ?? null,
        phaseElapsedSeconds: event.phaseElapsedSeconds ?? null,
        phaseFrame: event.phaseFrame ?? null,
        phaseLabel: event.phaseLabel ?? null,
        reason: event.reason ?? "unknown",
        surfaceRouting: event.surfaceRouting ?? null
      })
    )
  );
}

function resolveAuthorityCoursePhaseFrameCount(phase, localDeltaSeconds) {
  assert.equal(typeof phase.label, "string", "course phase label must be a string");
  assert.ok(
    phase.label.length > 0,
    "course phase label must not be empty"
  );

  if (phase.frameCount !== undefined) {
    assert.ok(
      Number.isInteger(phase.frameCount) && phase.frameCount > 0,
      `${phase.label} phase frameCount must be a positive integer`
    );

    return phase.frameCount;
  }

  assert.equal(
    typeof phase.durationSeconds,
    "number",
    `${phase.label} phase must define frameCount or durationSeconds`
  );
  assert.ok(
    Number.isFinite(phase.durationSeconds) && phase.durationSeconds > 0,
    `${phase.label} phase durationSeconds must be positive`
  );

  const roundedFrameCount = Math.round(phase.durationSeconds / localDeltaSeconds);
  const roundedDurationSeconds = roundedFrameCount * localDeltaSeconds;

  assert.ok(
    Math.abs(roundedDurationSeconds - phase.durationSeconds) < 0.000001,
    `${phase.label} phase durationSeconds must align to the local frame cadence`
  );

  return roundedFrameCount;
}

function createReconciliationFreeAuthorityCourseTimeline(
  phases,
  localDeltaSeconds
) {
  assert.ok(Array.isArray(phases) && phases.length > 0, "course phases are required");
  let startFrame = 0;
  let startSeconds = 0;

  return Object.freeze(
    phases.map((phase) => {
      const frameCount = resolveAuthorityCoursePhaseFrameCount(
        phase,
        localDeltaSeconds
      );
      const durationSeconds = frameCount * localDeltaSeconds;
      const resolvedPhase = Object.freeze({
        ...phase,
        durationSeconds,
        endFrameExclusive: startFrame + frameCount,
        endSecondsExclusive: startSeconds + durationSeconds,
        frameCount,
        startFrame,
        startSeconds
      });

      startFrame = resolvedPhase.endFrameExclusive;
      startSeconds = resolvedPhase.endSecondsExclusive;

      return resolvedPhase;
    })
  );
}

function resolveAuthorityCoursePhaseByElapsedSeconds(
  phaseTimeline,
  elapsedSeconds
) {
  return (
    phaseTimeline.find(
      (phase) => elapsedSeconds < phase.endSecondsExclusive - 0.000001
    ) ?? phaseTimeline.at(-1)
  );
}

function resolveAuthorityCoursePhaseMetadata(
  phaseTimeline,
  elapsedSeconds,
  localDeltaSeconds
) {
  const phase = resolveAuthorityCoursePhaseByElapsedSeconds(
    phaseTimeline,
    elapsedSeconds
  );
  const phaseElapsedSeconds = Math.max(0, elapsedSeconds - phase.startSeconds);
  const phaseFrame = Math.floor(
    phaseElapsedSeconds / localDeltaSeconds + 0.000001
  ) + 1;

  return Object.freeze({
    phaseElapsedSeconds,
    phaseFrame,
    phaseLabel: phase.label
  });
}

function resolveAuthorityCoursePhaseInput(
  phaseTimeline,
  inputOwner,
  context,
  localDeltaSeconds
) {
  const phase = resolveAuthorityCoursePhaseByElapsedSeconds(
    phaseTimeline,
    context.elapsedSeconds
  );
  const input =
    phase[inputOwner] ?? phase.input ?? phase.localInput ?? phase.authoritativeInput;
  const phaseMetadata = resolveAuthorityCoursePhaseMetadata(
    phaseTimeline,
    context.elapsedSeconds,
    localDeltaSeconds
  );

  return typeof input === "function"
    ? input(
        Object.freeze({
          ...context,
          ...phaseMetadata
        })
      )
    : input;
}

export async function runReconciliationFreeAuthorityCourse({
  authoritativeHarness,
  localDeltaSeconds = 1 / 60,
  localHarness,
  phases,
  recordSurfaceRouting = false
}) {
  const phaseTimeline = createReconciliationFreeAuthorityCourseTimeline(
    phases,
    localDeltaSeconds
  );
  const totalFrameCount = phaseTimeline.reduce(
    (frameCount, phase) => frameCount + phase.frameCount,
    0
  );
  const phaseSnapshots = [];

  const result = await runReconciliationFreeAuthorityScenario({
    authoritativeHarness,
    authoritativeInput(context) {
      return resolveAuthorityCoursePhaseInput(
        phaseTimeline,
        "authoritativeInput",
        context,
        localDeltaSeconds
      );
    },
    frameCount: totalFrameCount,
    localDeltaSeconds,
    localHarness,
    localInput(context) {
      return resolveAuthorityCoursePhaseInput(
        phaseTimeline,
        "localInput",
        context,
        localDeltaSeconds
      );
    },
    onAfterFrame(context) {
      const completedPhase = phaseTimeline.find(
        (phase) => phase.endFrameExclusive === context.frame + 1
      );

      if (completedPhase === undefined) {
        return;
      }

      phaseSnapshots.push(
        Object.freeze({
          authoritativeLocomotionMode:
            context.authoritativeHarness.traversalRuntime.locomotionMode,
          authoritativePose:
            context.authoritativeHarness.traversalRuntime.localTraversalPoseSnapshot,
          frame: context.frame + 1,
          localLocomotionMode: context.localHarness.traversalRuntime.locomotionMode,
          localPose: context.localHarness.traversalRuntime.localTraversalPoseSnapshot,
          phaseElapsedSeconds: completedPhase.durationSeconds,
          phaseLabel: completedPhase.label
        })
      );
    },
    recordSurfaceRouting,
    resolveFrameMetadata(context) {
      return resolveAuthorityCoursePhaseMetadata(
        phaseTimeline,
        context.elapsedSeconds,
        localDeltaSeconds
      );
    }
  });

  return Object.freeze({
    ...result,
    phaseSnapshots: Object.freeze(phaseSnapshots),
    phaseTimeline
  });
}

export function assertReconciliationFreeAuthorityScenario(
  resultOrCorrectionEvents,
  label
) {
  const correctionEvents = Array.isArray(resultOrCorrectionEvents)
    ? resultOrCorrectionEvents
    : resultOrCorrectionEvents.correctionEvents;

  assert.equal(
    correctionEvents.length,
    0,
    `expected zero ${label} authority corrections, received ${formatAuthorityCorrectionEvents(correctionEvents)}`
  );
}
