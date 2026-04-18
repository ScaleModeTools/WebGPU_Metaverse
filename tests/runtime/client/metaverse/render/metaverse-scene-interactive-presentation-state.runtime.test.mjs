import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function isBoneNode(node) {
  return node !== undefined && node !== null && "isBone" in node && node.isBone === true;
}

function isGroupNode(node) {
  return node !== undefined && node !== null && "isGroup" in node && node.isGroup === true;
}

function findBoneNode(characterScene, boneName, label) {
  const boneNode = characterScene.getObjectByName(boneName);

  if (!isBoneNode(boneNode)) {
    throw new Error(`${label} is missing required bone ${boneName}.`);
  }

  return boneNode;
}

function findSocketNode(characterScene, socketName) {
  const socketNode = characterScene.getObjectByName(socketName);

  if (!isBoneNode(socketNode)) {
    throw new Error(`Metaverse character is missing required socket bone: ${socketName}`);
  }

  return socketNode;
}

function findNamedNode(scene, nodeName, label) {
  const node = scene.getObjectByName(nodeName);

  if (node === undefined) {
    throw new Error(`${label} is missing required node ${nodeName}.`);
  }

  return node;
}

function findGroupNode(scene, nodeName, label) {
  const node = scene.getObjectByName(nodeName);

  if (!isGroupNode(node)) {
    throw new Error(`${label} is missing required group ${nodeName}.`);
  }

  return node;
}

function findOptionalNode(scene, nodeName) {
  return scene.getObjectByName(nodeName) ?? null;
}

function upsertSyntheticSocketNode(
  Bone,
  characterScene,
  parentBone,
  socketName,
  localPosition,
  _showSocketDebug,
  localQuaternion
) {
  const existingSocketNode = characterScene.getObjectByName(socketName);
  const socketNode = (() => {
    if (existingSocketNode === undefined) {
      const syntheticSocketNode = new Bone();

      syntheticSocketNode.name = socketName;
      parentBone.add(syntheticSocketNode);

      return syntheticSocketNode;
    }

    if (!isBoneNode(existingSocketNode)) {
      throw new Error(`Metaverse character socket ${socketName} must stay a bone.`);
    }

    return existingSocketNode;
  })();

  socketNode.position.copy(localPosition);
  if (localQuaternion === undefined) {
    socketNode.quaternion.identity();
  } else {
    socketNode.quaternion.copy(localQuaternion);
  }
  socketNode.scale.setScalar(1);

  return socketNode;
}

function createCharacterFixture(
  {
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
  }
) {
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
    "back_socket",
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

  neckBone.add(socketBones[1]);
  chestBone.add(socketBones[2], socketBones[3], socketBones[0]);
  hipsBone.add(socketBones[4], socketBones[5]);
  socketBones[0].position.set(0, 0.14, -0.08);
  socketBones[1].position.y = 0.18;
  socketBones[2].position.x = -0.35;
  socketBones[3].position.x = 0.35;
  socketBones[4].position.set(0.2, -0.08, -0.08);
  socketBones[5].position.set(0, 0, -0.08);

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

  return {
    authoredAnimationPackPath:
      "/models/metaverse/characters/metaverse-mannequin-canonical-animations.glb",
    characterScene,
    clips: [new AnimationClip("idle", -1, []), new AnimationClip("walk", -1, [])],
    socketNames
  };
}

function createAttachmentFixture({ BoxGeometry, Group, Mesh, MeshStandardMaterial }) {
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );
  const triggerHandSocket = new Group();
  const backSocket = new Group();

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  triggerHandSocket.name = "metaverse_service_pistol_trigger_hand_r_socket";
  triggerHandSocket.position.set(-0.01, 0.02, -0.03);
  backSocket.name = "metaverse_service_pistol_back_socket";
  backSocket.position.set(0.12, -0.04, 0.03);
  backSocket.quaternion.set(0, 0.7071067811865475, -0.7071067811865476, 0);
  attachmentScene.add(attachmentMesh, triggerHandSocket, backSocket);

  return attachmentScene;
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseSceneInteractivePresentationState boots manifest-driven character and attachment proof slices", async () => {
  const [
    {
      AnimationClip,
      Bone,
      BoxGeometry,
      Float32BufferAttribute,
      Group,
      Mesh,
      MeshStandardMaterial,
      Scene,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute
    },
    { MetaverseSceneInteractivePresentationState }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-interactive-presentation-state.ts"
    )
  ]);
  const loadPaths = [];
  const warnings = [];
  const characterFixture = createCharacterFixture({
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
  });
  const attachmentScene = createAttachmentFixture({
    BoxGeometry,
    Group,
    Mesh,
    MeshStandardMaterial
  });
  const scene = new Scene();
  const interactivePresentationState = new MetaverseSceneInteractivePresentationState({
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_trigger_hand_r_socket",
        socketName: "hand_r_socket"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      mountedHolsterMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_back_socket",
        socketName: "back_socket"
      }
    },
    attachmentRuntimeNodeResolvers: {
      findGroupNode,
      findNamedNode,
      findSocketNode
    },
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: characterFixture.authoredAnimationPackPath,
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: characterFixture.authoredAnimationPackPath,
          vocabulary: "walk"
        }
      ],
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      skeletonId: "humanoid_v1",
      socketNames: characterFixture.socketNames
    },
    characterProofRuntimeNodeResolvers: {
      ensureSocketDebugMarker() {},
      findBoneNode,
      findOptionalNode,
      findSocketNode,
      upsertSyntheticSocketNode: (
        characterScene,
        parentBone,
        socketName,
        localPosition,
        showSocketDebug,
        localQuaternion
      ) =>
        upsertSyntheticSocketNode(
          Bone,
          characterScene,
          parentBone,
          socketName,
          localPosition,
          showSocketDebug,
          localQuaternion
        )
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

        if (path === characterFixture.authoredAnimationPackPath) {
          return {
            animations: characterFixture.clips,
            scene: new Group()
          };
        }

        return {
          animations: [],
          scene: characterFixture.characterScene
        };
      }
    }),
    heldWeaponPoseRuntimeNodeResolvers: {
      findBoneNode,
      findSocketNode
    },
    scene,
    showSocketDebug: false,
    warn(message) {
      warnings.push(message);
    }
  });

  await interactivePresentationState.boot();

  const characterRoot = scene.getObjectByName("metaverse_character/metaverse-mannequin-v1");
  const attachmentRoot = scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/metaverse-mannequin.gltf",
    characterFixture.authoredAnimationPackPath,
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.deepEqual(warnings, []);
  assert.ok(characterRoot);
  assert.ok(attachmentRoot);
  assert.equal(
    interactivePresentationState.characterProofRuntime?.characterId,
    "metaverse-mannequin-v1"
  );
  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");

  interactivePresentationState.syncAttachmentMount({
    occupancyKind: "seat",
    occupantRole: "driver"
  });

  assert.equal(attachmentRoot.parent?.name, "back_socket");

  interactivePresentationState.syncAttachmentMount(null);

  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
});

test("MetaverseSceneInteractivePresentationState rejects attachment proof slices without a character proof slice", async () => {
  const [{ Scene }, { MetaverseSceneInteractivePresentationState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-interactive-presentation-state.ts"
    )
  ]);
  const interactivePresentationState = new MetaverseSceneInteractivePresentationState({
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_trigger_hand_r_socket",
        socketName: "hand_r_socket"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      mountedHolsterMount: null
    },
    attachmentRuntimeNodeResolvers: {
      findGroupNode,
      findNamedNode,
      findSocketNode
    },
    characterProofConfig: null,
    characterProofRuntimeNodeResolvers: {
      ensureSocketDebugMarker() {},
      findBoneNode,
      findOptionalNode,
      findSocketNode,
      upsertSyntheticSocketNode: () => {
        throw new Error("unexpected socket synthesis");
      }
    },
    createSceneAssetLoader: () => ({
      async loadAsync() {
        throw new Error("unexpected asset load");
      }
    }),
    heldWeaponPoseRuntimeNodeResolvers: {
      findBoneNode,
      findSocketNode
    },
    scene: new Scene(),
    showSocketDebug: false,
    warn() {}
  });

  await assert.rejects(
    interactivePresentationState.boot(),
    /cannot boot an attachment proof slice without a character proof slice/
  );
});
