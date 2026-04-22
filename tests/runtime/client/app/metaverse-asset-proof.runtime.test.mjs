import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("metaverse asset proof resolves a socket-compatible attachment config from manifests", async () => {
  const {
    metaverseAttachmentProofConfig,
    metaverseCharacterProofConfig
  } = await clientLoader.load("/src/metaverse/world/proof/index.ts");

  assert.equal(
    metaverseAttachmentProofConfig.attachmentId,
    "metaverse-service-pistol-v2"
  );
  assert.equal(metaverseAttachmentProofConfig.heldMount.socketName, "grip_r_socket");
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.offHandSupportPointId,
    "pistol-support-left"
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.attachmentSocketNodeName,
    "metaverse_service_pistol_grip_hand_r_socket"
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.adsCameraAnchorNodeName,
    "metaverse_service_pistol_ads_camera_anchor"
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.forwardReferenceNodeName,
    "metaverse_service_pistol_forward_marker"
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.triggerMarkerNodeName,
    "metaverse_service_pistol_trigger_marker"
  );
  assert.equal(
    metaverseAttachmentProofConfig.heldMount.upReferenceNodeName,
    "metaverse_service_pistol_up_marker"
  );
  assert.deepEqual(metaverseAttachmentProofConfig.mountedHolsterMount, {
    attachmentSocketNodeName: "metaverse_service_pistol_back_socket",
    socketName: "back_socket"
  });
  assert.deepEqual(
    metaverseAttachmentProofConfig.modules.map((module) => module.moduleId),
    [
      "metaverse-low-profile-front-sight-v1",
      "metaverse-notch-rear-sight-v1",
      "metaverse-pistol-compensator-v1"
    ]
  );
  assert.deepEqual(metaverseAttachmentProofConfig.supportPoints, [
    {
      authoringNodeName: "metaverse_service_pistol_support_grip_marker",
      localPosition: { x: 0.04, y: -0.01, z: 0.025 },
      supportPointId: "pistol-support-left"
    }
  ]);
  assert.equal(metaverseCharacterProofConfig.skeletonId, "humanoid_v2");
});

test("metaverse asset proof resolves the active full-body humanoid character from manifests", async () => {
  const [
    {
      characterModelManifest,
      mesh2motionHumanoidCharacterAssetId,
      metaverseActiveFullBodyCharacterAssetId
    },
    {
      animationClipManifest,
      mesh2motionHumanoidCanonicalAnimationPackSourcePath
    },
    { animationVocabularyIds },
    { metaverseCharacterProofConfig }
  ] = await Promise.all([
    clientLoader.load("/src/assets/config/character-model-manifest.ts"),
    clientLoader.load("/src/assets/config/animation-clip-manifest.ts"),
    clientLoader.load("/src/assets/types/animation-clip-manifest.ts"),
    clientLoader.load("/src/metaverse/world/proof/index.ts")
  ]);

  const activeCharacter =
    characterModelManifest.byId[metaverseActiveFullBodyCharacterAssetId];

  assert.ok(activeCharacter);
  assert.equal(activeCharacter.id, mesh2motionHumanoidCharacterAssetId);
  assert.equal(activeCharacter.skeleton, "humanoid_v2");
  assert.ok(activeCharacter.presentationModes.includes("full-body"));
  assert.equal(
    metaverseCharacterProofConfig.characterId,
    metaverseActiveFullBodyCharacterAssetId
  );
  assert.equal(
    metaverseCharacterProofConfig.modelPath,
    activeCharacter.renderModel.lods[0]?.modelPath
  );
  assert.deepEqual(
    metaverseCharacterProofConfig.animationClips.map((clip) => clip.vocabulary),
    [...animationVocabularyIds]
  );
  assert.deepEqual(
    new Set(metaverseCharacterProofConfig.animationClips.map((clip) => clip.sourcePath)),
    new Set([mesh2motionHumanoidCanonicalAnimationPackSourcePath])
  );

  for (const clipId of activeCharacter.animationClipIds) {
    const clipDescriptor = animationClipManifest.byId[clipId];

    assert.ok(clipDescriptor);
    assert.equal(clipDescriptor.targetSkeleton, activeCharacter.skeleton);
  }
});

test("metaverse asset proof resolves static, instanced, and dynamic environment config from manifests", async () => {
  const { metaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/metaverse/world/proof/index.ts"
  );

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 6);

  const floorAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-playground-range-floor-v1"
  );
  const barrierAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-playground-range-barrier-v1"
  );
  const dockAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dock-v1"
  );
  const pushableCrateAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-pushable-crate-v1"
  );
  const skiffAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-skiff-v1"
  );
  const diveBoatAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dive-boat-v1"
  );

  assert.ok(floorAsset);
  assert.equal(floorAsset.collisionPath, null);
  assert.equal(floorAsset.placement, "static");
  assert.equal(floorAsset.traversalAffordance, "support");
  assert.equal(floorAsset.lods.length, 1);
  assert.equal(floorAsset.placements.length, 1);
  assert.equal(floorAsset.physicsColliders?.length, 1);
  assert.deepEqual(floorAsset.lods[0], {
    kind: "procedural-box",
    materialPreset: "training-range-surface",
    maxDistanceMeters: null,
    size: {
      x: 72,
      y: 0.6,
      z: 82
    },
    tier: "high"
  });

  assert.ok(barrierAsset);
  assert.equal(barrierAsset.collisionPath, null);
  assert.equal(barrierAsset.placement, "instanced");
  assert.equal(barrierAsset.traversalAffordance, "blocker");
  assert.equal(barrierAsset.lods.length, 1);
  assert.equal(barrierAsset.placements.length, 6);
  assert.equal(barrierAsset.physicsColliders?.length, 1);
  assert.deepEqual(barrierAsset.lods[0], {
    kind: "procedural-box",
    materialPreset: "training-range-accent",
    maxDistanceMeters: null,
    size: {
      x: 8.5,
      y: 3.2,
      z: 1.4
    },
    tier: "high"
  });

  assert.ok(dockAsset);
  assert.equal(
    dockAsset.collisionPath,
    "/models/metaverse/environment/metaverse-hub-dock-high.gltf"
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
    lockRotations: true
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
  assert.equal(diveBoatAsset.entries?.[1]?.entryNodeName, "stern_starboard_entry");
  assert.equal(diveBoatAsset.physicsColliders, null);
  assert.equal(diveBoatAsset.seats?.length, 7);
  assert.equal(diveBoatAsset.seats?.[0]?.seatNodeName, "helm_seat");
  assert.equal(diveBoatAsset.orientation?.forwardModelYawRadians, Math.PI * 0.5);
  assert.equal(diveBoatAsset.collider?.shape, "box");
});
