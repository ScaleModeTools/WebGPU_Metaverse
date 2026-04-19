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

test("metaverse map bundle loader resolves the staging-ground authored slice and its client profiles", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );

  const loadedBundle = loadMetaverseMapBundle("staging-ground");

  assert.equal(loadedBundle.bundle.mapId, "staging-ground");
  assert.equal(loadedBundle.bundle.environmentAssets.length, 6);
  assert.equal(loadedBundle.bundle.launchVariations.length, 2);
  assert.equal(loadedBundle.bundle.playerSpawnNodes.length, 1);
  assert.equal(loadedBundle.bundle.sceneObjects.length, 1);
  assert.equal(loadedBundle.bundle.waterRegions.length, 1);
  assert.equal(loadedBundle.hudProfile?.id, "shell-default-hud");
  assert.equal(loadedBundle.cameraProfile?.id, "shell-default-camera");
  assert.equal(
    loadedBundle.characterPresentationProfile?.id,
    "shell-default-character-presentation"
  );
  assert.equal(
    loadedBundle.environmentPresentationProfile?.id,
    "shell-default-environment-presentation"
  );
});

test("map editor project flattens authored placements and updates selected placement drafts immutably", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorPlayerSpawnDraft,
    addMapEditorSceneObjectDraft,
    addMapEditorWaterRegionDraft,
    addMapEditorLaunchVariationDraft,
    addMapEditorPlacementAtPositionFromAsset,
    addMapEditorPlacementFromAsset,
    createMapEditorProject,
    readSelectedMapEditorLaunchVariation,
    readSelectedMapEditorPlacement,
    selectMapEditorLaunchVariation,
    selectMapEditorPlacement,
    updateMapEditorLaunchVariationDraft,
    updateMapEditorEnvironmentPresentationProfileId,
    updateMapEditorWaterRegionDraft,
    updateMapEditorSceneObjectDraft,
    updateMapEditorPlacement
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const {
    listMapEditorBuildPrimitiveCatalogEntries
  } = await clientLoader.load(
    "/src/engine-tool/build/map-editor-build-primitives.ts"
  );
  const {
    resolveMapEditorBuildGroundPlacementPosition
  } = await clientLoader.load(
    "/src/engine-tool/build/map-editor-build-placement.ts"
  );
  const { environmentPropManifest } = await clientLoader.load(
    "/src/assets/config/environment-prop-manifest.ts"
  );

  const loadedBundle = loadMetaverseMapBundle("staging-ground");
  const initialProject = createMapEditorProject(loadedBundle);
  const initialSelectedPlacement = readSelectedMapEditorPlacement(initialProject);

  assert.equal(initialProject.bundleId, "staging-ground");
  assert.equal(initialProject.placementDrafts.length, 12);
  assert.equal(initialProject.hudProfileId, "shell-default-hud");
  assert.equal(
    initialProject.environmentPresentationProfileId,
    "shell-default-environment-presentation"
  );
  assert.equal(initialProject.launchVariationDrafts.length, 2);
  assert.equal(initialProject.playerSpawnDrafts.length, 1);
  assert.equal(initialProject.sceneObjectDrafts.length, 1);
  assert.equal(initialProject.waterRegionDrafts.length, 1);
  assert.notEqual(initialSelectedPlacement, null);
  assert.equal(
    readSelectedMapEditorLaunchVariation(initialProject)?.variationId,
    "shell-free-roam"
  );
  const buildPrimitiveEntries = listMapEditorBuildPrimitiveCatalogEntries();

  assert.equal(buildPrimitiveEntries.length, 4);
  assert.equal(
    buildPrimitiveEntries.every((entry) =>
      environmentPropManifest.environmentAssets.some(
        (asset) => asset.id === entry.asset.id
      )
    ),
    true
  );

  const nextSelectedPlacementId = initialProject.placementDrafts[1]?.placementId;

  assert.notEqual(nextSelectedPlacementId, undefined);

  const selectedProject = selectMapEditorPlacement(initialProject, nextSelectedPlacementId);
  const primitiveAddedProject = addMapEditorPlacementFromAsset(
    selectedProject,
    buildPrimitiveEntries[0].asset
  );
  const snappedBuildPosition = resolveMapEditorBuildGroundPlacementPosition(
    Object.freeze({
      x: 5.4,
      y: 2.2,
      z: 7.8
    }),
    buildPrimitiveEntries[1]
  );
  const explicitlyPlacedPrimitiveProject = addMapEditorPlacementAtPositionFromAsset(
    selectedProject,
    buildPrimitiveEntries[1].asset,
    snappedBuildPosition
  );
  const addedProject = addMapEditorPlacementFromAsset(
    selectedProject,
    environmentPropManifest.environmentAssets[0]
  );
  const updatedProject = updateMapEditorPlacement(
    addedProject,
    addedProject.selectedPlacementId,
    (placement) => ({
      ...placement,
      materialReferenceId: "shell-floor-grid",
      notes: "Added from the asset browser.",
      position: {
        ...placement.position,
        z: placement.position.z + 3
      }
    })
  );
  const reselectionProject = selectMapEditorPlacement(
    selectedProject,
    nextSelectedPlacementId,
  );
  const movedExistingProject = updateMapEditorPlacement(
    reselectionProject,
    nextSelectedPlacementId,
    (placement) => ({
      ...placement,
      materialReferenceId: "shell-metal-panel",
      notes: "Moved into the first editor draft.",
      position: {
        ...placement.position,
        x: placement.position.x + 1.5
      }
    })
  );
  const updatedWaterProject = updateMapEditorWaterRegionDraft(
    initialProject,
    initialProject.waterRegionDrafts[0].waterRegionId,
    (waterRegionDraft) => ({
      ...waterRegionDraft,
      center: {
        ...waterRegionDraft.center,
        x: waterRegionDraft.center.x + 3
      },
      previewColorHex: "#3aa5c7"
    })
  );
  const updatedSceneObjectProject = updateMapEditorSceneObjectDraft(
    initialProject,
    initialProject.sceneObjectDrafts[0].objectId,
    (sceneObjectDraft) => ({
      ...sceneObjectDraft,
      position: {
        ...sceneObjectDraft.position,
        z: sceneObjectDraft.position.z - 2
      }
    })
  );
  const addedLaunchVariationProject = addMapEditorLaunchVariationDraft(initialProject);
  const updatedEnvironmentPresentationProject =
    updateMapEditorEnvironmentPresentationProfileId(
      initialProject,
      "shell-golden-hour-environment-presentation"
    );
  const addedPlayerSpawnProject = addMapEditorPlayerSpawnDraft(initialProject);
  const addedSceneObjectProject = addMapEditorSceneObjectDraft(initialProject);
  const addedWaterRegionProject = addMapEditorWaterRegionDraft(initialProject);
  const selectedLaunchVariationProject = selectMapEditorLaunchVariation(
    initialProject,
    "duck-hunt-preview"
  );
  const updatedLaunchVariationProject = updateMapEditorLaunchVariationDraft(
    selectedLaunchVariationProject,
    "duck-hunt-preview",
    (launchVariationDraft) => ({
      ...launchVariationDraft,
      gameplayVariationId: "team-slayer",
      label: "Team Slayer On Gladiation",
      vehicleLayoutId: "gladiation-heavy-vehicles",
      weaponLayoutId: "gladiation-rifle-starts"
    })
  );
  const updatedPlacement = readSelectedMapEditorPlacement(updatedProject);
  const movedExistingPlacement =
    readSelectedMapEditorPlacement(movedExistingProject);
  const updatedLaunchVariation =
    readSelectedMapEditorLaunchVariation(updatedLaunchVariationProject);

  assert.equal(selectedProject.selectedPlacementId, nextSelectedPlacementId);
  assert.equal(
    primitiveAddedProject.placementDrafts[primitiveAddedProject.placementDrafts.length - 1]
      .position.x,
    selectedProject.placementDrafts[1].position.x + 4
  );
  assert.equal(
    primitiveAddedProject.placementDrafts[primitiveAddedProject.placementDrafts.length - 1]
      .position.z,
    selectedProject.placementDrafts[1].position.z
  );
  assert.deepEqual(snappedBuildPosition, {
    x: 4,
    y: 0,
    z: 8
  });
  assert.deepEqual(
    explicitlyPlacedPrimitiveProject.placementDrafts[
      explicitlyPlacedPrimitiveProject.placementDrafts.length - 1
    ].position,
    snappedBuildPosition
  );
  assert.equal(addedProject.placementDrafts.length, initialProject.placementDrafts.length + 1);
  assert.notEqual(updatedPlacement, null);
  assert.equal(updatedPlacement.materialReferenceId, "shell-floor-grid");
  assert.equal(updatedPlacement.notes, "Added from the asset browser.");
  assert.equal(updatedPlacement.assetId, environmentPropManifest.environmentAssets[0].id);
  assert.equal(
    updatedPlacement.position.z,
    addedProject.placementDrafts[addedProject.placementDrafts.length - 1].position.z + 3
  );
  assert.notEqual(movedExistingPlacement, null);
  assert.equal(movedExistingPlacement.materialReferenceId, "shell-metal-panel");
  assert.equal(movedExistingPlacement.notes, "Moved into the first editor draft.");
  assert.equal(
    movedExistingPlacement.position.x,
    initialProject.placementDrafts[1].position.x + 1.5
  );
  assert.equal(
    initialProject.placementDrafts[1].materialReferenceId,
    null
  );
  assert.equal(initialProject.placementDrafts[1].notes, "");
  assert.equal(
    updatedWaterProject.waterRegionDrafts[0].center.x,
    initialProject.waterRegionDrafts[0].center.x + 3
  );
  assert.equal(
    updatedWaterProject.waterRegionDrafts[0].previewColorHex,
    "#3aa5c7"
  );
  assert.equal(
    updatedSceneObjectProject.sceneObjectDrafts[0].position.z,
    initialProject.sceneObjectDrafts[0].position.z - 2
  );
  assert.equal(
    updatedEnvironmentPresentationProject.environmentPresentationProfileId,
    "shell-golden-hour-environment-presentation"
  );
  assert.equal(
    addedLaunchVariationProject.launchVariationDrafts.length,
    initialProject.launchVariationDrafts.length + 1
  );
  assert.equal(
    addedPlayerSpawnProject.playerSpawnDrafts.length,
    initialProject.playerSpawnDrafts.length + 1
  );
  assert.equal(
    addedPlayerSpawnProject.playerSpawnDrafts[
      addedPlayerSpawnProject.playerSpawnDrafts.length - 1
    ].label,
    "Player Spawn 2"
  );
  assert.equal(
    addedSceneObjectProject.sceneObjectDrafts.length,
    initialProject.sceneObjectDrafts.length + 1
  );
  assert.equal(
    addedSceneObjectProject.sceneObjectDrafts[
      addedSceneObjectProject.sceneObjectDrafts.length - 1
    ].launchTarget?.experienceId,
    "duck-hunt"
  );
  assert.equal(
    addedWaterRegionProject.waterRegionDrafts.length,
    initialProject.waterRegionDrafts.length + 1
  );
  assert.equal(
    addedWaterRegionProject.waterRegionDrafts[
      addedWaterRegionProject.waterRegionDrafts.length - 1
    ].size.x,
    24
  );
  assert.equal(
    addedLaunchVariationProject.selectedLaunchVariationId,
    addedLaunchVariationProject.launchVariationDrafts[
      addedLaunchVariationProject.launchVariationDrafts.length - 1
    ].variationId
  );
  assert.notEqual(updatedLaunchVariation, null);
  assert.equal(updatedLaunchVariation.label, "Team Slayer On Gladiation");
  assert.equal(updatedLaunchVariation.gameplayVariationId, "team-slayer");
  assert.equal(
    updatedLaunchVariation.weaponLayoutId,
    "gladiation-rifle-starts"
  );
  assert.equal(
    updatedLaunchVariation.vehicleLayoutId,
    "gladiation-heavy-vehicles"
  );
});

test("map editor project save/load persists authored launch variations and environment presentation through project storage", async () => {
  const {
    createMapEditorProject,
    selectMapEditorLaunchVariation,
    updateMapEditorEnvironmentPresentationProfileId
  } =
    await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const {
    loadStoredMapEditorProject,
    saveMapEditorProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-storage.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );

  const storageValues = new Map();
  const storage = {
    getItem(key) {
      return storageValues.get(key) ?? null;
    },
    removeItem(key) {
      storageValues.delete(key);
    },
    setItem(key, value) {
      storageValues.set(key, value);
    }
  };
  const loadedBundle = loadMetaverseMapBundle("staging-ground");
  const project = updateMapEditorEnvironmentPresentationProfileId(
    selectMapEditorLaunchVariation(
      createMapEditorProject(loadedBundle),
      "duck-hunt-preview"
    ),
    "shell-golden-hour-environment-presentation"
  );

  saveMapEditorProject(storage, project);

  const restoredProject = loadStoredMapEditorProject(storage, "staging-ground");

  assert.notEqual(restoredProject, null);
  assert.equal(restoredProject.bundleId, "staging-ground");
  assert.equal(restoredProject.selectedLaunchVariationId, "duck-hunt-preview");
  assert.equal(
    restoredProject.environmentPresentationProfileId,
    "shell-golden-hour-environment-presentation"
  );
  assert.equal(restoredProject.launchVariationDrafts.length, 2);
});

test("metaverse environment proof loads from the bundle-backed staging-ground map slice", async () => {
  const { loadMetaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/metaverse/world/proof/index.ts"
  );
  const metaverseEnvironmentProofConfig =
    loadMetaverseEnvironmentProofConfig("staging-ground");

  const dynamicAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.placement === "dynamic"
  );

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 6);
  assert.notEqual(dynamicAsset, undefined);
  assert.equal(
    metaverseEnvironmentProofConfig.assets.some(
      (asset) => asset.placement === "static"
    ),
    true
  );
  assert.equal(
    metaverseEnvironmentProofConfig.assets.some(
      (asset) => asset.placement === "instanced"
    ),
    true
  );
});

test("map editor validate-and-run exports a bundle-backed preview through the runtime registry", async () => {
  const { createMapEditorProject } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { validateAndRegisterMapEditorPreviewBundle } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-run-preview.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );

  const loadedBundle = loadMetaverseMapBundle("staging-ground");
  const project = createMapEditorProject(loadedBundle);
  const fetchCalls = [];
  const previewResult = await validateAndRegisterMapEditorPreviewBundle(project, {
    async fetch(url, init = {}) {
      fetchCalls.push({
        init,
        url
      });

      return {
        async json() {
          return {
            status: "registered"
          };
        },
        ok: true
      };
    }
  });
  const previewBundle = loadMetaverseMapBundle(previewResult.launchSelection.bundleId);

  assert.equal(previewResult.validation.valid, true);
  assert.equal(previewResult.registrationError, null);
  assert.match(
    previewResult.launchSelection?.bundleId ?? "",
    /^staging-ground:preview:/
  );
  assert.equal(previewResult.launchSelection?.variationId, "shell-free-roam");
  assert.equal(previewResult.launchSelection?.sourceBundleId, "staging-ground");
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/metaverse\/world\/preview-bundles$/);
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(previewBundle.bundle.sceneObjects.length, 1);
  assert.equal(previewBundle.bundle.launchVariations.length, 2);
  assert.equal(
    previewBundle.bundle.sceneObjects[0]?.capabilities[0]?.kind,
    "launch-target"
  );
});

test("map editor preview registration pushes authored water regions into the active metaverse runtime config", async () => {
  const {
    createMapEditorProject,
    updateMapEditorEnvironmentPresentationProfileId,
    updateMapEditorGameplayProfileId,
    updateMapEditorWaterRegionDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { validateAndRegisterMapEditorPreviewBundle } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-run-preview.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const { createMetaverseRuntimeConfig } = await clientLoader.load(
    "/src/metaverse/config/metaverse-runtime.ts"
  );

  const project = updateMapEditorEnvironmentPresentationProfileId(
    updateMapEditorGameplayProfileId(
      updateMapEditorWaterRegionDraft(
        createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
        "shell-water-region-1",
        (waterRegionDraft) => ({
          ...waterRegionDraft,
          center: {
            ...waterRegionDraft.center,
            x: waterRegionDraft.center.x + 7
          },
          size: {
            ...waterRegionDraft.size,
            z: waterRegionDraft.size.z + 10
          }
        })
      ),
      "shell-arcade-gameplay"
    ),
    "shell-golden-hour-environment-presentation"
  );

  const previewResult = await validateAndRegisterMapEditorPreviewBundle(project, {
    async fetch() {
      return {
        async json() {
          return {
            status: "registered"
          };
        },
        ok: true
      };
    }
  });
  const runtimeConfig = createMetaverseRuntimeConfig(
    previewResult.launchSelection.bundleId
  );

  assert.equal(previewResult.validation.valid, true);
  assert.equal(previewResult.registrationError, null);
  assert.equal(previewResult.launchSelection?.sourceBundleId, "staging-ground");
  assert.equal(
    loadMetaverseMapBundle(previewResult.launchSelection.bundleId).gameplayProfile.id,
    "shell-arcade-gameplay"
  );
  assert.equal(runtimeConfig.waterRegionSnapshots.length, 1);
  assert.equal(
    runtimeConfig.waterRegionSnapshots[0]?.translation.x,
    project.waterRegionDrafts[0]?.center.x
  );
  assert.equal(
    runtimeConfig.waterRegionSnapshots[0]?.halfExtents.z,
    project.waterRegionDrafts[0]?.size.z * 0.5
  );
  assert.deepEqual(runtimeConfig.environment.fogColor, [0.78, 0.6, 0.48]);
  assert.deepEqual(runtimeConfig.ocean.nearColor, [0.34, 0.41, 0.58]);
  assert.equal(runtimeConfig.groundedBody.baseSpeedUnitsPerSecond, 9.1);
  assert.equal(
    runtimeConfig.traversal.groundedJumpSupportVerticalSpeedTolerance,
    0.65
  );
  assert.equal(runtimeConfig.swim.baseSpeedUnitsPerSecond, 7.1);
  assert.equal(runtimeConfig.movement.worldRadius, 132);
});
