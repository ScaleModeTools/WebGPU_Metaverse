import type {
  ExperienceId,
  MetaverseMapPlayerSpawnTeamId
} from "@webgpu-metaverse/shared";

import {
  readMetaverseMapBundleLaunchTargetCapability,
  type LoadedMetaverseMapBundleSnapshot
} from "@/metaverse/world/map-bundles";

export interface MapEditorVector3DraftSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MapEditorPlayerSpawnDraftSnapshot {
  readonly label: string;
  readonly position: MapEditorVector3DraftSnapshot;
  readonly spawnId: string;
  readonly teamId: MetaverseMapPlayerSpawnTeamId;
  readonly yawRadians: number;
}

export interface MapEditorSceneObjectLaunchTargetDraftSnapshot {
  readonly beamColorHex: string;
  readonly experienceId: ExperienceId;
  readonly highlightRadius: number;
  readonly interactionRadius: number;
  readonly ringColorHex: string;
}

export interface MapEditorSceneObjectDraftSnapshot {
  readonly assetId: string | null;
  readonly label: string;
  readonly launchTarget: MapEditorSceneObjectLaunchTargetDraftSnapshot | null;
  readonly objectId: string;
  readonly position: MapEditorVector3DraftSnapshot;
  readonly rotationYRadians: number;
  readonly scale: number;
}

export interface MapEditorWaterRegionDraftSnapshot {
  readonly center: MapEditorVector3DraftSnapshot;
  readonly previewColorHex: string;
  readonly previewOpacity: number;
  readonly rotationYRadians: number;
  readonly size: MapEditorVector3DraftSnapshot;
  readonly waterRegionId: string;
}

const defaultMapEditorWaterPreviewColorHex = "#1f6f8b";
const defaultMapEditorWaterPreviewOpacity = 0.58;

function freezeVector3Draft(
  vector: MapEditorVector3DraftSnapshot
): MapEditorVector3DraftSnapshot {
  return Object.freeze({
    x: vector.x,
    y: vector.y,
    z: vector.z
  });
}

function rgbTupleToHex(
  rgb: readonly [number, number, number]
): string {
  const toChannel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * 255)))
      .toString(16)
      .padStart(2, "0");

  return `#${toChannel(rgb[0])}${toChannel(rgb[1])}${toChannel(rgb[2])}`;
}

export function freezePlayerSpawnDraft(
  draft: MapEditorPlayerSpawnDraftSnapshot
): MapEditorPlayerSpawnDraftSnapshot {
  return Object.freeze({
    ...draft,
    position: freezeVector3Draft(draft.position)
  });
}

export function freezeSceneObjectDraft(
  draft: MapEditorSceneObjectDraftSnapshot
): MapEditorSceneObjectDraftSnapshot {
  return Object.freeze({
    ...draft,
    launchTarget:
      draft.launchTarget === null
        ? null
        : Object.freeze({
            ...draft.launchTarget
          }),
    position: freezeVector3Draft(draft.position)
  });
}

export function freezeWaterRegionDraft(
  draft: MapEditorWaterRegionDraftSnapshot
): MapEditorWaterRegionDraftSnapshot {
  return Object.freeze({
    ...draft,
    center: freezeVector3Draft(draft.center),
    size: freezeVector3Draft(draft.size)
  });
}

export function createPlayerSpawnDrafts(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): readonly MapEditorPlayerSpawnDraftSnapshot[] {
  return Object.freeze(
    loadedBundle.bundle.playerSpawnNodes.map((spawnNode) =>
      freezePlayerSpawnDraft({
        label: spawnNode.label,
        position: spawnNode.position,
        spawnId: spawnNode.spawnId,
        teamId: spawnNode.teamId,
        yawRadians: spawnNode.yawRadians
      })
    )
  );
}

export function createSceneObjectDrafts(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): readonly MapEditorSceneObjectDraftSnapshot[] {
  return Object.freeze(
    loadedBundle.bundle.sceneObjects.map((sceneObject) => {
      const launchTargetCapability =
        readMetaverseMapBundleLaunchTargetCapability(sceneObject);

      return freezeSceneObjectDraft({
        assetId: sceneObject.assetId,
        label: sceneObject.label,
        launchTarget:
          launchTargetCapability === null
            ? null
            : Object.freeze({
                beamColorHex: rgbTupleToHex(launchTargetCapability.beamColor),
                experienceId: launchTargetCapability.experienceId,
                highlightRadius: launchTargetCapability.highlightRadius,
                interactionRadius: launchTargetCapability.interactionRadius,
                ringColorHex: rgbTupleToHex(launchTargetCapability.ringColor)
              }),
        objectId: sceneObject.objectId,
        position: sceneObject.position,
        rotationYRadians: sceneObject.rotationYRadians,
        scale: sceneObject.scale
      })
    })
  );
}

export function createWaterRegionDrafts(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): readonly MapEditorWaterRegionDraftSnapshot[] {
  return Object.freeze(
    loadedBundle.bundle.waterRegions.map((waterRegion) =>
      freezeWaterRegionDraft({
        center: waterRegion.center,
        previewColorHex: defaultMapEditorWaterPreviewColorHex,
        previewOpacity: defaultMapEditorWaterPreviewOpacity,
        rotationYRadians: waterRegion.rotationYRadians,
        size: waterRegion.size,
        waterRegionId: waterRegion.waterRegionId
      })
    )
  );
}
