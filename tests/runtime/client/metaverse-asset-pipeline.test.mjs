import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

const metaverseDeliveryPathPattern =
  /^\/models\/metaverse\/(?:attachments|characters|environment)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:-(?:high|medium|low|collision))?\.(?:glb|gltf)$/;

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
            translation: node.translation ?? [0, 0, 0]
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
  environmentPropManifest
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

  for (const environmentAsset of environmentPropManifest.environmentAssets) {
    for (const lod of environmentAsset.renderModel.lods) {
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

test("canonical humanoid rig keeps stable bone and socket parentage", async () => {
  const {
    humanoidV1BoneNames,
    humanoidV1BoneParentByName,
    humanoidV1SocketParentById,
    socketIds
  } = await clientLoader.load("/src/assets/types/asset-socket.ts");

  assert.deepEqual(humanoidV1BoneNames, [
    "humanoid_root",
    "hips",
    "spine",
    "chest",
    "neck"
  ]);
  assert.deepEqual(humanoidV1BoneParentByName, {
    humanoid_root: null,
    hips: "humanoid_root",
    spine: "hips",
    chest: "spine",
    neck: "chest"
  });
  assert.deepEqual(humanoidV1SocketParentById, {
    hand_r_socket: "chest",
    hand_l_socket: "chest",
    head_socket: "neck",
    hip_socket: "hips",
    seat_socket: "hips"
  });
  assert.deepEqual(Object.keys(humanoidV1SocketParentById).sort(), [...socketIds].sort());
});

test("character manifests expose two humanoid-compatible assets on the same vocabulary", async () => {
  const [
    {
      metaverseActiveFullBodyCharacterAssetId,
      metaverseMannequinArmsCharacterAssetId,
      metaverseMannequinCharacterAssetId,
      characterModelManifest
    },
    {
      animationClipManifest,
      metaverseMannequinCanonicalAnimationPackSourcePath
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

  assert.ok(characterIds.includes(metaverseMannequinCharacterAssetId));
  assert.ok(characterIds.includes(metaverseMannequinArmsCharacterAssetId));
  assert.ok(characterIds.includes(metaverseActiveFullBodyCharacterAssetId));

  const activeFullBodyCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeFullBodyCharacter);
  assert.equal(activeFullBodyCharacter.skeleton, "humanoid_v1");
  assert.ok(activeFullBodyCharacter.presentationModes.includes("full-body"));

  const humanoidCharacters = characterModelManifest.characters.filter(
    (character) => character.skeleton === "humanoid_v1"
  );

  assert.ok(humanoidCharacters.length >= 2);

  for (const character of humanoidCharacters) {
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
    [metaverseMannequinCanonicalAnimationPackSourcePath]
  );
});

test("metaverse asset manifests keep stable shipped delivery paths and LOD naming", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts")
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest }
  ] = manifests;

  const deliveryPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest
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
      assert.match(lod.modelPath, new RegExp(`-${lod.tier}\\.(?:glb|gltf)$`));
    }
  }
});

test("current proof-slice gltf assets keep embedded payloads and normalized node scale", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts")
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest }
  ] = manifests;

  const proofGltfPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest
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

test("proof delivery assets keep canonical character sockets, animation vocabulary clips, and mount seat sockets", async () => {
  const [
    { humanoidV1BoneNames, socketIds },
    { characterModelManifest, metaverseMannequinCharacterAssetId },
    {
      metaverseMannequinCanonicalAnimationPackSourcePath
    },
    { animationVocabularyIds },
    { environmentPropManifest, metaverseHubSkiffEnvironmentAssetId }
  ] = await Promise.all([
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts")
  ]);

  const mannequinAsset = characterModelManifest.byId[metaverseMannequinCharacterAssetId];
  const skiffAsset = environmentPropManifest.byId[metaverseHubSkiffEnvironmentAssetId];
  const mannequinDocument = await loadMetaverseAssetDocument(
    mannequinAsset.renderModel.lods[0].modelPath
  );
  const animationPackDocument = await loadMetaverseAssetDocument(
    metaverseMannequinCanonicalAnimationPackSourcePath
  );
  const skiffDocument = await loadMetaverseAssetDocument(
    skiffAsset.renderModel.lods[0].modelPath
  );
  const mannequinNodeNames = new Set(
    (mannequinDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );
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
  const skiffNodeNames = new Set(
    (skiffDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );

  for (const boneName of humanoidV1BoneNames) {
    assert.ok(mannequinNodeNames.has(boneName));
    assert.ok(animationPackNodeNames.has(boneName));
  }

  for (const socketId of socketIds) {
    assert.ok(mannequinNodeNames.has(socketId));
    assert.ok(animationPackNodeNames.has(socketId));
  }

  assert.deepEqual([...animationPackClipNames].sort(), [...animationVocabularyIds].sort());
  assert.ok(skiffNodeNames.has("seat_socket"));
});

test("active full-body character render asset stays compatible with the canonical animation pack rig", async () => {
  const [
    {
      metaverseActiveFullBodyCharacterAssetId,
      characterModelManifest
    },
    { metaverseMannequinCanonicalAnimationPackSourcePath },
    {
      humanoidV1BoneNames,
      humanoidV1BoneParentByName,
      humanoidV1SocketParentById,
      socketIds
    }
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts")
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];
  const activeCharacterDocument = await loadMetaverseAssetDocument(
    activeCharacter.renderModel.lods[0].modelPath
  );
  const canonicalAnimationPackDocument = await loadMetaverseAssetDocument(
    metaverseMannequinCanonicalAnimationPackSourcePath
  );
  const activeNodesByName = collectNamedNodeDescriptors(activeCharacterDocument);
  const canonicalPackNodesByName = collectNamedNodeDescriptors(canonicalAnimationPackDocument);
  const activeParentNameByNodeName = collectParentNameByNodeName(activeCharacterDocument);
  const canonicalNames = new Set([...humanoidV1BoneNames, ...socketIds]);

  for (const boneName of humanoidV1BoneNames) {
    const activeNode = activeNodesByName.get(boneName);
    const canonicalPackNode = canonicalPackNodesByName.get(boneName);

    assert.ok(activeNode, `Active character is missing canonical bone ${boneName}.`);
    assert.ok(canonicalPackNode, `Canonical pack is missing canonical bone ${boneName}.`);
    assert.equal(
      canonicalNames.has(activeParentNameByNodeName.get(boneName))
        ? activeParentNameByNodeName.get(boneName)
        : null,
      humanoidV1BoneParentByName[boneName],
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
      humanoidV1SocketParentById[socketId],
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
