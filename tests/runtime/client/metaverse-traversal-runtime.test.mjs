import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

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

      if (
        desiredTranslationDelta.y <= 0 &&
        desiredFootY <= supportingSurfaceY + this.snapDistance
      ) {
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
  const mountedEnvironmentAnchorSnapshotsByKey = new Map(
    Object.entries(options.mountedEnvironmentAnchorSnapshots ?? {})
  );
  const mountableEnvironmentConfigById = new Map(
    Object.keys(options.dynamicEnvironmentPoses ?? {}).map((environmentAssetId) => [
      environmentAssetId,
      Object.freeze({
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
        entries: Object.freeze(seatConfig.entries ?? []),
        environmentAssetId,
        label: seatConfig.label ?? "Mounted vehicle",
        seats: Object.freeze(seatConfig.seats)
      })
    );
  }
  const traversalRuntime = new MetaverseTraversalRuntime(config, {
    groundedBodyRuntime,
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

test("MetaverseTraversalRuntime keeps the grounded first-person camera ahead of the body root", async () => {
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
    groundedHarness.traversalRuntime.advance(lookRightInput, 1 / 60);

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
