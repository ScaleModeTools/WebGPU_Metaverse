import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

const metaverseDeliveryPathPattern =
  /^\/models\/metaverse\/(?:attachments(?:\/modules)?|characters|environment)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:-(?:high|medium|low|collision))?\.(?:glb|gltf)$/;

async function loadMetaverseAssetBuffer(assetPath) {
  return readFile(new URL(`../../../client/public${assetPath}`, import.meta.url));
}

function parseMetaverseGlbDocument(assetBuffer) {
  const magic = assetBuffer.subarray(0, 4).toString("utf8");

  assert.equal(magic, "glTF");

  const jsonChunkLength = assetBuffer.readUInt32LE(12);
  const jsonChunkType = assetBuffer.readUInt32LE(16);

  assert.equal(jsonChunkType, 0x4e4f534a);

  return JSON.parse(
    assetBuffer.subarray(20, 20 + jsonChunkLength).toString("utf8").trim()
  );
}

async function loadMetaverseAssetDocument(assetPath) {
  const assetBuffer = await loadMetaverseAssetBuffer(assetPath);

  if (assetPath.endsWith(".glb")) {
    return parseMetaverseGlbDocument(assetBuffer);
  }

  return JSON.parse(assetBuffer.toString("utf8"));
}

function collectNamedNodeDescriptors(document) {
  return new Map(
    (document.nodes ?? [])
      .map((node) => {
        if (typeof node.name !== "string") {
          return null;
        }

        return [
          node.name,
          {
            children: node.children ?? [],
            rotation: node.rotation ?? [0, 0, 0, 1],
            translation:
              node.translation ??
              (Array.isArray(node.matrix) && node.matrix.length === 16
                ? [node.matrix[12], node.matrix[13], node.matrix[14]]
                : [0, 0, 0])
          }
        ];
      })
      .filter((entry) => entry !== null)
  );
}

function collectParentNameByNodeName(document) {
  const parentNameByNodeName = new Map();

  for (const node of document.nodes ?? []) {
    if (typeof node.name !== "string") {
      continue;
    }

    for (const childIndex of node.children ?? []) {
      const childName = document.nodes?.[childIndex]?.name;

      if (typeof childName === "string") {
        parentNameByNodeName.set(childName, node.name);
      }
    }
  }

  return parentNameByNodeName;
}

function resolveNamedChildNodeNames(document, childIndices) {
  return (childIndices ?? [])
    .map((childIndex) => document.nodes?.[childIndex]?.name)
    .filter((name) => typeof name === "string");
}

function collectReachableNamedNodeNames(document) {
  const reachableNodeNames = new Set();
  const visitedNodeIndices = new Set();
  const pendingNodeIndices = [...(document.scenes?.[document.scene ?? 0]?.nodes ?? [])];

  while (pendingNodeIndices.length > 0) {
    const nodeIndex = pendingNodeIndices.pop();

    if (typeof nodeIndex !== "number" || visitedNodeIndices.has(nodeIndex)) {
      continue;
    }

    visitedNodeIndices.add(nodeIndex);

    const node = document.nodes?.[nodeIndex];

    if (node === undefined) {
      continue;
    }

    if (typeof node.name === "string") {
      reachableNodeNames.add(node.name);
    }

    pendingNodeIndices.push(...(node.children ?? []));
  }

  return reachableNodeNames;
}

function assertNumberArraysClose(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= tolerance,
      `${message} at index ${index}: expected ${expected[index]}, received ${actual[index]}.`
    );
  }
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

function collectMetaverseDeliveryPaths({
  animationClipManifest,
  attachmentModelManifest,
  characterModelManifest,
  environmentPropManifest,
  weaponModuleManifest
}) {
  const deliveryPaths = new Set();

  const addPath = (path) => {
    if (typeof path === "string" && path.length > 0) {
      deliveryPaths.add(path);
    }
  };

  for (const clip of animationClipManifest.clips) {
    addPath(clip.sourcePath);
  }

  for (const character of characterModelManifest.characters) {
    for (const lod of character.renderModel.lods) {
      addPath(lod.modelPath);
    }

    addPath(character.collisionPath);
  }

  for (const attachment of attachmentModelManifest.attachments) {
    for (const lod of attachment.renderModel.lods) {
      addPath(lod.modelPath);
    }
  }

  for (const module of weaponModuleManifest?.modules ?? []) {
    for (const lod of module.model.lods) {
      addPath(lod.modelPath);
    }
  }

  for (const environmentAsset of environmentPropManifest.environmentAssets) {
    for (const lod of environmentAsset.renderModel.lods) {
      if ("kind" in lod && lod.kind === "procedural-box") {
        continue;
      }

      addPath(lod.modelPath);
    }

    addPath(environmentAsset.collisionPath);
  }

  return [...deliveryPaths];
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("canonical humanoid rig definitions keep stable bone and socket parentage", async () => {
  const {
    humanoidV2BoneNames,
    humanoidV2BoneParentByName,
    humanoidV2SocketParentById,
    skeletonBoneNamesById,
    skeletonBoneParentByNameById,
    skeletonIds,
    skeletonSocketParentById,
    socketIds
  } = await clientLoader.load("/src/assets/types/asset-socket.ts");

  assert.deepEqual(skeletonIds, ["humanoid_v2"]);
  assert.deepEqual(humanoidV2BoneNames, [
    "root",
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "neck_01",
    "head",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "thigh_l",
    "calf_l",
    "foot_l",
    "ball_l",
    "thigh_r",
    "calf_r",
    "foot_r",
    "ball_r"
  ]);
  assert.deepEqual(humanoidV2BoneParentByName, {
    root: null,
    pelvis: "root",
    spine_01: "pelvis",
    spine_02: "spine_01",
    spine_03: "spine_02",
    neck_01: "spine_03",
    head: "neck_01",
    clavicle_l: "spine_03",
    upperarm_l: "clavicle_l",
    lowerarm_l: "upperarm_l",
    hand_l: "lowerarm_l",
    clavicle_r: "spine_03",
    upperarm_r: "clavicle_r",
    lowerarm_r: "upperarm_r",
    hand_r: "lowerarm_r",
    thigh_l: "pelvis",
    calf_l: "thigh_l",
    foot_l: "calf_l",
    ball_l: "foot_l",
    thigh_r: "pelvis",
    calf_r: "thigh_r",
    foot_r: "calf_r",
    ball_r: "foot_r"
  });
  assert.deepEqual(humanoidV2SocketParentById, {
    hand_r_socket: "hand_r",
    hand_l_socket: "hand_l",
    head_socket: "head",
    hip_socket: "pelvis",
    seat_socket: "pelvis"
  });
  assert.deepEqual(Object.keys(humanoidV2SocketParentById).sort(), [...socketIds].sort());
  assert.deepEqual(skeletonBoneNamesById.humanoid_v2, humanoidV2BoneNames);
  assert.deepEqual(
    skeletonBoneParentByNameById.humanoid_v2,
    humanoidV2BoneParentByName
  );
  assert.deepEqual(skeletonSocketParentById.humanoid_v2, humanoidV2SocketParentById);
});

test("humanoid_v2 rig metadata keeps upper-torso aim layering and head anchors explicit", async () => {
  const {
    humanoidV2HeadAnchorNodeNames,
    humanoidV2PistolAimOverlayTrackPrefixes,
    isHumanoidV2PistolAimOverlayTrack
  } = await clientLoader.load("/src/metaverse/render/humanoid-v2-rig.ts");
  const humanoidDocument = await loadMetaverseAssetDocument(
    "/models/metaverse/characters/mesh2motion-humanoid.glb"
  );
  const reachableNodeNames = collectReachableNamedNodeNames(humanoidDocument);

  assert.deepEqual(humanoidV2HeadAnchorNodeNames, {
    head: "head",
    headLeaf: "head_leaf",
    headSocket: "head_socket",
    neck: "neck_01"
  });
  assert.deepEqual(humanoidV2PistolAimOverlayTrackPrefixes, [
    "spine_02",
    "spine_03",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "thumb_",
    "index_",
    "middle_",
    "ring_",
    "pinky_"
  ]);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("upperarm_l.quaternion"), true);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("index_02_r.rotation"), true);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("spine_02.quaternion"), true);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("spine_03.quaternion"), true);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("head.quaternion"), false);
  assert.equal(isHumanoidV2PistolAimOverlayTrack("thigh_r.quaternion"), false);

  for (const nodeName of Object.values(humanoidV2HeadAnchorNodeNames)) {
    assert.equal(
      reachableNodeNames.has(nodeName),
      true,
      `Expected humanoid_v2 head anchor node ${nodeName} to stay reachable in the delivered GLB.`
    );
  }
});

test("character manifests expose the active humanoid_v2 skeleton on the canonical vocabulary", async () => {
  const [
    {
      mesh2motionHumanoidCharacterAssetId,
      metaverseActiveFullBodyCharacterAssetId,
      characterModelManifest
    },
    {
      animationClipManifest,
      mesh2motionHumanoidCanonicalAnimationPackSourcePath
    },
    { animationVocabularyIds, canonicalAnimationClipNamesByVocabulary },
    { socketIds }
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts")
  ]);

  const characterIds = characterModelManifest.characters.map((character) => character.id);

  assert.deepEqual(characterIds, [mesh2motionHumanoidCharacterAssetId]);
  assert.equal(metaverseActiveFullBodyCharacterAssetId, mesh2motionHumanoidCharacterAssetId);

  const activeFullBodyCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeFullBodyCharacter);
  assert.equal(activeFullBodyCharacter.id, mesh2motionHumanoidCharacterAssetId);
  assert.equal(activeFullBodyCharacter.skeleton, "humanoid_v2");
  assert.ok(activeFullBodyCharacter.presentationModes.includes("full-body"));

  for (const character of characterModelManifest.characters) {
    assert.equal(character.skeleton, "humanoid_v2");
    assert.deepEqual(character.socketIds, socketIds);

    const clipVocabularies = character.animationClipIds.map((clipId) => {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.ok(clipDescriptor);

      return clipDescriptor.vocabulary;
    });

    assert.deepEqual(
      [...clipVocabularies].sort(),
      [...animationVocabularyIds].sort()
    );

    for (const clipId of character.animationClipIds) {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.equal(clipDescriptor.targetSkeleton, character.skeleton);
      assert.equal(
        clipDescriptor.clipName,
        canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]
      );
    }
  }

  const activeClipSourcePaths = new Set(
    activeFullBodyCharacter.animationClipIds.map(
      (clipId) => animationClipManifest.byId[clipId].sourcePath
    )
  );

  assert.deepEqual(
    [...activeClipSourcePaths],
    [mesh2motionHumanoidCanonicalAnimationPackSourcePath]
  );
  assert.deepEqual(
    [...new Set(animationClipManifest.clips.map((clip) => clip.targetSkeleton))],
    ["humanoid_v2"]
  );
});

test("metaverse asset manifests keep stable shipped delivery paths and LOD naming", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts")
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest }
  ] = manifests;

  const deliveryPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest
  });

  assert.ok(deliveryPaths.length >= 8);

  for (const assetPath of deliveryPaths) {
    assert.match(assetPath, metaverseDeliveryPathPattern);
    assert.equal(/-v\d+\.(?:glb|gltf)$/.test(assetPath), false);

    const assetBuffer = await loadMetaverseAssetBuffer(assetPath);

    assert.ok(assetBuffer.byteLength > 0);

    if (assetPath.endsWith(".glb")) {
      assert.equal(assetBuffer.subarray(0, 4).toString("utf8"), "glTF");
    }
  }

  for (const environmentAsset of environmentPropManifest.environmentAssets) {
    if (environmentAsset.renderModel.lods.length < 2) {
      continue;
    }

    for (const lod of environmentAsset.renderModel.lods) {
      if ("kind" in lod && lod.kind === "procedural-box") {
        continue;
      }

      assert.match(lod.modelPath, new RegExp(`-${lod.tier}\\.(?:glb|gltf)$`));
    }
  }
});

test("attachment manifests keep explicit attachment socket ownership for held and holstered tools", async () => {
  const {
    attachmentModelManifest,
    metaverseServicePistolAttachmentAssetId
  } = await clientLoader.load("/src/assets/config/attachment-model-manifest.ts");

  const pistolAttachment =
    attachmentModelManifest.byId[metaverseServicePistolAttachmentAssetId];

  assert.ok(pistolAttachment);
  assert.equal(pistolAttachment.defaultSocketId, "hand_r_socket");
  assert.deepEqual(pistolAttachment.heldMount, {
    attachmentSocketNodeName: "metaverse_service_pistol_grip_hand_r_socket",
    forwardReferenceNodeName: "metaverse_service_pistol_forward_marker",
    triggerMarkerNodeName: "metaverse_service_pistol_trigger_marker"
  });
  assert.deepEqual(pistolAttachment.offHandSupportPointIdBySocketId, {
    hand_r_socket: "pistol-support-left"
  });
  assert.deepEqual(pistolAttachment.mountedHolster, {
    attachmentSocketNodeName: "metaverse_service_pistol_back_socket",
    socketName: "back_socket"
  });
  assert.deepEqual(pistolAttachment.supportPoints, [
    {
      authoringNodeName: "metaverse_service_pistol_support_grip_marker",
      localPosition: { x: 0.04, y: -0.01, z: 0.025 },
      supportPointId: "pistol-support-left"
    }
  ]);
});

test("pistol proof asset keeps explicit grip, sighting, and holster socket nodes", async () => {
  const document = await loadMetaverseAssetDocument(
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  );
  const nodesByName = collectNamedNodeDescriptors(document);

  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_grip_hand_r_socket")?.translation,
    [0.052, -0.055, 0]
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_trigger_marker")?.translation,
    [0.088, -0.032, 0]
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_muzzle_socket")?.translation,
    [0.312, 0.03, 0]
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_ads_camera_anchor")?.translation,
    [0.016, 0.059, 0]
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_back_socket")?.translation,
    [0.072, 0.012, 0]
  );
});

test("current proof-slice gltf assets keep embedded payloads and normalized node scale", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts")
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest }
  ] = manifests;

  const proofGltfPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest
  }).filter((assetPath) => assetPath.endsWith(".gltf"));

  const proofDocuments = await Promise.all(
    proofGltfPaths.map(async (assetPath) => [assetPath, await loadMetaverseAssetDocument(assetPath)])
  );

  for (const [assetPath, document] of proofDocuments) {
    assert.equal(document.asset?.version, "2.0");

    for (const buffer of document.buffers ?? []) {
      assert.match(
        buffer.uri ?? "",
        /^data:/,
        `${assetPath} should keep embedded proof-slice buffer payloads.`
      );
    }

    for (const image of document.images ?? []) {
      if ("uri" in image) {
        assert.match(
          image.uri ?? "",
          /^data:/,
          `${assetPath} should keep embedded proof-slice image payloads.`
        );
      }
    }

    for (const node of document.nodes ?? []) {
      assert.equal(
        "scale" in node,
        false,
        `${assetPath} should not ship node scale transforms.`
      );
    }
  }
});

test("shipped metaverse glb assets keep normalized node scale", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts")
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest }
  ] = manifests;

  const proofGlbPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest
  }).filter((assetPath) => assetPath.endsWith(".glb"));

  const proofDocuments = await Promise.all(
    proofGlbPaths.map(async (assetPath) => [assetPath, await loadMetaverseAssetDocument(assetPath)])
  );

  for (const [assetPath, document] of proofDocuments) {
    assert.equal(document.asset?.version, "2.0");

    for (const node of document.nodes ?? []) {
      assert.equal(
        "scale" in node,
        false,
        `${assetPath} should not ship node scale transforms.`
      );
    }
  }
});

test("dock gltf LODs keep a flush deck support plane", async () => {
  const [highDockDocument, lowDockDocument] = await Promise.all([
    loadMetaverseAssetDocument(
      "/models/metaverse/environment/metaverse-hub-dock-high.gltf"
    ),
    loadMetaverseAssetDocument(
      "/models/metaverse/environment/metaverse-hub-dock-low.gltf"
    )
  ]);

  const resolveDeckSupportBounds = (document) => {
    const deckNode = (document.nodes ?? []).find((node) => node.mesh === 0);
    const deckAccessorIndex =
      document.meshes?.[0]?.primitives?.[0]?.attributes?.POSITION;
    const deckAccessor =
      typeof deckAccessorIndex === "number"
        ? document.accessors?.[deckAccessorIndex]
        : null;
    const translationY =
      deckNode?.translation?.[1] ??
      (Array.isArray(deckNode?.matrix) ? deckNode.matrix[13] : 0);

    assert.ok(deckNode);
    assert.ok(deckAccessor);

    return {
      maxY: (deckAccessor.max?.[1] ?? 0) + translationY,
      minY: (deckAccessor.min?.[1] ?? 0) + translationY
    };
  };

  const highDockBounds = resolveDeckSupportBounds(highDockDocument);
  const lowDockBounds = resolveDeckSupportBounds(lowDockDocument);

  assert.ok(Math.abs(highDockBounds.minY) < 0.000001);
  assert.ok(Math.abs(highDockBounds.maxY - 0.34) < 0.000001);
  assert.ok(Math.abs(lowDockBounds.minY) < 0.000001);
  assert.ok(Math.abs(lowDockBounds.maxY - 0.34) < 0.000001);
});

test("environment manifest keeps the shipped playground surfaces explicit as procedural range geometry", async () => {
  const {
    environmentPropManifest,
    metaversePlaygroundRangeBarrierEnvironmentAssetId,
    metaversePlaygroundRangeFloorEnvironmentAssetId
  } = await clientLoader.load("/src/assets/config/environment-prop-manifest.ts");
  const floorAsset =
    environmentPropManifest.byId[metaversePlaygroundRangeFloorEnvironmentAssetId];
  const barrierAsset =
    environmentPropManifest.byId[metaversePlaygroundRangeBarrierEnvironmentAssetId];

  assert.ok(floorAsset);
  assert.ok(barrierAsset);
  assert.equal(floorAsset.placement, "static");
  assert.equal(barrierAsset.placement, "instanced");
  assert.deepEqual(floorAsset.renderModel.lods, [
    {
      kind: "procedural-box",
      materialPreset: "training-range-surface",
      maxDistanceMeters: null,
      size: {
        x: 72,
        y: 0.6,
        z: 82
      },
      tier: "high"
    }
  ]);
  assert.deepEqual(barrierAsset.renderModel.lods, [
    {
      kind: "procedural-box",
      materialPreset: "training-range-accent",
      maxDistanceMeters: null,
      size: {
        x: 8.5,
        y: 3.2,
        z: 1.4
      },
      tier: "high"
    }
  ]);
});

test("proof delivery assets keep canonical character sockets, animation vocabulary clips, and authored vehicle seat nodes", async () => {
  const [
    { skeletonBoneNamesById, socketIds },
    { characterModelManifest },
    { animationClipManifest },
    { animationVocabularyIds, canonicalAnimationClipNamesByVocabulary },
    {
      humanoidV2PistolAimClipNamesByPoseId,
      humanoidV2PistolAnimationSourcePath
    },
    {
      environmentPropManifest,
      metaverseHubDiveBoatEnvironmentAssetId,
      metaverseHubSkiffEnvironmentAssetId
    }
  ] = await Promise.all([
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load(
      "/src/assets/config/humanoid-v2-pistol-animation-source.ts"
    ),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts")
  ]);

  const skiffAsset = environmentPropManifest.byId[metaverseHubSkiffEnvironmentAssetId];
  const diveBoatAsset =
    environmentPropManifest.byId[metaverseHubDiveBoatEnvironmentAssetId];
  const skiffDocument = await loadMetaverseAssetDocument(
    skiffAsset.renderModel.lods[0].modelPath
  );
  const diveBoatDocument = await loadMetaverseAssetDocument(
    diveBoatAsset.renderModel.lods[0].modelPath
  );
  const skiffNodeNames = new Set(
    (skiffDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );
  const skiffReachableNodeNames = collectReachableNamedNodeNames(skiffDocument);
  const diveBoatNodeNames = new Set(
    (diveBoatDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );
  const diveBoatReachableNodeNames =
    collectReachableNamedNodeNames(diveBoatDocument);

  for (const character of characterModelManifest.characters) {
    const characterDocument = await loadMetaverseAssetDocument(
      character.renderModel.lods[0].modelPath
    );
    const characterNodeNames = new Set(
      (characterDocument.nodes ?? [])
        .map((node) => node.name)
        .filter((name) => typeof name === "string")
    );

    for (const boneName of skeletonBoneNamesById[character.skeleton]) {
      assert.ok(
        characterNodeNames.has(boneName),
        `${character.label} is missing canonical bone ${boneName}.`
      );
    }

    for (const socketId of socketIds) {
      assert.ok(
        characterNodeNames.has(socketId),
        `${character.label} is missing canonical socket ${socketId}.`
      );
    }

    const clipSourcePaths = new Set();

    for (const clipId of character.animationClipIds) {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.ok(clipDescriptor);
      assert.equal(clipDescriptor.targetSkeleton, character.skeleton);
      assert.equal(
        clipDescriptor.clipName,
        canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]
      );
      clipSourcePaths.add(clipDescriptor.sourcePath);
    }

    for (const clipSourcePath of clipSourcePaths) {
      const animationPackDocument = await loadMetaverseAssetDocument(clipSourcePath);
      const animationPackNodeNames = new Set(
        (animationPackDocument.nodes ?? [])
          .map((node) => node.name)
          .filter((name) => typeof name === "string")
      );
      const animationPackClipNames = new Set(
        (animationPackDocument.animations ?? [])
          .map((animation) => animation.name)
          .filter((name) => typeof name === "string")
      );

      for (const boneName of skeletonBoneNamesById[character.skeleton]) {
        assert.ok(
          animationPackNodeNames.has(boneName),
          `${clipSourcePath} is missing canonical bone ${boneName}.`
        );
      }

      for (const socketId of socketIds) {
        assert.ok(
          animationPackNodeNames.has(socketId),
          `${clipSourcePath} is missing canonical socket ${socketId}.`
        );
      }

      for (const vocabularyId of animationVocabularyIds) {
        assert.ok(
          animationPackClipNames.has(canonicalAnimationClipNamesByVocabulary[vocabularyId]),
          `${clipSourcePath} is missing canonical animation clip ${canonicalAnimationClipNamesByVocabulary[vocabularyId]}.`
        );
      }
    }
  }

  const pistolAnimationPackDocument = await loadMetaverseAssetDocument(
    humanoidV2PistolAnimationSourcePath
  );
  const pistolAnimationClipNames = new Set(
    (pistolAnimationPackDocument.animations ?? [])
      .map((animation) => animation.name)
      .filter((name) => typeof name === "string")
  );

  for (const clipName of Object.values(humanoidV2PistolAimClipNamesByPoseId)) {
    assert.ok(
      pistolAnimationClipNames.has(clipName),
      `${humanoidV2PistolAnimationSourcePath} is missing pistol aim clip ${clipName}.`
    );
  }

  assert.ok(skiffNodeNames.has("driver_seat"));
  assert.ok(skiffNodeNames.has("port_bench_seat"));
  assert.ok(skiffNodeNames.has("port_bench_rear_seat"));
  assert.ok(skiffNodeNames.has("starboard_bench_seat"));
  assert.ok(skiffNodeNames.has("starboard_bench_rear_seat"));
  assert.ok(skiffNodeNames.has("deck_entry"));
  assert.ok(skiffReachableNodeNames.has("driver_seat"));
  assert.ok(skiffReachableNodeNames.has("port_bench_seat"));
  assert.ok(skiffReachableNodeNames.has("port_bench_rear_seat"));
  assert.ok(skiffReachableNodeNames.has("starboard_bench_seat"));
  assert.ok(skiffReachableNodeNames.has("starboard_bench_rear_seat"));
  assert.ok(skiffReachableNodeNames.has("deck_entry"));
  assert.ok(diveBoatNodeNames.has("helm_seat"));
  assert.ok(diveBoatNodeNames.has("port_bench_seat_a"));
  assert.ok(diveBoatNodeNames.has("port_bench_seat_b"));
  assert.ok(diveBoatNodeNames.has("port_bench_seat_c"));
  assert.ok(diveBoatNodeNames.has("starboard_bench_seat_a"));
  assert.ok(diveBoatNodeNames.has("starboard_bench_seat_b"));
  assert.ok(diveBoatNodeNames.has("starboard_bench_seat_c"));
  assert.ok(diveBoatNodeNames.has("stern_port_entry"));
  assert.ok(diveBoatNodeNames.has("stern_starboard_entry"));
  assert.ok(diveBoatReachableNodeNames.has("helm_seat"));
  assert.ok(diveBoatReachableNodeNames.has("port_bench_seat_a"));
  assert.ok(diveBoatReachableNodeNames.has("port_bench_seat_b"));
  assert.ok(diveBoatReachableNodeNames.has("port_bench_seat_c"));
  assert.ok(diveBoatReachableNodeNames.has("starboard_bench_seat_a"));
  assert.ok(diveBoatReachableNodeNames.has("starboard_bench_seat_b"));
  assert.ok(diveBoatReachableNodeNames.has("starboard_bench_seat_c"));
  assert.ok(diveBoatReachableNodeNames.has("stern_port_entry"));
  assert.ok(diveBoatReachableNodeNames.has("stern_starboard_entry"));
});

test("active full-body character render asset stays compatible with the canonical animation pack rig", async () => {
  const [
    {
      metaverseActiveFullBodyCharacterAssetId,
      characterModelManifest
    },
    { animationClipManifest },
    {
      skeletonBoneNamesById,
      skeletonBoneParentByNameById,
      skeletonSocketParentById,
      socketIds
    }
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts")
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];
  const activeClipSourcePaths = new Set(
    activeCharacter.animationClipIds.map(
      (clipId) => animationClipManifest.byId[clipId].sourcePath
    )
  );

  assert.equal(activeClipSourcePaths.size, 1);

  const activeAnimationPackPath = [...activeClipSourcePaths][0];
  const activeCharacterDocument = await loadMetaverseAssetDocument(
    activeCharacter.renderModel.lods[0].modelPath
  );
  const canonicalAnimationPackDocument = await loadMetaverseAssetDocument(
    activeAnimationPackPath
  );
  const activeNodesByName = collectNamedNodeDescriptors(activeCharacterDocument);
  const canonicalPackNodesByName = collectNamedNodeDescriptors(canonicalAnimationPackDocument);
  const activeParentNameByNodeName = collectParentNameByNodeName(activeCharacterDocument);
  const activeSkeletonBoneNames = skeletonBoneNamesById[activeCharacter.skeleton];
  const activeSkeletonBoneParentByName =
    skeletonBoneParentByNameById[activeCharacter.skeleton];
  const activeSkeletonSocketParentById =
    skeletonSocketParentById[activeCharacter.skeleton];
  const canonicalNames = new Set([...activeSkeletonBoneNames, ...socketIds]);

  for (const boneName of activeSkeletonBoneNames) {
    const activeNode = activeNodesByName.get(boneName);
    const canonicalPackNode = canonicalPackNodesByName.get(boneName);

    assert.ok(activeNode, `Active character is missing canonical bone ${boneName}.`);
    assert.ok(canonicalPackNode, `Canonical pack is missing canonical bone ${boneName}.`);
    assert.equal(
      canonicalNames.has(activeParentNameByNodeName.get(boneName))
        ? activeParentNameByNodeName.get(boneName)
        : null,
      activeSkeletonBoneParentByName[boneName],
      `Active character bone ${boneName} must preserve canonical parentage.`
    );
    assert.deepEqual(
      resolveNamedChildNodeNames(activeCharacterDocument, activeNode.children).filter((childName) =>
        canonicalNames.has(childName)
      ),
      resolveNamedChildNodeNames(canonicalAnimationPackDocument, canonicalPackNode.children).filter(
        (childName) => canonicalNames.has(childName)
      ),
      `Active character bone ${boneName} must preserve canonical child ordering.`
    );
    assertNumberArraysClose(
      activeNode.translation,
      canonicalPackNode.translation,
      0.0001,
      `Active character bone ${boneName} translation must stay aligned with the canonical pack`
    );
    assertQuaternionArraysEquivalent(
      activeNode.rotation,
      canonicalPackNode.rotation,
      0.0001,
      `Active character bone ${boneName} rotation must stay aligned with the canonical pack`
    );
  }

  for (const socketId of socketIds) {
    const activeNode = activeNodesByName.get(socketId);
    const canonicalPackNode = canonicalPackNodesByName.get(socketId);

    assert.ok(activeNode, `Active character is missing canonical socket ${socketId}.`);
    assert.ok(canonicalPackNode, `Canonical pack is missing canonical socket ${socketId}.`);
    assert.equal(
      canonicalNames.has(activeParentNameByNodeName.get(socketId))
        ? activeParentNameByNodeName.get(socketId)
        : null,
      activeSkeletonSocketParentById[socketId],
      `Active character socket ${socketId} must preserve canonical parentage.`
    );
    assertNumberArraysClose(
      activeNode.translation,
      canonicalPackNode.translation,
      0.0001,
      `Active character socket ${socketId} translation must stay aligned with the canonical pack`
    );
    assertQuaternionArraysEquivalent(
      activeNode.rotation,
      canonicalPackNode.rotation,
      0.0001,
      `Active character socket ${socketId} rotation must stay aligned with the canonical pack`
    );
  }
});
