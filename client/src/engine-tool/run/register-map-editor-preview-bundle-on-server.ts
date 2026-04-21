import type { MetaverseMapBundleSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

import { registerMetaverseWorldBundleSnapshotOnServer } from "@/metaverse/world/map-bundles";

interface RegisterMapEditorPreviewBundleOnServerDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

export async function registerMapEditorPreviewBundleOnServer(
  bundle: MetaverseMapBundleSnapshot,
  sourceBundleId: string,
  dependencies: RegisterMapEditorPreviewBundleOnServerDependencies = {}
): Promise<void> {
  return registerMetaverseWorldBundleSnapshotOnServer(
    bundle,
    sourceBundleId,
    dependencies
  );
}
