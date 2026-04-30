import {
  Group,
  Mesh,
  Scene
} from "three/webgpu";
import type { MetaverseRealtimeResourceSpawnSnapshot } from "@webgpu-metaverse/shared";

import type { MetaverseSceneAssetLoader } from "../characters/metaverse-scene-interactive-presentation-state";
import {
  cloneMetaverseResourceSpawnModel,
  loadMetaverseResourceSpawnModel,
  resolveMetaverseResourceSpawnAssetKey,
  resolveMetaverseResourceSpawnAttachmentModelPath,
  type LoadedMetaverseResourceSpawnModel
} from "./metaverse-resource-spawn-models";

interface MetaverseSceneResourceSpawnPresentationDependencies {
  readonly createSceneAssetLoader: () => MetaverseSceneAssetLoader;
  readonly scene: Scene;
  readonly warn: (message: string) => void;
}

interface ResourceSpawnPresentationRuntime {
  readonly group: Group;
  readonly markerGroup: Group;
  assetKey: string;
  modelGroup: Group | null;
}

interface OwnedResourceMeshUserData {
  resourceSpawnPresentationOwnsGeometry?: boolean;
  resourceSpawnPresentationOwnsMaterial?: boolean;
}

function disposeOwnedMesh(mesh: Mesh): void {
  const userData = mesh.userData as OwnedResourceMeshUserData;

  if (userData.resourceSpawnPresentationOwnsGeometry === true) {
    mesh.geometry.dispose();
  }

  if (userData.resourceSpawnPresentationOwnsMaterial === true) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const material of materials) {
      material.dispose();
    }
  }
}

function disposeOwnedGroup(group: Group): void {
  group.traverse((node) => {
    if ("isMesh" in node && node.isMesh === true) {
      disposeOwnedMesh(node as Mesh);
    }
  });
  group.clear();
}

function createMarkerGroup(
  _resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot
): Group {
  const markerGroup = new Group();

  markerGroup.name = "resource_spawn_marker";

  return markerGroup;
}

function syncResourceSpawnGroupTransform(
  group: Group,
  resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot
): void {
  group.position.set(
    resourceSpawn.position.x,
    resourceSpawn.position.y,
    resourceSpawn.position.z
  );
  group.rotation.set(0, resourceSpawn.yawRadians, 0);
}

export class MetaverseSceneResourceSpawnPresentationState {
  readonly #dependencies: MetaverseSceneResourceSpawnPresentationDependencies;
  readonly #loadedModelsByAssetKey = new Map<string, LoadedMetaverseResourceSpawnModel>();
  readonly #loadingModelsByAssetKey = new Set<string>();
  readonly #loadFailedAssetKeys = new Set<string>();
  readonly #presentationsBySpawnId = new Map<string, ResourceSpawnPresentationRuntime>();
  readonly #rootGroup = new Group();

  constructor(dependencies: MetaverseSceneResourceSpawnPresentationDependencies) {
    this.#dependencies = dependencies;
    this.#rootGroup.name = "metaverse_resource_spawns";
    dependencies.scene.add(this.#rootGroup);
  }

  reset(): void {
    for (const presentation of this.#presentationsBySpawnId.values()) {
      this.#rootGroup.remove(presentation.group);
      disposeOwnedGroup(presentation.markerGroup);
    }

    this.#presentationsBySpawnId.clear();
    this.#rootGroup.clear();
  }

  sync(
    resourceSpawns: readonly MetaverseRealtimeResourceSpawnSnapshot[],
    _nowMs: number
  ): void {
    const availableSpawnIds = new Set<string>();

    for (const resourceSpawn of resourceSpawns) {
      availableSpawnIds.add(resourceSpawn.spawnId);
      this.#syncAvailableResourceSpawn(resourceSpawn);
    }

    for (const [spawnId, presentation] of this.#presentationsBySpawnId) {
      if (availableSpawnIds.has(spawnId)) {
        continue;
      }

      this.#rootGroup.remove(presentation.group);
      disposeOwnedGroup(presentation.markerGroup);
      this.#presentationsBySpawnId.delete(spawnId);
    }
  }

  #syncAvailableResourceSpawn(
    resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot
  ): void {
    const assetKey = resolveMetaverseResourceSpawnAssetKey(resourceSpawn);
    const presentation =
      this.#presentationsBySpawnId.get(resourceSpawn.spawnId) ??
      this.#createPresentation(resourceSpawn, assetKey);

    syncResourceSpawnGroupTransform(presentation.group, resourceSpawn);

    if (presentation.assetKey !== assetKey) {
      if (presentation.modelGroup !== null) {
        presentation.group.remove(presentation.modelGroup);
      }

      presentation.assetKey = assetKey;
      presentation.modelGroup = null;
    }

    const loadedModel = this.#loadedModelsByAssetKey.get(assetKey) ?? null;

    if (loadedModel !== null && presentation.modelGroup === null) {
      const modelGroup = cloneMetaverseResourceSpawnModel(loadedModel);

      presentation.modelGroup = modelGroup;
      presentation.group.add(modelGroup);
      presentation.markerGroup.visible = false;
      return;
    }

    this.#startLoadingModel(assetKey);
  }

  #createPresentation(
    resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot,
    assetKey: string
  ): ResourceSpawnPresentationRuntime {
    const group = new Group();
    const markerGroup = createMarkerGroup(resourceSpawn);
    const presentation: ResourceSpawnPresentationRuntime = {
      assetKey,
      group,
      markerGroup,
      modelGroup: null
    };

    group.name = `metaverse_resource_spawn/${resourceSpawn.spawnId}`;
    group.add(markerGroup);
    syncResourceSpawnGroupTransform(group, resourceSpawn);
    this.#rootGroup.add(group);
    this.#presentationsBySpawnId.set(resourceSpawn.spawnId, presentation);

    return presentation;
  }

  #startLoadingModel(assetKey: string): void {
    if (
      this.#loadedModelsByAssetKey.has(assetKey) ||
      this.#loadingModelsByAssetKey.has(assetKey) ||
      this.#loadFailedAssetKeys.has(assetKey)
    ) {
      return;
    }

    if (resolveMetaverseResourceSpawnAttachmentModelPath(assetKey) === null) {
      this.#loadFailedAssetKeys.add(assetKey);
      return;
    }

    this.#loadingModelsByAssetKey.add(assetKey);
    loadMetaverseResourceSpawnModel(
      assetKey,
      this.#dependencies.createSceneAssetLoader
    )
      .then((loadedModel) => {
        if (loadedModel !== null) {
          this.#loadedModelsByAssetKey.set(assetKey, loadedModel);
        }
      })
      .catch((error: unknown) => {
        this.#loadFailedAssetKeys.add(assetKey);
        this.#dependencies.warn(
          error instanceof Error
            ? `Weapon pickup model ${assetKey} failed to load: ${error.message}`
            : `Weapon pickup model ${assetKey} failed to load.`
        );
      })
      .finally(() => {
        this.#loadingModelsByAssetKey.delete(assetKey);
      });
  }
}
