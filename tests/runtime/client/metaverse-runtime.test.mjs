import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseRealtimeWorldSnapshot,
  createMetaversePresenceRosterSnapshot,
  createMetaversePlayerId,
  createMetaverseVehicleId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve
  };
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
  constructor(shape, payload, translation, rotation, parentBody = null) {
    this.parentBody = parentBody;
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

function rotatePlanarPointByQuaternion(x, z, quaternion) {
  const tx = 2 * (quaternion.y * 0 - quaternion.z * z);
  const tz = 2 * (quaternion.x * 0 - quaternion.y * x);

  return {
    x:
      x +
      quaternion.w * tx +
      quaternion.y * tz,
    z:
      z +
      quaternion.w * tz -
      quaternion.y * tx
  };
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
      const candidateRotation = candidate.rotationQuaternion ?? {
        x: 0,
        y: 0,
        z: 0,
        w: 1
      };
      const localOffset = rotatePlanarPointByQuaternion(
        centerX - candidateTranslation.x,
        centerZ - candidateTranslation.z,
        {
          x: -candidateRotation.x,
          y: -candidateRotation.y,
          z: -candidateRotation.z,
          w: candidateRotation.w
        }
      );

      if (
        Math.abs(localOffset.x) > halfExtentX + capsuleRadius ||
        Math.abs(localOffset.z) > halfExtentZ + capsuleRadius
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
      colliderDesc.rotation,
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
  info = {
    render: {
      drawCalls: 7,
      triangles: 1440
    }
  };
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

const disabledBootCinematicConfig = Object.freeze({
  enabled: false,
  minimumDwellMs: 0,
  shots: Object.freeze([])
});

class FakeMetaversePresenceClient {
  constructor(localPlayerId, localUsername, remotePlayerId) {
    this.disposeCalls = 0;
    this.ensureJoinedRequests = [];
    this.listeners = new Set();
    this.localPlayerId = localPlayerId;
    this.localUsername = localUsername;
    this.remotePlayerId = remotePlayerId;
    this.rosterSnapshot = null;
    this.reliableTransportStatusSnapshot = Object.freeze({
      activeTransport: "http",
      browserWebTransportAvailable: false,
      enabled: true,
      fallbackActive: false,
      lastTransportError: null,
      preference: "http",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
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

function createRealtimeWorldSnapshot({
  currentTick,
  localMountedOccupancy = null,
  localPlayerId,
  localUsername,
  remotePlayerId,
  remotePlayerX,
  remoteUsername,
  serverTimeMs,
  snapshotSequence,
  tickIntervalMs = 50,
  vehicleLinearVelocity = {
    x: 20,
    y: 0,
    z: 0
  },
  vehicleSeatOccupantPlayerId = remotePlayerId,
  vehicleX,
  yawRadians = 0
}) {
  const vehicleId = createMetaverseVehicleId("metaverse-hub-skiff-v1");

  assert.notEqual(vehicleId, null);

  return createMetaverseRealtimeWorldSnapshot({
    players: [
      {
        characterId: "metaverse-mannequin-v1",
        linearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        locomotionMode: localMountedOccupancy === null ? "grounded" : "mounted",
        mountedOccupancy:
          localMountedOccupancy === null
            ? null
            : {
                ...localMountedOccupancy,
                vehicleId
              },
        playerId: localPlayerId,
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: snapshotSequence,
        username: localUsername,
        yawRadians: 0
      },
      {
        animationVocabulary: "seated",
        characterId: "metaverse-mannequin-v1",
        linearVelocity: {
          x: 20,
          y: 0,
          z: 0
        },
        locomotionMode: "mounted",
        playerId: remotePlayerId,
        position: {
          x: remotePlayerX,
          y: 0.75,
          z: 18
        },
        stateSequence: snapshotSequence,
        username: remoteUsername,
        yawRadians
      }
    ],
    snapshotSequence,
    tick: {
      currentTick,
      serverTimeMs,
      tickIntervalMs
    },
    vehicles: [
      {
        angularVelocityRadiansPerSecond: 1.3333333333333333,
        environmentAssetId: "metaverse-hub-skiff-v1",
        linearVelocity: vehicleLinearVelocity,
        position: {
          x: vehicleX,
          y: 0.35,
          z: 18
        },
        seats: [
          {
            occupantPlayerId: vehicleSeatOccupantPlayerId,
            occupantRole: "driver",
            seatId: "driver-seat"
          }
        ],
        vehicleId,
        yawRadians
      }
    ]
  });
}

class FakeMetaverseWorldClient {
  constructor(worldSnapshotBuffer = []) {
    this.disposeCalls = 0;
    this.driverVehicleControlDatagramStatusSnapshot = Object.freeze({
      activeTransport: null,
      browserWebTransportAvailable: false,
      enabled: true,
      lastTransportError: null,
      preference: "http",
      state: "unavailable",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
    this.driverVehicleControlRequests = [];
    this.ensureConnectedRequests = [];
    this.listeners = new Set();
    this.reliableTransportStatusSnapshot = Object.freeze({
      activeTransport: "http",
      browserWebTransportAvailable: false,
      enabled: true,
      fallbackActive: false,
      lastTransportError: null,
      preference: "http",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
    this.worldSnapshotBuffer = Object.freeze(worldSnapshotBuffer);
    this.statusSnapshot = Object.freeze({
      connected: worldSnapshotBuffer.length > 0,
      lastError: null,
      lastSnapshotSequence:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.snapshotSequence ?? null,
      lastWorldTick:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.tick.currentTick ?? null,
      playerId: null,
      state: worldSnapshotBuffer.length > 0 ? "connected" : "idle"
    });
  }

  ensureConnected(playerId) {
    this.ensureConnectedRequests.push(playerId);
    this.statusSnapshot = Object.freeze({
      connected: true,
      lastError: null,
      lastSnapshotSequence:
        this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1]
          ?.snapshotSequence ?? null,
      lastWorldTick:
        this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1]?.tick
          .currentTick ?? null,
      playerId,
      state: "connected"
    });
    this.#notifyUpdates();

    return Promise.resolve(
      this.worldSnapshotBuffer[this.worldSnapshotBuffer.length - 1] ?? null
    );
  }

  syncDriverVehicleControl(commandInput) {
    this.driverVehicleControlRequests.push(commandInput);
  }

  publishWorldSnapshotBuffer(worldSnapshotBuffer) {
    this.worldSnapshotBuffer = Object.freeze(worldSnapshotBuffer);
    this.statusSnapshot = Object.freeze({
      connected: worldSnapshotBuffer.length > 0,
      lastError: null,
      lastSnapshotSequence:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.snapshotSequence ?? null,
      lastWorldTick:
        worldSnapshotBuffer[worldSnapshotBuffer.length - 1]?.tick.currentTick ?? null,
      playerId: this.statusSnapshot.playerId,
      state: worldSnapshotBuffer.length > 0 ? "connected" : "idle"
    });
    this.#notifyUpdates();
  }

  subscribeUpdates(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.disposeCalls += 1;
    this.statusSnapshot = Object.freeze({
      connected: false,
      lastError: null,
      lastSnapshotSequence: this.statusSnapshot.lastSnapshotSequence,
      lastWorldTick: this.statusSnapshot.lastWorldTick,
      playerId: this.statusSnapshot.playerId,
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

function assertQuaternionArraysEquivalent(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  let maxDirectDelta = 0;
  let maxNegatedDelta = 0;

  for (let index = 0; index < actual.length; index += 1) {
    maxDirectDelta = Math.max(maxDirectDelta, Math.abs(actual[index] - expected[index]));
    maxNegatedDelta = Math.max(maxNegatedDelta, Math.abs(actual[index] + expected[index]));
  }

  assert.ok(
    Math.min(maxDirectDelta, maxNegatedDelta) <= tolerance,
    `${message}: expected ${expected.join(",")}, received ${actual.join(",")}.`
  );
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
    new BoxGeometry(5.8, 0.6, 2.4),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const deckEntry = new Group();
  const driverSeat = new Group();
  const portBenchSeat = new Group();
  const portBenchRearSeat = new Group();
  const starboardBenchSeat = new Group();
  const starboardBenchRearSeat = new Group();

  skiffHull.position.y = 0.3;
  deckEntry.name = "deck_entry";
  deckEntry.position.set(-2.12, 1, 0);
  driverSeat.name = "driver_seat";
  driverSeat.position.set(1.32, 1, 0);
  driverSeat.rotation.y = Math.PI * 0.5;
  portBenchSeat.name = "port_bench_seat";
  portBenchSeat.position.set(0.65, 1, -0.72);
  portBenchRearSeat.name = "port_bench_rear_seat";
  portBenchRearSeat.position.set(-0.65, 1, -0.72);
  starboardBenchSeat.name = "starboard_bench_seat";
  starboardBenchSeat.position.set(0.65, 1, 0.72);
  starboardBenchSeat.rotation.y = Math.PI;
  starboardBenchRearSeat.name = "starboard_bench_rear_seat";
  starboardBenchRearSeat.position.set(-0.65, 1, 0.72);
  starboardBenchRearSeat.rotation.y = Math.PI;
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(
    skiffHull,
    deckEntry,
    driverSeat,
    portBenchSeat,
    portBenchRearSeat,
    starboardBenchSeat,
    starboardBenchRearSeat
  );

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
      skeletonId: "humanoid_v1",
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
            size: { x: 6.2, y: 2.4, z: 3.2 }
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
          orientation: {
            forwardModelYawRadians: Math.PI * 0.5
          },
          placement: "dynamic",
          placements: [
            {
              position: { x: 0, y: 0.12, z: 24 },
              rotationYRadians: Math.PI,
              scale: 1
            }
          ],
          physicsColliders: [
            {
              center: { x: 0, y: 0.28, z: 0 },
              shape: "box",
              size: { x: 5.8, y: 0.56, z: 2.6 },
              traversalAffordance: "blocker"
            },
            {
              center: { x: 0, y: 0.62, z: 0 },
              shape: "box",
              size: { x: 5.2, y: 0.12, z: 2 },
              traversalAffordance: "support"
            },
            {
              center: { x: 1.35, y: 0.94, z: 0 },
              shape: "box",
              size: { x: 0.9, y: 0.18, z: 0.8 },
              traversalAffordance: "support"
            },
            {
              center: { x: 1.72, y: 1.18, z: 0 },
              shape: "box",
              size: { x: 0.62, y: 0.58, z: 0.84 },
              traversalAffordance: "blocker"
            },
            {
              center: { x: 0, y: 0.92, z: -0.74 },
              shape: "box",
              size: { x: 2.6, y: 0.16, z: 0.52 },
              traversalAffordance: "support"
            },
            {
              center: { x: 0, y: 1.12, z: -0.88 },
              shape: "box",
              size: { x: 2.6, y: 0.42, z: 0.24 },
              traversalAffordance: "blocker"
            },
            {
              center: { x: 0, y: 0.92, z: 0.74 },
              shape: "box",
              size: { x: 2.6, y: 0.16, z: 0.52 },
              traversalAffordance: "support"
            },
            {
              center: { x: 0, y: 1.12, z: 0.88 },
              shape: "box",
              size: { x: 2.6, y: 0.42, z: 0.24 },
              traversalAffordance: "blocker"
            }
          ],
          entries: [
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: { x: 0, y: 0, z: 1.2 },
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            }
          ],
          seats: [
            {
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: { x: 0, y: 0, z: 1 },
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat",
              seatNodeName: "port_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat-rear",
              seatNodeName: "port_bench_rear_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat",
              seatNodeName: "starboard_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat-rear",
              seatNodeName: "starboard_bench_rear_seat",
              seatRole: "passenger"
            }
          ],
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
          placement: "static",
          placements: [
            {
              position: { x: 0, y: -0.1, z: 24 },
              rotationYRadians: 0,
              scale: 1
            }
          ],
          entries: null,
          seats: null,
          traversalAffordance: "support",
          physicsColliders: [
            {
              center: { x: 0, y: 0, z: 0 },
              shape: "box",
              size: { x: 8, y: 0.4, z: 8 },
              traversalAffordance: "support"
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
          placement: "dynamic",
          placements: [
            {
              position: { x: -3.8, y: 0.46, z: -14.4 },
              rotationYRadians: Math.PI * 0.04,
              scale: 1
            }
          ],
          entries: null,
          physicsColliders: null,
          seats: null,
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
  assert.equal(runtime.hudSnapshot.boot.phase, "idle");
  assert.equal(runtime.hudSnapshot.boot.rendererInitialized, false);
  assert.equal(runtime.hudSnapshot.telemetry.renderer.active, false);
  assert.equal(runtime.hudSnapshot.telemetry.renderer.label, "WebGPU");
  assert.equal(runtime.hudSnapshot.telemetry.worldCadence.worldPollIntervalMs, 50);
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.remoteInterpolationDelayMs,
    100
  );
  assert.equal(runtime.hudSnapshot.telemetry.worldCadence.maxExtrapolationMs, 90);
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.localAuthoritativeFreshnessMaxAgeMs,
    90
  );
  assert.equal(
    runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
    null
  );
  assert.equal(runtime.hudSnapshot.transport.presenceReliable.enabled, false);
  assert.equal(runtime.hudSnapshot.transport.worldReliable.enabled, false);
  assert.equal(runtime.hudSnapshot.transport.worldDriverDatagram.enabled, false);
  assert.equal(runtime.hudSnapshot.presence.state, "disabled");
  assert.equal(runtime.hudSnapshot.presence.remotePlayerCount, 0);

  await assert.rejects(
    () => runtime.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("WebGpuMetaverseRuntime publishes boot-phase progression and per-lane transport truth", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  const joinDeferred = createDeferred();
  const connectDeferred = createDeferred();
  const presenceListeners = new Set();
  const worldListeners = new Set();

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  let presenceStatusSnapshot = Object.freeze({
    joined: false,
    lastError: null,
    lastSnapshotSequence: null,
    playerId: null,
    state: "joining"
  });
  let presenceRosterSnapshot = null;
  const fakePresenceClient = {
    get reliableTransportStatusSnapshot() {
      return Object.freeze({
        activeTransport: "http",
        browserWebTransportAvailable: false,
        enabled: true,
        fallbackActive: false,
        lastTransportError: null,
        preference: "http",
        webTransportConfigured: false,
        webTransportStatus: "not-requested"
      });
    },
    get rosterSnapshot() {
      return presenceRosterSnapshot;
    },
    get statusSnapshot() {
      return presenceStatusSnapshot;
    },
    dispose() {},
    ensureJoined(request) {
      return joinDeferred.promise.then(() => {
        presenceStatusSnapshot = Object.freeze({
          joined: true,
          lastError: null,
          lastSnapshotSequence: 1,
          playerId: localPlayerId,
          state: "connected"
        });
        presenceRosterSnapshot = createMetaversePresenceRosterSnapshot({
          players: [
            {
              characterId: request.characterId,
              playerId: localPlayerId,
              pose: {
                ...request.pose,
                stateSequence: 1
              },
              username
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
        });
        for (const listener of presenceListeners) {
          listener();
        }

        return presenceRosterSnapshot;
      });
    },
    subscribeUpdates(listener) {
      presenceListeners.add(listener);

      return () => {
        presenceListeners.delete(listener);
      };
    },
    syncPresence() {}
  };

  const authoritativeWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    localPlayerId,
    localUsername: username,
    remotePlayerId,
    remotePlayerX: 8,
    remoteUsername,
    serverTimeMs: Date.now(),
    snapshotSequence: 1,
    vehicleX: 8
  });
  let worldStatusSnapshot = Object.freeze({
    connected: false,
    lastError: null,
    lastSnapshotSequence: null,
    lastWorldTick: null,
    playerId: null,
    state: "connecting"
  });
  let worldSnapshotBuffer = Object.freeze([]);
  const fakeWorldClient = {
    ensureConnectedRequests: [],
    get currentPollIntervalMs() {
      return 50;
    },
    get driverVehicleControlDatagramStatusSnapshot() {
      return Object.freeze({
        activeTransport: "reliable-command-fallback",
        browserWebTransportAvailable: true,
        enabled: true,
        lastTransportError: "Datagram transport unavailable.",
        preference: "webtransport-preferred",
        state: "degraded-to-reliable",
        webTransportConfigured: true,
        webTransportStatus: "runtime-fallback"
      });
    },
    get reliableTransportStatusSnapshot() {
      return Object.freeze({
        activeTransport: "http",
        browserWebTransportAvailable: true,
        enabled: true,
        fallbackActive: true,
        lastTransportError:
          "Reliable WebTransport JSON request channel closed before a response frame arrived.",
        preference: "webtransport-preferred",
        webTransportConfigured: true,
        webTransportStatus: "localdev-host-unavailable"
      });
    },
    get statusSnapshot() {
      return worldStatusSnapshot;
    },
    get worldSnapshotBuffer() {
      return worldSnapshotBuffer;
    },
    dispose() {},
    ensureConnected(playerId) {
      this.ensureConnectedRequests.push(playerId);

      return connectDeferred.promise.then(() => {
        worldSnapshotBuffer = Object.freeze([authoritativeWorldSnapshot]);
        worldStatusSnapshot = Object.freeze({
          connected: true,
          lastError: null,
          lastSnapshotSequence: authoritativeWorldSnapshot.snapshotSequence,
          lastWorldTick: authoritativeWorldSnapshot.tick.currentTick,
          playerId,
          state: "connected"
        });
        for (const listener of worldListeners) {
          listener();
        }

        return authoritativeWorldSnapshot;
      });
    },
    subscribeUpdates(listener) {
      worldListeners.add(listener);

      return () => {
        worldListeners.delete(listener);
      };
    },
    syncDriverVehicleControl() {}
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
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(runtime.hudSnapshot.boot.rendererInitialized, true);
    assert.equal(runtime.hudSnapshot.boot.scenePrewarmed, true);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.active, true);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.drawCallCount, 7);
    assert.equal(runtime.hudSnapshot.telemetry.renderer.triangleCount, 1440);
    assert.equal(runtime.hudSnapshot.telemetry.worldCadence.worldPollIntervalMs, 50);
    assert.equal(
      runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
      null
    );
    assert.equal(runtime.hudSnapshot.boot.phase, "presence-joining");
    assert.equal(
      runtime.hudSnapshot.transport.presenceReliable.webTransportStatus,
      "not-requested"
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldReliable.webTransportStatus,
      "localdev-host-unavailable"
    );
    assert.equal(
      runtime.hudSnapshot.transport.worldDriverDatagram.state,
      "degraded-to-reliable"
    );

    joinDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(fakeWorldClient.ensureConnectedRequests, [localPlayerId]);
    assert.equal(runtime.hudSnapshot.boot.presenceJoined, true);
    assert.equal(runtime.hudSnapshot.boot.phase, "world-connecting");

    connectDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(runtime.hudSnapshot.boot.authoritativeWorldConnected, true);
    assert.equal(runtime.hudSnapshot.boot.phase, "ready");
    assert.equal(
      runtime.hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs,
      50
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
  }
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
    assert.equal(startSnapshot.telemetry.renderer.active, true);
    assert.equal(startSnapshot.telemetry.renderer.drawCallCount, 7);
    assert.equal(startSnapshot.telemetry.renderer.triangleCount, 1440);
    assert.equal(startSnapshot.telemetry.renderer.label, "WebGPU");
    assert.equal(startSnapshot.telemetry.renderedFrameCount, 1);
    assert.equal(renderer.initCalls, 1);
    assert.equal(renderer.compileAsyncCalls.length, 2);
    assert.equal(renderer.renderCalls, 5);
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
          locomotionMode: "mounted",
          mountedOccupancy: {
            environmentAssetId: "metaverse-hub-skiff-v1",
            entryId: null,
            occupancyKind: "seat",
            occupantRole: "passenger",
            seatId: "port-bench-seat"
          },
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
    "grounded",
    null
  );
  presenceRuntime.syncRemoteCharacterPresentations();

  assert.equal(presenceRuntime.remoteCharacterPresentations.length, 1);
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.presentation.position.x,
    -3
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "port-bench-seat"
  );

  rosterSnapshot.players[1] = {
    ...rosterSnapshot.players[1],
    pose: {
      ...rosterSnapshot.players[1].pose,
      mountedOccupancy: {
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
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
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );

  presenceRuntime.dispose();

  assert.equal(disposeCalls, 1);
});

test("MetaversePresenceRuntime syncs canonical mounted occupancy through the presence client", async () => {
  const { MetaversePresenceRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-presence-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const localUsername = createUsername("Harbor Pilot");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(localUsername, null);

  const syncPresenceCalls = [];
  const fakePresenceClient = {
    rosterSnapshot: createMetaversePresenceRosterSnapshot({
      players: [],
      snapshotSequence: 1,
      tickIntervalMs: 120
    }),
    statusSnapshot: Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: localPlayerId,
      state: "connected"
    }),
    dispose() {},
    ensureJoined() {
      return Promise.resolve(this.rosterSnapshot);
    },
    subscribeUpdates() {
      return () => {};
    },
    syncPresence(pose) {
      syncPresenceCalls.push(pose);
    }
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
    "grounded",
    null
  );
  presenceRuntime.syncPresencePose(
    {
      animationVocabulary: "seated",
      position: {
        x: 11.5,
        y: 1.1,
        z: -14.2
      },
      yawRadians: 0.6
    },
    "mounted",
    Object.freeze({
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      directSeatTargets: Object.freeze([]),
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Metaverse hub skiff",
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Take helm",
      occupantRole: "driver",
      seatTargets: Object.freeze([]),
      seatId: "driver-seat"
    })
  );

  assert.ok(syncPresenceCalls.length >= 1);
  assert.equal(
    syncPresenceCalls.at(-1)?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(syncPresenceCalls.at(-1)?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    syncPresenceCalls.at(-1)?.mountedOccupancy?.occupancyKind,
    "seat"
  );
});

test("MetaverseRemoteWorldRuntime samples buffered authoritative world snapshots against server time", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    }),
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 11,
      remoteUsername,
      serverTimeMs: 1_150,
      snapshotSequence: 2,
      vehicleX: 11,
      yawRadians: 0.2
    })
  ]);
  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => 1_100,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 75,
      maxExtrapolationMs: 120
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(remoteWorldRuntime.hasWorldSnapshot, true);
  assert.equal(remoteWorldRuntime.remoteCharacterPresentations.length, 1);
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.poseSyncMode,
    "runtime-server-sampled"
  );
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteCharacterPresentations[0]?.presentation.position.x -
        9.5
    ) < 0.000001
  );
  assert.equal(
    remoteWorldRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(remoteWorldRuntime.remoteVehiclePresentations.length, 1);
  assert.ok(
    Math.abs(remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x - 9.5) <
      0.000001
  );
  assert.ok(
    Math.abs(remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians - 0.1) <
      0.000001
  );

  remoteWorldRuntime.dispose();

  assert.equal(fakeWorldClient.disposeCalls, 1);
});

test("MetaverseRemoteWorldRuntime extrapolates from the latest authoritative snapshot when a newer snapshot is missing", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 8,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 8,
      yawRadians: 0
    })
  ]);
  let currentWallClockMs = 1_000;
  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => currentWallClockMs,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 0,
      maxExtrapolationMs: 120
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  currentWallClockMs = 1_060;
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(remoteWorldRuntime.remoteCharacterPresentations.length, 1);
  assert.ok(
    Math.abs(
      remoteWorldRuntime.remoteCharacterPresentations[0]?.presentation.position.x -
        9.2
    ) < 0.000001
  );
  assert.equal(remoteWorldRuntime.remoteVehiclePresentations.length, 1);
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x ?? 0) > 8
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.position.x ?? 0) < 9.2
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians ?? 0) > 0
  );
  assert.ok(
    (remoteWorldRuntime.remoteVehiclePresentations[0]?.yawRadians ?? 0) < 0.08
  );

  remoteWorldRuntime.dispose();
});

test("MetaverseRemoteWorldRuntime returns the latest authoritative vehicle snapshot only while it remains fresh", async () => {
  const { MetaverseRemoteWorldRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-remote-world-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const fakeWorldClient = new FakeMetaverseWorldClient([
    createRealtimeWorldSnapshot({
      currentTick: 10,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 10,
      remoteUsername,
      serverTimeMs: 1_000,
      snapshotSequence: 1,
      vehicleX: 10,
      yawRadians: 0
    }),
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 12,
      remoteUsername,
      serverTimeMs: 1_150,
      snapshotSequence: 2,
      vehicleX: 12,
      yawRadians: 0
    })
  ]);
  const remoteWorldRuntime = new MetaverseRemoteWorldRuntime({
    createMetaverseWorldClient: () => fakeWorldClient,
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username: localUsername
    },
    onRemoteWorldUpdate() {},
    readWallClockMs: () => currentWallClockMs,
    samplingConfig: {
      clockOffsetCorrectionAlpha: 1,
      clockOffsetMaxStepMs: 1_000,
      interpolationDelayMs: 225,
      maxExtrapolationMs: 120
    }
  });

  remoteWorldRuntime.boot();
  remoteWorldRuntime.sampleRemoteWorld();

  assert.equal(
    remoteWorldRuntime.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    12
  );

  currentWallClockMs = 1_500;

  assert.equal(
    remoteWorldRuntime.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    ),
    null
  );

  remoteWorldRuntime.dispose();
});

test("WebGpuMetaverseRuntime starts authoritative world polling after local presence joins", async () => {
  const [{ WebGpuMetaverseRuntime }, { RapierPhysicsRuntime }] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  const renderer = new FakeMetaverseRenderer();
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
  assert.notEqual(remoteUsername, null);

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
    const fakeWorldClient = new FakeMetaverseWorldClient();
    fakeWorldClient.worldSnapshotBuffer = Object.freeze([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 8,
        remoteUsername,
        serverTimeMs: Date.now(),
        snapshotSequence: 1,
        vehicleX: 8
      })
    ]);
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.deepEqual(fakeWorldClient.ensureConnectedRequests, [localPlayerId]);

    runtime.dispose();

    assert.equal(fakeWorldClient.disposeCalls, 1);
  } finally {
    globalThis.window = originalWindow;
  }
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
      bootCinematicConfig: disabledBootCinematicConfig,
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
        bootCinematicConfig: disabledBootCinematicConfig,
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
    assert.equal(runtime.hudSnapshot.focusedMountable?.boardingEntries.length, 1);
    assert.equal(runtime.hudSnapshot.focusedMountable?.directSeatTargets.length, 1);

    runtime.boardMountable();

    assert.equal(
      runtime.hudSnapshot.mountedEnvironment?.environmentAssetId,
      "metaverse-hub-skiff-v1"
    );
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.occupancyKind, "entry");
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.entryId, "deck-entry");
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatId, null);
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatTargets.length, 5);
    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

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
      Math.abs(runtime.hudSnapshot.camera.yawRadians - mountedCamera.yawRadians) >
        0.01
    );
    assert.ok(
      Math.hypot(
        runtime.hudSnapshot.camera.position.x - mountedCamera.position.x,
        runtime.hudSnapshot.camera.position.z - mountedCamera.position.z
      ) > 0.001
    );
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.occupancyKind, "entry");
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.entryId, "deck-entry");
    assert.equal(runtime.hudSnapshot.locomotionMode, "grounded");

    runtime.occupySeat("driver-seat");
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.occupancyKind, "seat");
    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatId, "driver-seat");

    const mountedDriverCamera = runtime.hudSnapshot.camera;

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.hypot(
        runtime.hudSnapshot.camera.position.x - mountedDriverCamera.position.x,
        runtime.hudSnapshot.camera.position.z - mountedDriverCamera.position.z
      ) > 0.001
    );

    runtime.leaveMountedEnvironment();

    assert.equal(runtime.hudSnapshot.mountedEnvironment, null);
    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime publishes routed driver vehicle control intent through the authoritative world client seam", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
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
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  let nowMs = 0;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      bootCinematicConfig: disabledBootCinematicConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      characterProofConfig,
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    runtime.boardMountable();
    runtime.occupySeat("driver-seat");

    windowHarness.dispatch("keydown", {
      code: "KeyW"
    });
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(fakeWorldClient.driverVehicleControlRequests.length > 0, true);
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.playerId,
      localPlayerId
    );
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.controlIntent
        .environmentAssetId,
      "metaverse-hub-skiff-v1"
    );
    assert.equal(
      fakeWorldClient.driverVehicleControlRequests.at(-1)?.controlIntent.moveAxis,
      1
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime reconciles a local mounted skiff from fresh authority instead of delayed remote vehicle sampling", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
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
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      bootCinematicConfig: disabledBootCinematicConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      characterProofConfig,
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      readWallClockMs: () => wallClockMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    runtime.boardMountable();
    runtime.occupySeat("driver-seat");

    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatId, "driver-seat");
    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 10,
        localMountedOccupancy: {
          entryId: null,
          environmentAssetId: "metaverse-hub-skiff-v1",
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 1,
        remoteUsername,
        serverTimeMs: 1_000,
        snapshotSequence: 1,
        vehicleLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        vehicleSeatOccupantPlayerId: localPlayerId,
        vehicleX: 1,
        yawRadians: 0
      }),
      createRealtimeWorldSnapshot({
        currentTick: 11,
        localMountedOccupancy: {
          entryId: null,
          environmentAssetId: "metaverse-hub-skiff-v1",
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 3,
        remoteUsername,
        serverTimeMs: 1_150,
        snapshotSequence: 2,
        vehicleLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        vehicleSeatOccupantPlayerId: localPlayerId,
        vehicleX: 3,
        yawRadians: 0
      })
    ]);

    assert.ok(runtime.hudSnapshot.camera.position.x > 1.5);
    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - 3) <
        Math.abs(runtime.hudSnapshot.camera.position.x - 1)
    );

    wallClockMs = 1_500;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.ok(
      Math.abs(runtime.hudSnapshot.camera.position.x - 3) <
        Math.abs(runtime.hudSnapshot.camera.position.x - 1)
    );

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("WebGpuMetaverseRuntime clears a local driver seat claim after authoritative world rejects it", async () => {
  const [
    { WebGpuMetaverseRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/webgpu-metaverse-runtime.ts"),
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
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const username = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let nowMs = 0;
  let wallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(username, null);
  assert.notEqual(remoteUsername, null);

  globalThis.window = windowHarness.window;
  globalThis.HTMLElement = class FakeHTMLElement {};

  try {
    const fakePresenceClient = new FakeMetaversePresenceClient(
      localPlayerId,
      username,
      remotePlayerId
    );
    const fakeWorldClient = new FakeMetaverseWorldClient();
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      bootCinematicConfig: disabledBootCinematicConfig,
      cancelAnimationFrame:
        globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      characterProofConfig,
      createMetaversePresenceClient: () => fakePresenceClient,
      createMetaverseWorldClient: () => fakeWorldClient,
      createRenderer: () => renderer,
      createSceneAssetLoader,
      environmentProofConfig,
      localPlayerIdentity: {
        characterId: "metaverse-mannequin-v1",
        playerId: localPlayerId,
        username
      },
      physicsRuntime: createFakePhysicsRuntime(RapierPhysicsRuntime),
      readNowMs: () => nowMs,
      readWallClockMs: () => wallClockMs,
      requestAnimationFrame:
        globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });

    await runtime.start(fakeCanvas, {
      gpu: {}
    });

    runtime.boardMountable();
    runtime.occupySeat("driver-seat");

    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatId, "driver-seat");
    fakeWorldClient.publishWorldSnapshotBuffer([
      createRealtimeWorldSnapshot({
        currentTick: 12,
        localPlayerId,
        localUsername: username,
        remotePlayerId,
        remotePlayerX: 2,
        remoteUsername,
        serverTimeMs: 1_100,
        snapshotSequence: 3,
        vehicleLinearVelocity: {
          x: 0,
          y: 0,
          z: 0
        },
        vehicleSeatOccupantPlayerId: remotePlayerId,
        vehicleX: 2,
        yawRadians: 0
      })
    ]);

    assert.equal(runtime.hudSnapshot.mountedEnvironment?.seatId, "driver-seat");

    wallClockMs = 1_180;
    nowMs += 1000 / 60;
    windowHarness.advanceFrame(nowMs);

    assert.equal(runtime.hudSnapshot.mountedEnvironment, null);
    assert.equal(runtime.hudSnapshot.locomotionMode, "swim");

    runtime.dispose();
  } finally {
    globalThis.window = originalWindow;
    globalThis.HTMLElement = originalHTMLElement;
  }
});

test("MetaverseVehicleRuntime ignores self-owned support colliders when resolving waterborne motion", async () => {
  const [
    { MetaverseVehicleRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: Math.PI
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [
      Object.freeze({
        halfExtents: Object.freeze({
          x: 2.1,
          y: 0.06,
          z: 0.9
        }),
        ownerEnvironmentAssetId: "metaverse-hub-skiff-v1",
        rotation: Object.freeze({
          x: 0,
          y: 0,
          z: 0,
          w: 1
        }),
        translation: Object.freeze({
          x: 0,
          y: 0.62,
          z: 24
        }),
        traversalAffordance: "support"
      })
    ],
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters
  });
  const startingSnapshot = vehicleRuntime.snapshot;

  assert.equal(startingSnapshot.waterborne, true);

  const advancedSnapshot = vehicleRuntime.advance(
    {
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: 0
    },
    metaverseRuntimeConfig.skiff,
    0.25,
    metaverseRuntimeConfig.movement.worldRadius
  );

  assert.equal(advancedSnapshot.waterborne, true);
  assert.ok(
    Math.hypot(
      advancedSnapshot.position.x - startingSnapshot.position.x,
      advancedSnapshot.position.z - startingSnapshot.position.z
    ) > 0.01
  );
});

test("MetaverseVehicleRuntime blends routine authoritative correction and preserves authoritative motion continuity", async () => {
  const [
    { MetaverseVehicleRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: 0
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [],
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters
  });

  const correctedSnapshot = vehicleRuntime.syncAuthoritativePose({
    linearVelocity: {
      x: 0,
      y: 0,
      z: -metaverseRuntimeConfig.skiff.baseSpeedUnitsPerSecond
    },
    position: {
      x: 0.6,
      y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
      z: 23.4
    },
    yawRadians: 0.12
  });

  assert.ok(correctedSnapshot.position.x > 0);
  assert.ok(correctedSnapshot.position.x < 0.6);
  assert.ok(correctedSnapshot.position.z < 24);
  assert.ok(correctedSnapshot.position.z > 23.4);
  assert.ok(correctedSnapshot.yawRadians > 0);
  assert.ok(correctedSnapshot.yawRadians < 0.12);

  const advancedSnapshot = vehicleRuntime.advance(
    {
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      yawAxis: 0
    },
    metaverseRuntimeConfig.skiff,
    1 / 60,
    metaverseRuntimeConfig.movement.worldRadius
  );

  assert.ok(advancedSnapshot.position.z < correctedSnapshot.position.z);
});

test("MetaverseVehicleRuntime snaps gross authoritative divergence instead of blending it", async () => {
  const [
    { MetaverseVehicleRuntime },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const vehicleRuntime = new MetaverseVehicleRuntime({
    authoritativeCorrection: metaverseRuntimeConfig.skiff.authoritativeCorrection,
    environmentAssetId: "metaverse-hub-skiff-v1",
    entries: null,
    label: "Metaverse hub skiff",
    oceanHeightMeters: metaverseRuntimeConfig.ocean.height,
    poseSnapshot: {
      position: {
        x: 0,
        y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
        z: 24
      },
      yawRadians: 0
    },
    seats: [
      {
        cameraPolicyId: "vehicle-follow",
        controlRoutingPolicyId: "vehicle-surface-drive",
        directEntryEnabled: true,
        dismountOffset: { x: 0, y: 0, z: 1 },
        label: "Take helm",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        seatId: "driver-seat",
        seatNodeName: "driver_seat",
        seatRole: "driver"
      }
    ],
    surfaceColliderSnapshots: [],
    waterContactProbeRadiusMeters:
      metaverseRuntimeConfig.skiff.waterContactProbeRadiusMeters,
    waterlineHeightMeters: metaverseRuntimeConfig.skiff.waterlineHeightMeters
  });

  const correctedSnapshot = vehicleRuntime.syncAuthoritativePose({
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0
    },
    position: {
      x: 5,
      y: metaverseRuntimeConfig.skiff.waterlineHeightMeters,
      z: 20
    },
    yawRadians: 1
  });

  assert.equal(correctedSnapshot.position.x, 5);
  assert.equal(correctedSnapshot.position.z, 20);
  assert.equal(correctedSnapshot.yawRadians, 1);
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
  assert.equal(metaverseAttachmentProofConfig.heldMount.socketName, "palm_r_socket");
  assert.deepEqual(metaverseAttachmentProofConfig.heldMount.gripAlignment, {
    attachmentForwardMarkerNodeName: "metaverse_service_pistol_forward_marker",
    attachmentGripMarkerNodeName: "metaverse_service_pistol_grip_right_marker",
    attachmentUpMarkerNodeName: "metaverse_service_pistol_up_marker",
    socketForwardAxis: { x: 1, y: 0, z: 0 },
    socketOffset: { x: 0, y: 0, z: 0 },
    socketUpAxis: { x: 0, y: -1, z: 0 }
  });
  assert.deepEqual(metaverseAttachmentProofConfig.mountedHolsterMount, {
    gripAlignment: {
      attachmentForwardMarkerNodeName: "metaverse_service_pistol_forward_marker",
      attachmentGripMarkerNodeName: "metaverse_service_pistol_holster_marker",
      attachmentUpMarkerNodeName: "metaverse_service_pistol_up_marker",
      socketForwardAxis: { x: 0, y: -1, z: 0 },
      socketOffset: { x: 0.16, y: -0.02, z: -0.04 },
      socketUpAxis: { x: 0, y: 0, z: -1 }
    },
    socketName: "back_socket"
  });
  assert.equal(metaverseAttachmentProofConfig.supportPoints, null);
  assert.equal(metaverseCharacterProofConfig.skeletonId, "humanoid_v2");
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

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 5);

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
  const diveBoatAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dive-boat-v1"
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
  assert.equal(pushableCrateAsset.entries, null);
  assert.equal(pushableCrateAsset.physicsColliders, null);
  assert.equal(pushableCrateAsset.seats, null);
  assert.equal(pushableCrateAsset.collider?.shape, "box");

  assert.ok(skiffAsset);
  assert.equal(skiffAsset.placement, "dynamic");
  assert.equal(skiffAsset.traversalAffordance, "mount");
  assert.equal(skiffAsset.lods.length, 1);
  assert.equal(skiffAsset.placements.length, 1);
  assert.equal(skiffAsset.entries?.length, 1);
  assert.equal(skiffAsset.entries?.[0]?.entryNodeName, "deck_entry");
  assert.equal(skiffAsset.physicsColliders?.length, 8);
  assert.equal(
    skiffAsset.physicsColliders?.filter(
      (collider) => collider.traversalAffordance === "support"
    ).length,
    4
  );
  assert.equal(
    skiffAsset.physicsColliders?.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    4
  );
  assert.equal(skiffAsset.seats?.length, 5);
  assert.equal(skiffAsset.seats?.[0]?.seatNodeName, "driver_seat");
  assert.equal(skiffAsset.seats?.[1]?.seatNodeName, "port_bench_seat");
  assert.equal(skiffAsset.orientation?.forwardModelYawRadians, Math.PI * 0.5);
  assert.equal(skiffAsset.collider?.shape, "box");

  assert.ok(diveBoatAsset);
  assert.equal(diveBoatAsset.placement, "dynamic");
  assert.equal(diveBoatAsset.traversalAffordance, "mount");
  assert.equal(diveBoatAsset.lods.length, 1);
  assert.equal(diveBoatAsset.placements.length, 1);
  assert.equal(diveBoatAsset.entries?.length, 2);
  assert.equal(diveBoatAsset.entries?.[0]?.entryNodeName, "stern_port_entry");
  assert.equal(diveBoatAsset.entries?.[1]?.entryNodeName, "stern_starboard_entry");
  assert.equal(diveBoatAsset.physicsColliders?.length, 9);
  assert.equal(
    diveBoatAsset.physicsColliders?.filter(
      (collider) => collider.traversalAffordance === "support"
    ).length,
    5
  );
  assert.equal(
    diveBoatAsset.physicsColliders?.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    4
  );
  assert.equal(diveBoatAsset.seats?.length, 7);
  assert.equal(diveBoatAsset.seats?.[0]?.seatNodeName, "helm_seat");
  assert.equal(diveBoatAsset.orientation?.forwardModelYawRadians, Math.PI * 0.5);
  assert.equal(diveBoatAsset.collider?.shape, "box");
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

test("MetaverseEnvironmentPhysicsRuntime keeps mountable skiff colliders and support snapshots synced to dynamic vehicle pose", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const groundedBodyRuntime = {
    async init() {},
    dispose() {},
    setApplyImpulsesToDynamicBodies() {}
  };
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader,
      environmentProofConfig,
      groundedBodyRuntime,
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);

  assert.equal(world.colliders.length, 9);
  const portBenchSupportCollider = world.colliders.find(
    (candidate) =>
      candidate.shape === "cuboid" &&
      Math.abs((candidate.payload.halfExtentX ?? 0) - 1.3) < 0.0001 &&
      Math.abs((candidate.payload.halfExtentZ ?? 0) - 0.26) < 0.0001
  );

  assert.ok(portBenchSupportCollider);
  environmentPhysicsRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 4.2, y: 0.25, z: -6.8 },
    yawRadians: Math.PI * 0.25
  });

  const syncedPortBenchColliderTranslation = portBenchSupportCollider.translation();
  const expectedPortBenchOffsetX =
    0 * Math.cos(Math.PI * 0.25) + -0.74 * Math.sin(Math.PI * 0.25);
  const expectedPortBenchOffsetZ =
    -(0) * Math.sin(Math.PI * 0.25) + -0.74 * Math.cos(Math.PI * 0.25);

  assert.ok(
    Math.abs(
      syncedPortBenchColliderTranslation.x - (4.2 + expectedPortBenchOffsetX)
    ) < 0.0001
  );
  assert.ok(
    Math.abs(
      syncedPortBenchColliderTranslation.y - (0.25 + 0.92)
    ) < 0.0001
  );
  assert.ok(
    Math.abs(
      syncedPortBenchColliderTranslation.z - (-6.8 + expectedPortBenchOffsetZ)
    ) < 0.0001
  );
  const syncedPortBenchSupportSnapshot =
    environmentPhysicsRuntime.surfaceColliderSnapshots.find(
      (collider) =>
        collider.traversalAffordance === "support" &&
        Math.abs(collider.halfExtents.x - 1.3) < 0.0001 &&
        Math.abs(collider.halfExtents.z - 0.26) < 0.0001
    );

  assert.ok(syncedPortBenchSupportSnapshot);
  assert.equal(
    syncedPortBenchSupportSnapshot.ownerEnvironmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.ok(
    Math.abs(
      syncedPortBenchSupportSnapshot.translation.x -
        syncedPortBenchColliderTranslation.x
    ) < 0.0001
  );
  assert.ok(
    Math.abs(
      syncedPortBenchSupportSnapshot.translation.z -
        syncedPortBenchColliderTranslation.z
    ) < 0.0001
  );

  environmentPhysicsRuntime.dispose();
});

test("MetaverseEnvironmentPhysicsRuntime syncs remote standing players into blocker colliders without turning swimmers or seated occupants into land", async () => {
  const [
    { Group },
    { metaverseRuntimeConfig },
    { MetaverseEnvironmentPhysicsRuntime },
    { RapierPhysicsRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/classes/metaverse-environment-physics-runtime.ts"),
    clientLoader.load("/src/physics/index.ts")
  ]);
  const { physicsRuntime, world } =
    createFakePhysicsRuntimeWithWorld(RapierPhysicsRuntime);
  const environmentPhysicsRuntime = new MetaverseEnvironmentPhysicsRuntime(
    metaverseRuntimeConfig,
    {
      createSceneAssetLoader: () => ({
        async loadAsync() {
          return {
            animations: [],
            scene: new Group()
          };
        }
      }),
      environmentProofConfig: null,
      groundedBodyRuntime: {
        async init() {},
        dispose() {},
        setApplyImpulsesToDynamicBodies() {}
      },
      physicsRuntime,
      sceneRuntime: {
        scene: new Group(),
        setDynamicEnvironmentPose() {}
      },
      showPhysicsDebug: false
    }
  );

  await environmentPhysicsRuntime.boot(0);
  assert.equal(world.colliders.length, 1);

  environmentPhysicsRuntime.syncRemoteCharacterBlockers([
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      mountedOccupancy: null,
      playerId: "remote-deckhand-1",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "idle",
        position: Object.freeze({ x: 2.4, y: 0.68, z: -5.2 }),
        yawRadians: 0
      })
    }),
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      mountedOccupancy: null,
      playerId: "remote-swimmer-2",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "swim",
        position: Object.freeze({ x: 4.4, y: 0, z: -8 }),
        yawRadians: 0
      })
    }),
    Object.freeze({
      characterId: "metaverse-mannequin-v1",
      mountedOccupancy: Object.freeze({
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "passenger",
        seatId: "port-bench-seat"
      }),
      playerId: "remote-passenger-3",
      poseSyncMode: "runtime-server-sampled",
      presentation: Object.freeze({
        animationVocabulary: "seated",
        position: Object.freeze({ x: 1.8, y: 0.8, z: -5.6 }),
        yawRadians: 0
      })
    })
  ]);

  assert.equal(world.colliders.length, 2);
  assert.equal(
    environmentPhysicsRuntime.surfaceColliderSnapshots.filter(
      (collider) => collider.traversalAffordance === "blocker"
    ).length,
    1
  );
  const remoteBlockerSnapshot =
    environmentPhysicsRuntime.surfaceColliderSnapshots.find(
      (collider) =>
        collider.traversalAffordance === "blocker" &&
        collider.ownerEnvironmentAssetId === null
    );

  assert.ok(remoteBlockerSnapshot);
  assert.ok(
    Math.abs((remoteBlockerSnapshot?.translation.x ?? 0) - 2.4) < 0.0001
  );
  assert.ok(
    Math.abs(
      (remoteBlockerSnapshot?.translation.y ?? 0) -
        (0.68 +
          metaverseRuntimeConfig.groundedBody.capsuleHalfHeightMeters +
          metaverseRuntimeConfig.groundedBody.capsuleRadiusMeters)
    ) < 0.0001
  );

  environmentPhysicsRuntime.dispose();
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
      heldMount: {
        gripAlignment: {
          attachmentForwardAxis: { x: 1, y: 0, z: 0 },
          attachmentUpAxis: { x: 0, y: 1, z: 0 },
          socketForwardAxis: { x: 1, y: 0, z: 0 },
          socketOffset: { x: 0.01, y: -0.02, z: 0.03 },
          socketUpAxis: { x: 0, y: -1, z: 0 }
        },
        socketName: "hand_r_socket"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      mountedHolsterMount: {
        gripAlignment: {
          attachmentForwardAxis: { x: 1, y: 0, z: 0 },
          attachmentUpAxis: { x: 0, y: 1, z: 0 },
          socketForwardAxis: { x: 0, y: -1, z: 0 },
          socketOffset: { x: 0.12, y: 0.03, z: -0.04 },
          socketUpAxis: { x: 0, y: 0, z: -1 }
        },
        socketName: "back_socket"
      },
      supportPoints: [
        {
          localPosition: { x: 0.02, y: -0.08, z: 0.01 },
          supportPointId: "off-hand-support"
        }
      ]
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
      skeletonId: "humanoid_v1",
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
  assert.equal(sceneRuntime.scene.getObjectByName("socket_debug/hand_r_socket"), undefined);
  assert.equal(sceneRuntime.scene.getObjectByName("socket_debug/head_socket"), undefined);

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
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [1, 0, 0, 0],
    0.000001,
    "Attachment grip alignment should flip the pistol upright under the socket"
  );
  const attachmentSupportPoint = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/off-hand-support"
  );

  assert.ok(attachmentSupportPoint);
  assert.ok(
    attachmentSupportPoint.position.distanceTo(new Vector3(0.02, -0.08, 0.01)) <
      0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    8,
    0,
    {
      animationVocabulary: "seated",
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
    ],
    {
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      directSeatTargets: [],
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Skiff",
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Driver seat",
      occupantRole: "driver",
      seatTargets: [],
      seatId: "driver"
    }
  );

  assert.equal(attachmentRoot.parent?.name, "back_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.12, 0.03, -0.04)) < 0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    10,
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
    ],
    {
      cameraPolicyId: "seat-follow",
      controlRoutingPolicyId: "look-only",
      directSeatTargets: [],
      entryId: "deck-entry",
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Skiff",
      lookLimitPolicyId: "passenger-bench",
      occupancyAnimationId: "standing",
      occupancyKind: "entry",
      occupantLabel: "Board deck",
      occupantRole: "passenger",
      seatTargets: [],
      seatId: null
    }
  );

  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    12,
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

  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );

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
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [1, 0, 0, 0],
    0.000001,
    "Attachment grip alignment should remain stable after presentation sync"
  );
  assert.ok(initialAttachmentQuaternion.angleTo(nextAttachmentQuaternion) > 0.001);
  assert.equal(
    sceneRuntime.scene.getObjectByName(
      "metaverse_character/metaverse-mannequin-v1/remote-pilot-2"
    ),
    undefined
  );
});

test("createMetaverseScene preserves authored humanoid_v2 hand socket rotation on synthesized palm sockets", async () => {
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

  const bodyGeometry = new BoxGeometry(0.42, 1.86, 0.28);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const bonesByName = new Map();
  const addBone = (boneName, parentBone = null, position = null) => {
    const bone = new Bone();

    bone.name = boneName;
    if (position !== null) {
      bone.position.copy(position);
    }

    bonesByName.set(boneName, bone);
    parentBone?.add(bone);

    return bone;
  };

  const rootBone = addBone("root");
  const pelvisBone = addBone("pelvis", rootBone, new Vector3(0, 0.92, 0));
  const spine01Bone = addBone("spine_01", pelvisBone, new Vector3(0, 0.18, 0));
  const spine02Bone = addBone("spine_02", spine01Bone, new Vector3(0, 0.18, 0));
  const spine03Bone = addBone("spine_03", spine02Bone, new Vector3(0, 0.18, 0));
  const neckBone = addBone("neck_01", spine03Bone, new Vector3(0, 0.16, 0));
  const headBone = addBone("head", neckBone, new Vector3(0, 0.14, 0));
  const clavicleLBone = addBone("clavicle_l", spine03Bone, new Vector3(-0.12, 0.1, 0));
  const upperarmLBone = addBone("upperarm_l", clavicleLBone, new Vector3(-0.18, 0, 0));
  const lowerarmLBone = addBone("lowerarm_l", upperarmLBone, new Vector3(-0.22, 0, 0));
  const handLBone = addBone("hand_l", lowerarmLBone, new Vector3(-0.18, 0, 0));
  const clavicleRBone = addBone("clavicle_r", spine03Bone, new Vector3(0.12, 0.1, 0));
  const upperarmRBone = addBone("upperarm_r", clavicleRBone, new Vector3(0.18, 0, 0));
  const lowerarmRBone = addBone("lowerarm_r", upperarmRBone, new Vector3(0.22, 0, 0));
  const handRBone = addBone("hand_r", lowerarmRBone, new Vector3(0.18, 0, 0));
  const thighLBone = addBone("thigh_l", pelvisBone, new Vector3(-0.1, -0.26, 0));
  const calfLBone = addBone("calf_l", thighLBone, new Vector3(0, -0.42, 0));
  const footLBone = addBone("foot_l", calfLBone, new Vector3(0, -0.4, 0.06));
  const ballLBone = addBone("ball_l", footLBone, new Vector3(0, 0, 0.12));
  const thighRBone = addBone("thigh_r", pelvisBone, new Vector3(0.1, -0.26, 0));
  const calfRBone = addBone("calf_r", thighRBone, new Vector3(0, -0.42, 0));
  const footRBone = addBone("foot_r", calfRBone, new Vector3(0, -0.4, 0.06));
  const ballRBone = addBone("ball_r", footRBone, new Vector3(0, 0, 0.12));

  addBone("thumb_01_l", handLBone, new Vector3(-0.04, -0.02, 0.06));
  addBone("index_01_l", handLBone, new Vector3(-0.1, 0, 0.03));
  addBone("middle_01_l", handLBone, new Vector3(-0.11, 0, 0));
  addBone("ring_01_l", handLBone, new Vector3(-0.1, 0, -0.03));
  addBone("pinky_01_l", handLBone, new Vector3(-0.08, 0, -0.05));
  addBone("thumb_01_r", handRBone, new Vector3(0.04, -0.02, 0.06));
  addBone("index_01_r", handRBone, new Vector3(0.1, 0, 0.03));
  addBone("middle_01_r", handRBone, new Vector3(0.11, 0, 0));
  addBone("ring_01_r", handRBone, new Vector3(0.1, 0, -0.03));
  addBone("pinky_01_r", handRBone, new Vector3(0.08, 0, -0.05));

  const headSocketBone = addBone("head_socket", headBone, new Vector3(0, 0.12, 0));
  const handLSocketBone = addBone("hand_l_socket", handLBone, new Vector3(-0.05, 0, 0));
  const handRSocketBone = addBone("hand_r_socket", handRBone, new Vector3(0.05, 0, 0));
  const hipSocketBone = addBone("hip_socket", pelvisBone, new Vector3(0.16, -0.08, -0.06));
  const seatSocketBone = addBone("seat_socket", pelvisBone, new Vector3(0, -0.02, -0.08));

  handRSocketBone.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI * 0.5);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0x9ca3af })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    pelvisBone,
    spine01Bone,
    spine02Bone,
    spine03Bone,
    neckBone,
    headBone,
    clavicleLBone,
    upperarmLBone,
    lowerarmLBone,
    handLBone,
    clavicleRBone,
    upperarmRBone,
    lowerarmRBone,
    handRBone,
    thighLBone,
    calfLBone,
    footLBone,
    ballLBone,
    thighRBone,
    calfRBone,
    footRBone,
    ballRBone,
    bonesByName.get("thumb_01_l"),
    bonesByName.get("index_01_l"),
    bonesByName.get("middle_01_l"),
    bonesByName.get("ring_01_l"),
    bonesByName.get("pinky_01_l"),
    bonesByName.get("thumb_01_r"),
    bonesByName.get("index_01_r"),
    bonesByName.get("middle_01_r"),
    bonesByName.get("ring_01_r"),
    bonesByName.get("pinky_01_r"),
    headSocketBone,
    handLSocketBone,
    handRSocketBone,
    hipSocketBone,
    seatSocketBone
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const authoredAnimationPackPath =
    "/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb";
  const idleClip = new AnimationClip("idle", -1, []);
  const walkClip = new AnimationClip("walk", -1, []);
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );

  attachmentMesh.position.x = 0.14;
  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentScene.add(attachmentMesh);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        gripAlignment: {
          attachmentForwardAxis: { x: 1, y: 0, z: 0 },
          attachmentUpAxis: { x: 0, y: 1, z: 0 },
          socketForwardAxis: { x: 1, y: 0, z: 0 },
          socketOffset: { x: 0, y: 0, z: 0 },
          socketUpAxis: { x: 0, y: 1, z: 0 }
        },
        socketName: "palm_r_socket"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      mountedHolsterMount: null,
      supportPoints: null
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
        }
      ],
      characterId: "mesh2motion-humanoid-v1",
      label: "Mesh2Motion humanoid",
      modelPath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
      skeletonId: "humanoid_v2",
      socketNames: [
        "hand_r_socket",
        "hand_l_socket",
        "head_socket",
        "hip_socket",
        "seat_socket"
      ]
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/attachments/metaverse-service-pistol.gltf") {
          return {
            animations: [],
            scene: attachmentScene
          };
        }

        if (path === authoredAnimationPackPath) {
          return {
            animations: [idleClip, walkClip],
            scene: new Group()
          };
        }

        return {
          animations: [],
          scene: characterScene
        };
      }
    }),
    warn() {}
  });

  await sceneRuntime.boot();
  sceneRuntime.scene.updateMatrixWorld(true);

  const handSocket = sceneRuntime.scene.getObjectByName("hand_r_socket");
  const palmSocket = sceneRuntime.scene.getObjectByName("palm_r_socket");
  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.ok(handSocket);
  assert.ok(palmSocket);
  assert.ok(attachmentRoot);
  assert.equal(palmSocket.parent?.name, "hand_r");
  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assertQuaternionArraysEquivalent(
    palmSocket.quaternion.toArray(),
    handSocket.quaternion.toArray(),
    0.000001,
    "Synthesized humanoid_v2 palm socket should preserve the authored hand socket rotation"
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [0, 0, 0, 1],
    0.000001,
    "Humanoid_v2 held attachment should keep identity local rotation when socket and attachment axes match"
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.getWorldQuaternion(new Quaternion()).toArray(),
    palmSocket.getWorldQuaternion(new Quaternion()).toArray(),
    0.000001,
    "Humanoid_v2 held attachment should inherit the synthesized palm socket world rotation"
  );
});

test("createMetaverseScene keeps socket debug markers opt-in", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig
  } = await createSkiffMountProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig,
    showSocketDebug: true,
    warn() {}
  });

  await sceneRuntime.boot();

  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/hand_r_socket"));
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/head_socket"));
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/seat_socket"));
  assert.ok(sceneRuntime.scene.getObjectByName("seat_debug/driver-seat"));
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
      skeletonId: "humanoid_v1",
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
          placement: "static",
          placements: [
            {
              position: { x: 0, y: 0, z: -6 },
              rotationYRadians: 0,
              scale: 1
            }
          ],
          entries: null,
          seats: null,
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
          entries: null,
          seats: null,
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

test("createMetaverseScene separates deck boarding from direct seat entry on a dynamic environment asset", async () => {
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
    { metaverseRuntimeConfig },
    { resolveEnvironmentSimulationYawFromRenderYaw }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/traversal/presentation/mount-presentation.ts")
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
    new BoxGeometry(5.8, 0.6, 2.4),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const deckEntry = new Group();
  const driverSeat = new Group();
  const portBenchSeat = new Group();
  const portBenchRearSeat = new Group();
  const starboardBenchSeat = new Group();
  const starboardBenchRearSeat = new Group();

  skiffHull.position.y = 0.3;
  deckEntry.name = "deck_entry";
  deckEntry.position.set(-2.12, 1, 0);
  driverSeat.name = "driver_seat";
  driverSeat.position.set(1.32, 1, 0);
  driverSeat.rotation.y = Math.PI * 0.5;
  portBenchSeat.name = "port_bench_seat";
  portBenchSeat.position.set(0.65, 1, -0.72);
  portBenchRearSeat.name = "port_bench_rear_seat";
  portBenchRearSeat.position.set(-0.65, 1, -0.72);
  starboardBenchSeat.name = "starboard_bench_seat";
  starboardBenchSeat.position.set(0.65, 1, 0.72);
  starboardBenchSeat.rotation.y = Math.PI;
  starboardBenchRearSeat.name = "starboard_bench_rear_seat";
  starboardBenchRearSeat.position.set(-0.65, 1, 0.72);
  starboardBenchRearSeat.rotation.y = Math.PI;
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(
    skiffHull,
    deckEntry,
    driverSeat,
    portBenchSeat,
    portBenchRearSeat,
    starboardBenchSeat,
    starboardBenchRearSeat
  );

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
      skeletonId: "humanoid_v1",
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
            size: { x: 6.2, y: 2.4, z: 3.2 }
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
          orientation: {
            forwardModelYawRadians: Math.PI * 0.5
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
          entries: [
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: { x: 0, y: 0, z: 1.2 },
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            }
          ],
          seats: [
            {
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: { x: 0, y: 0, z: 1 },
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat",
              seatNodeName: "port_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat-rear",
              seatNodeName: "port_bench_rear_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat",
              seatNodeName: "starboard_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat-rear",
              seatNodeName: "starboard_bench_rear_seat",
              seatRole: "passenger"
            }
          ],
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
  assert.equal(initialInteractionSnapshot.focusedMountable?.boardingEntries.length, 1);
  assert.equal(initialInteractionSnapshot.focusedMountable?.directSeatTargets.length, 1);
  assert.equal(initialInteractionSnapshot.mountedEnvironment, null);

  const passengerSeatMountedEnvironment = sceneRuntime.resolveSeatOccupancy(
    cameraSnapshot,
    "port-bench-seat"
  );
  const passengerSeatInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    passengerSeatMountedEnvironment
  );

  assert.equal(
    passengerSeatInteractionSnapshot.mountedEnvironment?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(
    passengerSeatInteractionSnapshot.mountedEnvironment?.occupancyKind,
    "seat"
  );
  assert.equal(
    passengerSeatInteractionSnapshot.mountedEnvironment?.seatId,
    "port-bench-seat"
  );
  assert.equal(
    characterRoot.parent?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/port-bench-seat"
  );

  const boardedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    null
  );

  assert.equal(boardedInteractionSnapshot.mountedEnvironment, null);
  assert.equal(
    boardedInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );

  const boardedMountedEnvironment = sceneRuntime.resolveBoardFocusedMountable(
    cameraSnapshot
  );
  const mountedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    boardedMountedEnvironment
  );

  assert.equal(mountedInteractionSnapshot.focusedMountable, null);
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.occupancyKind,
    "entry"
  );
  assert.equal(mountedInteractionSnapshot.mountedEnvironment?.entryId, "deck-entry");
  assert.equal(mountedInteractionSnapshot.mountedEnvironment?.seatId, null);
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.directSeatTargets.length,
    1
  );
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.seatTargets.length,
    5
  );
  assert.equal(characterRoot.parent, originalParent);
  assert.ok(
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) <
      0.000001
  );
  assertQuaternionArraysEquivalent(
    characterRoot.getWorldQuaternion(new Quaternion()).toArray(),
    originalWorldQuaternion.toArray(),
    0.000001,
    "Standing deck boarding should keep the character free-roaming instead of seat-mounting it"
  );

  const driverSeatMountedEnvironment = sceneRuntime.resolveSeatOccupancy(
    cameraSnapshot,
    "driver-seat"
  );
  const driverSeatInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    driverSeatMountedEnvironment
  );

  assert.equal(driverSeatInteractionSnapshot.focusedMountable, null);
  assert.equal(
    driverSeatInteractionSnapshot.mountedEnvironment?.occupancyKind,
    "seat"
  );
  assert.equal(
    driverSeatInteractionSnapshot.mountedEnvironment?.seatId,
    "driver-seat"
  );
  assert.equal(
    driverSeatInteractionSnapshot.mountedEnvironment?.occupantRole,
    "driver"
  );
  assert.equal(
    characterRoot.parent?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/driver-seat"
  );

  sceneRuntime.scene.updateMatrixWorld(true);
  const mountedEnvironmentSeatSocket = characterRoot.parent;
  const mountedCharacterSeatSocket = characterRoot.getObjectByName("seat_socket");
  const mountedSkiffRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-skiff-v1"
  );

  assert.ok(mountedEnvironmentSeatSocket);
  assert.ok(mountedCharacterSeatSocket);
  assert.ok(mountedSkiffRoot);
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );
  const mountedCharacterForward = new Vector3(0, 0, 1)
    .applyQuaternion(characterRoot.getWorldQuaternion(new Quaternion()))
    .normalize();
  const mountedSkiffSimulationYawRadians =
    resolveEnvironmentSimulationYawFromRenderYaw(
      {
        orientation: {
          forwardModelYawRadians: Math.PI * 0.5
        }
      },
      mountedSkiffRoot.rotation.y
    );
  const mountedSkiffForward = new Vector3(
    Math.sin(mountedSkiffSimulationYawRadians),
    0,
    -Math.cos(mountedSkiffSimulationYawRadians)
  ).normalize();
  const mountedCharacterLocalQuaternion = characterRoot.quaternion.clone();

  assert.ok(mountedCharacterForward.angleTo(mountedSkiffForward) < 0.001);

  const mountedSeatWorldPosition = mountedEnvironmentSeatSocket.getWorldPosition(
    new Vector3()
  );
  const mountedCharacterWorldPosition = characterRoot.getWorldPosition(
    new Vector3()
  );

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    1000,
    0.016,
    null,
    [],
    driverSeatInteractionSnapshot.mountedEnvironment
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const bobbedSeatWorldPosition = mountedEnvironmentSeatSocket.getWorldPosition(
    new Vector3()
  );
  const bobbedCharacterWorldPosition = characterRoot.getWorldPosition(
    new Vector3()
  );

  assert.ok(
    Math.abs(bobbedSeatWorldPosition.y - mountedSeatWorldPosition.y) > 0.05
  );
  assert.ok(
    Math.abs(bobbedCharacterWorldPosition.y - mountedCharacterWorldPosition.y) >
      0.05
  );
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 11.5, y: 0.1, z: -14.2 },
    yawRadians: 0.55
  });
  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0.016,
    null,
    [],
    driverSeatInteractionSnapshot.mountedEnvironment
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );
  const turnedCharacterForward = new Vector3(0, 0, 1)
    .applyQuaternion(characterRoot.getWorldQuaternion(new Quaternion()))
    .normalize();
  const turnedSkiffSimulationYawRadians =
    resolveEnvironmentSimulationYawFromRenderYaw(
      {
        orientation: {
          forwardModelYawRadians: Math.PI * 0.5
        }
      },
      mountedSkiffRoot.rotation.y
    );
  const turnedSkiffForward = new Vector3(
    Math.sin(turnedSkiffSimulationYawRadians),
    0,
    -Math.cos(turnedSkiffSimulationYawRadians)
  ).normalize();

  assert.ok(turnedCharacterForward.angleTo(turnedSkiffForward) < 0.001);
  assert.ok(characterRoot.quaternion.angleTo(mountedCharacterLocalQuaternion) < 0.001);

  const dismountedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    null
  );

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

test("createMetaverseScene mounts remote metaverse presence avatars from shared occupancy state", async () => {
  const [
    { Vector3 },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig
  } = await createSkiffMountProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig,
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  const cameraSnapshot = {
    lookDirection: { x: 0, y: 0, z: -1 },
    pitchRadians: 0,
    position: { x: 0, y: 1.8, z: 19 },
    yawRadians: Math.PI
  };
  const remoteCharacterPresentation = Object.freeze({
    characterId: "metaverse-mannequin-v1",
    mountedOccupancy: Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "driver",
      seatId: "driver-seat"
    }),
    playerId: "remote-sailor-2",
    presentation: Object.freeze({
      animationVocabulary: "seated",
      position: Object.freeze({
        x: 0,
        y: 1,
        z: 0
      }),
      yawRadians: 0
    })
  });

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [remoteCharacterPresentation],
    null
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const remoteCharacterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/metaverse-mannequin-v1/remote-sailor-2"
  );
  const remoteSeatAnchor = remoteCharacterRoot?.parent ?? null;
  const remoteSeatSocket = remoteCharacterRoot?.getObjectByName("seat_socket") ?? null;

  assert.ok(remoteCharacterRoot);
  assert.equal(
    remoteSeatAnchor?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/driver-seat"
  );
  assert.ok(remoteSeatSocket);
  assert.ok(
    remoteSeatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(remoteSeatSocket.getWorldPosition(new Vector3())) < 0.001
  );

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 0.8, y: 0.12, z: 23.5 },
    yawRadians: 0.55
  });
  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0.016,
    null,
    [remoteCharacterPresentation],
    null
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    remoteSeatAnchor
      .getWorldPosition(new Vector3())
      .distanceTo(remoteSeatSocket.getWorldPosition(new Vector3())) < 0.001
  );
});

test("createMetaverseScene maps skiff simulation yaw onto its forward-authored render yaw", async () => {
  const [
    { createMetaverseScene },
    { metaverseRuntimeConfig },
    { Quaternion, Vector3 }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    import("three/webgpu")
  ]);
  const { createSceneAssetLoader, environmentProofConfig } =
    await createSkiffMountProofSlice();
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    createSceneAssetLoader,
    environmentProofConfig,
    warn() {}
  });

  await sceneRuntime.boot();

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 0, y: 0.12, z: 24 },
    yawRadians: 0.4
  });
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.62, z: 28 },
      yawRadians: 0
    },
    null,
    1000,
    0
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const skiffRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-skiff-v1"
  );

  assert.ok(skiffRoot);
  assert.ok(Math.abs(skiffRoot.rotation.y - (Math.PI * 0.5 - 0.4)) < 0.0001);
  assert.equal(skiffRoot.position.y, 0.12);
  const skiffPresentationRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_presentation/metaverse-hub-skiff-v1"
  );

  assert.ok(skiffPresentationRoot);
  assert.ok(Math.abs(skiffPresentationRoot.position.y) > 0.001);
  assert.equal(skiffPresentationRoot.rotation.y, 0);
});
