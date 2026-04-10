import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

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
  constructor(shape, payload, translation) {
    this.payload = payload;
    this.shape = shape;
    this.translationVector = translation;
  }

  get standingOffset() {
    return this.shape === "capsule"
      ? this.payload.halfHeight + this.payload.radius
      : 0;
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

  computeColliderMovement(collider, desiredTranslationDelta) {
    const currentTranslation = collider.translation();
    const currentFootY = currentTranslation.y - collider.standingOffset;
    const capsuleRadius = collider.payload.radius ?? 0;
    let nextCenterX = currentTranslation.x + desiredTranslationDelta.x;
    let nextCenterZ = currentTranslation.z + desiredTranslationDelta.z;
    const proposedSurfaceY = this.findSurfaceY(
      nextCenterX,
      nextCenterZ,
      capsuleRadius
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
      capsuleRadius
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

      if (desiredFootY <= supportingSurfaceY + this.snapDistance) {
        nextFootY = supportingSurfaceY;
      }
    }

    const nextCenterY = nextFootY + collider.standingOffset;

    this.lastMovement = new FakeRapierVector3(
      nextCenterX - currentTranslation.x,
      nextCenterY - currentTranslation.y,
      nextCenterZ - currentTranslation.z
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

  findSurfaceY(centerX, centerZ, capsuleRadius) {
    let highestSurfaceY = null;

    for (const candidate of this.world.queryColliders) {
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
      colliderDesc.translation
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
  const config = {
    ...metaverseRuntimeConfig,
    ...options.config
  };
  const surfaceColliderSnapshots = (options.surfaceColliderSnapshots ?? []).map(
    (collider) =>
      Object.freeze({
        traversalAffordance: collider.traversalAffordance ?? "support",
        halfExtents: collider.halfExtents,
        rotation: collider.rotation,
        translation: collider.translation
      })
  );
  const physicsRuntime = createFakePhysicsRuntime(RapierPhysicsRuntime);

  await physicsRuntime.init();

  const groundCollider = createGroundColliderConfig(config);

  physicsRuntime.createFixedCuboidCollider(
    groundCollider.halfExtents,
    groundCollider.translation
  );

  for (const collider of surfaceColliderSnapshots) {
    physicsRuntime.createFixedCuboidCollider(
      collider.halfExtents,
      collider.translation,
      collider.rotation
    );
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
  const traversalRuntime = new MetaverseTraversalRuntime(config, {
    groundedBodyRuntime,
    readDynamicEnvironmentPose(environmentAssetId) {
      return dynamicPoseMap.get(environmentAssetId) ?? null;
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
    traversalRuntime
  };
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

test("MetaverseTraversalRuntime routes skiff mounting through the traversal owner and restores swim on dismount", async () => {
  const { config, dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      dynamicEnvironmentPoses: {
        "metaverse-hub-skiff-v1": Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: Math.PI
        })
      }
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    traversalRuntime.syncMountedEnvironment({
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Metaverse hub skiff"
    });

    assert.equal(traversalRuntime.locomotionMode, "mounted");
    assert.equal(dynamicPoseWrites.at(-1)?.environmentAssetId, "metaverse-hub-skiff-v1");
    const mountedCamera = traversalRuntime.cameraSnapshot;

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 1,
        pitchAxis: 0,
        yawAxis: 1
      }),
      1 / 60
    );

    assert.ok(
      Math.abs(traversalRuntime.cameraSnapshot.yawRadians - mountedCamera.yawRadians) >
        0.01
    );
    assert.ok(dynamicPoseWrites.length >= 2);

    traversalRuntime.syncMountedEnvironment(null);

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.cameraSnapshot.position.y,
      config.ocean.height + config.swim.cameraEyeHeightMeters
    );
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
          translation: freezeVector3(0, -0.02, 30)
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
          translation: freezeVector3(0, 0.08, 28)
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
    assert.ok(groundedBodyRuntime.snapshot.position.z > 26.1);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps tall support blocked while grounded until a real climb or jump slice exists", async () => {
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
          translation: freezeVector3(0, 0, 28)
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
    assert.ok(groundedBodyRuntime.snapshot.position.z < 26);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores a side blocker while exiting swim onto dock support", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 30)
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0.68, 0, 30)
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

test("MetaverseTraversalRuntime ignores blocker-affordance shoreline overlap while exiting onto dock support", async () => {
  const dockHarness =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 30)
        })
      ]
    });
  const blockedHarness =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(4, 0.17, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, -0.02, 30)
        }),
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.46, 0.46, 0.46),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0, 26.3)
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
    assert.equal(blockedExitFrame, dockExitFrame);
  } finally {
    dockHarness.groundedBodyRuntime.dispose();
    blockedHarness.groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps swim mode over low blocker-affordance water objects", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createTraversalHarness({
      surfaceColliderSnapshots: [
        Object.freeze({
          traversalAffordance: "blocker",
          halfExtents: freezeVector3(0.45, 0.12, 0.45),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 0.02, 30)
        })
      ]
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(resolveGroundedEntryFrame(traversalRuntime), null);
    assert.equal(traversalRuntime.locomotionMode, "swim");
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
          translation: freezeVector3(0, 0, 30)
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
