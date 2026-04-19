import type { AssetLodGroup } from "@/assets/types/asset-lod";

export function resolveMetaverseProofLodModelPath(
  renderModel: AssetLodGroup
): string {
  const preferredLod =
    renderModel.lods.find((lod) => lod.tier === renderModel.defaultTier) ??
    renderModel.lods[0];

  if (preferredLod === undefined) {
    throw new Error("Metaverse asset manifest requires at least one LOD entry.");
  }

  return preferredLod.modelPath;
}
