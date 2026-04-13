import { animationClipManifest } from "@/assets/config/animation-clip-manifest";
import {
  animationVocabularyIds,
  canonicalAnimationClipNamesByVocabulary
} from "@/assets/types/animation-clip-manifest";
import {
  attachmentModelManifest,
  metaverseServicePistolAttachmentAssetId
} from "@/assets/config/attachment-model-manifest";
import {
  characterModelManifest,
  metaverseActiveFullBodyCharacterAssetId
} from "@/assets/config/character-model-manifest";
import {
  environmentPropManifest,
  metaverseHubCrateEnvironmentAssetId,
  metaverseHubDockEnvironmentAssetId,
  metaverseHubDiveBoatEnvironmentAssetId,
  metaverseHubPushableCrateEnvironmentAssetId,
  metaverseHubSkiffEnvironmentAssetId
} from "@/assets/config/environment-prop-manifest";
import type { AssetLodGroup } from "@/assets/types/asset-lod";
import type { SkeletonId, SocketId } from "@/assets/types/asset-socket";
import type {
  EnvironmentAssetDescriptor,
  EnvironmentBoxColliderDescriptor,
  EnvironmentPhysicsBoxColliderDescriptor,
  EnvironmentEntryDescriptor,
  EnvironmentSeatDescriptor
} from "@/assets/types/environment-asset-manifest";
import type {
  AttachmentGripAlignmentDescriptor,
  AttachmentSupportPointDescriptor
} from "@/assets/types/attachment-asset-manifest";
import {
  normalizePlanarYawRadians
} from "@webgpu-metaverse/shared";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseEnvironmentColliderProofConfig,
  MetaverseEnvironmentEntryProofConfig,
  MetaverseEnvironmentPhysicsColliderProofConfig,
  MetaverseEnvironmentLodProofConfig,
  MetaverseEnvironmentSeatProofConfig,
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
        return "palm_l_socket";
      case "hand_r_socket":
        return "palm_r_socket";
      default:
        return socketId;
    }
  }

  return socketId;
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
    label: characterDescriptor.label,
    modelPath: resolveLodModelPath(characterDescriptor.renderModel),
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

  const resolveAttachmentVector3 = (
    vector: { readonly x: number; readonly y: number; readonly z: number },
    label: string
  ) => {
    if (
      !Number.isFinite(vector.x) ||
      !Number.isFinite(vector.y) ||
      !Number.isFinite(vector.z)
    ) {
      throw new Error(
        `Metaverse attachment ${attachmentDescriptor.label} requires finite ${label} metadata.`
      );
    }

    return Object.freeze({
      x: vector.x,
      y: vector.y,
      z: vector.z
    });
  };
  const resolveNormalizedAttachmentAxis = (
    vector: { readonly x: number; readonly y: number; readonly z: number },
    label: string
  ) => {
    const resolvedVector = resolveAttachmentVector3(vector, label);
    const magnitude = Math.hypot(
      resolvedVector.x,
      resolvedVector.y,
      resolvedVector.z
    );

    if (magnitude <= 0.000001) {
      throw new Error(
        `Metaverse attachment ${attachmentDescriptor.label} requires non-zero ${label}.`
      );
    }

    return Object.freeze({
      x: resolvedVector.x / magnitude,
      y: resolvedVector.y / magnitude,
      z: resolvedVector.z / magnitude
    });
  };
  const resolveAttachmentMarkerNodeName = (nodeName: string, label: string) => {
    const trimmedNodeName = nodeName.trim();

    if (trimmedNodeName.length === 0) {
      throw new Error(
        `Metaverse attachment ${attachmentDescriptor.label} requires ${label}.`
      );
    }

    return trimmedNodeName;
  };
  const resolveOptionalAttachmentMarkerNodeName = (
    nodeName: string | null | undefined,
    label: string
  ) => {
    if (nodeName === null || nodeName === undefined) {
      return null;
    }

    return resolveAttachmentMarkerNodeName(nodeName, label);
  };
  const resolveAttachmentGripAlignment = (
    gripAlignment: AttachmentGripAlignmentDescriptor,
    socketName: string
  ) => {
    const attachmentGripMarkerNodeNameBySocketName =
      gripAlignment.attachmentGripMarkerNodeNameBySocketId as
        | Readonly<Record<string, string | null | undefined>>
        | undefined;
    const attachmentGripMarkerNodeName =
      attachmentGripMarkerNodeNameBySocketName?.[socketName] ??
      gripAlignment.attachmentGripMarkerNodeName ??
      null;
    const socketForwardAxis = resolveNormalizedAttachmentAxis(
      gripAlignment.socketForwardAxis,
      "socket forward axis"
    );
    const socketUpAxis = resolveNormalizedAttachmentAxis(
      gripAlignment.socketUpAxis,
      "socket up axis"
    );
    const socketOffset = resolveAttachmentVector3(
      gripAlignment.socketOffset,
      "socket offset"
    );

    if ("attachmentForwardAxis" in gripAlignment) {
      const attachmentForwardAxis = resolveNormalizedAttachmentAxis(
        gripAlignment.attachmentForwardAxis,
        "attachment forward axis"
      );
      const attachmentUpAxis = resolveNormalizedAttachmentAxis(
        gripAlignment.attachmentUpAxis,
        "attachment up axis"
      );

      if (
        Math.abs(
          attachmentForwardAxis.x * attachmentUpAxis.x +
            attachmentForwardAxis.y * attachmentUpAxis.y +
            attachmentForwardAxis.z * attachmentUpAxis.z
        ) > 0.999
      ) {
        throw new Error(
          `Metaverse attachment ${attachmentDescriptor.label} requires attachment forward and up axes to stay non-collinear.`
        );
      }

      if (
        Math.abs(
          socketForwardAxis.x * socketUpAxis.x +
            socketForwardAxis.y * socketUpAxis.y +
            socketForwardAxis.z * socketUpAxis.z
        ) > 0.999
      ) {
        throw new Error(
          `Metaverse attachment ${attachmentDescriptor.label} requires socket forward and up axes to stay non-collinear.`
        );
      }

      return Object.freeze({
        attachmentForwardAxis,
        attachmentUpAxis,
        attachmentGripMarkerNodeName: resolveOptionalAttachmentMarkerNodeName(
          attachmentGripMarkerNodeName,
          `attachment grip marker node name for ${socketName}`
        ),
        socketForwardAxis,
        socketOffset,
        socketUpAxis
      });
    }

    if (
      Math.abs(
        socketForwardAxis.x * socketUpAxis.x +
          socketForwardAxis.y * socketUpAxis.y +
          socketForwardAxis.z * socketUpAxis.z
      ) > 0.999
    ) {
      throw new Error(
        `Metaverse attachment ${attachmentDescriptor.label} requires socket forward and up axes to stay non-collinear.`
      );
    }

    return Object.freeze({
      attachmentForwardMarkerNodeName: resolveAttachmentMarkerNodeName(
        gripAlignment.attachmentForwardMarkerNodeName,
        "attachment forward marker node name"
      ),
      attachmentGripMarkerNodeName: resolveOptionalAttachmentMarkerNodeName(
        attachmentGripMarkerNodeName,
        `attachment grip marker node name for ${socketName}`
      ),
      attachmentUpMarkerNodeName: resolveAttachmentMarkerNodeName(
        gripAlignment.attachmentUpMarkerNodeName,
        "attachment up marker node name"
      ),
      socketForwardAxis,
      socketOffset,
      socketUpAxis
    });
  };
  const resolveAttachmentSupportPoints = (
    supportPoints: readonly AttachmentSupportPointDescriptor[] | null
  ) => {
    if (supportPoints === null) {
      return null;
    }

    const supportPointIds = new Set<string>();

    return Object.freeze(
      supportPoints.map((supportPoint) => {
        if (supportPointIds.has(supportPoint.supportPointId)) {
          throw new Error(
            `Metaverse attachment ${attachmentDescriptor.label} has duplicate support point ${supportPoint.supportPointId}.`
          );
        }

        supportPointIds.add(supportPoint.supportPointId);

        return Object.freeze({
          localPosition: resolveAttachmentVector3(
            supportPoint.localPosition,
            `support point ${supportPoint.supportPointId} local position`
          ),
          supportPointId: supportPoint.supportPointId
        });
      })
    );
  };

  return Object.freeze({
    attachmentId: attachmentDescriptor.id,
    heldMount: Object.freeze({
      gripAlignment: resolveAttachmentGripAlignment(
        attachmentDescriptor.gripAlignment,
        attachmentDescriptor.defaultSocketId
      ),
      socketName: resolveHeldAttachmentSocketName(
        characterDescriptor.skeleton,
        attachmentDescriptor.defaultSocketId
      )
    }),
    label: attachmentDescriptor.label,
    modelPath: resolveLodModelPath(attachmentDescriptor.renderModel),
    mountedHolsterMount:
      attachmentDescriptor.mountedHolster === null
        ? null
        : Object.freeze({
            gripAlignment: resolveAttachmentGripAlignment(
              attachmentDescriptor.mountedHolster.gripAlignment,
              attachmentDescriptor.mountedHolster.socketName
            ),
            socketName: attachmentDescriptor.mountedHolster.socketName
          }),
    supportPoints: resolveAttachmentSupportPoints(
      attachmentDescriptor.supportPoints
    )
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

const metaverseHubDiveBoatPlacements = Object.freeze([
  Object.freeze({
    position: Object.freeze({ x: 22.4, y: 0.16, z: -16.2 }),
    rotationYRadians: Math.PI * 0.88,
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
  colliders: readonly EnvironmentPhysicsBoxColliderDescriptor[] | null
): readonly MetaverseEnvironmentPhysicsColliderProofConfig[] | null {
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
        }),
        traversalAffordance: collider.traversalAffordance
      })
    )
  );
}

function resolveEnvironmentSeats(
  seats: readonly EnvironmentSeatDescriptor[] | null
): readonly MetaverseEnvironmentSeatProofConfig[] | null {
  if (seats === null) {
    return null;
  }

  return Object.freeze(
    seats.map((seat) =>
      Object.freeze({
        cameraPolicyId: seat.cameraPolicyId,
        controlRoutingPolicyId: seat.controlRoutingPolicyId,
        directEntryEnabled: seat.directEntryEnabled,
        dismountOffset: Object.freeze({
          x: seat.dismountOffset.x,
          y: seat.dismountOffset.y,
          z: seat.dismountOffset.z
        }),
        label: seat.label,
        lookLimitPolicyId: seat.lookLimitPolicyId,
        occupancyAnimationId: seat.occupancyAnimationId,
        seatId: seat.seatId,
        seatNodeName: seat.seatNodeName,
        seatRole: seat.seatRole
      })
    )
  );
}

function resolveEnvironmentEntries(
  entries: readonly EnvironmentEntryDescriptor[] | null
): readonly MetaverseEnvironmentEntryProofConfig[] | null {
  if (entries === null) {
    return null;
  }

  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        cameraPolicyId: entry.cameraPolicyId,
        controlRoutingPolicyId: entry.controlRoutingPolicyId,
        dismountOffset: Object.freeze({
          x: entry.dismountOffset.x,
          y: entry.dismountOffset.y,
          z: entry.dismountOffset.z
        }),
        entryId: entry.entryId,
        entryNodeName: entry.entryNodeName,
        label: entry.label,
        lookLimitPolicyId: entry.lookLimitPolicyId,
        occupancyAnimationId: entry.occupancyAnimationId,
        occupantRole: entry.occupantRole
      })
    )
  );
}

function resolveEnvironmentOrientation(
  orientation: EnvironmentAssetDescriptor["orientation"]
): MetaverseEnvironmentAssetProofConfig["orientation"] {
  if (orientation === null) {
    return null;
  }

  if (!Number.isFinite(orientation.forwardModelYawRadians)) {
    throw new Error(
      "Metaverse vehicle orientation metadata requires a finite forward model yaw."
    );
  }

  return Object.freeze({
    forwardModelYawRadians: normalizePlanarYawRadians(
      orientation.forwardModelYawRadians
    )
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
  } else if (
    environmentDescriptor.seats !== null ||
    environmentDescriptor.entries !== null
  ) {
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

      if (
        environmentDescriptor.physicsColliders === null ||
        environmentDescriptor.physicsColliders.length === 0
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires physics colliders for hull and deck collision.`
        );
      }

      if (
        !environmentDescriptor.physicsColliders.some(
          (collider) => collider.traversalAffordance === "support"
        )
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires at least one support collider for boarding surfaces.`
        );
      }

      if (environmentDescriptor.seats === null || environmentDescriptor.seats.length === 0) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires seat metadata.`
        );
      }

      if (environmentDescriptor.orientation === null) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires vehicle orientation metadata.`
        );
      }

      const seatIds = new Set<string>();
      const entryIds = new Set<string>();
      let directEntrySeatCount = 0;

      for (const seat of environmentDescriptor.seats) {
        if (seatIds.has(seat.seatId)) {
          throw new Error(
            `Metaverse dynamic environment asset ${environmentDescriptor.label} has duplicate seat id ${seat.seatId}.`
          );
        }

        seatIds.add(seat.seatId);

        if (seat.directEntryEnabled) {
          directEntrySeatCount += 1;
        }
      }

      for (const entry of environmentDescriptor.entries ?? []) {
        if (entryIds.has(entry.entryId)) {
          throw new Error(
            `Metaverse dynamic environment asset ${environmentDescriptor.label} has duplicate entry id ${entry.entryId}.`
          );
        }

        entryIds.add(entry.entryId);
      }

      if (
        directEntrySeatCount === 0 &&
        (environmentDescriptor.entries === null ||
          environmentDescriptor.entries.length === 0)
      ) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires a direct seat or boarding entry.`
        );
      }

      if (!characterProofConfig.socketNames.includes("seat_socket")) {
        throw new Error(
          `Metaverse dynamic environment asset ${environmentDescriptor.label} requires character socket seat_socket.`
        );
      }
    } else if (
      environmentDescriptor.seats !== null ||
      environmentDescriptor.entries !== null
    ) {
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
    entries: resolveEnvironmentEntries(environmentDescriptor.entries),
    environmentAssetId: environmentDescriptor.id,
    label: environmentDescriptor.label,
    lods: resolveEnvironmentLods(environmentDescriptor.renderModel),
    orientation: resolveEnvironmentOrientation(environmentDescriptor.orientation),
    placement: environmentDescriptor.placement,
    placements,
    physicsColliders: resolveEnvironmentPhysicsColliders(
      environmentDescriptor.physicsColliders
    ),
    seats: resolveEnvironmentSeats(environmentDescriptor.seats),
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
    },
    {
      assetId: metaverseHubDiveBoatEnvironmentAssetId,
      placements: metaverseHubDiveBoatPlacements
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
