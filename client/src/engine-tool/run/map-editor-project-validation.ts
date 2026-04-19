import { readMetaverseGameplayProfile } from "@webgpu-metaverse/shared/metaverse/world";

import type { MapEditorProjectSnapshot } from "@/engine-tool/project/map-editor-project-state";

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

export function validateMapEditorProject(
  project: MapEditorProjectSnapshot
): MapEditorProjectValidationResult {
  const errors: string[] = [];

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

  if (project.launchVariationDrafts.length === 0) {
    errors.push("The map needs at least one saved launch variation.");
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

  return Object.freeze({
    errors: Object.freeze(errors),
    valid: errors.length === 0
  });
}
