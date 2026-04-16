import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  metaverseRealtimeWorldCadenceConfig,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;
const groundedFixedStepSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;
const localPlayerRoutineLandingCorrectionThresholdMeters = 0.08;

function createMountedEnvironmentSnapshot(
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

class FakeRapierVector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class FakeColliderDesc {
  constructor(shape, payload) {
    this.payload = payload;
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.shape = shape;
    this.translation = new FakeRapierVector3(0, 0, 0);
  }

  setRotation(rotation) {
    this.rotation = rotation;

    return this;
  }

  setTranslation(x, y, z) {
    this.translation = new FakeRapierVector3(x, y, z);

    return this;
  }
}

class FakeCollider {
  constructor(shape, payload, translation, rotation = { x: 0, y: 0, z: 0, w: 1 }) {
    this.payload = payload;
    this.rotationQuaternion = rotation;
    this.shape = shape;
    this.translationVector = translation;
  }

  get standingOffset() {
    return this.shape === "capsule"
      ? this.payload.halfHeight + this.payload.radius
      : 0;
  }

  get bottomOffset() {
    return this.shape === "capsule"
      ? this.standingOffset
      : (this.payload.halfExtentY ?? 0);
  }

  get topOffset() {
    return this.shape === "capsule"
      ? this.standingOffset
      : (this.payload.halfExtentY ?? 0);
  }

  setRotation(rotation) {
    this.rotationQuaternion = rotation;
  }

  setTranslation(translation) {
    this.translationVector = new FakeRapierVector3(
      translation.x,
      translation.y,
      translation.z
    );
  }

  translation() {
    return this.translationVector;
  }
}

class FakeCharacterController {
  constructor(world) {
    this.autostepEnabled = false;
    this.grounded = false;
    this.lastMovement = new FakeRapierVector3(0, 0, 0);
    this.snapDistance = 0;
    this.stepHeight = 0;
    this.world = world;
  }

  computeColliderMovement(
    collider,
    desiredTranslationDelta,
    _filterFlags,
    _filterGroups,
    filterPredicate
  ) {
    const currentTranslation = collider.translation();
    const currentFootY = currentTranslation.y - collider.bottomOffset;
    const capsuleRadius =
      collider.payload.radius ??
      Math.max(collider.payload.halfExtentX ?? 0, collider.payload.halfExtentZ ?? 0);
    let nextCenterX = currentTranslation.x + desiredTranslationDelta.x;
    let nextCenterZ = currentTranslation.z + desiredTranslationDelta.z;
    const proposedSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius,
      filterPredicate
    );
    const effectiveProposedSurfaceY =
      this.snapDistance === 0 &&
      proposedSurfaceY !== null &&
      proposedSurfaceY < currentFootY
        ? null
        : proposedSurfaceY;

    if (
      effectiveProposedSurfaceY !== null &&
      effectiveProposedSurfaceY - currentFootY > this.snapDistance &&
      (!this.autostepEnabled ||
        effectiveProposedSurfaceY - currentFootY > this.stepHeight)
    ) {
      nextCenterX = currentTranslation.x;
      nextCenterZ = currentTranslation.z;
    }

    const supportingSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius,
      filterPredicate
    );
    const effectiveSupportingSurfaceY =
      this.snapDistance === 0 &&
      supportingSurfaceY !== null &&
      supportingSurfaceY < currentFootY
        ? null
        : supportingSurfaceY;
    const desiredFootY = currentFootY + desiredTranslationDelta.y;
    let nextFootY = desiredFootY;

    if (effectiveSupportingSurfaceY !== null) {
      if (effectiveSupportingSurfaceY > currentFootY) {
        const stepRise = effectiveSupportingSurfaceY - currentFootY;

        if (this.autostepEnabled && stepRise <= this.stepHeight) {
          nextFootY = effectiveSupportingSurfaceY;
        }
      }

      if (
        desiredTranslationDelta.y <= 0 &&
        desiredFootY <= effectiveSupportingSurfaceY + this.snapDistance
      ) {
        nextFootY = effectiveSupportingSurfaceY;
      }
    }

    const nextCenterY = nextFootY + collider.bottomOffset;
    const blockedPlanarPosition = this.resolveBlockedPlanarPosition(
      collider,
      currentTranslation,
      {
        x: nextCenterX,
        y: nextCenterY,
        z: nextCenterZ
      },
      filterPredicate
    );

    this.lastMovement = new FakeRapierVector3(
      blockedPlanarPosition.x - currentTranslation.x,
      nextCenterY - currentTranslation.y,
      blockedPlanarPosition.z - currentTranslation.z
    );
    this.grounded =
      effectiveSupportingSurfaceY !== null &&
      Math.abs(nextFootY - effectiveSupportingSurfaceY) <= 0.0001;
  }

  computedGrounded() {
    return this.grounded;
  }

  computedMovement() {
    return this.lastMovement;
  }

  enableSnapToGround(distance) {
    this.snapDistance = distance;
  }

  enableAutostep(maxHeight) {
    this.autostepEnabled = true;
    this.stepHeight = maxHeight;
  }

  disableAutostep() {
    this.autostepEnabled = false;
  }

  free() {}

  setApplyImpulsesToDynamicBodies() {}

  setCharacterMass() {}

  setMaxSlopeClimbAngle() {}

  setMinSlopeSlideAngle() {}

  findSurfaceY(centerX, centerZ, capsuleRadius, filterPredicate = undefined) {
    let highestSurfaceY = null;

    for (const candidate of this.world.queryColliders) {
      if (
        candidate === undefined ||
        (filterPredicate !== undefined && !filterPredicate(candidate))
      ) {
        continue;
      }

      if (candidate.shape !== "cuboid") {
        continue;
      }

      const halfExtentX = candidate.payload.halfExtentX ?? 0;
      const halfExtentY = candidate.payload.halfExtentY ?? 0;
      const halfExtentZ = candidate.payload.halfExtentZ ?? 0;
      const candidateTranslation = candidate.translation();

      if (
        Math.abs(centerX - candidateTranslation.x) > halfExtentX + capsuleRadius ||
        Math.abs(centerZ - candidateTranslation.z) > halfExtentZ + capsuleRadius
      ) {
        continue;
      }

      const surfaceY = candidateTranslation.y + halfExtentY;

      if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
        highestSurfaceY = surfaceY;
      }
    }

    return highestSurfaceY;
  }

  resolveBlockedPlanarPosition(
    collider,
    currentTranslation,
    proposedTranslation,
    filterPredicate = undefined
  ) {
    const colliderHalfExtentX =
      collider.payload.radius ?? (collider.payload.halfExtentX ?? 0);
    const colliderHalfExtentY = collider.bottomOffset;
    const colliderHalfExtentZ =
      collider.payload.radius ?? (collider.payload.halfExtentZ ?? 0);
    const currentFootY = currentTranslation.y - colliderHalfExtentY;
    const currentBottomY = proposedTranslation.y - colliderHalfExtentY;
    const currentTopY = proposedTranslation.y + collider.topOffset;

    for (const candidate of this.world.queryColliders) {
      if (
        candidate === collider ||
        candidate.shape !== "cuboid" ||
        (filterPredicate !== undefined && !filterPredicate(candidate))
      ) {
        continue;
      }

      const candidateTranslation = candidate.translation();
      const candidateHalfExtentX = candidate.payload.halfExtentX ?? 0;
      const candidateHalfExtentY = candidate.payload.halfExtentY ?? 0;
      const candidateHalfExtentZ = candidate.payload.halfExtentZ ?? 0;
      const candidateBottomY = candidateTranslation.y - candidateHalfExtentY;
      const candidateTopY = candidateTranslation.y + candidateHalfExtentY;

      if (
        currentTopY <= candidateBottomY ||
        currentBottomY >= candidateTopY ||
        candidateTopY <= currentBottomY + this.snapDistance ||
        candidateTopY <= currentFootY + this.snapDistance
      ) {
        continue;
      }

      const intersectsProposedPosition =
        Math.abs(proposedTranslation.x - candidateTranslation.x) <=
          candidateHalfExtentX + colliderHalfExtentX &&
        Math.abs(proposedTranslation.z - candidateTranslation.z) <=
          candidateHalfExtentZ + colliderHalfExtentZ;

      if (!intersectsProposedPosition) {
        continue;
      }

      return Object.freeze({
        x: currentTranslation.x,
        z: currentTranslation.z
      });
    }

    return Object.freeze({
      x: proposedTranslation.x,
      z: proposedTranslation.z
    });
  }
}

class FakeRapierWorld {
  constructor() {
    this.colliders = [];
    this.queryColliders = [];
    this.timestep = 1 / 60;
  }

  createCharacterController() {
    return new FakeCharacterController(this);
  }

  createCollider(colliderDesc) {
    const collider = new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation,
      colliderDesc.rotation
    );

    this.colliders.push(collider);

    return collider;
  }

  removeCollider(collider) {
    this.colliders = this.colliders.filter((candidate) => candidate !== collider);
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate !== collider
    );
  }

  step() {
    this.queryColliders = [...this.colliders];
  }
}

function createFakePhysicsRuntime(RapierPhysicsRuntime) {
  return new RapierPhysicsRuntime({
    async createPhysicsAddon() {
      return {
        RAPIER: {
          ColliderDesc: {
            capsule(halfHeight, radius) {
              return new FakeColliderDesc("capsule", {
                halfHeight,
                radius
              });
            },
            cuboid(halfExtentX, halfExtentY, halfExtentZ) {
              return new FakeColliderDesc("cuboid", {
                halfExtentX,
                halfExtentY,
                halfExtentZ
              });
            },
            trimesh(vertices, indices) {
              return new FakeColliderDesc("trimesh", {
                indices,
                vertices
              });
            }
          },
          Vector3: FakeRapierVector3
        },
        world: new FakeRapierWorld()
      };
    }
  });
}

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function assertApprox(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function assertGroundedBodySnapshotsMatch(leftSnapshot, rightSnapshot) {
  assert.equal(leftSnapshot.grounded, rightSnapshot.grounded);
  assert.equal(leftSnapshot.jumpReady, rightSnapshot.jumpReady);
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(
    leftSnapshot.planarSpeedUnitsPerSecond,
    rightSnapshot.planarSpeedUnitsPerSecond
  );
  assertApprox(
    leftSnapshot.verticalSpeedUnitsPerSecond,
    rightSnapshot.verticalSpeedUnitsPerSecond
  );
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
}

function assertCameraSnapshotsMatch(leftSnapshot, rightSnapshot) {
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(leftSnapshot.pitchRadians, rightSnapshot.pitchRadians);
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
}

function assertLocalTraversalPoseSnapshotsMatch(leftSnapshot, rightSnapshot) {
  assert.notEqual(leftSnapshot, null);
  assert.notEqual(rightSnapshot, null);
  assert.equal(leftSnapshot.locomotionMode, rightSnapshot.locomotionMode);
  assertApprox(leftSnapshot.position.x, rightSnapshot.position.x);
  assertApprox(leftSnapshot.position.y, rightSnapshot.position.y);
  assertApprox(leftSnapshot.position.z, rightSnapshot.position.z);
  assertApprox(leftSnapshot.yawRadians, rightSnapshot.yawRadians);
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
    pendingJumpActionSequence: pendingJumpActionSequenceOverride = 0,
    ...authoritativeSnapshot
  } = input;
  const mounted =
    authoritativeSnapshot.mountedOccupancy !== null ||
    authoritativeSnapshot.locomotionMode === "mounted";
  const resolvedJumpActionSequence =
    lastProcessedJumpActionSequence > lastAcceptedJumpActionSequence
      ? lastProcessedJumpActionSequence
      : lastAcceptedJumpActionSequence;
  const resolvedJumpActionState =
    lastProcessedJumpActionSequence > lastAcceptedJumpActionSequence
      ? "rejected-buffer-expired"
      : lastAcceptedJumpActionSequence > 0
        ? "accepted"
        : "none";
  const pendingJumpActionSequence = pendingJumpActionSequenceOverride;

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
          pendingJumpActionSequence > 0 ? "jump" : "none",
        pendingActionSequence: pendingJumpActionSequence,
        resolvedActionKind:
          resolvedJumpActionSequence > 0 ? "jump" : "none",
        resolvedActionSequence: resolvedJumpActionSequence,
        resolvedActionState: resolvedJumpActionState
      })
  });
}

function createTraversalIntentSnapshot(input) {
  const {
    boost = false,
    inputSequence = 0,
    jump = false,
    jumpActionSequence = 0,
    locomotionMode = "grounded",
    moveAxis = 0,
    strafeAxis = 0,
    yawAxis = 0
  } = input;
  const resolvedJumpActionSequence =
    jump === true || jumpActionSequence > 0 ? jumpActionSequence : 0;

  return Object.freeze({
    actionIntent: Object.freeze({
      kind: resolvedJumpActionSequence > 0 ? "jump" : "none",
      pressed: jump === true,
      sequence: resolvedJumpActionSequence
    }),
    bodyControl: Object.freeze({
      boost,
      moveAxis,
      strafeAxis,
      turnAxis: yawAxis
    }),
    inputSequence,
    locomotionMode
  });
}

function syncAuthoritativeLocalPlayerPose(
  traversalRuntime,
  authoritativePlayerSnapshot,
  latestIssuedJumpActionSequence = 0
) {
  traversalRuntime.syncAuthoritativeLocalPlayerPose(
    createAuthoritativeLocalPlayerPoseSnapshot(authoritativePlayerSnapshot),
    latestIssuedJumpActionSequence
  );
}

function reconcileAckedAuthoritativeLocalPlayerPose(
  traversalRuntime,
  authoritativePlayerSnapshot,
  authoritativeReplaySeconds,
  activeTraversalIntent,
  latestIssuedJumpActionSequence = 0
) {
  traversalRuntime.reconcileAckedAuthoritativeLocalPlayerPose(
    createAuthoritativeLocalPlayerPoseSnapshot(authoritativePlayerSnapshot),
    authoritativeReplaySeconds,
    activeTraversalIntent,
    latestIssuedJumpActionSequence
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

const forwardJumpTravelInput = Object.freeze({
  ...forwardTravelInput,
  jump: true
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

        if (colliderMetadata.traversalAffordance === "support") {
          return false;
        }

        return (
          excludedOwnerEnvironmentAssetId === null ||
          colliderMetadata.ownerEnvironmentAssetId !==
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

function resolveGroundedEntryFrame(traversalRuntime, maxFrames = 240) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    traversalRuntime.advance(forwardTravelInput, 1 / 60);

    if (traversalRuntime.locomotionMode === "grounded") {
      return frame + 1;
    }
  }

  return null;
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseTraversalRuntime resolves grounded support from local surface colliders", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.2, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.1, 24)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(
      traversalRuntime.cameraSnapshot.position.y >
        config.groundedBody.eyeHeightMeters
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime anchors the grounded first-person camera at capsule eye height", async () => {
  const [
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const { config, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      config: {
        camera: {
          ...metaverseRuntimeConfig.camera,
          initialYawRadians: 0
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.2, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.1, 24)
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.advance(forwardTravelInput, 1 / 60);

    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.x -
          groundedBodyRuntime.snapshot.position.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.y -
          (groundedBodyRuntime.snapshot.position.y +
            groundedBodyRuntime.snapshot.eyeHeightMeters)
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        traversalRuntime.cameraSnapshot.position.z -
          (groundedBodyRuntime.snapshot.position.z -
            config.bodyPresentation.groundedFirstPersonForwardOffsetMeters)
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime steers grounded and swim character yaw from look input", async () => {
  const groundedHarness = await createTraversalHarness({
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 4),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ]
  });
  const swimHarness = await createTraversalHarness();
  const lookRightInput = Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    pitchAxis: 0,
    primaryAction: false,
    secondaryAction: false,
    strafeAxis: 0,
    yawAxis: 1
  });

  try {
    groundedHarness.traversalRuntime.boot();
    assert.equal(groundedHarness.traversalRuntime.locomotionMode, "grounded");

    const groundedStartYaw =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    groundedHarness.traversalRuntime.advance(
      lookRightInput,
      groundedFixedStepSeconds
    );

    assert.ok(
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians >
        groundedStartYaw
    );
    assert.equal(
      groundedHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians,
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians
    );

    swimHarness.traversalRuntime.boot();
    assert.equal(swimHarness.traversalRuntime.locomotionMode, "swim");

    const swimStartYaw = swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    assert.ok(swimHarness.traversalRuntime.cameraSnapshot.yawRadians > swimStartYaw);
    assert.equal(
      swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians,
      swimHarness.traversalRuntime.cameraSnapshot.yawRadians
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine authoritative unmounted yaw drift while keeping local look client-owned", async () => {
  const groundedHarness = await createTraversalHarness({
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 4),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ]
  });
  const swimHarness = await createTraversalHarness();
  const lookRightInput = Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    pitchAxis: 0,
    primaryAction: false,
    secondaryAction: false,
    strafeAxis: 0,
    yawAxis: 1
  });

  try {
    groundedHarness.traversalRuntime.boot();
    groundedHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const groundedCameraYawBeforeCorrection =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const groundedBodyYawBeforeCorrection =
      groundedHarness.groundedBodyRuntime.snapshot.yawRadians;
    const groundedTraversalPose =
      groundedHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(groundedTraversalPose !== null);

    syncAuthoritativeLocalPlayerPose(groundedHarness.traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedTraversalPose.position,
      yawRadians: groundedTraversalPose.yawRadians - 0.3
    });

    assert.ok(
      Math.abs(
        groundedHarness.traversalRuntime.cameraSnapshot.yawRadians -
          groundedCameraYawBeforeCorrection
      ) < 0.000001
    );
    assert.equal(groundedHarness.traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.ok(
      Math.abs(
        groundedHarness.groundedBodyRuntime.snapshot.yawRadians -
          groundedBodyYawBeforeCorrection
      ) < 0.000001
    );

    swimHarness.traversalRuntime.boot();
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const swimCameraYawBeforeCorrection =
      swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const swimPresentationYawBeforeCorrection =
      swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0;
    const swimTraversalPose = swimHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(swimTraversalPose !== null);
    assert.equal(swimTraversalPose.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(swimHarness.traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: swimTraversalPose.position,
      yawRadians: swimTraversalPose.yawRadians - 0.3
    });

    assert.ok(
      Math.abs(
        swimHarness.traversalRuntime.cameraSnapshot.yawRadians -
          swimCameraYawBeforeCorrection
      ) < 0.000001
    );
    assert.equal(swimHarness.traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.ok(
      Math.abs(
        (swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0) -
          swimPresentationYawBeforeCorrection
      ) < 0.000001
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores gross authoritative unmounted yaw drift while keeping local look client-owned", async () => {
  const groundedHarness = await createTraversalHarness({
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: freezeVector3(4, 0.2, 4),
        rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
        translation: freezeVector3(0, -0.1, 24)
      })
    ]
  });
  const swimHarness = await createTraversalHarness();
  const lookRightInput = Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    pitchAxis: 0,
    primaryAction: false,
    secondaryAction: false,
    strafeAxis: 0,
    yawAxis: 1
  });
  try {
    groundedHarness.traversalRuntime.boot();
    groundedHarness.traversalRuntime.advance(lookRightInput, groundedFixedStepSeconds);

    const groundedLookYaw =
      groundedHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const groundedTraversalPoseBeforeCorrection =
      groundedHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(groundedTraversalPoseBeforeCorrection !== null);

    syncAuthoritativeLocalPlayerPose(groundedHarness.traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedTraversalPoseBeforeCorrection.position,
      yawRadians: groundedTraversalPoseBeforeCorrection.yawRadians - 0.7
    });

    assert.equal(
      groundedHarness.traversalRuntime.localReconciliationCorrectionCount,
      0
    );
    assert.ok(
      Math.abs(groundedHarness.groundedBodyRuntime.snapshot.yawRadians - groundedLookYaw) <
        0.000001
    );

    swimHarness.traversalRuntime.boot();
    swimHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

    const swimLookYaw = swimHarness.traversalRuntime.cameraSnapshot.yawRadians;
    const swimTraversalPoseBeforeCorrection =
      swimHarness.traversalRuntime.localTraversalPoseSnapshot;

    assert.ok(swimTraversalPoseBeforeCorrection !== null);
    assert.equal(swimTraversalPoseBeforeCorrection.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(swimHarness.traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: swimTraversalPoseBeforeCorrection.position,
      yawRadians: swimTraversalPoseBeforeCorrection.yawRadians - 0.7
    });

    assert.equal(
      swimHarness.traversalRuntime.localReconciliationCorrectionCount,
      0
    );
    assert.ok(
      Math.abs(
        (swimHarness.traversalRuntime.characterPresentationSnapshot?.yawRadians ?? 0) -
          swimLookYaw
      ) < 0.000001
    );
  } finally {
    groundedHarness.groundedBodyRuntime.dispose();
    swimHarness.groundedBodyRuntime.dispose();
  }
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

test("MetaverseTraversalRuntime applies authoritative mounted vehicle poses for passenger occupancy", async () => {
  const { groundedBodyRuntime, traversalRuntime } = await createTraversalHarness({
    dynamicEnvironmentPoses: {
      "metaverse-hub-skiff-v1": Object.freeze({
        position: freezeVector3(0, 0.3, 18),
        yawRadians: 0
      })
    },
    mountableEnvironmentConfigs: {
      "metaverse-hub-skiff-v1": {
        label: "Metaverse hub skiff",
        seats: [
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
          }),
          Object.freeze({
            cameraPolicyId: "seat-follow",
            controlRoutingPolicyId: "look-only",
            directEntryEnabled: true,
            dismountOffset: freezeVector3(0, 0, 1),
            label: "Port bench",
            lookLimitPolicyId: "passenger-bench",
            occupancyAnimationId: "seated",
            seatId: "port-bench-seat",
            seatNodeName: "port_bench_seat",
            seatRole: "passenger"
          })
        ]
      }
    }
  });

  try {
    traversalRuntime.boot();
    traversalRuntime.occupySeat("metaverse-hub-skiff-v1", "port-bench-seat");

    traversalRuntime.syncAuthoritativeVehiclePose("metaverse-hub-skiff-v1", {
      position: freezeVector3(6, 0.55, 14),
      yawRadians: 0.8
    });

    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "seated"
    );
    assert.ok(
      Math.abs(traversalRuntime.cameraSnapshot.position.x - 6) < 4
    );
    assert.ok(
      Math.abs(traversalRuntime.characterPresentationSnapshot?.position.x - 6) <
        0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime applies authoritative mounted vehicle corrections for local driver occupancy", async () => {
  const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      dynamicEnvironmentPoses: {
        "metaverse-hub-skiff-v1": Object.freeze({
          position: freezeVector3(0, 0.3, 18),
          yawRadians: 0
        })
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.occupySeat("metaverse-hub-skiff-v1", "driver-seat");

    const poseWriteCountBeforeSync = dynamicPoseWrites.length;

    traversalRuntime.syncAuthoritativeVehiclePose("metaverse-hub-skiff-v1", {
      position: freezeVector3(6, 0.55, 14),
      yawRadians: 0.8
    });

    assert.equal(dynamicPoseWrites.length, poseWriteCountBeforeSync + 1);
    assert.ok(
      Math.abs(
        (traversalRuntime.characterPresentationSnapshot?.position.x ?? 0) - 6
      ) <
        0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime routes mounted vehicle occupancy through the traversal owner and restores swim on dismount", async () => {
  const vehicleAssetId = "metaverse-test-canoe-v1";
  const { config, dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      }
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(
        vehicleAssetId,
        "Metaverse test canoe"
      )
    );

    assert.equal(traversalRuntime.locomotionMode, "mounted");
    assert.equal(dynamicPoseWrites.at(-1)?.environmentAssetId, vehicleAssetId);
    const mountedCamera = traversalRuntime.cameraSnapshot;

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 1
      }),
      1 / 60
    );

    const mountedVehiclePoseAfterMouseLook =
      dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(mountedVehiclePoseAfterMouseLook?.yawRadians > 0);
    assert.equal(
      traversalRuntime.cameraSnapshot.yawRadians,
      mountedVehiclePoseAfterMouseLook?.yawRadians
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.yawRadians,
      mountedVehiclePoseAfterMouseLook?.yawRadians
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians > mountedCamera.yawRadians
    );
    assert.ok(dynamicPoseWrites.length >= 2);

    traversalRuntime.syncMountedEnvironment(null);

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.cameraSnapshot.position.y,
      config.ocean.height +
        config.swim.cameraEyeHeightMeters +
        config.bodyPresentation.swimThirdPersonHeightOffsetMeters
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime maps mounted driver input onto vehicle-local travel axes", async () => {
  const initialPosition = freezeVector3(0, 0.12, 24);
  const cases = [
    {
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
      label: "forward",
      validate(poseSnapshot) {
        assert.ok(poseSnapshot.position.z < initialPosition.z);
        assert.equal(poseSnapshot.yawRadians, 0);
      }
    },
    {
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
      label: "backward",
      validate(poseSnapshot) {
        assert.ok(poseSnapshot.position.z > initialPosition.z);
        assert.equal(poseSnapshot.yawRadians, 0);
      }
    },
    {
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
      label: "turn-left",
      validate(poseSnapshot) {
        assert.equal(poseSnapshot.position.x, initialPosition.x);
        assert.equal(poseSnapshot.position.z, initialPosition.z);
        assert.ok(poseSnapshot.yawRadians < 0);
      }
    },
    {
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
      label: "turn-right",
      validate(poseSnapshot) {
        assert.equal(poseSnapshot.position.x, initialPosition.x);
        assert.equal(poseSnapshot.position.z, initialPosition.z);
        assert.ok(poseSnapshot.yawRadians > 0);
      }
    }
  ];

  for (const inputCase of cases) {
    const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
      await createTraversalHarness({
        dynamicEnvironmentPoses: {
          "metaverse-hub-skiff-v1": Object.freeze({
            position: initialPosition,
            yawRadians: 0
          })
        }
      });

    try {
      traversalRuntime.boot();
      traversalRuntime.syncMountedEnvironment(
        createMountedEnvironmentSnapshot(
          "metaverse-hub-skiff-v1",
          "Metaverse hub skiff"
        )
      );
      traversalRuntime.advance(inputCase.input, 0.25);

      const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

      assert.ok(poseSnapshot, `Missing mounted driver pose for ${inputCase.label}.`);
      inputCase.validate(poseSnapshot);
    } finally {
      groundedBodyRuntime.dispose();
    }
  }
});

test("MetaverseTraversalRuntime suppresses vehicle steering for passenger control policy", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const initialPosition = freezeVector3(0, 0.12, 24);
  const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: initialPosition,
          yawRadians: 0
        })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Passenger seat",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "passenger-seat",
              seatNodeName: "passenger_seat",
              seatRole: "passenger"
            })
          ]
        }
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(
        vehicleAssetId,
        "Metaverse test shuttle",
        {
          controlRoutingPolicyId: "look-only",
          occupantLabel: "Passenger seat",
          occupantRole: "passenger",
          seatId: "passenger-seat",
          occupancyKind: "seat"
        }
      )
    );
    traversalRuntime.advance(
      Object.freeze({
        boost: true,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 1,
        yawAxis: 1
      }),
      0.25
    );

    const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(poseSnapshot);
    assert.equal(poseSnapshot.position.x, initialPosition.x);
    assert.equal(poseSnapshot.position.y, initialPosition.y);
    assert.equal(poseSnapshot.position.z, initialPosition.z);
    assert.equal(poseSnapshot.yawRadians, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps standing deck entry occupancy grounded and walkable", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
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
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedPosition = traversalRuntime.characterPresentationSnapshot?.position;

    assert.equal(traversalRuntime.mountedEnvironmentSnapshot?.entryId, "deck-entry");
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
    assert.ok(boardedPosition);
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(Math.abs(groundedBodyRuntime.snapshot.position.y - 1) < 0.05);
    assert.ok(Math.abs((boardedPosition?.x ?? 0) - deckEntryAnchor.x) < 0.5);
    assert.ok(Math.abs((boardedPosition?.z ?? 0) - deckEntryAnchor.z) < 0.5);

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
      0.25
    );

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "walk"
    );
    assert.ok(
      Math.hypot(
        (traversalRuntime.characterPresentationSnapshot?.position.x ?? 0) -
          (boardedPosition?.x ?? 0),
        (traversalRuntime.characterPresentationSnapshot?.position.z ?? 0) -
          (boardedPosition?.z ?? 0)
      ) > 0.001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps passenger camera look seat-local while mounted truth stays vehicle-owned", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const initialPosition = freezeVector3(0, 0.12, 24);
  const passengerSeatYawRadians = 0.35;
  const {
    dynamicPoseWrites,
    groundedBodyRuntime,
    traversalRuntime
  } = await createTraversalHarness({
    dynamicEnvironmentPoses: {
      [vehicleAssetId]: Object.freeze({
        position: initialPosition,
        yawRadians: 0
      })
    },
    mountedEnvironmentAnchorSnapshots: {
      [createMountedAnchorKey(vehicleAssetId, "passenger-seat", null)]:
        Object.freeze({
          position: freezeVector3(-0.25, 1.02, 23.52),
          yawRadians: passengerSeatYawRadians
        })
    },
    mountableEnvironmentConfigs: {
      [vehicleAssetId]: {
        label: "Metaverse test shuttle",
        seats: [
          Object.freeze({
            cameraPolicyId: "seat-follow",
            controlRoutingPolicyId: "look-only",
            directEntryEnabled: true,
            dismountOffset: freezeVector3(0, 0, 1),
            label: "Passenger seat",
            lookLimitPolicyId: "passenger-bench",
            occupancyAnimationId: "seated",
            seatId: "passenger-seat",
            seatNodeName: "passenger_seat",
            seatRole: "passenger"
          })
        ]
      }
    }
  });

  try {
    traversalRuntime.boot();
    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(
        vehicleAssetId,
        "Metaverse test shuttle",
        {
          cameraPolicyId: "seat-follow",
          controlRoutingPolicyId: "look-only",
          occupantLabel: "Passenger seat",
          occupantRole: "passenger",
          lookLimitPolicyId: "passenger-bench",
          seatId: "passenger-seat",
          occupancyKind: "seat"
        }
      )
    );

    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.yawRadians,
      0
    );
    assert.equal(
      traversalRuntime.cameraSnapshot.yawRadians,
      passengerSeatYawRadians
    );

    for (let frame = 0; frame < 90; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 1,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 1
        }),
        1 / 60
      );
    }

    const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(poseSnapshot);
    assert.equal(poseSnapshot.position.x, initialPosition.x);
    assert.equal(poseSnapshot.position.z, initialPosition.z);
    assert.equal(poseSnapshot.yawRadians, 0);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.yawRadians,
      0
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians > passengerSeatYawRadians
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians <
        passengerSeatYawRadians + Math.PI * 0.46
    );
    assert.ok(traversalRuntime.cameraSnapshot.pitchRadians <= 0.42);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps swim character presentation partially submerged for idle and moving swim", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness();

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "swim-idle"
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.position.y,
      config.ocean.height -
        config.bodyPresentation.swimIdleBodySubmersionDepthMeters
    );
    assert.equal(
      traversalRuntime.cameraSnapshot.position.y,
      config.ocean.height +
        config.swim.cameraEyeHeightMeters +
        config.bodyPresentation.swimThirdPersonHeightOffsetMeters
    );

    for (let frame = 0; frame < 20; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "swim"
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.position.y,
      config.ocean.height -
        config.bodyPresentation.swimMovingBodySubmersionDepthMeters
    );
    assert.equal(
      traversalRuntime.cameraSnapshot.position.y,
      config.ocean.height +
        config.swim.cameraEyeHeightMeters +
        config.bodyPresentation.swimThirdPersonHeightOffsetMeters
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime routes spacebar jump intent through up, mid, and down animation phases", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const observedVocabularies = new Set();

    for (let frame = 0; frame < 180; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: frame === 0,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      const animationVocabulary =
        traversalRuntime.characterPresentationSnapshot?.animationVocabulary;

      if (animationVocabulary !== undefined) {
        observedVocabularies.add(animationVocabulary);
      }
    }

    assert.ok(observedVocabularies.has("jump-up"));
    assert.ok(
      observedVocabularies.has("jump-mid") ||
        observedVocabularies.has("jump-down")
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime reports local traversal startup once a buffered jump edge is stamped with a shared action sequence", async () => {
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
      groundedFixedStepSeconds * 0.5
    );

    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      createTraversalIntentSnapshot({
        boost: false,
        inputSequence: 1,
        jump: true,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      })
    );

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "startup"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionSequence,
      1
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime advances local traversal authority from rising back to idle after a stamped jump arc lands", async () => {
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

    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      createTraversalIntentSnapshot({
        boost: false,
        inputSequence: 1,
        jump: true,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      })
    );

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "rising"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence,
      1
    );

    let stepCount = 0;

    while (
      groundedBodyRuntime.snapshot.grounded !== true &&
      stepCount < 60
    ) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        groundedFixedStepSeconds
      );
      traversalRuntime.syncIssuedTraversalIntentSnapshot(
        createTraversalIntentSnapshot({
          boost: false,
          inputSequence: 1,
          jump: false,
          jumpActionSequence: 1,
          locomotionMode: "grounded",
          moveAxis: 0,
          strafeAxis: 0,
          yawAxis: 0
        })
      );
      stepCount += 1;
    }

    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "none"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "idle"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence,
      1
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps authoritative airborne grounded corrections midair instead of flattening them onto support", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "rising",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0.6,
        y: 3.4,
        z: -0.8
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: Object.freeze({
        x: 0.2,
        y: 1.2,
        z: 23.4
      }),
      yawRadians: Math.PI * 0.14
    });

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(Math.abs(groundedBodyRuntime.snapshot.position.y - 1.2) < 0.0001);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond - 3.4
      ) < 0.0001
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "jump-up"
    );
    assert.ok(
      Math.abs(
        (traversalRuntime.characterPresentationSnapshot?.position.y ?? 0) - 1.2
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a local grounded jump ascent against routine authoritative grounded corrections", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

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
    assert.ok(localJumpSnapshot.position.y > groundedSnapshot.position.y);
    assert.ok(localJumpSnapshot.verticalSpeedUnitsPerSecond > 0);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    }, 1);

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      groundedBodyRuntime.snapshot.position.y >= localJumpSnapshot.position.y
    );
    assert.ok(groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "jump-up"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime applies authoritative grounded correction once the issued jump edge is explicitly rejected", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

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

    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(groundedBodyRuntime.snapshot.position.y > groundedSnapshot.position.y);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionKind: "none",
        lastConsumedActionSequence: 0,
        lastRejectedActionKind: "jump",
        lastRejectedActionReason: "buffer-expired",
        lastRejectedActionSequence: 1,
        phaseStartedAtTick: 2
      }),
      yawRadians: groundedSnapshot.yawRadians
    }, 1);

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "jump-rejected"
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y) <
        0.0001
    );
    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond) < 0.0001
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    }, 1);

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime buffers a grounded jump tap in shared local traversal authority until the body becomes jump-ready", async () => {
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

  try {
    traversalRuntime.boot();
    groundedBodyRuntime.teleport(
      freezeVector3(0, 0.35, 24),
      groundedBodyRuntime.snapshot.yawRadians
    );
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

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

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "startup"
    );
    assert.ok(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionSequence > 0
    );
    assert.ok(groundedBodyRuntime.snapshot.position.y <= 0.35);

    for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        groundedFixedStepSeconds
      );

      if (
        groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.35
      ) {
        break;
      }
    }

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionKind,
      "jump"
    );
    assert.ok(
      groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.35
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime consumes a grounded jump from snap-distance support through shared local traversal authority", async () => {
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

  try {
    traversalRuntime.boot();
    groundedBodyRuntime.teleport(
      freezeVector3(0, 0.12, 24),
      groundedBodyRuntime.snapshot.yawRadians
    );

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

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionKind,
      "jump"
    );
    assert.ok(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence > 0
    );
    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      if (
        groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.12
      ) {
        break;
      }

      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        groundedFixedStepSeconds
      );
    }

    assert.ok(
      groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.12
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores a rejected jump once local grounded state is already aligned", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime consumes a rejected jump edge once during acked replay reconciliation", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

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

    const rejectedJumpAuthoritySnapshot = {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      traversalAuthority: Object.freeze({
        currentActionKind: "none",
        currentActionPhase: "idle",
        currentActionSequence: 0,
        lastConsumedActionKind: "none",
        lastConsumedActionSequence: 0,
        lastRejectedActionKind: "jump",
        lastRejectedActionReason: "buffer-expired",
        lastRejectedActionSequence: 1,
        phaseStartedAtTick: 2
      }),
      yawRadians: groundedSnapshot.yawRadians
    };
    const activeTraversalIntent = createTraversalIntentSnapshot({
      boost: false,
      inputSequence: 1,
      jump: false,
      jumpActionSequence: 1,
      locomotionMode: "grounded",
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    });

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      rejectedJumpAuthoritySnapshot,
      groundedFixedStepSeconds,
      activeTraversalIntent,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 1);

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      rejectedJumpAuthoritySnapshot,
      groundedFixedStepSeconds,
      activeTraversalIntent,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 1);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime follows authoritative airborne jump phase changes even when the positional error is routine-sized", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneRoutineErrorPosition = freezeVector3(
      groundedSnapshot.position.x,
      groundedSnapshot.position.y +
        localPlayerRoutineLandingCorrectionThresholdMeters * 0.5,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneRoutineErrorPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "ground-state-mismatch"
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineErrorPosition.y
      ) < 0.0001
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "jump-mid"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores pure authoritative ground-state flicker when the local pose is aligned", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const authoritativeAirbornePose = {
      jumpAuthorityState: "falling",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    };

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      authoritativeAirbornePose
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y
      ) < 0.0001
    );

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      authoritativeAirbornePose,
      groundedFixedStepSeconds,
      null
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime resolves an accepted jump edge before later zero-distance grounded flicker", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneRoutineErrorPosition = freezeVector3(
      groundedSnapshot.position.x,
      groundedSnapshot.position.y +
        localPlayerRoutineLandingCorrectionThresholdMeters * 0.5,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneRoutineErrorPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, 0, 0),
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    });
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y) <
        0.0001
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine accepted-jump landing mismatch before the local body settles", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneRoutineLandingPosition = freezeVector3(
      groundedSnapshot.position.x,
      groundedSnapshot.position.y +
        localPlayerRoutineLandingCorrectionThresholdMeters * 0.5,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneRoutineLandingPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.lastLocalAuthorityPoseCorrectionReason, "ground-state-mismatch");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      groundedFixedStepSeconds,
      null,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves an accepted jump landing arc against moderate authoritative grounded recovery", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.18,
      groundedSnapshot.position.y + 0.55,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.2,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      groundedFixedStepSeconds,
      null,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime resolves accepted jump landing state from traversal authority when legacy jump fields lag", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.18,
      groundedSnapshot.position.y + 0.55,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 0,
        linearVelocity: Object.freeze({
          x: 0.2,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        traversalAuthority: Object.freeze({
          currentActionKind: "jump",
          currentActionPhase: "falling",
          currentActionSequence: 1,
          lastConsumedActionKind: "jump",
          lastConsumedActionSequence: 1,
          lastRejectedActionKind: "none",
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 2
        }),
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 0,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        traversalAuthority: Object.freeze({
          currentActionKind: "none",
          currentActionPhase: "idle",
          currentActionSequence: 0,
          lastConsumedActionKind: "jump",
          lastConsumedActionSequence: 1,
          lastRejectedActionKind: "none",
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 3
        }),
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps accepted jump landing hold active until the local body actually regrounds", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.15,
      groundedSnapshot.position.y + 0.47,
      groundedSnapshot.position.z
    );
    const acceptedGroundedAuthoritySnapshot = {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 1,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    };

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.15,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 0,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      0.25
    );

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, 0, 0),
      position: airborneLandingCarryPosition,
      yawRadians: groundedSnapshot.yawRadians
    });
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves an accepted moving jump landing arc above the routine correction window", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 1.27,
      groundedSnapshot.position.y + 0.47,
      groundedSnapshot.position.z
    );
    const acceptedGroundedAuthoritySnapshot = {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 1,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 0.18,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    };

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.4,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(traversalRuntime, 
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - airborneLandingCarryPosition.x
      ) < 0.0001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    reconcileAckedAuthoritativeLocalPlayerPose(traversalRuntime, 
      acceptedGroundedAuthoritySnapshot,
      groundedFixedStepSeconds,
      null,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(traversalRuntime.ackedAuthoritativeReplayCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime reports gross divergence as the last local-authority pose snap reason", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 4.1,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    });

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "gross-position-divergence"
    );
    assert.ok(Math.abs(groundedBodyRuntime.snapshot.position.x - 4.1) < 0.0001);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores moderate grounded authoritative divergence without counting a pose snap", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 1.8,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    });

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - groundedSnapshot.position.x
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores moderate swim authoritative divergence without counting a pose snap", async () => {
  const { groundedBodyRuntime, traversalRuntime } = await createTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "swim");

    const swimSnapshot = traversalRuntime.localTraversalPoseSnapshot;

    assert.notEqual(swimSnapshot, null);
    assert.equal(swimSnapshot.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: freezeVector3(
        swimSnapshot.position.x + 1.8,
        swimSnapshot.position.y,
        swimSnapshot.position.z
      ),
      yawRadians: swimSnapshot.yawRadians
    });

    const blendedSwimSnapshot = traversalRuntime.localTraversalPoseSnapshot;

    assert.notEqual(blendedSwimSnapshot, null);
    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.ok(
      Math.abs(blendedSwimSnapshot.position.x - swimSnapshot.position.x) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime advances grounded prediction in authoritative fixed steps across split render frames", async () => {
  const surfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 4),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      translation: freezeVector3(0, -0.1, 24)
    })
  ];
  const splitHarness = await createTraversalHarness({
    surfaceColliderSnapshots
  });
  const wholeHarness = await createTraversalHarness({
    surfaceColliderSnapshots
  });

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "grounded");

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds
    );

    assertGroundedBodySnapshotsMatch(
      splitHarness.groundedBodyRuntime.snapshot,
      wholeHarness.groundedBodyRuntime.snapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
    assert.equal(
      splitHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary,
      wholeHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime advances swim prediction in authoritative fixed steps across split render frames", async () => {
  const splitHarness = await createTraversalHarness();
  const wholeHarness = await createTraversalHarness();

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "swim");

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds
    );

    assertLocalTraversalPoseSnapshotsMatch(
      splitHarness.traversalRuntime.localTraversalPoseSnapshot,
      wholeHarness.traversalRuntime.localTraversalPoseSnapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
    assert.equal(
      splitHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary,
      wholeHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects grounded camera and character presentation between authoritative fixed steps", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds);

    const rawGroundedPosition = groundedBodyRuntime.snapshot.position;
    const groundedCameraPosition = traversalRuntime.cameraSnapshot.position;
    const groundedCharacterPosition =
      traversalRuntime.characterPresentationSnapshot?.position;

    assert.notEqual(groundedCharacterPosition, null);

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds * 0.5);

    assert.equal(
      groundedBodyRuntime.snapshot.position.z,
      rawGroundedPosition.z
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.position.z <
        groundedCameraPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        groundedCharacterPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        groundedBodyRuntime.snapshot.position.z - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects grounded jump descent ballistically between authoritative fixed steps", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const airbornePosition = freezeVector3(0, 1.8, 24);
    const downwardVelocity = freezeVector3(0, -4, 0);
    const predictionSeconds = groundedFixedStepSeconds * 0.9;
    const linearProjectedY =
      airbornePosition.y + downwardVelocity.y * predictionSeconds;

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: downwardVelocity,
      position: airbornePosition,
      yawRadians: 0
    });

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 0,
        pitchAxis: 0,
        yawAxis: 0
      }),
      predictionSeconds
    );

    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.position.y - airbornePosition.y) <
        0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y <
        linearProjectedY - 0.005
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime clamps grounded jump descent presentation to authored support before touchdown", async () => {
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

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, -5.7, 0),
      position: freezeVector3(0, 0.65, 24),
      yawRadians: 0
    });

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 0,
        pitchAxis: 0,
        yawAxis: 0
      }),
      groundedFixedStepSeconds * 0.9
    );

    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y >= 0.1 - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects swim camera and character presentation between authoritative fixed steps", async () => {
  const { groundedBodyRuntime, traversalRuntime } = await createTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "swim");

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds);

    const rawSwimPose = traversalRuntime.localTraversalPoseSnapshot;
    const swimCameraPosition = traversalRuntime.cameraSnapshot.position;
    const swimCharacterPosition =
      traversalRuntime.characterPresentationSnapshot?.position;

    assert.notEqual(rawSwimPose, null);
    assert.notEqual(swimCharacterPosition, null);

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds * 0.5);

    assertLocalTraversalPoseSnapshotsMatch(
      traversalRuntime.localTraversalPoseSnapshot,
      rawSwimPose
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.position.z <
        swimCameraPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        swimCharacterPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        rawSwimPose.position.z - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a grounded jump tap across split render frames before the next fixed step", async () => {
  const surfaceColliderSnapshots = [
    Object.freeze({
      halfExtents: freezeVector3(4, 0.2, 4),
      rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
      translation: freezeVector3(0, -0.1, 24)
    })
  ];
  const splitHarness = await createTraversalHarness({
    surfaceColliderSnapshots
  });
  const wholeHarness = await createTraversalHarness({
    surfaceColliderSnapshots
  });

  try {
    splitHarness.traversalRuntime.boot();
    wholeHarness.traversalRuntime.boot();
    assert.equal(splitHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(wholeHarness.traversalRuntime.locomotionMode, "grounded");

    splitHarness.traversalRuntime.advance(
      forwardJumpTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    assert.equal(splitHarness.groundedBodyRuntime.snapshot.grounded, true);

    splitHarness.traversalRuntime.advance(
      forwardTravelInput,
      groundedFixedStepSeconds * 0.5
    );
    wholeHarness.traversalRuntime.advance(
      forwardJumpTravelInput,
      groundedFixedStepSeconds
    );

    assert.equal(splitHarness.groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(splitHarness.groundedBodyRuntime.snapshot.position.y > 0);
    assertGroundedBodySnapshotsMatch(
      splitHarness.groundedBodyRuntime.snapshot,
      wholeHarness.groundedBodyRuntime.snapshot
    );
    assertCameraSnapshotsMatch(
      splitHarness.traversalRuntime.cameraSnapshot,
      wholeHarness.traversalRuntime.cameraSnapshot
    );
    assert.equal(
      splitHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary,
      wholeHarness.traversalRuntime.characterPresentationSnapshot
        ?.animationVocabulary
    );
  } finally {
    splitHarness.groundedBodyRuntime.dispose();
    wholeHarness.groundedBodyRuntime.dispose();
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
  const { groundedBodyRuntime, traversalRuntime } = await createTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "swim");

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
        x: 0,
        y: 0,
        z: 23.4
      }),
      yawRadians: 0
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

test("MetaverseTraversalRuntime keeps shipped dock travel reconciliation-free against fixed-tick authority before water entry", async () => {
  const localHarness = await createShippedTraversalHarness();
  const authoritativeHarness = await createShippedTraversalHarness();
  const correctionEvents = [];
  let authoritativeAccumulatorSeconds = 0;

  try {
    localHarness.traversalRuntime.boot();
    authoritativeHarness.traversalRuntime.boot();
    assert.equal(localHarness.traversalRuntime.locomotionMode, "grounded");
    assert.equal(authoritativeHarness.traversalRuntime.locomotionMode, "grounded");
    const dockStartZ = localHarness.traversalRuntime.cameraSnapshot.position.z;

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

      reconcileAckedAuthoritativeLocalPlayerPose(localHarness.traversalRuntime, 
        latestAuthoritativeSnapshot,
        authoritativeAccumulatorSeconds,
        createTraversalIntentSnapshot({
          boost: false,
          inputSequence: frame + 1,
          jump: false,
          jumpActionSequence: 0,
          locomotionMode: "grounded",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0
        }),
        0
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
            shoreline: localHarness.traversalRuntime.shorelineLocalTelemetrySnapshot
          })
        );
      }
    }

    assert.equal(
      localHarness.traversalRuntime.localReconciliationCorrectionCount,
      0,
      `expected zero shipped dock replay reconciliations, received ${localHarness.traversalRuntime.localReconciliationCorrectionCount} with events ${JSON.stringify(correctionEvents)}`
    );
    assert.ok(localHarness.traversalRuntime.cameraSnapshot.position.z < dockStartZ - 0.3);
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps sustained swim reconciliation-free against fixed-tick authority", async () => {
  const localHarness = await createTraversalHarness();
  const authoritativeHarness = await createTraversalHarness();
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

      reconcileAckedAuthoritativeLocalPlayerPose(
        localHarness.traversalRuntime,
        latestAuthoritativeSnapshot,
        authoritativeAccumulatorSeconds,
        createTraversalIntentSnapshot({
          boost: false,
          inputSequence: frame + 1,
          jump: false,
          jumpActionSequence: 0,
          locomotionMode: "swim",
          moveAxis: 1,
          strafeAxis: 0,
          yawAxis: 0
        }),
        0
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
            shoreline: localHarness.traversalRuntime.shorelineLocalTelemetrySnapshot
          })
        );
      }
    }

    assert.equal(
      localHarness.traversalRuntime.localReconciliationCorrectionCount,
      0,
      `expected zero sustained swim replay reconciliations, received ${localHarness.traversalRuntime.localReconciliationCorrectionCount} with events ${JSON.stringify(correctionEvents)}`
    );
    assert.ok(localHarness.traversalRuntime.cameraSnapshot.position.z < swimStartZ - 0.9);
  } finally {
    localHarness.groundedBodyRuntime.dispose();
    authoritativeHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime does not eject vertically across shipped shoreline support seams", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createShippedTraversalHarness();

  try {
    traversalRuntime.boot();

    let sawSwim = false;

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);

      if (traversalRuntime.locomotionMode === "swim") {
        sawSwim = true;
        continue;
      }

      if (sawSwim) {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    let maximumVerticalDeltaMeters = 0;
    let previousY = traversalRuntime.cameraSnapshot.position.y;

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
      maximumVerticalDeltaMeters = Math.max(
        maximumVerticalDeltaMeters,
        Math.abs(traversalRuntime.cameraSnapshot.position.y - previousY)
      );
      previousY = traversalRuntime.cameraSnapshot.position.y;
      assert.equal(traversalRuntime.locomotionMode, "grounded");
    }

    assert.ok(maximumVerticalDeltaMeters < 0.18);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime exits swim onto low step-eligible support and holds grounded after entry", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 18)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 20; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          moveAxis: 1,
          pitchAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );
    }

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 180; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          moveAxis: 1,
          pitchAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      if (traversalRuntime.locomotionMode === "grounded") {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(
      traversalRuntime.cameraSnapshot.position.y >
        config.ocean.height + config.swim.cameraEyeHeightMeters
    );

    for (let frame = 0; frame < 12; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          moveAxis: 0,
          pitchAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps low authored support walkable while grounded autostep is locally gated", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.17, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0.08, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y > 0.2);
    assert.ok(groundedBodyRuntime.snapshot.position.z < 21.9);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps tall support blocked while grounded without jump assistance", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.46, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "grounded");

    for (let frame = 0; frame < 36; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(groundedBodyRuntime.snapshot.position.y < 0.12);
    assert.ok(groundedBodyRuntime.snapshot.position.z > 22);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime lands on reachable tall support when jump carry clears the lip", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.1, 3),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 24)
        }),
        Object.freeze({
          halfExtents: freezeVector3(3, 0.46, 2),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 20)
        })
      ]
    });

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    let landedOnTallSupport = false;

    for (let frame = 0; frame < 96; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: frame === 0,
          moveAxis: 1,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      landedOnTallSupport ||=
        traversalRuntime.locomotionMode === "grounded" &&
        groundedBodyRuntime.snapshot.grounded &&
        groundedBodyRuntime.snapshot.position.y > 0.4 &&
        groundedBodyRuntime.snapshot.position.z < 22;

      if (landedOnTallSupport) {
        break;
      }
    }

    assert.equal(landedOnTallSupport, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime still exits swim when a blocker sits off the dock entry line", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 18)
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0.68, 0, 18)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          moveAxis: 1,
          pitchAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      if (traversalRuntime.locomotionMode === "grounded") {
        break;
      }
    }

    assert.equal(traversalRuntime.locomotionMode, "grounded");
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime blocks swim exit when blocker-affordance shoreline overlap sits on the path", async () => {
  const dockHarness =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 18)
        })
      ]
    });
  const blockedHarness =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 18)
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 21.7)
        })
      ]
    });

  try {
    dockHarness.traversalRuntime.boot();
    blockedHarness.traversalRuntime.boot();

    assert.equal(dockHarness.traversalRuntime.locomotionMode, "swim");
    assert.equal(blockedHarness.traversalRuntime.locomotionMode, "swim");

    const dockExitFrame = resolveGroundedEntryFrame(
      dockHarness.traversalRuntime
    );
    const blockedExitFrame = resolveGroundedEntryFrame(
      blockedHarness.traversalRuntime
    );

    assert.notEqual(dockExitFrame, null);
    assert.equal(blockedExitFrame, null);
    assert.equal(blockedHarness.traversalRuntime.locomotionMode, "swim");
    assert.ok(
      (blockedHarness.traversalRuntime.characterPresentationSnapshot?.position.z ??
        0) > 22.1
    );
  } finally {
    dockHarness.groundedBodyRuntime.dispose();
    blockedHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps swim mode and collides against low blocker-affordance water objects", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.45, 0.12, 0.45),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0.02, 18)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(resolveGroundedEntryFrame(traversalRuntime), null);
    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.ok(
      (traversalRuntime.characterPresentationSnapshot?.position.z ?? 0) > 18.75
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps tall waterborne support in swim mode when it exceeds step height", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 18)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    let enteredGrounded = false;

    for (let frame = 0; frame < 240; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          moveAxis: 1,
          pitchAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );
      enteredGrounded ||= traversalRuntime.locomotionMode === "grounded";
    }

    assert.equal(enteredGrounded, false);
    assert.equal(traversalRuntime.locomotionMode, "swim");
  } finally {
    groundedBodyRuntime.dispose();
  }
});
