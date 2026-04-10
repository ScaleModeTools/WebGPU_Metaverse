import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

const metaverseDeliveryPathPattern =
  /^\/models\/metaverse\/(?:attachments|characters|environment)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:-(?:high|medium|low|collision))?\.(?:glb|gltf)$/;

async function loadMetaverseGltfDocument(assetPath) {
  return JSON.parse(
    await readFile(new URL(`../../../client/public${assetPath}`, import.meta.url), "utf8")
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
      metaverseMannequinArmsCharacterAssetId,
      metaverseMannequinCharacterAssetId,
      characterModelManifest
    },
    { animationClipManifest },
    { canonicalAnimationClipNamesByVocabulary },
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

    assert.ok(clipVocabularies.includes("idle"));
    assert.ok(clipVocabularies.includes("walk"));

    for (const clipId of character.animationClipIds) {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.equal(
        clipDescriptor.clipName,
        canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]
      );
    }
  }
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
    proofGltfPaths.map(async (assetPath) => [assetPath, await loadMetaverseGltfDocument(assetPath)])
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

test("proof delivery assets keep canonical character sockets and mount seat sockets", async () => {
  const [
    { humanoidV1BoneNames, socketIds },
    { characterModelManifest, metaverseMannequinCharacterAssetId },
    { environmentPropManifest, metaverseHubSkiffEnvironmentAssetId }
  ] = await Promise.all([
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts")
  ]);

  const mannequinAsset = characterModelManifest.byId[metaverseMannequinCharacterAssetId];
  const skiffAsset = environmentPropManifest.byId[metaverseHubSkiffEnvironmentAssetId];
  const mannequinDocument = await loadMetaverseGltfDocument(
    mannequinAsset.renderModel.lods[0].modelPath
  );
  const skiffDocument = await loadMetaverseGltfDocument(skiffAsset.renderModel.lods[0].modelPath);
  const mannequinNodeNames = new Set(
    (mannequinDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );
  const skiffNodeNames = new Set(
    (skiffDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string")
  );

  for (const boneName of humanoidV1BoneNames) {
    assert.ok(mannequinNodeNames.has(boneName));
  }

  for (const socketId of socketIds) {
    assert.ok(mannequinNodeNames.has(socketId));
  }

  assert.ok(skiffNodeNames.has("seat_socket"));
});
