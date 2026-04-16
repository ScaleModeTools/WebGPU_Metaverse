import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { metaverseRealtimeWorldCadenceConfig } from "@webgpu-metaverse/shared";
import { MetaverseAuthoritativeGroundedBodyRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-grounded-body-runtime.js";
import { createClientModuleLoader } from "../client/load-client-module.mjs";

let clientLoader;

const fixedDeltaSeconds =
  Number(metaverseRealtimeWorldCadenceConfig.authoritativeTickIntervalMs) /
  1_000;

const clientGroundedBodyConfig = Object.freeze({
  accelerationCurveExponent: 1.2,
  accelerationUnitsPerSecondSquared: 20,
  airborneMovementDampingFactor: 0.42,
  baseSpeedUnitsPerSecond: 6,
  boostCurveExponent: 1.1,
  boostMultiplier: 1.65,
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  controllerOffsetMeters: 0.01,
  decelerationUnitsPerSecondSquared: 26,
  dragCurveExponent: 1.45,
  eyeHeightMeters: 1.62,
  gravityUnitsPerSecond: 18,
  jumpImpulseUnitsPerSecond: 6.8,
  maxSlopeClimbAngleRadians: Math.PI * 0.26,
  maxTurnSpeedRadiansPerSecond: 1.9,
  minSlopeSlideAngleRadians: Math.PI * 0.34,
  snapToGroundDistanceMeters: 0.22,
  spawnPosition: Object.freeze({
    x: 0,
    y: 0,
    z: 0
  }),
  stepHeightMeters: 0.28,
  stepWidthMeters: 0.24,
  worldRadius: 110
});

const authoritativeGroundedBodyConfig = Object.freeze({
  accelerationCurveExponent:
    clientGroundedBodyConfig.accelerationCurveExponent,
  accelerationUnitsPerSecondSquared:
    clientGroundedBodyConfig.accelerationUnitsPerSecondSquared,
  airborneMovementDampingFactor:
    clientGroundedBodyConfig.airborneMovementDampingFactor,
  baseSpeedUnitsPerSecond: clientGroundedBodyConfig.baseSpeedUnitsPerSecond,
  boostCurveExponent: clientGroundedBodyConfig.boostCurveExponent,
  boostMultiplier: clientGroundedBodyConfig.boostMultiplier,
  capsuleHalfHeightMeters:
    clientGroundedBodyConfig.capsuleHalfHeightMeters,
  capsuleRadiusMeters: clientGroundedBodyConfig.capsuleRadiusMeters,
  controllerOffsetMeters: clientGroundedBodyConfig.controllerOffsetMeters,
  decelerationUnitsPerSecondSquared:
    clientGroundedBodyConfig.decelerationUnitsPerSecondSquared,
  dragCurveExponent: clientGroundedBodyConfig.dragCurveExponent,
  gravityUnitsPerSecond: clientGroundedBodyConfig.gravityUnitsPerSecond,
  jumpImpulseUnitsPerSecond:
    clientGroundedBodyConfig.jumpImpulseUnitsPerSecond,
  maxSlopeClimbAngleRadians:
    clientGroundedBodyConfig.maxSlopeClimbAngleRadians,
  maxTurnSpeedRadiansPerSecond:
    clientGroundedBodyConfig.maxTurnSpeedRadiansPerSecond,
  minSlopeSlideAngleRadians:
    clientGroundedBodyConfig.minSlopeSlideAngleRadians,
  snapToGroundDistanceMeters:
    clientGroundedBodyConfig.snapToGroundDistanceMeters,
  spawnPosition: clientGroundedBodyConfig.spawnPosition,
  stepHeightMeters: clientGroundedBodyConfig.stepHeightMeters,
  stepWidthMeters: clientGroundedBodyConfig.stepWidthMeters,
  worldRadius: clientGroundedBodyConfig.worldRadius
});

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

    if (
      proposedSurfaceY !== null &&
      proposedSurfaceY - currentFootY > this.snapDistance &&
      (!this.autostepEnabled ||
        proposedSurfaceY - currentFootY > this.stepHeight)
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
    const desiredFootY = currentFootY + desiredTranslationDelta.y;
    let nextFootY = desiredFootY;

    if (supportingSurfaceY !== null) {
      if (supportingSurfaceY > currentFootY) {
        const stepRise = supportingSurfaceY - currentFootY;

        if (this.autostepEnabled && stepRise <= this.stepHeight) {
          nextFootY = supportingSurfaceY;
        }
      }

      if (
        desiredTranslationDelta.y <= 0 &&
        desiredFootY <= supportingSurfaceY + this.snapDistance
      ) {
        nextFootY = supportingSurfaceY;
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
      supportingSurfaceY !== null &&
      Math.abs(nextFootY - supportingSurfaceY) <= 0.0001;
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

  setUp() {}

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
        candidateTopY <= currentBottomY + this.snapDistance
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

function freezeVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createTraversalIntent(overrides = {}) {
  return Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    strafeAxis: 0,
    turnAxis: 0,
    ...overrides
  });
}

function createClientFakePhysicsRuntime(RapierPhysicsRuntime) {
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

function createServerFakePhysicsRuntime() {
  const world = new FakeRapierWorld();

  return {
    createCapsuleCollider(halfHeightMeters, radiusMeters, translation) {
      const colliderDesc = new FakeColliderDesc("capsule", {
        halfHeight: halfHeightMeters,
        radius: radiusMeters
      });

      colliderDesc.setTranslation(translation.x, translation.y, translation.z);

      return world.createCollider(colliderDesc);
    },

    createCharacterController() {
      return world.createCharacterController();
    },

    createCuboidCollider(halfExtents, translation) {
      const colliderDesc = new FakeColliderDesc("cuboid", {
        halfExtentX: halfExtents.x,
        halfExtentY: halfExtents.y,
        halfExtentZ: halfExtents.z
      });

      colliderDesc.setTranslation(translation.x, translation.y, translation.z);

      return world.createCollider(colliderDesc);
    },

    createVector3(x, y, z) {
      return new FakeRapierVector3(x, y, z);
    },

    removeCollider(collider) {
      world.removeCollider(collider);
    },

    stepSimulation(deltaSeconds) {
      world.timestep =
        Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 1 / 60;
      world.step();
    }
  };
}

function assertApprox(actual, expected, label, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function assertSnapshotsMatch(clientSnapshot, serverSnapshot, stepIndex) {
  assert.equal(
    clientSnapshot.grounded,
    serverSnapshot.grounded,
    `step ${stepIndex}: grounded`
  );
  assert.equal(
    clientSnapshot.jumpReady,
    serverSnapshot.jumpReady,
    `step ${stepIndex}: jumpReady`
  );
  assertApprox(
    clientSnapshot.position.x,
    serverSnapshot.position.x,
    `step ${stepIndex}: position.x`
  );
  assertApprox(
    clientSnapshot.position.y,
    serverSnapshot.position.y,
    `step ${stepIndex}: position.y`
  );
  assertApprox(
    clientSnapshot.position.z,
    serverSnapshot.position.z,
    `step ${stepIndex}: position.z`
  );
  assertApprox(
    clientSnapshot.planarSpeedUnitsPerSecond,
    serverSnapshot.planarSpeedUnitsPerSecond,
    `step ${stepIndex}: planarSpeedUnitsPerSecond`
  );
  assertApprox(
    clientSnapshot.verticalSpeedUnitsPerSecond,
    serverSnapshot.verticalSpeedUnitsPerSecond,
    `step ${stepIndex}: verticalSpeedUnitsPerSecond`
  );
  assertApprox(
    clientSnapshot.yawRadians,
    serverSnapshot.yawRadians,
    `step ${stepIndex}: yawRadians`
  );
}

async function createGroundedParityHarness() {
  const { MetaverseGroundedBodyRuntime, RapierPhysicsRuntime } =
    await clientLoader.load("/src/physics/index.ts");
  const clientPhysicsRuntime = createClientFakePhysicsRuntime(RapierPhysicsRuntime);

  await clientPhysicsRuntime.init();

  const serverPhysicsRuntime = createServerFakePhysicsRuntime();
  const clientGroundCollider = clientPhysicsRuntime.createFixedCuboidCollider(
    freezeVector3(8, 0.5, 8),
    freezeVector3(0, -0.5, 0)
  );
  const serverGroundCollider = serverPhysicsRuntime.createCuboidCollider(
    freezeVector3(8, 0.5, 8),
    freezeVector3(0, -0.5, 0)
  );
  const clientGroundedBodyRuntime = new MetaverseGroundedBodyRuntime(
    clientGroundedBodyConfig,
    clientPhysicsRuntime
  );

  await clientGroundedBodyRuntime.init(0);
  clientGroundedBodyRuntime.teleport(freezeVector3(0, 0, 0), 0);

  const authoritativeGroundedBodyRuntime =
    new MetaverseAuthoritativeGroundedBodyRuntime(
      authoritativeGroundedBodyConfig,
      serverPhysicsRuntime
    );

  authoritativeGroundedBodyRuntime.teleport(freezeVector3(0, 0, 0), 0);

  return Object.freeze({
    authoritativeGroundedBodyRuntime,
    clientGroundCollider,
    clientGroundedBodyRuntime,
    clientPhysicsRuntime,
    serverGroundCollider,
    serverPhysicsRuntime
  });
}

function advanceLockstepGroundedStep(harness, intent, stepIndex) {
  harness.clientPhysicsRuntime.stepSimulation(fixedDeltaSeconds);
  const clientSnapshot = harness.clientGroundedBodyRuntime.advance(
    intent,
    fixedDeltaSeconds
  );

  harness.serverPhysicsRuntime.stepSimulation(fixedDeltaSeconds);

  const serverSnapshot = harness.authoritativeGroundedBodyRuntime.advance(
    intent,
    fixedDeltaSeconds
  );

  assertSnapshotsMatch(clientSnapshot, serverSnapshot, stepIndex);

  return Object.freeze({
    clientSnapshot,
    serverSnapshot
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("grounded client prediction and server authority stay lockstep on fixed-step walk jump and landing", async () => {
  const harness = await createGroundedParityHarness();

  try {
    const intentSequence = [
      createTraversalIntent(),
      createTraversalIntent({ moveAxis: 1 }),
      createTraversalIntent({ moveAxis: 1 }),
      createTraversalIntent({ moveAxis: 1 }),
      createTraversalIntent({ moveAxis: 1 }),
      createTraversalIntent({ jump: true, moveAxis: 1 }),
      ...Array.from(
        { length: 28 },
        () => createTraversalIntent({ moveAxis: 1 })
      )
    ];
    let observedAirborne = false;
    let observedLanding = false;

    for (const [stepIndex, intent] of intentSequence.entries()) {
      const { clientSnapshot } = advanceLockstepGroundedStep(
        harness,
        intent,
        stepIndex
      );

      if (!clientSnapshot.grounded) {
        observedAirborne = true;
      } else if (observedAirborne) {
        observedLanding = true;
      }
    }

    assert.equal(harness.clientGroundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      harness.authoritativeGroundedBodyRuntime.snapshot.grounded,
      true
    );
    assert.ok(observedAirborne, "expected jump sequence to leave the ground");
    assert.ok(observedLanding, "expected jump sequence to land back on support");
  } finally {
    harness.clientGroundedBodyRuntime.dispose();
    harness.clientPhysicsRuntime.removeCollider(harness.clientGroundCollider);
    harness.authoritativeGroundedBodyRuntime.dispose();
    harness.serverPhysicsRuntime.removeCollider(harness.serverGroundCollider);
  }
});
