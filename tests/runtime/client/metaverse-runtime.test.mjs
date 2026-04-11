import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePresenceRosterSnapshot,
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

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

class FakeRigidBodyDesc {
  constructor() {
    this.additionalMass = 0;
    this.angularDamping = 0;
    this.gravityScale = 1;
    this.linearDamping = 0;
    this.lockRotationsEnabled = false;
    this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    this.translation = new FakeRapierVector3(0, 0, 0);
  }

  lockRotations() {
    this.lockRotationsEnabled = true;

    return this;
  }

  setAdditionalMass(mass) {
    this.additionalMass = mass;

    return this;
  }

  setAngularDamping(damping) {
    this.angularDamping = damping;

    return this;
  }

  setGravityScale(scale) {
    this.gravityScale = scale;

    return this;
  }

  setLinearDamping(damping) {
    this.linearDamping = damping;

    return this;
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
  constructor(shape, payload, translation, parentBody = null) {
    this.parentBody = parentBody;
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
    if (this.parentBody !== null) {
      const parentTranslation = this.parentBody.translation();

      return new FakeRapierVector3(
        parentTranslation.x + this.translationVector.x,
        parentTranslation.y + this.translationVector.y,
        parentTranslation.z + this.translationVector.z
      );
    }

    return this.translationVector;
  }
}

class FakeRigidBody {
  constructor(bodyDesc) {
    this.additionalMass = bodyDesc.additionalMass;
    this.angularDamping = bodyDesc.angularDamping;
    this.gravityScale = bodyDesc.gravityScale;
    this.linearDamping = bodyDesc.linearDamping;
    this.linvelVector = new FakeRapierVector3(0, 0, 0);
    this.lockRotationsEnabled = bodyDesc.lockRotationsEnabled;
    this.rotationQuaternion = bodyDesc.rotation;
    this.translationVector = bodyDesc.translation;
  }

  linvel() {
    return this.linvelVector;
  }

  setLinvel(velocity) {
    this.linvelVector = new FakeRapierVector3(
      velocity.x,
      velocity.y,
      velocity.z
    );
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
    this.applyImpulsesToDynamicBodies = false;
    this.grounded = false;
    this.lastMovement = new FakeRapierVector3(0, 0, 0);
    this.snapDistance = 0;
    this.world = world;
  }

  computeColliderMovement(collider, desiredTranslationDelta) {
    const currentTranslation = collider.translation();
    const currentFootY = currentTranslation.y - collider.standingOffset;
    const capsuleRadius = collider.payload.radius ?? 0;
    const supportingSurfaceY = this.findSurfaceY(
      currentTranslation.x,
      currentTranslation.z,
      capsuleRadius
    );
    const desiredFootY = currentFootY + desiredTranslationDelta.y;
    const nextFootY =
      supportingSurfaceY !== null &&
      desiredFootY <= supportingSurfaceY + this.snapDistance
        ? supportingSurfaceY
        : desiredFootY;
    const nextCenterY = nextFootY + collider.standingOffset;

    this.lastMovement = new FakeRapierVector3(
      desiredTranslationDelta.x,
      nextCenterY - currentTranslation.y,
      desiredTranslationDelta.z
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

  enableAutostep() {}

  free() {}

  setApplyImpulsesToDynamicBodies(enabled) {
    this.applyImpulsesToDynamicBodies = enabled;
  }

  setCharacterMass() {}

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
    this.lastCharacterController = null;
    this.queryColliders = [];
    this.rigidBodies = [];
    this.timestep = 1 / 60;
  }

  createCharacterController() {
    const controller = new FakeCharacterController(this);

    this.lastCharacterController = controller;

    return controller;
  }

  createCollider(colliderDesc, parentBody = null) {
    const collider = new FakeCollider(
      colliderDesc.shape,
      colliderDesc.payload,
      colliderDesc.translation,
      parentBody
    );

    this.colliders.push(collider);

    return collider;
  }

  createRigidBody(bodyDesc) {
    const rigidBody = new FakeRigidBody(bodyDesc);

    this.rigidBodies.push(rigidBody);

    return rigidBody;
  }

  removeCollider(collider) {
    this.colliders = this.colliders.filter((candidate) => candidate !== collider);
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate !== collider
    );
  }

  removeRigidBody(rigidBody) {
    this.rigidBodies = this.rigidBodies.filter((candidate) => candidate !== rigidBody);
    this.colliders = this.colliders.filter(
      (candidate) => candidate.parentBody !== rigidBody
    );
    this.queryColliders = this.queryColliders.filter(
      (candidate) => candidate.parentBody !== rigidBody
    );
  }

  step() {
    this.queryColliders = [...this.colliders];
  }
}

function createFakePhysicsRuntime(RapierPhysicsRuntime) {
  return createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime).physicsRuntime;
}

function createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime) {
  const world = new FakeRapierWorld();

  return {
    physicsRuntime: new RapierPhysicsRuntime({
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
          RigidBodyDesc: {
            dynamic() {
              return new FakeRigidBodyDesc();
            }
          },
          Vector3: FakeRapierVector3
        },
        world
      };
    }
    }),
    world
  };
}

class FakeMetaverseRenderer {
  compileAsyncCalls = [];
  disposed = false;
  initCalls = 0;
  pixelRatio = null;
  renderCalls = 0;
  sizes = [];

  async compileAsync(scene, camera) {
    this.compileAsyncCalls.push({
      camera,
      scene
    });
  }

  async init() {
    this.initCalls += 1;
  }

  render() {
    this.renderCalls += 1;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = pixelRatio;
  }

  setSize(width, height) {
    this.sizes.push([width, height]);
  }

  dispose() {
    this.disposed = true;
  }
}

class FakeMetaversePresenceClient {
  constructor(localPlayerId, localUsername, remotePlayerId) {
    this.disposeCalls = 0;
    this.ensureJoinedRequests = [];
    this.listeners = new Set();
    this.localPlayerId = localPlayerId;
    this.localUsername = localUsername;
    this.remotePlayerId = remotePlayerId;
    this.rosterSnapshot = null;
    this.statusSnapshot = Object.freeze({
      joined: false,
      lastError: null,
      lastSnapshotSequence: null,
      playerId: null,
      state: "idle"
    });
    this.syncPresenceCalls = [];
  }

  ensureJoined(request) {
    this.ensureJoinedRequests.push(request);
    this.statusSnapshot = Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: this.localPlayerId,
      state: "connected"
    });
    this.rosterSnapshot = createMetaversePresenceRosterSnapshot({
      players: [
        {
          characterId: request.characterId,
          playerId: this.localPlayerId,
          pose: {
            ...request.pose,
            stateSequence: 1
          },
          username: this.localUsername
        },
        {
          characterId: "metaverse-mannequin-v1",
          playerId: this.remotePlayerId,
          pose: {
            animationVocabulary: "walk",
            locomotionMode: "swim",
            position: {
              x: -3,
              y: 0.2,
              z: 8
            },
            stateSequence: 1,
            yawRadians: 0.45
          },
          username: "Remote Sailor"
        }
      ],
      snapshotSequence: 1,
      tickIntervalMs: 120
    });
    this.#notifyUpdates();

    return Promise.resolve(this.rosterSnapshot);
  }

  subscribeUpdates(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  syncPresence(pose) {
    this.syncPresenceCalls.push(pose);
  }

  dispose() {
    this.disposeCalls += 1;
    this.statusSnapshot = Object.freeze({
      joined: false,
      lastError: null,
      lastSnapshotSequence: this.statusSnapshot.lastSnapshotSequence,
      playerId: this.localPlayerId,
      state: "disposed"
    });
    this.#notifyUpdates();
  }

  #notifyUpdates() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function createInteractiveWindowHarness() {
  const listenersByType = new Map();
  let scheduledFrame = null;

  const windowHarness = {
    addEventListener(type, listener) {
      const listeners = listenersByType.get(type) ?? [];

      listeners.push(listener);
      listenersByType.set(type, listeners);
    },
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    devicePixelRatio: 1,
    removeEventListener(type, listener) {
      const listeners = listenersByType.get(type) ?? [];
      const nextListeners = listeners.filter((candidate) => candidate !== listener);

      listenersByType.set(type, nextListeners);
    },
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  };

  return {
    advanceFrame(nowMs) {
      assert.ok(scheduledFrame);
      const pendingFrame = scheduledFrame;

      pendingFrame(nowMs);
    },
    dispatch(type, event = {}) {
      const listeners = listenersByType.get(type) ?? [];

      for (const listener of listeners) {
        listener({
          preventDefault() {},
          target: null,
          ...event
        });
      }
    },
    window: windowHarness
  };
}

function wrapRadians(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function resolveCharacterRenderYawRadians(yawRadians) {
  return wrapRadians(Math.PI - yawRadians);
}

function assertCharacterRenderYawFacesMetaverseYaw(rotationY, yawRadians) {
  assert.ok(Math.abs(Math.sin(rotationY) - Math.sin(yawRadians)) < 0.000001);
  assert.ok(Math.abs(Math.cos(rotationY) + Math.cos(yawRadians)) < 0.000001);
}

async function createSkiffMountProofSlice() {
  const {
    AnimationClip,
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute
  } = await import("three/webgpu");
  const bodyGeometry = new BoxGeometry(0.4, 1.2, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.32;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.32;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.24;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.14;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();

    socketBone.name = socketName;

    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);
  socketBones[0].position.y = 0.12;
  socketBones[1].position.x = -0.35;
  socketBones[2].position.x = 0.35;
  socketBones[3].position.set(0.2, -0.08, -0.08);
  socketBones[4].position.set(0, 0, -0.08);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const idleClip = new AnimationClip("idle", -1, []);
  const walkClip = new AnimationClip("walk", -1, []);
  const skiffScene = new Group();
  const skiffHull = new Mesh(
    new BoxGeometry(4.2, 0.6, 1.8),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const seatSocket = new Group();

  skiffHull.position.y = 0.3;
  seatSocket.name = "seat_socket";
  seatSocket.position.set(0, 1, 0);
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(skiffHull, seatSocket);

  return {
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
          vocabulary: "walk"
        }
      ],
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      socketNames
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/environment/metaverse-hub-skiff.gltf") {
          return {
            animations: [],
            scene: skiffScene
          };
        }

        return {
          animations: [idleClip, walkClip],
          scene: characterScene
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf",
          collider: {
            center: { x: 0, y: 1.05, z: 0 },
            shape: "box",
            size: { x: 5.2, y: 2.4, z: 2.8 }
          },
          environmentAssetId: "metaverse-hub-skiff-v1",
          label: "Metaverse hub skiff",
          lods: [
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-skiff.gltf",
              tier: "high"
            }
          ],
          mount: {
            seatSocketName: "seat_socket"
          },
          placement: "dynamic",
          placements: [
            {
              position: { x: 0, y: 0.12, z: 24 },
              rotationYRadians: Math.PI,
              scale: 1
            }
          ],
          physicsColliders: null,
          traversalAffordance: "mount"
        }
      ]
    }
  };
}

async function createStaticSurfaceProofSlice() {
  const { Group } = await import("three/webgpu");

  return {
    createSceneAssetLoader: () => ({
      async loadAsync() {
        return {
          animations: [],
          scene: new Group()
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: null,
          collider: null,
          environmentAssetId: "metaverse-hub-surface-test-v1",
          label: "Metaverse hub surface test",
          lods: [
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-surface-test.gltf",
              tier: "high"
            }
          ],
          mount: null,
          placement: "static",
          placements: [
            {
              position: { x: 0, y: -0.1, z: 24 },
              rotationYRadians: 0,
              scale: 1
            }
          ],
          traversalAffordance: "support",
          physicsColliders: [
            {
              center: { x: 0, y: 0, z: 0 },
              shape: "box",
              size: { x: 8, y: 0.4, z: 8 }
            }
          ]
        }
      ]
    }
  };
}

async function createPushableCrateProofSlice() {
  const {
    BoxGeometry,
    Group,
    Mesh,
    MeshStandardMaterial
  } = await import("three/webgpu");
  const crateScene = new Group();
  const crateMesh = new Mesh(
    new BoxGeometry(0.92, 0.92, 0.92),
    new MeshStandardMaterial({ color: 0x8b5a2b })
  );

  crateScene.name = "metaverse_hub_pushable_crate_root";
  crateScene.add(crateMesh);

  return {
    createSceneAssetLoader: () => ({
      async loadAsync() {
        return {
          animations: [],
          scene: crateScene
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: null,
          collider: {
            center: { x: 0, y: 0, z: 0 },
            shape: "box",
            size: { x: 0.92, y: 0.92, z: 0.92 }
          },
          environmentAssetId: "metaverse-hub-pushable-crate-v1",
          label: "Metaverse hub pushable crate",
          lods: [
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
              tier: "high"
            }
          ],
          mount: null,
          placement: "dynamic",
          placements: [
            {
              position: { x: -3.8, y: 0.46, z: -14.4 },
              rotationYRadians: Math.PI * 0.04,
              scale: 1
            }
          ],
          physicsColliders: null,
          traversalAffordance: "pushable"
        }
      ]
    }
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime starts from an idle snapshot and rejects missing navigator.gpu explicitly", async () => {
  const { WebGpuMetaverseRuntime } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-runtime.ts"
  );
  const runtime = new WebGpuMetaverseRuntime();

  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
  assert.equal(runtime.hudSnapshot.focusedMountable, null);
  assert.equal(runtime.hudSnapshot.focusedPortal, null);
  assert.equal(runtime.hudSnapshot.mountedEnvironment, null);
  assert.equal(runtime.hudSnapshot.controlMode, "keyboard");
  assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");
  assert.equal(runtime.hudSnapshot.presence.state, "disabled");
  assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 0);

  await assert.rejects(
    () => runtime.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("resolveMetaverseMouseLookAxes keeps the center dead zone quiet and turns toward edges", async () => {
  const { resolveMetaverseMouseLookAxes } = await clientLoader.load(
    "/src/metaverse/states/metaverse-flight.ts"
  );

  assert.deepEqual(
    resolveMetaverseMouseLookAxes(0.5, 0.5, 1280, 720, {
      deadZoneViewportFraction: 0.2,
      responseExponent: 1.55
    }),
    {
      pitchAxis: 0,
      yawAxis: 0
    }
  );

  const rightTurnAxes = resolveMetaverseMouseLookAxes(0.96, 0.5, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });
  const downwardTiltAxes = resolveMetaverseMouseLookAxes(0.5, 0.96, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });

  assert.ok(rightTurnAxes.yawAxis > 0);
  assert.equal(rightTurnAxes.pitchAxis, 0);
  assert.ok(downwardTiltAxes.pitchAxis < 0);
  assert.equal(downwardTiltAxes.yawAxis, 0);
});

test("WebGpuMetaverseRuntime prewarms the booted scene before the first render when compileAsync is available", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  let scheduledFrame = null;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    devicePixelRatio: 1.5,
    removeEventListener() {},
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      devicePixelRatio: 1.5,
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });
    const startSnapshot = await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(startSnapshot.lifecycle, "running");
    assert.equal(startSnapshot.locomotionMode, "swim");
    assert.equal(renderer.initCalls, 1);
    assert.equal(renderer.compileAsyncCalls.length, 1);
    assert.equal(renderer.renderCalls, 1);
    assert.equal(renderer.pixelRatio, 1.5);
    assert.deepEqual(renderer.sizes.at(0), [1280, 720]);
    assert.equal(renderer.compileAsyncCalls[0]?.scene?.isScene, true);
    assert.equal(renderer.compileAsyncCalls[0]?.camera?.isPerspectiveCamera, true);
    assert.equal(startSnapshot.camera.position.y, 1.9);
    assert.equal(typeof scheduledFrame, "function");

    runtime.dispose();

    assert.equal(renderer.disposed, true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime boots metaverse presence without moving traversal policy out of the runtime owner", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {},
    devicePixelRatio: 1,
    removeEventListener() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(fakePresenceClient.ensureJoinedRequests.length, 1);
    assert.ok(fakePresenceClient.syncPresenceCalls.length >= 1);
    assert.equal(runtime.hudSnapshot.presence.state, "connected");
    assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 1);
    assert.equal(
      fakePresenceClient.syncPresenceCalls.at(-1)?.locomotionMode,
      runtime.hudSnapshot.locomotionMode
    );

    runtime.dispose();

    assert.equal(fakePresenceClient.disposeCalls, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("MetaversePresenceRuntime detects roster object mutations without relying on replacement", async () => {
  const { MetaversePresenceRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-presence-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const rosterSnapshot = {
    players: [
      {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        pose: {
          animationVocabulary: "idle",
          locomotionMode: "grounded",
          position: {
            x: 0,
            y: 1,
            z: 0
          },
          stateSequence: 1,
          yawRadians: 0
        },
        username: localUsername
      },
      {
        characterId: "metaverse-mannequin-v1",
        playerId: remotePlayerId,
        pose: {
          animationVocabulary: "walk",
          locomotionMode: "swim",
          position: {
            x: -3,
            y: 0.2,
            z: 8
          },
          stateSequence: 1,
          yawRadians: 0.45
        },
        username: remoteUsername
      }
    ],
    snapshotSequence: 1,
    tickIntervalMs: 120
  };
  let disposeCalls = 0;
  const fakePresenceClient = {
    rosterSnapshot,
    statusSnapshot: Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: localPlayerId,
      state: "connected"
    }),
    dispose() {
      disposeCalls += 1;
    },
    ensureJoined() {
      return Promise.resolve(rosterSnapshot);
    },
    subscribeUpdates() {
      return () => {};
    },
    syncPresence() {}
  };
  const presenceRuntime = new MetaversePresenceRuntime({
    createMetaversePresenceClient: () => fakePresenceClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onPresenceUpdate() {}
  });

  presenceRuntime.boot(
    {
      animationVocabulary: "idle",
      position: {
        x: 0,
        y: 1,
        z: 0
      },
      yawRadians: 0
    },
    "grounded"
  );
  presenceRuntime.syncRemoteCharacterPresentations();

  assert.equal(presenceRuntime.remoteCharacterPresentations.length, 1);
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.presentation.position.x,
    -3
  );

  rosterSnapshot.players[1] = {
    ...rosterSnapshot.players[1],
    pose: {
      ...rosterSnapshot.players[1].pose,
      position: {
        x: -2,
        y: 0.2,
        z: 8
      },
      stateSequence: 2
    }
  };
  presenceRuntime.syncRemoteCharacterPresentations();

  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.presentation.position.x,
    -2
  );

  presenceRuntime.dispose();

  assert.equal(disposeCalls, 1);
});

test("WebGpuMetaverseRuntime resolves grounded surface travel automatically when solid support is present", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createStaticSurfaceProofSlice();
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {},
    devicePixelRatio: 1,
    removeEventListener() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(
      {
        ...metaverseRuntimeConfig,
        portals: []
      },
      {
        cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        createRenderer: () => renderer,
        createSceneAssetLoader,
        environmentProofConfig,
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );
    const startSnapshot = await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(startSnapshot.locomotionMode, "grounded");
    assert.ok(runtime.hudSnapshot.camera.position.y > 1.62);
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.x) < 0.000001);
    assert.equal(
      runtime.hudSnapshot.camera.position.z,
      24 -
        metaverseRuntimeConfig.bodyPresentation.groundedFirstPersonForwardOffsetMeters
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("WebGpuMetaverseRuntime starts in swim locomotion over open water and advances waterborne movement", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  let nowMs = 0;

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.y - 1.9) < 0.001);

    const startingYaw = runtime.hudSnapshot.camera.yawRadians;

    windowHarness.dispatch("mousemove", {
      movementX: 240,
      movementY: 0
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(runtime.hudSnapshot.camera.yawRadians > startingYaw);

    const startingZ = runtime.hudSnapshot.camera.position.z;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs = 2000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(runtime.hudSnapshot.camera.position.z < startingZ);
    assert.ok(Math.abs(runtime.hudSnapshot.camera.position.y - 1.9) < 0.001);

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime routes mounted hub input through skiff locomotion and camera yaw", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { metaverseRuntimeConfig },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { characterProofConfig, createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowHarness = createInteractiveWindowHarness();
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  let nowMs = 0;

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const runtime = new WebGpuMetaverseRuntime(
      {
        ...metaverseRuntimeConfig,
        camera: {
          ...metaverseRuntimeConfig.camera,
          spawnPosition: {
            x: 0,
            y: 1.62,
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
        },
        portals: []
      },
      {
        cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
        characterProofConfig,
        createRenderer: () => renderer,
        createSceneAssetLoader,
        environmentProofConfig,
        physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
        readNowMs: () => nowMs,
        requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
      }
    );

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(
      runtime.hudSnapshot.focusedMountable?.environmentAssetId,
      "metaverse-hub-skiff-v1"
    );

    runtime.toggleMount();

    assert.equal(
      runtime.hudSnapshot.mountedEnvironment?.environmentAssetId,
      "metaverse-hub-skiff-v1"
    );
    assert.equal(runtime.hudSnapshot.locomotionMode, "mounted");

    const mountedCamera = runtime.hudSnapshot.camera;

    windowHarness.dispatch("mousemove", {
      movementX: 120
    });
    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs = 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.yawRadians - mountedCamera.yawRadians) > 0.01
    );
    assert.ok(
      runtime.hudSnapshot.camera.position.x !== mountedCamera.position.x ||
        runtime.hudSnapshot.camera.position.z !== mountedCamera.position.z
    );

    runtime.toggleMount();

    assert.equal(runtime.hudSnapshot.mountedEnvironment, null);
    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("createMetaverseScene keeps portal material nodes stable across presentation syncs", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig);
  const ringMesh = sceneRuntime.scene.getObjectByName("metaverse_portal/duck-hunt/ring");
  const beamMesh = sceneRuntime.scene.getObjectByName("metaverse_portal/duck-hunt/beam");

  assert.ok(ringMesh);
  assert.ok(beamMesh);

  const initialRingColorNode = ringMesh.material.colorNode;
  const initialRingEmissiveNode = ringMesh.material.emissiveNode;
  const initialBeamColorNode = beamMesh.material.colorNode;
  const initialBeamEmissiveNode = beamMesh.material.emissiveNode;
  const initialBeamOpacityNode = beamMesh.material.opacityNode;

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    null,
    500,
    0
  );
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    {
      distanceFromCamera: 12,
      experienceId: "duck-hunt",
      label: "Duck Hunt!"
    },
    1500,
    0
  );

  assert.equal(ringMesh.material.colorNode, initialRingColorNode);
  assert.equal(ringMesh.material.emissiveNode, initialRingEmissiveNode);
  assert.equal(beamMesh.material.colorNode, initialBeamColorNode);
  assert.equal(beamMesh.material.emissiveNode, initialBeamEmissiveNode);
  assert.equal(beamMesh.material.opacityNode, initialBeamOpacityNode);
  assert.equal(beamMesh.material.opacityNode.value, 0.92);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    null,
    2200,
    0
  );

  assert.equal(beamMesh.material.opacityNode.value, 0.76);
});

test("metaverse asset proof resolves a socket-compatible attachment config from manifests", async () => {
  const {
    metaverseAttachmentProofConfig,
    metaverseCharacterProofConfig
  } = await clientLoader.load("/src/app/states/metaverse-asset-proof.ts");

  assert.equal(
    metaverseAttachmentProofConfig.attachmentId,
    "metaverse-service-pistol-v1"
  );
  assert.equal(metaverseAttachmentProofConfig.socketName, "hand_r_socket");
  assert.ok(
    metaverseCharacterProofConfig.socketNames.includes(
      metaverseAttachmentProofConfig.socketName
    )
  );
});

test("metaverse asset proof resolves the active full-body humanoid character from manifests", async () => {
  const [
    {
      characterModelManifest,
      mesh2motionHumanoidCharacterAssetId,
      metaverseActiveFullBodyCharacterAssetId
    },
    {
      animationClipManifest,
      mesh2motionHumanoidCanonicalAnimationPackSourcePath
    },
    { animationVocabularyIds },
    { metaverseCharacterProofConfig }
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/app/states/metaverse-asset-proof.ts")
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeCharacter);
  assert.equal(activeCharacter.id, mesh2motionHumanoidCharacterAssetId);
  assert.equal(activeCharacter.skeleton, "humanoid_v2");
  assert.ok(activeCharacter.presentationModes.includes("full-body"));
  assert.equal(
    metaverseCharacterProofConfig.characterId,
    metaverseActiveFullBodyCharacterAssetId
  );
  assert.equal(
    metaverseCharacterProofConfig.modelPath,
    activeCharacter.renderModel.lods[0]?.modelPath
  );
  assert.deepEqual(
    metaverseCharacterProofConfig.animationClips.map((clip) => clip.vocabulary),
    [...animationVocabularyIds]
  );
  assert.deepEqual(
    new Set(metaverseCharacterProofConfig.animationClips.map((clip) => clip.sourcePath)),
    new Set([mesh2motionHumanoidCanonicalAnimationPackSourcePath])
  );

  for (const clipId of activeCharacter.animationClipIds) {
    const clipDescriptor = animationClipManifest.byId[clipId];

    assert.ok(clipDescriptor);
    assert.equal(clipDescriptor.targetSkeleton, activeCharacter.skeleton);
  }
});

test("metaverse asset proof resolves static, instanced, and dynamic environment config from manifests", async () => {
  const { metaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/app/states/metaverse-asset-proof.ts"
  );

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 4);

  const crateAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-crate-v1"
  );
  const dockAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dock-v1"
  );
  const pushableCrateAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-pushable-crate-v1"
  );
  const skiffAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-skiff-v1"
  );

  assert.ok(crateAsset);
  assert.equal(crateAsset.collisionPath, null);
  assert.equal(crateAsset.placement, "instanced");
  assert.equal(crateAsset.traversalAffordance, "blocker");
  assert.ok(crateAsset.lods.length >= 2);
  assert.ok(crateAsset.placements.length > 1);
  assert.equal(crateAsset.physicsColliders?.length, 1);

  assert.ok(dockAsset);
  assert.equal(dockAsset.collisionPath, null);
  assert.equal(dockAsset.placement, "static");
  assert.equal(dockAsset.traversalAffordance, "support");
  assert.ok(dockAsset.lods.length >= 2);
  assert.equal(dockAsset.placements.length, 1);
  assert.equal(dockAsset.physicsColliders?.length, 1);

  assert.ok(pushableCrateAsset);
  assert.equal(pushableCrateAsset.collisionPath, null);
  assert.equal(pushableCrateAsset.placement, "dynamic");
  assert.equal(pushableCrateAsset.traversalAffordance, "pushable");
  assert.equal(pushableCrateAsset.lods.length, 1);
  assert.equal(pushableCrateAsset.placements.length, 1);
  assert.equal(pushableCrateAsset.physicsColliders, null);
  assert.equal(pushableCrateAsset.mount, null);
  assert.equal(pushableCrateAsset.collider?.shape, "box");

  assert.ok(skiffAsset);
  assert.equal(skiffAsset.placement, "dynamic");
  assert.equal(skiffAsset.traversalAffordance, "mount");
  assert.equal(skiffAsset.lods.length, 1);
  assert.equal(skiffAsset.placements.length, 1);
  assert.equal(skiffAsset.physicsColliders, null);
  assert.equal(skiffAsset.mount?.seatSocketName, "seat_socket");
  assert.equal(skiffAsset.collider?.shape, "box");
});

test("createMetaverseScene syncs pushable dynamic assets from exact pose overrides without exposing mount focus", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createPushableCrateProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  const initialInteractionSnapshot = sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: -3.8, y: 1.2, z: -14.4 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(initialInteractionSnapshot.focusedMountable, null);

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-pushable-crate-v1", {
    position: { x: -2.4, y: 0.46, z: -13.2 },
    yawRadians: 0.6
  });
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: -2.4, y: 1.2, z: -13.2 },
      yawRadians: 0
    },
    null,
    1000,
    1 / 60
  );

  const pushableRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-pushable-crate-v1"
  );

  assert.ok(pushableRoot);
  assert.ok(Math.abs(pushableRoot.position.x - -2.4) < 0.0001);
  assert.ok(Math.abs(pushableRoot.position.y - 0.46) < 0.0001);
  assert.ok(Math.abs(pushableRoot.position.z - -13.2) < 0.0001);
  assert.ok(Math.abs(pushableRoot.rotation.y - 0.6) < 0.0001);
});

test("WebGpuMetaverseRuntime boots pushable rigid bodies and enables dynamic-body impulses only for that slice", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createPushableCrateProofSlice();
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {},
    devicePixelRatio: 1,
    removeEventListener() {},
    requestAnimationFrame() {
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      physicsRuntime,
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(world.rigidBodies.length, 1);
    assert.equal(world.lastCharacterController?.applyImpulsesToDynamicBodies, true);
    assert.equal(runtime.hudSnapshot.focusedMountable, null);

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
});

test("createMetaverseScene boots one manifest-driven character and hand socket attachment proof slice", async () => {
  const [
    { AnimationClip, Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Quaternion, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, VectorKeyframeTrack },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const authoredAnimationPackPath =
    "/models/metaverse/characters/metaverse-mannequin-canonical-animations.glb";
  const loadPaths = [];
  const warnings = [];
  const bodyGeometry = new BoxGeometry(0.4, 1.8, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.45;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.45;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.45;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.25;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();
    socketBone.name = socketName;
    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);
  socketBones[0].position.y = 0.18;
  socketBones[1].position.x = -0.35;
  socketBones[2].position.x = 0.35;
  socketBones[3].position.set(0.2, -0.08, -0.08);
  socketBones[4].position.set(0, 0, -0.08);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const idleClip = new AnimationClip("idle", -1, [
    new VectorKeyframeTrack("humanoid_root.position", [0, 1], [0, 0, 0, 0, 0.05, 0]),
    new QuaternionKeyframeTrack("chest.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.08).toArray()
    ]),
    new QuaternionKeyframeTrack("hand_r_socket.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3).toArray()
    ])
  ]);
  const walkClip = new AnimationClip("walk", -1, []);
  const aimClip = new AnimationClip("aim", -1, []);
  const interactClip = new AnimationClip("interact", -1, []);
  const seatedClip = new AnimationClip("seated", -1, []);
  const animationPackScene = new Group();
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  attachmentScene.add(attachmentMesh);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      socketName: "hand_r_socket"
    },
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "walk"
        },
        {
          clipName: "aim",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "aim"
        },
        {
          clipName: "interact",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "interact"
        },
        {
          clipName: "seated",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "seated"
        }
      ],
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      socketNames
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        loadPaths.push(path);

        if (path === "/models/metaverse/attachments/metaverse-service-pistol.gltf") {
          return {
            animations: [],
            scene: attachmentScene
          };
        }

        if (path === authoredAnimationPackPath) {
          return {
            animations: [idleClip, walkClip, aimClip, interactClip, seatedClip],
            scene: animationPackScene
          };
        }

        return {
          animations: [],
          scene: characterScene
        };
      }
    }),
    warn(message) {
      warnings.push(message);
    }
  });

  await sceneRuntime.boot();

  const characterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/metaverse-mannequin-v1"
  );

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/metaverse-mannequin.gltf",
    authoredAnimationPackPath,
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.equal(
    warnings.some((message) => message.includes("missing authored walk animation")),
    false
  );
  assert.ok(characterRoot);
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/hand_r_socket"));
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/head_socket"));

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    0,
    0,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "metaverse-mannequin-v1",
        playerId: "remote-pilot-2",
        presentation: {
          animationVocabulary: "walk",
          position: { x: -1.5, y: 0, z: -6.2 },
          yawRadians: -0.4
        }
      }
    ]
  );

  assert.equal(characterRoot.visible, true);
  assert.equal(characterRoot.position.x, 3.2);
  assert.equal(characterRoot.position.y, 0);
  assert.equal(characterRoot.position.z, -5.4);
  assert.ok(
    Math.abs(
      wrapRadians(characterRoot.rotation.y - resolveCharacterRenderYawRadians(0.7))
    ) < 0.000001
  );
  assertCharacterRenderYawFacesMetaverseYaw(characterRoot.rotation.y, 0.7);

  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.ok(attachmentRoot);
  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.equal(attachmentRoot.position.length(), 0);
  assert.deepEqual(attachmentRoot.quaternion.toArray(), [0, 0, 0, 1]);
  const remoteCharacterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/metaverse-mannequin-v1/remote-pilot-2"
  );

  assert.ok(remoteCharacterRoot);
  assert.equal(remoteCharacterRoot.position.x, -1.5);
  assert.equal(remoteCharacterRoot.position.z, -6.2);
  assert.ok(
    Math.abs(
      wrapRadians(remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(-0.4))
    ) < 0.000001
  );
  assertCharacterRenderYawFacesMetaverseYaw(remoteCharacterRoot.rotation.y, -0.4);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    16,
    1 / 60,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "metaverse-mannequin-v1",
        playerId: "remote-pilot-2",
        presentation: {
          animationVocabulary: "walk",
          position: { x: 1.2, y: 0, z: -4.8 },
          yawRadians: 0.3
        }
      }
    ]
  );

  assert.ok(remoteCharacterRoot.position.x > -1.5);
  assert.ok(remoteCharacterRoot.position.x < 1.2);
  assert.ok(remoteCharacterRoot.position.z > -6.2);
  assert.ok(remoteCharacterRoot.position.z < -4.8);
  assert.ok(
    Math.abs(
      wrapRadians(
        remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(0.3)
      )
    ) <
      Math.abs(
        wrapRadians(
          resolveCharacterRenderYawRadians(-0.4) -
            resolveCharacterRenderYawRadians(0.3)
        )
      )
  );

  for (let frame = 0; frame < 45; frame += 1) {
    sceneRuntime.syncPresentation(
      {
        lookDirection: { x: 0, y: 0, z: -1 },
        pitchRadians: 0,
        position: { x: 3.2, y: 1.62, z: -5.4 },
        yawRadians: 0.7
      },
      null,
      32 + frame * 16,
      1 / 60,
      {
        animationVocabulary: "walk",
        position: { x: 3.2, y: 0, z: -5.4 },
        yawRadians: 0.7
      },
      [
        {
          characterId: "metaverse-mannequin-v1",
          playerId: "remote-pilot-2",
          presentation: {
            animationVocabulary: "walk",
            position: { x: 1.2, y: 0, z: -4.8 },
            yawRadians: 0.3
          }
        }
      ]
    );
  }

  assert.ok(Math.abs(remoteCharacterRoot.position.x - 1.2) < 0.05);
  assert.ok(Math.abs(remoteCharacterRoot.position.z - -4.8) < 0.05);
  assert.ok(
    Math.abs(
      wrapRadians(remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(0.3))
    ) < 0.05
  );

  sceneRuntime.scene.updateMatrixWorld(true);

  const handSocket = sceneRuntime.scene.getObjectByName("hand_r_socket");
  assert.ok(handSocket);
  const initialAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  handSocket.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.3);
  sceneRuntime.scene.updateMatrixWorld(true);

  const nextAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    100,
    0,
    null,
    []
  );

  assert.equal(characterRoot.visible, false);
  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.equal(attachmentRoot.position.length(), 0);
  assert.deepEqual(attachmentRoot.quaternion.toArray(), [0, 0, 0, 1]);
  assert.ok(initialAttachmentQuaternion.angleTo(nextAttachmentQuaternion) > 0.001);
  assert.equal(
    sceneRuntime.scene.getObjectByName(
      "metaverse_character/metaverse-mannequin-v1/remote-pilot-2"
    ),
    undefined
  );
});

test("createMetaverseScene requires an authored walk clip when walk vocabulary is requested", async () => {
  const [
    { AnimationClip, Bone, BoxGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const bodyGeometry = new BoxGeometry(0.4, 1.8, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.45;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.45;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.45;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.25;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();
    socketBone.name = socketName;
    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin-canonical-animations.glb",
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin-canonical-animations.glb",
          vocabulary: "walk"
        }
      ],
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      socketNames
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/characters/metaverse-mannequin.gltf") {
          return {
            animations: [],
            scene: characterScene
          };
        }

        return {
          animations: [new AnimationClip("idle", -1, [])],
          scene: new Group()
        };
      }
    }),
    warn(message) {
      warnings.push(message);
    }
  });

  const warnings = [];

  await assert.rejects(
    sceneRuntime.boot(),
    /Metaverse character metaverse-mannequin-v1 is missing animation walk\./
  );
  assert.equal(
    warnings.some((message) => message.includes("missing authored walk animation")),
    false
  );
});

test("createMetaverseScene switches environment LOD tiers and instantiates repeated props", async () => {
  const [
    { BoxGeometry, Group, Mesh, MeshStandardMaterial },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const loadPaths = [];
  const createEnvironmentScene = (name, color, size) => {
    const scene = new Group();
    const mesh = new Mesh(
      new BoxGeometry(size.x, size.y, size.z),
      new MeshStandardMaterial({ color })
    );

    mesh.position.y = size.y / 2;
    mesh.name = `${name}_mesh`;
    scene.name = name;
    scene.add(mesh);

    return scene;
  };
  const dockHighScene = createEnvironmentScene(
    "metaverse_hub_dock_high",
    0x9fb3c8,
    { x: 8, y: 0.6, z: 4 }
  );
  const dockLowScene = createEnvironmentScene(
    "metaverse_hub_dock_low",
    0x7b8794,
    { x: 8, y: 0.4, z: 4 }
  );
  const crateHighScene = createEnvironmentScene(
    "metaverse_hub_crate_high",
    0xa16207,
    { x: 0.9, y: 0.9, z: 0.9 }
  );
  const crateLowScene = createEnvironmentScene(
    "metaverse_hub_crate_low",
    0x854d0e,
    { x: 0.84, y: 0.84, z: 0.84 }
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: null,
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        loadPaths.push(path);

        switch (path) {
          case "/models/metaverse/environment/metaverse-hub-dock-high.gltf":
            return {
              animations: [],
              scene: dockHighScene
            };
          case "/models/metaverse/environment/metaverse-hub-dock-low.gltf":
            return {
              animations: [],
              scene: dockLowScene
            };
          case "/models/metaverse/environment/metaverse-hub-crate-high.gltf":
            return {
              animations: [],
              scene: crateHighScene
            };
          case "/models/metaverse/environment/metaverse-hub-crate-low.gltf":
            return {
              animations: [],
              scene: crateLowScene
            };
          default:
            throw new Error(`Unexpected environment asset path ${path}`);
        }
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: null,
          collider: null,
          environmentAssetId: "metaverse-hub-dock-v1",
          label: "Metaverse hub dock",
          lods: [
            {
              maxDistanceMeters: 18,
              modelPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
              tier: "high"
            },
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
              tier: "low"
            }
          ],
          mount: null,
          placement: "static",
          placements: [
            {
              position: { x: 0, y: 0, z: -6 },
              rotationYRadians: 0,
              scale: 1
            }
          ],
          traversalAffordance: "support",
          physicsColliders: null
        },
        {
          collisionPath: null,
          collider: null,
          environmentAssetId: "metaverse-hub-crate-v1",
          label: "Metaverse hub crate",
          lods: [
            {
              maxDistanceMeters: 10,
              modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
              tier: "high"
            },
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-crate-low.gltf",
              tier: "low"
            }
          ],
          mount: null,
          placement: "instanced",
          placements: [
            {
              position: { x: 1.5, y: 0, z: -4 },
              rotationYRadians: 0,
              scale: 1
            },
            {
              position: { x: 3.2, y: 0, z: -4.8 },
              rotationYRadians: Math.PI * 0.1,
              scale: 0.92
            }
          ],
          traversalAffordance: "blocker",
          physicsColliders: null
        }
      ]
    },
    warn() {}
  });

  await sceneRuntime.boot();

  assert.deepEqual(loadPaths, [
    "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
    "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
    "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
    "/models/metaverse/environment/metaverse-hub-crate-low.gltf"
  ]);

  const dockHighLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_static/metaverse-hub-dock-v1/0/high"
  );
  const dockLowLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_static/metaverse-hub-dock-v1/0/low"
  );
  const crateHighLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_lod/metaverse-hub-crate-v1/high"
  );
  const crateLowLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_lod/metaverse-hub-crate-v1/low"
  );

  assert.ok(dockHighLod);
  assert.ok(dockLowLod);
  assert.ok(crateHighLod);
  assert.ok(crateLowLod);
  assert.equal(dockHighLod.isBundleGroup, true);
  assert.equal(dockLowLod.isBundleGroup, true);
  assert.equal(crateHighLod.isBundleGroup, true);
  assert.equal(crateLowLod.isBundleGroup, true);
  assert.ok(crateHighLod.children[0]?.isInstancedMesh);
  assert.equal(dockHighLod.matrixAutoUpdate, false);
  assert.equal(dockLowLod.matrixAutoUpdate, false);
  assert.equal(crateHighLod.matrixAutoUpdate, false);
  assert.equal(crateLowLod.matrixAutoUpdate, false);
  assert.equal(crateHighLod.children[0]?.matrixAutoUpdate, false);

  const viewportRenderer = {
    setPixelRatio() {},
    setSize() {}
  };

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  const dockHighBundleVersion = dockHighLod.version;
  const crateHighBundleVersion = crateHighLod.version;

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  assert.equal(dockHighLod.version, dockHighBundleVersion);
  assert.equal(crateHighLod.version, crateHighBundleVersion);

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 900,
      clientWidth: 1440
    },
    1
  );

  assert.equal(dockHighLod.version, dockHighBundleVersion + 1);
  assert.equal(crateHighLod.version, crateHighBundleVersion + 1);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.6, z: 0 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, true);
  assert.equal(dockLowLod.visible, false);
  assert.equal(crateHighLod.visible, true);
  assert.equal(crateLowLod.visible, false);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.6, z: 30 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, false);
  assert.equal(dockLowLod.visible, true);
  assert.equal(crateHighLod.visible, false);
  assert.equal(crateLowLod.visible, true);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 0, z: 11.3 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, false);
  assert.equal(dockLowLod.visible, true);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 0, z: 10.6 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, true);
  assert.equal(dockLowLod.visible, false);
});

test("createMetaverseScene mounts and dismounts a dynamic environment asset through seat_socket alignment", async () => {
  const [
    {
      AnimationClip,
      Bone,
      BoxGeometry,
      Float32BufferAttribute,
      Group,
      Mesh,
      MeshStandardMaterial,
      Quaternion,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute,
      Vector3
    },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const bodyGeometry = new BoxGeometry(0.4, 1.8, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.45;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.45;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.45;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.25;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();
    socketBone.name = socketName;
    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);
  socketBones[0].position.y = 0.18;
  socketBones[1].position.x = -0.35;
  socketBones[2].position.x = 0.35;
  socketBones[3].position.set(0.2, -0.08, -0.08);
  socketBones[4].position.set(0, 0, -0.08);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const idleClip = new AnimationClip("idle", -1, []);
  const walkClip = new AnimationClip("walk", -1, []);
  const skiffScene = new Group();
  const skiffHull = new Mesh(
    new BoxGeometry(4.2, 0.6, 1.8),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const seatSocket = new Group();

  skiffHull.position.y = 0.3;
  seatSocket.name = "seat_socket";
  seatSocket.position.set(0, 1, 0);
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(skiffHull, seatSocket);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
          vocabulary: "walk"
        }
      ],
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      socketNames
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/environment/metaverse-hub-skiff.gltf") {
          return {
            animations: [],
            scene: skiffScene
          };
        }

        return {
          animations: [idleClip, walkClip],
          scene: characterScene
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf",
          collider: {
            center: { x: 0, y: 1, z: 0 },
            shape: "box",
            size: { x: 5, y: 3, z: 3 }
          },
          environmentAssetId: "metaverse-hub-skiff-v1",
          label: "Metaverse hub skiff",
          lods: [
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-skiff.gltf",
              tier: "high"
            }
          ],
          mount: {
            seatSocketName: "seat_socket"
          },
          placement: "dynamic",
          placements: [
            {
              position: { x: 11.5, y: 0.1, z: -14.2 },
              rotationYRadians: Math.PI * 0.8,
              scale: 1
            }
          ],
          physicsColliders: null,
          traversalAffordance: "mount"
        }
      ]
    },
    warn() {}
  });

  await sceneRuntime.boot();

  const cameraSnapshot = {
    lookDirection: { x: 0, y: 0, z: -1 },
    pitchRadians: 0,
    position: { x: 11.5, y: 1.2, z: -14.2 },
    yawRadians: 0
  };
  const characterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/metaverse-mannequin-v1"
  );
  const originalParent = characterRoot.parent;
  const originalWorldPosition = characterRoot.getWorldPosition(new Vector3());
  const originalWorldQuaternion = characterRoot.getWorldQuaternion(new Quaternion());

  const initialInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0
  );

  assert.equal(initialInteractionSnapshot.focusedMountable?.environmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(initialInteractionSnapshot.mountedEnvironment, null);

  const mountedInteractionSnapshot = sceneRuntime.toggleMount(cameraSnapshot);

  assert.equal(mountedInteractionSnapshot.focusedMountable, null);
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(characterRoot.parent?.name, "seat_socket");

  sceneRuntime.scene.updateMatrixWorld(true);
  const mountedEnvironmentSeatSocket = characterRoot.parent;
  const mountedCharacterSeatSocket = characterRoot.getObjectByName("seat_socket");

  assert.ok(mountedEnvironmentSeatSocket);
  assert.ok(mountedCharacterSeatSocket);
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  sceneRuntime.syncPresentation(cameraSnapshot, null, 1200, 0.016);
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  const dismountedInteractionSnapshot = sceneRuntime.toggleMount(cameraSnapshot);

  assert.equal(dismountedInteractionSnapshot.mountedEnvironment, null);
  assert.equal(
    dismountedInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(characterRoot.parent, originalParent);
  assert.ok(
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) < 0.001
  );
  assert.ok(
    characterRoot.getWorldQuaternion(new Quaternion()).angleTo(originalWorldQuaternion) <
      0.001
  );
});
