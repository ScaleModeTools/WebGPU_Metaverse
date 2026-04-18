import {
  type MetaverseLeavePresenceCommand,
  type MetaversePlayerId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  clearMetaverseUnmountedTraversalPendingActions,
  type MetaverseUnmountedTraversalStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/traversal";
import type { MetaverseVehicleId } from "@webgpu-metaverse/shared/metaverse/realtime";

import type { RapierColliderHandle } from "../../types/metaverse-authoritative-rapier.js";

export interface MetaverseAuthoritativePlayerLifecycleGroundedBodyRuntime {
  readonly colliderHandle: RapierColliderHandle;
  dispose(): void;
}

export interface MetaverseAuthoritativePlayerLifecycleSwimBodyRuntime {
  readonly colliderHandle: RapierColliderHandle;
  dispose(): void;
}

export interface MetaverseAuthoritativePlayerLifecycleRuntimeState {
  readonly groundedBodyRuntime: MetaverseAuthoritativePlayerLifecycleGroundedBodyRuntime;
  lastSeenAtMs: number;
  readonly swimBodyRuntime: MetaverseAuthoritativePlayerLifecycleSwimBodyRuntime;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
}

export interface MetaverseAuthoritativeLifecycleVehicleSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
}

export interface MetaverseAuthoritativeLifecycleVehicleRuntimeState<
  SeatRuntime extends MetaverseAuthoritativeLifecycleVehicleSeatRuntimeState = MetaverseAuthoritativeLifecycleVehicleSeatRuntimeState
> {
  readonly seatsById: ReadonlyMap<string, SeatRuntime>;
}

interface MetaverseAuthoritativePlayerLifecycleAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativePlayerLifecycleRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeLifecycleVehicleRuntimeState
> {
  readonly driverVehicleControlsByPlayerId: Map<MetaversePlayerId, unknown>;
  readonly incrementSnapshotSequence: () => void;
  readonly playerTraversalColliderHandles: Set<RapierColliderHandle>;
  readonly playerTraversalIntentsByPlayerId: Map<MetaversePlayerId, unknown>;
  readonly playersById: Map<MetaversePlayerId, PlayerRuntime>;
  readonly playerInactivityTimeoutMs: number;
  readonly vehiclesById: ReadonlyMap<MetaverseVehicleId, VehicleRuntime>;
}

export class MetaverseAuthoritativePlayerLifecycleAuthority<
  PlayerRuntime extends MetaverseAuthoritativePlayerLifecycleRuntimeState,
  VehicleRuntime extends MetaverseAuthoritativeLifecycleVehicleRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativePlayerLifecycleAuthorityDependencies<
    PlayerRuntime,
    VehicleRuntime
  >;

  constructor(
    dependencies: MetaverseAuthoritativePlayerLifecycleAuthorityDependencies<
      PlayerRuntime,
      VehicleRuntime
    >
  ) {
    this.#dependencies = dependencies;
  }

  acceptLeaveCommand(command: MetaverseLeavePresenceCommand): void {
    const playerRuntime = this.#dependencies.playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    this.#clearPlayerState(command.playerId, playerRuntime);
    this.#dependencies.playersById.delete(command.playerId);
    this.#dependencies.incrementSnapshotSequence();
  }

  pruneInactivePlayers(nowMs: number): void {
    let prunedPlayer = false;

    for (const [playerId, playerRuntime] of this.#dependencies.playersById) {
      if (
        nowMs - playerRuntime.lastSeenAtMs <=
        this.#dependencies.playerInactivityTimeoutMs
      ) {
        continue;
      }

      this.#clearPlayerState(playerId, playerRuntime);
      this.#dependencies.playersById.delete(playerId);
      prunedPlayer = true;
    }

    if (prunedPlayer) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }

  #clearPlayerState(playerId: MetaversePlayerId, playerRuntime: PlayerRuntime): void {
    this.clearDriverVehicleControl(playerId);
    this.clearPlayerTraversalIntent(playerId);
    this.clearPlayerVehicleOccupancy(playerId);
    this.disposePlayerTraversalRuntimes(playerRuntime);
  }

  clearDriverVehicleControl(playerId: MetaversePlayerId): void {
    this.#dependencies.driverVehicleControlsByPlayerId.delete(playerId);
  }

  clearPlayerTraversalIntent(playerId: MetaversePlayerId): void {
    this.#dependencies.playerTraversalIntentsByPlayerId.delete(playerId);
    const playerRuntime = this.#dependencies.playersById.get(playerId);

    if (playerRuntime === undefined) {
      return;
    }

    playerRuntime.unmountedTraversalState =
      clearMetaverseUnmountedTraversalPendingActions(
        playerRuntime.unmountedTraversalState
      );
  }

  clearPlayerVehicleOccupancy(playerId: MetaversePlayerId): void {
    for (const vehicleRuntime of this.#dependencies.vehiclesById.values()) {
      for (const seatRuntime of vehicleRuntime.seatsById.values()) {
        if (seatRuntime.occupantPlayerId === playerId) {
          seatRuntime.occupantPlayerId = null;
        }
      }
    }
  }

  disposePlayerTraversalRuntimes(playerRuntime: PlayerRuntime): void {
    this.#dependencies.playerTraversalColliderHandles.delete(
      playerRuntime.groundedBodyRuntime.colliderHandle
    );
    this.#dependencies.playerTraversalColliderHandles.delete(
      playerRuntime.swimBodyRuntime.colliderHandle
    );
    playerRuntime.groundedBodyRuntime.dispose();
    playerRuntime.swimBodyRuntime.dispose();
  }
}
