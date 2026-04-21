import type {
  MetaversePlayerId,
  MetaversePresenceAnimationVocabularyId,
  MetaversePresenceLocomotionModeId,
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupancySnapshotInput,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared";

import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseHudSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";

export interface MetaversePresenceMountedOccupancyChangeKey {
  readonly environmentAssetId: string;
  readonly entryId: string | null;
  readonly occupancyKind: "entry" | "seat";
  readonly occupantRole: "driver" | "passenger" | "turret";
  readonly seatId: string | null;
}

export interface MetaversePresencePoseChangeKey {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly lookPitchRadians: number;
  readonly lookYawRadians: number;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancyChangeKey | null;
  readonly x: number;
  readonly y: number;
  readonly yawRadians: number;
  readonly z: number;
}

export interface MetaversePresenceRosterPlayerChangeKey {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly characterId: string;
  readonly lookPitchRadians: number;
  readonly lookYawRadians: number;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancyChangeKey | null;
  readonly playerId: MetaversePlayerId;
  readonly stateSequence: number;
  readonly username: string;
  readonly x: number;
  readonly y: number;
  readonly yawRadians: number;
  readonly z: number;
}

export interface MetaversePresenceRosterChangeKey {
  readonly players: readonly MetaversePresenceRosterPlayerChangeKey[];
  readonly snapshotSequence: number;
  readonly tickIntervalMs: number;
}

export interface MetaversePresencePoseSyncChange {
  readonly changed: boolean;
  readonly nextChangeKey: MetaversePresencePoseChangeKey;
  readonly poseInput: MetaverseCanonicalPresencePoseInput;
}

export interface MetaversePresenceRosterSyncChange {
  readonly changed: boolean;
  readonly nextChangeKey: MetaversePresenceRosterChangeKey | null;
  readonly remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[];
}

export interface MetaverseCanonicalPresencePoseInput {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly look: {
    readonly pitchRadians: number;
    readonly yawRadians: number;
  };
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshotInput | null;
  readonly position: MetaversePresencePoseSnapshotInput["position"];
  readonly yawRadians: number;
}

function createMountedOccupancyInput(
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaversePresenceMountedOccupancySnapshotInput | null {
  if (mountedEnvironment === null) {
    return null;
  }

  return {
    environmentAssetId: mountedEnvironment.environmentAssetId,
    entryId: mountedEnvironment.entryId,
    occupancyKind: mountedEnvironment.occupancyKind,
    occupantRole: mountedEnvironment.occupantRole,
    seatId: mountedEnvironment.seatId
  };
}

function createMountedOccupancyChangeKey(
  mountedOccupancy:
    | MetaversePresenceMountedOccupancySnapshot
    | MetaversePresenceMountedOccupancySnapshotInput
    | null
    | undefined
): MetaversePresenceMountedOccupancyChangeKey | null {
  if (mountedOccupancy === null || mountedOccupancy === undefined) {
    return null;
  }

  return Object.freeze({
    environmentAssetId: mountedOccupancy.environmentAssetId,
    entryId: mountedOccupancy.entryId,
    occupancyKind: mountedOccupancy.occupancyKind,
    occupantRole: mountedOccupancy.occupantRole,
    seatId: mountedOccupancy.seatId
  });
}

function hasMatchingMountedOccupancyChangeKey(
  current: MetaversePresenceMountedOccupancyChangeKey | null,
  next: MetaversePresenceMountedOccupancyChangeKey | null
): boolean {
  return (
    current === next ||
    (current !== null &&
      next !== null &&
      current.environmentAssetId === next.environmentAssetId &&
      current.entryId === next.entryId &&
      current.occupancyKind === next.occupancyKind &&
      current.occupantRole === next.occupantRole &&
      current.seatId === next.seatId)
  );
}

function createPresencePoseChangeKey(
  poseInput: MetaverseCanonicalPresencePoseInput
): MetaversePresencePoseChangeKey {
  return Object.freeze({
    animationVocabulary: poseInput.animationVocabulary,
    lookPitchRadians: poseInput.look.pitchRadians,
    lookYawRadians: poseInput.look.yawRadians,
    locomotionMode: poseInput.locomotionMode,
    mountedOccupancy: createMountedOccupancyChangeKey(poseInput.mountedOccupancy),
    x: poseInput.position.x,
    y: poseInput.position.y,
    yawRadians: poseInput.yawRadians,
    z: poseInput.position.z
  });
}

function hasMatchingPresencePoseChangeKey(
  current: MetaversePresencePoseChangeKey | null,
  next: MetaversePresencePoseChangeKey
): boolean {
  return (
    current !== null &&
    current.animationVocabulary === next.animationVocabulary &&
    current.locomotionMode === next.locomotionMode &&
    hasMatchingMountedOccupancyChangeKey(
      current.mountedOccupancy,
      next.mountedOccupancy
    ) &&
    current.x === next.x &&
    current.y === next.y &&
    current.z === next.z &&
    current.lookPitchRadians === next.lookPitchRadians &&
    current.lookYawRadians === next.lookYawRadians &&
    current.yawRadians === next.yawRadians
  );
}

function hasMatchingRosterChangeKey(
  rosterSnapshot: MetaversePresenceRosterSnapshot,
  changeKey: MetaversePresenceRosterChangeKey | null
): boolean {
  if (
    changeKey === null ||
    changeKey.snapshotSequence !== rosterSnapshot.snapshotSequence ||
    changeKey.tickIntervalMs !== rosterSnapshot.tickIntervalMs ||
    changeKey.players.length !== rosterSnapshot.players.length
  ) {
    return false;
  }

  for (let index = 0; index < rosterSnapshot.players.length; index += 1) {
    const playerSnapshot = rosterSnapshot.players[index]!;
    const playerChangeKey = changeKey.players[index]!;

    if (
      playerChangeKey.playerId !== playerSnapshot.playerId ||
      playerChangeKey.characterId !== playerSnapshot.characterId ||
      playerChangeKey.username !== playerSnapshot.username ||
      playerChangeKey.animationVocabulary !==
        playerSnapshot.pose.animationVocabulary ||
      playerChangeKey.lookPitchRadians !== playerSnapshot.pose.look.pitchRadians ||
      playerChangeKey.lookYawRadians !== playerSnapshot.pose.look.yawRadians ||
      playerChangeKey.locomotionMode !== playerSnapshot.pose.locomotionMode ||
      !hasMatchingMountedOccupancyChangeKey(
        playerChangeKey.mountedOccupancy,
        createMountedOccupancyChangeKey(playerSnapshot.pose.mountedOccupancy)
      ) ||
      playerChangeKey.stateSequence !== playerSnapshot.pose.stateSequence ||
      playerChangeKey.x !== playerSnapshot.pose.position.x ||
      playerChangeKey.y !== playerSnapshot.pose.position.y ||
      playerChangeKey.z !== playerSnapshot.pose.position.z ||
      playerChangeKey.yawRadians !== playerSnapshot.pose.yawRadians
    ) {
      return false;
    }
  }

  return true;
}

function createRosterChangeKey(
  rosterSnapshot: MetaversePresenceRosterSnapshot
): MetaversePresenceRosterChangeKey {
  return Object.freeze({
    players: Object.freeze(
      rosterSnapshot.players.map((playerSnapshot) =>
        Object.freeze({
          animationVocabulary: playerSnapshot.pose.animationVocabulary,
          characterId: playerSnapshot.characterId,
          lookPitchRadians: playerSnapshot.pose.look.pitchRadians,
          lookYawRadians: playerSnapshot.pose.look.yawRadians,
          locomotionMode: playerSnapshot.pose.locomotionMode,
          mountedOccupancy: createMountedOccupancyChangeKey(
            playerSnapshot.pose.mountedOccupancy
          ),
          playerId: playerSnapshot.playerId,
          stateSequence: playerSnapshot.pose.stateSequence,
          username: playerSnapshot.username,
          x: playerSnapshot.pose.position.x,
          y: playerSnapshot.pose.position.y,
          yawRadians: playerSnapshot.pose.yawRadians,
          z: playerSnapshot.pose.position.z
        })
      )
    ),
    snapshotSequence: rosterSnapshot.snapshotSequence,
    tickIntervalMs: rosterSnapshot.tickIntervalMs
  });
}

function createRemoteCharacterPresentations(
  rosterSnapshot: MetaversePresenceRosterSnapshot,
  localPlayerId: MetaversePlayerId
): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
  const remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
    [];

  for (const playerSnapshot of rosterSnapshot.players) {
    if (playerSnapshot.playerId === localPlayerId) {
      continue;
    }

    remoteCharacterPresentations.push(
      Object.freeze({
        aimCamera: null,
        characterId: playerSnapshot.characterId,
        look: Object.freeze({
          pitchRadians: playerSnapshot.pose.look.pitchRadians,
          yawRadians: playerSnapshot.pose.look.yawRadians
        }),
        mountedOccupancy: playerSnapshot.pose.mountedOccupancy,
        playerId: playerSnapshot.playerId,
        poseSyncMode: "scene-arrival-smoothed",
        presentation: Object.freeze({
          animationVocabulary: playerSnapshot.pose.animationVocabulary,
          position: playerSnapshot.pose.position,
          yawRadians: playerSnapshot.pose.yawRadians
        }),
        weaponState: null
      })
    );
  }

  return Object.freeze(remoteCharacterPresentations);
}

export function createMetaversePresencePoseInput(
  characterPresentation: MetaverseCharacterPresentationSnapshot,
  lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
  locomotionMode: MetaverseHudSnapshot["locomotionMode"],
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaverseCanonicalPresencePoseInput {
  return {
    animationVocabulary: characterPresentation.animationVocabulary,
    look: {
      pitchRadians: lookSnapshot.pitchRadians,
      yawRadians: lookSnapshot.yawRadians
    },
    locomotionMode,
    mountedOccupancy: createMountedOccupancyInput(mountedEnvironment),
    position: characterPresentation.position,
    yawRadians: characterPresentation.yawRadians
  };
}

export function resolveMetaversePresencePoseSyncChange(
  previousChangeKey: MetaversePresencePoseChangeKey | null,
  characterPresentation: MetaverseCharacterPresentationSnapshot,
  lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
  locomotionMode: MetaverseHudSnapshot["locomotionMode"],
  mountedEnvironment: MountedEnvironmentSnapshot | null
): MetaversePresencePoseSyncChange {
  const poseInput = createMetaversePresencePoseInput(
    characterPresentation,
    lookSnapshot,
    locomotionMode,
    mountedEnvironment
  );
  const nextChangeKey = createPresencePoseChangeKey(poseInput);

  return Object.freeze({
    changed: !hasMatchingPresencePoseChangeKey(previousChangeKey, nextChangeKey),
    nextChangeKey,
    poseInput
  });
}

export function resolveMetaversePresenceRosterSyncChange(
  previousChangeKey: MetaversePresenceRosterChangeKey | null,
  rosterSnapshot: MetaversePresenceRosterSnapshot | null,
  localPlayerId: MetaversePlayerId | null
): MetaversePresenceRosterSyncChange {
  if (rosterSnapshot === null || localPlayerId === null) {
    return Object.freeze({
      changed: previousChangeKey !== null,
      nextChangeKey: null,
      remoteCharacterPresentations: Object.freeze([])
    });
  }

  if (hasMatchingRosterChangeKey(rosterSnapshot, previousChangeKey)) {
    return Object.freeze({
      changed: false,
      nextChangeKey: previousChangeKey,
      remoteCharacterPresentations: Object.freeze([])
    });
  }

  return Object.freeze({
    changed: true,
    nextChangeKey: createRosterChangeKey(rosterSnapshot),
    remoteCharacterPresentations: createRemoteCharacterPresentations(
      rosterSnapshot,
      localPlayerId
    )
  });
}
