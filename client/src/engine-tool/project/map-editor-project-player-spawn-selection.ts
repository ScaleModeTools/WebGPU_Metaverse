import type {
  MetaverseMapBundlePlayerSpawnSelectionSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  LoadedMetaverseMapBundleSnapshot
} from "@/metaverse/world/map-bundles";

export interface MapEditorPlayerSpawnSelectionDraftSnapshot {
  readonly enemyAvoidanceRadiusMeters: number;
  readonly homeTeamBiasMeters: number;
}

export function freezePlayerSpawnSelectionDraft(
  draft: MapEditorPlayerSpawnSelectionDraftSnapshot
): MapEditorPlayerSpawnSelectionDraftSnapshot {
  return Object.freeze({
    enemyAvoidanceRadiusMeters: draft.enemyAvoidanceRadiusMeters,
    homeTeamBiasMeters: draft.homeTeamBiasMeters
  });
}

export function createPlayerSpawnSelectionDraft(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): MapEditorPlayerSpawnSelectionDraftSnapshot {
  return freezePlayerSpawnSelectionDraft(
    loadedBundle.bundle
      .playerSpawnSelection satisfies MetaverseMapBundlePlayerSpawnSelectionSnapshot
  );
}
