import { animationClipManifest } from "@/assets/config/animation-clip-manifest";
import {
  humanoidV2PistolAimClipNamesByPoseId,
  humanoidV2PistolAnimationSourcePath
} from "@/assets/config/humanoid-v2-pistol-animation-source";
import {
  attachmentModelManifest,
  metaverseServicePistolAttachmentAssetId
} from "@/assets/config/attachment-model-manifest";
import {
  characterModelManifest,
  metaverseActiveFullBodyCharacterAssetId
} from "@/assets/config/character-model-manifest";
import {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary
} from "@/assets/types/animation-clip-manifest";
import type { SkeletonId, SocketId } from "@/assets/types/asset-socket";
import type {
  AttachmentMountSocketDescriptor,
  AttachmentOffHandSupportPointIdBySocketId,
  AttachmentSupportPointDescriptor
} from "@/assets/types/attachment-asset-manifest";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig
} from "@/metaverse/types/metaverse-runtime";

import { resolveMetaverseProofLodModelPath } from "./resolve-metaverse-proof-lod-model-path";

function isSupportedFullBodySkeleton(skeleton: SkeletonId): boolean {
  switch (skeleton) {
    case "humanoid_v1":
    case "humanoid_v2":
      return true;
  }

  return false;
}

function resolveHeldAttachmentSocketName(
  skeletonId: SkeletonId,
  socketId: SocketId
): MetaverseAttachmentProofConfig["heldMount"]["socketName"] {
  if (skeletonId === "humanoid_v2") {
    switch (socketId) {
      case "hand_l_socket":
        return "grip_l_socket";
      case "hand_r_socket":
        return "grip_r_socket";
      default:
        return socketId;
    }
  }

  return socketId;
}

function resolveAttachmentSupportPoints(
  attachmentLabel: string,
  supportPoints: readonly AttachmentSupportPointDescriptor[] | null
) {
  if (supportPoints === null) {
    return null;
  }

  const supportPointIds = new Set<string>();

  return Object.freeze(
    supportPoints.map((supportPoint) => {
      if (supportPointIds.has(supportPoint.supportPointId)) {
        throw new Error(
          `Metaverse attachment ${attachmentLabel} has duplicate support point ${supportPoint.supportPointId}.`
        );
      }

      supportPointIds.add(supportPoint.supportPointId);

      if (
        !Number.isFinite(supportPoint.localPosition.x) ||
        !Number.isFinite(supportPoint.localPosition.y) ||
        !Number.isFinite(supportPoint.localPosition.z)
      ) {
        throw new Error(
          `Metaverse attachment ${attachmentLabel} requires finite support point ${supportPoint.supportPointId} local position metadata.`
        );
      }

      return Object.freeze({
        localPosition: Object.freeze({
          x: supportPoint.localPosition.x,
          y: supportPoint.localPosition.y,
          z: supportPoint.localPosition.z
        }),
        supportPointId: supportPoint.supportPointId
      });
    })
  );
}

function resolveAttachmentNodeName(
  attachmentLabel: string,
  nodeName: string,
  label: string
): string {
  const trimmedNodeName = nodeName.trim();

  if (trimmedNodeName.length === 0) {
    throw new Error(
      `Metaverse attachment ${attachmentLabel} requires ${label}.`
    );
  }

  return trimmedNodeName;
}

function resolveAttachmentSocketNodeName(
  attachmentLabel: string,
  mountDescriptor: AttachmentMountSocketDescriptor,
  socketName: string
): string {
  const attachmentSocketNodeNameBySocketName =
    mountDescriptor.attachmentSocketNodeNameBySocketId as
      | Readonly<Record<string, string | null | undefined>>
      | undefined;
  const attachmentSocketNodeName =
    attachmentSocketNodeNameBySocketName?.[socketName] ??
    mountDescriptor.attachmentSocketNodeName ??
    null;

  if (attachmentSocketNodeName === null) {
    throw new Error(
      `Metaverse attachment ${attachmentLabel} requires an attachment socket node name for ${socketName}.`
    );
  }

  return resolveAttachmentNodeName(
    attachmentLabel,
    attachmentSocketNodeName,
    `attachment socket node name for ${socketName}`
  );
}

function resolveOffHandSupportPointId(
  attachmentLabel: string,
  supportPoints: ReturnType<typeof resolveAttachmentSupportPoints>,
  offHandSupportPointIdBySocketId:
    | AttachmentOffHandSupportPointIdBySocketId
    | null
    | undefined,
  socketId: string
) {
  const supportPointIdBySocketName =
    offHandSupportPointIdBySocketId as
      | Readonly<Record<string, string | null | undefined>>
      | null
      | undefined;
  const rawSupportPointId = supportPointIdBySocketName?.[socketId] ?? null;

  if (rawSupportPointId === null || rawSupportPointId === undefined) {
    return null;
  }

  const supportPointId = rawSupportPointId.trim();

  if (supportPointId.length === 0) {
    throw new Error(
      `Metaverse attachment ${attachmentLabel} requires a non-empty off-hand support point id for ${socketId}.`
    );
  }

  if (
    supportPoints === null ||
    !supportPoints.some(
      (supportPoint) => supportPoint.supportPointId === supportPointId
    )
  ) {
    throw new Error(
      `Metaverse attachment ${attachmentLabel} maps ${socketId} to unknown off-hand support point ${supportPointId}.`
    );
  }

  return supportPointId;
}

function resolveMetaverseCharacterProofConfig(): MetaverseCharacterProofConfig {
  const characterDescriptor = characterModelManifest.characters.find(
    (character) => character.id === metaverseActiveFullBodyCharacterAssetId
  );

  if (characterDescriptor === undefined) {
    throw new Error(
      `Metaverse character manifest is missing ${metaverseActiveFullBodyCharacterAssetId}.`
    );
  }

  if (!isSupportedFullBodySkeleton(characterDescriptor.skeleton)) {
    throw new Error(
      `Metaverse full-body proof character ${characterDescriptor.label} must use a supported humanoid skeleton.`
    );
  }

  if (!characterDescriptor.presentationModes.some((mode) => mode === "full-body")) {
    throw new Error(
      `Metaverse full-body proof character ${characterDescriptor.label} must expose full-body presentation mode.`
    );
  }

  const animationClipsByVocabulary = new Map<
    MetaverseCharacterProofConfig["animationClips"][number]["vocabulary"],
    MetaverseCharacterProofConfig["animationClips"][number]
  >();

  for (const clipId of characterDescriptor.animationClipIds) {
    const clipDescriptor = animationClipManifest.clips.find((clip) => clip.id === clipId);

    if (clipDescriptor === undefined) {
      throw new Error(`Metaverse animation manifest is missing clip ${clipId}.`);
    }

    if (clipDescriptor.targetSkeleton !== characterDescriptor.skeleton) {
      throw new Error(
        `Metaverse clip ${clipDescriptor.label} targets ${clipDescriptor.targetSkeleton}, not ${characterDescriptor.skeleton}.`
      );
    }

    if (
      clipDescriptor.clipName !==
      canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]
    ) {
      throw new Error(
        `Metaverse clip ${clipDescriptor.label} must preserve canonical clip name ${canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]}.`
      );
    }

    if (animationClipsByVocabulary.has(clipDescriptor.vocabulary)) {
      throw new Error(
        `Metaverse character ${characterDescriptor.label} has duplicate animation vocabulary ${clipDescriptor.vocabulary}.`
      );
    }

    animationClipsByVocabulary.set(
      clipDescriptor.vocabulary,
      Object.freeze({
        clipName: clipDescriptor.clipName,
        sourcePath: clipDescriptor.sourcePath,
        vocabulary: clipDescriptor.vocabulary
      })
    );
  }

  const missingVocabularies = animationVocabularyIds.filter(
    (vocabulary) => !animationClipsByVocabulary.has(vocabulary)
  );

  if (missingVocabularies[0] !== undefined) {
    throw new Error(
      `Metaverse full-body proof character ${characterDescriptor.label} must resolve canonical animation vocabularies: ${missingVocabularies.join(", ")}.`
    );
  }

  return Object.freeze({
    animationClips: Object.freeze(
      animationVocabularyIds.map((vocabulary) => {
        const animationClip = animationClipsByVocabulary.get(vocabulary);

        if (animationClip === undefined) {
          throw new Error(
            `Metaverse full-body proof character ${characterDescriptor.label} is missing animation vocabulary ${vocabulary}.`
          );
        }

        return animationClip;
      })
    ),
    characterId: characterDescriptor.id,
    humanoidV2PistolPoseProofConfig:
      characterDescriptor.skeleton === "humanoid_v2"
        ? Object.freeze({
            clipNamesByPoseId: humanoidV2PistolAimClipNamesByPoseId,
            sourcePath: humanoidV2PistolAnimationSourcePath
          })
        : null,
    label: characterDescriptor.label,
    modelPath: resolveMetaverseProofLodModelPath(characterDescriptor.renderModel),
    skeletonId: characterDescriptor.skeleton,
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

  const resolvedSupportPoints = resolveAttachmentSupportPoints(
    attachmentDescriptor.label,
    attachmentDescriptor.supportPoints
  );

  return Object.freeze({
    attachmentId: attachmentDescriptor.id,
    heldMount: Object.freeze({
      attachmentSocketNodeName: resolveAttachmentSocketNodeName(
        attachmentDescriptor.label,
        attachmentDescriptor.heldMount,
        attachmentDescriptor.defaultSocketId
      ),
      offHandSupportPointId: resolveOffHandSupportPointId(
        attachmentDescriptor.label,
        resolvedSupportPoints,
        attachmentDescriptor.offHandSupportPointIdBySocketId,
        attachmentDescriptor.defaultSocketId
      ),
      socketName: resolveHeldAttachmentSocketName(
        characterDescriptor.skeleton,
        attachmentDescriptor.defaultSocketId
      )
    }),
    label: attachmentDescriptor.label,
    modelPath: resolveMetaverseProofLodModelPath(attachmentDescriptor.renderModel),
    mountedHolsterMount:
      attachmentDescriptor.mountedHolster === null
        ? null
        : Object.freeze({
            attachmentSocketNodeName: resolveAttachmentSocketNodeName(
              attachmentDescriptor.label,
              attachmentDescriptor.mountedHolster,
              attachmentDescriptor.mountedHolster.socketName
            ),
            socketName: attachmentDescriptor.mountedHolster.socketName
          }),
    supportPoints: resolvedSupportPoints
  });
}

export const metaverseCharacterProofConfig = resolveMetaverseCharacterProofConfig();

export const metaverseAttachmentProofConfig = resolveMetaverseAttachmentProofConfig(
  metaverseCharacterProofConfig
);
