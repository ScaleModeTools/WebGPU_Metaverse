import type {
  ExperienceId,
  GameplaySessionMode,
  MetaverseMapBundleLaunchVariationSnapshot,
  MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared";

export interface MetaverseWorldPreviewLaunchSelectionSnapshot {
  readonly bundleId: string;
  readonly bundleLabel: string;
  readonly experienceId: ExperienceId | null;
  readonly gameplayVariationId: string | null;
  readonly sessionMode: GameplaySessionMode | null;
  readonly sourceBundleId: string;
  readonly variationId: string | null;
  readonly variationLabel: string | null;
  readonly vehicleLayoutId: string | null;
  readonly weaponLayoutId: string | null;
}

export function readMetaverseMapBundleLaunchVariation(
  bundle: MetaverseMapBundleSnapshot,
  variationId: string | null
): MetaverseMapBundleLaunchVariationSnapshot | null {
  if (variationId === null) {
    return bundle.launchVariations[0] ?? null;
  }

  return (
    bundle.launchVariations.find(
      (launchVariation) => launchVariation.variationId === variationId
    ) ?? null
  );
}

export function createMetaverseWorldPreviewLaunchSelection(
  bundle: MetaverseMapBundleSnapshot,
  variationId: string | null,
  sourceBundleId = bundle.mapId
): MetaverseWorldPreviewLaunchSelectionSnapshot {
  const launchVariation = readMetaverseMapBundleLaunchVariation(bundle, variationId);

  return Object.freeze({
    bundleId: bundle.mapId,
    bundleLabel: bundle.label,
    experienceId: launchVariation?.experienceId ?? null,
    gameplayVariationId: launchVariation?.gameplayVariationId ?? null,
    sessionMode: launchVariation?.sessionMode ?? null,
    sourceBundleId,
    variationId: launchVariation?.variationId ?? null,
    variationLabel: launchVariation?.label ?? null,
    vehicleLayoutId: launchVariation?.vehicleLayoutId ?? null,
    weaponLayoutId: launchVariation?.weaponLayoutId ?? null
  });
}
