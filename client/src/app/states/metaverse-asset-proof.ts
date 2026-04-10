import { animationClipManifest } from "@/assets/config/animation-clip-manifest";
import {
  attachmentModelManifest,
  metaverseServicePistolAttachmentAssetId
} from "@/assets/config/attachment-model-manifest";
import {
  characterModelManifest,
  metaverseMannequinCharacterAssetId
} from "@/assets/config/character-model-manifest";
import {
  environmentPropManifest,
  metaverseHubCrateEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId
} from "@/assets/config/environment-prop-manifest";
import type { AssetLodGroup } from "@/assets/types/asset-lod";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentBoxColliderDescriptor,
  EnvironmentMountDescriptor
} from "@/assets/types/environment-asset-manifest";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentMountProofConfig,
  MetaverseEnvironmentPlacementProofConfig,
  MetaverseEnvironmentProofConfig
} from "@/metaverse/types/metaverse-runtime";

function resolveLodModelPath(renderModel: AssetLodGroup): string {
  const preferredLod =
    renderModel.lods.find((lod) => lod.tier === renderModel.defaultTier) ??
    renderModel.lods[0];

  if (preferredLod === undefined) {
    throw new Error("Metaverse asset manifest requires at least one LOD entry.");
  }

  return preferredLod.modelPath;
}

function resolveMetaverseCharacterProofConfig(): MetaverseCharacterProofConfig {
  const characterDescriptor = characterModelManifest.characters.find(
    (character) => character.id === metaverseMannequinCharacterAssetId
  );

  if (characterDescriptor === undefined) {
    throw new Error(
      `Metaverse character manifest is missing ${metaverseMannequinCharacterAssetId}.`
    );
  }

  if (characterDescriptor.animationClipIds[0] === undefined) {
    throw new Error(`Metaverse character ${characterDescriptor.label} has no animation clip ids.`);
  }

  return Object.freeze({
    animationClips: Object.freeze(
      characterDescriptor.animationClipIds.map((clipId) => {
        const clipDescriptor = animationClipManifest.clips.find(
          (clip) => clip.id === clipId
        );

        if (clipDescriptor === undefined) {
          throw new Error(`Metaverse animation manifest is missing clip ${clipId}.`);
        }

        return Object.freeze({
          clipName: clipDescriptor.clipName,
          sourcePath: clipDescriptor.sourcePath,
          vocabulary: clipDescriptor.vocabulary
        });
      })
    ),
    characterId: characterDescriptor.id,
    label: characterDescriptor.label,
    modelPath: resolveLodModelPath(characterDescriptor.renderModel),
    socketNames: characterDescriptor.socketIds
  });
}

function resolveMetaverseAttachmentProofConfig(
  characterProofConfig: MetaverseCharacterProofConfig
): MetaverseAttachmentProofConfig {
  const characterDescriptor = characterModelManifest.characters.find(
    (character) => character.id === characterProofConfig.characterId
  );

  if (characterDescriptor === undefined) {
    throw new Error(
      `Metaverse character manifest is missing ${characterProofConfig.characterId}.`
    );
  }

  const attachmentDescriptor = attachmentModelManifest.attachments.find(
    (attachment) => attachment.id === metaverseServicePistolAttachmentAssetId
  );

  if (attachmentDescriptor === undefined) {
    throw new Error(
      `Metaverse attachment manifest is missing ${metaverseServicePistolAttachmentAssetId}.`
    );
  }

  if (!attachmentDescriptor.allowedSocketIds.includes(attachmentDescriptor.defaultSocketId)) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} must allow its default socket ${attachmentDescriptor.defaultSocketId}.`
    );
  }

  if (!characterDescriptor.socketIds.includes(attachmentDescriptor.defaultSocketId)) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} default socket ${attachmentDescriptor.defaultSocketId} is unavailable on ${characterDescriptor.label}.`
    );
  }

  if (!attachmentDescriptor.compatibleSkeletons.includes(characterDescriptor.skeleton)) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} is incompatible with skeleton ${characterDescriptor.skeleton}.`
    );
  }

  return Object.freeze({
    attachmentId: attachmentDescriptor.id,
    label: attachmentDescriptor.label,
    modelPath: resolveLodModelPath(attachmentDescriptor.renderModel),
    socketName: attachmentDescriptor.defaultSocketId
  });
}

function resolveEnvironmentLods(
  renderModel: AssetLodGroup
): readonly MetaverseEnvironmentLodProofConfig[] {
  if (renderModel.lods.length === 0) {
    throw new Error("Metaverse environment asset manifest requires at least one LOD entry.");
  }

  return Object.freeze(
    renderModel.lods.map((lod) =>
      Object.freeze({
        maxDistanceMeters: lod.maxDistanceMeters,
        modelPath: lod.modelPath,
        tier: lod.tier
      })
    )
  );
}

const metaverseHubCratePlacements = Object.freeze([
  Object.freeze({
    position: Object.freeze({ x: -9.5, y: 0, z: -10.5 }),
    rotationYRadians: Math.PI * 0.08,
    scale: 1
  }),
  Object.freeze({
    position: Object.freeze({ x: -8, y: 0, z: -12.2 }),
    rotationYRadians: Math.PI * 0.17,
    scale: 0.96
  }),
  Object.freeze({
    position: Object.freeze({ x: -6.4, y: 0, z: -11 }),
    rotationYRadians: Math.PI * 0.28,
    scale: 1.08
  }),
  Object.freeze({
    position: Object.freeze({ x: -7.1, y: 0, z: -8.8 }),
    rotationYRadians: Math.PI * -0.12,
    scale: 0.92
  })
] satisfies readonly MetaverseEnvironmentPlacementProofConfig[]);

const metaverseHubDockPlacements = Object.freeze([
  Object.freeze({
    position: Object.freeze({ x: -8.2, y: -0.02, z: -14.8 }),
    rotationYRadians: Math.PI * 0.06,
    scale: 1
  })
] satisfies readonly MetaverseEnvironmentPlacementProofConfig[]);

const metaverseHubPushableCratePlacements = Object.freeze([
  Object.freeze({
    position: Object.freeze({ x: -3.8, y: 0.46, z: -14.4 }),
    rotationYRadians: Math.PI * 0.04,
    scale: 1
  })
] satisfies readonly MetaverseEnvironmentPlacementProofConfig[]);

const metaverseHubSkiffPlacements = Object.freeze([
  Object.freeze({
    position: Object.freeze({ x: 12.2, y: 0.12, z: -13.8 }),
    rotationYRadians: Math.PI * 0.86,
    scale: 1
  })
] satisfies readonly MetaverseEnvironmentPlacementProofConfig[]);

function resolveEnvironmentCollider(
  collider: EnvironmentBoxColliderDescriptor | null
): MetaverseEnvironmentColliderProofConfig | null {
  if (collider === null) {
    return null;
  }

  return Object.freeze({
    center: Object.freeze({
      x: collider.center.x,
      y: collider.center.y,
      z: collider.center.z
    }),
    shape: collider.shape,
    size: Object.freeze({
      x: collider.size.x,
      y: collider.size.y,
      z: collider.size.z
    })
  });
}

function resolveEnvironmentPhysicsColliders(
  colliders: readonly EnvironmentBoxColliderDescriptor[] | null
): readonly MetaverseEnvironmentColliderProofConfig[] | null {
  if (colliders === null) {
    return null;
  }

  return Object.freeze(
    colliders.map((collider) =>
      Object.freeze({
        center: Object.freeze({
          x: collider.center.x,
          y: collider.center.y,
          z: collider.center.z
        }),
        shape: collider.shape,
        size: Object.freeze({
          x: collider.size.x,
          y: collider.size.y,
          z: collider.size.z
        })
      })
    )
  );
}

function resolveEnvironmentMount(
  mount: EnvironmentMountDescriptor | null
): MetaverseEnvironmentMountProofConfig | null {
  if (mount === null) {
    return null;
  }

  return Object.freeze({
    seatSocketName: mount.seatSocketId
  });
}

function resolveMetaverseEnvironmentAssetProofConfig(
  environmentDescriptor: EnvironmentAssetDescriptor,
  placements: readonly MetaverseEnvironmentPlacementProofConfig[],
  characterProofConfig: MetaverseCharacterProofConfig
): MetaverseEnvironmentAssetProofConfig {
  if (placements.length === 0) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} requires at least one placement.`
    );
  }

  if (environmentDescriptor.traversalAffordance === "mount") {
    if (environmentDescriptor.placement !== "dynamic") {
      throw new Error(
        `Metaverse environment asset ${environmentDescriptor.label} may only use mount affordance on dynamic placement.`
      );
    }
  } else if (environmentDescriptor.mount !== null) {
    throw new Error(
      `Metaverse environment asset ${environmentDescriptor.label} cannot expose mount metadata without mount affordance.`
    );
  }

  if (environmentDescriptor.placement === "dynamic") {
    if (environmentDescriptor.collider === null) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentDescriptor.label} requires collider metadata.`
      );
    }

    if (
      environmentDescriptor.traversalAffordance !== "mount" &&
      environmentDescriptor.traversalAffordance !== "pushable"
    ) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentDescriptor.label} must use mount or pushable affordance.`
      );
    }

    if (environmentDescriptor.traversalAffordance === "mount") {
      if (environmentDescriptor.collisionPath === null) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires a collision path.`
        );
      }

      if (environmentDescriptor.mount === null) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires mount metadata.`
        );
      }

      if (environmentDescriptor.mount.seatSocketId !== "seat_socket") {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} must mount through seat_socket.`
        );
      }

      if (!characterProofConfig.socketNames.includes(environmentDescriptor.mount.seatSocketId)) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires character socket ${environmentDescriptor.mount.seatSocketId}.`
        );
      }
    } else if (environmentDescriptor.mount !== null) {
      throw new Error(
        `Metaverse pushable environment asset ${environmentDescriptor.label} cannot expose mount metadata.`
      );
    }

    if (environmentDescriptor.renderModel.lods.length !== 1) {
      throw new Error(
        `Metaverse dynamic environment asset ${environmentDescriptor.label} must stay single-LOD until seat switching is implemented.`
      );
    }
  }

  return Object.freeze({
    collisionPath: environmentDescriptor.collisionPath,
    collider: resolveEnvironmentCollider(environmentDescriptor.collider),
    environmentAssetId: environmentDescriptor.id,
    label: environmentDescriptor.label,
    lods: resolveEnvironmentLods(environmentDescriptor.renderModel),
    mount: resolveEnvironmentMount(environmentDescriptor.mount),
    placement: environmentDescriptor.placement,
    placements,
    physicsColliders: resolveEnvironmentPhysicsColliders(
      environmentDescriptor.physicsColliders
    ),
    traversalAffordance: environmentDescriptor.traversalAffordance
  });
}

function resolveMetaverseEnvironmentProofConfig(
  characterProofConfig: MetaverseCharacterProofConfig
): MetaverseEnvironmentProofConfig {
  const environmentAssets = [
    {
      assetId: metaverseHubDockEnvironmentAssetId,
      placements: metaverseHubDockPlacements
    },
    {
      assetId: metaverseHubCrateEnvironmentAssetId,
      placements: metaverseHubCratePlacements
    },
    {
      assetId: metaverseHubPushableCrateEnvironmentAssetId,
      placements: metaverseHubPushableCratePlacements
    },
    {
      assetId: metaverseHubSkiffEnvironmentAssetId,
      placements: metaverseHubSkiffPlacements
    }
  ] as const;
  const assets = environmentAssets.map(({ assetId, placements }) => {
    const environmentDescriptor = environmentPropManifest.environmentAssets.find(
      (environmentAsset) => environmentAsset.id === assetId
    );

    if (environmentDescriptor === undefined) {
      throw new Error(`Metaverse environment manifest is missing ${assetId}.`);
    }

    return resolveMetaverseEnvironmentAssetProofConfig(
      environmentDescriptor,
      placements,
      characterProofConfig
    );
  });

  if (!assets.some((asset) => asset.placement === "instanced")) {
    throw new Error("Metaverse environment proof slice requires one instanced asset family.");
  }

  if (!assets.some((asset) => asset.placement === "static")) {
    throw new Error("Metaverse environment proof slice requires one static asset family.");
  }

  if (!assets.some((asset) => asset.lods.length >= 2)) {
    throw new Error("Metaverse environment proof slice requires at least one multi-tier LOD asset.");
  }

  if (!assets.some((asset) => asset.placement === "dynamic")) {
    throw new Error("Metaverse environment proof slice requires one dynamic mountable asset.");
  }

  return Object.freeze({
    assets: Object.freeze(assets)
  });
}

export const metaverseCharacterProofConfig = resolveMetaverseCharacterProofConfig();

export const metaverseAttachmentProofConfig = resolveMetaverseAttachmentProofConfig(
  metaverseCharacterProofConfig
);

export const metaverseEnvironmentProofConfig = resolveMetaverseEnvironmentProofConfig(
  metaverseCharacterProofConfig
);
