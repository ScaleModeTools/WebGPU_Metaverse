import type { Milliseconds } from "../unit-measurements.js";
import { createMilliseconds } from "../unit-measurements.js";
import type { TypeBrand } from "../type-branding.js";
import type { MetaverseCombatMatchPhaseId } from "./metaverse-combat.js";
import type { MetaverseMatchModeId } from "./metaverse-match-mode.js";
import type { MetaversePlayerId } from "./metaverse-presence-contract.js";

export const metaverseRoomStatusIds = [
  "available",
  "full"
] as const;

export type MetaverseRoomStatusId = (typeof metaverseRoomStatusIds)[number];

export type MetaverseRoomId = TypeBrand<string, "MetaverseRoomId">;
export type MetaverseRoomSessionId = TypeBrand<string, "MetaverseRoomSessionId">;

export interface MetaverseRoomAssignmentSnapshot {
  readonly bundleId: string;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly launchVariationId: string;
  readonly leaderPlayerId: MetaversePlayerId | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly roomId: MetaverseRoomId;
  readonly roomSessionId: MetaverseRoomSessionId;
}

export interface MetaverseRoomAssignmentSnapshotInput {
  readonly bundleId: string;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly launchVariationId: string;
  readonly leaderPlayerId?: MetaversePlayerId | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly roomId: MetaverseRoomId;
  readonly roomSessionId: MetaverseRoomSessionId;
}

export interface MetaverseRoomDirectoryEntrySnapshot {
  readonly blueTeamPlayerCount: number;
  readonly blueTeamScore: number;
  readonly bundleId: string;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly launchVariationId: string;
  readonly leaderPlayerId: MetaversePlayerId | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly phase: MetaverseCombatMatchPhaseId | null;
  readonly redTeamPlayerCount: number;
  readonly redTeamScore: number;
  readonly roomId: MetaverseRoomId;
  readonly roomSessionId: MetaverseRoomSessionId;
  readonly scoreLimit: number | null;
  readonly status: MetaverseRoomStatusId;
  readonly timeRemainingMs: Milliseconds | null;
}

export interface MetaverseRoomDirectoryEntrySnapshotInput {
  readonly blueTeamPlayerCount?: number;
  readonly blueTeamScore?: number;
  readonly bundleId: string;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly launchVariationId: string;
  readonly leaderPlayerId?: MetaversePlayerId | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly phase?: MetaverseCombatMatchPhaseId | null;
  readonly redTeamPlayerCount?: number;
  readonly redTeamScore?: number;
  readonly roomId: MetaverseRoomId;
  readonly roomSessionId: MetaverseRoomSessionId;
  readonly scoreLimit?: number | null;
  readonly status?: MetaverseRoomStatusId;
  readonly timeRemainingMs?: number | null;
}

export interface MetaverseRoomDirectorySnapshot {
  readonly rooms: readonly MetaverseRoomDirectoryEntrySnapshot[];
  readonly service: "webgpu-metaverse-server";
  readonly status: "metaverse-room-routing-ready";
}

export interface MetaverseRoomDirectorySnapshotInput {
  readonly rooms: readonly MetaverseRoomDirectoryEntrySnapshotInput[];
  readonly service?: "webgpu-metaverse-server";
  readonly status?: "metaverse-room-routing-ready";
}

export interface MetaverseQuickJoinRoomRequest {
  readonly bundleId: string | null;
  readonly launchVariationId: string | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseQuickJoinRoomRequestInput {
  readonly bundleId?: string | null;
  readonly launchVariationId?: string | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseJoinRoomRequest {
  readonly bundleId: string | null;
  readonly launchVariationId: string | null;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseJoinRoomRequestInput {
  readonly bundleId?: string | null;
  readonly launchVariationId?: string | null;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseNextMatchRequest {
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseNextMatchRequestInput {
  readonly playerId: MetaversePlayerId;
}

function normalizeTrimmedString(rawValue: string): string {
  return rawValue.trim();
}

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(rawValue));
}

function normalizeRequiredIdentifier(rawValue: string, label: string): string {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

function normalizeOptionalIdentifier(rawValue: string | null | undefined): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalizedValue = normalizeTrimmedString(rawValue);

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizeRoomStatus(rawValue: MetaverseRoomStatusId | undefined): MetaverseRoomStatusId {
  return rawValue ?? "available";
}

function normalizeService(
  rawValue: MetaverseRoomDirectorySnapshotInput["service"]
): MetaverseRoomDirectorySnapshot["service"] {
  return rawValue ?? "webgpu-metaverse-server";
}

function normalizeTimeRemainingMs(rawValue: number | null | undefined): Milliseconds | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  return createMilliseconds(normalizeFiniteNonNegativeInteger(rawValue));
}

export function createMetaverseRoomId(rawValue: string): MetaverseRoomId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as MetaverseRoomId;
}

export function createMetaverseRoomSessionId(
  rawValue: string
): MetaverseRoomSessionId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as MetaverseRoomSessionId;
}

export function createMetaverseRoomAssignmentSnapshot(
  input: MetaverseRoomAssignmentSnapshotInput
): MetaverseRoomAssignmentSnapshot {
  return Object.freeze({
    bundleId: normalizeRequiredIdentifier(input.bundleId, "bundleId"),
    capacity: normalizeFiniteNonNegativeInteger(input.capacity),
    connectedPlayerCount: normalizeFiniteNonNegativeInteger(
      input.connectedPlayerCount
    ),
    launchVariationId: normalizeRequiredIdentifier(
      input.launchVariationId,
      "launchVariationId"
    ),
    leaderPlayerId: input.leaderPlayerId ?? null,
    matchMode: input.matchMode,
    roomId: input.roomId,
    roomSessionId: input.roomSessionId
  });
}

export function createMetaverseRoomDirectoryEntrySnapshot(
  input: MetaverseRoomDirectoryEntrySnapshotInput
): MetaverseRoomDirectoryEntrySnapshot {
  const capacity = normalizeFiniteNonNegativeInteger(input.capacity);
  const connectedPlayerCount = normalizeFiniteNonNegativeInteger(
    input.connectedPlayerCount
  );

  return Object.freeze({
    blueTeamPlayerCount: normalizeFiniteNonNegativeInteger(
      input.blueTeamPlayerCount ?? 0
    ),
    blueTeamScore: normalizeFiniteNonNegativeInteger(input.blueTeamScore ?? 0),
    bundleId: normalizeRequiredIdentifier(input.bundleId, "bundleId"),
    capacity,
    connectedPlayerCount,
    launchVariationId: normalizeRequiredIdentifier(
      input.launchVariationId,
      "launchVariationId"
    ),
    leaderPlayerId: input.leaderPlayerId ?? null,
    matchMode: input.matchMode,
    phase: input.phase ?? null,
    redTeamPlayerCount: normalizeFiniteNonNegativeInteger(
      input.redTeamPlayerCount ?? 0
    ),
    redTeamScore: normalizeFiniteNonNegativeInteger(input.redTeamScore ?? 0),
    roomId: input.roomId,
    roomSessionId: input.roomSessionId,
    scoreLimit:
      input.scoreLimit === null || input.scoreLimit === undefined
        ? null
        : normalizeFiniteNonNegativeInteger(input.scoreLimit),
    status:
      normalizeRoomStatus(input.status) === "available" &&
      capacity > 0 &&
      connectedPlayerCount >= capacity
        ? "full"
        : normalizeRoomStatus(input.status),
    timeRemainingMs: normalizeTimeRemainingMs(input.timeRemainingMs)
  });
}

export function createMetaverseRoomDirectorySnapshot(
  input: MetaverseRoomDirectorySnapshotInput
): MetaverseRoomDirectorySnapshot {
  return Object.freeze({
    rooms: Object.freeze(
      input.rooms.map((room) => createMetaverseRoomDirectoryEntrySnapshot(room))
    ),
    service: normalizeService(input.service),
    status: input.status ?? "metaverse-room-routing-ready"
  });
}

export function createMetaverseQuickJoinRoomRequest(
  input: MetaverseQuickJoinRoomRequestInput
): MetaverseQuickJoinRoomRequest {
  return Object.freeze({
    bundleId: normalizeOptionalIdentifier(input.bundleId),
    launchVariationId: normalizeOptionalIdentifier(input.launchVariationId),
    matchMode: input.matchMode,
    playerId: input.playerId
  });
}

export function createMetaverseJoinRoomRequest(
  input: MetaverseJoinRoomRequestInput
): MetaverseJoinRoomRequest {
  return Object.freeze({
    bundleId: normalizeOptionalIdentifier(input.bundleId),
    launchVariationId: normalizeOptionalIdentifier(input.launchVariationId),
    playerId: input.playerId
  });
}

export function createMetaverseNextMatchRequest(
  input: MetaverseNextMatchRequestInput
): MetaverseNextMatchRequest {
  return Object.freeze({
    playerId: input.playerId
  });
}
