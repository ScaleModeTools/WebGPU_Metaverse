import type {
  ExperienceId,
  MetaverseMatchModeId
} from "@webgpu-metaverse/shared";

import type { LoadedMetaverseMapBundleSnapshot } from "@/metaverse/world/map-bundles";

export interface MapEditorLaunchVariationDraftSnapshot {
  readonly description: string;
  readonly experienceId: ExperienceId | null;
  readonly gameplayVariationId: string | null;
  readonly label: string;
  readonly matchMode: MetaverseMatchModeId | null;
  readonly variationId: string;
  readonly vehicleLayoutId: string | null;
  readonly weaponLayoutId: string | null;
}

export function createMapEditorSceneDefaultLaunchVariationDraft(
  bundleId: string
): MapEditorLaunchVariationDraftSnapshot {
  return freezeLaunchVariationDraft({
    description: "",
    experienceId: null,
    gameplayVariationId: null,
    label: "Scene Default",
    matchMode: "free-roam",
    variationId: `${bundleId}:scene-default`,
    vehicleLayoutId: null,
    weaponLayoutId: null
  });
}

export function freezeLaunchVariationDraft(
  draft: MapEditorLaunchVariationDraftSnapshot
): MapEditorLaunchVariationDraftSnapshot {
  // The editor launches authored scene resources until per-map layout authoring exists.
  return Object.freeze({
    description: draft.description,
    experienceId: draft.experienceId,
    gameplayVariationId: null,
    label: draft.label,
    matchMode: draft.matchMode,
    variationId: draft.variationId,
    vehicleLayoutId: null,
    weaponLayoutId: null
  });
}

export function createLaunchVariationDrafts(
  loadedBundle: LoadedMetaverseMapBundleSnapshot
): readonly MapEditorLaunchVariationDraftSnapshot[] {
  return Object.freeze(
    loadedBundle.bundle.launchVariations.map((launchVariation) =>
      freezeLaunchVariationDraft({
        description: launchVariation.description,
        experienceId: launchVariation.experienceId,
        gameplayVariationId: launchVariation.gameplayVariationId,
        label: launchVariation.label,
        matchMode: launchVariation.matchMode,
        variationId: launchVariation.variationId,
        vehicleLayoutId: launchVariation.vehicleLayoutId,
        weaponLayoutId: launchVariation.weaponLayoutId
      })
    )
  );
}

export function resolveMapEditorLaunchVariationDraftsForExport(
  bundleId: string,
  launchVariationDrafts: readonly MapEditorLaunchVariationDraftSnapshot[]
): readonly MapEditorLaunchVariationDraftSnapshot[] {
  if (launchVariationDrafts.length === 0) {
    return Object.freeze([createMapEditorSceneDefaultLaunchVariationDraft(bundleId)]);
  }

  return Object.freeze(
    launchVariationDrafts.map((launchVariationDraft) =>
      freezeLaunchVariationDraft(launchVariationDraft)
    )
  );
}
