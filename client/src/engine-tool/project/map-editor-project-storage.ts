import {
  defaultMetaverseGameplayProfileId,
  resolveMetaverseGameplayProfile,
  type MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import { readMetaverseCameraProfile } from "@/metaverse/render/camera/profiles";
import { readMetaverseCharacterPresentationProfile } from "@/metaverse/render/characters/presentation-profiles";
import { readMetaverseEnvironmentPresentationProfile } from "@/metaverse/render/environment/profiles";
import { readMetaverseHudProfile } from "@/metaverse/hud/profiles";
import type { LoadedMetaverseMapBundleSnapshot } from "@/metaverse/world/map-bundles";

import {
  createMapEditorProject,
  selectMapEditorLaunchVariation,
  selectMapEditorPlacement,
  type MapEditorProjectSnapshot
} from "./map-editor-project-state";
import { exportMapEditorProjectToMetaverseMapBundle } from "../run/export-map-editor-project-to-metaverse-map-bundle";

const storedMapEditorProjectRecordVersion = 2 as const;
const mapEditorProjectStorageKeyPrefix =
  "webgpu-metaverse:engine-tool:map-editor-project:";

export interface MapEditorProjectStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface StoredMapEditorProjectRecord {
  readonly bundle: MetaverseMapBundleSnapshot;
  readonly selectedLaunchVariationId: string | null;
  readonly selectedPlacementId: string | null;
  readonly version: typeof storedMapEditorProjectRecordVersion;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStorageKey(bundleId: string): string {
  return `${mapEditorProjectStorageKeyPrefix}${bundleId}`;
}

function isStoredMapEditorProjectRecord(
  value: unknown,
  bundleId: string
): value is StoredMapEditorProjectRecord {
  if (!isRecord(value) || !isRecord(value.bundle)) {
    return false;
  }

  const { bundle } = value;
  const presentationProfileIds = bundle.presentationProfileIds;

  return (
    value.version === storedMapEditorProjectRecordVersion &&
    bundle.mapId === bundleId &&
    typeof bundle.description === "string" &&
    (bundle.gameplayProfileId === undefined ||
      typeof bundle.gameplayProfileId === "string") &&
    typeof bundle.label === "string" &&
    Array.isArray(bundle.environmentAssets) &&
    Array.isArray(bundle.launchVariations) &&
    Array.isArray(bundle.playerSpawnNodes) &&
    isRecord(bundle.playerSpawnSelection) &&
    Array.isArray(bundle.resourceSpawns) &&
    Array.isArray(bundle.sceneObjects) &&
    Array.isArray(bundle.waterRegions) &&
    isRecord(presentationProfileIds)
  );
}

function createLoadedMetaverseMapBundleFromBundle(
  bundle: MetaverseMapBundleSnapshot
): LoadedMetaverseMapBundleSnapshot {
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
    gameplayProfile: resolveMetaverseGameplayProfile(
      "gameplayProfileId" in bundle &&
        typeof bundle.gameplayProfileId === "string"
        ? bundle.gameplayProfileId
        : defaultMetaverseGameplayProfileId
    ),
    hudProfile: readMetaverseHudProfile(bundle.presentationProfileIds.hudProfileId)
  });
}

function parseStoredRecord(
  storage: MapEditorProjectStorageLike,
  bundleId: string
): StoredMapEditorProjectRecord | null {
  const rawValue = storage.getItem(readStorageKey(bundleId));

  if (rawValue === null) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    return isStoredMapEditorProjectRecord(parsedValue, bundleId)
      ? parsedValue
      : null;
  } catch {
    return null;
  }
}

export function loadStoredMapEditorProject(
  storage: MapEditorProjectStorageLike | null,
  bundleId: string
): MapEditorProjectSnapshot | null {
  if (storage === null) {
    return null;
  }

  const storedRecord = parseStoredRecord(storage, bundleId);

  if (storedRecord === null) {
    return null;
  }

  let project = createMapEditorProject(
    createLoadedMetaverseMapBundleFromBundle(storedRecord.bundle)
  );

  if (storedRecord.selectedPlacementId !== null) {
    project = selectMapEditorPlacement(project, storedRecord.selectedPlacementId);
  }

  if (storedRecord.selectedLaunchVariationId !== null) {
    project = selectMapEditorLaunchVariation(
      project,
      storedRecord.selectedLaunchVariationId
    );
  }

  return project;
}

export function saveMapEditorProject(
  storage: MapEditorProjectStorageLike | null,
  project: MapEditorProjectSnapshot
): void {
  if (storage === null) {
    return;
  }

  const storedRecord = Object.freeze({
    bundle: exportMapEditorProjectToMetaverseMapBundle(project),
    selectedLaunchVariationId: project.selectedLaunchVariationId,
    selectedPlacementId: project.selectedPlacementId,
    version: storedMapEditorProjectRecordVersion
  } satisfies StoredMapEditorProjectRecord);

  storage.setItem(readStorageKey(project.bundleId), JSON.stringify(storedRecord));
}

export function clearStoredMapEditorProject(
  storage: MapEditorProjectStorageLike | null,
  bundleId: string
): void {
  if (storage === null) {
    return;
  }

  storage.removeItem(readStorageKey(bundleId));
}
