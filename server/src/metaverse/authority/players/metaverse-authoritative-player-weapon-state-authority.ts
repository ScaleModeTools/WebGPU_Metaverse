import {
  createMetaverseSyncPlayerWeaponStateCommand,
  type MetaverseRealtimePlayerWeaponStateSnapshot,
  type MetaverseSyncPlayerWeaponStateCommand
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";

interface MetaverseAuthoritativePlayerWeaponStateRuntimeState {
  lastProcessedWeaponSequence: number;
  lastSeenAtMs: number;
  readonly playerId: MetaversePlayerId;
  realtimeWorldAuthorityActive: boolean;
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
}

interface MetaverseAuthoritativePlayerWeaponStateAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerWeaponStateRuntimeState
> {
  readonly incrementSnapshotSequence: () => void;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly resolveCanonicalWeaponState?: (
    playerRuntime: PlayerRuntime,
    command: MetaverseSyncPlayerWeaponStateCommand
  ) => MetaverseRealtimePlayerWeaponStateSnapshot | null;
}

function doWeaponStatesMatch(
  left: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  right: MetaverseRealtimePlayerWeaponStateSnapshot | null
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.activeSlotId === right.activeSlotId &&
      left.aimMode === right.aimMode &&
      left.weaponId === right.weaponId &&
      left.slots.length === right.slots.length &&
      left.slots.every((leftSlot, slotIndex) => {
        const rightSlot = right.slots[slotIndex] ?? null;

        return (
          rightSlot !== null &&
          leftSlot.attachmentId === rightSlot.attachmentId &&
          leftSlot.equipped === rightSlot.equipped &&
          leftSlot.slotId === rightSlot.slotId &&
          leftSlot.weaponId === rightSlot.weaponId &&
          leftSlot.weaponInstanceId === rightSlot.weaponInstanceId
        );
      }))
  );
}

export class MetaverseAuthoritativePlayerWeaponStateAuthority<
  PlayerRuntime extends MetaverseAuthoritativePlayerWeaponStateRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativePlayerWeaponStateAuthorityDependencies<PlayerRuntime>;

  constructor(
    dependencies: MetaverseAuthoritativePlayerWeaponStateAuthorityDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;
  }

  acceptSyncPlayerWeaponStateCommand(
    command: MetaverseSyncPlayerWeaponStateCommand,
    nowMs: number
  ): void {
    const normalizedCommand = createMetaverseSyncPlayerWeaponStateCommand(command);
    const playerRuntime = this.#dependencies.playersById.get(
      normalizedCommand.playerId
    );

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;
    playerRuntime.lastSeenAtMs = nowMs;

    if (
      normalizedCommand.weaponSequence <=
      playerRuntime.lastProcessedWeaponSequence
    ) {
      return;
    }

    const nextWeaponState =
      this.#dependencies.resolveCanonicalWeaponState?.(
        playerRuntime,
        normalizedCommand
      ) ?? normalizedCommand.weaponState;
    const weaponStateChanged = !doWeaponStatesMatch(
      playerRuntime.weaponState,
      nextWeaponState
    );

    playerRuntime.lastProcessedWeaponSequence =
      normalizedCommand.weaponSequence;
    playerRuntime.weaponState = nextWeaponState;

    if (weaponStateChanged) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }
}
