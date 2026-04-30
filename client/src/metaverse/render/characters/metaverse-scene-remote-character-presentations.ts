import { type AnimationMixer, Group, Scene } from "three/webgpu";

import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
import {
  clearCharacterCombatDeathPresentation,
  shouldUseHeldWeaponCharacterPresentation,
  syncCharacterDeathRagdollPresentation,
  syncCharacterProceduralHitReaction,
  type MetaverseCharacterProceduralHitReactionRuntime
} from "./metaverse-scene-character-animation";
import type {
  MetaverseCharacterRapierRagdollRuntime
} from "./metaverse-scene-character-ragdoll";
import type { HeldObjectAimState } from "./metaverse-scene-held-weapon-pose";
import {
  createMetaverseSemanticAimFrameFromCameraSnapshot,
  type MetaverseSemanticAimFrame
} from "../../aim/metaverse-semantic-aim";
import type { HeldObjectPoseProfileId } from "@/assets/types/held-object-authoring-manifest";

const remoteCharacterInterpolationRatePerSecond = 12;
const remoteCharacterTeleportSnapDistanceMeters = 3.5;
const remoteHeldWeaponLastKnownAimTtlSeconds = 0.25;

interface CharacterRuntimeLike {
  readonly anchorGroup: Group;
  readonly deathRagdollRuntime: MetaverseCharacterRapierRagdollRuntime;
  readonly heldWeaponPoseRuntime: object | null;
  readonly mixer: AnimationMixer;
  readonly proceduralHitReactionRuntime: MetaverseCharacterProceduralHitReactionRuntime;
}

interface AttachmentRuntimeLike {
  readonly activeMountKind: "held" | "mounted-holster" | null;
  readonly attachmentId: string;
  readonly holdProfile: {
    readonly poseProfileId: HeldObjectPoseProfileId;
  };
}

export interface MetaverseRemoteCharacterPresentationRuntimeState<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime
> {
  attachmentRuntime: TAttachmentRuntime | null;
  readonly attachmentRuntimesByAttachmentId: Map<string, TAttachmentRuntime>;
  readonly characterRuntime: TCharacterRuntime;
  lastKnownAimFrame: MetaverseSemanticAimFrame | null;
  lastKnownAimFrameAgeSeconds: number;
  mountedCharacterRuntime: TMountedCharacterRuntime | null;
  targetMountedOccupancy:
    MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"];
  targetPresentation: MetaverseCharacterPresentationSnapshot;
}

export interface MetaverseRemoteCharacterPresentationDependencies<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime,
  TMountedEnvironmentRuntime
> {
  readonly applyMountedAnchorTransform: (
    characterRuntime: TCharacterRuntime,
    mountedCharacterRuntime: TMountedCharacterRuntime
  ) => void;
  readonly captureHeldWeaponPoseRuntime: (
    heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
  ) => void;
  readonly prepareHeldWeaponPoseRuntime: (
    heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
  ) => void;
  readonly cloneAttachmentRuntime: (
    sourceAttachmentRuntime: TAttachmentRuntime,
    characterRuntime: TCharacterRuntime
  ) => TAttachmentRuntime;
  readonly cloneCharacterRuntime: (
    sourceCharacterRuntime: TCharacterRuntime,
    playerId: string
  ) => TCharacterRuntime;
  readonly resolveMountedEnvironmentRuntime: (
    environmentAssetId: string
  ) => TMountedEnvironmentRuntime | null;
  readonly restoreHeldWeaponPoseRuntime: (
    heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>
  ) => void;
  readonly syncAttachmentMount: (
    attachmentRuntime: TAttachmentRuntime,
    characterRuntime: TCharacterRuntime,
    mountedOccupancy:
      MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"],
    weaponState: MetaverseRemoteCharacterPresentationSnapshot["weaponState"]
  ) => void;
  readonly syncCharacterAnimation: (
    characterRuntime: TCharacterRuntime,
    targetVocabulary: MetaverseCharacterAnimationVocabularyId,
    animationCycleId?: number | null,
    animationPlaybackRateMultiplier?: number
  ) => void;
  readonly syncCharacterPresentation: (
    characterRuntime: TCharacterRuntime,
    characterPresentation: MetaverseCharacterPresentationSnapshot | null,
    mountedCharacterRuntime: TMountedCharacterRuntime | null
  ) => void;
  readonly syncHeldWeaponPose: (
    characterRuntime: TCharacterRuntime,
    heldWeaponPoseRuntime: NonNullable<TCharacterRuntime["heldWeaponPoseRuntime"]>,
    attachmentRuntime: TAttachmentRuntime,
    aimState: HeldObjectAimState,
    weaponState: MetaverseRemoteCharacterPresentationSnapshot["weaponState"],
    bodyPresentation?: Pick<
      MetaverseRuntimeConfig["bodyPresentation"],
      | "groundedFirstPersonHeadClearanceMeters"
      | "groundedFirstPersonHeadOcclusionRadiusMeters"
    >
  ) => void;
  readonly syncMountedCharacterRuntime: (
    characterRuntime: TCharacterRuntime,
    mountedCharacterRuntime: TMountedCharacterRuntime | null,
    mountedOccupancy:
      MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"],
    resolveMountedEnvironmentRuntime: (
      environmentAssetId: string
    ) => TMountedEnvironmentRuntime | null
  ) => TMountedCharacterRuntime | null;
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function resolveCharacterRenderYawRadians(yawRadians: number): number {
  return wrapRadians(Math.PI - yawRadians);
}

function resolveRemoteCharacterInterpolationAlpha(deltaSeconds: number): number {
  if (deltaSeconds <= 0) {
    return 0;
  }

  return (
    1 - Math.exp(-remoteCharacterInterpolationRatePerSecond * deltaSeconds)
  );
}

function syncInterpolatedRemoteCharacterPresentation<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime
>(
  remoteCharacterRuntime: MetaverseRemoteCharacterPresentationRuntimeState<
    TCharacterRuntime,
    TAttachmentRuntime,
    TMountedCharacterRuntime
  >,
  deltaSeconds: number
): void {
  const anchorGroup = remoteCharacterRuntime.characterRuntime.anchorGroup;
  const targetPresentation = remoteCharacterRuntime.targetPresentation;
  const positionDeltaX = targetPresentation.position.x - anchorGroup.position.x;
  const positionDeltaY = targetPresentation.position.y - anchorGroup.position.y;
  const positionDeltaZ = targetPresentation.position.z - anchorGroup.position.z;
  const positionDistance = Math.hypot(
    positionDeltaX,
    positionDeltaY,
    positionDeltaZ
  );

  anchorGroup.visible = true;

  if (positionDistance >= remoteCharacterTeleportSnapDistanceMeters) {
    anchorGroup.position.set(
      targetPresentation.position.x,
      targetPresentation.position.y,
      targetPresentation.position.z
    );
    anchorGroup.rotation.set(
      0,
      resolveCharacterRenderYawRadians(targetPresentation.yawRadians),
      0
    );
    anchorGroup.updateMatrixWorld(true);
    return;
  }

  const interpolationAlpha =
    resolveRemoteCharacterInterpolationAlpha(deltaSeconds);

  if (interpolationAlpha <= 0) {
    return;
  }

  const yawDifference = wrapRadians(
    resolveCharacterRenderYawRadians(targetPresentation.yawRadians) -
      anchorGroup.rotation.y
  );

  anchorGroup.position.set(
    anchorGroup.position.x + positionDeltaX * interpolationAlpha,
    anchorGroup.position.y + positionDeltaY * interpolationAlpha,
    anchorGroup.position.z + positionDeltaZ * interpolationAlpha
  );
  anchorGroup.rotation.set(
    0,
    wrapRadians(anchorGroup.rotation.y + yawDifference * interpolationAlpha),
    0
  );
  anchorGroup.updateMatrixWorld(true);
}

function syncRemoteCharacterCombatDeathPresentation<
  TCharacterRuntime extends CharacterRuntimeLike
>(
  characterRuntime: TCharacterRuntime,
  remoteCharacterPresentation: MetaverseRemoteCharacterPresentationSnapshot,
  nowMs: number
): void {
  if (remoteCharacterPresentation.combatAlive !== false) {
    clearCharacterCombatDeathPresentation(characterRuntime);
    return;
  }

  if (!characterRuntime.deathRagdollRuntime.isActive) {
    characterRuntime.deathRagdollRuntime.trigger({
      kind: "death",
      playerId: remoteCharacterPresentation.playerId,
      sequence: remoteCharacterPresentation.presentation.animationCycleId ?? 0,
      startedAtMs: nowMs,
      weaponId: remoteCharacterPresentation.weaponState?.weaponId ?? null
    });
  }

  syncCharacterDeathRagdollPresentation(characterRuntime, nowMs);
}

export function syncRemoteCharacterPresentations<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime,
  TMountedEnvironmentRuntime
>(
  scene: Scene,
  sourceCharacterRuntime: TCharacterRuntime | null,
  sourceAttachmentRuntimesByAttachmentId: ReadonlyMap<
    string,
    TAttachmentRuntime
  >,
  config: Pick<
    MetaverseRuntimeConfig,
    "bodyPresentation" | "orientation"
  >,
  remoteCharacterRuntimesByPlayerId: Map<
    string,
    MetaverseRemoteCharacterPresentationRuntimeState<
      TCharacterRuntime,
      TAttachmentRuntime,
      TMountedCharacterRuntime
    >
  >,
  remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[],
  deltaSeconds: number,
  nowMs: number,
  dependencies: MetaverseRemoteCharacterPresentationDependencies<
    TCharacterRuntime,
    TAttachmentRuntime,
    TMountedCharacterRuntime,
    TMountedEnvironmentRuntime
  >
): void {
  if (sourceCharacterRuntime === null) {
    for (const remoteCharacterRuntime of remoteCharacterRuntimesByPlayerId.values()) {
      clearCharacterCombatDeathPresentation(
        remoteCharacterRuntime.characterRuntime
      );
      remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
        remoteCharacterRuntime.characterRuntime.anchorGroup
      );
    }

    remoteCharacterRuntimesByPlayerId.clear();
    return;
  }

  const activePlayerIds = new Set<string>();

  for (const remoteCharacterPresentation of remoteCharacterPresentations) {
    activePlayerIds.add(remoteCharacterPresentation.playerId);

    let remoteCharacterRuntime = remoteCharacterRuntimesByPlayerId.get(
      remoteCharacterPresentation.playerId
    );
    const remoteCharacterRuntimeCreated = remoteCharacterRuntime === undefined;

    if (remoteCharacterRuntimeCreated) {
      const characterRuntime = dependencies.cloneCharacterRuntime(
        sourceCharacterRuntime,
        remoteCharacterPresentation.playerId
      );

      remoteCharacterRuntime = {
        attachmentRuntime: null,
        attachmentRuntimesByAttachmentId: new Map<string, TAttachmentRuntime>(),
        characterRuntime,
        lastKnownAimFrame: null,
        lastKnownAimFrameAgeSeconds: remoteHeldWeaponLastKnownAimTtlSeconds,
        mountedCharacterRuntime: null,
        targetMountedOccupancy: remoteCharacterPresentation.mountedOccupancy ?? null,
        targetPresentation: remoteCharacterPresentation.presentation
      };
      remoteCharacterRuntimesByPlayerId.set(
        remoteCharacterPresentation.playerId,
        remoteCharacterRuntime
      );
      scene.add(characterRuntime.anchorGroup);
    } else {
      const existingRemoteCharacterRuntime = remoteCharacterRuntime;

      if (existingRemoteCharacterRuntime === undefined) {
        continue;
      }

      existingRemoteCharacterRuntime.targetMountedOccupancy =
        remoteCharacterPresentation.mountedOccupancy ?? null;
      existingRemoteCharacterRuntime.targetPresentation =
        remoteCharacterPresentation.presentation;
    }

    if (remoteCharacterRuntime === undefined) {
      continue;
    }

    remoteCharacterRuntime.lastKnownAimFrameAgeSeconds += Math.max(
      0,
      deltaSeconds
    );
    remoteCharacterRuntime.mountedCharacterRuntime =
      dependencies.syncMountedCharacterRuntime(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.mountedCharacterRuntime,
        remoteCharacterRuntime.targetMountedOccupancy,
        dependencies.resolveMountedEnvironmentRuntime
      );
    const targetAttachmentIds =
      remoteCharacterPresentation.weaponState?.slots?.map(
        (slot) => slot.attachmentId
      ) ??
      (remoteCharacterPresentation.weaponState?.weaponId === undefined ||
      remoteCharacterPresentation.weaponState.weaponId === null
        ? []
        : [remoteCharacterPresentation.weaponState.weaponId]);
    const activeAttachmentId =
      remoteCharacterPresentation.weaponState?.slots?.find(
        (slot) =>
          slot.slotId === remoteCharacterPresentation.weaponState?.activeSlotId
      )?.attachmentId ??
      remoteCharacterPresentation.weaponState?.weaponId ??
      null;

    remoteCharacterRuntime.attachmentRuntime = null;

    for (const targetAttachmentId of targetAttachmentIds) {
      const sourceAttachmentRuntime =
        sourceAttachmentRuntimesByAttachmentId.get(targetAttachmentId);

      if (sourceAttachmentRuntime === undefined) {
        continue;
      }

      let remoteAttachmentRuntime =
        remoteCharacterRuntime.attachmentRuntimesByAttachmentId.get(
          sourceAttachmentRuntime.attachmentId
        );

      if (remoteAttachmentRuntime === undefined) {
        remoteAttachmentRuntime = dependencies.cloneAttachmentRuntime(
          sourceAttachmentRuntime,
          remoteCharacterRuntime.characterRuntime
        );
        remoteCharacterRuntime.attachmentRuntimesByAttachmentId.set(
          remoteAttachmentRuntime.attachmentId,
          remoteAttachmentRuntime
        );
      }

      if (sourceAttachmentRuntime.attachmentId === activeAttachmentId) {
        remoteCharacterRuntime.attachmentRuntime = remoteAttachmentRuntime;
      }
    }

    for (const attachmentRuntime of remoteCharacterRuntime.attachmentRuntimesByAttachmentId.values()) {
      dependencies.syncAttachmentMount(
        attachmentRuntime,
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.targetMountedOccupancy,
        remoteCharacterPresentation.weaponState
      );
    }

    const heldWeaponPresentationActive =
      shouldUseHeldWeaponCharacterPresentation(
        remoteCharacterRuntime.attachmentRuntime,
        remoteCharacterPresentation.weaponState,
        remoteCharacterRuntime.mountedCharacterRuntime
      );
    if (!heldWeaponPresentationActive) {
      remoteCharacterRuntime.lastKnownAimFrame = null;
      remoteCharacterRuntime.lastKnownAimFrameAgeSeconds =
        remoteHeldWeaponLastKnownAimTtlSeconds;
    }

    if (remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime !== null) {
      dependencies.prepareHeldWeaponPoseRuntime(
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime
      );
    }

    if (!remoteCharacterRuntime.characterRuntime.deathRagdollRuntime.isActive) {
      dependencies.syncCharacterAnimation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation.animationVocabulary,
        remoteCharacterPresentation.presentation.animationCycleId,
        remoteCharacterPresentation.presentation.animationPlaybackRateMultiplier
      );

      remoteCharacterRuntime.characterRuntime.mixer.update(deltaSeconds);
    }

    if (remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime !== null) {
      dependencies.captureHeldWeaponPoseRuntime(
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime
      );

      if (!heldWeaponPresentationActive) {
        dependencies.restoreHeldWeaponPoseRuntime(
          remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime
        );
      }
    }

    if (remoteCharacterRuntime.mountedCharacterRuntime !== null) {
      dependencies.syncCharacterPresentation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation,
        remoteCharacterRuntime.mountedCharacterRuntime
      );
      dependencies.applyMountedAnchorTransform(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.mountedCharacterRuntime
      );
      syncCharacterProceduralHitReaction(
        remoteCharacterRuntime.characterRuntime,
        nowMs
      );
      continue;
    }

    if (remoteCharacterPresentation.poseSyncMode === "runtime-server-sampled") {
      dependencies.syncCharacterPresentation(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterPresentation.presentation,
        null
      );
    } else {
      if (remoteCharacterRuntimeCreated) {
        dependencies.syncCharacterPresentation(
          remoteCharacterRuntime.characterRuntime,
          remoteCharacterPresentation.presentation,
          null
        );
      }

      syncInterpolatedRemoteCharacterPresentation(
        remoteCharacterRuntime,
        deltaSeconds
      );
    }

    syncCharacterProceduralHitReaction(
      remoteCharacterRuntime.characterRuntime,
      nowMs
    );

    if (
      heldWeaponPresentationActive &&
      remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime !== null &&
      remoteCharacterRuntime.attachmentRuntime !== null
    ) {
      dependencies.restoreHeldWeaponPoseRuntime(
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime
      );
      remoteCharacterRuntime.characterRuntime.anchorGroup.updateMatrixWorld(true);
      const heldObjectAimState =
        remoteCharacterPresentation.aimCamera === null
          ? remoteCharacterRuntime.lastKnownAimFrame !== null &&
            remoteCharacterRuntime.lastKnownAimFrameAgeSeconds <=
              remoteHeldWeaponLastKnownAimTtlSeconds
            ? {
                ...remoteCharacterRuntime.lastKnownAimFrame,
                aimMode: remoteCharacterPresentation.weaponState?.aimMode ?? null,
                quality: "last_known_replicated" as const,
                weaponId:
                  remoteCharacterPresentation.weaponState?.weaponId ??
                  remoteCharacterRuntime.attachmentRuntime.attachmentId
              }
            : null
          : createMetaverseSemanticAimFrameFromCameraSnapshot({
              actorFacingYawRadians:
                remoteCharacterPresentation.presentation.yawRadians,
              adsBlend: null,
              attachmentRuntime: remoteCharacterRuntime.attachmentRuntime,
              cameraSnapshot: remoteCharacterPresentation.aimCamera,
              quality: "replicated_pitch_yaw",
              source: "remote_replicated",
              weaponState: remoteCharacterPresentation.weaponState
            });

      if (
        remoteCharacterPresentation.aimCamera !== null &&
        heldObjectAimState !== null
      ) {
        remoteCharacterRuntime.lastKnownAimFrame = heldObjectAimState;
        remoteCharacterRuntime.lastKnownAimFrameAgeSeconds = 0;
      }

      if (heldObjectAimState === null) {
        syncRemoteCharacterCombatDeathPresentation(
          remoteCharacterRuntime.characterRuntime,
          remoteCharacterPresentation,
          nowMs
        );
        continue;
      }

      dependencies.syncHeldWeaponPose(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime,
        remoteCharacterRuntime.attachmentRuntime,
        heldObjectAimState,
        remoteCharacterPresentation.weaponState,
        config.bodyPresentation
      );
    }

    syncRemoteCharacterCombatDeathPresentation(
      remoteCharacterRuntime.characterRuntime,
      remoteCharacterPresentation,
      nowMs
    );
  }

  for (const [playerId, remoteCharacterRuntime] of remoteCharacterRuntimesByPlayerId) {
    if (activePlayerIds.has(playerId)) {
      continue;
    }

    remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
      remoteCharacterRuntime.characterRuntime.anchorGroup
    );
    clearCharacterCombatDeathPresentation(remoteCharacterRuntime.characterRuntime);
    remoteCharacterRuntimesByPlayerId.delete(playerId);
  }
}
