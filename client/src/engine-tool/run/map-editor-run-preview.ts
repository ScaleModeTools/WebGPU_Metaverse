import { registerMetaverseWorldBundlePreviewEntry } from "@/metaverse/world/bundle-registry";
import {
  createMetaverseWorldPreviewLaunchSelection,
  type MetaverseWorldPreviewLaunchSelectionSnapshot
} from "@/metaverse/world/map-bundles";

import type { MapEditorProjectSnapshot } from "../project/map-editor-project-state";
import { exportMapEditorProjectToMetaverseMapBundle } from "./export-map-editor-project-to-metaverse-map-bundle";
import {
  validateMapEditorProject,
  type MapEditorProjectValidationResult
} from "./map-editor-project-validation";
import { registerMapEditorPreviewBundleOnServer } from "./register-map-editor-preview-bundle-on-server";

export interface MapEditorRunPreviewResult {
  readonly launchSelection: MetaverseWorldPreviewLaunchSelectionSnapshot | null;
  readonly registrationError: string | null;
  readonly validation: MapEditorProjectValidationResult;
}

interface ValidateAndRegisterMapEditorPreviewBundleDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

function hashPreviewBundleSignature(serializedBundle: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < serializedBundle.length; index += 1) {
    hash ^= serializedBundle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function createMapEditorPreviewBundle(
  project: MapEditorProjectSnapshot
): {
  readonly bundle: ReturnType<typeof exportMapEditorProjectToMetaverseMapBundle>;
  readonly sourceBundleId: string;
} {
  const exportedBundle = exportMapEditorProjectToMetaverseMapBundle(project);
  const previewBundleId = `${project.bundleId}:preview:${hashPreviewBundleSignature(
    JSON.stringify(exportedBundle)
  )}`;

  return Object.freeze({
    bundle: Object.freeze({
      ...exportedBundle,
      mapId: previewBundleId
    }),
    sourceBundleId: project.bundleId
  });
}

export async function validateAndRegisterMapEditorPreviewBundle(
  project: MapEditorProjectSnapshot,
  dependencies: ValidateAndRegisterMapEditorPreviewBundleDependencies = {}
): Promise<MapEditorRunPreviewResult> {
  const validation = validateMapEditorProject(project);

  if (!validation.valid) {
    return Promise.resolve(
      Object.freeze({
        launchSelection: null,
        registrationError: null,
        validation
      })
    );
  }

  const previewBundleRegistration = createMapEditorPreviewBundle(project);
  const { bundle: previewBundle, sourceBundleId } = previewBundleRegistration;
  const launchSelection = createMetaverseWorldPreviewLaunchSelection(
    previewBundle,
    project.selectedLaunchVariationId,
    sourceBundleId
  );

  try {
    await registerMapEditorPreviewBundleOnServer(
      previewBundle,
      sourceBundleId,
      dependencies
    );

    registerMetaverseWorldBundlePreviewEntry(
      Object.freeze({
        bundle: previewBundle,
        bundleId: previewBundle.mapId,
        label: previewBundle.label,
        sourceBundleId
      })
    );

    return Object.freeze({
      launchSelection,
      registrationError: null,
      validation
    });
  } catch (error) {
    return Object.freeze({
      launchSelection: null,
      registrationError:
        error instanceof Error
          ? error.message
          : "Preview bundle registration failed.",
      validation
    });
  }
}
