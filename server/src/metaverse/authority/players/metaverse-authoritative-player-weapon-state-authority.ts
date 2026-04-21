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
}

function doWeaponStatesMatch(
  left: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  right: MetaverseRealtimePlayerWeaponStateSnapshot | null
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.aimMode === right.aimMode &&
      left.weaponId === right.weaponId)
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

    const weaponStateChanged = !doWeaponStatesMatch(
      playerRuntime.weaponState,
      normalizedCommand.weaponState
    );

    playerRuntime.lastProcessedWeaponSequence =
      normalizedCommand.weaponSequence;
    playerRuntime.weaponState = normalizedCommand.weaponState;

    if (weaponStateChanged) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }
}
