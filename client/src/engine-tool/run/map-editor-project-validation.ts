import { readMetaverseGameplayProfile } from "@webgpu-metaverse/shared/metaverse/world";

import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";
import {
  createLoadedMetaverseMapBundleSnapshot
} from "@/metaverse/world/map-bundles";
import {
  createMetaverseEnvironmentProofConfig
} from "@/metaverse/world/proof/create-metaverse-environment-proof-config";

import { exportMapEditorProjectToMetaverseMapBundle } from "./export-map-editor-project-to-metaverse-map-bundle";

function readDuplicateIds(ids: readonly string[]): readonly string[] {
  const duplicates = new Set<string>();
  const seenIds = new Set<string>();

  for (const id of ids) {
    if (seenIds.has(id)) {
      duplicates.add(id);
      continue;
    }

    seenIds.add(id);
  }

  return Object.freeze([...duplicates]);
}

export interface MapEditorProjectValidationResult {
  readonly errors: readonly string[];
  readonly valid: boolean;
}

function hasTeamSpawn(
  project: MapEditorProjectSnapshot,
  teamId: "blue" | "red"
): boolean {
  return project.playerSpawnDrafts.some((spawn) => spawn.teamId === teamId);
}

function hasGameplayVolume(
  project: MapEditorProjectSnapshot,
  volumeKind: MapEditorProjectSnapshot["gameplayVolumeDrafts"][number]["volumeKind"],
  teamId?: "blue" | "red"
): boolean {
  return project.gameplayVolumeDrafts.some(
    (volume) =>
      volume.volumeKind === volumeKind &&
      (teamId === undefined || volume.teamId === teamId)
  );
}

export function validateMapEditorProject(
  project: MapEditorProjectSnapshot
): MapEditorProjectValidationResult {
  const errors: string[] = [];
  const selectedLaunchVariation =
    project.selectedLaunchVariationId === null
      ? null
      : project.launchVariationDrafts.find(
          (launchVariation) =>
            launchVariation.variationId === project.selectedLaunchVariationId
        ) ?? null;
  const hasTeamDeathmatchLaunch =
    selectedLaunchVariation?.matchMode === "team-deathmatch";
  const hasTeamDeathmatchArenaAuthoring =
    project.structuralDrafts.length > 0 ||
    project.gameplayVolumeDrafts.some(
      (volumeDraft) =>
        volumeDraft.volumeKind === "team-zone" ||
        volumeDraft.volumeKind === "combat-lane" ||
        volumeDraft.volumeKind === "cover-volume"
    );

  if (project.playerSpawnDrafts.length === 0) {
    errors.push("The map needs at least one authored player spawn.");
  }

  if (readMetaverseGameplayProfile(project.gameplayProfileId) === null) {
    errors.push(
      `Gameplay profile ${project.gameplayProfileId} is not registered in shared metaverse gameplay profiles.`
    );
  }

  for (const duplicatePlacementId of readDuplicateIds(
    project.placementDrafts.map((placementDraft) => placementDraft.placementId)
  )) {
    errors.push(`Placement id ${duplicatePlacementId} is duplicated.`);
  }

  for (const placementDraft of project.placementDrafts) {
    if (
      placementDraft.scale.x < 0.1 ||
      placementDraft.scale.y < 0.1 ||
      placementDraft.scale.z < 0.1
    ) {
      errors.push(
        `Placement ${placementDraft.placementId} must keep all size axes at least 0.1.`
      );
    }
  }

  for (const duplicateSpawnId of readDuplicateIds(
    project.playerSpawnDrafts.map((spawnDraft) => spawnDraft.spawnId)
  )) {
    errors.push(`Spawn id ${duplicateSpawnId} is duplicated.`);
  }

  if (project.playerSpawnSelectionDraft.enemyAvoidanceRadiusMeters < 0) {
    errors.push("Enemy avoidance radius must stay at or above 0.");
  }

  if (project.playerSpawnSelectionDraft.homeTeamBiasMeters < 0) {
    errors.push("Home team bias must stay at or above 0.");
  }

  for (const duplicateSceneObjectId of readDuplicateIds(
    project.sceneObjectDrafts.map((sceneObjectDraft) => sceneObjectDraft.objectId)
  )) {
    errors.push(`Scene object id ${duplicateSceneObjectId} is duplicated.`);
  }

  for (const duplicateLaunchVariationId of readDuplicateIds(
    project.launchVariationDrafts.map(
      (launchVariationDraft) => launchVariationDraft.variationId
    )
  )) {
    errors.push(`Launch variation id ${duplicateLaunchVariationId} is duplicated.`);
  }

  for (const duplicateWaterRegionId of readDuplicateIds(
    project.waterRegionDrafts.map(
      (waterRegionDraft) => waterRegionDraft.waterRegionId
    )
  )) {
    errors.push(`Water region id ${duplicateWaterRegionId} is duplicated.`);
  }

  for (const duplicateTerrainPatchId of readDuplicateIds(
    project.terrainPatchDrafts.map(
      (terrainPatchDraft) => terrainPatchDraft.terrainPatchId
    )
  )) {
    errors.push(`Terrain id ${duplicateTerrainPatchId} is duplicated.`);
  }

  for (const terrainPatchDraft of project.terrainPatchDrafts) {
    const sampleCount =
      terrainPatchDraft.sampleCountX * terrainPatchDraft.sampleCountZ;

    if (
      terrainPatchDraft.sampleCountX < 2 ||
      terrainPatchDraft.sampleCountZ < 2 ||
      !Number.isInteger(terrainPatchDraft.sampleCountX) ||
      !Number.isInteger(terrainPatchDraft.sampleCountZ)
    ) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} must have at least 2 integer samples on each axis.`
      );
    }

    if (
      terrainPatchDraft.sampleSpacingMeters <= 0 ||
      !Number.isFinite(terrainPatchDraft.sampleSpacingMeters)
    ) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} must have positive sample spacing.`
      );
    }

    if (terrainPatchDraft.heightSamples.length !== sampleCount) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} height samples must match its sample grid.`
      );
    }

    if (
      !terrainPatchDraft.heightSamples.every((heightSample) =>
        Number.isFinite(heightSample)
      )
    ) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} has non-finite height samples.`
      );
    }

    if (
      terrainPatchDraft.waterLevelMeters !== null &&
      !Number.isFinite(terrainPatchDraft.waterLevelMeters)
    ) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} water level must be finite when set.`
      );
    }

    for (const duplicateLayerId of readDuplicateIds(
      terrainPatchDraft.materialLayers.map((layer) => layer.layerId)
    )) {
      errors.push(
        `Terrain ${terrainPatchDraft.terrainPatchId} material layer id ${duplicateLayerId} is duplicated.`
      );
    }

    for (const materialLayer of terrainPatchDraft.materialLayers) {
      if (materialLayer.weightSamples.length !== sampleCount) {
        errors.push(
          `Terrain ${terrainPatchDraft.terrainPatchId} material layer ${materialLayer.layerId} weights must match its sample grid.`
        );
      }

      if (
        !materialLayer.weightSamples.every((weightSample) =>
          Number.isFinite(weightSample)
        )
      ) {
        errors.push(
          `Terrain ${terrainPatchDraft.terrainPatchId} material layer ${materialLayer.layerId} has non-finite weights.`
        );
      }
    }
  }

  for (const duplicateStructureId of readDuplicateIds(
    project.structuralDrafts.map((structureDraft) => structureDraft.structureId)
  )) {
    errors.push(`Structure id ${duplicateStructureId} is duplicated.`);
  }

  for (const duplicateVolumeId of readDuplicateIds(
    project.gameplayVolumeDrafts.map((volumeDraft) => volumeDraft.volumeId)
  )) {
    errors.push(`Gameplay volume id ${duplicateVolumeId} is duplicated.`);
  }

  for (const duplicateLightId of readDuplicateIds(
    project.lightDrafts.map((lightDraft) => lightDraft.lightId)
  )) {
    errors.push(`Light id ${duplicateLightId} is duplicated.`);
  }

  for (const structureDraft of project.structuralDrafts) {
    if (
      structureDraft.grid.cellsX < 1 ||
      structureDraft.grid.cellsZ < 1 ||
      structureDraft.size.x <= 0 ||
      structureDraft.size.y <= 0 ||
      structureDraft.size.z <= 0
    ) {
      errors.push(`Structure ${structureDraft.structureId} has invalid grid dimensions.`);
    }
  }

  if (hasTeamDeathmatchLaunch && hasTeamDeathmatchArenaAuthoring) {
    if (!hasTeamSpawn(project, "blue")) {
      errors.push("Team deathmatch maps need at least one blue player spawn.");
    }

    if (!hasTeamSpawn(project, "red")) {
      errors.push("Team deathmatch maps need at least one red player spawn.");
    }

    if (!hasGameplayVolume(project, "team-zone", "blue")) {
      errors.push("Team deathmatch maps need a blue team zone.");
    }

    if (!hasGameplayVolume(project, "team-zone", "red")) {
      errors.push("Team deathmatch maps need a red team zone.");
    }

    if (!hasGameplayVolume(project, "combat-lane")) {
      errors.push("Team deathmatch maps need at least one authored combat lane.");
    }

    if (!hasGameplayVolume(project, "cover-volume")) {
      errors.push("Team deathmatch maps need authored cover volumes near combat space.");
    }
  }

  if (
    project.selectedLaunchVariationId !== null &&
    !project.launchVariationDrafts.some(
      (launchVariationDraft) =>
        launchVariationDraft.variationId === project.selectedLaunchVariationId
    )
  ) {
    errors.push(
      `Selected launch variation ${project.selectedLaunchVariationId} does not exist in the project.`
    );
  }

  if (errors.length === 0) {
    try {
      createMetaverseEnvironmentProofConfig(
        createLoadedMetaverseMapBundleSnapshot(
          exportMapEditorProjectToMetaverseMapBundle(project)
        )
      );
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "The exported map bundle failed metaverse environment proof validation."
      );
    }
  }

  return Object.freeze({
    errors: Object.freeze(errors),
    valid: errors.length === 0
  });
}
