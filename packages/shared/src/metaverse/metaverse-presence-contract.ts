import type { Username } from "../player-profile.js";
import type { TypeBrand } from "../type-branding.js";
import type { Milliseconds, Radians } from "../unit-measurements.js";
import type { MetaversePlayerTeamId } from "./metaverse-player-team.js";
import {
  createMilliseconds,
  createRadians
} from "../unit-measurements.js";
import { createMetaversePlayerTeamId } from "./metaverse-player-team.js";

export const metaversePresenceAnimationVocabularyIds = [
  "idle",
  "walk",
  "swim-idle",
  "swim",
  "jump-up",
  "jump-mid",
  "jump-down",
  "aim",
  "interact",
  "seated"
] as const;

export const metaversePresencePrimaryLocomotionModeIds = [
  "grounded",
  "swim"
] as const;

export const metaversePresenceCompatibilityLocomotionModeIds = [
  ...metaversePresencePrimaryLocomotionModeIds,
  "mounted"
] as const;

export const metaversePresenceLocomotionModeIds =
  metaversePresenceCompatibilityLocomotionModeIds;

export const metaversePresenceMountedOccupancyKinds = [
  "entry",
  "seat"
] as const;

export const metaversePresenceMountedOccupantRoleIds = [
  "driver",
  "passenger",
  "turret"
] as const;

export const metaversePresenceCommandTypes = [
  "join-presence",
  "leave-presence",
  "sync-presence"
] as const;

export const metaversePresenceServerEventTypes = [
  "presence-roster"
] as const;

export type MetaversePresenceAnimationVocabularyId =
  (typeof metaversePresenceAnimationVocabularyIds)[number];
export type MetaversePresencePrimaryLocomotionModeId =
  (typeof metaversePresencePrimaryLocomotionModeIds)[number];
export type MetaversePresenceCompatibilityLocomotionModeId =
  (typeof metaversePresenceCompatibilityLocomotionModeIds)[number];
export type MetaversePresenceLocomotionModeId =
  MetaversePresenceCompatibilityLocomotionModeId;
export type MetaversePresenceMountedOccupancyKind =
  (typeof metaversePresenceMountedOccupancyKinds)[number];
export type MetaversePresenceMountedOccupantRoleId =
  (typeof metaversePresenceMountedOccupantRoleIds)[number];
export type MetaversePresenceCommandType =
  (typeof metaversePresenceCommandTypes)[number];
export type MetaversePresenceServerEventType =
  (typeof metaversePresenceServerEventTypes)[number];

export type MetaversePlayerId = TypeBrand<string, "MetaversePlayerId">;

export interface MetaversePresenceVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaversePresenceVector3SnapshotInput {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaversePresenceMountedOccupancySnapshot {
  readonly environmentAssetId: string;
  readonly entryId: string | null;
  readonly occupancyKind: MetaversePresenceMountedOccupancyKind;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
}

export interface MetaversePresenceMountedOccupancySnapshotInput {
  readonly environmentAssetId: string;
  readonly entryId: string | null;
  readonly occupancyKind: MetaversePresenceMountedOccupancyKind;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
}

export interface MetaversePresenceLookSnapshot {
  readonly pitchRadians: Radians;
  readonly yawRadians: Radians;
}

export interface MetaversePresenceLookSnapshotInput {
  readonly pitchRadians?: number;
  readonly yawRadians?: number;
}

export interface MetaversePresencePoseSnapshot {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly look: MetaversePresenceLookSnapshot;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null;
  readonly position: MetaversePresenceVector3Snapshot;
  readonly stateSequence: number;
  readonly yawRadians: Radians;
}

export interface MetaversePresencePoseSnapshotInput {
  readonly animationVocabulary?: MetaversePresenceAnimationVocabularyId;
  readonly look?: MetaversePresenceLookSnapshotInput;
  readonly locomotionMode?: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy?: MetaversePresenceMountedOccupancySnapshotInput | null;
  readonly position: MetaversePresenceVector3SnapshotInput;
  readonly stateSequence?: number;
  readonly yawRadians: number;
}

export interface MetaversePresencePlayerSnapshot {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshot;
  readonly teamId: MetaversePlayerTeamId;
  readonly username: Username;
}

export interface MetaversePresencePlayerSnapshotInput {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshotInput;
  readonly teamId?: MetaversePlayerTeamId;
  readonly username: Username;
}

export interface MetaversePresenceRosterSnapshot {
  readonly players: readonly MetaversePresencePlayerSnapshot[];
  readonly snapshotSequence: number;
  readonly tickIntervalMs: Milliseconds;
}

export interface MetaversePresenceRosterSnapshotInput {
  readonly players: readonly MetaversePresencePlayerSnapshotInput[];
  readonly snapshotSequence?: number;
  readonly tickIntervalMs?: number;
}

export interface MetaversePresenceRosterEvent {
  readonly roster: MetaversePresenceRosterSnapshot;
  readonly type: "presence-roster";
}

export interface MetaverseJoinPresenceCommand {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshot;
  readonly type: "join-presence";
  readonly username: Username;
}

export interface MetaverseJoinPresenceCommandInput {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshotInput;
  readonly username: Username;
}

export interface MetaverseLeavePresenceCommand {
  readonly playerId: MetaversePlayerId;
  readonly type: "leave-presence";
}

export interface MetaverseLeavePresenceCommandInput {
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseSyncPresenceCommand {
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshot;
  readonly type: "sync-presence";
}

export interface MetaverseSyncPresenceCommandInput {
  readonly playerId: MetaversePlayerId;
  readonly pose: MetaversePresencePoseSnapshotInput;
}

export type MetaversePresenceCommand =
  | MetaverseJoinPresenceCommand
  | MetaverseLeavePresenceCommand
  | MetaverseSyncPresenceCommand;

export type MetaversePresenceServerEvent = MetaversePresenceRosterEvent;

export function isMetaversePresencePrimaryLocomotionMode(
  locomotionMode: MetaversePresenceLocomotionModeId
): locomotionMode is MetaversePresencePrimaryLocomotionModeId {
  return locomotionMode !== "mounted";
}

export function isMetaversePresenceMountedCompatibilityLocomotionMode(
  locomotionMode: MetaversePresenceLocomotionModeId
): locomotionMode is "mounted" {
  return locomotionMode === "mounted";
}

export function shouldKeepMetaverseMountedOccupancyFreeRoam(
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "occupancyKind" | "occupantRole"
      >
    | null
    | undefined
): boolean {
  return (
    mountedOccupancy !== null &&
    mountedOccupancy !== undefined &&
    mountedOccupancy.occupancyKind === "entry" &&
    mountedOccupancy.occupantRole !== "driver"
  );
}

export function shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "occupancyKind" | "occupantRole"
      >
    | null
    | undefined
): boolean {
  return (
    mountedOccupancy !== null &&
    mountedOccupancy !== undefined &&
    !shouldKeepMetaverseMountedOccupancyFreeRoam(mountedOccupancy)
  );
}

export function shouldTreatMetaversePlayerPoseAsTraversalBlocker(
  locomotionMode: MetaversePresenceLocomotionModeId,
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "occupancyKind" | "occupantRole"
      >
    | null
    | undefined
): boolean {
  return (
    locomotionMode !== "swim" &&
    (mountedOccupancy === null ||
      mountedOccupancy === undefined ||
      shouldKeepMetaverseMountedOccupancyFreeRoam(mountedOccupancy))
  );
}

const metaversePlayerIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function normalizeFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeSequence(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function normalizeCharacterId(characterId: string): string {
  const normalizedCharacterId = normalizeRequiredIdentifier(
    characterId,
    "Metaverse presence characterId"
  );

  return normalizedCharacterId;
}

function normalizeRequiredIdentifier(rawValue: string, label: string): string {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

function normalizeOptionalIdentifier(
  rawValue: string | null,
  label: string
): string | null {
  if (rawValue === null) {
    return null;
  }

  return normalizeRequiredIdentifier(rawValue, label);
}

function resolveRequiredMetaversePlayerTeamId(
  rawValue: string | null | undefined,
  label: string
): MetaversePlayerTeamId {
  const resolvedTeamId = createMetaversePlayerTeamId(rawValue);

  if (resolvedTeamId === null) {
    throw new Error(`${label} must be a supported metaverse team id.`);
  }

  return resolvedTeamId;
}

function resolveAnimationVocabulary(
  rawValue: MetaversePresencePoseSnapshotInput["animationVocabulary"]
): MetaversePresenceAnimationVocabularyId {
  if (
    rawValue !== undefined &&
    metaversePresenceAnimationVocabularyIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "idle";
}

function resolveLocomotionMode(
  rawValue: MetaversePresencePoseSnapshotInput["locomotionMode"]
): MetaversePresenceLocomotionModeId {
  if (
    rawValue !== undefined &&
    metaversePresenceLocomotionModeIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "grounded";
}

function resolveMountedOccupancyKind(
  rawValue: MetaversePresenceMountedOccupancySnapshotInput["occupancyKind"]
): MetaversePresenceMountedOccupancyKind {
  if (metaversePresenceMountedOccupancyKinds.includes(rawValue)) {
    return rawValue;
  }

  throw new Error(`Unsupported metaverse mounted occupancy kind: ${rawValue}`);
}

function resolveMountedOccupantRole(
  rawValue: MetaversePresenceMountedOccupancySnapshotInput["occupantRole"]
): MetaversePresenceMountedOccupantRoleId {
  if (metaversePresenceMountedOccupantRoleIds.includes(rawValue)) {
    return rawValue;
  }

  throw new Error(`Unsupported metaverse mounted occupant role: ${rawValue}`);
}

export function createMetaversePlayerId(rawValue: string): MetaversePlayerId | null {
  const normalizedValue = rawValue.trim().toLowerCase();

  if (!metaversePlayerIdPattern.test(normalizedValue)) {
    return null;
  }

  return normalizedValue as MetaversePlayerId;
}

export function createMetaversePresenceVector3Snapshot({
  x,
  y,
  z
}: MetaversePresenceVector3SnapshotInput): MetaversePresenceVector3Snapshot {
  return Object.freeze({
    x: normalizeFiniteNumber(x),
    y: normalizeFiniteNumber(y),
    z: normalizeFiniteNumber(z)
  });
}

export function createMetaversePresenceMountedOccupancySnapshot({
  environmentAssetId,
  entryId,
  occupancyKind,
  occupantRole,
  seatId
}: MetaversePresenceMountedOccupancySnapshotInput): MetaversePresenceMountedOccupancySnapshot {
  const normalizedOccupancyKind = resolveMountedOccupancyKind(occupancyKind);
  const normalizedEntryId = normalizeOptionalIdentifier(
    entryId,
    "Metaverse mounted occupancy entryId"
  );
  const normalizedSeatId = normalizeOptionalIdentifier(
    seatId,
    "Metaverse mounted occupancy seatId"
  );

  if (
    normalizedOccupancyKind === "seat" &&
    (normalizedSeatId === null || normalizedEntryId !== null)
  ) {
    throw new Error(
      "Seat occupancy requires seatId and must not include entryId."
    );
  }

  if (
    normalizedOccupancyKind === "entry" &&
    (normalizedEntryId === null || normalizedSeatId !== null)
  ) {
    throw new Error(
      "Entry occupancy requires entryId and must not include seatId."
    );
  }

  return Object.freeze({
    environmentAssetId: normalizeRequiredIdentifier(
      environmentAssetId,
      "Metaverse mounted occupancy environmentAssetId"
    ),
    entryId: normalizedEntryId,
    occupancyKind: normalizedOccupancyKind,
    occupantRole: resolveMountedOccupantRole(occupantRole),
    seatId: normalizedSeatId
  });
}

export function createMetaverseMountedOccupancyIdentityKey(
  mountedOccupancy:
    | Pick<
        MetaversePresenceMountedOccupancySnapshot,
        "environmentAssetId" | "entryId" | "occupancyKind" | "seatId"
      >
    | null
    | undefined
): string | null {
  if (mountedOccupancy === null || mountedOccupancy === undefined) {
    return null;
  }

  return [
    mountedOccupancy.environmentAssetId,
    mountedOccupancy.occupancyKind,
    mountedOccupancy.entryId ?? "",
    mountedOccupancy.seatId ?? ""
  ].join(":");
}

export function createMetaversePresenceLookSnapshot({
  pitchRadians = 0,
  yawRadians = 0
}: MetaversePresenceLookSnapshotInput): MetaversePresenceLookSnapshot {
  return Object.freeze({
    pitchRadians: createRadians(pitchRadians),
    yawRadians: createRadians(yawRadians)
  });
}

export function createMetaversePresencePoseSnapshot({
  animationVocabulary,
  look,
  locomotionMode,
  mountedOccupancy = null,
  position,
  stateSequence = 0,
  yawRadians
}: MetaversePresencePoseSnapshotInput): MetaversePresencePoseSnapshot {
  return Object.freeze({
    animationVocabulary: resolveAnimationVocabulary(animationVocabulary),
    look: createMetaversePresenceLookSnapshot({
      pitchRadians: look?.pitchRadians ?? 0,
      yawRadians: look?.yawRadians ?? yawRadians
    }),
    locomotionMode: resolveLocomotionMode(locomotionMode),
    mountedOccupancy:
      mountedOccupancy === null
        ? null
        : createMetaversePresenceMountedOccupancySnapshot(mountedOccupancy),
    position: createMetaversePresenceVector3Snapshot(position),
    stateSequence: normalizeSequence(stateSequence),
    yawRadians: createRadians(yawRadians)
  });
}

export function createMetaversePresencePlayerSnapshot({
  characterId,
  playerId,
  pose,
  teamId,
  username
}: MetaversePresencePlayerSnapshotInput): MetaversePresencePlayerSnapshot {
  return Object.freeze({
    characterId: normalizeCharacterId(characterId),
    playerId,
    pose: createMetaversePresencePoseSnapshot(pose),
    teamId: resolveRequiredMetaversePlayerTeamId(
      teamId,
      "Metaverse presence player teamId"
    ),
    username
  });
}

export function createMetaversePresenceRosterSnapshot({
  players,
  snapshotSequence = 0,
  tickIntervalMs = 150
}: MetaversePresenceRosterSnapshotInput): MetaversePresenceRosterSnapshot {
  return Object.freeze({
    players: Object.freeze(
      players.map((playerSnapshot) =>
        createMetaversePresencePlayerSnapshot(playerSnapshot)
      )
    ),
    snapshotSequence: normalizeSequence(snapshotSequence),
    tickIntervalMs: createMilliseconds(tickIntervalMs)
  });
}

export function createMetaversePresenceRosterEvent(
  roster: MetaversePresenceRosterSnapshotInput
): MetaversePresenceRosterEvent {
  return Object.freeze({
    roster: createMetaversePresenceRosterSnapshot(roster),
    type: "presence-roster"
  });
}

export function createMetaverseJoinPresenceCommand({
  characterId,
  playerId,
  pose,
  username
}: MetaverseJoinPresenceCommandInput): MetaverseJoinPresenceCommand {
  return Object.freeze({
    characterId: normalizeCharacterId(characterId),
    playerId,
    pose: createMetaversePresencePoseSnapshot(pose),
    type: "join-presence",
    username
  });
}

export function createMetaverseLeavePresenceCommand({
  playerId
}: MetaverseLeavePresenceCommandInput): MetaverseLeavePresenceCommand {
  return Object.freeze({
    playerId,
    type: "leave-presence"
  });
}

export function createMetaverseSyncPresenceCommand({
  playerId,
  pose
}: MetaverseSyncPresenceCommandInput): MetaverseSyncPresenceCommand {
  return Object.freeze({
    playerId,
    pose: createMetaversePresencePoseSnapshot(pose),
    type: "sync-presence"
  });
}
