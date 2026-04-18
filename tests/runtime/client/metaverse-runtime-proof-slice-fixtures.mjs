import {
  authoredWaterBaySkiffPlacement,
  authoredWaterBaySkiffYawRadians
} from "../metaverse-authored-world-test-fixtures.mjs";

export async function createSkiffMountProofSlice() {
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

  const socketNames = ["head_socket", "hand_l_socket", "hand_r_socket", "hip_socket", "seat_socket"];
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
              position: authoredWaterBaySkiffPlacement,
              rotationYRadians: authoredWaterBaySkiffYawRadians,
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

export async function createHeldWeaponProofSlice() {
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
    Uint16BufferAttribute,
    Vector3
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
  const triggerHandSocket = new Group();

  attachmentMesh.position.x = 0.14;
  attachmentScene.name = "metaverse_service_pistol_root";
  triggerHandSocket.name = "metaverse_service_pistol_trigger_hand_r_socket";
  triggerHandSocket.position.set(-0.01, 0.02, -0.03);
  attachmentScene.add(attachmentMesh, triggerHandSocket);

  return {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_trigger_hand_r_socket",
        socketName: "hand_r_socket"
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
    environmentProofConfig: null
  };
}

export async function createStaticSurfaceProofSlice(clientModuleLoader) {
  const [{ metaverseEnvironmentProofConfig }, createSceneAssetLoader] = await Promise.all([
    clientModuleLoader.load("/src/app/states/metaverse-asset-proof.ts"),
    createEmptySceneAssetLoader()
  ]);

  return {
    createSceneAssetLoader,
    environmentProofConfig: metaverseEnvironmentProofConfig
  };
}

export async function createEmptySceneAssetLoader() {
  const { BoxGeometry, Group, Mesh, MeshStandardMaterial } = await import("three/webgpu");

  const createStaticEnvironmentScene = (name) => {
    const scene = new Group();
    const mesh = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: 0x94a3b8 })
    );

    scene.name = name;
    mesh.position.y = 0.5;
    scene.add(mesh);

    return scene;
  };
  const createNamedAnchor = (name, position, yawRadians = 0) => {
    const anchor = new Group();

    anchor.name = name;
    anchor.position.set(position.x, position.y, position.z);
    anchor.rotation.y = yawRadians;

    return anchor;
  };
  const skiffScene = createStaticEnvironmentScene("metaverse_hub_skiff_root");

  skiffScene.add(
    createNamedAnchor("deck_entry", { x: -2.12, y: 1, z: 0 }),
    createNamedAnchor("driver_seat", { x: 1.32, y: 1, z: 0 }, Math.PI * 0.5),
    createNamedAnchor("port_bench_seat", { x: 0.65, y: 1, z: -0.72 }),
    createNamedAnchor("port_bench_rear_seat", { x: -0.65, y: 1, z: -0.72 }),
    createNamedAnchor("starboard_bench_seat", { x: 0.65, y: 1, z: 0.72 }, Math.PI),
    createNamedAnchor("starboard_bench_rear_seat", { x: -0.65, y: 1, z: 0.72 }, Math.PI)
  );

  const diveBoatScene = createStaticEnvironmentScene("metaverse_hub_dive_boat_root");

  diveBoatScene.add(
    createNamedAnchor("stern_port_entry", { x: -4.6, y: 1.1, z: -0.9 }),
    createNamedAnchor("stern_starboard_entry", { x: -4.6, y: 1.1, z: 0.9 }),
    createNamedAnchor("helm_seat", { x: 2.85, y: 1.18, z: 0 }, Math.PI * 0.5),
    createNamedAnchor("port_bench_seat_a", { x: 0.8, y: 1.02, z: -1.05 }),
    createNamedAnchor("port_bench_seat_b", { x: -0.4, y: 1.02, z: -1.05 }),
    createNamedAnchor("port_bench_seat_c", { x: -1.6, y: 1.02, z: -1.05 }),
    createNamedAnchor("starboard_bench_seat_a", { x: 0.8, y: 1.02, z: 1.05 }, Math.PI),
    createNamedAnchor("starboard_bench_seat_b", { x: -0.4, y: 1.02, z: 1.05 }, Math.PI),
    createNamedAnchor("starboard_bench_seat_c", { x: -1.6, y: 1.02, z: 1.05 }, Math.PI)
  );

  return () => ({
    async loadAsync(path) {
      if (
        path === "/models/metaverse/environment/metaverse-hub-skiff.gltf" ||
        path === "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf"
      ) {
        return {
          animations: [],
          scene: skiffScene
        };
      }

      if (
        path === "/models/metaverse/environment/metaverse-hub-dive-boat.gltf" ||
        path === "/models/metaverse/environment/metaverse-hub-dive-boat-collision.gltf"
      ) {
        return {
          animations: [],
          scene: diveBoatScene
        };
      }

      return {
        animations: [],
        scene: createStaticEnvironmentScene("metaverse_environment_stub")
      };
    }
  });
}

export async function createPushableCrateProofSlice() {
  const { BoxGeometry, Group, Mesh, MeshStandardMaterial } = await import("three/webgpu");
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
