import type { MetaverseMapBundleSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

import { metaverseWorldClientConfig } from "@/metaverse/config/metaverse-world-network";

import { readMetaverseWorldBundleRegistryEntry } from "../bundle-registry";

const metaverseWorldBundleRegistrationPath =
  "/metaverse/world/preview-bundles" as const;

interface RegisterMetaverseWorldBundleOnServerDependencies {
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

  throw new Error("Fetch API is unavailable for metaverse world bundle sync.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveMetaverseWorldBundleRegistrationUrl(): string {
  return new URL(
    metaverseWorldBundleRegistrationPath,
    metaverseWorldClientConfig.serverOrigin
  ).toString();
}

export async function registerMetaverseWorldBundleSnapshotOnServer(
  bundle: MetaverseMapBundleSnapshot,
  sourceBundleId: string,
  dependencies: RegisterMetaverseWorldBundleOnServerDependencies = {}
): Promise<void> {
  const fetch = resolveFetchDependency(dependencies.fetch);
  const response = await fetch(resolveMetaverseWorldBundleRegistrationUrl(), {
    body: JSON.stringify({
      bundle,
      sourceBundleId
    }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (response.ok) {
    return;
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (isRecord(payload) && typeof payload.error === "string") {
    throw new Error(payload.error);
  }

  throw new Error("Metaverse world bundle registration failed.");
}

export async function registerMetaverseWorldBundleOnServer(
  bundleId: string,
  dependencies: RegisterMetaverseWorldBundleOnServerDependencies = {}
): Promise<void> {
  const registryEntry = readMetaverseWorldBundleRegistryEntry(bundleId);

  if (registryEntry === null) {
    throw new Error(`Metaverse map bundle ${bundleId} is not registered.`);
  }

  await registerMetaverseWorldBundleSnapshotOnServer(
    registryEntry.bundle,
    registryEntry.sourceBundleId,
    dependencies
  );
}
