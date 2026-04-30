import {
  createMetaverseJoinPresenceCommand,
  createMetaverseLeavePresenceCommand,
  createMetaverseRoomAssignmentSnapshot,
  createMetaverseRoomDirectoryEntrySnapshot,
  type MetaversePlayerId,
  type MetaversePlayerTeamId,
  type MetaversePresenceCommand,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot,
  type MetaverseRealtimeWorldClientCommand,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseRoomAssignmentSnapshot,
  type MetaverseRoomDirectoryEntrySnapshot,
  type MetaverseRoomId,
  type MetaverseRoomSessionId,
  type MetaverseRoomStatusId,
  type MetaverseMatchModeId
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "./metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";

export interface MetaverseRoomRuntimeConfig {
  readonly bundleId: string;
  readonly capacity: number;
  readonly launchVariationId: string;
  readonly leaderPlayerId: MetaversePlayerId | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly roomId: MetaverseRoomId;
  readonly roomSessionId: MetaverseRoomSessionId;
  readonly runtimeConfig?: Partial<MetaverseAuthoritativeWorldRuntimeConfig>;
}

export class MetaverseRoomRuntime {
  readonly #bundleId: string;
  readonly #capacity: number;
  readonly #launchVariationId: string;
  readonly #matchMode: MetaverseMatchModeId;
  readonly #roomId: MetaverseRoomId;
  readonly #roomSessionId: MetaverseRoomSessionId;
  readonly #runtime: MetaverseAuthoritativeWorldRuntime;

  #leaderPlayerId: MetaversePlayerId | null;

  constructor(config: MetaverseRoomRuntimeConfig) {
    this.#bundleId = config.bundleId;
    this.#capacity = config.capacity;
    this.#launchVariationId = config.launchVariationId;
    this.#leaderPlayerId = config.leaderPlayerId;
    this.#matchMode = config.matchMode;
    this.#roomId = config.roomId;
    this.#roomSessionId = config.roomSessionId;
    this.#runtime = new MetaverseAuthoritativeWorldRuntime(
      config.runtimeConfig ?? {},
      config.bundleId,
      config.launchVariationId
    );
  }

  get bundleId(): string {
    return this.#bundleId;
  }

  get capacity(): number {
    return this.#capacity;
  }

  get launchVariationId(): string {
    return this.#launchVariationId;
  }

  get leaderPlayerId(): MetaversePlayerId | null {
    return this.#leaderPlayerId;
  }

  get matchMode(): MetaverseMatchModeId {
    return this.#matchMode;
  }

  get roomId(): MetaverseRoomId {
    return this.#roomId;
  }

  get roomSessionId(): MetaverseRoomSessionId {
    return this.#roomSessionId;
  }

  get tickIntervalMs(): number {
    return this.#runtime.tickIntervalMs;
  }

  advanceToTime(nowMs: number): void {
    this.#runtime.advanceToTime(nowMs);
  }

  setLeaderPlayerId(playerId: MetaversePlayerId | null): void {
    this.#leaderPlayerId = playerId;
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    return this.#runtime.readPresenceRosterSnapshot(nowMs, observerPlayerId);
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return this.#runtime.readPresenceRosterEvent(nowMs, observerPlayerId);
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    return this.#runtime.readWorldSnapshot(nowMs, observerPlayerId);
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    return this.#runtime.readWorldEvent(nowMs, observerPlayerId);
  }

  acceptPresenceCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    return this.#runtime.acceptPresenceCommand(
      this.#adaptPresenceCommandForRoomPolicy(command, nowMs),
      nowMs
    );
  }

  acceptWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    return this.#runtime.acceptWorldCommand(command, nowMs);
  }

  requestNextMatch(nowMs: number): boolean {
    if (this.#matchMode !== "team-deathmatch") {
      return false;
    }

    return this.#runtime.requestNextTeamDeathmatch(nowMs);
  }

  forceRemovePlayer(playerId: MetaversePlayerId, nowMs: number): void {
    try {
      this.#runtime.acceptPresenceCommand(
        createMetaverseLeavePresenceCommand({
          playerId
        }),
        nowMs
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("Unknown metaverse player:")
      ) {
        throw error;
      }
    }
  }

  readAssignmentSnapshot(
    connectedPlayerCount: number
  ): MetaverseRoomAssignmentSnapshot {
    return createMetaverseRoomAssignmentSnapshot({
      bundleId: this.#bundleId,
      capacity: this.#capacity,
      connectedPlayerCount,
      launchVariationId: this.#launchVariationId,
      leaderPlayerId: this.#leaderPlayerId,
      matchMode: this.#matchMode,
      roomId: this.#roomId,
      roomSessionId: this.#roomSessionId
    });
  }

  readDirectoryEntry(
    nowMs: number,
    connectedPlayerCount: number,
    status: MetaverseRoomStatusId
  ): MetaverseRoomDirectoryEntrySnapshot {
    const worldSnapshot = this.#runtime.readWorldSnapshot(nowMs);
    const combatMatch = worldSnapshot.combatMatch;
    const redTeamSnapshot =
      combatMatch?.teams.find((teamSnapshot) => teamSnapshot.teamId === "red") ??
      null;
    const blueTeamSnapshot =
      combatMatch?.teams.find((teamSnapshot) => teamSnapshot.teamId === "blue") ??
      null;

    return createMetaverseRoomDirectoryEntrySnapshot({
      blueTeamPlayerCount: blueTeamSnapshot?.playerIds.length ?? 0,
      blueTeamScore: blueTeamSnapshot?.score ?? 0,
      bundleId: this.#bundleId,
      capacity: this.#capacity,
      connectedPlayerCount,
      launchVariationId: this.#launchVariationId,
      leaderPlayerId: this.#leaderPlayerId,
      matchMode: this.#matchMode,
      phase: combatMatch?.phase ?? null,
      redTeamPlayerCount: redTeamSnapshot?.playerIds.length ?? 0,
      redTeamScore: redTeamSnapshot?.score ?? 0,
      roomId: this.#roomId,
      roomSessionId: this.#roomSessionId,
      scoreLimit: combatMatch?.scoreLimit ?? null,
      status,
      timeRemainingMs:
        combatMatch === null ? null : Number(combatMatch.timeRemainingMs)
    });
  }

  #adaptPresenceCommandForRoomPolicy(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceCommand {
    if (
      this.#matchMode !== "team-deathmatch" ||
      command.type !== "join-presence"
    ) {
      return command;
    }

    const teamId = this.#resolveTeamDeathmatchJoinTeamId(
      command.playerId,
      command.teamId,
      nowMs
    );

    if (teamId === command.teamId) {
      return command;
    }

    return createMetaverseJoinPresenceCommand({
      characterId: command.characterId,
      playerId: command.playerId,
      pose: command.pose,
      teamId,
      username: command.username
    });
  }

  #resolveTeamDeathmatchJoinTeamId(
    playerId: MetaversePlayerId,
    requestedTeamId: MetaversePlayerTeamId,
    nowMs: number
  ): MetaversePlayerTeamId {
    const worldSnapshot = this.#runtime.readWorldSnapshot(nowMs);
    const currentPlayerSnapshot =
      worldSnapshot.players.find(
        (playerSnapshot) => playerSnapshot.playerId === playerId
      ) ?? null;

    if (currentPlayerSnapshot !== null) {
      return currentPlayerSnapshot.teamId;
    }

    let redPlayerCount = 0;
    let bluePlayerCount = 0;

    for (const playerSnapshot of worldSnapshot.players) {
      if (playerSnapshot.teamId === "red") {
        redPlayerCount += 1;
      } else {
        bluePlayerCount += 1;
      }
    }

    if (redPlayerCount === bluePlayerCount) {
      return requestedTeamId;
    }

    const requestedTeamPlayerCount =
      requestedTeamId === "red" ? redPlayerCount : bluePlayerCount;
    const oppositeTeamPlayerCount =
      requestedTeamId === "red" ? bluePlayerCount : redPlayerCount;

    return requestedTeamPlayerCount <= oppositeTeamPlayerCount
      ? requestedTeamId
      : requestedTeamId === "red"
        ? "blue"
        : "red";
  }
}
