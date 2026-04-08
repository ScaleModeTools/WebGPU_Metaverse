import type { Username } from "./player-profile.js";
import type { TypeBrand } from "./type-branding.js";
import type { Milliseconds, Radians } from "./unit-measurements.js";
import {
  createMilliseconds,
  createRadians
} from "./unit-measurements.js";
export const gameplaySessionModes = [
  "single-player",
  "co-op"
] as const;
export const gameplayTickOwners = [
  "client",
  "server"
] as const;
export const coopRoomPhases = [
  "waiting-for-players",
  "active",
  "completed"
] as const;
export const coopBirdBehaviorStates = [
  "glide",
  "scatter",
  "downed"
] as const;
export const coopPlayerShotOutcomeStates = [
  "miss",
  "scatter",
  "hit"
] as const;
export const coopRoomClientCommandTypes = [
  "join-room",
  "set-player-ready",
  "start-session",
  "leave-room",
  "fire-shot",
  "sync-player-presence"
] as const;
export const coopRoomServerEventTypes = [
  "room-snapshot"
] as const;

export type GameplaySessionMode = (typeof gameplaySessionModes)[number];
export type GameplayTickOwner = (typeof gameplayTickOwners)[number];
export type CoopRoomPhase = (typeof coopRoomPhases)[number];
export type CoopBirdBehaviorState = (typeof coopBirdBehaviorStates)[number];
export type CoopPlayerShotOutcomeState =
  (typeof coopPlayerShotOutcomeStates)[number];
export type CoopRoomClientCommandType =
  (typeof coopRoomClientCommandTypes)[number];
export type CoopRoomServerEventType =
  (typeof coopRoomServerEventTypes)[number];

export type CoopRoomId = TypeBrand<string, "CoopRoomId">;
export type CoopSessionId = TypeBrand<string, "CoopSessionId">;
export type CoopPlayerId = TypeBrand<string, "CoopPlayerId">;
export type CoopBirdId = TypeBrand<string, "CoopBirdId">;

export interface CoopRoomTickSnapshot {
  readonly currentTick: number;
  readonly owner: "server";
  readonly tickIntervalMs: Milliseconds;
}

export interface CoopRoomTickSnapshotInput {
  readonly currentTick: number;
  readonly tickIntervalMs: number;
}

export interface CoopVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CoopVector3SnapshotInput {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CoopBirdSnapshot {
  readonly behavior: CoopBirdBehaviorState;
  readonly birdId: CoopBirdId;
  readonly headingRadians: Radians;
  readonly label: string;
  readonly lastInteractionByPlayerId: CoopPlayerId | null;
  readonly lastInteractionTick: number | null;
  readonly position: CoopVector3Snapshot;
  readonly radius: number;
  readonly scale: number;
  readonly visible: boolean;
  readonly wingPhase: number;
}

export interface CoopBirdSnapshotInput {
  readonly behavior: CoopBirdBehaviorState;
  readonly birdId: CoopBirdId;
  readonly headingRadians: number;
  readonly label: string;
  readonly lastInteractionByPlayerId?: CoopPlayerId | null;
  readonly lastInteractionTick?: number | null;
  readonly position: CoopVector3SnapshotInput;
  readonly radius: number;
  readonly scale: number;
  readonly visible: boolean;
  readonly wingPhase: number;
}

export interface CoopPlayerActivitySnapshot {
  readonly hitsLanded: number;
  readonly lastAcknowledgedShotSequence: number;
  readonly lastHitBirdId: CoopBirdId | null;
  readonly lastOutcome: CoopPlayerShotOutcomeState | null;
  readonly lastShotTick: number | null;
  readonly scatterEventsCaused: number;
  readonly shotsFired: number;
}

export interface CoopPlayerActivitySnapshotInput {
  readonly hitsLanded: number;
  readonly lastAcknowledgedShotSequence: number;
  readonly lastHitBirdId?: CoopBirdId | null;
  readonly lastOutcome?: CoopPlayerShotOutcomeState | null;
  readonly lastShotTick?: number | null;
  readonly scatterEventsCaused: number;
  readonly shotsFired: number;
}

export interface CoopPlayerSnapshot {
  readonly activity: CoopPlayerActivitySnapshot;
  readonly connected: boolean;
  readonly playerId: CoopPlayerId;
  readonly presence: CoopPlayerPresenceSnapshot;
  readonly ready: boolean;
  readonly username: Username;
}

export interface CoopPlayerSnapshotInput {
  readonly activity?: CoopPlayerActivitySnapshotInput;
  readonly connected?: boolean;
  readonly playerId: CoopPlayerId;
  readonly presence?: CoopPlayerPresenceSnapshotInput;
  readonly ready?: boolean;
  readonly username: Username;
}

export interface CoopPlayerPresenceSnapshot {
  readonly aimDirection: CoopVector3Snapshot;
  readonly lastUpdatedTick: number | null;
  readonly pitchRadians: Radians;
  readonly position: CoopVector3Snapshot;
  readonly stateSequence: number;
  readonly weaponId: string;
  readonly yawRadians: Radians;
}

export interface CoopPlayerPresenceSnapshotInput {
  readonly aimDirection: CoopVector3SnapshotInput;
  readonly lastUpdatedTick?: number | null;
  readonly pitchRadians: number;
  readonly position: CoopVector3SnapshotInput;
  readonly stateSequence?: number;
  readonly weaponId?: string;
  readonly yawRadians: number;
}

export interface CoopSessionSnapshot {
  readonly birdsCleared: number;
  readonly birdsRemaining: number;
  readonly leaderPlayerId: CoopPlayerId | null;
  readonly mode: "co-op";
  readonly phase: CoopRoomPhase;
  readonly requiredReadyPlayerCount: number;
  readonly sessionId: CoopSessionId;
  readonly teamHitsLanded: number;
  readonly teamShotsFired: number;
}

export interface CoopSessionSnapshotInput {
  readonly birdsCleared: number;
  readonly birdsRemaining: number;
  readonly leaderPlayerId?: CoopPlayerId | null;
  readonly phase: CoopRoomPhase;
  readonly requiredReadyPlayerCount: number;
  readonly sessionId: CoopSessionId;
  readonly teamHitsLanded: number;
  readonly teamShotsFired: number;
}

export interface CoopRoomSnapshot {
  readonly birds: readonly CoopBirdSnapshot[];
  readonly capacity: number;
  readonly players: readonly CoopPlayerSnapshot[];
  readonly roomId: CoopRoomId;
  readonly session: CoopSessionSnapshot;
  readonly tick: CoopRoomTickSnapshot;
}

export interface CoopRoomSnapshotInput {
  readonly birds: readonly CoopBirdSnapshotInput[];
  readonly capacity: number;
  readonly players: readonly CoopPlayerSnapshotInput[];
  readonly roomId: CoopRoomId;
  readonly session: CoopSessionSnapshotInput;
  readonly tick: CoopRoomTickSnapshotInput;
}

export interface CoopRoomDirectoryEntrySnapshot {
  readonly birdsRemaining: number;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly phase: CoopRoomPhase;
  readonly readyPlayerCount: number;
  readonly requiredReadyPlayerCount: number;
  readonly roomId: CoopRoomId;
  readonly sessionId: CoopSessionId;
  readonly tick: number;
}

export interface CoopRoomDirectoryEntrySnapshotInput {
  readonly birdsRemaining: number;
  readonly capacity: number;
  readonly connectedPlayerCount: number;
  readonly phase: CoopRoomPhase;
  readonly readyPlayerCount: number;
  readonly requiredReadyPlayerCount: number;
  readonly roomId: CoopRoomId;
  readonly sessionId: CoopSessionId;
  readonly tick: number;
}

export interface CoopRoomDirectorySnapshot {
  readonly coOpRooms: readonly CoopRoomDirectoryEntrySnapshot[];
  readonly rendererTarget: "webgpu";
  readonly service: "thumbshooter-server";
  readonly status: "co-op-contract-slice-ready";
}

export interface CoopRoomDirectorySnapshotInput {
  readonly coOpRooms: readonly CoopRoomDirectoryEntrySnapshotInput[];
  readonly rendererTarget?: "webgpu";
  readonly service?: "thumbshooter-server";
  readonly status?: "co-op-contract-slice-ready";
}

export interface CoopJoinRoomCommand {
  readonly playerId: CoopPlayerId;
  readonly ready: boolean;
  readonly roomId: CoopRoomId;
  readonly type: "join-room";
  readonly username: Username;
}

export interface CoopJoinRoomCommandInput {
  readonly playerId: CoopPlayerId;
  readonly ready?: boolean;
  readonly roomId: CoopRoomId;
  readonly username: Username;
}

export interface CoopSetPlayerReadyCommand {
  readonly playerId: CoopPlayerId;
  readonly ready: boolean;
  readonly roomId: CoopRoomId;
  readonly type: "set-player-ready";
}

export interface CoopSetPlayerReadyCommandInput {
  readonly playerId: CoopPlayerId;
  readonly ready: boolean;
  readonly roomId: CoopRoomId;
}

export interface CoopStartSessionCommand {
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
  readonly type: "start-session";
}

export interface CoopStartSessionCommandInput {
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
}

export interface CoopLeaveRoomCommand {
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
  readonly type: "leave-room";
}

export interface CoopLeaveRoomCommandInput {
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
}

export interface CoopFireShotCommand {
  readonly aimDirection: CoopVector3Snapshot;
  readonly clientShotSequence: number;
  readonly origin: CoopVector3Snapshot;
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
  readonly type: "fire-shot";
}

export interface CoopFireShotCommandInput {
  readonly aimDirection: CoopVector3SnapshotInput;
  readonly clientShotSequence: number;
  readonly origin: CoopVector3SnapshotInput;
  readonly playerId: CoopPlayerId;
  readonly roomId: CoopRoomId;
}

export interface CoopSyncPlayerPresenceCommand {
  readonly aimDirection: CoopVector3Snapshot;
  readonly pitchRadians: Radians;
  readonly playerId: CoopPlayerId;
  readonly position: CoopVector3Snapshot;
  readonly roomId: CoopRoomId;
  readonly stateSequence: number;
  readonly type: "sync-player-presence";
  readonly weaponId: string;
  readonly yawRadians: Radians;
}

export interface CoopSyncPlayerPresenceCommandInput {
  readonly aimDirection: CoopVector3SnapshotInput;
  readonly pitchRadians: number;
  readonly playerId: CoopPlayerId;
  readonly position: CoopVector3SnapshotInput;
  readonly roomId: CoopRoomId;
  readonly stateSequence: number;
  readonly weaponId: string;
  readonly yawRadians: number;
}

export type CoopRoomClientCommand =
  | CoopJoinRoomCommand
  | CoopSetPlayerReadyCommand
  | CoopStartSessionCommand
  | CoopLeaveRoomCommand
  | CoopFireShotCommand
  | CoopSyncPlayerPresenceCommand;

export interface CoopRoomSnapshotEvent {
  readonly room: CoopRoomSnapshot;
  readonly type: "room-snapshot";
}

export type CoopRoomServerEvent = CoopRoomSnapshotEvent;

function normalizeTrimmedString(rawValue: string): string {
  return rawValue.trim();
}

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(rawValue));
}

function normalizeFiniteNonNegativeNumber(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, rawValue);
}

function normalizeFiniteNumber(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return rawValue;
}

function normalizeWeaponId(rawValue: string | undefined): string {
  if (typeof rawValue !== "string") {
    return "semiautomatic-pistol";
  }

  const normalizedValue = rawValue.trim();

  return normalizedValue.length > 0 ? normalizedValue : "semiautomatic-pistol";
}

function normalizeLastTick(rawValue: number | null | undefined): number | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  return normalizeFiniteNonNegativeInteger(rawValue);
}

function freezePlayerActivitySnapshot(
  input: CoopPlayerActivitySnapshotInput
): CoopPlayerActivitySnapshot {
  return Object.freeze({
    hitsLanded: normalizeFiniteNonNegativeInteger(input.hitsLanded),
    lastAcknowledgedShotSequence: normalizeFiniteNonNegativeInteger(
      input.lastAcknowledgedShotSequence
    ),
    lastHitBirdId: input.lastHitBirdId ?? null,
    lastOutcome: input.lastOutcome ?? null,
    lastShotTick: normalizeLastTick(input.lastShotTick),
    scatterEventsCaused: normalizeFiniteNonNegativeInteger(
      input.scatterEventsCaused
    ),
    shotsFired: normalizeFiniteNonNegativeInteger(input.shotsFired)
  });
}

function createDefaultPlayerActivitySnapshot(): CoopPlayerActivitySnapshot {
  return freezePlayerActivitySnapshot({
    hitsLanded: 0,
    lastAcknowledgedShotSequence: 0,
    scatterEventsCaused: 0,
    shotsFired: 0
  });
}

function createDefaultPlayerPresenceSnapshot(): CoopPlayerPresenceSnapshot {
  return Object.freeze({
    aimDirection: Object.freeze({
      x: 0,
      y: 0,
      z: -1
    }),
    lastUpdatedTick: null,
    pitchRadians: createRadians(0),
    position: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    stateSequence: 0,
    weaponId: "semiautomatic-pistol",
    yawRadians: createRadians(0)
  });
}

export function createCoopVector3Snapshot(
  input: CoopVector3SnapshotInput
): CoopVector3Snapshot {
  return Object.freeze({
    x: normalizeFiniteNumber(input.x),
    y: normalizeFiniteNumber(input.y),
    z: normalizeFiniteNumber(input.z)
  });
}

function createNormalizedDirectionSnapshot(
  input: CoopVector3SnapshotInput
): CoopVector3Snapshot {
  const x = normalizeFiniteNumber(input.x);
  const y = normalizeFiniteNumber(input.y);
  const z = normalizeFiniteNumber(input.z);
  const magnitude = Math.hypot(x, y, z);

  if (magnitude <= 0.0001) {
    return Object.freeze({
      x: 0,
      y: 0,
      z: -1
    });
  }

  return Object.freeze({
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude
  });
}

export function createCoopRoomId(rawValue: string): CoopRoomId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as CoopRoomId;
}

export function createCoopSessionId(rawValue: string): CoopSessionId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as CoopSessionId;
}

export function createCoopPlayerId(rawValue: string): CoopPlayerId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as CoopPlayerId;
}

export function createCoopBirdId(rawValue: string): CoopBirdId | null {
  const normalizedValue = normalizeTrimmedString(rawValue);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue as CoopBirdId;
}

export function createCoopRoomTickSnapshot(
  input: CoopRoomTickSnapshotInput
): CoopRoomTickSnapshot {
  return Object.freeze({
    currentTick: normalizeFiniteNonNegativeInteger(input.currentTick),
    owner: "server",
    tickIntervalMs: createMilliseconds(input.tickIntervalMs)
  });
}

export function createCoopBirdSnapshot(
  input: CoopBirdSnapshotInput
): CoopBirdSnapshot {
  return Object.freeze({
    behavior: input.behavior,
    birdId: input.birdId,
    headingRadians: createRadians(input.headingRadians),
    label: input.label,
    lastInteractionByPlayerId: input.lastInteractionByPlayerId ?? null,
    lastInteractionTick: normalizeLastTick(input.lastInteractionTick),
    position: createCoopVector3Snapshot(input.position),
    radius: normalizeFiniteNonNegativeNumber(input.radius),
    scale: normalizeFiniteNonNegativeNumber(input.scale),
    visible: input.visible,
    wingPhase: Number.isFinite(input.wingPhase) ? input.wingPhase : 0
  });
}

export function createCoopPlayerActivitySnapshot(
  input: CoopPlayerActivitySnapshotInput
): CoopPlayerActivitySnapshot {
  return freezePlayerActivitySnapshot(input);
}

export function createCoopPlayerPresenceSnapshot(
  input: CoopPlayerPresenceSnapshotInput,
  lastUpdatedTick: number | null = input.lastUpdatedTick ?? null
): CoopPlayerPresenceSnapshot {
  return Object.freeze({
    aimDirection: createNormalizedDirectionSnapshot(input.aimDirection),
    lastUpdatedTick: normalizeLastTick(lastUpdatedTick),
    pitchRadians: createRadians(input.pitchRadians),
    position: createCoopVector3Snapshot(input.position),
    stateSequence: normalizeFiniteNonNegativeInteger(input.stateSequence ?? 0),
    weaponId: normalizeWeaponId(input.weaponId),
    yawRadians: createRadians(input.yawRadians)
  });
}

export function createCoopPlayerSnapshot(
  input: CoopPlayerSnapshotInput
): CoopPlayerSnapshot {
  return Object.freeze({
    activity:
      input.activity === undefined
        ? createDefaultPlayerActivitySnapshot()
        : createCoopPlayerActivitySnapshot(input.activity),
    connected: input.connected ?? true,
    playerId: input.playerId,
    presence:
      input.presence === undefined
        ? createDefaultPlayerPresenceSnapshot()
        : createCoopPlayerPresenceSnapshot(input.presence),
    ready: input.ready ?? false,
    username: input.username
  });
}

export function createCoopSessionSnapshot(
  input: CoopSessionSnapshotInput
): CoopSessionSnapshot {
  return Object.freeze({
    birdsCleared: normalizeFiniteNonNegativeInteger(input.birdsCleared),
    birdsRemaining: normalizeFiniteNonNegativeInteger(input.birdsRemaining),
    leaderPlayerId: input.leaderPlayerId ?? null,
    mode: "co-op",
    phase: input.phase,
    requiredReadyPlayerCount: Math.max(
      1,
      normalizeFiniteNonNegativeInteger(input.requiredReadyPlayerCount)
    ),
    sessionId: input.sessionId,
    teamHitsLanded: normalizeFiniteNonNegativeInteger(input.teamHitsLanded),
    teamShotsFired: normalizeFiniteNonNegativeInteger(input.teamShotsFired)
  });
}

export function createCoopRoomSnapshot(
  input: CoopRoomSnapshotInput
): CoopRoomSnapshot {
  return Object.freeze({
    birds: Object.freeze(input.birds.map((bird) => createCoopBirdSnapshot(bird))),
    capacity: Math.max(1, normalizeFiniteNonNegativeInteger(input.capacity)),
    players: Object.freeze(
      input.players.map((player) => createCoopPlayerSnapshot(player))
    ),
    roomId: input.roomId,
    session: createCoopSessionSnapshot(input.session),
    tick: createCoopRoomTickSnapshot(input.tick)
  });
}

export function createCoopRoomDirectoryEntrySnapshot(
  input: CoopRoomDirectoryEntrySnapshotInput
): CoopRoomDirectoryEntrySnapshot {
  return Object.freeze({
    birdsRemaining: normalizeFiniteNonNegativeInteger(input.birdsRemaining),
    capacity: Math.max(1, normalizeFiniteNonNegativeInteger(input.capacity)),
    connectedPlayerCount: normalizeFiniteNonNegativeInteger(
      input.connectedPlayerCount
    ),
    phase: input.phase,
    readyPlayerCount: normalizeFiniteNonNegativeInteger(input.readyPlayerCount),
    requiredReadyPlayerCount: Math.max(
      1,
      normalizeFiniteNonNegativeInteger(input.requiredReadyPlayerCount)
    ),
    roomId: input.roomId,
    sessionId: input.sessionId,
    tick: normalizeFiniteNonNegativeInteger(input.tick)
  });
}

export function createCoopRoomDirectorySnapshot(
  input: CoopRoomDirectorySnapshotInput
): CoopRoomDirectorySnapshot {
  return Object.freeze({
    coOpRooms: Object.freeze(
      input.coOpRooms.map((room) => createCoopRoomDirectoryEntrySnapshot(room))
    ),
    rendererTarget: input.rendererTarget ?? "webgpu",
    service: input.service ?? "thumbshooter-server",
    status: input.status ?? "co-op-contract-slice-ready"
  });
}

export function createCoopJoinRoomCommand(
  input: CoopJoinRoomCommandInput
): CoopJoinRoomCommand {
  return Object.freeze({
    playerId: input.playerId,
    ready: input.ready ?? false,
    roomId: input.roomId,
    type: "join-room",
    username: input.username
  });
}

export function createCoopSetPlayerReadyCommand(
  input: CoopSetPlayerReadyCommandInput
): CoopSetPlayerReadyCommand {
  return Object.freeze({
    playerId: input.playerId,
    ready: input.ready,
    roomId: input.roomId,
    type: "set-player-ready"
  });
}

export function createCoopStartSessionCommand(
  input: CoopStartSessionCommandInput
): CoopStartSessionCommand {
  return Object.freeze({
    playerId: input.playerId,
    roomId: input.roomId,
    type: "start-session"
  });
}

export function createCoopLeaveRoomCommand(
  input: CoopLeaveRoomCommandInput
): CoopLeaveRoomCommand {
  return Object.freeze({
    playerId: input.playerId,
    roomId: input.roomId,
    type: "leave-room"
  });
}

export function createCoopFireShotCommand(
  input: CoopFireShotCommandInput
): CoopFireShotCommand {
  return Object.freeze({
    aimDirection: createNormalizedDirectionSnapshot(input.aimDirection),
    clientShotSequence: normalizeFiniteNonNegativeInteger(
      input.clientShotSequence
    ),
    origin: createCoopVector3Snapshot(input.origin),
    playerId: input.playerId,
    roomId: input.roomId,
    type: "fire-shot"
  });
}

export function createCoopSyncPlayerPresenceCommand(
  input: CoopSyncPlayerPresenceCommandInput
): CoopSyncPlayerPresenceCommand {
  return Object.freeze({
    aimDirection: createNormalizedDirectionSnapshot(input.aimDirection),
    pitchRadians: createRadians(input.pitchRadians),
    playerId: input.playerId,
    position: createCoopVector3Snapshot(input.position),
    roomId: input.roomId,
    stateSequence: normalizeFiniteNonNegativeInteger(input.stateSequence),
    type: "sync-player-presence",
    weaponId: normalizeWeaponId(input.weaponId),
    yawRadians: createRadians(input.yawRadians)
  });
}

export function createCoopRoomSnapshotEvent(
  room: CoopRoomSnapshotInput | CoopRoomSnapshot
): CoopRoomSnapshotEvent {
  return Object.freeze({
    room: createCoopRoomSnapshot(room),
    type: "room-snapshot"
  });
}
