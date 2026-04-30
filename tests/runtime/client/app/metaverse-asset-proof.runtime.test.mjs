import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../load-client-module.mjs";

let clientLoader;

async function collectTypeScriptSourceFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const sourceFiles = [];

  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      sourceFiles.push(...await collectTypeScriptSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      sourceFiles.push(entryPath);
    }
  }

  return sourceFiles;
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("metaverse asset proof resolves a socket-compatible attachment config from manifests", async () => {
  const {
    metaverseAttachmentProofConfig,
    metaverseAttachmentProofConfigs,
    metaverseCharacterProofConfig
  } = await clientLoader.load("/src/metaverse/world/proof/index.ts");

  assert.equal(
    metaverseAttachmentProofConfig.attachmentId,
    "metaverse-service-pistol-v2",
  );
  assert.equal(metaverseAttachmentProofConfigs[0], metaverseAttachmentProofConfig);
  assert.deepEqual(
    metaverseAttachmentProofConfigs.map((attachmentProofConfig) => attachmentProofConfig.attachmentId),
    [
      "metaverse-service-pistol-v2",
      "metaverse-battle-rifle-v1",
      "metaverse-rocket-launcher-v1"
    ]
  );
  assert.equal(metaverseAttachmentProofConfig.holdProfile.family, "sidearm");
  assert.equal(
    metaverseAttachmentProofConfig.holdProfile.poseProfileId,
    "sidearm.one_hand_optional_support",
  );
  assert.equal(
    metaverseAttachmentProofConfig.holdProfile.offhandPolicy,
    "optional_support_palm",
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.socketName,
    "grip_r_socket",
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.attachmentSocketRole,
    "grip.primary",
  );
  assert.deepEqual(metaverseAttachmentProofConfig.mountedHolsterMount, {
    attachmentSocketRole: "carry.back",
    socketName: "back_socket",
  });
  assert.deepEqual(
    metaverseAttachmentProofConfig.modules.map((module) => module.moduleId),
    [
      "metaverse-low-profile-front-sight-v1",
      "metaverse-notch-rear-sight-v1",
      "metaverse-pistol-compensator-v1",
    ],
  );
  assert.deepEqual(
    metaverseAttachmentProofConfig.modules.map((module) => module.socketRole),
    ["sight.front", "sight.rear", "projectile.muzzle"],
  );
  const battleRifleProofConfig = metaverseAttachmentProofConfigs.find(
    (attachmentProofConfig) =>
      attachmentProofConfig.attachmentId === "metaverse-battle-rifle-v1"
  );

  assert.ok(battleRifleProofConfig);
  assert.equal(battleRifleProofConfig.holdProfile.family, "long_gun");
  assert.equal(
    battleRifleProofConfig.holdProfile.poseProfileId,
    "long_gun.two_hand_shoulder"
  );
  assert.equal(
    battleRifleProofConfig.holdProfile.offhandPolicy,
    "required_support_grip"
  );
  assert.ok(
    battleRifleProofConfig.holdProfile.sockets.some(
      (socket) => socket.role === "grip.secondary",
    ),
  );
  assert.equal(
    battleRifleProofConfig.holdProfile.sockets.find(
      (socket) => socket.role === "grip.secondary",
    )?.nodeName,
    "metaverse_battle_rifle_grip_module_socket",
  );
  assert.ok(
    battleRifleProofConfig.holdProfile.sockets.some(
      (socket) => socket.role === "projectile.muzzle",
    ),
  );
  const rocketLauncherProofConfig = metaverseAttachmentProofConfigs.find(
    (attachmentProofConfig) =>
      attachmentProofConfig.attachmentId === "metaverse-rocket-launcher-v1"
  );

  assert.ok(rocketLauncherProofConfig);
  assert.equal(rocketLauncherProofConfig.holdProfile.family, "shoulder_heavy");
  assert.equal(
    rocketLauncherProofConfig.holdProfile.poseProfileId,
    "shoulder_heavy.two_hand_shouldered"
  );
  assert.equal(
    rocketLauncherProofConfig.holdProfile.offhandPolicy,
    "required_support_grip"
  );
  assert.equal(
    rocketLauncherProofConfig.heldMount.attachmentSocketRole,
    "grip.primary"
  );
  assert.ok(
    rocketLauncherProofConfig.holdProfile.sockets.some(
      (socket) => socket.role === "grip.secondary",
    ),
  );
  assert.ok(
    rocketLauncherProofConfig.holdProfile.sockets.some(
      (socket) => socket.role === "projectile.exhaust",
    ),
  );
  assert.deepEqual(
    rocketLauncherProofConfig.holdProfile.bodyContactRoles ?? [],
    [],
  );
  assert.deepEqual(
    rocketLauncherProofConfig.holdProfile.hazardRoles,
    ["hazard.backblast_cone"],
  );
  assert.equal(metaverseCharacterProofConfig.skeletonId, "humanoid_v2");
});

test("metaverse product source does not reference removed held-object socket compatibility fields", async () => {
  const sourceRoot = join(process.cwd(), "client", "src");
  const forbiddenRuntimeTerms = [
    "supportMarkerNodeName",
    "triggerMarkerNodeName",
    "adsCameraAnchorNodeName",
    "forwardReferenceNodeName",
    "upReferenceNodeName",
    "offHandSupportPointId",
    "supportPoints",
    "attachmentSocketNodeName",
    "socketNodeName",
    "humanoidV2Pistol",
    "PistolPose",
    "humanoid-v2-pistol",
    "WeaponNodeDescriptor",
    "WeaponSupportPointDescriptor",
    "AttachmentSupportPointDescriptor",
    "AttachmentOffHandSupportPointIdBySocketId"
  ];
  const violations = [];

  for (const sourceFile of await collectTypeScriptSourceFiles(sourceRoot)) {
    const sourceText = await readFile(sourceFile, "utf8");

    for (const forbiddenTerm of forbiddenRuntimeTerms) {
      if (sourceText.includes(forbiddenTerm)) {
        violations.push(`${relative(process.cwd(), sourceFile)}: ${forbiddenTerm}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("metaverse asset proof resolves the active full-body humanoid character from manifests", async () => {
  const [
    {
      characterModelManifest,
      mesh2motionHumanoidCharacterAssetId,
      metaverseActiveFullBodyCharacterAssetId,
    },
    { animationClipManifest, metaverseHumanoidBaseAnimationPackSourcePath },
    { animationVocabularyIds },
    { metaverseCharacterProofConfig },
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts"),
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeCharacter);
  assert.equal(activeCharacter.id, mesh2motionHumanoidCharacterAssetId);
  assert.equal(activeCharacter.skeleton, "humanoid_v2");
  assert.ok(activeCharacter.presentationModes.includes("full-body"));
  assert.equal(
    metaverseCharacterProofConfig.characterId,
    metaverseActiveFullBodyCharacterAssetId,
  );
  assert.equal(
    metaverseCharacterProofConfig.modelPath,
    activeCharacter.renderModel.lods[0]?.modelPath,
  );
  assert.deepEqual(
    metaverseCharacterProofConfig.animationClips.map((clip) => clip.vocabulary),
    [...animationVocabularyIds],
  );
  assert.deepEqual(
    new Set(
      metaverseCharacterProofConfig.animationClips.map(
        (clip) => clip.sourcePath,
      ),
    ),
    new Set([metaverseHumanoidBaseAnimationPackSourcePath]),
  );

  for (const clipId of activeCharacter.animationClipIds) {
    const clipDescriptor = animationClipManifest.byId[clipId];

    assert.ok(clipDescriptor);
    assert.equal(clipDescriptor.targetSkeleton, activeCharacter.skeleton);
  }
});

test("metaverse asset proof resolves the shipped static and dynamic environment config from manifests", async () => {
  const { metaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/metaverse/world/proof/index.ts",
  );

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 5);

  const builderFloorAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-builder-floor-tile-v1",
  );
  const barrierAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) =>
      asset.environmentAssetId === "metaverse-playground-range-barrier-v1",
  );
  const dockAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dock-v1",
  );
  const pushableCrateAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-pushable-crate-v1",
  );
  const skiffAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-skiff-v1",
  );
  const diveBoatAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dive-boat-v1",
  );

  assert.ok(builderFloorAsset);
  assert.equal(builderFloorAsset.collisionPath, null);
  assert.equal(builderFloorAsset.placement, "instanced");
  assert.equal(builderFloorAsset.traversalAffordance, "support");
  assert.equal(builderFloorAsset.lods.length, 1);
  assert.equal(builderFloorAsset.placements.length, 1);
  assert.equal(builderFloorAsset.physicsColliders?.length, 1);
  assert.deepEqual(builderFloorAsset.lods[0], {
    kind: "procedural-box",
    materialPreset: "training-range-surface",
    maxDistanceMeters: null,
    size: {
      x: 4,
      y: 0.5,
      z: 4,
    },
    tier: "high",
  });

  assert.equal(barrierAsset, undefined);

  assert.ok(dockAsset);
  assert.equal(
    dockAsset.collisionPath,
    "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
  );
  assert.equal(dockAsset.placement, "static");
  assert.equal(dockAsset.traversalAffordance, "support");
  assert.ok(dockAsset.lods.length >= 2);
  assert.equal(dockAsset.placements.length, 2);
  assert.equal(dockAsset.placements[0]?.position.y, 0.26);
  assert.equal(dockAsset.placements[1]?.position.y, 0.26);
  assert.equal(dockAsset.physicsColliders, null);

  assert.ok(pushableCrateAsset);
  assert.equal(pushableCrateAsset.collisionPath, null);
  assert.equal(pushableCrateAsset.placement, "dynamic");
  assert.equal(pushableCrateAsset.traversalAffordance, "blocker");
  assert.equal(pushableCrateAsset.lods.length, 1);
  assert.equal(pushableCrateAsset.placements.length, 1);
  assert.deepEqual(pushableCrateAsset.dynamicBody, {
    additionalMass: 12,
    angularDamping: 10,
    gravityScale: 1,
    kind: "dynamic-rigid-body",
    linearDamping: 4.5,
    lockRotations: true,
  });
  assert.equal(pushableCrateAsset.entries, null);
  assert.deepEqual(pushableCrateAsset.physicsColliders, []);
  assert.equal(pushableCrateAsset.seats, null);
  assert.equal(pushableCrateAsset.collider?.shape, "box");

  assert.ok(skiffAsset);
  assert.equal(skiffAsset.placement, "dynamic");
  assert.equal(skiffAsset.traversalAffordance, "mount");
  assert.equal(skiffAsset.lods.length, 1);
  assert.equal(skiffAsset.placements.length, 1);
  assert.equal(skiffAsset.entries?.length, 1);
  assert.equal(skiffAsset.entries?.[0]?.entryNodeName, "deck_entry");
  assert.equal(skiffAsset.physicsColliders, null);
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
  assert.equal(
    diveBoatAsset.entries?.[1]?.entryNodeName,
    "stern_starboard_entry",
  );
  assert.equal(diveBoatAsset.physicsColliders, null);
  assert.equal(diveBoatAsset.seats?.length, 7);
  assert.equal(diveBoatAsset.seats?.[0]?.seatNodeName, "helm_seat");
  assert.equal(
    diveBoatAsset.orientation?.forwardModelYawRadians,
    Math.PI * 0.5,
  );
  assert.equal(diveBoatAsset.collider?.shape, "box");
});
