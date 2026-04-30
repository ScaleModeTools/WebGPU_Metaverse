import { Group, Object3D } from "three/webgpu";
import type { MetaverseRealtimeResourceSpawnSnapshot } from "@webgpu-metaverse/shared";

import { attachmentModelManifest } from "@/assets/config/attachment-model-manifest";
import type { MetaverseSceneAssetLoader } from "../characters/metaverse-scene-interactive-presentation-state";

export interface LoadedMetaverseResourceSpawnModel {
  readonly model: Group;
}

export function resolveMetaverseResourceSpawnAssetKey(
  resourceSpawn: Pick<
    MetaverseRealtimeResourceSpawnSnapshot,
    "assetId" | "weaponId"
  >
): string {
  return resourceSpawn.assetId ?? resourceSpawn.weaponId;
}

export function resolveMetaverseResourceSpawnAttachmentModelPath(
  assetKey: string
): string | null {
  const attachmentAsset =
    attachmentModelManifest.attachments.find(
      (attachment) => attachment.id === assetKey
    ) ?? null;
  const defaultLod =
    attachmentAsset?.renderModel.lods.find(
      (lod) => lod.tier === attachmentAsset.renderModel.defaultTier
    ) ??
    attachmentAsset?.renderModel.lods[0] ??
    null;

  return defaultLod?.modelPath ?? null;
}

export async function loadMetaverseResourceSpawnModel(
  assetKey: string,
  createSceneAssetLoader: () => MetaverseSceneAssetLoader
): Promise<LoadedMetaverseResourceSpawnModel | null> {
  const modelPath = resolveMetaverseResourceSpawnAttachmentModelPath(assetKey);

  if (modelPath === null) {
    return null;
  }

  const asset = await createSceneAssetLoader().loadAsync(modelPath);

  return Object.freeze({
    model: readObjectAsGroup(asset.scene)
  });
}

export function cloneMetaverseResourceSpawnModel(
  loadedModel: LoadedMetaverseResourceSpawnModel
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
