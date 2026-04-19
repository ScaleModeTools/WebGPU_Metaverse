import type { MetaverseMapBundleSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

import { metaverseWorldClientConfig } from "@/metaverse/config/metaverse-world-network";

const metaverseWorldPreviewBundlePath = "/metaverse/world/preview-bundles" as const;

interface RegisterMapEditorPreviewBundleOnServerDependencies {
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

  throw new Error("Fetch API is unavailable for map preview registration.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolvePreviewBundleRegistrationUrl(): string {
  return new URL(
    metaverseWorldPreviewBundlePath,
    metaverseWorldClientConfig.serverOrigin
  ).toString();
}

export async function registerMapEditorPreviewBundleOnServer(
  bundle: MetaverseMapBundleSnapshot,
  sourceBundleId: string,
  dependencies: RegisterMapEditorPreviewBundleOnServerDependencies = {}
): Promise<void> {
  const fetch = resolveFetchDependency(dependencies.fetch);
  const response = await fetch(resolvePreviewBundleRegistrationUrl(), {
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

  throw new Error("Metaverse preview bundle registration failed.");
}
