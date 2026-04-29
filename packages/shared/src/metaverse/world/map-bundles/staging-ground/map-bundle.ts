import {
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians
} from "../../../metaverse-world-spawn-config.js";
import {
  metaverseBuilderFloorTileEnvironmentAssetId,
  metaverseBuilderStepTileEnvironmentAssetId,
  metaverseBuilderWallTileEnvironmentAssetId,
  metaversePlaygroundRangeBarrierEnvironmentAssetId,
  metaversePlaygroundRangeFloorEnvironmentAssetId,
  metaverseWorldSurfaceAssets,
  metaverseWorldWaterRegions,
  type MetaverseWorldSurfaceAssetAuthoring,
  type MetaverseWorldSurfaceVector3Snapshot
} from "../../../metaverse-world-surface-authoring.js";
import { resolveMetaverseWorldSurfaceScaleVector } from "../../../metaverse-world-surface-query.js";
import { defaultMetaverseGameplayProfileId } from "../../metaverse-gameplay-profiles.js";
import {
  defaultMetaverseMapBundlePlayerSpawnSelection,
  type MetaverseMapBundleSceneObjectSnapshot,
  type MetaverseMapBundleSemanticEdgeSnapshot,
  type MetaverseMapBundleSemanticModuleSnapshot,
  type MetaverseMapBundleSemanticRegionSnapshot,
  type MetaverseMapBundleSemanticSurfaceSnapshot,
  type MetaverseMapBundleSemanticWorldSnapshot,
  type MetaverseMapBundleSnapshot
} from "../metaverse-map-bundle.js";
import { compileMetaverseMapBundleSemanticWorld } from "../compile-metaverse-semantic-world.js";

function createRgbTuple(
  red: number,
  green: number,
  blue: number
): readonly [number, number, number] {
  return Object.freeze([red, green, blue]);
}

function createSpawnNode(
  label: string,
  spawnId: string,
  teamId: "blue" | "neutral" | "red",
  x: number,
  z: number
) {
  return Object.freeze({
    label,
    position: Object.freeze({
      x,
      y: metaverseWorldGroundedSpawnPosition.y,
      z
    }),
    spawnId,
    teamId,
    yawRadians: metaverseWorldInitialYawRadians
  });
}

function resolveScaledColliderSize(
  surfaceAsset: MetaverseWorldSurfaceAssetAuthoring,
  placement: {
    readonly scale:
      | number
      | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
  }
): MetaverseWorldSurfaceVector3Snapshot {
  const scale = resolveMetaverseWorldSurfaceScaleVector(placement.scale);
  const collider = surfaceAsset.surfaceColliders[0] ?? null;

  if (collider === null) {
    return Object.freeze({
      x: Math.max(4, scale.x * 4),
      y: Math.max(0.5, scale.y * 0.5),
      z: Math.max(4, scale.z * 4)
    });
  }

  return Object.freeze({
    x: Math.max(0.5, collider.size.x * scale.x),
    y: Math.max(0.5, collider.size.y * scale.y),
    z: Math.max(0.5, collider.size.z * scale.z)
  });
}

function resolveSurfaceSupportTopElevationMeters(
  surfaceAsset: MetaverseWorldSurfaceAssetAuthoring,
  placement: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly scale:
      | number
      | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
  }
): number {
  const scale = resolveMetaverseWorldSurfaceScaleVector(placement.scale);
  const supportCollider =
    surfaceAsset.surfaceColliders.find(
      (collider) => collider.traversalAffordance === "support"
    ) ?? surfaceAsset.surfaceColliders[0] ?? null;

  if (supportCollider === null) {
    return placement.position.y;
  }

  return (
    placement.position.y +
    (supportCollider.center.y + supportCollider.size.y * 0.5) * scale.y
  );
}

function createSemanticSurface(
  surfaceId: string,
  label: string,
  placement: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly rotationYRadians: number;
    readonly scale:
      | number
      | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
  },
  surfaceAsset: MetaverseWorldSurfaceAssetAuthoring,
  elevationMeters = placement.position.y
): MetaverseMapBundleSemanticSurfaceSnapshot {
  const size = resolveScaledColliderSize(surfaceAsset, placement);

  return Object.freeze({
    center: Object.freeze({
      x: placement.position.x,
      y: elevationMeters,
      z: placement.position.z
    }),
    elevation: elevationMeters,
    kind: "flat-slab",
    label,
    rotationYRadians: placement.rotationYRadians,
    size,
    slopeRiseMeters: 0,
    surfaceId,
    terrainPatchId: null
  });
}

function createFloorRegion(
  regionId: string,
  surfaceId: string,
  size: MetaverseWorldSurfaceVector3Snapshot
): MetaverseMapBundleSemanticRegionSnapshot {
  return Object.freeze({
    holes: Object.freeze([]),
    label: "Playground Floor",
    materialReferenceId: null,
    outerLoop: Object.freeze({
      points: Object.freeze([
        Object.freeze({
          x: -size.x * 0.5,
          z: -size.z * 0.5
        }),
        Object.freeze({
          x: size.x * 0.5,
          z: -size.z * 0.5
        }),
        Object.freeze({
          x: size.x * 0.5,
          z: size.z * 0.5
        }),
        Object.freeze({
          x: -size.x * 0.5,
          z: size.z * 0.5
        })
      ])
    }),
    regionId,
    regionKind: "floor",
    surfaceId
  });
}

function createBarrierEdge(
  edgeId: string,
  surfaceId: string,
  size: MetaverseWorldSurfaceVector3Snapshot
): MetaverseMapBundleSemanticEdgeSnapshot {
  return Object.freeze({
    edgeId,
    edgeKind: "wall",
    heightMeters: size.y,
    label: "Range Barrier",
    path: Object.freeze([
      Object.freeze({
        x: -size.x * 0.5,
        z: 0
      }),
      Object.freeze({
        x: size.x * 0.5,
        z: 0
      })
    ]),
    surfaceId,
    thicknessMeters: size.z
  });
}

function createSemanticModule(
  moduleId: string,
  assetId: string,
  placement: {
    readonly position: MetaverseWorldSurfaceVector3Snapshot;
    readonly rotationYRadians: number;
    readonly scale:
      | number
      | {
          readonly x: number;
          readonly y: number;
          readonly z: number;
        };
  },
  surfaceAsset: MetaverseWorldSurfaceAssetAuthoring
): MetaverseMapBundleSemanticModuleSnapshot {
  return Object.freeze({
    assetId,
    collisionEnabled: true,
    collisionPath: surfaceAsset.collisionPath,
    collider: surfaceAsset.collider,
    dynamicBody: surfaceAsset.dynamicBody,
    entries: "entries" in surfaceAsset ? surfaceAsset.entries ?? null : null,
    isVisible: true,
    label: assetId,
    materialReferenceId: null,
    moduleId,
    notes: "",
    placementMode: surfaceAsset.placement,
    position: Object.freeze({
      x: placement.position.x,
      y: placement.position.y,
      z: placement.position.z
    }),
    rotationYRadians: placement.rotationYRadians,
    scale: resolveMetaverseWorldSurfaceScaleVector(placement.scale),
    seats: "seats" in surfaceAsset ? surfaceAsset.seats ?? null : null,
    surfaceColliders: surfaceAsset.surfaceColliders,
    traversalAffordance: surfaceAsset.traversalAffordance
  });
}

function createSemanticWorldFromSurfaceAssets(): MetaverseMapBundleSemanticWorldSnapshot {
  const surfaces: MetaverseMapBundleSemanticSurfaceSnapshot[] = [];
  const regions: MetaverseMapBundleSemanticRegionSnapshot[] = [];
  const edges: MetaverseMapBundleSemanticEdgeSnapshot[] = [];
  const modules: MetaverseMapBundleSemanticModuleSnapshot[] = [];

  for (const surfaceAsset of metaverseWorldSurfaceAssets) {
    surfaceAsset.placements.forEach((placement, placementIndex) => {
      const semanticId = `${surfaceAsset.environmentAssetId}:${placementIndex + 1}`;
      const scaledColliderSize = resolveScaledColliderSize(surfaceAsset, placement);

      if (
        surfaceAsset.environmentAssetId ===
        metaversePlaygroundRangeFloorEnvironmentAssetId
      ) {
        const surfaceId = `surface:${semanticId}`;

        surfaces.push(
          createSemanticSurface(
            surfaceId,
            "Playground Surface",
            placement,
            surfaceAsset,
            resolveSurfaceSupportTopElevationMeters(surfaceAsset, placement)
          )
        );
        regions.push(createFloorRegion(`region:${semanticId}`, surfaceId, scaledColliderSize));
        return;
      }

      if (
        surfaceAsset.environmentAssetId ===
        metaversePlaygroundRangeBarrierEnvironmentAssetId
      ) {
        const surfaceId = `surface:${semanticId}`;

        surfaces.push(
          createSemanticSurface(surfaceId, "Barrier Surface", placement, surfaceAsset)
        );
        edges.push(createBarrierEdge(`edge:${semanticId}`, surfaceId, scaledColliderSize));
        return;
      }

      modules.push(
        createSemanticModule(
          `module:${semanticId}`,
          surfaceAsset.environmentAssetId,
          placement,
          surfaceAsset
        )
      );
    });
  }

  return Object.freeze({
    compatibilityAssetIds: Object.freeze({
      connectorAssetId: metaverseBuilderStepTileEnvironmentAssetId,
      floorAssetId: metaverseBuilderFloorTileEnvironmentAssetId,
      wallAssetId: metaverseBuilderWallTileEnvironmentAssetId
    }),
    connectors: Object.freeze([]),
    edges: Object.freeze(edges),
    gameplayVolumes: Object.freeze([]),
    lights: Object.freeze([]),
    materialDefinitions: Object.freeze([]),
    modules: Object.freeze(modules),
    regions: Object.freeze(regions),
    surfaces: Object.freeze(surfaces),
    structures: Object.freeze([]),
    terrainPatches: Object.freeze([])
  });
}

function createSceneObjects(includeDuckHuntPortal: boolean): readonly MetaverseMapBundleSceneObjectSnapshot[] {
  if (!includeDuckHuntPortal) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      assetId: null,
      capabilities: Object.freeze([
        Object.freeze({
          beamColor: createRgbTuple(0.96, 0.81, 0.38),
          experienceId: "duck-hunt",
          highlightRadius: 34,
          interactionRadius: 18,
          kind: "launch-target",
          ringColor: createRgbTuple(0.96, 0.73, 0.25)
        })
      ]),
      label: "Duck Hunt!",
      objectId: "duck-hunt-launch-portal",
      position: Object.freeze({
        x: 0,
        y: 6,
        z: -34
      }),
      rotationYRadians: 0,
      scale: 1
    })
  ]);
}

function createBaseBundle(
  mapId: string,
  label: string,
  description: string,
  includeDuckHuntPortal: boolean,
  launchVariations: MetaverseMapBundleSnapshot["launchVariations"]
): MetaverseMapBundleSnapshot {
  const semanticWorld = createSemanticWorldFromSurfaceAssets();
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(semanticWorld);

  return Object.freeze({
    compiledWorld,
    description,
    environmentAssets: compiledWorld.compatibilityEnvironmentAssets,
    gameplayProfileId: defaultMetaverseGameplayProfileId,
    label,
    launchVariations,
    mapId,
    playerSpawnNodes: Object.freeze([
      createSpawnNode(
        "Default shell spawn",
        "shell-default-spawn",
        "neutral",
        metaverseWorldGroundedSpawnPosition.x,
        metaverseWorldGroundedSpawnPosition.z
      ),
      createSpawnNode("Blue team north", "shell-blue-north", "blue", -17.2, -22.2),
      createSpawnNode("Blue team south", "shell-blue-south", "blue", -17.2, -7.4),
      createSpawnNode("Red team north", "shell-red-north", "red", 0.8, -22.2),
      createSpawnNode("Red team south", "shell-red-south", "red", 0.8, -7.4)
    ]),
    playerSpawnSelection: defaultMetaverseMapBundlePlayerSpawnSelection,
    presentationProfileIds: Object.freeze({
      cameraProfileId: "shell-default-camera",
      characterPresentationProfileId: "shell-default-character-presentation",
      environmentPresentationProfileId: "shell-default-environment-presentation",
      hudProfileId: "shell-default-hud"
    }),
    resourceSpawns: Object.freeze([]),
    sceneObjects: createSceneObjects(includeDuckHuntPortal),
    semanticWorld,
    waterRegions: metaverseWorldWaterRegions
  });
}

export const stagingGroundMapBundle = createBaseBundle(
  "staging-ground",
  "Staging Ground",
  "Semantic staging-ground shell bundle compiled from the authored support slice.",
  true,
  Object.freeze([
    Object.freeze({
      description: "Stay in the shell and preview the authored staging-ground map.",
      experienceId: null,
      gameplayVariationId: null,
      label: "Free Roam",
      matchMode: "free-roam",
      variationId: "shell-free-roam",
      vehicleLayoutId: null,
      weaponLayoutId: null
    }),
    Object.freeze({
      description:
        "Boot the staging-ground instance into authoritative red-vs-blue team deathmatch.",
      experienceId: null,
      gameplayVariationId: "metaverse-shell-team-deathmatch-v1",
      label: "Shell Team Deathmatch",
      matchMode: "team-deathmatch",
      variationId: "shell-team-deathmatch",
      vehicleLayoutId: null,
      weaponLayoutId: "metaverse-tdm-pistol-rocket-layout"
    }),
    Object.freeze({
      description:
        "Launch the current Duck Hunt preview slice from this authored map variation.",
      experienceId: "duck-hunt",
      gameplayVariationId: "duck-hunt-standard-preview",
      label: "Duck Hunt Preview",
      matchMode: "free-roam",
      variationId: "duck-hunt-preview",
      vehicleLayoutId: "staging-ground-default-vehicle-layout",
      weaponLayoutId: "duck-hunt-default-pistol-layout"
    })
  ])
);
