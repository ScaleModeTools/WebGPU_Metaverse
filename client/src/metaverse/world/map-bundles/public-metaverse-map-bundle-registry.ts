import {
  parseMetaverseMapBundleSnapshot,
  type MetaverseMapBundleSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import {
  registerMetaverseWorldBundlePreviewEntry,
  type MetaverseWorldBundleRegistryEntry
} from "../bundle-registry";

const publicMetaverseMapBundleManifestPath =
  "/map-editor/projects/manifest.json" as const;

interface PublicMetaverseMapBundleManifestEntry {
  readonly bundleId: string;
  readonly label: string;
  readonly mapEditorProjectSettings:
    MetaverseWorldBundleRegistryEntry["mapEditorProjectSettings"];
  readonly path: string;
  readonly sourceBundleId: string;
}

interface PublicMetaverseMapBundleManifest {
  readonly projects: readonly PublicMetaverseMapBundleManifestEntry[];
  readonly version: 1;
}

interface RegisterPublicMetaverseMapBundleRegistryEntriesDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

function resolveFetchDependency(
  fetchDependency: typeof globalThis.fetch | undefined
): typeof globalThis.fetch {
  if (fetchDependency !== undefined) {
    return fetchDependency;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("Fetch API is unavailable for public metaverse map bundles.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  return value.trim();
}

function readMapEditorProjectSettings(
  value: unknown,
  fieldName: string
): MetaverseWorldBundleRegistryEntry["mapEditorProjectSettings"] {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value) || typeof value.helperGridSizeMeters !== "number") {
    throw new Error(`Expected object field: ${fieldName}`);
  }

  if (!Number.isFinite(value.helperGridSizeMeters)) {
    throw new Error(`Expected finite numeric field: ${fieldName}.helperGridSizeMeters`);
  }

  return Object.freeze({
    helperGridSizeMeters: value.helperGridSizeMeters
  });
}

function readManifestEntry(
  value: unknown
): PublicMetaverseMapBundleManifestEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    return Object.freeze({
      bundleId: readStringField(value.bundleId, "manifest.projects[].bundleId"),
      label: readStringField(value.label, "manifest.projects[].label"),
      mapEditorProjectSettings: readMapEditorProjectSettings(
        value.mapEditorProjectSettings,
        "manifest.projects[].mapEditorProjectSettings"
      ),
      path: readStringField(value.path, "manifest.projects[].path"),
      sourceBundleId: readStringField(
        value.sourceBundleId,
        "manifest.projects[].sourceBundleId"
      )
    });
  } catch {
    return null;
  }
}

function readManifest(payload: unknown): PublicMetaverseMapBundleManifest {
  if (
    !isRecord(payload) ||
    payload.version !== 1 ||
    !Array.isArray(payload.projects)
  ) {
    throw new Error("Public metaverse map bundle manifest is invalid.");
  }

  const projects: PublicMetaverseMapBundleManifestEntry[] = [];

  for (const candidate of payload.projects) {
    const entry = readManifestEntry(candidate);

    if (
      entry !== null &&
      !projects.some((project) => project.bundleId === entry.bundleId)
    ) {
      projects.push(entry);
    }
  }

  return Object.freeze({
    projects: Object.freeze(projects),
    version: 1
  });
}

function createRegistryEntry(
  manifestEntry: PublicMetaverseMapBundleManifestEntry,
  bundle: MetaverseMapBundleSnapshot
): MetaverseWorldBundleRegistryEntry {
  return Object.freeze({
    bundle,
    bundleId: bundle.mapId,
    label: bundle.label,
    mapEditorProjectSettings: manifestEntry.mapEditorProjectSettings,
    sourceBundleId: manifestEntry.sourceBundleId
  });
}

async function readJsonResponse(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

export async function registerPublicMetaverseMapBundleRegistryEntries(
  dependencies: RegisterPublicMetaverseMapBundleRegistryEntriesDependencies = {}
): Promise<readonly MetaverseWorldBundleRegistryEntry[]> {
  const fetch = resolveFetchDependency(dependencies.fetch);
  const manifestResponse = await fetch(publicMetaverseMapBundleManifestPath, {
    cache: "no-store"
  });

  if (manifestResponse.status === 404) {
    return Object.freeze([]);
  }

  if (!manifestResponse.ok) {
    throw new Error("Public metaverse map bundle manifest could not be loaded.");
  }

  const manifest = readManifest(await readJsonResponse(manifestResponse));
  const registryEntries: MetaverseWorldBundleRegistryEntry[] = [];

  for (const manifestEntry of manifest.projects) {
    const bundleResponse = await fetch(manifestEntry.path, {
      cache: "no-store"
    });

    if (!bundleResponse.ok) {
      throw new Error(
        `Public metaverse map bundle ${manifestEntry.bundleId} could not be loaded.`
      );
    }

    const bundle = parseMetaverseMapBundleSnapshot(
      await readJsonResponse(bundleResponse)
    );

    if (bundle.mapId !== manifestEntry.bundleId) {
      throw new Error(
        `Public metaverse map bundle ${manifestEntry.bundleId} has mismatched bundle id.`
      );
    }

    const registryEntry = createRegistryEntry(manifestEntry, bundle);

    registerMetaverseWorldBundlePreviewEntry(registryEntry);
    registryEntries.push(registryEntry);
  }

  return Object.freeze(registryEntries);
}
