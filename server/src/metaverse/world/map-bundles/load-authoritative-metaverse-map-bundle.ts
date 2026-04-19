import {
  parseMetaverseMapBundleSnapshot,
  stagingGroundMapBundle,
  type MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

export interface LoadedAuthoritativeMetaverseMapBundleSnapshot {
  readonly bundle: MetaverseMapBundleSnapshot;
  readonly bundleId: string;
  readonly sourceBundleId: string;
}

const authoritativeMetaverseMapBundleEntries = Object.freeze([
  Object.freeze({
    bundle: stagingGroundMapBundle,
    bundleId: stagingGroundMapBundle.mapId,
    sourceBundleId: stagingGroundMapBundle.mapId
  } satisfies LoadedAuthoritativeMetaverseMapBundleSnapshot)
]);

const authoritativeBaseMetaverseMapBundlesById = new Map(
  authoritativeMetaverseMapBundleEntries.map((entry) => [entry.bundleId, entry])
);
const authoritativePreviewMetaverseMapBundlesById = new Map<
  string,
  LoadedAuthoritativeMetaverseMapBundleSnapshot
>();

export function registerAuthoritativeMetaverseMapBundlePreview(
  bundleSnapshot: unknown,
  sourceBundleId?: string
): LoadedAuthoritativeMetaverseMapBundleSnapshot {
  const bundle = parseMetaverseMapBundleSnapshot(bundleSnapshot);
  const previewEntry = Object.freeze({
    bundle,
    bundleId: bundle.mapId,
    sourceBundleId: sourceBundleId ?? bundle.mapId
  } satisfies LoadedAuthoritativeMetaverseMapBundleSnapshot);

  authoritativePreviewMetaverseMapBundlesById.set(
    previewEntry.bundleId,
    previewEntry
  );

  return previewEntry;
}

export function resolveDefaultAuthoritativeMetaverseMapBundleId(): string {
  const defaultEntry = authoritativeMetaverseMapBundleEntries[0] ?? null;

  if (defaultEntry === null) {
    throw new Error(
      "Authoritative metaverse map bundle registry requires at least one bundle."
    );
  }

  return defaultEntry.bundleId;
}

export function loadAuthoritativeMetaverseMapBundle(
  bundleId: string
): LoadedAuthoritativeMetaverseMapBundleSnapshot {
  const loadedBundle =
    authoritativePreviewMetaverseMapBundlesById.get(bundleId) ??
    authoritativeBaseMetaverseMapBundlesById.get(bundleId) ??
    null;

  if (loadedBundle === null) {
    throw new Error(
      `Authoritative metaverse map bundle ${bundleId} is not registered.`
    );
  }

  return loadedBundle;
}
