import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene
} from "three/webgpu";
import type { MetaverseRealtimeResourceSpawnSnapshot } from "@webgpu-metaverse/shared";

import { attachmentModelManifest } from "@/assets/config/attachment-model-manifest";
import type { MetaverseSceneAssetLoader } from "../characters/metaverse-scene-interactive-presentation-state";

interface MetaverseSceneResourceSpawnPresentationDependencies {
  readonly createSceneAssetLoader: () => MetaverseSceneAssetLoader;
  readonly scene: Scene;
  readonly warn: (message: string) => void;
}

interface LoadedResourceSpawnModel {
  readonly model: Group;
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

function createOwnedMesh(
  geometry: BoxGeometry | ConeGeometry | CylinderGeometry,
  material: MeshStandardMaterial
): Mesh {
  const mesh = new Mesh(geometry, material);
  const userData = mesh.userData as OwnedResourceMeshUserData;

  userData.resourceSpawnPresentationOwnsGeometry = true;
  userData.resourceSpawnPresentationOwnsMaterial = true;

  return mesh;
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

function resolveResourceSpawnAssetKey(
  resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot
): string {
  return resourceSpawn.assetId ?? resourceSpawn.weaponId;
}

function resolveAttachmentModelPath(assetKey: string): string | null {
  const attachmentAsset =
    attachmentModelManifest.attachments.find((attachment) => attachment.id === assetKey) ??
    null;
  const defaultLod =
    attachmentAsset?.renderModel.lods.find(
      (lod) => lod.tier === attachmentAsset.renderModel.defaultTier
    ) ??
    attachmentAsset?.renderModel.lods[0] ??
    null;

  return defaultLod?.modelPath ?? null;
}

function createMarkerGroup(
  resourceSpawn: MetaverseRealtimeResourceSpawnSnapshot
): Group {
  const markerGroup = new Group();
  const isRocket = resourceSpawn.weaponId.includes("rocket");
  const isBattleRifle = resourceSpawn.weaponId.includes("battle-rifle");
  const pad = createOwnedMesh(
    new CylinderGeometry(
      resourceSpawn.pickupRadiusMeters,
      resourceSpawn.pickupRadiusMeters,
      0.08,
      32
    ),
    new MeshStandardMaterial({
      color: isRocket ? "#fb923c" : isBattleRifle ? "#a3e635" : "#38bdf8",
      emissive: isRocket ? "#7c2d12" : isBattleRifle ? "#365314" : "#075985",
      opacity: 0.26,
      roughness: 0.65,
      transparent: true
    })
  );
  const beacon = createOwnedMesh(
    new ConeGeometry(0.22, 0.64, 16),
    new MeshStandardMaterial({
      color: "#e0f2fe",
      emissive: isRocket ? "#ea580c" : isBattleRifle ? "#65a30d" : "#0284c7",
      emissiveIntensity: 0.18,
      roughness: 0.36
    })
  );
  const fallbackWeapon = createOwnedMesh(
    isRocket
      ? new CylinderGeometry(0.16, 0.16, 1.1, 16)
      : new BoxGeometry(isBattleRifle ? 1.15 : 0.9, 0.26, 0.38),
    new MeshStandardMaterial({
      color: isRocket ? "#fdba74" : isBattleRifle ? "#d9f99d" : "#bfdbfe",
      emissive: isRocket ? "#9a3412" : isBattleRifle ? "#3f6212" : "#1e3a8a",
      roughness: 0.42
    })
  );

  markerGroup.name = "resource_spawn_marker";
  pad.position.y = 0.04;
  fallbackWeapon.name = "resource_spawn_fallback_weapon";
  fallbackWeapon.position.y = 0.42;
  fallbackWeapon.rotation.z = isRocket ? Math.PI * 0.5 : 0;
  beacon.position.y = 1.25;
  beacon.rotation.z = Math.PI;
  markerGroup.add(pad, fallbackWeapon, beacon);

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

function cloneLoadedResourceSpawnModel(
  loadedModel: LoadedResourceSpawnModel
): Group {
  const clone = loadedModel.model.clone(true);

  clone.name = "resource_spawn_attachment_model";
  clone.position.set(0, 0.48, 0);
  clone.scale.setScalar(1.15);

  return clone;
}

function readObjectAsGroup(object: Object3D): Group {
  if (object instanceof Group) {
    return object;
  }

  const group = new Group();

  group.add(object);
  return group;
}

export class MetaverseSceneResourceSpawnPresentationState {
  readonly #dependencies: MetaverseSceneResourceSpawnPresentationDependencies;
  readonly #loadedModelsByAssetKey = new Map<string, LoadedResourceSpawnModel>();
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
    const assetKey = resolveResourceSpawnAssetKey(resourceSpawn);
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
      const modelGroup = cloneLoadedResourceSpawnModel(loadedModel);

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

    const modelPath = resolveAttachmentModelPath(assetKey);

    if (modelPath === null) {
      this.#loadFailedAssetKeys.add(assetKey);
      return;
    }

    this.#loadingModelsByAssetKey.add(assetKey);
    this.#dependencies.createSceneAssetLoader()
      .loadAsync(modelPath)
      .then((asset) => {
        this.#loadedModelsByAssetKey.set(assetKey, {
          model: readObjectAsGroup(asset.scene)
        });
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
