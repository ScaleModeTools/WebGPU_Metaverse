import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createHumanoidV2CharacterScene,
  createTestServicePistolHoldProfile
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

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
    Uint16BufferAttribute,
    Vector3
  }
) {
  const { characterScene, socketNames } = createHumanoidV2CharacterScene({
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3
  });

  return {
    authoredAnimationPackPath:
      "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
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
  const gripHandSocket = new Group();
  const forwardMarker = new Group();
  const upMarker = new Group();
  const triggerMarker = new Group();
  const adsCameraAnchor = new Group();
  const backSocket = new Group();

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  gripHandSocket.name = "metaverse_service_pistol_grip_hand_r_socket";
  gripHandSocket.position.set(-0.01, 0.02, -0.03);
  forwardMarker.name = "metaverse_service_pistol_forward_marker";
  forwardMarker.position.set(0.28, 0.02, -0.03);
  upMarker.name = "metaverse_service_pistol_up_marker";
  upMarker.position.set(-0.01, 0.12, -0.03);
  triggerMarker.name = "metaverse_service_pistol_trigger_marker";
  triggerMarker.position.set(0.026, 0.012, 0.004);
  adsCameraAnchor.name = "metaverse_service_pistol_ads_camera_anchor";
  adsCameraAnchor.position.set(0.07, 0.04, -0.03);
  backSocket.name = "metaverse_service_pistol_back_socket";
  backSocket.position.set(0.12, -0.04, 0.03);
  backSocket.quaternion.set(0, 0.7071067811865475, -0.7071067811865476, 0);
  attachmentScene.add(
    attachmentMesh,
    gripHandSocket,
    forwardMarker,
    upMarker,
    triggerMarker,
    adsCameraAnchor,
    backSocket
  );

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
      Uint16BufferAttribute,
      Vector3
    },
    mountedOccupancyStateModule,
    { MetaverseSceneInteractivePresentationState }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/states/mounted-occupancy.ts"),
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
    Uint16BufferAttribute,
    Vector3
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
        attachmentSocketRole: "grip.primary",
        socketName: "palm_r_socket"
      },
      holdProfile: createTestServicePistolHoldProfile({
        sockets: [
          {
            nodeName: "metaverse_service_pistol_grip_hand_r_socket",
            role: "grip.primary"
          },
          {
            nodeName: "metaverse_service_pistol_forward_marker",
            role: "basis.forward"
          },
          {
            nodeName: "metaverse_service_pistol_up_marker",
            role: "basis.up"
          },
          {
            nodeName: "metaverse_service_pistol_trigger_marker",
            role: "trigger.index"
          },
          {
            nodeName: "metaverse_service_pistol_ads_camera_anchor",
            role: "camera.ads_anchor"
          },
          {
            nodeName: "metaverse_service_pistol_back_socket",
            role: "carry.back"
          }
        ]
      }),
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
      mountedHolsterMount: {
        attachmentSocketRole: "carry.back",
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
      characterId: "mesh2motion-humanoid-v1",
      label: "Mesh2Motion humanoid",
      modelPath: "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
      skeletonId: "humanoid_v2",
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
            scene: characterFixture.characterScene
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

  const activeWeaponState = Object.freeze({
    aimMode: "hip-fire",
    weaponId: "metaverse-service-pistol-v1"
  });

  const characterRoot = scene.getObjectByName("metaverse_character/mesh2motion-humanoid-v1");
  const attachmentRoot = scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.deepEqual(warnings, []);
  assert.ok(characterRoot);
  assert.ok(attachmentRoot);
  assert.equal(
    interactivePresentationState.characterProofRuntime?.characterId,
    "mesh2motion-humanoid-v1"
  );
  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.equal(attachmentRoot.visible, false);

  interactivePresentationState.syncAttachmentMount(
    mountedOccupancyStateModule
      .resolveMetaverseMountedOccupancyPresentationStateSnapshot({
        cameraPolicyId: "vehicle-follow",
        lookLimitPolicyId: "driver-forward",
        occupancyAnimationId: "seated",
        occupancyKind: "seat",
        occupantRole: "driver"
      }),
    activeWeaponState
  );

  assert.equal(attachmentRoot.parent?.name, "back_socket");
  assert.equal(attachmentRoot.visible, true);

  interactivePresentationState.syncAttachmentMount(null, activeWeaponState);

  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.equal(attachmentRoot.visible, true);

  interactivePresentationState.syncAttachmentMount(null, null);

  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.equal(attachmentRoot.visible, false);
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
        attachmentSocketRole: "grip.primary",
        socketName: "palm_r_socket"
      },
      holdProfile: createTestServicePistolHoldProfile({
        sockets: [
          {
            nodeName: "metaverse_service_pistol_grip_hand_r_socket",
            role: "grip.primary"
          },
          {
            nodeName: "metaverse_service_pistol_forward_marker",
            role: "basis.forward"
          },
          {
            nodeName: "metaverse_service_pistol_up_marker",
            role: "basis.up"
          },
          {
            nodeName: "metaverse_service_pistol_trigger_marker",
            role: "trigger.index"
          },
          {
            nodeName: "metaverse_service_pistol_ads_camera_anchor",
            role: "camera.ads_anchor"
          }
        ]
      }),
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
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
