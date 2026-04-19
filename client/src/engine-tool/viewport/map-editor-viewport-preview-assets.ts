import type { Material } from "three";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D
} from "three/webgpu";

import { environmentPropManifest } from "@/assets/config/environment-prop-manifest";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentProceduralBoxLodDescriptor,
  EnvironmentRenderLodDescriptor
} from "@/assets/types/environment-asset-manifest";
import type { MapEditorPlacementDraftSnapshot } from "@/engine-tool/project/map-editor-project-state";
import { createDefaultMetaverseSceneAssetLoader } from "@/metaverse/render/metaverse-scene-asset-loader";

interface PreviewMeshUserData {
  mapEditorOwnsGeometry?: boolean;
  mapEditorOwnsMaterial?: boolean;
  placementId?: string;
}

function createProceduralPreviewMaterial(
  materialPreset: EnvironmentProceduralBoxLodDescriptor["materialPreset"]
): MeshStandardMaterial {
  switch (materialPreset) {
    case "training-range-accent":
      return new MeshStandardMaterial({
        color: "#c26b2e",
        emissive: "#140805",
        metalness: 0.08,
        roughness: 0.76
      });
    default:
      return new MeshStandardMaterial({
        color: "#8f8c80",
        emissive: "#040406",
        metalness: 0.02,
        roughness: 0.94
      });
  }
}

function createProceduralPreviewRoot(
  lodDescriptor: EnvironmentProceduralBoxLodDescriptor,
  assetId: string
): Group {
  const previewRoot = new Group();
  const geometry = new BoxGeometry(
    lodDescriptor.size.x,
    lodDescriptor.size.y,
    lodDescriptor.size.z
  );
  const material = createProceduralPreviewMaterial(lodDescriptor.materialPreset);
  const mesh = new Mesh(geometry, material);
  const userData = mesh.userData as PreviewMeshUserData;

  mesh.name = `map_editor_preview/${assetId}/${lodDescriptor.tier}`;
  mesh.position.y = lodDescriptor.size.y * 0.5;
  mesh.castShadow = lodDescriptor.materialPreset === "training-range-accent";
  mesh.receiveShadow = true;
  userData.mapEditorOwnsGeometry = true;
  userData.mapEditorOwnsMaterial = true;
  previewRoot.add(mesh);

  return previewRoot;
}

function resolveDefaultRenderLod(
  asset: EnvironmentAssetDescriptor
): EnvironmentRenderLodDescriptor | null {
  return (
    asset.renderModel.lods.find(
      (lodDescriptor) => lodDescriptor.tier === asset.renderModel.defaultTier
    ) ??
    asset.renderModel.lods[0] ??
    null
  );
}

function cloneMaterial(material: Material | readonly Material[]): Material | readonly Material[] {
  if (Array.isArray(material)) {
    return material.map((materialEntry) => materialEntry.clone());
  }

  return (material as Material).clone();
}

function isProceduralRenderLod(
  lodDescriptor: EnvironmentRenderLodDescriptor
): lodDescriptor is EnvironmentProceduralBoxLodDescriptor {
  return "kind" in lodDescriptor && lodDescriptor.kind === "procedural-box";
}

function readEnvironmentAssetDescriptor(
  assetId: string
): EnvironmentAssetDescriptor | null {
  return (
    environmentPropManifest.environmentAssets.find(
      (environmentAsset) => environmentAsset.id === assetId
    ) ?? null
  );
}

function mutateMaterialOpacity(
  material: Material | readonly Material[],
  opacity: number
): void {
  const materialEntries = Array.isArray(material) ? material : [material];

  for (const materialEntry of materialEntries) {
    materialEntry.transparent = opacity < 1;
    materialEntry.opacity = opacity;
    materialEntry.depthWrite = opacity >= 1;
  }
}

function ensureOwnedPreviewMaterial(mesh: Mesh): void {
  const userData = mesh.userData as PreviewMeshUserData;

  if (userData.mapEditorOwnsMaterial === true) {
    return;
  }

  mesh.material = cloneMaterial(
    mesh.material as Material | readonly Material[]
  ) as Mesh["material"];
  userData.mapEditorOwnsMaterial = true;
}

function applyPlacementPreviewAppearance(
  previewRoot: Group,
  placement: MapEditorPlacementDraftSnapshot
): void {
  applyMapEditorViewportPreviewOpacity(previewRoot, placement.isVisible ? 1 : 0.34);
}

export function applyMapEditorViewportPreviewOpacity(
  previewRoot: Group,
  opacity: number
): void {
  previewRoot.traverse((node) => {
    if (!("isMesh" in node) || node.isMesh !== true) {
      return;
    }

    const mesh = node as Mesh;
    ensureOwnedPreviewMaterial(mesh);
    mutateMaterialOpacity(
      mesh.material as Material | readonly Material[],
      opacity
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

export function syncMapEditorViewportPlacementPreviewAnchor(
  previewAnchor: Group,
  placement: MapEditorPlacementDraftSnapshot
): void {
  previewAnchor.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  previewAnchor.rotation.y = placement.rotationYRadians;
  previewAnchor.scale.set(
    Math.max(0.1, placement.scale.x),
    Math.max(0.1, placement.scale.y),
    Math.max(0.1, placement.scale.z)
  );
  applyPlacementPreviewAppearance(previewAnchor, placement);
  previewAnchor.updateMatrixWorld(true);
}

function tagPlacementNodes(root: Object3D, placementId: string): void {
  root.userData.placementId = placementId;

  root.traverse((node) => {
    node.userData.placementId = placementId;
  });
}

function createMissingAssetPreviewRoot(assetId: string): Group {
  const previewRoot = new Group();
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new MeshStandardMaterial({
    color: "#ef4444",
    emissive: "#450a0a",
    metalness: 0.05,
    roughness: 0.8
  });
  const mesh = new Mesh(geometry, material);
  const userData = mesh.userData as PreviewMeshUserData;

  mesh.name = `map_editor_preview_missing/${assetId}`;
  mesh.position.y = 1;
  userData.mapEditorOwnsGeometry = true;
  userData.mapEditorOwnsMaterial = true;
  previewRoot.add(mesh);

  return previewRoot;
}

function disposePreviewMesh(mesh: Mesh): void {
  const userData = mesh.userData as PreviewMeshUserData;

  if (userData.mapEditorOwnsGeometry === true) {
    mesh.geometry.dispose();
  }

  if (userData.mapEditorOwnsMaterial !== true) {
    return;
  }

  const material = mesh.material as Material | readonly Material[];
  const materialEntries = Array.isArray(material) ? material : [material];

  for (const materialEntry of materialEntries) {
    materialEntry.dispose();
  }
}

export function disposeMapEditorViewportPreviewGroup(group: Group): void {
  for (const child of [...group.children]) {
    group.remove(child);

    child.traverse((node) => {
      if (!("isMesh" in node) || node.isMesh !== true) {
        return;
      }

      disposePreviewMesh(node as Mesh);
    });
  }
}

export class MapEditorViewportPreviewAssetLibrary {
  readonly #cachedPreviewRoots = new Map<string, Promise<Group>>();
  readonly #sceneAssetLoader = createDefaultMetaverseSceneAssetLoader();

  async createPlacementPreviewAnchor(
    placement: MapEditorPlacementDraftSnapshot
  ): Promise<Group> {
    const previewRoot = await this.#loadPreviewRoot(placement.assetId);
    const previewAnchor = new Group();
    const asset = readEnvironmentAssetDescriptor(placement.assetId);

    previewAnchor.name = `map_editor_placement/${placement.placementId}`;
    previewAnchor.position.set(
      placement.position.x,
      placement.position.y,
      placement.position.z
    );
    previewAnchor.userData.placementId = placement.placementId;
    previewRoot.rotation.y = asset?.orientation?.forwardModelYawRadians ?? 0;
    tagPlacementNodes(previewAnchor, placement.placementId);
    tagPlacementNodes(previewRoot, placement.placementId);
    previewAnchor.add(previewRoot);
    syncMapEditorViewportPlacementPreviewAnchor(previewAnchor, placement);

    return previewAnchor;
  }

  async #loadPreviewRoot(assetId: string): Promise<Group> {
    const cachedPreviewRootPromise = this.#cachedPreviewRoots.get(assetId);

    if (cachedPreviewRootPromise !== undefined) {
      const cachedPreviewRoot = await cachedPreviewRootPromise;

      return this.#clonePreviewRoot(cachedPreviewRoot);
    }

    const previewRootPromise = this.#createPreviewRoot(assetId);
    this.#cachedPreviewRoots.set(assetId, previewRootPromise);

    try {
      const previewRoot = await previewRootPromise;

      return this.#clonePreviewRoot(previewRoot);
    } catch (error) {
      this.#cachedPreviewRoots.delete(assetId);
      throw error;
    }
  }

  async #createPreviewRoot(assetId: string): Promise<Group> {
    const asset = readEnvironmentAssetDescriptor(assetId);

    if (asset === null) {
      return createMissingAssetPreviewRoot(assetId);
    }

    const defaultRenderLod = resolveDefaultRenderLod(asset);

    if (defaultRenderLod === null) {
      return createMissingAssetPreviewRoot(assetId);
    }

    if (isProceduralRenderLod(defaultRenderLod)) {
      return createProceduralPreviewRoot(defaultRenderLod, assetId);
    }

    try {
      const loadedSceneAsset = await this.#sceneAssetLoader.loadAsync(
        defaultRenderLod.modelPath
      );

      return loadedSceneAsset.scene;
    } catch {
      return createMissingAssetPreviewRoot(assetId);
    }
  }

  #clonePreviewRoot(previewRoot: Group): Group {
    const previewClone = previewRoot.clone(true);

    previewClone.traverse((node) => {
      if (!("isMesh" in node) || node.isMesh !== true) {
        return;
      }

      const userData = node.userData as PreviewMeshUserData;

      userData.mapEditorOwnsGeometry = false;
      userData.mapEditorOwnsMaterial = false;
    });

    return previewClone;
  }
}
