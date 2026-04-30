import {
  createMetaverseRoomDirectorySnapshot,
  createMetaverseRoomId,
  createMetaverseRoomSessionId,
  type MetaverseJoinRoomRequest,
  type MetaverseMatchModeId,
  type MetaverseNextMatchRequest,
  type MetaversePlayerId,
  type MetaversePresenceCommand,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot,
  type MetaverseQuickJoinRoomRequest,
  type MetaverseRealtimeWorldClientCommand,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseRoomAssignmentSnapshot,
  type MetaverseRoomDirectorySnapshot,
  type MetaverseRoomId,
  type MetaverseRoomSessionId,
  type MetaverseRoomStatusId
} from "@webgpu-metaverse/shared";

import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";
import type { MetaverseRoomDirectoryOwner } from "../types/metaverse-room-directory-owner.js";
import { loadAuthoritativeMetaverseMapBundle } from "../world/map-bundles/load-authoritative-metaverse-map-bundle.js";
import { MetaverseRoomRuntime } from "./metaverse-room-runtime.js";

interface MetaverseRoomDirectoryConfig {
  readonly freeRoamCapacity?: number;
  readonly playerBindingTimeoutMs?: number;
  readonly runtimeConfig?: Partial<MetaverseAuthoritativeWorldRuntimeConfig>;
  readonly teamDeathmatchCapacity?: number;
}

interface BoundMetaversePlayerRoom {
  readonly boundAtMs: number;
  readonly lastActivityAtMs: number;
  readonly roomId: MetaverseRoomId;
}

interface ResolvedRoomLaunchSelection {
  readonly bundleId: string;
  readonly launchVariationId: string;
}

const defaultFreeRoamBundleId = "private-build" as const;
const defaultFreeRoamLaunchVariationId = "shell-free-roam" as const;
const defaultTeamDeathmatchBundleId = "private-build" as const;
const defaultTeamDeathmatchLaunchVariationId =
  "shell-team-deathmatch" as const;
const roomSessionBootSequence = Date.now();

function normalizeCapacity(rawValue: number | undefined, fallbackValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue === undefined || rawValue <= 0) {
    return fallbackValue;
  }

  return Math.max(1, Math.floor(rawValue));
}

function resolveSessionOrdinal(rawValue: number | undefined): number {
  if (!Number.isFinite(rawValue) || rawValue === undefined || rawValue < 0) {
    return 1;
  }

  return Math.floor(rawValue);
}

function createRoomSessionId(
  roomId: MetaverseRoomId,
  sessionOrdinal: number
): MetaverseRoomSessionId {
  const roomSessionId = createMetaverseRoomSessionId(
    `${roomId}-session-${roomSessionBootSequence}-${resolveSessionOrdinal(
      sessionOrdinal
    )}`
  );

  if (roomSessionId === null) {
    throw new Error(`Unable to create a metaverse room session id for ${roomId}.`);
  }

  return roomSessionId;
}

function createOpaqueFreeRoamRoomId(bundleId: string): MetaverseRoomId {
  const randomSuffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  const roomId = createMetaverseRoomId(`free-roam-${bundleId}-${randomSuffix}`);

  if (roomId === null) {
    throw new Error("Unable to create an opaque free-roam room id.");
  }

  return roomId;
}

function resolveDefaultRoomLaunchSelection(
  matchMode: MetaverseMatchModeId
): ResolvedRoomLaunchSelection {
  if (matchMode === "team-deathmatch") {
    return Object.freeze({
      bundleId: defaultTeamDeathmatchBundleId,
      launchVariationId: defaultTeamDeathmatchLaunchVariationId
    });
  }

  return Object.freeze({
    bundleId: defaultFreeRoamBundleId,
    launchVariationId: defaultFreeRoamLaunchVariationId
  });
}

function resolveRoomLaunchSelection(
  matchMode: MetaverseMatchModeId,
  bundleIdOverride: string | null,
  launchVariationIdOverride: string | null
): ResolvedRoomLaunchSelection {
  const defaultSelection = resolveDefaultRoomLaunchSelection(matchMode);
  const bundleId = bundleIdOverride ?? defaultSelection.bundleId;
  const loadedBundle = loadAuthoritativeMetaverseMapBundle(bundleId).bundle;
  const resolvedVariation =
    launchVariationIdOverride === null
      ? loadedBundle.launchVariations.find(
          (launchVariation) => launchVariation.matchMode === matchMode
        ) ??
        loadedBundle.launchVariations.find(
          (launchVariation) =>
            launchVariation.variationId === defaultSelection.launchVariationId
        ) ??
        null
      : loadedBundle.launchVariations.find(
          (launchVariation) =>
            launchVariation.variationId === launchVariationIdOverride
        ) ?? null;

  if (resolvedVariation === null) {
    throw new Error(
      `Authoritative metaverse bundle ${bundleId} does not expose a launch variation for ${matchMode}.`
    );
  }

  if (resolvedVariation.matchMode !== matchMode) {
    throw new Error(
      `Metaverse room launch variation ${resolvedVariation.variationId} does not support ${matchMode}.`
    );
  }

  return Object.freeze({
    bundleId,
    launchVariationId: resolvedVariation.variationId
  });
}

function resolveDirectoryEntryPriority(
  roomEntry: ReturnType<MetaverseRoomRuntime["readDirectoryEntry"]>
): number {
  if (roomEntry.matchMode === "team-deathmatch") {
    switch (roomEntry.phase) {
      case "active":
        return 0;
      case "waiting-for-players":
        return 1;
      case "completed":
        return 2;
      default:
        return 3;
    }
  }

  return roomEntry.status === "available" ? 4 : 5;
}

export class MetaverseRoomDirectory implements MetaverseRoomDirectoryOwner {
  readonly #bindingTimeoutMs: number;
  readonly #freeRoamCapacity: number;
  readonly #runtimeConfig: Partial<MetaverseAuthoritativeWorldRuntimeConfig>;
  readonly #teamDeathmatchCapacity: number;
  readonly #roomRuntimesById = new Map<MetaverseRoomId, MetaverseRoomRuntime>();
  readonly #roomSessionOrdinalsByRoomId = new Map<MetaverseRoomId, number>();
  readonly #playerBindingsByPlayerId = new Map<
    MetaversePlayerId,
    BoundMetaversePlayerRoom
  >();

  constructor(config: MetaverseRoomDirectoryConfig = {}) {
    this.#bindingTimeoutMs = normalizeCapacity(
      config.playerBindingTimeoutMs,
      10_000
    );
    this.#freeRoamCapacity = normalizeCapacity(config.freeRoamCapacity, 16);
    this.#runtimeConfig = {
      ...(config.runtimeConfig ?? {})
    };
    this.#teamDeathmatchCapacity = normalizeCapacity(
      config.teamDeathmatchCapacity,
      8
    );
  }

  get tickIntervalMs(): number {
    return Number(this.#runtimeConfig.tickIntervalMs ?? 50);
  }

  advanceToTime(nowMs: number): void {
    this.#pruneStaleBindings(nowMs);

    for (const roomRuntime of this.#roomRuntimesById.values()) {
      roomRuntime.advanceToTime(nowMs);
    }

    this.#pruneEmptyRooms(nowMs);
  }

  listRoomDirectorySnapshot(
    nowMs: number,
    matchMode?: MetaverseMatchModeId
  ): MetaverseRoomDirectorySnapshot {
    this.#pruneStaleBindings(nowMs);

    const roomEntries = [...this.#roomRuntimesById.values()]
      .filter((roomRuntime) =>
        matchMode === undefined ? true : roomRuntime.matchMode === matchMode
      )
      .map((roomRuntime) => {
        const connectedPlayerCount = this.#countRoomBindings(roomRuntime.roomId, nowMs);

        return roomRuntime.readDirectoryEntry(
          nowMs,
          connectedPlayerCount,
          this.#resolveRoomStatus(roomRuntime.capacity, connectedPlayerCount)
        );
      })
      .sort((leftRoom, rightRoom) => {
        const priorityDelta =
          resolveDirectoryEntryPriority(leftRoom) -
          resolveDirectoryEntryPriority(rightRoom);

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return leftRoom.roomId.localeCompare(rightRoom.roomId);
      });

    return createMetaverseRoomDirectorySnapshot({
      rooms: roomEntries
    });
  }

  quickJoinRoom(
    request: MetaverseQuickJoinRoomRequest,
    nowMs: number
  ): MetaverseRoomAssignmentSnapshot {
    this.#pruneStaleBindings(nowMs);

    if (request.matchMode !== "free-roam") {
      throw new Error(
        `Quick join only supports free-roam right now, received ${request.matchMode}.`
      );
    }

    const launchSelection = resolveRoomLaunchSelection(
      request.matchMode,
      request.bundleId,
      request.launchVariationId
    );
    const targetRoom =
      this.#findMostPopulatedAvailableRoom(
        request.matchMode,
        launchSelection.bundleId,
        launchSelection.launchVariationId,
        nowMs
      ) ??
      this.#createRoomRuntime(
        createOpaqueFreeRoamRoomId(launchSelection.bundleId),
        request.matchMode,
        launchSelection.bundleId,
        launchSelection.launchVariationId,
        null
      );

    return this.#bindPlayerToRoom(targetRoom.roomId, request.playerId, nowMs);
  }

  joinRoom(
    roomId: MetaverseRoomId,
    request: MetaverseJoinRoomRequest,
    nowMs: number
  ): MetaverseRoomAssignmentSnapshot {
    this.#pruneStaleBindings(nowMs);

    const existingRoom = this.#roomRuntimesById.get(roomId) ?? null;

    if (existingRoom !== null) {
      if (existingRoom.matchMode !== "team-deathmatch") {
        throw new Error(`Unknown metaverse room: ${roomId}`);
      }

      const connectedPlayerCount = this.#countRoomBindings(roomId, nowMs);

      if (connectedPlayerCount >= existingRoom.capacity) {
        throw new Error(`Metaverse room ${roomId} is full.`);
      }

      return this.#bindPlayerToRoom(roomId, request.playerId, nowMs);
    }

    const launchSelection = resolveRoomLaunchSelection(
      "team-deathmatch",
      request.bundleId,
      request.launchVariationId
    );
    const createdRoom = this.#createRoomRuntime(
      roomId,
      "team-deathmatch",
      launchSelection.bundleId,
      launchSelection.launchVariationId,
      request.playerId
    );

    return this.#bindPlayerToRoom(createdRoom.roomId, request.playerId, nowMs);
  }

  requestNextMatch(
    roomId: MetaverseRoomId,
    request: MetaverseNextMatchRequest,
    nowMs: number
  ): MetaverseRoomAssignmentSnapshot {
    this.#pruneStaleBindings(nowMs);
    this.#assertPlayerBoundToRoom(request.playerId, roomId, nowMs);

    const roomRuntime = this.#readRoomRuntime(roomId);

    if (roomRuntime.matchMode !== "team-deathmatch") {
      throw new Error(`Unknown metaverse room: ${roomId}`);
    }

    if (!roomRuntime.requestNextMatch(nowMs)) {
      throw new Error(`Metaverse room ${roomId} is not ready for the next match.`);
    }

    this.#refreshRoomLeader(roomId, nowMs);

    return roomRuntime.readAssignmentSnapshot(
      this.#countRoomBindings(roomId, nowMs)
    );
  }

  readPresenceRosterSnapshot(
    roomId: MetaverseRoomId,
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    if (observerPlayerId !== undefined) {
      this.#assertPlayerBoundToRoom(observerPlayerId, roomId, nowMs);
    }

    return this.#readRoomRuntime(roomId).readPresenceRosterSnapshot(
      nowMs,
      observerPlayerId
    );
  }

  readPresenceRosterEvent(
    roomId: MetaverseRoomId,
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    if (observerPlayerId !== undefined) {
      this.#assertPlayerBoundToRoom(observerPlayerId, roomId, nowMs);
    }

    return this.#readRoomRuntime(roomId).readPresenceRosterEvent(
      nowMs,
      observerPlayerId
    );
  }

  readWorldSnapshot(
    roomId: MetaverseRoomId,
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    if (observerPlayerId !== undefined) {
      this.#assertPlayerBoundToRoom(observerPlayerId, roomId, nowMs);
    }

    return this.#readRoomRuntime(roomId).readWorldSnapshot(nowMs, observerPlayerId);
  }

  readWorldEvent(
    roomId: MetaverseRoomId,
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    if (observerPlayerId !== undefined) {
      this.#assertPlayerBoundToRoom(observerPlayerId, roomId, nowMs);
    }

    return this.#readRoomRuntime(roomId).readWorldEvent(nowMs, observerPlayerId);
  }

  acceptPresenceCommand(
    roomId: MetaverseRoomId,
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    this.#assertPlayerBoundToRoom(command.playerId, roomId, nowMs);
    const roomRuntime = this.#readRoomRuntime(roomId);
    const rosterEvent = roomRuntime.acceptPresenceCommand(command, nowMs);

    if (command.type === "leave-presence") {
      this.#playerBindingsByPlayerId.delete(command.playerId);
      this.#refreshRoomLeader(roomId, nowMs);
      this.#pruneEmptyRooms(nowMs);
    }

    return rosterEvent;
  }

  acceptWorldCommand(
    roomId: MetaverseRoomId,
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    this.#assertPlayerBoundToRoom(command.playerId, roomId, nowMs);
    return this.#readRoomRuntime(roomId).acceptWorldCommand(command, nowMs);
  }

  acceptBoundWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): void {
    const binding = this.#playerBindingsByPlayerId.get(command.playerId) ?? null;

    if (binding === null) {
      throw new Error(
        `Metaverse player ${command.playerId} is not bound to any room.`
      );
    }

    this.#playerBindingsByPlayerId.set(command.playerId, {
      ...binding,
      lastActivityAtMs: nowMs
    });
    this.#readRoomRuntime(binding.roomId).acceptWorldCommand(command, nowMs);
  }

  #createRoomRuntime(
    roomId: MetaverseRoomId,
    matchMode: MetaverseMatchModeId,
    bundleId: string,
    launchVariationId: string,
    leaderPlayerId: MetaversePlayerId | null
  ): MetaverseRoomRuntime {
    const existingRoom = this.#roomRuntimesById.get(roomId);

    if (existingRoom !== undefined) {
      return existingRoom;
    }

    const nextSessionOrdinal =
      (this.#roomSessionOrdinalsByRoomId.get(roomId) ?? 0) + 1;
    const roomRuntime = new MetaverseRoomRuntime({
      bundleId,
      capacity:
        matchMode === "team-deathmatch"
          ? this.#teamDeathmatchCapacity
          : this.#freeRoamCapacity,
      launchVariationId,
      leaderPlayerId,
      matchMode,
      roomId,
      roomSessionId: createRoomSessionId(roomId, nextSessionOrdinal),
      runtimeConfig: this.#runtimeConfig
    });

    this.#roomSessionOrdinalsByRoomId.set(roomId, nextSessionOrdinal);
    this.#roomRuntimesById.set(roomId, roomRuntime);

    return roomRuntime;
  }

  #bindPlayerToRoom(
    roomId: MetaverseRoomId,
    playerId: MetaversePlayerId,
    nowMs: number
  ): MetaverseRoomAssignmentSnapshot {
    const roomRuntime = this.#readRoomRuntime(roomId);
    const existingBinding = this.#playerBindingsByPlayerId.get(playerId) ?? null;

    if (existingBinding !== null && existingBinding.roomId !== roomId) {
      const previousRoomId = existingBinding.roomId;
      const previousRoomRuntime = this.#roomRuntimesById.get(previousRoomId) ?? null;

      previousRoomRuntime?.forceRemovePlayer(playerId, nowMs);
      this.#playerBindingsByPlayerId.delete(playerId);
      this.#refreshRoomLeader(previousRoomId, nowMs);
    }

    this.#playerBindingsByPlayerId.set(playerId, {
      boundAtMs: existingBinding?.roomId === roomId
        ? existingBinding.boundAtMs
        : nowMs,
      lastActivityAtMs: nowMs,
      roomId
    });

    this.#refreshRoomLeader(roomId, nowMs);

    return roomRuntime.readAssignmentSnapshot(this.#countRoomBindings(roomId, nowMs));
  }

  #findMostPopulatedAvailableRoom(
    matchMode: MetaverseMatchModeId,
    bundleId: string,
    launchVariationId: string,
    nowMs: number
  ): MetaverseRoomRuntime | null {
    let selectedRoom: MetaverseRoomRuntime | null = null;
    let selectedRoomOccupancy = -1;

    for (const roomRuntime of this.#roomRuntimesById.values()) {
      if (
        roomRuntime.matchMode !== matchMode ||
        roomRuntime.bundleId !== bundleId ||
        roomRuntime.launchVariationId !== launchVariationId
      ) {
        continue;
      }

      const connectedPlayerCount = this.#countRoomBindings(roomRuntime.roomId, nowMs);

      if (connectedPlayerCount >= roomRuntime.capacity) {
        continue;
      }

      if (connectedPlayerCount > selectedRoomOccupancy) {
        selectedRoom = roomRuntime;
        selectedRoomOccupancy = connectedPlayerCount;
      }
    }

    return selectedRoom;
  }

  #countRoomBindings(roomId: MetaverseRoomId, nowMs: number): number {
    let bindingCount = 0;

    for (const binding of this.#playerBindingsByPlayerId.values()) {
      if (
        binding.roomId === roomId &&
        nowMs - binding.lastActivityAtMs <= this.#bindingTimeoutMs
      ) {
        bindingCount += 1;
      }
    }

    return bindingCount;
  }

  #resolveRoomStatus(
    capacity: number,
    connectedPlayerCount: number
  ): MetaverseRoomStatusId {
    return connectedPlayerCount >= capacity ? "full" : "available";
  }

  #assertPlayerBoundToRoom(
    playerId: MetaversePlayerId,
    roomId: MetaverseRoomId,
    nowMs: number
  ): void {
    const binding = this.#playerBindingsByPlayerId.get(playerId) ?? null;

    if (binding === null || binding.roomId !== roomId) {
      throw new Error(`Metaverse player ${playerId} is not bound to room ${roomId}.`);
    }

    this.#playerBindingsByPlayerId.set(playerId, {
      ...binding,
      lastActivityAtMs: nowMs
    });
  }

  #readRoomRuntime(roomId: MetaverseRoomId): MetaverseRoomRuntime {
    const roomRuntime = this.#roomRuntimesById.get(roomId) ?? null;

    if (roomRuntime === null) {
      throw new Error(`Unknown metaverse room: ${roomId}`);
    }

    return roomRuntime;
  }

  #refreshRoomLeader(roomId: MetaverseRoomId, nowMs: number): void {
    const roomRuntime = this.#roomRuntimesById.get(roomId) ?? null;

    if (roomRuntime === null || roomRuntime.matchMode !== "team-deathmatch") {
      return;
    }

    const currentLeader = roomRuntime.leaderPlayerId;

    if (
      currentLeader !== null &&
      this.#playerBindingsByPlayerId.get(currentLeader)?.roomId === roomId
    ) {
      return;
    }

    let nextLeaderPlayerId: MetaversePlayerId | null = null;
    let nextLeaderBoundAtMs = Number.POSITIVE_INFINITY;

    for (const [playerId, binding] of this.#playerBindingsByPlayerId.entries()) {
      if (
        binding.roomId !== roomId ||
        nowMs - binding.lastActivityAtMs > this.#bindingTimeoutMs
      ) {
        continue;
      }

      if (binding.boundAtMs < nextLeaderBoundAtMs) {
        nextLeaderPlayerId = playerId;
        nextLeaderBoundAtMs = binding.boundAtMs;
      }
    }

    roomRuntime.setLeaderPlayerId(nextLeaderPlayerId);
  }

  #pruneStaleBindings(nowMs: number): void {
    for (const [playerId, binding] of this.#playerBindingsByPlayerId.entries()) {
      if (nowMs - binding.lastActivityAtMs <= this.#bindingTimeoutMs) {
        continue;
      }

      const roomRuntime = this.#roomRuntimesById.get(binding.roomId) ?? null;
      roomRuntime?.forceRemovePlayer(playerId, nowMs);
      this.#playerBindingsByPlayerId.delete(playerId);
      this.#refreshRoomLeader(binding.roomId, nowMs);
    }
  }

  #pruneEmptyRooms(nowMs: number): void {
    for (const [roomId, roomRuntime] of this.#roomRuntimesById.entries()) {
      const connectedPlayerCount = this.#countRoomBindings(roomId, nowMs);

      if (connectedPlayerCount > 0) {
        continue;
      }

      if (roomRuntime.readWorldSnapshot(nowMs).players.length > 0) {
        continue;
      }

      this.#roomRuntimesById.delete(roomId);
    }
  }
}
