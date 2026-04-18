import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

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

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
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
  const bodyGeometry = new BoxGeometry(0.42, 1.82, 0.24);
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

  rootBone.name = "root";
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

  assert.equal(
    initialInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
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
  assert.ok(
    characterRoot.quaternion.angleTo(mountedCharacterLocalQuaternion) < 0.001
  );

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
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) <
      0.001
  );
  assert.ok(
    characterRoot.getWorldQuaternion(new Quaternion()).angleTo(originalWorldQuaternion) <
      0.001
  );
});
