import type { MetaverseMatchModeId } from "@webgpu-metaverse/shared";
import type {
  MetaverseMapBundleLaunchVariationSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  listMetaverseWorldBundleRegistryEntries,
  readMetaverseWorldBundleRegistryEntry,
  resolveDefaultMetaverseWorldBundleId,
  type MetaverseWorldBundleRegistryEntry
} from "../bundle-registry";

export interface MetaverseMapLaunchPlaylistSnapshot {
  readonly metaverseDefaultBundleId: string | null;
  readonly teamDeathmatchBundleIds: readonly string[];
}

export interface MetaverseMapLaunchSelectionSnapshot {
  readonly bundleId: string;
  readonly launchVariationId: string;
}

const metaverseMapLaunchPlaylistStorageKey =
  "webgpu-metaverse.map-launch-playlists.v1" as const;
const defaultFreeRoamLaunchVariationId = "shell-free-roam" as const;
const defaultTeamDeathmatchBundleId = "deathmatch" as const;
const defaultTeamDeathmatchLaunchVariationId =
  "shell-team-deathmatch" as const;

export const defaultMetaverseMapLaunchPlaylistSnapshot =
  Object.freeze({
    metaverseDefaultBundleId: null,
    teamDeathmatchBundleIds: Object.freeze([defaultTeamDeathmatchBundleId])
  } satisfies MetaverseMapLaunchPlaylistSnapshot);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBundleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizeBundleIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  const bundleIds: string[] = [];

  for (const candidate of value) {
    const bundleId = normalizeBundleId(candidate);

    if (bundleId !== null && !bundleIds.includes(bundleId)) {
      bundleIds.push(bundleId);
    }
  }

  return Object.freeze(bundleIds);
}

export function normalizeMetaverseMapLaunchPlaylistSnapshot(
  value: unknown
): MetaverseMapLaunchPlaylistSnapshot {
  if (!isRecord(value)) {
    return defaultMetaverseMapLaunchPlaylistSnapshot;
  }

  return Object.freeze({
    metaverseDefaultBundleId:
      normalizeBundleId(value.metaverseDefaultBundleId) ??
      defaultMetaverseMapLaunchPlaylistSnapshot.metaverseDefaultBundleId,
    teamDeathmatchBundleIds: normalizeBundleIds(value.teamDeathmatchBundleIds)
  });
}

export function readMetaverseMapLaunchPlaylistSnapshot(
  storage: Storage | null
): MetaverseMapLaunchPlaylistSnapshot {
  if (storage === null) {
    return defaultMetaverseMapLaunchPlaylistSnapshot;
  }

  const storedValue = storage.getItem(metaverseMapLaunchPlaylistStorageKey);

  if (storedValue === null) {
    return defaultMetaverseMapLaunchPlaylistSnapshot;
  }

  try {
    return normalizeMetaverseMapLaunchPlaylistSnapshot(JSON.parse(storedValue));
  } catch {
    return defaultMetaverseMapLaunchPlaylistSnapshot;
  }
}

export function saveMetaverseMapLaunchPlaylistSnapshot(
  storage: Storage | null,
  playlist: MetaverseMapLaunchPlaylistSnapshot
): void {
  if (storage === null) {
    return;
  }

  storage.setItem(
    metaverseMapLaunchPlaylistStorageKey,
    JSON.stringify({
      metaverseDefaultBundleId: playlist.metaverseDefaultBundleId,
      teamDeathmatchBundleIds: [...playlist.teamDeathmatchBundleIds]
    })
  );
}

function readBundleRegistryEntry(
  bundleId: string
): MetaverseWorldBundleRegistryEntry | null {
  return (
    readMetaverseWorldBundleRegistryEntry(bundleId) ??
    listMetaverseWorldBundleRegistryEntries().find(
      (entry) => entry.bundleId === bundleId
    ) ??
    null
  );
}

function readLaunchVariationForMatchMode(
  bundleId: string,
  matchMode: MetaverseMatchModeId
): MetaverseMapBundleLaunchVariationSnapshot | null {
  const registryEntry = readBundleRegistryEntry(bundleId);

  return (
    registryEntry?.bundle.launchVariations.find(
      (launchVariation) => launchVariation.matchMode === matchMode
    ) ?? null
  );
}

function resolveFallbackBundleId(matchMode: MetaverseMatchModeId): string {
  return matchMode === "team-deathmatch"
    ? defaultTeamDeathmatchBundleId
    : resolveDefaultMetaverseWorldBundleId();
}

function resolveFallbackLaunchVariationId(
  matchMode: MetaverseMatchModeId
): string {
  return matchMode === "team-deathmatch"
    ? defaultTeamDeathmatchLaunchVariationId
    : defaultFreeRoamLaunchVariationId;
}

function resolveFirstSupportedLaunchSelection(
  bundleIds: readonly string[],
  matchMode: MetaverseMatchModeId
): MetaverseMapLaunchSelectionSnapshot | null {
  for (const bundleId of bundleIds) {
    const launchVariation = readLaunchVariationForMatchMode(bundleId, matchMode);

    if (launchVariation !== null) {
      return Object.freeze({
        bundleId,
        launchVariationId: launchVariation.variationId
      });
    }
  }

  return null;
}

export function resolveMetaverseMapLaunchSelection(
  playlist: MetaverseMapLaunchPlaylistSnapshot,
  matchMode: MetaverseMatchModeId
): MetaverseMapLaunchSelectionSnapshot {
  const configuredBundleIds =
    matchMode === "team-deathmatch"
      ? playlist.teamDeathmatchBundleIds
      : playlist.metaverseDefaultBundleId === null
        ? Object.freeze([])
        : Object.freeze([playlist.metaverseDefaultBundleId]);
  const configuredSelection = resolveFirstSupportedLaunchSelection(
    configuredBundleIds,
    matchMode
  );

  if (configuredSelection !== null) {
    return configuredSelection;
  }

  const fallbackBundleId = resolveFallbackBundleId(matchMode);
  const fallbackVariation =
    readLaunchVariationForMatchMode(fallbackBundleId, matchMode)?.variationId ??
    resolveFallbackLaunchVariationId(matchMode);

  return Object.freeze({
    bundleId: fallbackBundleId,
    launchVariationId: fallbackVariation
  });
}

export function replaceMetaverseDefaultMap(
  playlist: MetaverseMapLaunchPlaylistSnapshot,
  bundleId: string
): MetaverseMapLaunchPlaylistSnapshot {
  return Object.freeze({
    ...playlist,
    metaverseDefaultBundleId: bundleId
  });
}

export function toggleTeamDeathmatchMap(
  playlist: MetaverseMapLaunchPlaylistSnapshot,
  bundleId: string
): MetaverseMapLaunchPlaylistSnapshot {
  const enabled = playlist.teamDeathmatchBundleIds.includes(bundleId);

  return Object.freeze({
    ...playlist,
    teamDeathmatchBundleIds: enabled
      ? Object.freeze(
          playlist.teamDeathmatchBundleIds.filter(
            (candidateBundleId) => candidateBundleId !== bundleId
          )
        )
      : Object.freeze([...playlist.teamDeathmatchBundleIds, bundleId])
  });
}

export function prioritizeTeamDeathmatchMap(
  playlist: MetaverseMapLaunchPlaylistSnapshot,
  bundleId: string
): MetaverseMapLaunchPlaylistSnapshot {
  return Object.freeze({
    ...playlist,
    teamDeathmatchBundleIds: Object.freeze([
      bundleId,
      ...playlist.teamDeathmatchBundleIds.filter(
        (candidateBundleId) => candidateBundleId !== bundleId
      )
    ])
  });
}
