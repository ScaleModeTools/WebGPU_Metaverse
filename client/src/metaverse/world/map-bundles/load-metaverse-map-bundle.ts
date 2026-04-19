import {
  resolveMetaverseGameplayProfile,
  type MetaverseGameplayProfileSnapshot,
  type MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  readMetaverseCameraProfile,
  type MetaverseCameraProfileSnapshot
} from "../../render/camera/profiles";
import {
  readMetaverseCharacterPresentationProfile,
  type MetaverseCharacterPresentationProfileSnapshot
} from "../../render/characters/presentation-profiles";
import {
  readMetaverseEnvironmentPresentationProfile,
  type MetaverseEnvironmentPresentationProfileSnapshot
} from "../../render/environment/profiles";
import {
  readMetaverseHudProfile,
  type MetaverseHudProfileSnapshot
} from "../../hud/profiles";
import { readMetaverseWorldBundleRegistryEntry } from "../bundle-registry";

export interface LoadedMetaverseMapBundleSnapshot {
  readonly bundle: MetaverseMapBundleSnapshot;
  readonly cameraProfile: MetaverseCameraProfileSnapshot | null;
  readonly characterPresentationProfile:
    MetaverseCharacterPresentationProfileSnapshot | null;
  readonly environmentPresentationProfile:
    MetaverseEnvironmentPresentationProfileSnapshot | null;
  readonly gameplayProfile: MetaverseGameplayProfileSnapshot;
  readonly hudProfile: MetaverseHudProfileSnapshot | null;
}

export function loadMetaverseMapBundle(
  bundleId: string
): LoadedMetaverseMapBundleSnapshot {
  const registryEntry = readMetaverseWorldBundleRegistryEntry(bundleId);

  if (registryEntry === null) {
    throw new Error(`Metaverse map bundle ${bundleId} is not registered.`);
  }

  const { bundle } = registryEntry;

  return Object.freeze({
    bundle,
    cameraProfile: readMetaverseCameraProfile(
      bundle.presentationProfileIds.cameraProfileId
    ),
    characterPresentationProfile: readMetaverseCharacterPresentationProfile(
      bundle.presentationProfileIds.characterPresentationProfileId
    ),
    environmentPresentationProfile: readMetaverseEnvironmentPresentationProfile(
      bundle.presentationProfileIds.environmentPresentationProfileId
    ),
    gameplayProfile: resolveMetaverseGameplayProfile(bundle.gameplayProfileId),
    hudProfile: readMetaverseHudProfile(bundle.presentationProfileIds.hudProfileId)
  });
}
