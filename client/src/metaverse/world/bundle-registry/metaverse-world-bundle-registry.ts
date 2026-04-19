import { stagingGroundMapBundle, type MetaverseMapBundleSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

export interface MetaverseWorldBundleRegistryEntry {
  readonly bundle: MetaverseMapBundleSnapshot;
  readonly bundleId: string;
  readonly label: string;
  readonly sourceBundleId: string;
}

const metaverseWorldBundleRegistryEntries = Object.freeze([
  Object.freeze({
    bundle: stagingGroundMapBundle,
    bundleId: stagingGroundMapBundle.mapId,
    label: stagingGroundMapBundle.label,
    sourceBundleId: stagingGroundMapBundle.mapId
  } satisfies MetaverseWorldBundleRegistryEntry)
]);
const metaverseWorldBundlePreviewEntriesById = new Map<
  string,
  MetaverseWorldBundleRegistryEntry
>();

const metaverseWorldBundleRegistryEntriesById = new Map<
  string,
  MetaverseWorldBundleRegistryEntry
>(metaverseWorldBundleRegistryEntries.map((entry) => [entry.bundleId, entry]));

function freezeRegistryEntry(
  entry: MetaverseWorldBundleRegistryEntry
): MetaverseWorldBundleRegistryEntry {
  return Object.freeze({
    bundle: entry.bundle,
    bundleId: entry.bundleId,
    label: entry.label,
    sourceBundleId: entry.sourceBundleId
  });
}

export function listMetaverseWorldBundleRegistryEntries(): readonly MetaverseWorldBundleRegistryEntry[] {
  return metaverseWorldBundleRegistryEntries;
}

export function resolveDefaultMetaverseWorldBundleRegistryEntry(): MetaverseWorldBundleRegistryEntry {
  const defaultEntry = metaverseWorldBundleRegistryEntries[0] ?? null;

  if (defaultEntry === null) {
    throw new Error("Metaverse world bundle registry requires at least one bundle.");
  }

  return metaverseWorldBundlePreviewEntriesById.get(defaultEntry.bundleId) ?? defaultEntry;
}

export function resolveDefaultMetaverseWorldBundleId(): string {
  return resolveDefaultMetaverseWorldBundleRegistryEntry().bundleId;
}

export function readMetaverseWorldBundleRegistryEntry(
  bundleId: string
): MetaverseWorldBundleRegistryEntry | null {
  return (
    metaverseWorldBundlePreviewEntriesById.get(bundleId) ??
    metaverseWorldBundleRegistryEntriesById.get(bundleId) ??
    null
  );
}

export function registerMetaverseWorldBundlePreviewEntry(
  entry: MetaverseWorldBundleRegistryEntry
): void {
  metaverseWorldBundlePreviewEntriesById.set(entry.bundleId, freezeRegistryEntry(entry));
}

export function clearMetaverseWorldBundlePreviewEntry(bundleId: string): void {
  metaverseWorldBundlePreviewEntriesById.delete(bundleId);
}

export function resolveMetaverseWorldBundleSourceBundleId(bundleId: string): string {
  return readMetaverseWorldBundleRegistryEntry(bundleId)?.sourceBundleId ?? bundleId;
}
