import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  resolveMetaversePlayerTeamId,
  stagingGroundMapBundle
} from "@webgpu-metaverse/shared";

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
  assert.equal(loadedBundle.bundle.environmentAssets.length, 5);
  assert.equal(loadedBundle.bundle.launchVariations.length, 3);
  assert.ok(loadedBundle.bundle.semanticWorld.regions.length > 0);
  assert.ok(loadedBundle.bundle.compiledWorld.chunks.length > 0);
  assert.equal(loadedBundle.bundle.playerSpawnNodes.length, 5);
  assert.equal(loadedBundle.bundle.playerSpawnNodes[0]?.teamId, "neutral");
  assert.equal(
    loadedBundle.bundle.playerSpawnNodes.filter((spawnNode) => spawnNode.teamId === "blue")
      .length,
    2
  );
  assert.equal(
    loadedBundle.bundle.playerSpawnNodes.filter((spawnNode) => spawnNode.teamId === "red")
      .length,
    2
  );
  assert.equal(
    loadedBundle.bundle.playerSpawnSelection.enemyAvoidanceRadiusMeters,
    18
  );
  assert.equal(
    loadedBundle.bundle.playerSpawnSelection.homeTeamBiasMeters,
    12
  );
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
  assert.equal(loadedBundle.environmentPresentation.environment.fogEnabled, false);
  assert.equal(loadedBundle.environmentPresentation.environment.turbidity, 9.5);
});

test("map editor blank template bundle loads without authored starter content", async () => {
  const {
    createLoadedMapEditorBlankTemplateBundle,
    mapEditorBlankTemplateBundleId
  } = await clientLoader.load(
    "/src/engine-tool/config/map-editor-blank-template-bundle.ts"
  );
  const { createMapEditorProject } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );

  const loadedBundle = createLoadedMapEditorBlankTemplateBundle();
  const project = createMapEditorProject(loadedBundle);

  assert.equal(loadedBundle.bundle.mapId, mapEditorBlankTemplateBundleId);
  assert.equal(loadedBundle.bundle.label, "Blank Template");
  assert.equal(loadedBundle.bundle.environmentAssets.length, 0);
  assert.equal(loadedBundle.bundle.launchVariations.length, 0);
  assert.equal(loadedBundle.bundle.playerSpawnNodes.length, 0);
  assert.equal(loadedBundle.bundle.sceneObjects.length, 0);
  assert.equal(loadedBundle.bundle.waterRegions.length, 0);
  assert.equal(project.launchVariationDrafts.length, 0);
  assert.equal(project.gameplayVolumeDrafts.length, 1);
  assert.equal(project.gameplayVolumeDrafts[0]?.label, "Kill Floor");
  assert.equal(project.gameplayVolumeDrafts[0]?.volumeKind, "kill-floor");
  assert.deepEqual(project.gameplayVolumeDrafts[0]?.center, {
    x: 0,
    y: -5,
    z: 0
  });
  assert.deepEqual(project.gameplayVolumeDrafts[0]?.size, {
    x: 480,
    y: 0.5,
    z: 480
  });
  assert.equal(project.playerSpawnDrafts.length, 0);
  assert.equal(project.placementDrafts.length, 0);
  assert.equal(project.sceneObjectDrafts.length, 0);
  assert.equal(project.surfaceDrafts.length, 0);
  assert.equal(project.waterRegionDrafts.length, 0);
  assert.equal(project.selectedEntityRef, null);
  assert.equal(project.selectedLaunchVariationId, null);
});

test("map editor helper grid updates resize the managed kill floor footprint", async () => {
  const {
    createLoadedMapEditorBlankTemplateBundle
  } = await clientLoader.load(
    "/src/engine-tool/config/map-editor-blank-template-bundle.ts"
  );
  const {
    createMapEditorProject,
    updateMapEditorProjectSettings
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const project = updateMapEditorProjectSettings(
    createMapEditorProject(createLoadedMapEditorBlankTemplateBundle()),
    () => ({
      helperGridSizeMeters: 320
    })
  );

  assert.deepEqual(project.gameplayVolumeDrafts[0]?.size, {
    x: 640,
    y: 0.5,
    z: 640
  });
  assert.deepEqual(project.gameplayVolumeDrafts[0]?.center, {
    x: 0,
    y: -5,
    z: 0
  });
});

test("metaverse runtime config chooses the authored home-team spawn for the local player lane", async () => {
  const {
    clearMetaverseWorldBundlePreviewEntry,
    registerMetaverseWorldBundlePreviewEntry
  } = await clientLoader.load("/src/metaverse/world/bundle-registry/index.ts");
  const { createMetaverseRuntimeConfig } = await clientLoader.load(
    "/src/metaverse/config/metaverse-runtime.ts"
  );
  const previewBundleId = "client-team-spawn-runtime-config-test";

  const requirePlayerIdForTeam = (prefix, teamId) => {
    for (let index = 1; index < 200; index += 1) {
      const playerId = createMetaversePlayerId(`${prefix}-${index}`);

      if (playerId !== null && resolveMetaversePlayerTeamId(playerId) === teamId) {
        return playerId;
      }
    }

    throw new Error(`Unable to resolve player id for team ${teamId}.`);
  };

  registerMetaverseWorldBundlePreviewEntry({
    bundle: Object.freeze({
      ...stagingGroundMapBundle,
      label: "Client Team Spawn Preview",
      mapId: previewBundleId,
      playerSpawnNodes: Object.freeze([
        Object.freeze({
          label: "Blue Base",
          position: Object.freeze({
            x: -24,
            y: 0,
            z: 0
          }),
          spawnId: "blue-base",
          teamId: "blue",
          yawRadians: 0
        }),
        Object.freeze({
          label: "Red Base",
          position: Object.freeze({
            x: 24,
            y: 0,
            z: 0
          }),
          spawnId: "red-base",
          teamId: "red",
          yawRadians: Math.PI
        })
      ]),
      playerSpawnSelection: Object.freeze({
        enemyAvoidanceRadiusMeters: 12,
        homeTeamBiasMeters: 8
      })
    }),
    bundleId: previewBundleId,
    label: "Client Team Spawn Preview",
    mapEditorProjectSettings: null,
    sourceBundleId: "staging-ground"
  });

  try {
    const blueConfig = createMetaverseRuntimeConfig(
      previewBundleId,
      requirePlayerIdForTeam("client-blue", "blue"),
      "blue"
    );
    const redConfig = createMetaverseRuntimeConfig(
      previewBundleId,
      requirePlayerIdForTeam("client-red", "red"),
      "red"
    );

    assert.equal(blueConfig.groundedBody.spawnPosition.x, -24);
    assert.equal(blueConfig.camera.initialYawRadians, 0);
    assert.equal(redConfig.groundedBody.spawnPosition.x, 24);
    assert.equal(redConfig.camera.initialYawRadians, Math.PI);
  } finally {
    clearMetaverseWorldBundlePreviewEntry(previewBundleId);
  }
});

test("metaverse world bundle registration posts the selected runtime bundle and source bundle id through the shared authority sync path", async () => {
  const { registerMetaverseWorldBundleOnServer } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/index.ts"
  );

  const fetchCalls = [];

  await registerMetaverseWorldBundleOnServer("staging-ground", {
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

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/metaverse\/world\/preview-bundles$/);
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(fetchCalls[0].init.headers["content-type"], "application/json");

  const requestBody = JSON.parse(fetchCalls[0].init.body);

  assert.equal(requestBody.bundle.mapId, "staging-ground");
  assert.equal(requestBody.sourceBundleId, "staging-ground");
});

test("map editor public project save posts exported bundles to the server public-folder endpoint", async () => {
  const {
    persistMapEditorPublicProjectBundleOnServer
  } = await clientLoader.load(
    "/src/engine-tool/run/persist-map-editor-public-project-bundle-on-server.ts"
  );
  const fetchCalls = [];
  const bundle = Object.freeze({
    ...stagingGroundMapBundle,
    label: "Client Public Project",
    mapId: "client-public-project-save-test"
  });
  const result = await persistMapEditorPublicProjectBundleOnServer(
    bundle,
    {
      mapEditorProjectSettings: Object.freeze({
        helperGridSizeMeters: 320
      }),
      sourceBundleId: "staging-ground"
    },
    {
      async fetch(url, init = {}) {
        fetchCalls.push({
          init,
          url
        });

        return {
          async json() {
            return {
              bundleId: "client-public-project-save-test",
              label: "Client Public Project",
              manifestPath: "/map-editor/projects/manifest.json",
              path: "/map-editor/projects/client-public-project-save-test.json",
              sourceBundleId: "staging-ground",
              status: "persisted",
              updatedAt: "2026-04-25T00:00:00.000Z"
            };
          },
          ok: true
        };
      }
    }
  );

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/metaverse\/world\/public-map-bundles$/);
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.equal(fetchCalls[0].init.headers["content-type"], "application/json");
  assert.equal(result.status, "persisted");
  assert.equal(result.path, "/map-editor/projects/client-public-project-save-test.json");

  const requestBody = JSON.parse(fetchCalls[0].init.body);

  assert.equal(requestBody.bundle.mapId, "client-public-project-save-test");
  assert.equal(requestBody.mapEditorProjectSettings.helperGridSizeMeters, 320);
  assert.equal(requestBody.sourceBundleId, "staging-ground");
});

test("map editor public project manifest registers file-backed bundles without local storage", async () => {
  const {
    clearMetaverseWorldBundlePreviewEntry,
    readMetaverseWorldBundleRegistryEntry
  } = await clientLoader.load("/src/metaverse/world/bundle-registry/index.ts");
  const {
    registerPublicMapEditorProjectRegistryEntries
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-public-project-storage.ts"
  );
  const bundle = Object.freeze({
    ...stagingGroundMapBundle,
    label: "Client Public Loaded Project",
    mapId: "client-public-project-load-test"
  });
  const fetchCalls = [];

  try {
    const entries = await registerPublicMapEditorProjectRegistryEntries({
      async fetch(url, init = {}) {
        fetchCalls.push({
          init,
          url
        });

        if (url === "/map-editor/projects/manifest.json") {
          return {
            async json() {
              return {
                projects: [
                  {
                    bundleId: "client-public-project-load-test",
                    label: "Client Public Loaded Project",
                    mapEditorProjectSettings: Object.freeze({
                      helperGridSizeMeters: 320
                    }),
                    path: "/map-editor/projects/client-public-project-load-test.json",
                    sourceBundleId: "staging-ground",
                    updatedAt: "2026-04-25T00:00:00.000Z"
                  }
                ],
                version: 1
              };
            },
            ok: true,
            status: 200
          };
        }

        assert.equal(
          url,
          "/map-editor/projects/client-public-project-load-test.json"
        );

        return {
          async json() {
            return bundle;
          },
          ok: true,
          status: 200
        };
      }
    });

    const registryEntry = readMetaverseWorldBundleRegistryEntry(
      "client-public-project-load-test"
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0].bundleId, "client-public-project-load-test");
    assert.equal(entries[0].mapEditorProjectSettings?.helperGridSizeMeters, 320);
    assert.equal(fetchCalls[0].init.cache, "no-store");
    assert.equal(fetchCalls[1].init.cache, "no-store");
    assert.equal(registryEntry?.bundle.mapId, "client-public-project-load-test");
    assert.equal(
      registryEntry?.mapEditorProjectSettings?.helperGridSizeMeters,
      320
    );
    assert.equal(registryEntry?.sourceBundleId, "staging-ground");
  } finally {
    clearMetaverseWorldBundlePreviewEntry("client-public-project-load-test");
  }
});

test("map editor viewport scene draft handles keep player spawns addressable for viewport transforms", async () => {
  const {
    createMapEditorViewportSceneDraftHandles,
    disposeMapEditorViewportSceneDraftHandles,
    syncMapEditorViewportSceneDrafts
  } = await clientLoader.load(
    "/src/engine-tool/viewport/map-editor-viewport-scene-drafts.ts"
  );

  const handles = createMapEditorViewportSceneDraftHandles();

  try {
    syncMapEditorViewportSceneDrafts(handles, {
      playerSpawnDrafts: Object.freeze([
        Object.freeze({
          label: "Spawn One",
          position: Object.freeze({
            x: 4,
            y: 0,
            z: 8
          }),
          spawnId: "spawn-one",
          teamId: "blue",
          yawRadians: Math.PI * 0.5
        })
      ]),
      sceneObjectDrafts: Object.freeze([]),
      waterRegionDrafts: Object.freeze([])
    });

    const spawnGroup = handles.playerSpawnGroupsById.get("spawn-one");

    assert.notEqual(spawnGroup, undefined);
    assert.equal(handles.rootGroup.children.includes(spawnGroup), true);
    assert.equal(spawnGroup.userData.playerSpawnId, "spawn-one");
  } finally {
    disposeMapEditorViewportSceneDraftHandles(handles);
  }
});

test("map editor collision preview anchors expose authored physics boxes for placed assets", async () => {
  const {
    createMapEditorViewportPlacementCollisionAnchor,
    resolveMapEditorViewportPlacementRenderYawRadians
  } = await clientLoader.load(
    "/src/engine-tool/viewport/map-editor-viewport-preview-assets.ts"
  );
  const {
    metaverseHubPushableCrateEnvironmentAssetId,
    metaverseHubSkiffEnvironmentAssetId,
    metaversePlaygroundRangeFloorEnvironmentAssetId
  } = await clientLoader.load("/src/assets/config/environment-prop-manifest.ts");

  const floorCollisionAnchor = createMapEditorViewportPlacementCollisionAnchor({
    assetId: metaversePlaygroundRangeFloorEnvironmentAssetId,
    colliderCount: 1,
    collisionEnabled: true,
    isVisible: true,
    materialReferenceId: null,
    notes: "",
    placementId: "floor-collision-preview",
    placementMode: "static",
    position: Object.freeze({
      x: 4,
      y: 0,
      z: -8
    }),
    rotationYRadians: 0,
    scale: Object.freeze({
      x: 1,
      y: 1,
      z: 1
    })
  });
  const crateCollisionAnchor = createMapEditorViewportPlacementCollisionAnchor({
    assetId: metaverseHubPushableCrateEnvironmentAssetId,
    colliderCount: 1,
    collisionEnabled: true,
    isVisible: true,
    materialReferenceId: null,
    notes: "",
    placementId: "crate-collision-preview",
    placementMode: "dynamic",
    position: Object.freeze({
      x: -6,
      y: 0.46,
      z: 14
    }),
    rotationYRadians: Math.PI * 0.25,
    scale: Object.freeze({
      x: 1,
      y: 1,
      z: 1
    })
  });
  const skiffPlacement = Object.freeze({
    assetId: metaverseHubSkiffEnvironmentAssetId,
    colliderCount: 1,
    collisionEnabled: true,
    isVisible: true,
    materialReferenceId: null,
    notes: "",
    placementId: "skiff-collision-preview",
    placementMode: "dynamic",
    position: Object.freeze({
      x: 0,
      y: 0.12,
      z: 0
    }),
    rotationYRadians: 0.3,
    scale: Object.freeze({
      x: 1,
      y: 1,
      z: 1
    })
  });
  const skiffCollisionAnchor =
    createMapEditorViewportPlacementCollisionAnchor(skiffPlacement);

  assert.equal(floorCollisionAnchor.children.length, 1);
  assert.equal(crateCollisionAnchor.children.length, 1);
  assert.equal(skiffCollisionAnchor.rotation.y, skiffPlacement.rotationYRadians);
  assert.ok(
    Math.abs(
      resolveMapEditorViewportPlacementRenderYawRadians(skiffPlacement) -
        (Math.PI * 0.5 - skiffPlacement.rotationYRadians)
    ) < 0.0001
  );
  assert.equal(floorCollisionAnchor.position.x, 4);
  assert.equal(floorCollisionAnchor.children[0]?.position.y, 0.3);
  assert.equal(crateCollisionAnchor.position.y, 0.46);
  assert.equal(crateCollisionAnchor.children[0]?.position.y, 0);
});

test("map editor UI prefs persist build-tool floor, path, and terrain brush settings", async () => {
  const {
    loadMapEditorUiPrefs,
    saveMapEditorUiPrefs
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-ui-storage.ts"
  );
  const {
    defaultMapEditorBuilderToolState
  } = await clientLoader.load("/src/engine-tool/types/map-editor.ts");

  const storageValues = new Map();
  const storage = {
    getItem(key) {
      return storageValues.get(key) ?? null;
    },
    setItem(key, value) {
      storageValues.set(key, value);
    }
  };
  const prefs = Object.freeze({
    builderToolState: Object.freeze({
      ...defaultMapEditorBuilderToolState,
      floorElevationMeters: 1.25,
      floorFootprintCellsX: 3,
      floorFootprintCellsZ: 5,
      pathSlopeLengthCells: 3,
      pathSlopeRotationDegrees: 135.5,
      pathWidthCells: 2,
      terrainBrushMode: "flatten",
      terrainBrushSizeCells: 5,
      terrainGenerationMaxElevationMeters: 7.5,
      terrainGenerationMinElevationMeters: -2.5,
      terrainMaterialId: "terrain-rock",
      terrainSmoothEdges: false,
      waterDepthMeters: 4,
      waterFootprintCellsX: 7,
      waterFootprintCellsZ: 9,
      waterTopElevationMeters: -0.5
    }),
    sceneRailCollapsed: true,
    sectionOpenState: Object.freeze({
      "builder:floor": true,
      "builder:terrain": false
    })
  });

  saveMapEditorUiPrefs(storage, prefs);

  const restoredPrefs = loadMapEditorUiPrefs(storage);

  assert.deepEqual(restoredPrefs.builderToolState, prefs.builderToolState);
  assert.equal(restoredPrefs.sceneRailCollapsed, true);
  assert.deepEqual(restoredPrefs.sectionOpenState, prefs.sectionOpenState);
});

test("map editor semantic drafts resolve surface-backed region bounds from authored loops", async () => {
  const {
    createMapEditorRegionDrafts,
    createMapEditorSurfaceDrafts
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-semantic-drafts.ts"
  );
  const semanticWorld = Object.freeze({
    connectors: Object.freeze([]),
    edges: Object.freeze([]),
    gameplayVolumes: Object.freeze([]),
    lights: Object.freeze([]),
    regions: Object.freeze([
      Object.freeze({
        label: "Raised Arena Floor",
        materialReferenceId: "shell-floor-grid",
        outerLoop: Object.freeze({
          points: Object.freeze([
            Object.freeze({ x: -4, z: -6 }),
            Object.freeze({ x: 4, z: -6 }),
            Object.freeze({ x: 4, z: 6 }),
            Object.freeze({ x: -4, z: 6 })
          ])
        }),
        regionId: "raised-arena-floor-region",
        regionKind: "floor",
        surfaceId: "raised-arena-floor"
      })
    ]),
    structures: Object.freeze([]),
    surfaces: Object.freeze([
      Object.freeze({
        center: Object.freeze({
          x: 16,
          y: 1,
          z: -12
        }),
        elevation: 1,
        kind: "flat-slab",
        label: "Raised Arena Floor",
        rotationYRadians: Math.PI * 0.5,
        size: Object.freeze({
          x: 8,
          y: 0.5,
          z: 12
        }),
        surfaceId: "raised-arena-floor",
        terrainPatchId: null
      })
    ]),
    terrainPatches: Object.freeze([])
  });

  const surfaceDrafts = createMapEditorSurfaceDrafts(semanticWorld);
  const regionDrafts = createMapEditorRegionDrafts(semanticWorld, surfaceDrafts);

  assert.equal(Object.isFrozen(surfaceDrafts[0]), true);
  assert.equal(Object.isFrozen(regionDrafts[0]), true);
  assert.deepEqual(regionDrafts[0]?.center, {
    x: 16,
    y: 1,
    z: -12
  });
  assert.deepEqual(regionDrafts[0]?.size, {
    x: 8,
    y: 0.5,
    z: 12
  });
  assert.equal(regionDrafts[0]?.regionKind, "floor");
  assert.equal(regionDrafts[0]?.rotationYRadians, Math.PI * 0.5);
});

test("map editor semantic draft handles keep procedural structures, volumes, and lights pickable", async () => {
  const {
    createMapEditorViewportSemanticDraftHandles,
    disposeMapEditorViewportSemanticDraftHandles,
    syncMapEditorViewportSemanticDrafts
  } = await clientLoader.load(
    "/src/engine-tool/viewport/map-editor-viewport-semantic-drafts.ts"
  );
  const handles = createMapEditorViewportSemanticDraftHandles();

  try {
    syncMapEditorViewportSemanticDrafts(handles, {
      connectorDrafts: Object.freeze([]),
      edgeDrafts: Object.freeze([]),
      gameplayVolumeDrafts: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 1.5, z: 0 }),
          label: "Blue Zone",
          priority: 2,
          rotationYRadians: 0,
          routePoints: Object.freeze([]),
          size: Object.freeze({ x: 8, y: 3, z: 8 }),
          tags: Object.freeze(["team-control"]),
          teamId: "blue",
          volumeId: "blue-zone",
          volumeKind: "team-zone"
        })
      ]),
      lightDrafts: Object.freeze([
        Object.freeze({
          color: Object.freeze([1, 0.8, 0.5]),
          intensity: 2,
          label: "Arena Light",
          lightId: "arena-light",
          lightKind: "point",
          position: Object.freeze({ x: 2, y: 6, z: 2 }),
          rangeMeters: 20,
          rotationYRadians: 0,
          target: null
        })
      ]),
      regionDrafts: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: -16 }),
          label: "Roof Region",
          materialReferenceId: "shell-floor-grid",
          outerLoop: Object.freeze({
            points: Object.freeze([
              Object.freeze({ x: -4, z: -4 }),
              Object.freeze({ x: 4, z: -4 }),
              Object.freeze({ x: 4, z: 4 }),
              Object.freeze({ x: -4, z: 4 })
            ])
          }),
          regionId: "roof-region",
          regionKind: "roof",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          surfaceId: "roof-surface"
        })
      ]),
      structuralDrafts: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: 0 }),
          grid: Object.freeze({
            cellX: -1,
            cellZ: -1,
            cellsX: 2,
            cellsZ: 2,
            layer: 0
          }),
          label: "Floor",
          materialId: "concrete",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          structureId: "floor-1",
          structureKind: "floor",
          traversalAffordance: "support"
        })
      ]),
      surfaceDrafts: Object.freeze([
        Object.freeze({
          center: Object.freeze({ x: 0, y: 0, z: -16 }),
          elevation: 0,
          kind: "flat-slab",
          label: "Roof Surface",
          rotationYRadians: 0,
          size: Object.freeze({ x: 8, y: 0.5, z: 8 }),
          slopeRiseMeters: 0,
          surfaceId: "roof-surface",
          terrainPatchId: null
        })
      ]),
      terrainPatchDrafts: Object.freeze([
        Object.freeze({
          grid: Object.freeze({
            cellX: -1,
            cellZ: -1,
            cellsX: 2,
            cellsZ: 2,
            layer: 0
          }),
          heightSamples: Object.freeze([0, 0.5, -0.2, 0.1]),
          label: "Terrain Patch",
          materialLayers: Object.freeze([
            Object.freeze({
              layerId: "terrain-patch:terrain-grass",
              materialId: "terrain-grass",
              weightSamples: Object.freeze([1, 1, 1, 1])
            })
          ]),
          origin: Object.freeze({ x: 0, y: 0, z: 16 }),
          rotationYRadians: 0,
          sampleCountX: 2,
          sampleCountZ: 2,
          sampleSpacingMeters: 4,
          terrainPatchId: "terrain-patch",
          waterLevelMeters: null
        })
      ])
    });

    assert.equal(handles.structureGroupsById.get("floor-1")?.userData.structureId, "floor-1");
    assert.equal(handles.regionGroupsById.get("roof-region")?.userData.regionId, "roof-region");
    assert.equal(
      handles.gameplayVolumeGroupsById.get("blue-zone")?.userData.gameplayVolumeId,
      "blue-zone"
    );
    assert.equal(handles.lightGroupsById.get("arena-light")?.userData.lightId, "arena-light");
    assert.equal(
      handles.terrainPatchGroupsById.get("terrain-patch")?.userData.terrainPatchId,
      "terrain-patch"
    );
    assert.equal(
      handles.lightGroupsById.get("arena-light")?.children.some(
        (child) => child.type === "PointLight"
      ),
      true
    );
    assert.equal(
      handles.lightGroupsById
        .get("arena-light")
        ?.children.find((child) => child.type === "Mesh")
        ?.geometry?.type,
      "SphereGeometry"
    );
    assert.notEqual(
      handles.structureGroupsById.get("floor-1")?.children[0]?.material.map ?? null,
      null
    );
    assert.notEqual(
      handles.regionGroupsById.get("roof-region")?.children[0]?.material.map ?? null,
      null
    );
    assert.notEqual(
      handles.terrainPatchGroupsById.get("terrain-patch")?.children[0]?.material.map ?? null,
      null
    );
    assert.notEqual(
      handles.regionGroupsById
        .get("roof-region")
        ?.children[0]
        ?.geometry
        .getAttribute("uv") ?? null,
      null
    );
    assert.notEqual(
      handles.terrainPatchGroupsById
        .get("terrain-patch")
        ?.children[0]
        ?.geometry
        .getAttribute("uv") ?? null,
      null
    );
  } finally {
    disposeMapEditorViewportSemanticDraftHandles(handles);
  }
});

test("map editor wall deletion removes its generated backing surface", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorWallSegment,
    createMapEditorProject,
    removeMapEditorEntity,
    updateMapEditorSurfaceDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  let project = addMapEditorWallSegment(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 0, y: 0, z: 0 }),
    Object.freeze({ x: 8, y: 0, z: 0 }),
    "wall",
    Object.freeze({
      heightMeters: 4,
      thicknessMeters: 0.5
    })
  );
  const edge = project.edgeDrafts.at(-1);

  assert.notEqual(edge, undefined);
  assert.equal(edge.center.y, 2);

  const surface = project.surfaceDrafts.find(
    (surfaceDraft) => surfaceDraft.surfaceId === edge.surfaceId
  );

  assert.notEqual(surface, undefined);
  assert.equal(surface.elevation, 0);

  project = updateMapEditorSurfaceDraft(project, edge.surfaceId, (draft) =>
    Object.freeze({
      ...draft,
      center: Object.freeze({
        ...draft.center,
        y: edge.center.y
      }),
      elevation: edge.center.y
    })
  );

  const nextProject = removeMapEditorEntity(
    project,
    Object.freeze({
      id: edge.edgeId,
      kind: "edge"
    })
  );

  assert.equal(
    nextProject.edgeDrafts.some((edgeDraft) => edgeDraft.edgeId === edge.edgeId),
    false
  );
  assert.equal(
    nextProject.surfaceDrafts.some(
      (surfaceDraft) => surfaceDraft.surfaceId === edge.surfaceId
    ),
    false
  );
});

test("map editor terrain brush seeds new terrain patches on footprint-aligned helper grid centers", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    applyMapEditorTerrainBrush,
    createMapEditorProject
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");

  const project = applyMapEditorTerrainBrush(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 5.1, y: 0, z: 5.1 }),
    "raise",
    1,
    true,
    1,
    0,
    "terrain-grass",
    11
  );
  const terrainPatch = project.terrainPatchDrafts.at(-1);

  assert.notEqual(terrainPatch, undefined);
  assert.deepEqual(terrainPatch.origin, {
    x: 4,
    y: 0,
    z: 4
  });
});

test("map editor terrain patch creation supports dragged floor-style footprints", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorTerrainPatchDraft,
    createMapEditorProject
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");

  const project = addMapEditorTerrainPatchDraft(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 0.4, y: 0, z: 0.4 }),
    "terrain-rock",
    {
      endPosition: Object.freeze({ x: 12.4, y: 0, z: 20.4 })
    }
  );
  const terrainPatch = project.terrainPatchDrafts.at(-1);

  assert.notEqual(terrainPatch, undefined);
  assert.deepEqual(terrainPatch.origin, {
    x: 8,
    y: 0,
    z: 12
  });
  assert.equal(terrainPatch.sampleCountX, 5);
  assert.equal(terrainPatch.sampleCountZ, 7);
  assert.equal(terrainPatch.heightSamples.length, 35);
  assert.equal(terrainPatch.materialLayers[0]?.materialId, "terrain-rock");
  assert.equal(terrainPatch.materialLayers[0]?.weightSamples.length, 35);
});

test("map editor terrain edits weld shared border heights and material layers across neighboring patches", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorTerrainPatchDraft,
    applyMapEditorTerrainBrush,
    createMapEditorProject
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");

  let project = addMapEditorTerrainPatchDraft(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 0, y: 0, z: 0 }),
    "terrain-grass"
  );
  project = addMapEditorTerrainPatchDraft(
    project,
    Object.freeze({ x: 32, y: 0, z: 0 }),
    "terrain-ash"
  );
  project = applyMapEditorTerrainBrush(
    project,
    Object.freeze({ x: 16, y: 0, z: 0 }),
    "raise",
    1,
    true,
    2,
    0,
    "terrain-rock",
    17
  );
  project = applyMapEditorTerrainBrush(
    project,
    Object.freeze({ x: 16, y: 0, z: 0 }),
    "material",
    1,
    true,
    1,
    0,
    "terrain-rock",
    17
  );

  const leftTerrainPatch = project.terrainPatchDrafts[0];
  const rightTerrainPatch = project.terrainPatchDrafts[1];

  assert.notEqual(leftTerrainPatch, undefined);
  assert.notEqual(rightTerrainPatch, undefined);

  const middleRowIndex = Math.floor(leftTerrainPatch.sampleCountZ * 0.5);
  const leftEdgeIndex =
    middleRowIndex * leftTerrainPatch.sampleCountX + (leftTerrainPatch.sampleCountX - 1);
  const rightEdgeIndex = middleRowIndex * rightTerrainPatch.sampleCountX;
  const rightRockLayer =
    rightTerrainPatch.materialLayers.find(
      (layer) => layer.materialId === "terrain-rock"
    ) ?? null;

  assert.equal(leftTerrainPatch.heightSamples[leftEdgeIndex], 2);
  assert.equal(rightTerrainPatch.heightSamples[rightEdgeIndex], 2);
  assert.notEqual(rightRockLayer, null);
  assert.equal(rightRockLayer.weightSamples[rightEdgeIndex], 1);
});

test("map editor terrain generation bakes deterministic height and material samples", async () => {
  const {
    addMapEditorTerrainPatchDraft,
    createMapEditorProject
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const {
    bakeMapEditorProceduralTerrainPatch,
    defaultMapEditorTerrainGenerationConfig
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-terrain-generation.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const project = addMapEditorTerrainPatchDraft(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 0, y: 0, z: 0 })
  );
  const terrainDraft = project.terrainPatchDrafts.at(-1);

  assert.notEqual(terrainDraft, undefined);

  const generationConfig = Object.freeze({
    ...defaultMapEditorTerrainGenerationConfig,
    frequency: 0.12,
    groundElevationMeters: 2,
    maxElevationMeters: 6,
    minElevationMeters: -3,
    octaves: 4,
    seed: 4242,
    warpFrequency: 0.18,
    warpStrengthMeters: 5
  });
  const bakedTerrainA = bakeMapEditorProceduralTerrainPatch(
    terrainDraft,
    generationConfig
  );
  const bakedTerrainB = bakeMapEditorProceduralTerrainPatch(
    terrainDraft,
    generationConfig
  );

  assert.deepEqual(bakedTerrainA.heightSamples, bakedTerrainB.heightSamples);
  assert.deepEqual(bakedTerrainA.materialLayers, bakedTerrainB.materialLayers);
  assert.equal(bakedTerrainA.origin.y, 2);
  assert.equal(bakedTerrainA.waterLevelMeters, null);
  assert.equal(
    bakedTerrainA.heightSamples.every(
      (heightSample) => heightSample + bakedTerrainA.origin.y >= -3 &&
        heightSample + bakedTerrainA.origin.y <= 6
    ),
    true
  );
  assert.equal(
    bakedTerrainA.heightSamples.some(
      (heightSample) => Math.abs(heightSample) > 0.01
    ),
    true
  );
  assert.equal(bakedTerrainA.materialLayers.length >= 3, true);
});

test("map editor terrain naturalization conforms overlapping samples to authored support surfaces", async () => {
  const {
    addMapEditorTerrainPatchDraft,
    conformMapEditorTerrainPatchDraftToSupportSurfaces,
    createMapEditorProject,
    createNaturalTerrainHeightSamples
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));

  project = addMapEditorTerrainPatchDraft(
    project,
    Object.freeze({ x: 0, y: 0, z: 0 })
  );

  const terrainPatch = project.terrainPatchDrafts.at(-1);

  assert.notEqual(terrainPatch, undefined);

  const naturalizedTerrainPatch = conformMapEditorTerrainPatchDraftToSupportSurfaces(
    project,
    {
      ...terrainPatch,
      heightSamples: createNaturalTerrainHeightSamples(terrainPatch)
    }
  );
  const playgroundFloorRegion = project.regionDrafts.find(
    (regionDraft) => regionDraft.regionKind === "floor"
  );
  const playgroundFloorSurface =
    playgroundFloorRegion === undefined
      ? undefined
      : project.surfaceDrafts.find(
          (surfaceDraft) => surfaceDraft.surfaceId === playgroundFloorRegion.surfaceId
        );
  const centerSampleIndex =
    Math.floor(naturalizedTerrainPatch.sampleCountZ * 0.5) *
      naturalizedTerrainPatch.sampleCountX +
    Math.floor(naturalizedTerrainPatch.sampleCountX * 0.5);

  assert.notEqual(playgroundFloorRegion, undefined);
  assert.notEqual(playgroundFloorSurface, undefined);
  assert.equal(
    naturalizedTerrainPatch.heightSamples[centerSampleIndex],
    playgroundFloorSurface.elevation
  );
});

test("map editor path helpers resolve arbitrary flat and explicit sloped endpoints", async () => {
  const {
    resolveMapEditorBuildPathDirectedSlopeSegmentEnd,
    resolveMapEditorBuildPathSegmentEnd,
    resolveMapEditorBuildPathSlopeSegmentEnd
  } = await clientLoader.load("/src/engine-tool/build/map-editor-build-placement.ts");

  const flatEndpoint = resolveMapEditorBuildPathSegmentEnd(
    Object.freeze({ x: 0, y: 2, z: 0 }),
    Object.freeze({ x: 12, y: 9, z: 4 }),
    2
  );
  const eastEndpoint = resolveMapEditorBuildPathSlopeSegmentEnd(
    Object.freeze({ x: 0, y: 2, z: 0 }),
    2,
    90
  );
  const diagonalEndpoint = resolveMapEditorBuildPathSlopeSegmentEnd(
    Object.freeze({ x: 4, y: 2, z: -4 }),
    1,
    45
  );
  const cursorDirectedEndpoint = resolveMapEditorBuildPathDirectedSlopeSegmentEnd(
    Object.freeze({ x: 0, y: 2, z: 0 }),
    Object.freeze({ x: 4, y: 0, z: 4 }),
    2,
    0
  );

  assert.deepEqual(flatEndpoint, {
    x: 12,
    y: 2,
    z: 4
  });
  assert.equal(Math.round(eastEndpoint.x * 1000) / 1000, 8);
  assert.equal(Math.round(eastEndpoint.z * 1000) / 1000, 0);
  assert.equal(Math.round(diagonalEndpoint.x * 1000) / 1000, 6.828);
  assert.equal(Math.round(diagonalEndpoint.z * 1000) / 1000, -1.172);
  assert.equal(Math.round(cursorDirectedEndpoint.x * 1000) / 1000, 5.657);
  assert.equal(Math.round(cursorDirectedEndpoint.y * 1000) / 1000, 2);
  assert.equal(Math.round(cursorDirectedEndpoint.z * 1000) / 1000, 5.657);
});

test("map editor flat path segments preserve arbitrary endpoint angles", async () => {
  const {
    addMapEditorPathSegment,
    createMapEditorProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));

  project = addMapEditorPathSegment(
    project,
    Object.freeze({ x: 12, y: 0, z: 4 }),
    0,
    Object.freeze({
      center: Object.freeze({ x: 0, y: 0, z: 0 }),
      elevation: 0
    }),
    2,
    "warning"
  );

  const pathRegion = project.regionDrafts.at(-1);
  const pathSurface =
    pathRegion === undefined
      ? undefined
      : project.surfaceDrafts.find(
          (surfaceDraft) => surfaceDraft.surfaceId === pathRegion.surfaceId
        );

  assert.notEqual(pathRegion, undefined);
  assert.notEqual(pathSurface, undefined);
  assert.equal(pathRegion.regionKind, "path");
  assert.equal(pathSurface.kind, "flat-slab");
  assert.deepEqual(pathSurface.center, {
    x: 6,
    y: 0,
    z: 2
  });
  assert.equal(pathSurface.size.x, 8);
  assert.equal(pathSurface.size.z, Math.hypot(12, 4));
  assert.equal(pathSurface.rotationYRadians, Math.atan2(12, 4));
  assert.equal(pathRegion.rotationYRadians, pathSurface.rotationYRadians);
});

test("map editor wide path segments create endpoint landings for connected corners", async () => {
  const {
    addMapEditorPathSegment,
    createMapEditorProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const start = Object.freeze({ x: 1000, y: 0, z: 1000 });
  const corner = Object.freeze({ x: 1008, y: 0, z: 1000 });
  const end = Object.freeze({ x: 1008, y: 0, z: 1008 });
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));
  const initialRegionCount = project.regionDrafts.length;

  project = addMapEditorPathSegment(
    project,
    corner,
    0,
    Object.freeze({
      center: start,
      elevation: 0
    }),
    2,
    "warning"
  );
  project = addMapEditorPathSegment(
    project,
    end,
    0,
    Object.freeze({
      center: corner,
      elevation: 0
    }),
    2,
    "warning"
  );

  const newPathRegions = project.regionDrafts
    .slice(initialRegionCount)
    .filter((region) => region.regionKind === "path");
  const cornerLanding = newPathRegions.find((region) => {
    const surface = project.surfaceDrafts.find(
      (surfaceDraft) => surfaceDraft.surfaceId === region.surfaceId
    );

    return (
      Math.abs(region.center.x - corner.x) <= 0.01 &&
      Math.abs(region.center.z - corner.z) <= 0.01 &&
      surface?.kind === "flat-slab" &&
      surface.size.x === 8 &&
      surface.size.z === 8
    );
  });

  assert.equal(newPathRegions.length, 5);
  assert.notEqual(cornerLanding, undefined);
});

test("map editor selected path landings can quick-shape a connected ramp", async () => {
  const {
    addMapEditorPathSegment,
    applyMapEditorPathRampToSelection,
    createMapEditorProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const start = Object.freeze({ x: 1040, y: 0, z: 1000 });
  const end = Object.freeze({ x: 1056, y: 0, z: 1000 });
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));
  const initialRegionCount = project.regionDrafts.length;

  project = addMapEditorPathSegment(
    project,
    end,
    0,
    Object.freeze({
      center: start,
      elevation: 0
    }),
    2,
    "warning"
  );

  const newPathRegions = project.regionDrafts.slice(initialRegionCount);
  const startLanding = newPathRegions.find(
    (region) =>
      region.regionKind === "path" &&
      Math.abs(region.center.x - start.x) <= 0.01 &&
      Math.abs(region.center.z - start.z) <= 0.01
  );
  const segmentRegion = project.regionDrafts.at(-1);

  assert.notEqual(startLanding, undefined);
  assert.notEqual(segmentRegion, undefined);

  project = applyMapEditorPathRampToSelection(project, 4, {
    id: startLanding.regionId,
    kind: "region"
  });

  const rampSurface = project.surfaceDrafts.find(
    (surfaceDraft) => surfaceDraft.surfaceId === segmentRegion.surfaceId
  );

  assert.equal(project.selectedEntityRef?.id, segmentRegion.regionId);
  assert.equal(rampSurface?.kind, "sloped-plane");
  assert.equal(rampSurface?.slopeRiseMeters, 4);
  assert.equal(rampSurface?.elevation, 2);
  assert.equal(rampSurface?.center.y, 2);
});

test("map editor removing a generated path region removes its orphan support surface", async () => {
  const {
    addMapEditorPathSegment,
    createMapEditorProject,
    removeMapEditorEntity
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));

  project = addMapEditorPathSegment(
    project,
    Object.freeze({ x: 12, y: 0, z: 4 }),
    0,
    Object.freeze({
      center: Object.freeze({ x: 0, y: 0, z: 0 }),
      elevation: 0
    }),
    2,
    "warning"
  );

  const pathRegion = project.regionDrafts.at(-1);

  assert.notEqual(pathRegion, undefined);

  const pathSurfaceId = pathRegion.surfaceId;

  project = removeMapEditorEntity(project, {
    id: pathRegion.regionId,
    kind: "region"
  });

  assert.equal(
    project.regionDrafts.some((region) => region.regionId === pathRegion.regionId),
    false
  );
  assert.equal(
    project.surfaceDrafts.some((surface) => surface.surfaceId === pathSurfaceId),
    false
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
    addMapEditorFloorRegionDraft,
    addMapEditorPlacementAtPositionFromAsset,
    addMapEditorPlacementFromAsset,
    createMapEditorProject,
    readSelectedMapEditorLaunchVariation,
    readSelectedMapEditorPlacement,
    selectMapEditorLaunchVariation,
    selectMapEditorPlacement,
    updateMapEditorLaunchVariationDraft,
    updateMapEditorEnvironmentPresentationProfileId,
    removeMapEditorPlacement,
    updateMapEditorPlayerSpawnSelectionDraft,
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
    resolveMapEditorBuildGroundPlacementPosition,
    resolveMapEditorBuildWallSegment
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
  assert.equal(initialProject.placementDrafts.length, 5);
  assert.equal(initialProject.hudProfileId, "shell-default-hud");
  assert.equal(
    initialProject.environmentPresentationProfileId,
    "shell-default-environment-presentation"
  );
  assert.equal(initialProject.environmentPresentation.environment.fogEnabled, false);
  assert.equal(initialProject.launchVariationDrafts.length, 3);
  assert.equal(initialProject.playerSpawnDrafts.length, 5);
  assert.equal(initialProject.playerSpawnDrafts[0].teamId, "neutral");
  assert.equal(
    initialProject.playerSpawnSelectionDraft.enemyAvoidanceRadiusMeters,
    18
  );
  assert.equal(
    initialProject.playerSpawnSelectionDraft.homeTeamBiasMeters,
    12
  );
  assert.equal(initialProject.sceneObjectDrafts.length, 1);
  assert.equal(initialProject.waterRegionDrafts.length, 1);
  assert.equal(initialSelectedPlacement, null);
  assert.equal(initialProject.selectedEntityRef?.kind, "region");
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
  const floorRegionProject = addMapEditorFloorRegionDraft(
    selectedProject,
    Object.freeze({
      x: 1.2,
      y: 0,
      z: 2.9
    }),
    Object.freeze({
      x: 9.6,
      y: 0,
      z: 12.1
    })
  );
  const horizontalWallSegment = resolveMapEditorBuildWallSegment(
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    Object.freeze({
      x: 12,
      y: 0,
      z: 4
    })
  );
  const diagonalWallSegment = resolveMapEditorBuildWallSegment(
    Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    Object.freeze({
      x: 11.2,
      y: 0,
      z: 11.9
    })
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
      footprint: {
        ...waterRegionDraft.footprint,
        centerX: waterRegionDraft.footprint.centerX + 3
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
  const updatedPlayerSpawnSelectionProject =
    updateMapEditorPlayerSpawnSelectionDraft(initialProject, (spawnSelection) => ({
      ...spawnSelection,
      enemyAvoidanceRadiusMeters:
        spawnSelection.enemyAvoidanceRadiusMeters + 6,
      homeTeamBiasMeters: spawnSelection.homeTeamBiasMeters + 4
    }));
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
    primitiveAddedProject.regionDrafts.length,
    selectedProject.regionDrafts.length + 1
  );
  assert.equal(
    primitiveAddedProject.selectedEntityRef?.kind,
    "region"
  );
  assert.deepEqual(snappedBuildPosition, {
    x: 6,
    y: 0,
    z: 6
  });
  assert.notEqual(horizontalWallSegment, null);
  assert.deepEqual(horizontalWallSegment.end, {
    x: 12,
    y: 0,
    z: 4
  });
  assert.equal(horizontalWallSegment.lengthMeters, Math.hypot(12, 4));
  assert.equal(
    horizontalWallSegment.rotationYRadians,
    Math.atan2(12, 4) - Math.PI * 0.5
  );
  assert.notEqual(diagonalWallSegment, null);
  assert.deepEqual(diagonalWallSegment.end, {
    x: 12,
    y: 0,
    z: 12
  });
  assert.equal(diagonalWallSegment.lengthMeters, Math.hypot(12, 12));
  assert.equal(diagonalWallSegment.rotationYRadians, -Math.PI * 0.25);
  assert.deepEqual(
    floorRegionProject.regionDrafts[
      floorRegionProject.regionDrafts.length - 1
    ].size,
    {
      x: 12,
      y: 0.5,
      z: 12
    }
  );
  assert.equal(
    explicitlyPlacedPrimitiveProject.edgeDrafts.length,
    selectedProject.edgeDrafts.length + 1
  );
  assert.deepEqual(
    explicitlyPlacedPrimitiveProject.edgeDrafts[
      explicitlyPlacedPrimitiveProject.edgeDrafts.length - 1
    ].center,
    {
      x: snappedBuildPosition.x,
      y: snappedBuildPosition.y + 2,
      z: snappedBuildPosition.z
    }
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
    updatedWaterProject.waterRegionDrafts[0].footprint.centerX,
    initialProject.waterRegionDrafts[0].footprint.centerX + 3
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
    updatedPlayerSpawnSelectionProject.playerSpawnSelectionDraft
      .enemyAvoidanceRadiusMeters,
    initialProject.playerSpawnSelectionDraft.enemyAvoidanceRadiusMeters + 6
  );
  assert.equal(
    updatedPlayerSpawnSelectionProject.playerSpawnSelectionDraft.homeTeamBiasMeters,
    initialProject.playerSpawnSelectionDraft.homeTeamBiasMeters + 4
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
    `Player Spawn ${initialProject.playerSpawnDrafts.length + 1}`
  );
  assert.equal(
    addedPlayerSpawnProject.playerSpawnDrafts[
      addedPlayerSpawnProject.playerSpawnDrafts.length - 1
    ].teamId,
    "neutral"
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
    ].footprint.sizeCellsX,
    1
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
  assert.equal(
    removeMapEditorPlacement(updatedProject, updatedProject.selectedPlacementId)
      .placementDrafts.length,
    updatedProject.placementDrafts.length - 1
  );
});

test("map editor project session undoes authored changes without treating selection changes as undo history", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorPlacementFromAsset,
    createMapEditorProject,
    selectMapEditorPlacement
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const {
    applyMapEditorProjectSessionChange,
    createMapEditorProjectSession,
    undoMapEditorProjectSessionChange,
    updateMapEditorProjectSessionProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-session.ts"
  );
  const {
    listMapEditorBuildPrimitiveCatalogEntries
  } = await clientLoader.load(
    "/src/engine-tool/build/map-editor-build-primitives.ts"
  );

  const initialProject = createMapEditorProject(
    loadMetaverseMapBundle("staging-ground")
  );
  const nextSelectedPlacementId = initialProject.placementDrafts[1]?.placementId;
  const initialSession = createMapEditorProjectSession(initialProject);
  const selectionSession = updateMapEditorProjectSessionProject(
    initialSession,
    (project) =>
      nextSelectedPlacementId === undefined
        ? project
        : selectMapEditorPlacement(project, nextSelectedPlacementId)
  );
  const authoredChangeSession = applyMapEditorProjectSessionChange(
    selectionSession,
    (project) =>
      addMapEditorPlacementFromAsset(
        project,
        listMapEditorBuildPrimitiveCatalogEntries()[2].asset
      )
  );
  const undoneSession = undoMapEditorProjectSessionChange(authoredChangeSession);

  assert.equal(selectionSession.undoHistory.length, 0);
  assert.equal(authoredChangeSession.undoHistory.length, 1);
  assert.equal(
    authoredChangeSession.project.placementDrafts.length,
    selectionSession.project.placementDrafts.length + 1
  );
  assert.equal(
    undoneSession.project.placementDrafts.length,
    selectionSession.project.placementDrafts.length
  );
  assert.equal(
    undoneSession.project.selectedPlacementId,
    selectionSession.project.selectedPlacementId
  );
});

test("map editor environment proof preserves authored placement material references", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    createLoadedMetaverseMapBundleSnapshot
  } = await clientLoader.load("/src/metaverse/world/map-bundles/index.ts");
  const {
    createMapEditorProject,
    updateMapEditorPlacement
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { exportMapEditorProjectToMetaverseMapBundle } = await clientLoader.load(
    "/src/engine-tool/run/export-map-editor-project-to-metaverse-map-bundle.ts"
  );
  const {
    createMetaverseEnvironmentProofConfig
  } = await clientLoader.load(
    "/src/metaverse/world/proof/create-metaverse-environment-proof-config.ts"
  );
  const initialProject = createMapEditorProject(
    loadMetaverseMapBundle("staging-ground")
  );
  const placementId = initialProject.placementDrafts[0]?.placementId;

  assert.notEqual(placementId, undefined);

  const project = updateMapEditorPlacement(
    initialProject,
    placementId,
    (placement) => ({
      ...placement,
      materialReferenceId: "glass"
    })
  );
  const proofConfig = createMetaverseEnvironmentProofConfig(
    createLoadedMetaverseMapBundleSnapshot(
      exportMapEditorProjectToMetaverseMapBundle(project)
    )
  );

  assert.equal(
    proofConfig.assets.some((asset) =>
      asset.placements.some(
        (placement) => placement.materialReferenceId === "glass"
      )
    ),
    true
  );
});

test("map editor export preserves authored spawn teams and team-proximity selection settings", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    createMapEditorProject,
    updateMapEditorPlayerSpawnDraft,
    updateMapEditorPlayerSpawnSelectionDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { exportMapEditorProjectToMetaverseMapBundle } = await clientLoader.load(
    "/src/engine-tool/run/export-map-editor-project-to-metaverse-map-bundle.ts"
  );

  const initialProject = createMapEditorProject(
    loadMetaverseMapBundle("staging-ground")
  );
  const spawnId = initialProject.playerSpawnDrafts[0]?.spawnId;

  assert.notEqual(spawnId, undefined);

  const project = updateMapEditorPlayerSpawnSelectionDraft(
    updateMapEditorPlayerSpawnDraft(initialProject, spawnId, (spawnDraft) => ({
      ...spawnDraft,
      teamId: "blue"
    })),
    (spawnSelection) => ({
      ...spawnSelection,
      enemyAvoidanceRadiusMeters: 22,
      homeTeamBiasMeters: 14
    })
  );
  const exportedBundle = exportMapEditorProjectToMetaverseMapBundle(project);

  assert.equal(exportedBundle.playerSpawnNodes[0]?.teamId, "blue");
  assert.equal(exportedBundle.playerSpawnSelection.enemyAvoidanceRadiusMeters, 22);
  assert.equal(exportedBundle.playerSpawnSelection.homeTeamBiasMeters, 14);
});

test("map editor imports, edits, deletes, selects, and exports weapon resource spawns", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorResourceSpawnDraft,
    createMapEditorProject,
    removeMapEditorEntity,
    selectMapEditorEntity,
    updateMapEditorResourceSpawnDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { exportMapEditorProjectToMetaverseMapBundle } = await clientLoader.load(
    "/src/engine-tool/run/export-map-editor-project-to-metaverse-map-bundle.ts"
  );
  const initialProject = createMapEditorProject(
    loadMetaverseMapBundle("staging-ground")
  );
  const addedProject = addMapEditorResourceSpawnDraft(
    initialProject,
    Object.freeze({
      x: 1,
      y: 0.6,
      z: 3
    })
  );
  const resourceSpawnId = addedProject.resourceSpawnDrafts[0]?.spawnId;

  assert.notEqual(resourceSpawnId, undefined);
  assert.equal(addedProject.selectedEntityRef?.kind, "resource-spawn");
  assert.equal(addedProject.selectedEntityRef?.id, resourceSpawnId);

  const updatedProject = updateMapEditorResourceSpawnDraft(
    addedProject,
    resourceSpawnId,
    (resourceSpawnDraft) => ({
      ...resourceSpawnDraft,
      ammoGrantRounds: 6,
      assetId: "metaverse-rocket-launcher-v1",
      label: "Rocket test pickup",
      modeTags: Object.freeze(["team-deathmatch"]),
      pickupRadiusMeters: 1.8,
      position: Object.freeze({
        x: 4,
        y: 0.6,
        z: -2
      }),
      respawnCooldownMs: 45_000,
      weaponId: "metaverse-rocket-launcher-v1",
      yawRadians: 0.75
    })
  );
  const selectedProject = selectMapEditorEntity(
    updatedProject,
    Object.freeze({
      id: resourceSpawnId,
      kind: "resource-spawn"
    })
  );
  const exportedBundle =
    exportMapEditorProjectToMetaverseMapBundle(selectedProject);
  const exportedPickup = exportedBundle.resourceSpawns[0];

  assert.equal(selectedProject.selectedEntityRef?.kind, "resource-spawn");
  assert.equal(exportedBundle.resourceSpawns.length, 1);
  assert.equal(exportedPickup?.resourceKind, "weapon-pickup");
  assert.equal(exportedPickup?.spawnId, resourceSpawnId);
  assert.equal(exportedPickup?.label, "Rocket test pickup");
  assert.equal(exportedPickup?.weaponId, "metaverse-rocket-launcher-v1");
  assert.equal(exportedPickup?.assetId, "metaverse-rocket-launcher-v1");
  assert.equal(exportedPickup?.ammoGrantRounds, 6);
  assert.equal(exportedPickup?.respawnCooldownMs, 45_000);
  assert.equal(exportedPickup?.pickupRadiusMeters, 1.8);
  assert.deepEqual(exportedPickup?.modeTags, ["team-deathmatch"]);
  assert.deepEqual(exportedPickup?.position, {
    x: 4,
    y: 0.6,
    z: -2
  });

  const removedProject = removeMapEditorEntity(selectedProject);

  assert.equal(removedProject.resourceSpawnDrafts.length, 0);
});

test("map editor viewport keeps weapon resource spawn previews on real models instead of fake weapon proxies", async () => {
  const {
    createMapEditorViewportSceneDraftHandles,
    disposeMapEditorViewportSceneDraftHandles,
    syncMapEditorViewportSceneDrafts
  } = await clientLoader.load(
    "/src/engine-tool/viewport/map-editor-viewport-scene-drafts.ts"
  );
  const handles = createMapEditorViewportSceneDraftHandles();
  const resourceSpawnDraft = Object.freeze({
    ammoGrantRounds: 48,
    assetId: "metaverse-service-pistol-v2",
    label: "Pistol preview",
    modeTags: Object.freeze(["team-deathmatch"]),
    pickupRadiusMeters: 1.4,
    position: Object.freeze({
      x: 0,
      y: 0.6,
      z: 0
    }),
    respawnCooldownMs: 30_000,
    spawnId: "resource-preview-test",
    weaponId: "metaverse-service-pistol-v2",
    yawRadians: 0
  });

  syncMapEditorViewportSceneDrafts(handles, {
    playerSpawnDrafts: Object.freeze([]),
    resourceSpawnDrafts: Object.freeze([resourceSpawnDraft]),
    sceneObjectDrafts: Object.freeze([]),
    waterRegionDrafts: Object.freeze([])
  });

  const resourceSpawnGroup =
    handles.resourceSpawnGroupsById.get(resourceSpawnDraft.spawnId) ?? null;
  const childNames = [];

  resourceSpawnGroup?.traverse((node) => {
    childNames.push(node.name);
  });

  assert.notEqual(resourceSpawnGroup, null);
  assert.equal(resourceSpawnGroup?.children.length, 1);
  assert.equal(
    childNames.some((name) => name.includes("fallback") || name.includes("beacon")),
    false
  );

  disposeMapEditorViewportSceneDraftHandles(handles);
});

test("private-build TDM loads and previews the weapon resource layout", async () => {
  const { createMapEditorProject } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { validateAndRegisterMapEditorPreviewBundle } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-run-preview.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const loadedBundle = loadMetaverseMapBundle("private-build");
  const project = createMapEditorProject(loadedBundle);
  const teamDeathmatchVariation =
    loadedBundle.bundle.launchVariations.find(
      (variation) => variation.matchMode === "team-deathmatch"
    ) ?? null;

  assert.equal(
    teamDeathmatchVariation?.weaponLayoutId,
    "metaverse-tdm-pistol-rocket-layout"
  );
  assert.equal(project.selectedLaunchVariationId, "shell-team-deathmatch");
  assert.equal(loadedBundle.bundle.resourceSpawns.length, 12);
  assert.deepEqual(
    loadedBundle.bundle.resourceSpawns.map((resourceSpawn) => [
      resourceSpawn.spawnId,
      resourceSpawn.weaponId,
      resourceSpawn.ammoGrantRounds,
      resourceSpawn.respawnCooldownMs,
      resourceSpawn.modeTags
    ]),
    [
      [
        "private-build:resource:pistol-north",
        "metaverse-service-pistol-v2",
        48,
        30_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:pistol-south",
        "metaverse-service-pistol-v2",
        48,
        30_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:battle-rifle-northeast",
        "metaverse-battle-rifle-v1",
        108,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:battle-rifle-southwest",
        "metaverse-battle-rifle-v1",
        108,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:smg-northwest",
        "metaverse-compact-smg-v1",
        160,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:smg-southeast",
        "metaverse-compact-smg-v1",
        160,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:shotgun-north",
        "metaverse-breacher-shotgun-v1",
        36,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:shotgun-south",
        "metaverse-breacher-shotgun-v1",
        36,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:sniper-west",
        "metaverse-longshot-sniper-v1",
        25,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:sniper-east",
        "metaverse-longshot-sniper-v1",
        25,
        35_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:rocket-west",
        "metaverse-rocket-launcher-v1",
        6,
        45_000,
        ["team-deathmatch"]
      ],
      [
        "private-build:resource:rocket-east",
        "metaverse-rocket-launcher-v1",
        6,
        45_000,
        ["team-deathmatch"]
      ]
    ]
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
  const previewBundle = loadMetaverseMapBundle(
    previewResult.launchSelection?.bundleId ?? ""
  );

  assert.equal(previewResult.validation.valid, true);
  assert.equal(previewResult.launchSelection?.matchMode, "team-deathmatch");
  assert.equal(
    previewResult.launchSelection?.weaponLayoutId,
    "metaverse-tdm-pistol-rocket-layout"
  );
  assert.equal(previewBundle.bundle.resourceSpawns.length, 12);
});

test("map editor procedural build helpers export grid-canonical structures, gameplay volumes, and lights", async () => {
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    addMapEditorCombatLaneDraft,
    addMapEditorCoverDraft,
    addMapEditorFloorRegionDraft,
    addMapEditorLightDraft,
    addMapEditorMaterialDefinitionDraft,
    addMapEditorPathSegment,
    addMapEditorTerrainPatchDraft,
    addMapEditorTeamZoneDraft,
    addMapEditorVehicleRouteDraft,
    addMapEditorWallSegment,
    applyMapEditorTerrainBrush,
    createMapEditorProject,
    paintMapEditorEntityMaterial
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { exportMapEditorProjectToMetaverseMapBundle } = await clientLoader.load(
    "/src/engine-tool/run/export-map-editor-project-to-metaverse-map-bundle.ts"
  );

  const origin = Object.freeze({ x: 0, y: 0, z: 0 });
  const customMaterialId = "staging-ground:material:test-panel";
  let project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));

  project = addMapEditorMaterialDefinitionDraft(project, {
    baseColorHex: "#123456",
    baseMaterialId: "metal",
    label: "Test Panel",
    materialId: customMaterialId,
    metalness: 0.38,
    roughness: 0.52,
    textureBrightness: 1.18,
    textureContrast: 1.12,
    textureImageDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    texturePatternStrength: 0.42,
    textureRepeat: 2
  });
  project = addMapEditorTerrainPatchDraft(project, origin);
  project = applyMapEditorTerrainBrush(
    project,
    origin,
    "plateau",
    4,
    true,
    1,
    2,
    "terrain-rock",
    77
  );
  project = addMapEditorFloorRegionDraft(
    project,
    origin,
    Object.freeze({ x: 8, y: 0, z: 8 }),
    { materialId: "metal", materialReferenceId: customMaterialId }
  );
  project = addMapEditorPathSegment(
    project,
    Object.freeze({ x: 12, y: 0, z: 0 }),
    0,
    null,
    2,
    "warning"
  );
  project = addMapEditorPathSegment(
    project,
    Object.freeze({ x: 16, y: 4, z: 0 }),
    4,
    Object.freeze({
      center: Object.freeze({ x: 12, y: 0, z: 0 }),
      elevation: 0
    }),
    2,
    "warning"
  );
  project = addMapEditorCoverDraft(
    project,
    Object.freeze({ x: -8, y: 0, z: 0 }),
    {
      footprintCellsX: 1,
      footprintCellsZ: 2,
      heightCells: 1,
      materialId: "metal",
      materialReferenceId: customMaterialId
    }
  );
  project = addMapEditorWallSegment(
    project,
    Object.freeze({ x: 20, y: 0, z: -4 }),
    Object.freeze({ x: 28, y: 0, z: -4 }),
    "wall",
    {
      heightMeters: 4,
      materialReferenceId: customMaterialId,
      thicknessMeters: 0.5
    }
  );
  project = addMapEditorTeamZoneDraft(
    project,
    Object.freeze({ x: -16, y: 0, z: -8 }),
    Object.freeze({ x: -8, y: 0, z: 8 }),
    "blue"
  );
  project = addMapEditorCombatLaneDraft(
    project,
    Object.freeze({ x: -12, y: 0, z: 0 }),
    Object.freeze({ x: 12, y: 0, z: 0 }),
    3
  );
  project = addMapEditorVehicleRouteDraft(
    project,
    Object.freeze({ x: -20, y: 0, z: 12 }),
    Object.freeze({ x: 20, y: 0, z: 12 }),
    4
  );
  project = addMapEditorLightDraft(
    project,
    Object.freeze({ x: 0, y: 6, z: 0 }),
    { intensity: 3, rangeMeters: 24 }
  );
  const paintedProject = paintMapEditorEntityMaterial(
    project,
    project.structuralDrafts[0] === undefined
      ? null
      : Object.freeze({
          id: project.structuralDrafts[0].structureId,
          kind: "structure"
        }),
    "team-blue"
  );
  const exportedBundle = exportMapEditorProjectToMetaverseMapBundle(paintedProject);

  assert.deepEqual(exportedBundle.semanticWorld.materialDefinitions[0], {
    accentColorHex: null,
    baseColorHex: "#123456",
    baseMaterialId: "metal",
    label: "Test Panel",
    materialId: customMaterialId,
    metalness: 0.38,
    opacity: 1,
    roughness: 0.52,
    textureBrightness: 1.18,
    textureContrast: 1.12,
    textureImageDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    texturePatternStrength: 0.42,
    textureRepeat: 2
  });
  assert.equal(
    exportedBundle.semanticWorld.structures.some(
      (structure) =>
        structure.structureKind === "cover" &&
        structure.materialId === "team-blue" &&
        structure.materialReferenceId === "team-blue"
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.regions.some(
      (region) =>
        region.regionKind === "floor" &&
        region.materialReferenceId === customMaterialId
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.regions.some(
      (region) => region.regionKind === "path"
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.edges.some(
      (edge) =>
        edge.edgeKind === "wall" &&
        edge.materialReferenceId === customMaterialId
    ),
    true
  );
  assert.equal(
    exportedBundle.compiledWorld.compatibilityEnvironmentAssets.some(
      (environmentAsset) =>
        environmentAsset.placements.some(
          (placement) => placement.materialReferenceId === customMaterialId
        )
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.surfaces.some(
      (surface) => surface.kind === "sloped-plane" && surface.slopeRiseMeters === 4
    ),
    true
  );
  assert.equal(exportedBundle.semanticWorld.terrainPatches.length, 1);
  assert.equal(
    exportedBundle.compiledWorld.chunks.some((chunk) =>
      chunk.collision.heightfields.some(
        (heightfield) => heightfield.ownerKind === "terrain-patch"
      )
    ),
    true
  );
  assert.equal(
    exportedBundle.compiledWorld.chunks.some((chunk) =>
      chunk.collision.triMeshes.some(
        (triMesh) => triMesh.ownerKind === "region"
      )
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.gameplayVolumes.some(
      (volume) => volume.volumeKind === "team-zone" && volume.teamId === "blue"
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.gameplayVolumes.some(
      (volume) => volume.volumeKind === "combat-lane"
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.gameplayVolumes.some(
      (volume) => volume.volumeKind === "vehicle-route"
    ),
    true
  );
  assert.equal(
    exportedBundle.semanticWorld.gameplayVolumes.some(
      (volume) => volume.volumeKind === "kill-floor"
    ),
    true
  );
  assert.equal(exportedBundle.semanticWorld.lights.at(-1)?.intensity, 3);
  assert.equal(
    exportedBundle.compiledWorld.chunks.some((chunk) =>
      chunk.collision.boxes.some((box) => box.ownerKind === "structure")
    ),
    true
  );
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

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 5);
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

test("map editor library hides hidden environment assets and the shipped staging-ground draft no longer places them", async () => {
  const {
    environmentPropManifest,
    metaversePlaygroundRangeBarrierEnvironmentAssetId
  } = await clientLoader.load("/src/assets/config/environment-prop-manifest.ts");
  const { groupMapEditorLibraryAssets } = await clientLoader.load(
    "/src/engine-tool/library/map-editor-library-asset-groups.ts"
  );
  const { createMapEditorProject } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );

  const libraryGroups = groupMapEditorLibraryAssets(
    environmentPropManifest.environmentAssets
  );
  const project = createMapEditorProject(loadMetaverseMapBundle("staging-ground"));

  assert.equal(
    environmentPropManifest.byId[metaversePlaygroundRangeBarrierEnvironmentAssetId]
      .editorCatalogVisibility,
    "hidden"
  );
  assert.equal(
    libraryGroups.props.some(
      (asset) => asset.id === metaversePlaygroundRangeBarrierEnvironmentAssetId
    ),
    false
  );
  assert.equal(
    libraryGroups.vehicles.some(
      (asset) => asset.id === metaversePlaygroundRangeBarrierEnvironmentAssetId
    ),
    false
  );
  assert.equal(
    project.placementDrafts.some(
      (placement) =>
        placement.assetId === metaversePlaygroundRangeBarrierEnvironmentAssetId
    ),
    false
  );
});

test("metaverse environment proof rejects procedural box drift away from exact-match colliders", async () => {
  const {
    clearMetaverseWorldBundlePreviewEntry,
    registerMetaverseWorldBundlePreviewEntry
  } = await clientLoader.load("/src/metaverse/world/bundle-registry/index.ts");
  const { loadMetaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/metaverse/world/proof/load-metaverse-environment-proof-config.ts"
  );
  const {
    environmentPropManifest,
    metaverseBuilderFloorTileEnvironmentAssetId
  } = await clientLoader.load("/src/assets/config/environment-prop-manifest.ts");

  const floorAsset =
    environmentPropManifest.byId[metaverseBuilderFloorTileEnvironmentAssetId];
  const originalFloorLods = floorAsset.renderModel.lods;

  const createPreviewBundleWithFloor = (previewId, mutateFloorAsset) => {
    const previewBundle = structuredClone(stagingGroundMapBundle);
    const mutateAssets = (environmentAssets) =>
      Object.freeze(
        environmentAssets.map((environmentAsset) => {
          if (
            environmentAsset.assetId !==
            metaverseBuilderFloorTileEnvironmentAssetId
          ) {
            return Object.freeze(environmentAsset);
          }

          return Object.freeze(mutateFloorAsset(structuredClone(environmentAsset)));
        })
      );

    previewBundle.label = `Exact Match Proof ${previewId}`;
    previewBundle.mapId = previewId;
    previewBundle.environmentAssets = mutateAssets(previewBundle.environmentAssets);
    previewBundle.compiledWorld = Object.freeze({
      ...previewBundle.compiledWorld,
      compatibilityEnvironmentAssets: mutateAssets(
        previewBundle.compiledWorld.compatibilityEnvironmentAssets
      )
    });

    return Object.freeze(previewBundle);
  };

  const previewScenarios = [
    {
      bundleId: "exact-match-floor-double-collider",
      expectedError: /requires exactly one exact-match surface collider/,
      mutateFloorAsset(floorEnvironmentAsset) {
        floorEnvironmentAsset.surfaceColliders = Object.freeze([
          ...floorEnvironmentAsset.surfaceColliders,
          structuredClone(floorEnvironmentAsset.surfaceColliders[0])
        ]);

        return floorEnvironmentAsset;
      }
    },
    {
      bundleId: "exact-match-floor-size-drift",
      expectedError: /requires collider size to match render size exactly/,
      mutateFloorAsset(floorEnvironmentAsset) {
        floorEnvironmentAsset.surfaceColliders = Object.freeze([
          Object.freeze({
            ...floorEnvironmentAsset.surfaceColliders[0],
            size: Object.freeze({
              ...floorEnvironmentAsset.surfaceColliders[0].size,
              y: floorEnvironmentAsset.surfaceColliders[0].size.y + 0.2
            })
          })
        ]);

        return floorEnvironmentAsset;
      }
    },
    {
      bundleId: "exact-match-floor-center-drift",
      expectedError: /requires collider center to match render bounds exactly/,
      mutateFloorAsset(floorEnvironmentAsset) {
        floorEnvironmentAsset.surfaceColliders = Object.freeze([
          Object.freeze({
            ...floorEnvironmentAsset.surfaceColliders[0],
            center: Object.freeze({
              ...floorEnvironmentAsset.surfaceColliders[0].center,
              y: floorEnvironmentAsset.surfaceColliders[0].center.y - 0.2
            })
          })
        ]);

        return floorEnvironmentAsset;
      }
    }
  ];

  try {
    for (const scenario of previewScenarios) {
      registerMetaverseWorldBundlePreviewEntry({
        bundle: createPreviewBundleWithFloor(
          scenario.bundleId,
          scenario.mutateFloorAsset
        ),
        bundleId: scenario.bundleId,
        label: `Exact Match Proof ${scenario.bundleId}`,
        mapEditorProjectSettings: null,
        sourceBundleId: "staging-ground"
      });

      assert.throws(
        () => loadMetaverseEnvironmentProofConfig(scenario.bundleId),
        scenario.expectedError
      );

      clearMetaverseWorldBundlePreviewEntry(scenario.bundleId);
    }

    floorAsset.renderModel.lods = [
      ...originalFloorLods,
      {
        ...originalFloorLods[0],
        size: {
          ...originalFloorLods[0].size,
          y: originalFloorLods[0].size.y + 0.2
        },
        tier: "low"
      }
    ];

    assert.throws(
      () => loadMetaverseEnvironmentProofConfig("staging-ground"),
      /requires every procedural LOD to share the same size/
    );
  } finally {
    floorAsset.renderModel.lods = originalFloorLods;

    for (const scenario of previewScenarios) {
      clearMetaverseWorldBundlePreviewEntry(scenario.bundleId);
    }
  }
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
  assert.equal(previewBundle.bundle.launchVariations.length, 3);
  assert.equal(
    previewBundle.bundle.sceneObjects[0]?.capabilities[0]?.kind,
    "launch-target"
  );
});

test("map editor validate-and-run accepts terrain-only authored exports without environment asset families", async () => {
  const {
    addMapEditorTerrainPatchDraft,
    createMapEditorProject
  } = await clientLoader.load(
    "/src/engine-tool/project/map-editor-project-state.ts"
  );
  const { validateAndRegisterMapEditorPreviewBundle } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-run-preview.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const {
    createMetaverseEnvironmentProofConfig
  } = await clientLoader.load(
    "/src/metaverse/world/proof/create-metaverse-environment-proof-config.ts"
  );
  const loadedBundle = loadMetaverseMapBundle("staging-ground");
  const terrainProject = addMapEditorTerrainPatchDraft(
    createMapEditorProject(loadedBundle),
    Object.freeze({ x: 0, y: 0, z: 0 })
  );
  const previewProject = Object.freeze({
    ...terrainProject,
    placementDrafts: Object.freeze(
      []
    ),
    selectedPlacementId: null
  });
  let fetchCalls = 0;
  const previewResult = await validateAndRegisterMapEditorPreviewBundle(
    previewProject,
    {
      async fetch() {
        fetchCalls += 1;

        return {
          async json() {
            return {
              status: "registered"
            };
          },
          ok: true
        };
      }
    }
  );

  assert.equal(previewResult.validation.valid, true);
  assert.notEqual(previewResult.launchSelection, null);
  assert.equal(previewResult.registrationError, null);
  assert.equal(fetchCalls, 1);
  assert.doesNotThrow(() =>
    createMetaverseEnvironmentProofConfig(
      loadMetaverseMapBundle(previewResult.launchSelection.bundleId)
    )
  );
});

test("map editor validation rejects invalid terrain sample and material layer exports", async () => {
  const {
    addMapEditorTerrainPatchDraft,
    createMapEditorProject,
    updateMapEditorTerrainPatchDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { validateMapEditorProject } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-project-validation.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const projectWithTerrain = addMapEditorTerrainPatchDraft(
    createMapEditorProject(loadMetaverseMapBundle("staging-ground")),
    Object.freeze({ x: 0, y: 0, z: 0 })
  );
  const terrainId = projectWithTerrain.terrainPatchDrafts.at(-1)?.terrainPatchId;

  assert.notEqual(terrainId, undefined);

  const invalidProject = updateMapEditorTerrainPatchDraft(
    projectWithTerrain,
    terrainId,
    (terrainDraft) => ({
      ...terrainDraft,
      heightSamples: Object.freeze([0, 1, Number.NaN, 2]),
      materialLayers: Object.freeze([
        ...terrainDraft.materialLayers,
        Object.freeze({
          layerId:
            terrainDraft.materialLayers[0]?.layerId ?? "terrain:duplicate",
          materialId: "terrain-rock",
          weightSamples: Object.freeze([1, 1])
        })
      ]),
      sampleSpacingMeters: 0
    })
  );
  const validation = validateMapEditorProject(invalidProject);

  assert.equal(validation.valid, false);
  assert.equal(
    validation.errors.some((error) =>
      /must have positive sample spacing/.test(error)
    ),
    true
  );
  assert.equal(
    validation.errors.some((error) => /non-finite height samples/.test(error)),
    true
  );
  assert.equal(
    validation.errors.some((error) =>
      /material layer id .* is duplicated/.test(error)
    ),
    true
  );
  assert.equal(
    validation.errors.some((error) => /weights must match its sample grid/.test(error)),
    true
  );
});

test("map editor preview registration pushes authored player spawns into the active metaverse runtime config", async () => {
  const {
    createMapEditorProject,
    updateMapEditorPlayerSpawnDraft
  } = await clientLoader.load("/src/engine-tool/project/map-editor-project-state.ts");
  const { validateAndRegisterMapEditorPreviewBundle } = await clientLoader.load(
    "/src/engine-tool/run/map-editor-run-preview.ts"
  );
  const { loadMetaverseMapBundle } = await clientLoader.load(
    "/src/metaverse/world/map-bundles/load-metaverse-map-bundle.ts"
  );
  const { mapEditorBuildGridUnitMeters } = await clientLoader.load(
    "/src/engine-tool/build/map-editor-build-placement.ts"
  );
  const { createMetaverseRuntimeConfig } = await clientLoader.load(
    "/src/metaverse/config/metaverse-runtime.ts"
  );

  const initialProject = createMapEditorProject(
    loadMetaverseMapBundle("staging-ground")
  );
  const firstSpawnId = initialProject.playerSpawnDrafts[0]?.spawnId;

  assert.notEqual(firstSpawnId, undefined);

  const project = updateMapEditorPlayerSpawnDraft(
    initialProject,
    firstSpawnId,
    (spawnDraft) => ({
      ...spawnDraft,
      position: {
        ...spawnDraft.position,
        x: spawnDraft.position.x + 9,
        z: spawnDraft.position.z - 5
      },
      yawRadians: Math.PI * 0.5
    })
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
  const previewBundle = loadMetaverseMapBundle(previewResult.launchSelection.bundleId);
  const runtimeConfig = createMetaverseRuntimeConfig(
    previewResult.launchSelection.bundleId
  );
  const previewSpawn = previewBundle.bundle.playerSpawnNodes[0];

  assert.equal(previewResult.validation.valid, true);
  assert.equal(previewResult.registrationError, null);
  assert.notEqual(previewSpawn, undefined);
  assert.equal(runtimeConfig.groundedBody.spawnPosition.x, previewSpawn.position.x);
  assert.equal(runtimeConfig.groundedBody.spawnPosition.z, previewSpawn.position.z);
  assert.equal(
    runtimeConfig.camera.spawnPosition.x,
    previewSpawn.position.x
  );
  assert.equal(
    runtimeConfig.camera.spawnPosition.z,
    previewSpawn.position.z - 0.24
  );
  assert.equal(runtimeConfig.camera.initialYawRadians, previewSpawn.yawRadians);
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
  const { mapEditorBuildGridUnitMeters } = await clientLoader.load(
    "/src/engine-tool/build/map-editor-build-placement.ts"
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
          footprint: {
            ...waterRegionDraft.footprint,
            centerX: waterRegionDraft.footprint.centerX + 7,
            sizeCellsZ: waterRegionDraft.footprint.sizeCellsZ + 3
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
    project.waterRegionDrafts[0]?.footprint.centerX
  );
  assert.equal(
    runtimeConfig.waterRegionSnapshots[0]?.halfExtents.z,
    project.waterRegionDrafts[0]?.footprint.sizeCellsZ *
      mapEditorBuildGridUnitMeters *
      0.5
  );
  assert.deepEqual(runtimeConfig.environment.fogColor, [0.78, 0.6, 0.48]);
  assert.deepEqual(runtimeConfig.ocean.nearColor, [0.34, 0.41, 0.58]);
  assert.equal(runtimeConfig.groundedBody.baseSpeedUnitsPerSecond, 9.1);
  assert.equal(runtimeConfig.swim.baseSpeedUnitsPerSecond, 7.1);
  assert.equal(runtimeConfig.movement.worldRadius, 132);
});
