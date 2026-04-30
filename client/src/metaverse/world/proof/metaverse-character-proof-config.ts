import { animationClipManifest } from "@/assets/config/animation-clip-manifest";
import {
  attachmentModelManifest,
  metaverseBattleRifleAttachmentAssetId,
  metaverseBreacherShotgunAttachmentAssetId,
  metaverseCompactSmgAttachmentAssetId,
  metaverseLongshotSniperAttachmentAssetId,
  metaverseRocketLauncherAttachmentAssetId,
  metaverseServicePistolAttachmentAssetId,
} from "@/assets/config/attachment-model-manifest";
import {
  characterModelManifest,
  metaverseActiveFullBodyCharacterAssetId,
} from "@/assets/config/character-model-manifest";
import { weaponArchetypeManifest } from "@/assets/config/weapon-archetype-manifest";
import { weaponModuleManifest } from "@/assets/config/weapon-module-manifest";
import {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary,
} from "@/assets/types/animation-clip-manifest";
import type { SocketId } from "@/assets/types/asset-socket";
import {
  heldObjectCoreSocketRolesByFamily,
  type HeldObjectHoldProfileDescriptor,
  type HeldObjectSocketRoleId,
} from "@/assets/types/held-object-authoring-manifest";
import type {
  WeaponArchetypeDescriptor,
  WeaponModuleAssetDescriptor,
  WeaponModuleSlotId,
} from "@/assets/types/weapon-builder-manifest";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
} from "@/metaverse/types/metaverse-runtime";

import { resolveMetaverseProofLodModelPath } from "./resolve-metaverse-proof-lod-model-path";

function resolveHeldAttachmentSocketName(
  socketId: SocketId,
): MetaverseAttachmentProofConfig["heldMount"]["socketName"] {
  // Handheld weapons are authored around an explicit grip socket, so mount them
  // to the synthesized grip seam instead of the broader palm center.
  return socketId === "hand_r_socket" ? "grip_r_socket" : socketId;
}

function validateAttachmentHoldProfile(
  attachmentLabel: string,
  holdProfile: HeldObjectHoldProfileDescriptor,
): void {
  const roles = new Set<HeldObjectSocketRoleId>();

  for (const socket of holdProfile.sockets) {
    if (roles.has(socket.role)) {
      throw new Error(
        `Metaverse attachment ${attachmentLabel} has duplicate semantic socket role ${socket.role}.`,
      );
    }

    if (socket.nodeName.trim().length === 0) {
      throw new Error(
        `Metaverse attachment ${attachmentLabel} requires semantic socket ${socket.role} to have a node name.`,
      );
    }

    roles.add(socket.role);
  }

  const requiredRoles = new Set<HeldObjectSocketRoleId>([
    "basis.forward",
    "basis.up",
    "grip.primary",
    ...heldObjectCoreSocketRolesByFamily[holdProfile.family],
  ]);

  if (
    holdProfile.adsPolicy !== "none" &&
    holdProfile.adsPolicy !== "third_person_hint_only"
  ) {
    requiredRoles.add(holdProfile.adsReferenceRole ?? "camera.ads_anchor");
  }

  for (const role of requiredRoles) {
    if (!roles.has(role)) {
      throw new Error(
        `Metaverse attachment ${attachmentLabel} requires semantic socket role ${role}.`,
      );
    }
  }
}

function resolveAttachmentSocketRole(
  attachmentLabel: string,
  holdProfile: HeldObjectHoldProfileDescriptor,
  socketRole: HeldObjectSocketRoleId,
  label: string,
): HeldObjectSocketRoleId {
  if (!holdProfile.sockets.some((socket) => socket.role === socketRole)) {
    throw new Error(
      `Metaverse attachment ${attachmentLabel} requires ${label} to reference semantic socket role ${socketRole}.`,
    );
  }

  return socketRole;
}

function resolveWeaponDefaultModuleProofConfigs(
  weaponDescriptor: WeaponArchetypeDescriptor,
): MetaverseAttachmentProofConfig["modules"] {
  const moduleSocketsBySlotId = new Map<
    WeaponModuleSlotId,
    WeaponArchetypeDescriptor["moduleSockets"][number]
  >();

  for (const moduleSocket of weaponDescriptor.moduleSockets) {
    if (moduleSocketsBySlotId.has(moduleSocket.slotId)) {
      throw new Error(
        `Metaverse weapon ${weaponDescriptor.label} has duplicate module socket ${moduleSocket.slotId}.`,
      );
    }

    if (moduleSocket.required && moduleSocket.defaultModuleId === null) {
      throw new Error(
        `Metaverse weapon ${weaponDescriptor.label} requires a default module for ${moduleSocket.slotId}.`,
      );
    }

    moduleSocketsBySlotId.set(moduleSocket.slotId, moduleSocket);
  }

  const defaultModuleProofConfigs: MetaverseAttachmentProofConfig["modules"][number][] =
    [];

  for (const moduleSocket of weaponDescriptor.moduleSockets) {
    const defaultModuleId = moduleSocket.defaultModuleId;

    if (defaultModuleId === null) {
      continue;
    }

    const moduleDescriptor = weaponModuleManifest.modules.find(
      (module) => module.id === defaultModuleId,
    ) as WeaponModuleAssetDescriptor | undefined;

    if (moduleDescriptor === undefined) {
      throw new Error(
        `Metaverse weapon ${weaponDescriptor.label} references unknown default module ${defaultModuleId}.`,
      );
    }

    if (
      !moduleDescriptor.compatibleFamilies.includes(weaponDescriptor.family)
    ) {
      throw new Error(
        `Metaverse weapon ${weaponDescriptor.label} default module ${moduleDescriptor.label} is incompatible with ${weaponDescriptor.family}.`,
      );
    }

    if (moduleDescriptor.slotId !== moduleSocket.slotId) {
      throw new Error(
        `Metaverse weapon ${weaponDescriptor.label} default module ${moduleDescriptor.label} targets ${moduleDescriptor.slotId}, not ${moduleSocket.slotId}.`,
      );
    }

    defaultModuleProofConfigs.push(
      Object.freeze({
        label: moduleDescriptor.label,
        modelPath: resolveMetaverseProofLodModelPath(moduleDescriptor.model),
        moduleId: moduleDescriptor.id,
        socketRole: resolveAttachmentSocketRole(
          weaponDescriptor.label,
          weaponDescriptor.holdProfile,
          moduleSocket.socketRole,
          `module socket ${moduleSocket.slotId}`,
        ),
      }),
    );
  }

  return Object.freeze(defaultModuleProofConfigs);
}

function resolveMetaverseCharacterProofConfig(): MetaverseCharacterProofConfig {
  const characterDescriptor = characterModelManifest.characters.find(
    (character) => character.id === metaverseActiveFullBodyCharacterAssetId,
  );

  if (characterDescriptor === undefined) {
    throw new Error(
      `Metaverse character manifest is missing ${metaverseActiveFullBodyCharacterAssetId}.`,
    );
  }

  if (
    !characterDescriptor.presentationModes.some((mode) => mode === "full-body")
  ) {
    throw new Error(
      `Metaverse full-body proof character ${characterDescriptor.label} must expose full-body presentation mode.`,
    );
  }

  const animationClipsByVocabulary = new Map<
    MetaverseCharacterProofConfig["animationClips"][number]["vocabulary"],
    MetaverseCharacterProofConfig["animationClips"][number]
  >();

  for (const clipId of characterDescriptor.animationClipIds) {
    const clipDescriptor = animationClipManifest.clips.find(
      (clip) => clip.id === clipId,
    );

    if (clipDescriptor === undefined) {
      throw new Error(
        `Metaverse animation manifest is missing clip ${clipId}.`,
      );
    }

    if (clipDescriptor.targetSkeleton !== characterDescriptor.skeleton) {
      throw new Error(
        `Metaverse clip ${clipDescriptor.label} targets ${clipDescriptor.targetSkeleton}, not ${characterDescriptor.skeleton}.`,
      );
    }

    if (
      clipDescriptor.clipName !==
      canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]
    ) {
      throw new Error(
        `Metaverse clip ${clipDescriptor.label} must preserve canonical clip name ${canonicalAnimationClipNamesByVocabulary[clipDescriptor.vocabulary]}.`,
      );
    }

    if (animationClipsByVocabulary.has(clipDescriptor.vocabulary)) {
      throw new Error(
        `Metaverse character ${characterDescriptor.label} has duplicate animation vocabulary ${clipDescriptor.vocabulary}.`,
      );
    }

    animationClipsByVocabulary.set(
      clipDescriptor.vocabulary,
      Object.freeze({
        clipName: clipDescriptor.clipName,
        loopMode: clipDescriptor.loopMode,
        sourcePath: clipDescriptor.sourcePath,
        vocabulary: clipDescriptor.vocabulary,
      }),
    );
  }

  const missingVocabularies = animationVocabularyIds.filter(
    (vocabulary) => !animationClipsByVocabulary.has(vocabulary),
  );

  if (missingVocabularies[0] !== undefined) {
    throw new Error(
      `Metaverse full-body proof character ${characterDescriptor.label} must resolve canonical animation vocabularies: ${missingVocabularies.join(", ")}.`,
    );
  }

  return Object.freeze({
    animationClips: Object.freeze(
      animationVocabularyIds.map((vocabulary) => {
        const animationClip = animationClipsByVocabulary.get(vocabulary);

        if (animationClip === undefined) {
          throw new Error(
            `Metaverse full-body proof character ${characterDescriptor.label} is missing animation vocabulary ${vocabulary}.`,
          );
        }

        return animationClip;
      }),
    ),
    characterId: characterDescriptor.id,
    label: characterDescriptor.label,
    modelPath: resolveMetaverseProofLodModelPath(
      characterDescriptor.renderModel,
    ),
    skeletonId: characterDescriptor.skeleton,
    socketNames: characterDescriptor.socketIds,
  });
}

function resolveMetaverseAttachmentProofConfig(
  characterProofConfig: MetaverseCharacterProofConfig,
  attachmentId: string = metaverseServicePistolAttachmentAssetId,
): MetaverseAttachmentProofConfig {
  const characterDescriptor = characterModelManifest.characters.find(
    (character) => character.id === characterProofConfig.characterId,
  );

  if (characterDescriptor === undefined) {
    throw new Error(
      `Metaverse character manifest is missing ${characterProofConfig.characterId}.`,
    );
  }

  const attachmentDescriptor = attachmentModelManifest.attachments.find(
    (attachment) => attachment.id === attachmentId,
  );

  if (attachmentDescriptor === undefined) {
    throw new Error(
      `Metaverse attachment manifest is missing ${attachmentId}.`,
    );
  }

  if (
    !attachmentDescriptor.allowedSocketIds.includes(
      attachmentDescriptor.defaultSocketId,
    )
  ) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} must allow its default socket ${attachmentDescriptor.defaultSocketId}.`,
    );
  }

  if (
    !characterDescriptor.socketIds.includes(
      attachmentDescriptor.defaultSocketId,
    )
  ) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} default socket ${attachmentDescriptor.defaultSocketId} is unavailable on ${characterDescriptor.label}.`,
    );
  }

  if (
    !attachmentDescriptor.compatibleSkeletons.includes(
      characterDescriptor.skeleton,
    )
  ) {
    throw new Error(
      `Metaverse attachment ${attachmentDescriptor.label} is incompatible with skeleton ${characterDescriptor.skeleton}.`,
    );
  }

  const weaponDescriptor = weaponArchetypeManifest.archetypes.find(
    (weapon) => weapon.id === attachmentDescriptor.id,
  ) as WeaponArchetypeDescriptor | undefined;

  if (weaponDescriptor === undefined) {
    throw new Error(
      `Metaverse weapon manifest is missing attachment ${attachmentDescriptor.id}.`,
    );
  }

  validateAttachmentHoldProfile(
    attachmentDescriptor.label,
    attachmentDescriptor.holdProfile,
  );

  return Object.freeze({
    attachmentId: attachmentDescriptor.id,
    heldMount: Object.freeze({
      adsCameraTargetOffset:
        attachmentDescriptor.heldMount.adsCameraTargetOffset === null ||
        attachmentDescriptor.heldMount.adsCameraTargetOffset === undefined
          ? null
          : Object.freeze({
              across:
                attachmentDescriptor.heldMount.adsCameraTargetOffset.across,
              forward:
                attachmentDescriptor.heldMount.adsCameraTargetOffset.forward,
              up: attachmentDescriptor.heldMount.adsCameraTargetOffset.up,
            }),
      attachmentSocketRole: resolveAttachmentSocketRole(
        attachmentDescriptor.label,
        attachmentDescriptor.holdProfile,
        attachmentDescriptor.heldMount.attachmentSocketRole,
        "held mount",
      ),
      socketName: resolveHeldAttachmentSocketName(
        attachmentDescriptor.defaultSocketId,
      ),
    }),
    holdProfile: attachmentDescriptor.holdProfile,
    label: attachmentDescriptor.label,
    modelPath: resolveMetaverseProofLodModelPath(
      attachmentDescriptor.renderModel,
    ),
    modules: resolveWeaponDefaultModuleProofConfigs(weaponDescriptor),
    mountedHolsterMount:
      attachmentDescriptor.mountedHolster === null
        ? null
        : Object.freeze({
            attachmentSocketRole: resolveAttachmentSocketRole(
              attachmentDescriptor.label,
              attachmentDescriptor.holdProfile,
              attachmentDescriptor.mountedHolster.attachmentSocketRole,
              "mounted holster",
            ),
            socketName: attachmentDescriptor.mountedHolster.socketName,
          }),
  });
}

export const metaverseCharacterProofConfig =
  resolveMetaverseCharacterProofConfig();

export const metaverseAttachmentProofConfig =
  resolveMetaverseAttachmentProofConfig(metaverseCharacterProofConfig);

export const metaverseAttachmentProofConfigs = Object.freeze([
  metaverseAttachmentProofConfig,
  resolveMetaverseAttachmentProofConfig(
    metaverseCharacterProofConfig,
    metaverseCompactSmgAttachmentAssetId,
  ),
  resolveMetaverseAttachmentProofConfig(
    metaverseCharacterProofConfig,
    metaverseBattleRifleAttachmentAssetId,
  ),
  resolveMetaverseAttachmentProofConfig(
    metaverseCharacterProofConfig,
    metaverseBreacherShotgunAttachmentAssetId,
  ),
  resolveMetaverseAttachmentProofConfig(
    metaverseCharacterProofConfig,
    metaverseLongshotSniperAttachmentAssetId,
  ),
  resolveMetaverseAttachmentProofConfig(
    metaverseCharacterProofConfig,
    metaverseRocketLauncherAttachmentAssetId,
  ),
]);
