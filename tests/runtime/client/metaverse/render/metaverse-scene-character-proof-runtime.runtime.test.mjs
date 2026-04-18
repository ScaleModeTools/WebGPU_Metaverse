import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createSkiffMountProofSlice } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

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

test("createMetaverseScene synthesizes mirrored humanoid_v2 palm and grip sockets from the hand rig", async () => {
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
  const triggerHandSocket = new Group();

  attachmentMesh.position.x = 0.14;
  attachmentScene.name = "metaverse_service_pistol_root";
  triggerHandSocket.name = "metaverse_service_pistol_trigger_hand_r_socket";
  triggerHandSocket.position.set(0.04, -0.045, 0.025);
  attachmentScene.add(attachmentMesh, triggerHandSocket);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_trigger_hand_r_socket",
        socketName: "grip_r_socket"
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

  const handLSocket = sceneRuntime.scene.getObjectByName("hand_l_socket");
  const handSocket = sceneRuntime.scene.getObjectByName("hand_r_socket");
  const leftGripSocket = sceneRuntime.scene.getObjectByName("grip_l_socket");
  const gripSocket = sceneRuntime.scene.getObjectByName("grip_r_socket");
  const leftPalmSocket = sceneRuntime.scene.getObjectByName("palm_l_socket");
  const palmSocket = sceneRuntime.scene.getObjectByName("palm_r_socket");
  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );
  const resolveExpectedPalmBasis = (
    sourceSocketLocalPosition,
    thumbBaseLocalPosition,
    indexBaseLocalPosition,
    middleBaseLocalPosition,
    ringBaseLocalPosition,
    pinkyBaseLocalPosition
  ) => {
    const knuckleCentroid = indexBaseLocalPosition
      .clone()
      .add(middleBaseLocalPosition)
      .add(ringBaseLocalPosition)
      .add(pinkyBaseLocalPosition)
      .multiplyScalar(0.25);
    const forwardAxis = knuckleCentroid.clone().normalize();
    const upAxis = thumbBaseLocalPosition.clone().sub(knuckleCentroid);

    upAxis.addScaledVector(forwardAxis, -upAxis.dot(forwardAxis));
    upAxis.normalize();

    return {
      forwardAxis,
      gripLocalPosition: sourceSocketLocalPosition
        .clone()
        .lerp(knuckleCentroid, 0.72),
      knuckleCentroid,
      palmLocalPosition: sourceSocketLocalPosition
        .clone()
        .lerp(knuckleCentroid, 0.45),
      upAxis
    };
  };
  const leftExpectedPalmBasis = resolveExpectedPalmBasis(
    new Vector3(-0.05, 0, 0),
    new Vector3(-0.04, -0.02, 0.06),
    new Vector3(-0.1, 0, 0.03),
    new Vector3(-0.11, 0, 0),
    new Vector3(-0.1, 0, -0.03),
    new Vector3(-0.08, 0, -0.05)
  );
  const rightExpectedPalmBasis = resolveExpectedPalmBasis(
    new Vector3(0.05, 0, 0),
    new Vector3(0.04, -0.02, 0.06),
    new Vector3(0.1, 0, 0.03),
    new Vector3(0.11, 0, 0),
    new Vector3(0.1, 0, -0.03),
    new Vector3(0.08, 0, -0.05)
  );
  const resolveSocketForwardAxis = (socketNode) =>
    new Vector3(1, 0, 0).applyQuaternion(socketNode.quaternion).normalize();
  const resolveSocketUpAxis = (socketNode) =>
    new Vector3(0, 1, 0).applyQuaternion(socketNode.quaternion).normalize();

  assert.ok(handLSocket);
  assert.ok(handSocket);
  assert.ok(leftGripSocket);
  assert.ok(gripSocket);
  assert.ok(leftPalmSocket);
  assert.ok(palmSocket);
  assert.ok(attachmentRoot);
  assert.equal(leftGripSocket.parent?.name, "hand_l");
  assert.equal(gripSocket.parent?.name, "hand_r");
  assert.equal(leftPalmSocket.parent?.name, "hand_l");
  assert.equal(palmSocket.parent?.name, "hand_r");
  assert.equal(attachmentRoot.parent?.name, "grip_r_socket");
  assert.ok(
    leftGripSocket.position.distanceTo(leftExpectedPalmBasis.gripLocalPosition) <
      0.000001,
    "Synthesized humanoid_v2 left grip socket should sit on the palm-to-knuckle grip seam"
  );
  assert.ok(
    gripSocket.position.distanceTo(rightExpectedPalmBasis.gripLocalPosition) <
      0.000001,
    "Synthesized humanoid_v2 right grip socket should sit on the palm-to-knuckle grip seam"
  );
  assert.ok(
    resolveSocketForwardAxis(leftPalmSocket).angleTo(
      leftExpectedPalmBasis.forwardAxis
    ) < 0.000001,
    "Synthesized humanoid_v2 left palm socket should point forward along the knuckle line"
  );
  assert.ok(
    resolveSocketUpAxis(leftPalmSocket).angleTo(leftExpectedPalmBasis.upAxis) <
      0.000001,
    "Synthesized humanoid_v2 left palm socket should point up toward the thumb"
  );
  assert.ok(
    resolveSocketForwardAxis(palmSocket).angleTo(rightExpectedPalmBasis.forwardAxis) <
      0.000001,
    "Synthesized humanoid_v2 right palm socket should point forward along the knuckle line"
  );
  assert.ok(
    resolveSocketUpAxis(palmSocket).angleTo(rightExpectedPalmBasis.upAxis) <
      0.000001,
    "Synthesized humanoid_v2 right palm socket should point up toward the thumb"
  );
  assertQuaternionArraysEquivalent(
    leftGripSocket.quaternion.toArray(),
    leftPalmSocket.quaternion.toArray(),
    0.000001,
    "Synthesized humanoid_v2 left grip socket should inherit the mirrored palm basis"
  );
  assertQuaternionArraysEquivalent(
    gripSocket.quaternion.toArray(),
    palmSocket.quaternion.toArray(),
    0.000001,
    "Synthesized humanoid_v2 right grip socket should inherit the mirrored palm basis"
  );
  assert.ok(
    leftPalmSocket.quaternion.angleTo(handLSocket.quaternion) > 0.2,
    "Synthesized humanoid_v2 left palm socket should not inherit the authored hand socket twist"
  );
  assert.ok(
    palmSocket.quaternion.angleTo(handSocket.quaternion) > 0.2,
    "Synthesized humanoid_v2 right palm socket should not inherit the authored hand socket twist"
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [0, 0, 0, 1],
    0.000001,
    "Humanoid_v2 held attachment should keep identity local rotation when socket and attachment axes match"
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.getWorldQuaternion(new Quaternion()).toArray(),
    gripSocket.getWorldQuaternion(new Quaternion()).toArray(),
    0.000001,
    "Humanoid_v2 held attachment should inherit the synthesized grip socket world rotation"
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
    {
      AnimationClip,
      Bone,
      BoxGeometry,
      Float32BufferAttribute,
      Group,
      MeshStandardMaterial,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute
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
