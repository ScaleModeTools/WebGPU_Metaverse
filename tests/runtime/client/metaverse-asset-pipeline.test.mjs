import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

const metaverseDeliveryPathPattern =
  /^\/models\/metaverse\/(?:attachments(?:\/modules)?|characters|environment)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:-(?:high|medium|low|collision))?\.(?:glb|gltf)$/;

const metaverseHumanoidBasePackProvenanceRoot =
  "client/public/models/metaverse/characters/metaverse-humanoid-base-pack";

const metaverseHumanoidBasePackProvenancePaths = [
  `${metaverseHumanoidBasePackProvenanceRoot}/README.md`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/README.md`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/src/avatarRig.ts`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/src/threeAnimationMasks.ts`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/src/avatarAnimationCatalog124.ts`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/src/animationCatalog.ts`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/scripts/build-animation-pack-catalog.mjs`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/manifests/2ways-rig-manifest.json`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/manifests/2ways-rig-report.md`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/manifests/2ways-bone-nomenclature.csv`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/README.md`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/animation-pack.manifest.json`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/category-index.json`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/animation-index.csv`,
  `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/animation-index.compact.md`,
];

async function readRepositoryTextFile(repoRelativePath) {
  return readFile(
    new URL(`../../../${repoRelativePath}`, import.meta.url),
    "utf8",
  );
}

async function loadMetaverseAssetBuffer(assetPath) {
  return readFile(
    new URL(`../../../client/public${assetPath}`, import.meta.url),
  );
}

function parseMetaverseGlbDocument(assetBuffer) {
  const magic = assetBuffer.subarray(0, 4).toString("utf8");

  assert.equal(magic, "glTF");

  const jsonChunkLength = assetBuffer.readUInt32LE(12);
  const jsonChunkType = assetBuffer.readUInt32LE(16);

  assert.equal(jsonChunkType, 0x4e4f534a);

  return JSON.parse(
    assetBuffer
      .subarray(20, 20 + jsonChunkLength)
      .toString("utf8")
      .trim(),
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
                : [0, 0, 0]),
          },
        ];
      })
      .filter((entry) => entry !== null),
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
  const pendingNodeIndices = [
    ...(document.scenes?.[document.scene ?? 0]?.nodes ?? []),
  ];

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

function collectSkinJointNames(document) {
  const nodes = document.nodes ?? [];
  const [skin] = document.skins ?? [];

  return (skin?.joints ?? [])
    .map((nodeIndex) => nodes[nodeIndex]?.name)
    .filter((name) => typeof name === "string");
}

function assertNumberArraysClose(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  for (let index = 0; index < actual.length; index += 1) {
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= tolerance,
      `${message} at index ${index}: expected ${expected[index]}, received ${actual[index]}.`,
    );
  }
}

function assertQuaternionArraysEquivalent(
  actual,
  expected,
  tolerance,
  message,
) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  let maxDirectDelta = 0;
  let maxNegatedDelta = 0;

  for (let index = 0; index < actual.length; index += 1) {
    maxDirectDelta = Math.max(
      maxDirectDelta,
      Math.abs(actual[index] - expected[index]),
    );
    maxNegatedDelta = Math.max(
      maxNegatedDelta,
      Math.abs(actual[index] + expected[index]),
    );
  }

  assert.ok(
    Math.min(maxDirectDelta, maxNegatedDelta) <= tolerance,
    `${message}: expected ${expected.join(",")}, received ${actual.join(",")}.`,
  );
}

function collectMetaverseDeliveryPaths({
  animationClipManifest,
  attachmentModelManifest,
  characterModelManifest,
  environmentPropManifest,
  weaponModuleManifest,
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

test("metaverse humanoid base pack keeps imported rig kit provenance before root kit removal", async () => {
  const provenanceContents = await Promise.all(
    metaverseHumanoidBasePackProvenancePaths.map(async (provenancePath) => [
      provenancePath,
      await readRepositoryTextFile(provenancePath),
    ]),
  );

  for (const [provenancePath, contents] of provenanceContents) {
    assert.ok(
      contents.length > 0,
      `${provenancePath} should preserve the imported avatar rig kit source information.`,
    );
  }

  const provenanceReadme = await readRepositoryTextFile(
    `${metaverseHumanoidBasePackProvenanceRoot}/README.md`,
  );
  assert.match(
    provenanceReadme,
    /client\/public\/models\/metaverse\/characters\/metaverse-humanoid-base-pack\.glb/,
  );
  assert.match(provenanceReadme, /humanoid-v2-avatar-rig\.ts/);
  assert.match(
    provenanceReadme,
    /metaverse-humanoid-base-animation-catalog\.ts/,
  );
  assert.match(
    provenanceReadme,
    /original-kit\/animation-packs\/124\/animation-pack\.manifest\.json/,
  );

  const preservedKitReadme = await readRepositoryTextFile(
    `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/README.md`,
  );
  assert.match(preservedKitReadme, /canonical 66-bone names/);
  assert.match(preservedKitReadme, /124-animation GLB/);

  const preservedRigManifest = JSON.parse(
    await readRepositoryTextFile(
      `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/manifests/2ways-rig-manifest.json`,
    ),
  );
  assert.equal(preservedRigManifest.skeleton.jointCount, 66);
  assert.equal(preservedRigManifest.mesh.vertexCount, 8722);
  assert.equal(preservedRigManifest.skeleton.rootJoint, "root");

  const preservedAnimationPackManifest = JSON.parse(
    await readRepositoryTextFile(
      `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/animation-packs/124/animation-pack.manifest.json`,
    ),
  );
  assert.equal(preservedAnimationPackManifest.summary.animationCount, 124);
  assert.equal(
    preservedAnimationPackManifest.summary.totalDurationSeconds,
    220.875,
  );
  assert.equal(
    preservedAnimationPackManifest.compatibility.jointNamesEqual,
    true,
  );
  assert.equal(
    preservedAnimationPackManifest.compatibility.hierarchyEqual,
    true,
  );

  const preservedMaskHelper = await readRepositoryTextFile(
    `${metaverseHumanoidBasePackProvenanceRoot}/original-kit/src/threeAnimationMasks.ts`,
  );
  assert.match(preservedMaskHelper, /createMaskedClipFromGroup/);
  assert.match(preservedMaskHelper, /listClipTargetBones/);
});

test("canonical humanoid rig definitions keep stable bone and socket parentage", async () => {
  const [
    { metaverseHumanoidBaseAnimationPackSourcePath },
    {
      humanoidV2BoneAliasByName,
      humanoidV2BoneGroups,
      humanoidV2BoneNames,
      humanoidV2BoneParentByName,
      humanoidV2FingerChainsBySide,
      humanoidV2SocketLocalTransformsById,
      humanoidV2SocketParentById,
      skeletonBoneNamesById,
      skeletonBoneParentByNameById,
      skeletonIds,
      skeletonSocketLocalTransformsById,
      skeletonSocketParentById,
      socketIds,
    },
    {
      humanoidV2BoneCategories,
      humanoidV2BoneDescriptorByName,
      humanoidV2BoneDescriptors,
      humanoidV2BoneNamesByCategory,
      humanoidV2BoneNamesBySide,
      humanoidV2BoneSides,
      humanoidV2RigDescriptorSummary,
    },
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load("/src/assets/types/humanoid-v2-rig-descriptors.ts"),
  ]);
  const basePackDocument = await loadMetaverseAssetDocument(
    metaverseHumanoidBaseAnimationPackSourcePath,
  );
  const basePackParentNameByNodeName =
    collectParentNameByNodeName(basePackDocument);

  assert.deepEqual(skeletonIds, ["humanoid_v2"]);
  assert.equal(humanoidV2BoneNames.length, 66);
  assert.deepEqual(
    humanoidV2BoneNames,
    collectSkinJointNames(basePackDocument),
  );

  for (const boneName of humanoidV2BoneNames) {
    const actualParentName = basePackParentNameByNodeName.get(boneName) ?? null;

    assert.equal(
      humanoidV2BoneNames.includes(actualParentName) ? actualParentName : null,
      humanoidV2BoneParentByName[boneName],
      `humanoid_v2 bone ${boneName} parent metadata must match the base pack.`,
    );
  }

  assert.equal(humanoidV2BoneAliasByName.pelvis, "hips / pelvis driver");
  assert.equal(
    humanoidV2BoneAliasByName.index_01_r,
    "right index finger proximal / base",
  );
  assert.deepEqual(humanoidV2FingerChainsBySide.left.index, [
    "index_01_l",
    "index_02_l",
    "index_03_l",
    "index_04_leaf_l",
  ]);
  assert.deepEqual(humanoidV2RigDescriptorSummary, {
    sourceFile: "2ways.glb",
    generator: "THREE.GLTFExporter r183",
    mesh: {
      meshCount: 1,
      vertexCount: 8722,
      indexCount: 41139,
      primitiveCount: 1,
    },
    skeleton: {
      skinCount: 1,
      jointCount: 66,
      rootJoint: "root",
    },
  });
  assert.deepEqual(humanoidV2BoneCategories, [
    "root",
    "hips",
    "spine",
    "head_neck",
    "arm",
    "finger",
    "leg",
  ]);
  assert.deepEqual(humanoidV2BoneSides, ["center", "left", "right"]);
  assert.equal(humanoidV2BoneDescriptors.length, 66);
  assert.equal(
    humanoidV2BoneDescriptorByName.spine_01.weightedVertexCount,
    692,
  );
  assert.equal(
    humanoidV2BoneDescriptorByName.thumb_04_leaf_l.weightedVertexCount,
    0,
  );
  assert.equal(humanoidV2BoneDescriptorByName.index_02_r.depth, 10);
  assert.equal(humanoidV2BoneDescriptorByName.index_02_r.category, "finger");
  assert.deepEqual(humanoidV2BoneNamesByCategory.spine, [
    "spine_01",
    "spine_02",
    "spine_03",
  ]);
  assert.equal(humanoidV2BoneNamesBySide.left.length, 29);
  assert.equal(humanoidV2BoneNamesBySide.right.length, 29);
  assert.deepEqual(humanoidV2BoneGroups.locomotionCore, [
    "root",
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "thigh_l",
    "calf_l",
    "foot_l",
    "ball_l",
    "ball_leaf_l",
    "thigh_r",
    "calf_r",
    "foot_r",
    "ball_r",
    "ball_leaf_r",
  ]);
  assert.deepEqual(humanoidV2BoneGroups.twoHandInteraction.slice(0, 6), [
    "spine_02",
    "spine_03",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
  ]);
  assert.deepEqual(humanoidV2SocketParentById, {
    hand_r_socket: "hand_r",
    hand_l_socket: "hand_l",
    head_socket: "head",
    hip_socket: "pelvis",
    seat_socket: "pelvis",
  });
  assert.deepEqual(humanoidV2SocketLocalTransformsById.hand_r_socket, {
    position: { x: 0, y: 0.08, z: 0 },
    quaternion: {
      x: 0,
      y: 0,
      z: 0.7071067811865476,
      w: 0.7071067811865476,
    },
  });
  assert.deepEqual(
    Object.keys(humanoidV2SocketParentById).sort(),
    [...socketIds].sort(),
  );
  assert.deepEqual(skeletonBoneNamesById.humanoid_v2, humanoidV2BoneNames);
  assert.deepEqual(
    skeletonBoneParentByNameById.humanoid_v2,
    humanoidV2BoneParentByName,
  );
  assert.deepEqual(
    skeletonSocketParentById.humanoid_v2,
    humanoidV2SocketParentById,
  );
  assert.deepEqual(
    skeletonSocketLocalTransformsById.humanoid_v2,
    humanoidV2SocketLocalTransformsById,
  );
});

test("humanoid_v2 rig metadata keeps animation masks and head anchors explicit", async () => {
  const [
    {
      createHumanoidV2MaskedClipFromGroup,
      humanoidV2HeadAnchorNodeNames,
      getHumanoidV2BoneNameFromTrackName,
      listHumanoidV2ClipTargetBones,
    },
    { characterModelManifest, metaverseActiveFullBodyCharacterAssetId },
    { humanoidV2SocketLocalTransformsById },
    { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack },
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/render/humanoid-v2-rig.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    import("three/webgpu"),
  ]);
  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeCharacter);

  const humanoidDocument = await loadMetaverseAssetDocument(
    activeCharacter.renderModel.lods[0].modelPath,
  );
  const reachableNodeNames = collectReachableNamedNodeNames(humanoidDocument);

  assert.deepEqual(humanoidV2HeadAnchorNodeNames, {
    head: "head",
    headLeaf: "head_leaf",
    headSocket: "head_socket",
    neck: "neck_01",
  });
  assert.equal(
    getHumanoidV2BoneNameFromTrackName("Armature.bones[index_02_r].quaternion"),
    "index_02_r",
  );

  const mixedClip = new AnimationClip("mixed", 1, [
    new QuaternionKeyframeTrack("spine_02.quaternion", [0], [0, 0, 0, 1]),
    new QuaternionKeyframeTrack("upperarm_r.quaternion", [0], [0, 0, 0, 1]),
    new QuaternionKeyframeTrack("head.quaternion", [0], [0, 0, 0, 1]),
    new VectorKeyframeTrack("pelvis.position", [0], [0, 0, 0]),
  ]);
  const maskedInteractionClip = createHumanoidV2MaskedClipFromGroup(
    mixedClip,
    "twoHandInteraction",
  );
  const maskedLocomotionClip = createHumanoidV2MaskedClipFromGroup(
    mixedClip,
    "locomotionCore",
    { includePositionTracks: true },
  );

  assert.deepEqual(listHumanoidV2ClipTargetBones(mixedClip), [
    "head",
    "pelvis",
    "spine_02",
    "upperarm_r",
  ]);
  assert.deepEqual(
    maskedInteractionClip.tracks.map((track) => track.name),
    ["spine_02.quaternion", "upperarm_r.quaternion"],
  );
  assert.deepEqual(
    maskedLocomotionClip.tracks.map((track) => track.name),
    ["spine_02.quaternion", "pelvis.position"],
  );

  for (const nodeName of Object.values(humanoidV2HeadAnchorNodeNames)) {
    if (nodeName === "head_socket") {
      assert.ok(
        humanoidV2SocketLocalTransformsById[nodeName],
        "Expected humanoid_v2 head_socket to be available through runtime socket synthesis metadata.",
      );
      continue;
    }

    assert.equal(
      reachableNodeNames.has(nodeName),
      true,
      `Expected humanoid_v2 head anchor node ${nodeName} to stay reachable in the delivered GLB.`,
    );
  }
});

test("character manifests expose the active humanoid_v2 skeleton on the canonical vocabulary", async () => {
  const [
    {
      mesh2motionHumanoidCharacterAssetId,
      metaverseActiveFullBodyCharacterAssetId,
      characterModelManifest,
    },
    {
      animationClipManifest,
      metaverseHumanoidBaseAnimationPackSourcePath,
      mesh2motionHumanoidIdleAnimationClipId,
    },
    { animationVocabularyIds, canonicalAnimationClipNamesByVocabulary },
    { socketIds },
    {
      AVATAR_124_ANIMATION_CATALOG,
      AVATAR_124_ANIMATION_IDS_BY_CATEGORY,
      AVATAR_124_ANIMATION_IDS_BY_PACK,
      AVATAR_124_ANIMATION_IDS_BY_PLAYBACK_KIND,
      AVATAR_124_ANIMATION_PACK_COMPATIBILITY,
      AVATAR_124_ANIMATION_PACK_SUMMARY,
      AVATAR_124_ANIMATIONS_BY_CATEGORY,
      AVATAR_124_ANIMATIONS_BY_PACK,
      AVATAR_124_ANIMATIONS_BY_PLAYBACK_KIND,
    },
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load(
      "/src/assets/config/metaverse-humanoid-base-animation-catalog.ts",
    ),
  ]);

  const characterIds = characterModelManifest.characters.map(
    (character) => character.id,
  );

  assert.deepEqual(characterIds, [mesh2motionHumanoidCharacterAssetId]);
  assert.equal(
    metaverseActiveFullBodyCharacterAssetId,
    mesh2motionHumanoidCharacterAssetId,
  );

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
      [...animationVocabularyIds].sort(),
    );

    for (const clipId of character.animationClipIds) {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.equal(clipDescriptor.targetSkeleton, character.skeleton);
      assert.equal(
        clipDescriptor.clipName,
        canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary],
      );
    }
  }

  const activeClipSourcePaths = new Set(
    activeFullBodyCharacter.animationClipIds.map(
      (clipId) => animationClipManifest.byId[clipId].sourcePath,
    ),
  );

  assert.deepEqual([...activeClipSourcePaths].sort(), [
    metaverseHumanoidBaseAnimationPackSourcePath,
  ]);

  const idleClipDescriptor =
    animationClipManifest.byId[mesh2motionHumanoidIdleAnimationClipId];

  assert.ok(idleClipDescriptor);
  assert.equal(idleClipDescriptor.vocabulary, "idle");
  assert.equal(idleClipDescriptor.clipName, "Idle_Loop");
  assert.equal(
    idleClipDescriptor.sourcePath,
    metaverseHumanoidBaseAnimationPackSourcePath,
  );
  const basePackDocument = await loadMetaverseAssetDocument(
    metaverseHumanoidBaseAnimationPackSourcePath,
  );
  const basePackClipNames = new Set(
    (basePackDocument.animations ?? [])
      .map((animation) => animation.name)
      .filter((name) => typeof name === "string"),
  );

  assert.equal(AVATAR_124_ANIMATION_CATALOG.length, 124);
  assert.equal(AVATAR_124_ANIMATION_PACK_SUMMARY.animationCount, 124);
  assert.ok(
    Math.abs(AVATAR_124_ANIMATION_PACK_SUMMARY.totalDurationSeconds - 220.875) <
      0.000001,
  );
  assert.equal(
    AVATAR_124_ANIMATION_PACK_SUMMARY.countsByCategory.locomotion,
    14,
  );
  assert.equal(AVATAR_124_ANIMATION_PACK_SUMMARY.countsByLoadPack.combat, 35);
  assert.equal(AVATAR_124_ANIMATION_PACK_SUMMARY.countsByPlaybackKind.loop, 37);
  assert.deepEqual(AVATAR_124_ANIMATION_PACK_SUMMARY.rootMotionClipIds, [
    "climb_up_1m_rm",
    "crawl_rm",
    "hit_knockback_rm",
    "roll_rm",
    "shield_dash_rm",
    "sword_attack_rm",
    "sword_dash_rm",
  ]);
  assert.deepEqual(AVATAR_124_ANIMATION_PACK_COMPATIBILITY, {
    sourceFingerprint: "540e5dcb849fb179",
    baselineFingerprint: "540e5dcb849fb179",
    jointNamesEqual: true,
    hierarchyEqual: true,
    sourceJointCount: 66,
    baselineJointCount: 66,
    missingFromSource: [],
    extraInSource: [],
  });
  assert.equal(AVATAR_124_ANIMATIONS_BY_CATEGORY.locomotion.length, 14);
  assert.equal(AVATAR_124_ANIMATIONS_BY_PACK["core-locomotion"].length, 14);
  assert.equal(AVATAR_124_ANIMATIONS_BY_PLAYBACK_KIND.one_shot.length, 65);
  assert.ok(
    AVATAR_124_ANIMATION_IDS_BY_CATEGORY.combat_weapon.includes("pistol_shoot"),
  );
  assert.ok(AVATAR_124_ANIMATION_IDS_BY_PACK.combat.includes("hit_knockback"));
  assert.ok(
    AVATAR_124_ANIMATION_IDS_BY_PLAYBACK_KIND.loop.includes("walk_loop"),
  );

  for (const animation of AVATAR_124_ANIMATION_CATALOG) {
    assert.ok(
      basePackClipNames.has(animation.clipName),
      `Base animation pack is missing cataloged clip ${animation.clipName}.`,
    );
  }
  assert.deepEqual(
    [
      ...new Set(
        animationClipManifest.clips.map((clip) => clip.targetSkeleton),
      ),
    ],
    ["humanoid_v2"],
  );
});

test("metaverse asset manifests keep stable shipped delivery paths and LOD naming", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts"),
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest },
  ] = manifests;

  const deliveryPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest,
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
  const { attachmentModelManifest, metaverseServicePistolAttachmentAssetId } =
    await clientLoader.load("/src/assets/config/attachment-model-manifest.ts");

  const pistolAttachment =
    attachmentModelManifest.byId[metaverseServicePistolAttachmentAssetId];

  assert.ok(pistolAttachment);
  assert.equal(pistolAttachment.defaultSocketId, "hand_r_socket");
  assert.equal(pistolAttachment.holdProfile.family, "sidearm");
  assert.equal(
    pistolAttachment.holdProfile.poseProfileId,
    "sidearm.one_hand_optional_support",
  );
  assert.equal(
    pistolAttachment.holdProfile.offhandPolicy,
    "optional_support_palm",
  );
  assert.deepEqual(pistolAttachment.heldMount, {
    adsCameraTargetOffset: {
      across: 0,
      forward: 0.1,
      up: -0.05,
    },
    attachmentSocketRole: "grip.primary",
  });
  assert.deepEqual(pistolAttachment.mountedHolster, {
    attachmentSocketRole: "carry.back",
    socketName: "back_socket",
  });
});

test("weapon archetypes carry canonical held-object authoring profiles", async () => {
  const [
    {
      metaverseRocketLauncherWeaponAssetId,
      metaverseServicePistolV2WeaponAssetId,
      weaponArchetypeManifest,
    },
    { heldObjectCoreSocketRolesByFamily },
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/weapon-archetype-manifest.ts"),
    clientLoader.load("/src/assets/types/held-object-authoring-manifest.ts"),
  ]);
  const pistol =
    weaponArchetypeManifest.byId[metaverseServicePistolV2WeaponAssetId];
  const rocketLauncher =
    weaponArchetypeManifest.byId[metaverseRocketLauncherWeaponAssetId];

  assert.ok(pistol);
  assert.ok(rocketLauncher);
  assert.equal(pistol.holdProfile.family, "sidearm");
  assert.equal(
    pistol.holdProfile.poseProfileId,
    "sidearm.one_hand_optional_support",
  );
  assert.equal(pistol.holdProfile.primaryHandDefault, "right");
  assert.deepEqual(pistol.holdProfile.allowedHands, ["right", "left"]);
  assert.equal(pistol.holdProfile.offhandPolicy, "optional_support_palm");
  assert.equal(pistol.holdProfile.adsPolicy, "iron_sights");
  assert.equal(
    pistol.weaponAimProfile.poseProfileId,
    pistol.holdProfile.poseProfileId,
  );

  const pistolSocketNodeByRole = new Map(
    pistol.holdProfile.sockets.map((socket) => [socket.role, socket.nodeName]),
  );

  assert.equal(
    pistolSocketNodeByRole.get("grip.primary"),
    "metaverse_service_pistol_grip_hand_r_socket",
  );
  assert.equal(
    pistolSocketNodeByRole.get("grip.secondary"),
    "metaverse_service_pistol_support_marker",
  );
  assert.equal(
    pistolSocketNodeByRole.get("projectile.muzzle"),
    "metaverse_service_pistol_muzzle_socket",
  );

  assert.equal(rocketLauncher.holdProfile.family, "shoulder_heavy");
  assert.equal(
    rocketLauncher.holdProfile.poseProfileId,
    "shoulder_heavy.two_hand_shouldered",
  );
  assert.equal(rocketLauncher.holdProfile.primaryHandDefault, "right");
  assert.deepEqual(rocketLauncher.holdProfile.allowedHands, ["right"]);
  assert.equal(
    rocketLauncher.holdProfile.offhandPolicy,
    "required_support_grip",
  );
  assert.equal(rocketLauncher.holdProfile.adsPolicy, "shouldered_heavy");
  assert.equal(
    rocketLauncher.weaponAimProfile.poseProfileId,
    rocketLauncher.holdProfile.poseProfileId,
  );

  const rocketSocketNodeByRole = new Map(
    rocketLauncher.holdProfile.sockets.map((socket) => [
      socket.role,
      socket.nodeName,
    ]),
  );

  assert.equal(
    rocketSocketNodeByRole.get("grip.secondary"),
    "metaverse_rocket_launcher_support_grip_marker",
  );
  assert.equal(
    rocketSocketNodeByRole.get("module.underbarrel_grip"),
    "metaverse_rocket_launcher_grip_module_socket",
  );
  assert.equal(
    rocketSocketNodeByRole.get("camera.ads_anchor"),
    "metaverse_rocket_launcher_ads_camera_anchor",
  );
  assert.equal(
    rocketSocketNodeByRole.get("projectile.exhaust"),
    "metaverse_rocket_launcher_exhaust_socket",
  );
  assert.equal(
    rocketSocketNodeByRole.get("hazard.backblast_cone"),
    "metaverse_rocket_launcher_backblast_cone_socket",
  );
  assert.equal(rocketSocketNodeByRole.has("body.shoulder_contact"), false);
  assert.deepEqual(rocketLauncher.holdProfile.bodyContactRoles ?? [], []);
  assert.deepEqual(rocketLauncher.holdProfile.hazardRoles, [
    "hazard.backblast_cone",
  ]);

  for (const weapon of weaponArchetypeManifest.archetypes) {
    const socketRoles = new Set(
      weapon.holdProfile.sockets.map((socket) => socket.role),
    );

    for (const requiredRole of heldObjectCoreSocketRolesByFamily[
      weapon.holdProfile.family
    ]) {
      assert.ok(
        socketRoles.has(requiredRole),
        `${weapon.id} hold profile must include ${requiredRole}.`,
      );
    }
  }
});

test("weapon held-object socket roles resolve to current GLTF node names", async () => {
  const { weaponArchetypeManifest } = await clientLoader.load(
    "/src/assets/config/weapon-archetype-manifest.ts",
  );

  for (const weapon of weaponArchetypeManifest.archetypes) {
    const modelPath = weapon.model.lods[0]?.modelPath;

    assert.ok(modelPath);

    const document = await loadMetaverseAssetDocument(modelPath);
    const nodesByName = collectNamedNodeDescriptors(document);
    const seenSocketRoles = new Set();

    for (const socket of weapon.holdProfile.sockets) {
      assert.equal(
        seenSocketRoles.has(socket.role),
        false,
        `${weapon.id} duplicates held-object socket role ${socket.role}.`,
      );
      seenSocketRoles.add(socket.role);
      assert.ok(
        nodesByName.has(socket.nodeName),
        `${weapon.id} maps ${socket.role} to missing GLTF node ${socket.nodeName}.`,
      );
    }
  }
});

test("pistol proof asset keeps explicit grip, sighting, and holster socket nodes", async () => {
  const document = await loadMetaverseAssetDocument(
    "/models/metaverse/attachments/metaverse-service-pistol.gltf",
  );
  const nodesByName = collectNamedNodeDescriptors(document);

  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_grip_hand_r_socket")?.translation,
    [0.079, -0.048, 0],
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_trigger_marker")?.translation,
    [0.082, -0.061, -0.008],
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_support_marker")?.translation,
    [0.018, -0.137, 0],
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_muzzle_socket")?.translation,
    [0.312, 0.03, 0],
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_ads_camera_anchor")?.translation,
    [0.016, 0.059, 0],
  );
  assert.deepEqual(
    nodesByName.get("metaverse_service_pistol_back_socket")?.translation,
    [0.072, 0.012, 0],
  );
});

test("current proof-slice gltf assets keep embedded payloads and normalized node scale", async () => {
  const manifests = await Promise.all([
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/attachment-model-manifest.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts"),
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest },
  ] = manifests;

  const proofGltfPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest,
  }).filter((assetPath) => assetPath.endsWith(".gltf"));

  const proofDocuments = await Promise.all(
    proofGltfPaths.map(async (assetPath) => [
      assetPath,
      await loadMetaverseAssetDocument(assetPath),
    ]),
  );

  for (const [assetPath, document] of proofDocuments) {
    assert.equal(document.asset?.version, "2.0");

    for (const buffer of document.buffers ?? []) {
      assert.match(
        buffer.uri ?? "",
        /^data:/,
        `${assetPath} should keep embedded proof-slice buffer payloads.`,
      );
    }

    for (const image of document.images ?? []) {
      if ("uri" in image) {
        assert.match(
          image.uri ?? "",
          /^data:/,
          `${assetPath} should keep embedded proof-slice image payloads.`,
        );
      }
    }

    for (const node of document.nodes ?? []) {
      assert.equal(
        "scale" in node,
        false,
        `${assetPath} should not ship node scale transforms.`,
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
    clientLoader.load("/src/assets/config/weapon-module-manifest.ts"),
  ]);
  const [
    { animationClipManifest },
    { attachmentModelManifest },
    { characterModelManifest },
    { environmentPropManifest },
    { weaponModuleManifest },
  ] = manifests;

  const proofGlbPaths = collectMetaverseDeliveryPaths({
    animationClipManifest,
    attachmentModelManifest,
    characterModelManifest,
    environmentPropManifest,
    weaponModuleManifest,
  }).filter((assetPath) => assetPath.endsWith(".glb"));

  const proofDocuments = await Promise.all(
    proofGlbPaths.map(async (assetPath) => [
      assetPath,
      await loadMetaverseAssetDocument(assetPath),
    ]),
  );

  for (const [assetPath, document] of proofDocuments) {
    assert.equal(document.asset?.version, "2.0");

    for (const node of document.nodes ?? []) {
      assert.equal(
        "scale" in node,
        false,
        `${assetPath} should not ship node scale transforms.`,
      );
    }
  }
});

test("dock gltf LODs keep a flush deck support plane", async () => {
  const [highDockDocument, lowDockDocument] = await Promise.all([
    loadMetaverseAssetDocument(
      "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
    ),
    loadMetaverseAssetDocument(
      "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
    ),
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
      minY: (deckAccessor.min?.[1] ?? 0) + translationY,
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
    metaverseBuilderBlockTileEnvironmentAssetId,
    metaverseBuilderStepTileEnvironmentAssetId,
    metaverseBuilderWallTileEnvironmentAssetId,
    metaversePlaygroundRangeBarrierEnvironmentAssetId,
    metaversePlaygroundRangeFloorEnvironmentAssetId,
  } = await clientLoader.load(
    "/src/assets/config/environment-prop-manifest.ts",
  );
  const floorAsset =
    environmentPropManifest.byId[
      metaversePlaygroundRangeFloorEnvironmentAssetId
    ];
  const barrierAsset =
    environmentPropManifest.byId[
      metaversePlaygroundRangeBarrierEnvironmentAssetId
    ];
  const wallAsset =
    environmentPropManifest.byId[metaverseBuilderWallTileEnvironmentAssetId];
  const stepAsset =
    environmentPropManifest.byId[metaverseBuilderStepTileEnvironmentAssetId];
  const blockAsset =
    environmentPropManifest.byId[metaverseBuilderBlockTileEnvironmentAssetId];

  assert.ok(floorAsset);
  assert.ok(barrierAsset);
  assert.ok(wallAsset);
  assert.ok(stepAsset);
  assert.ok(blockAsset);
  assert.equal(floorAsset.placement, "static");
  assert.equal(barrierAsset.placement, "instanced");
  assert.equal(barrierAsset.traversalAffordance, "support");
  assert.equal(floorAsset.editorCatalogVisibility, "visible");
  assert.equal(barrierAsset.editorCatalogVisibility, "hidden");
  assert.equal(wallAsset.editorCatalogVisibility, "visible");
  assert.equal(stepAsset.editorCatalogVisibility, "visible");
  assert.equal(blockAsset.editorCatalogVisibility, "visible");
  assert.equal(wallAsset.traversalAffordance, "support");
  assert.equal(stepAsset.traversalAffordance, "support");
  assert.equal(blockAsset.traversalAffordance, "support");
  assert.deepEqual(wallAsset.physicsColliders, [
    {
      center: { x: 0, y: 2, z: 0 },
      shape: "box",
      size: { x: 4, y: 4, z: 0.5 },
      traversalAffordance: "support",
    },
  ]);
  assert.deepEqual(stepAsset.physicsColliders, [
    {
      center: { x: 0, y: 0.5, z: 0 },
      shape: "box",
      size: { x: 4, y: 1, z: 4 },
      traversalAffordance: "support",
    },
  ]);
  assert.deepEqual(blockAsset.physicsColliders, [
    {
      center: { x: 0, y: 2, z: 0 },
      shape: "box",
      size: { x: 4, y: 4, z: 4 },
      traversalAffordance: "support",
    },
  ]);
  assert.deepEqual(floorAsset.renderModel.lods, [
    {
      kind: "procedural-box",
      materialPreset: "training-range-surface",
      maxDistanceMeters: null,
      size: {
        x: 72,
        y: 0.6,
        z: 82,
      },
      tier: "high",
    },
  ]);
  assert.deepEqual(barrierAsset.renderModel.lods, [
    {
      kind: "procedural-box",
      materialPreset: "training-range-accent",
      maxDistanceMeters: null,
      size: {
        x: 8.5,
        y: 3.2,
        z: 1.4,
      },
      tier: "high",
    },
  ]);
});

test("proof delivery assets keep canonical character sockets, animation vocabulary clips, and authored vehicle seat nodes", async () => {
  const [
    {
      skeletonBoneNamesById,
      skeletonSocketLocalTransformsById,
      skeletonSocketParentById,
      socketIds,
    },
    { characterModelManifest },
    { animationClipManifest },
    { canonicalAnimationClipNamesByVocabulary },
    {
      environmentPropManifest,
      metaverseHubDiveBoatEnvironmentAssetId,
      metaverseHubSkiffEnvironmentAssetId,
    },
  ] = await Promise.all([
    clientLoader.load("/src/assets/types/asset-socket.ts"),
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/config/environment-prop-manifest.ts"),
  ]);

  const skiffAsset =
    environmentPropManifest.byId[metaverseHubSkiffEnvironmentAssetId];
  const diveBoatAsset =
    environmentPropManifest.byId[metaverseHubDiveBoatEnvironmentAssetId];
  const skiffDocument = await loadMetaverseAssetDocument(
    skiffAsset.renderModel.lods[0].modelPath,
  );
  const diveBoatDocument = await loadMetaverseAssetDocument(
    diveBoatAsset.renderModel.lods[0].modelPath,
  );
  const skiffNodeNames = new Set(
    (skiffDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string"),
  );
  const skiffReachableNodeNames = collectReachableNamedNodeNames(skiffDocument);
  const diveBoatNodeNames = new Set(
    (diveBoatDocument.nodes ?? [])
      .map((node) => node.name)
      .filter((name) => typeof name === "string"),
  );
  const diveBoatReachableNodeNames =
    collectReachableNamedNodeNames(diveBoatDocument);

  for (const character of characterModelManifest.characters) {
    const characterDocument = await loadMetaverseAssetDocument(
      character.renderModel.lods[0].modelPath,
    );
    const characterNodeNames = new Set(
      (characterDocument.nodes ?? [])
        .map((node) => node.name)
        .filter((name) => typeof name === "string"),
    );

    for (const boneName of skeletonBoneNamesById[character.skeleton]) {
      assert.ok(
        characterNodeNames.has(boneName),
        `${character.label} is missing canonical bone ${boneName}.`,
      );
    }

    for (const socketId of socketIds) {
      assert.ok(
        character.socketIds.includes(socketId),
        `${character.label} manifest is missing canonical socket ${socketId}.`,
      );
      assert.ok(
        characterNodeNames.has(
          skeletonSocketParentById[character.skeleton][socketId],
        ),
        `${character.label} is missing canonical socket parent ${skeletonSocketParentById[character.skeleton][socketId]}.`,
      );
      assert.ok(
        skeletonSocketLocalTransformsById[character.skeleton][socketId],
        `${character.label} is missing runtime synthesis metadata for ${socketId}.`,
      );
    }

    const clipDescriptorsBySourcePath = new Map();

    for (const clipId of character.animationClipIds) {
      const clipDescriptor = animationClipManifest.byId[clipId];

      assert.ok(clipDescriptor);
      assert.equal(clipDescriptor.targetSkeleton, character.skeleton);
      assert.equal(
        clipDescriptor.clipName,
        canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary],
      );

      const clipDescriptors =
        clipDescriptorsBySourcePath.get(clipDescriptor.sourcePath) ?? [];

      clipDescriptors.push(clipDescriptor);
      clipDescriptorsBySourcePath.set(
        clipDescriptor.sourcePath,
        clipDescriptors,
      );
    }

    for (const [
      clipSourcePath,
      clipDescriptors,
    ] of clipDescriptorsBySourcePath) {
      const animationPackDocument =
        await loadMetaverseAssetDocument(clipSourcePath);
      const animationPackNodeNames = new Set(
        (animationPackDocument.nodes ?? [])
          .map((node) => node.name)
          .filter((name) => typeof name === "string"),
      );
      const animationPackClipNames = new Set(
        (animationPackDocument.animations ?? [])
          .map((animation) => animation.name)
          .filter((name) => typeof name === "string"),
      );

      for (const boneName of skeletonBoneNamesById[character.skeleton]) {
        assert.ok(
          animationPackNodeNames.has(boneName),
          `${clipSourcePath} is missing canonical bone ${boneName}.`,
        );
      }

      for (const clipDescriptor of clipDescriptors) {
        assert.ok(
          animationPackClipNames.has(clipDescriptor.clipName),
          `${clipSourcePath} is missing animation clip ${clipDescriptor.clipName}.`,
        );
      }
    }
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

test("active full-body character render asset stays compatible with the base animation pack rig", async () => {
  const [
    { metaverseActiveFullBodyCharacterAssetId, characterModelManifest },
    { metaverseHumanoidBaseAnimationPackSourcePath },
    {
      skeletonBoneNamesById,
      skeletonBoneParentByNameById,
      skeletonSocketLocalTransformsById,
      skeletonSocketParentById,
      socketIds,
    },
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/asset-socket.ts"),
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];
  const activeAnimationPackPath = metaverseHumanoidBaseAnimationPackSourcePath;
  const activeCharacterDocument = await loadMetaverseAssetDocument(
    activeCharacter.renderModel.lods[0].modelPath,
  );
  const canonicalAnimationPackDocument = await loadMetaverseAssetDocument(
    activeAnimationPackPath,
  );
  const activeNodesByName = collectNamedNodeDescriptors(
    activeCharacterDocument,
  );
  const canonicalPackNodesByName = collectNamedNodeDescriptors(
    canonicalAnimationPackDocument,
  );
  const activeParentNameByNodeName = collectParentNameByNodeName(
    activeCharacterDocument,
  );
  const activeSkeletonBoneNames =
    skeletonBoneNamesById[activeCharacter.skeleton];
  const activeSkeletonBoneParentByName =
    skeletonBoneParentByNameById[activeCharacter.skeleton];
  const activeSkeletonSocketParentById =
    skeletonSocketParentById[activeCharacter.skeleton];
  const activeSkeletonSocketLocalTransformsById =
    skeletonSocketLocalTransformsById[activeCharacter.skeleton];
  const canonicalNames = new Set([...activeSkeletonBoneNames, ...socketIds]);

  for (const boneName of activeSkeletonBoneNames) {
    const activeNode = activeNodesByName.get(boneName);
    const canonicalPackNode = canonicalPackNodesByName.get(boneName);

    assert.ok(
      activeNode,
      `Active character is missing canonical bone ${boneName}.`,
    );
    assert.ok(
      canonicalPackNode,
      `Canonical pack is missing canonical bone ${boneName}.`,
    );
    assert.equal(
      canonicalNames.has(activeParentNameByNodeName.get(boneName))
        ? activeParentNameByNodeName.get(boneName)
        : null,
      activeSkeletonBoneParentByName[boneName],
      `Active character bone ${boneName} must preserve canonical parentage.`,
    );
    assert.deepEqual(
      resolveNamedChildNodeNames(
        activeCharacterDocument,
        activeNode.children,
      ).filter((childName) => canonicalNames.has(childName)),
      resolveNamedChildNodeNames(
        canonicalAnimationPackDocument,
        canonicalPackNode.children,
      ).filter((childName) => canonicalNames.has(childName)),
      `Active character bone ${boneName} must preserve canonical child ordering.`,
    );
    assertNumberArraysClose(
      activeNode.translation,
      canonicalPackNode.translation,
      0.0001,
      `Active character bone ${boneName} translation must stay aligned with the canonical pack`,
    );
    assertQuaternionArraysEquivalent(
      activeNode.rotation,
      canonicalPackNode.rotation,
      0.0001,
      `Active character bone ${boneName} rotation must stay aligned with the canonical pack`,
    );
  }

  for (const socketId of socketIds) {
    const parentBoneName = activeSkeletonSocketParentById[socketId];
    const socketTransform = activeSkeletonSocketLocalTransformsById[socketId];

    assert.ok(
      activeNodesByName.has(parentBoneName),
      `Active character is missing canonical socket parent ${parentBoneName}.`,
    );
    assert.ok(
      socketTransform,
      `Active character socket ${socketId} must have runtime synthesis metadata.`,
    );
    assert.ok(
      Number.isFinite(socketTransform.position.x) &&
        Number.isFinite(socketTransform.position.y) &&
        Number.isFinite(socketTransform.position.z) &&
        Number.isFinite(socketTransform.quaternion.x) &&
        Number.isFinite(socketTransform.quaternion.y) &&
        Number.isFinite(socketTransform.quaternion.z) &&
        Number.isFinite(socketTransform.quaternion.w),
      `Active character socket ${socketId} synthesis transform must stay finite.`,
    );
  }
});
