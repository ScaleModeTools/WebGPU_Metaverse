import { type AnimationMixer, Group, Scene } from "three/webgpu";

import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";

const remoteCharacterInterpolationRatePerSecond = 12;
const remoteCharacterTeleportSnapDistanceMeters = 3.5;

interface CharacterRuntimeLike {
  readonly anchorGroup: Group;
  readonly heldWeaponPoseRuntime: object | null;
  readonly humanoidV2PistolPoseRuntime: object | null;
  readonly mixer: AnimationMixer;
}

interface AttachmentRuntimeLike {
  readonly activeMountKind: "held" | "mounted-holster" | null;
}

export interface MetaverseRemoteCharacterPresentationRuntimeState<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime
> {
  attachmentRuntime: TAttachmentRuntime | null;
  readonly characterRuntime: TCharacterRuntime;
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
  readonly clearPistolPoseWeights: (
    pistolPoseRuntime: NonNullable<TCharacterRuntime["humanoidV2PistolPoseRuntime"]>
  ) => void;
  readonly cloneAttachmentRuntime: (
    sourceAttachmentRuntime: TAttachmentRuntime,
    characterRuntime: TCharacterRuntime
  ) => TAttachmentRuntime;
  readonly cloneCharacterRuntime: (
    sourceCharacterRuntime: TCharacterRuntime,
    playerId: string
  ) => TCharacterRuntime;
  readonly resolveHeldAnimationVocabulary: (
    characterRuntime: TCharacterRuntime,
    attachmentRuntime: TAttachmentRuntime | null,
    targetVocabulary: MetaverseCharacterAnimationVocabularyId,
    mountedCharacterRuntime: TMountedCharacterRuntime | null
  ) => MetaverseCharacterAnimationVocabularyId;
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
      MetaverseRemoteCharacterPresentationSnapshot["mountedOccupancy"]
  ) => void;
  readonly syncCharacterAnimation: (
    characterRuntime: TCharacterRuntime,
    targetVocabulary: MetaverseCharacterAnimationVocabularyId,
    useHumanoidV2PistolLayering?: boolean,
    animationCycleId?: number | null
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
    aimCamera: NonNullable<MetaverseRemoteCharacterPresentationSnapshot["aimCamera"]>
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
  readonly syncPistolPoseWeights: (
    pistolPoseRuntime: NonNullable<TCharacterRuntime["humanoidV2PistolPoseRuntime"]>,
    pitchRadians: number,
    orientation: Pick<
      MetaverseRuntimeConfig["orientation"],
      "maxPitchRadians" | "minPitchRadians"
    >
  ) => void;
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

export function syncRemoteCharacterPresentations<
  TCharacterRuntime extends CharacterRuntimeLike,
  TAttachmentRuntime extends AttachmentRuntimeLike,
  TMountedCharacterRuntime,
  TMountedEnvironmentRuntime
>(
  scene: Scene,
  sourceCharacterRuntime: TCharacterRuntime | null,
  sourceAttachmentRuntime: TAttachmentRuntime | null,
  config: Pick<MetaverseRuntimeConfig, "orientation">,
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
  dependencies: MetaverseRemoteCharacterPresentationDependencies<
    TCharacterRuntime,
    TAttachmentRuntime,
    TMountedCharacterRuntime,
    TMountedEnvironmentRuntime
  >
): void {
  if (sourceCharacterRuntime === null) {
    for (const remoteCharacterRuntime of remoteCharacterRuntimesByPlayerId.values()) {
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
        attachmentRuntime:
          sourceAttachmentRuntime === null
            ? null
            : dependencies.cloneAttachmentRuntime(
                sourceAttachmentRuntime,
                characterRuntime
              ),
        characterRuntime,
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

      if (
        existingRemoteCharacterRuntime.attachmentRuntime === null &&
        sourceAttachmentRuntime !== null
      ) {
        existingRemoteCharacterRuntime.attachmentRuntime =
          dependencies.cloneAttachmentRuntime(
            sourceAttachmentRuntime,
            existingRemoteCharacterRuntime.characterRuntime
          );
      }
    }

    if (remoteCharacterRuntime === undefined) {
      continue;
    }

    remoteCharacterRuntime.mountedCharacterRuntime =
      dependencies.syncMountedCharacterRuntime(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.mountedCharacterRuntime,
        remoteCharacterRuntime.targetMountedOccupancy,
        dependencies.resolveMountedEnvironmentRuntime
      );
    if (remoteCharacterRuntime.attachmentRuntime !== null) {
      dependencies.syncAttachmentMount(
        remoteCharacterRuntime.attachmentRuntime,
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.targetMountedOccupancy
      );
    }

    const useHumanoidV2PistolLayering =
      remoteCharacterRuntime.attachmentRuntime !== null &&
      remoteCharacterRuntime.attachmentRuntime.activeMountKind === "held" &&
      remoteCharacterRuntime.mountedCharacterRuntime === null &&
      remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime !== null;

    dependencies.syncCharacterAnimation(
      remoteCharacterRuntime.characterRuntime,
      dependencies.resolveHeldAnimationVocabulary(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.attachmentRuntime,
        remoteCharacterPresentation.presentation.animationVocabulary,
        remoteCharacterRuntime.mountedCharacterRuntime
      ),
      useHumanoidV2PistolLayering,
      remoteCharacterPresentation.presentation.animationCycleId
    );

    if (remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime !== null) {
      if (useHumanoidV2PistolLayering) {
        dependencies.syncPistolPoseWeights(
          remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime,
          remoteCharacterPresentation.look.pitchRadians,
          config.orientation
        );
      } else {
        dependencies.clearPistolPoseWeights(
          remoteCharacterRuntime.characterRuntime.humanoidV2PistolPoseRuntime
        );
      }
    }

    remoteCharacterRuntime.characterRuntime.mixer.update(deltaSeconds);

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

    if (
      remoteCharacterRuntime.attachmentRuntime !== null &&
      remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime !== null &&
      remoteCharacterRuntime.attachmentRuntime.activeMountKind === "held" &&
      remoteCharacterPresentation.aimCamera !== null
    ) {
      dependencies.restoreHeldWeaponPoseRuntime(
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime
      );
      remoteCharacterRuntime.characterRuntime.anchorGroup.updateMatrixWorld(true);
      dependencies.syncHeldWeaponPose(
        remoteCharacterRuntime.characterRuntime,
        remoteCharacterRuntime.characterRuntime.heldWeaponPoseRuntime,
        remoteCharacterRuntime.attachmentRuntime,
        remoteCharacterPresentation.aimCamera
      );
    }
  }

  for (const [playerId, remoteCharacterRuntime] of remoteCharacterRuntimesByPlayerId) {
    if (activePlayerIds.has(playerId)) {
      continue;
    }

    remoteCharacterRuntime.characterRuntime.anchorGroup.parent?.remove(
      remoteCharacterRuntime.characterRuntime.anchorGroup
    );
    remoteCharacterRuntimesByPlayerId.delete(playerId);
  }
}
