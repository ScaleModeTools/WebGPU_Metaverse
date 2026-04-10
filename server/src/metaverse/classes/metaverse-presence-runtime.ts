import {
  createMetaversePresencePlayerSnapshot,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceRosterSnapshot,
  createMetaversePresencePoseSnapshot,
  type MetaverseJoinPresenceCommand,
  type MetaverseLeavePresenceCommand,
  type MetaversePlayerId,
  type MetaversePresenceCommand,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot,
  type MetaverseSyncPresenceCommand
} from "@webgpu-metaverse/shared";

import { metaversePresenceRuntimeConfig } from "../config/metaverse-presence-runtime.js";
import type { MetaversePresenceRuntimeConfig } from "../types/metaverse-presence-runtime.js";

interface MetaversePresencePlayerRuntimeState {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  lastSeenAtMs: number;
  pose: MetaversePresencePoseSnapshot;
  readonly username: MetaversePresencePlayerSnapshot["username"];
}

function sortPlayerSnapshots(
  leftPlayer: MetaversePresencePlayerSnapshot,
  rightPlayer: MetaversePresencePlayerSnapshot
): number {
  if (leftPlayer.playerId < rightPlayer.playerId) {
    return -1;
  }

  if (leftPlayer.playerId > rightPlayer.playerId) {
    return 1;
  }

  return 0;
}

function normalizeNowMs(nowMs: number): number {
  return Number.isFinite(nowMs) ? nowMs : 0;
}

function isOlderPresenceUpdate(
  currentPose: MetaversePresencePoseSnapshot,
  nextPose: MetaversePresencePoseSnapshot
): boolean {
  return nextPose.stateSequence < currentPose.stateSequence;
}

export class MetaversePresenceRuntime {
  readonly #config: MetaversePresenceRuntimeConfig;
  readonly #playersById = new Map<MetaversePlayerId, MetaversePresencePlayerRuntimeState>();

  #snapshotSequence = 0;

  constructor(config: Partial<MetaversePresenceRuntimeConfig> = {}) {
    this.#config = {
      playerInactivityTimeoutMs:
        config.playerInactivityTimeoutMs ??
        metaversePresenceRuntimeConfig.playerInactivityTimeoutMs,
      tickIntervalMs:
        config.tickIntervalMs ?? metaversePresenceRuntimeConfig.tickIntervalMs
    };
  }

  readRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#pruneInactivePlayers(normalizedNowMs);

    if (
      observerPlayerId !== undefined &&
      !this.#playersById.has(observerPlayerId)
    ) {
      throw new Error(`Unknown metaverse player: ${observerPlayerId}`);
    }

    if (observerPlayerId !== undefined) {
      this.#recordObserverHeartbeat(observerPlayerId, normalizedNowMs);
    }

    return createMetaversePresenceRosterSnapshot({
      players: [...this.#playersById.values()]
        .map((playerRuntime) =>
          createMetaversePresencePlayerSnapshot({
            characterId: playerRuntime.characterId,
            playerId: playerRuntime.playerId,
            pose: playerRuntime.pose,
            username: playerRuntime.username
          })
        )
        .sort(sortPlayerSnapshots),
      snapshotSequence: this.#snapshotSequence,
      tickIntervalMs: Number(this.#config.tickIntervalMs)
    });
  }

  acceptCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#pruneInactivePlayers(normalizedNowMs);

    switch (command.type) {
      case "join-presence":
        this.#acceptJoinCommand(command, normalizedNowMs);
        break;
      case "leave-presence":
        this.#acceptLeaveCommand(command);
        break;
      case "sync-presence":
        this.#acceptSyncCommand(command, normalizedNowMs);
        break;
      default: {
        const exhaustiveCommand: never = command;

        throw new Error(
          `Unsupported metaverse presence command type: ${exhaustiveCommand}`
        );
      }
    }

    return createMetaversePresenceRosterEvent(
      this.readRosterSnapshot(normalizedNowMs)
    );
  }

  #acceptJoinCommand(
    command: MetaverseJoinPresenceCommand,
    nowMs: number
  ): void {
    const nextPose = createMetaversePresencePoseSnapshot(command.pose);
    const currentPlayer = this.#playersById.get(command.playerId);

    this.#playersById.set(command.playerId, {
      characterId: command.characterId,
      lastSeenAtMs: nowMs,
      playerId: command.playerId,
      pose:
        currentPlayer !== undefined &&
        isOlderPresenceUpdate(currentPlayer.pose, nextPose)
          ? currentPlayer.pose
          : nextPose,
      username: command.username
    });
    this.#snapshotSequence += 1;
  }

  #acceptLeaveCommand(command: MetaverseLeavePresenceCommand): void {
    if (!this.#playersById.delete(command.playerId)) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    this.#snapshotSequence += 1;
  }

  #acceptSyncCommand(
    command: MetaverseSyncPresenceCommand,
    nowMs: number
  ): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    const nextPose = createMetaversePresencePoseSnapshot(command.pose);

    playerRuntime.lastSeenAtMs = nowMs;

    if (!isOlderPresenceUpdate(playerRuntime.pose, nextPose)) {
      playerRuntime.pose = nextPose;
      this.#snapshotSequence += 1;
    }
  }

  #recordObserverHeartbeat(
    observerPlayerId: MetaversePlayerId,
    nowMs: number
  ): void {
    const observerRuntime = this.#playersById.get(observerPlayerId);

    if (observerRuntime === undefined) {
      return;
    }

    observerRuntime.lastSeenAtMs = nowMs;
  }

  #pruneInactivePlayers(nowMs: number): void {
    const timeoutMs = Number(this.#config.playerInactivityTimeoutMs);
    let prunedPlayer = false;

    for (const [playerId, playerRuntime] of this.#playersById) {
      if (nowMs - playerRuntime.lastSeenAtMs <= timeoutMs) {
        continue;
      }

      this.#playersById.delete(playerId);
      prunedPlayer = true;
    }

    if (prunedPlayer) {
      this.#snapshotSequence += 1;
    }
  }
}
