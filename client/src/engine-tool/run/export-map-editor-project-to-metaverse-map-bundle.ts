import {
  compileMetaverseMapBundleSemanticWorld,
  type MetaverseMapBundleLaunchVariationSnapshot,
  type MetaverseMapBundleCompiledWorldSnapshot,
  type MetaverseMapBundleResourceSpawnSnapshot,
  type MetaverseMapBundleSceneObjectSnapshot,
  type MetaverseMapBundleSnapshot,
  type MetaverseMapBundleSpawnNodeSnapshot,
  resolveMetaverseMapPlayerSpawnSupportPosition
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  createSemanticWorldFromProject,
  type MapEditorProjectSnapshot
} from "@/engine-tool/project/map-editor-project-state";
import {
  resolveMapEditorLaunchVariationDraftsForExport
} from "@/engine-tool/project/map-editor-project-launch-variations";
import {
  resolveMapEditorWaterRegionCenter,
  resolveMapEditorWaterRegionSize
} from "@/engine-tool/project/map-editor-project-scene-drafts";

function toReadonlyRgbTuple(
  hexColor: string
): readonly [number, number, number] {
  const normalizedColor = hexColor.trim();

  if (!/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return Object.freeze([1, 1, 1]);
  }

  return Object.freeze([
    Number.parseInt(normalizedColor.slice(1, 3), 16) / 255,
    Number.parseInt(normalizedColor.slice(3, 5), 16) / 255,
    Number.parseInt(normalizedColor.slice(5, 7), 16) / 255
  ]);
}

function resolvePlayerSpawnNodes(
  project: MapEditorProjectSnapshot,
  compiledWorld: MetaverseMapBundleCompiledWorldSnapshot
): readonly MetaverseMapBundleSpawnNodeSnapshot[] {
  return Object.freeze(
    project.playerSpawnDrafts.map((spawnDraft) => {
      const position = resolveMetaverseMapPlayerSpawnSupportPosition({
        compiledWorld,
        spawnPosition: spawnDraft.position
      });

      return Object.freeze({
        label: spawnDraft.label,
        position: Object.freeze({
          x: position.x,
          y: position.y,
          z: position.z
        }),
        spawnId: spawnDraft.spawnId,
        teamId: spawnDraft.teamId,
        yawRadians: spawnDraft.yawRadians
      } satisfies MetaverseMapBundleSpawnNodeSnapshot);
    })
  );
}

function resolveSceneObjects(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleSceneObjectSnapshot[] {
  return Object.freeze(
    project.sceneObjectDrafts.map((sceneObjectDraft) =>
      Object.freeze({
        assetId: sceneObjectDraft.assetId,
        capabilities:
          sceneObjectDraft.launchTarget === null
            ? Object.freeze([])
            : Object.freeze([
                Object.freeze({
                  beamColor: toReadonlyRgbTuple(
                    sceneObjectDraft.launchTarget.beamColorHex
                  ),
                  experienceId: sceneObjectDraft.launchTarget.experienceId,
                  highlightRadius: sceneObjectDraft.launchTarget.highlightRadius,
                  interactionRadius:
                    sceneObjectDraft.launchTarget.interactionRadius,
                  kind: "launch-target" as const,
                  ringColor: toReadonlyRgbTuple(
                    sceneObjectDraft.launchTarget.ringColorHex
                  )
                })
              ]),
        label: sceneObjectDraft.label,
        objectId: sceneObjectDraft.objectId,
        position: Object.freeze({
          x: sceneObjectDraft.position.x,
          y: sceneObjectDraft.position.y,
          z: sceneObjectDraft.position.z
        }),
        rotationYRadians: sceneObjectDraft.rotationYRadians,
        scale: sceneObjectDraft.scale
      } satisfies MetaverseMapBundleSceneObjectSnapshot)
    )
  );
}

function resolveResourceSpawns(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleResourceSpawnSnapshot[] {
  return Object.freeze(
    project.resourceSpawnDrafts.map((resourceSpawnDraft) =>
      Object.freeze({
        ammoGrantRounds: resourceSpawnDraft.ammoGrantRounds,
        assetId: resourceSpawnDraft.assetId,
        label: resourceSpawnDraft.label,
        modeTags: Object.freeze([...resourceSpawnDraft.modeTags]),
        pickupRadiusMeters: resourceSpawnDraft.pickupRadiusMeters,
        position: Object.freeze({
          x: resourceSpawnDraft.position.x,
          y: resourceSpawnDraft.position.y,
          z: resourceSpawnDraft.position.z
        }),
        resourceKind: "weapon-pickup" as const,
        respawnCooldownMs: resourceSpawnDraft.respawnCooldownMs,
        spawnId: resourceSpawnDraft.spawnId,
        weaponId: resourceSpawnDraft.weaponId,
        yawRadians: resourceSpawnDraft.yawRadians
      } satisfies MetaverseMapBundleResourceSpawnSnapshot)
    )
  );
}

function resolveLaunchVariations(
  project: MapEditorProjectSnapshot
): readonly MetaverseMapBundleLaunchVariationSnapshot[] {
  const launchVariationDrafts = resolveMapEditorLaunchVariationDraftsForExport(
    project.bundleId,
    project.launchVariationDrafts
  );

  return Object.freeze(
    launchVariationDrafts.map((launchVariationDraft) =>
      Object.freeze({
        description: launchVariationDraft.description,
        experienceId: launchVariationDraft.experienceId,
        gameplayVariationId: launchVariationDraft.gameplayVariationId,
        label: launchVariationDraft.label,
        matchMode: launchVariationDraft.matchMode,
        variationId: launchVariationDraft.variationId,
        vehicleLayoutId: launchVariationDraft.vehicleLayoutId,
        weaponLayoutId: launchVariationDraft.weaponLayoutId
      } satisfies MetaverseMapBundleLaunchVariationSnapshot)
    )
  );
}

export function exportMapEditorProjectToMetaverseMapBundle(
  project: MapEditorProjectSnapshot
): MetaverseMapBundleSnapshot {
  const semanticWorld = createSemanticWorldFromProject(project);
  const compiledWorld = compileMetaverseMapBundleSemanticWorld(semanticWorld);

  return Object.freeze({
    compiledWorld,
    description: project.description,
    environmentAssets: compiledWorld.compatibilityEnvironmentAssets,
    environmentPresentation: project.environmentPresentation,
    gameplayProfileId: project.gameplayProfileId,
    label: project.bundleLabel,
    launchVariations: resolveLaunchVariations(project),
    mapId: project.bundleId,
    playerSpawnNodes: resolvePlayerSpawnNodes(project, compiledWorld),
    playerSpawnSelection: Object.freeze({
      enemyAvoidanceRadiusMeters:
        project.playerSpawnSelectionDraft.enemyAvoidanceRadiusMeters,
      homeTeamBiasMeters: project.playerSpawnSelectionDraft.homeTeamBiasMeters
    }),
    presentationProfileIds: Object.freeze({
      cameraProfileId: project.cameraProfileId,
      characterPresentationProfileId: project.characterPresentationProfileId,
      environmentPresentationProfileId:
        project.environmentPresentationProfileId,
      hudProfileId: project.hudProfileId
    }),
    resourceSpawns: resolveResourceSpawns(project),
    sceneObjects: resolveSceneObjects(project),
    semanticWorld,
    waterRegions: Object.freeze(
      project.waterRegionDrafts.map((waterRegionDraft) =>
        {
          const center = resolveMapEditorWaterRegionCenter(waterRegionDraft);
          const size = resolveMapEditorWaterRegionSize(waterRegionDraft);

          return Object.freeze({
            center: Object.freeze({
              x: center.x,
              y: center.y,
              z: center.z
            }),
            rotationYRadians: 0,
            size: Object.freeze({
              x: size.x,
              y: size.y,
              z: size.z
            }),
            waterRegionId: waterRegionDraft.waterRegionId
          });
        }
      )
    )
  });
}
