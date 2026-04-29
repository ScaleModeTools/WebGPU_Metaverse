import type { Username } from "../../player-profile.js";
import type { TypeBrand } from "../../type-branding.js";
import type { Milliseconds, Radians } from "../../unit-measurements.js";
import type { MetaversePlayerTeamId } from "../metaverse-player-team.js";
import {
  createMilliseconds,
  createRadians
} from "../../unit-measurements.js";
import { normalizeMetaversePlayerTeamId } from "../metaverse-player-team.js";
import type {
  MetaversePlayerId,
  MetaversePresenceLocomotionModeId,
  MetaversePresenceMountedOccupancyKind,
  MetaversePresenceMountedOccupantRoleId,
  MetaversePresenceVector3Snapshot,
  MetaversePresenceVector3SnapshotInput
} from "../metaverse-presence-contract.js";
import {
  createMetaversePresenceVector3Snapshot,
  metaversePresenceLocomotionModeIds,
  metaversePresenceMountedOccupancyKinds,
  metaversePresenceMountedOccupantRoleIds,
  shouldKeepMetaverseMountedOccupancyFreeRoam
} from "../metaverse-presence-contract.js";
import {
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseTraversalBodyControlSnapshot,
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionResolutionStateIds,
  type MetaverseTraversalActionResolutionStateId as MetaverseSharedTraversalActionResolutionStateId,
  type MetaverseTraversalAuthoritySnapshot as MetaverseSharedTraversalAuthoritySnapshot,
  type MetaverseTraversalAuthoritySnapshotInput as MetaverseSharedTraversalAuthoritySnapshotInput,
  type MetaverseTraversalBodyControlSnapshot as MetaverseSharedTraversalBodyControlSnapshot,
  type MetaverseTraversalBodyControlSnapshotInput as MetaverseSharedTraversalBodyControlSnapshotInput,
  type MetaverseTraversalFacingSnapshot as MetaverseSharedTraversalFacingSnapshot,
  type MetaverseTraversalFacingSnapshotInput as MetaverseSharedTraversalFacingSnapshotInput
} from "../metaverse-traversal-contract.js";
import {
  createMetaverseGroundedJumpBodySnapshot,
  resolveMetaverseGroundedJumpBodyTraversalActionSnapshot,
  type MetaverseGroundedJumpBodySnapshot
} from "../metaverse-grounded-jump-physics.js";
import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  type MetaverseGroundedBodyRuntimeSnapshot
} from "../metaverse-grounded-body-contract.js";
import {
  createMetaverseSurfaceDriveBodyContactSnapshot,
  createMetaverseSurfaceDriveBodyRuntimeSnapshot,
  type MetaverseSurfaceDriveBodyRuntimeSnapshot
} from "../metaverse-surface-drive-body-contract.js";
import {
  createMetaverseGroundedBodyContactSnapshot,
  createMetaverseGroundedBodyInteractionSnapshot,
  type MetaverseGroundedBodyContactSnapshot
} from "../metaverse-grounded-traversal-kernel.js";
import { createMetaverseSurfaceTraversalDriveTargetSnapshot } from "../metaverse-surface-traversal-simulation.js";
import {
  resolveMetaverseTraversalKinematicActionSnapshot,
  resolveMetaverseTraversalAuthoritySnapshotInput
} from "../metaverse-traversal-authority.js";
import type {
  MetaverseRealtimePlayerWeaponStateSnapshot,
  MetaverseRealtimePlayerWeaponStateSnapshotInput
} from "./metaverse-realtime-player-weapon-state.js";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot
} from "./metaverse-realtime-player-weapon-state.js";
import type {
  MetaverseWorldSurfaceSupportSnapshot
} from "../metaverse-world-surface-policy.js";
import type {
  MetaversePlayerActionReceiptSnapshot,
  MetaversePlayerActionReceiptSnapshotInput,
  MetaverseCombatEventSnapshot,
  MetaverseCombatEventSnapshotInput,
  MetaverseCombatFeedEventSnapshot,
  MetaverseCombatFeedEventSnapshotInput,
  MetaverseCombatMatchSnapshot,
  MetaverseCombatMatchSnapshotInput,
  MetaverseCombatProjectileSnapshot,
  MetaverseCombatProjectileSnapshotInput,
  MetaverseCombatShotResolutionTelemetrySnapshot,
  MetaverseCombatShotResolutionTelemetrySnapshotInput,
  MetaversePlayerCombatSnapshot,
  MetaversePlayerCombatSnapshotInput
} from "../metaverse-combat.js";
import {
  createMetaversePlayerActionReceiptSnapshot,
  createMetaverseCombatEventSnapshot,
  createMetaverseCombatFeedEventSnapshot,
  createMetaverseCombatMatchSnapshot,
  createMetaverseCombatProjectileSnapshot,
  createMetaverseCombatShotResolutionTelemetrySnapshot,
  createMetaversePlayerCombatSnapshot
} from "../metaverse-combat.js";

export const metaverseRealtimeWorldServerEventTypes = [
  "world-snapshot"
] as const;

export const metaverseRealtimePlayerTraversalActionResolutionStateIds =
  metaverseTraversalActionResolutionStateIds;

export type MetaverseRealtimeWorldServerEventType =
  (typeof metaverseRealtimeWorldServerEventTypes)[number];
export type MetaverseRealtimePlayerTraversalActionResolutionStateId =
  MetaverseSharedTraversalActionResolutionStateId;
export type MetaverseRealtimePlayerJumpResolutionStateId =
  MetaverseRealtimePlayerTraversalActionResolutionStateId;

export type MetaverseVehicleId = TypeBrand<string, "MetaverseVehicleId">;

export type MetaverseRealtimeVector3Snapshot = MetaversePresenceVector3Snapshot;
export type MetaverseRealtimeVector3SnapshotInput =
  MetaversePresenceVector3SnapshotInput;

export interface MetaverseRealtimeTickSnapshot {
  readonly currentTick: number;
  readonly emittedAtServerTimeMs: Milliseconds;
  readonly owner: "server";
  readonly serverTimeMs: Milliseconds;
  readonly simulationTimeMs: Milliseconds;
  readonly tickIntervalMs: Milliseconds;
}

export interface MetaverseRealtimeTickSnapshotInput {
  readonly currentTick: number;
  readonly emittedAtServerTimeMs?: number;
  readonly serverTimeMs?: number;
  readonly simulationTimeMs?: number;
  readonly tickIntervalMs: number;
}

export interface MetaverseRealtimeMountedOccupancySnapshot {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancyKind;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

export interface MetaverseRealtimeMountedOccupancySnapshotInput {
  readonly entryId?: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancyKind;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId?: string | null;
  readonly vehicleId: MetaverseVehicleId;
}

export interface MetaverseRealtimeVehicleSeatSnapshot {
  readonly occupantPlayerId: MetaversePlayerId | null;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export interface MetaverseRealtimeVehicleSeatSnapshotInput {
  readonly occupantPlayerId?: MetaversePlayerId | null;
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

export type MetaversePlayerTraversalBodyControlSnapshot =
  MetaverseSharedTraversalBodyControlSnapshot;
export type MetaversePlayerTraversalBodyControlSnapshotInput =
  MetaverseSharedTraversalBodyControlSnapshotInput;
export type MetaversePlayerTraversalFacingSnapshot =
  MetaverseSharedTraversalFacingSnapshot;
export type MetaversePlayerTraversalFacingSnapshotInput =
  MetaverseSharedTraversalFacingSnapshotInput;

export interface MetaverseRealtimePlayerLookSnapshot {
  readonly pitchRadians: Radians;
  readonly yawRadians: Radians;
}

export interface MetaverseRealtimePlayerLookSnapshotInput {
  readonly pitchRadians?: number;
  readonly yawRadians?: number;
}

export interface MetaverseRealtimePlayerPresentationIntentSnapshot {
  readonly moveAxis: number;
  readonly strafeAxis: number;
}

export interface MetaverseRealtimePlayerPresentationIntentSnapshotInput {
  readonly moveAxis?: number;
  readonly strafeAxis?: number;
}

export type MetaverseRealtimePlayerGroundedBodySnapshot =
  MetaverseGroundedBodyRuntimeSnapshot;
export type MetaverseRealtimePlayerGroundedSupportSnapshot =
  MetaverseWorldSurfaceSupportSnapshot;
export type MetaverseRealtimePlayerSwimBodySnapshot =
  MetaverseSurfaceDriveBodyRuntimeSnapshot;

export interface MetaverseRealtimePlayerGroundedBodySnapshotInput
  extends Partial<MetaverseRealtimePlayerGroundedBodySnapshot> {}

export interface MetaverseRealtimePlayerSwimBodySnapshotInput
  extends Partial<MetaverseRealtimePlayerSwimBodySnapshot> {}

export interface MetaverseRealtimePlayerJumpDebugSnapshot {
  readonly pendingActionSequence: number;
  readonly pendingActionBufferAgeMs: Milliseconds | null;
  readonly resolvedActionSequence: number;
  readonly resolvedActionState: MetaverseRealtimePlayerTraversalActionResolutionStateId;
}

export interface MetaverseRealtimePlayerJumpDebugSnapshotInput {
  readonly pendingActionSequence?: number;
  readonly pendingActionBufferAgeMs?: number | null;
  readonly resolvedActionSequence?: number;
  readonly resolvedActionState?: MetaverseRealtimePlayerTraversalActionResolutionStateId;
}

export type MetaverseRealtimePlayerTraversalAuthoritySnapshot =
  MetaverseSharedTraversalAuthoritySnapshot;
export type MetaverseRealtimePlayerTraversalAuthoritySnapshotInput =
  MetaverseSharedTraversalAuthoritySnapshotInput;

export interface MetaverseRealtimePlayerSnapshot {
  readonly angularVelocityRadiansPerSecond: number;
  readonly characterId: string;
  readonly combat: MetaversePlayerCombatSnapshot | null;
  readonly groundedBody: MetaverseRealtimePlayerGroundedBodySnapshot;
  readonly groundedSupport: MetaverseRealtimePlayerGroundedSupportSnapshot | null;
  readonly look: MetaverseRealtimePlayerLookSnapshot;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy: MetaverseRealtimeMountedOccupancySnapshot | null;
  readonly presentationIntent: MetaverseRealtimePlayerPresentationIntentSnapshot;
  readonly playerId: MetaversePlayerId;
  readonly stateSequence: number;
  readonly swimBody: MetaverseRealtimePlayerSwimBodySnapshot | null;
  readonly teamId: MetaversePlayerTeamId;
  readonly traversalAuthority: MetaverseRealtimePlayerTraversalAuthoritySnapshot;
  readonly weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
  readonly username: Username;
}

export interface MetaverseRealtimePlayerSnapshotInput {
  readonly angularVelocityRadiansPerSecond?: number;
  readonly characterId: string;
  readonly combat?: MetaversePlayerCombatSnapshotInput | null;
  readonly groundedBody?: MetaverseRealtimePlayerGroundedBodySnapshotInput;
  readonly groundedSupport?: MetaverseRealtimePlayerGroundedSupportSnapshot | null;
  readonly look?: MetaverseRealtimePlayerLookSnapshotInput;
  readonly locomotionMode?: MetaversePresenceLocomotionModeId;
  readonly mountedOccupancy?: MetaverseRealtimeMountedOccupancySnapshotInput | null;
  readonly presentationIntent?: MetaverseRealtimePlayerPresentationIntentSnapshotInput;
  readonly playerId: MetaversePlayerId;
  readonly stateSequence?: number;
  readonly swimBody?: MetaverseRealtimePlayerSwimBodySnapshotInput | null;
  readonly teamId?: MetaversePlayerTeamId;
  readonly traversalAuthority?: MetaverseRealtimePlayerTraversalAuthoritySnapshotInput;
  readonly weaponState?: MetaverseRealtimePlayerWeaponStateSnapshotInput | null;
  readonly username: Username;
}

export interface MetaverseRealtimeObserverPlayerSnapshot {
  readonly highestProcessedPlayerActionSequence: number;
  readonly jumpDebug: MetaverseRealtimePlayerJumpDebugSnapshot;
  readonly lastProcessedLookSequence: number;
  readonly lastProcessedTraversalSequence: number;
  readonly lastProcessedWeaponSequence: number;
  readonly latestShotResolutionTelemetry:
    | MetaverseCombatShotResolutionTelemetrySnapshot
    | null;
  readonly playerId: MetaversePlayerId;
  readonly recentShotResolutionTelemetry:
    readonly MetaverseCombatShotResolutionTelemetrySnapshot[];
  readonly recentPlayerActionReceipts:
    readonly MetaversePlayerActionReceiptSnapshot[];
}

export interface MetaverseRealtimeObserverPlayerSnapshotInput {
  readonly highestProcessedPlayerActionSequence?: number;
  readonly jumpDebug?: MetaverseRealtimePlayerJumpDebugSnapshotInput;
  readonly lastProcessedLookSequence?: number;
  readonly lastProcessedTraversalSequence?: number;
  readonly lastProcessedWeaponSequence?: number;
  readonly latestShotResolutionTelemetry?:
    | MetaverseCombatShotResolutionTelemetrySnapshotInput
    | null;
  readonly playerId: MetaversePlayerId;
  readonly recentShotResolutionTelemetry?:
    readonly MetaverseCombatShotResolutionTelemetrySnapshotInput[];
  readonly recentPlayerActionReceipts?:
    readonly MetaversePlayerActionReceiptSnapshotInput[];
}

export interface MetaverseRealtimeVehicleSnapshot {
  readonly angularVelocityRadiansPerSecond: number;
  readonly environmentAssetId: string;
  readonly linearVelocity: MetaverseRealtimeVector3Snapshot;
  readonly position: MetaverseRealtimeVector3Snapshot;
  readonly seats: readonly MetaverseRealtimeVehicleSeatSnapshot[];
  readonly vehicleId: MetaverseVehicleId;
  readonly yawRadians: Radians;
}

export interface MetaverseRealtimeVehicleSnapshotInput {
  readonly angularVelocityRadiansPerSecond: number;
  readonly environmentAssetId: string;
  readonly linearVelocity: MetaverseRealtimeVector3SnapshotInput;
  readonly position: MetaverseRealtimeVector3SnapshotInput;
  readonly seats: readonly MetaverseRealtimeVehicleSeatSnapshotInput[];
  readonly vehicleId: MetaverseVehicleId;
  readonly yawRadians: number;
}

export interface MetaverseRealtimeEnvironmentBodySnapshot {
  readonly environmentAssetId: string;
  readonly linearVelocity: MetaverseRealtimeVector3Snapshot;
  readonly position: MetaverseRealtimeVector3Snapshot;
  readonly yawRadians: Radians;
}

export interface MetaverseRealtimeEnvironmentBodySnapshotInput {
  readonly environmentAssetId: string;
  readonly linearVelocity: MetaverseRealtimeVector3SnapshotInput;
  readonly position: MetaverseRealtimeVector3SnapshotInput;
  readonly yawRadians: number;
}

export interface MetaverseRealtimeWorldSnapshot {
  readonly combatEvents: readonly MetaverseCombatEventSnapshot[];
  readonly combatFeed: readonly MetaverseCombatFeedEventSnapshot[];
  readonly combatMatch: MetaverseCombatMatchSnapshot | null;
  readonly environmentBodies: readonly MetaverseRealtimeEnvironmentBodySnapshot[];
  readonly observerPlayer: MetaverseRealtimeObserverPlayerSnapshot | null;
  readonly players: readonly MetaverseRealtimePlayerSnapshot[];
  readonly projectiles: readonly MetaverseCombatProjectileSnapshot[];
  readonly snapshotSequence: number;
  readonly tick: MetaverseRealtimeTickSnapshot;
  readonly vehicles: readonly MetaverseRealtimeVehicleSnapshot[];
}

export interface MetaverseRealtimeWorldSnapshotInput {
  readonly combatEvents?: readonly MetaverseCombatEventSnapshotInput[];
  readonly combatFeed?: readonly MetaverseCombatFeedEventSnapshotInput[];
  readonly combatMatch?: MetaverseCombatMatchSnapshotInput | null;
  readonly environmentBodies?:
    readonly MetaverseRealtimeEnvironmentBodySnapshotInput[];
  readonly observerPlayer?: MetaverseRealtimeObserverPlayerSnapshotInput | null;
  readonly players: readonly MetaverseRealtimePlayerSnapshotInput[];
  readonly projectiles?: readonly MetaverseCombatProjectileSnapshotInput[];
  readonly snapshotSequence?: number;
  readonly tick: MetaverseRealtimeTickSnapshotInput;
  readonly vehicles: readonly MetaverseRealtimeVehicleSnapshotInput[];
}

export interface MetaverseRealtimeWorldEvent {
  readonly type: "world-snapshot";
  readonly world: MetaverseRealtimeWorldSnapshot;
}

export interface MetaverseRealtimeWorldEventInput {
  readonly world: MetaverseRealtimeWorldSnapshotInput;
}

const metaverseVehicleIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

function normalizeFiniteNumber(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return rawValue;
}

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function normalizeRequiredIdentifier(rawValue: string, label: string): string {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

function normalizeOptionalIdentifier(
  rawValue: string | null | undefined,
  label: string
): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  return normalizeRequiredIdentifier(rawValue, label);
}

function resolveLocomotionMode(
  rawValue: MetaverseRealtimePlayerSnapshotInput["locomotionMode"]
): MetaversePresenceLocomotionModeId {
  if (
    rawValue !== undefined &&
    metaversePresenceLocomotionModeIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "grounded";
}

function resolveActionResolutionState(
  rawValue: MetaverseRealtimePlayerJumpDebugSnapshotInput["resolvedActionState"]
): MetaverseRealtimePlayerTraversalActionResolutionStateId {
  if (
    rawValue !== undefined &&
    metaverseRealtimePlayerTraversalActionResolutionStateIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "none";
}

function resolveMountedOccupancyKind(
  rawValue: MetaverseRealtimeMountedOccupancySnapshotInput["occupancyKind"]
): MetaversePresenceMountedOccupancyKind {
  if (metaversePresenceMountedOccupancyKinds.includes(rawValue)) {
    return rawValue;
  }

  return "seat";
}

function resolveOccupantRole(
  rawValue:
    | MetaverseRealtimeMountedOccupancySnapshotInput["occupantRole"]
    | MetaverseRealtimeVehicleSeatSnapshotInput["occupantRole"]
): MetaversePresenceMountedOccupantRoleId {
  if (metaversePresenceMountedOccupantRoleIds.includes(rawValue)) {
    return rawValue;
  }

  return "passenger";
}

function normalizeCharacterId(characterId: string): string {
  return normalizeRequiredIdentifier(
    characterId,
    "Metaverse realtime characterId"
  );
}

function normalizeEnvironmentAssetId(environmentAssetId: string): string {
  return normalizeRequiredIdentifier(
    environmentAssetId,
    "Metaverse realtime environmentAssetId"
  );
}

function freezePlayerLookSnapshot(
  input: MetaverseRealtimePlayerLookSnapshotInput
): MetaverseRealtimePlayerLookSnapshot {
  return Object.freeze({
    pitchRadians: createRadians(input.pitchRadians ?? 0),
    yawRadians: createRadians(input.yawRadians ?? 0)
  });
}

function clampPresentationIntentAxis(rawValue: number | undefined): number {
  const normalizedValue = normalizeFiniteNumber(rawValue ?? 0);
  if (normalizedValue < -1) {
    return -1;
  }
  if (normalizedValue > 1) {
    return 1;
  }
  return normalizedValue;
}

function freezePlayerPresentationIntentSnapshot(
  input: MetaverseRealtimePlayerPresentationIntentSnapshotInput | undefined
): MetaverseRealtimePlayerPresentationIntentSnapshot {
  return Object.freeze({
    moveAxis: clampPresentationIntentAxis(input?.moveAxis),
    strafeAxis: clampPresentationIntentAxis(input?.strafeAxis)
  });
}

function freezePlayerJumpDebugSnapshot(
  input: MetaverseRealtimePlayerJumpDebugSnapshotInput | undefined
): MetaverseRealtimePlayerJumpDebugSnapshot {
  return Object.freeze({
    pendingActionSequence: normalizeFiniteNonNegativeInteger(
      input?.pendingActionSequence ?? 0
    ),
    pendingActionBufferAgeMs:
      input?.pendingActionBufferAgeMs === undefined ||
      input.pendingActionBufferAgeMs === null
        ? null
        : createMilliseconds(
            Math.max(0, normalizeFiniteNumber(input.pendingActionBufferAgeMs))
          ),
    resolvedActionSequence: normalizeFiniteNonNegativeInteger(
      input?.resolvedActionSequence ?? 0
    ),
    resolvedActionState: resolveActionResolutionState(
      input?.resolvedActionState
    )
  });
}

function freezePlayerActionReceiptSnapshots(
  input:
    | readonly MetaversePlayerActionReceiptSnapshotInput[]
    | undefined
): readonly MetaversePlayerActionReceiptSnapshot[] {
  if (input === undefined || input.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    input.map((entry) => createMetaversePlayerActionReceiptSnapshot(entry))
  );
}

function freezeObserverPlayerSnapshot(
  input: MetaverseRealtimeObserverPlayerSnapshotInput
): MetaverseRealtimeObserverPlayerSnapshot {
  return Object.freeze({
    highestProcessedPlayerActionSequence: normalizeFiniteNonNegativeInteger(
      input.highestProcessedPlayerActionSequence ?? 0
    ),
    jumpDebug: freezePlayerJumpDebugSnapshot(input.jumpDebug),
    lastProcessedLookSequence: normalizeFiniteNonNegativeInteger(
      input.lastProcessedLookSequence ?? 0
    ),
    lastProcessedTraversalSequence: normalizeFiniteNonNegativeInteger(
      input.lastProcessedTraversalSequence ?? 0
    ),
    lastProcessedWeaponSequence: normalizeFiniteNonNegativeInteger(
      input.lastProcessedWeaponSequence ?? 0
    ),
    latestShotResolutionTelemetry:
      input.latestShotResolutionTelemetry === undefined ||
      input.latestShotResolutionTelemetry === null
        ? null
        : createMetaverseCombatShotResolutionTelemetrySnapshot(
            input.latestShotResolutionTelemetry
          ),
    playerId: input.playerId,
    recentShotResolutionTelemetry: Object.freeze(
      (input.recentShotResolutionTelemetry ?? []).map((telemetrySnapshot) =>
        createMetaverseCombatShotResolutionTelemetrySnapshot(telemetrySnapshot)
      )
    ),
    recentPlayerActionReceipts: freezePlayerActionReceiptSnapshots(
      input.recentPlayerActionReceipts
    )
  });
}

function freezePlayerGroundedBodySnapshot(
  input: MetaverseRealtimePlayerGroundedBodySnapshotInput | undefined,
  fallbackGrounded: boolean,
  linearVelocity: MetaverseRealtimeVector3Snapshot,
  position: MetaverseRealtimeVector3Snapshot,
  yawRadians: Radians
): MetaverseRealtimePlayerGroundedBodySnapshot {
  return createMetaverseGroundedBodyRuntimeSnapshot({
    contact: createMetaverseGroundedBodyContactSnapshot({
      ...input?.contact,
      supportingContactDetected:
        input?.contact?.supportingContactDetected ??
        input?.jumpBody?.grounded ??
        fallbackGrounded
    }),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input?.driveTarget
    ),
    grounded: input?.jumpBody?.grounded ?? fallbackGrounded,
    interaction: createMetaverseGroundedBodyInteractionSnapshot(
      input?.interaction
    ),
    jumpBody: createMetaverseGroundedJumpBodySnapshot(
      input?.jumpBody ?? {
        grounded: fallbackGrounded
      }
    ),
    linearVelocity: input?.linearVelocity ?? linearVelocity,
    position: input?.position ?? position,
    yawRadians: input?.yawRadians ?? yawRadians
  });
}

function freezePlayerGroundedSupportSnapshot(
  input: MetaverseRealtimePlayerGroundedSupportSnapshot | null | undefined,
  locomotionMode: MetaversePresenceLocomotionModeId
): MetaverseRealtimePlayerGroundedSupportSnapshot | null {
  if (locomotionMode !== "grounded" || input === null || input === undefined) {
    return null;
  }

  return Object.freeze({
    confidence: normalizeFiniteNumber(input.confidence),
    ownerEnvironmentAssetId: normalizeOptionalIdentifier(
      input.ownerEnvironmentAssetId,
      "Metaverse realtime groundedSupport ownerEnvironmentAssetId"
    ),
    slopeAngleRadians: normalizeFiniteNumber(input.slopeAngleRadians),
    stepEligible: input.stepEligible === true,
    supportHeightMeters: normalizeFiniteNumber(input.supportHeightMeters),
    supportId: normalizeRequiredIdentifier(
      input.supportId,
      "Metaverse realtime groundedSupport supportId"
    ),
    supportKind: input.supportKind,
    supportNormal: createMetaversePresenceVector3Snapshot(input.supportNormal),
    walkable: input.walkable === true
  });
}

function freezePlayerSwimBodySnapshot(
  input: MetaverseRealtimePlayerSwimBodySnapshotInput | null | undefined,
  locomotionMode: MetaversePresenceLocomotionModeId,
  mountedOccupancy: MetaverseRealtimeMountedOccupancySnapshot | null,
  linearVelocity: MetaverseRealtimeVector3Snapshot,
  position: MetaverseRealtimeVector3Snapshot,
  yawRadians: Radians
): MetaverseRealtimePlayerSwimBodySnapshot | null {
  if (mountedOccupancy !== null || locomotionMode !== "swim") {
    return null;
  }

  return createMetaverseSurfaceDriveBodyRuntimeSnapshot({
    angularVelocityRadiansPerSecond:
      input?.angularVelocityRadiansPerSecond ?? 0,
    contact: createMetaverseSurfaceDriveBodyContactSnapshot(input?.contact),
    driveTarget: createMetaverseSurfaceTraversalDriveTargetSnapshot(
      input?.driveTarget
    ),
    linearVelocity: input?.linearVelocity ?? linearVelocity,
    position: input?.position ?? position,
    yawRadians: input?.yawRadians ?? yawRadians
  });
}

function freezeVehicleSeatSnapshot(
  input: MetaverseRealtimeVehicleSeatSnapshotInput
): MetaverseRealtimeVehicleSeatSnapshot {
  return Object.freeze({
    occupantPlayerId: input.occupantPlayerId ?? null,
    occupantRole: resolveOccupantRole(input.occupantRole),
    seatId: normalizeRequiredIdentifier(
      input.seatId,
      "Metaverse realtime seatId"
    )
  });
}

function freezeMountedOccupancySnapshot(
  input: MetaverseRealtimeMountedOccupancySnapshotInput
): MetaverseRealtimeMountedOccupancySnapshot {
  const occupancyKind = resolveMountedOccupancyKind(input.occupancyKind);
  const seatId = normalizeOptionalIdentifier(
    input.seatId,
    "Metaverse realtime seatId"
  );
  const entryId = normalizeOptionalIdentifier(
    input.entryId,
    "Metaverse realtime entryId"
  );

  if (occupancyKind === "seat" && seatId === null) {
    throw new Error("Metaverse realtime seat occupancy requires a seatId.");
  }

  if (occupancyKind === "entry" && entryId === null) {
    throw new Error("Metaverse realtime entry occupancy requires an entryId.");
  }

  return Object.freeze({
    entryId,
    environmentAssetId: normalizeEnvironmentAssetId(input.environmentAssetId),
    occupancyKind,
    occupantRole: resolveOccupantRole(input.occupantRole),
    seatId,
    vehicleId: input.vehicleId
  });
}

function resolvePlayerCanonicalKinematicSnapshot(
  input: MetaverseRealtimePlayerSnapshotInput,
  locomotionMode: MetaversePresenceLocomotionModeId,
  mountedOccupancy: MetaverseRealtimeMountedOccupancySnapshot | null
): {
  readonly linearVelocity: MetaverseRealtimeVector3Snapshot;
  readonly position: MetaverseRealtimeVector3Snapshot;
  readonly yawRadians: Radians;
} {
  const preferSwimKinematics =
    mountedOccupancy === null && locomotionMode === "swim";
  const activeBodyInput = preferSwimKinematics
    ? input.swimBody
    : input.groundedBody;

  if (
    activeBodyInput?.linearVelocity === undefined ||
    activeBodyInput.position === undefined ||
    activeBodyInput.yawRadians === undefined
  ) {
    throw new Error(
      preferSwimKinematics
        ? "Metaverse realtime swim player snapshots require swimBody linearVelocity, position, and yawRadians inputs."
        : "Metaverse realtime grounded or mounted player snapshots require groundedBody linearVelocity, position, and yawRadians inputs."
    );
  }

  return Object.freeze({
    linearVelocity: createMetaversePresenceVector3Snapshot(
      activeBodyInput.linearVelocity
    ),
    position: createMetaversePresenceVector3Snapshot(activeBodyInput.position),
    yawRadians: createRadians(activeBodyInput.yawRadians)
  });
}

function freezePlayerSnapshot(
  input: MetaverseRealtimePlayerSnapshotInput,
  mountedOccupancy: MetaverseRealtimeMountedOccupancySnapshot | null,
  currentTick: number = 0
): MetaverseRealtimePlayerSnapshot {
  const mountedTraversalState =
    mountedOccupancy !== null &&
    !shouldKeepMetaverseMountedOccupancyFreeRoam(mountedOccupancy);
  const locomotionMode = resolveLocomotionMode(input.locomotionMode);
  const canonicalKinematicSnapshot = resolvePlayerCanonicalKinematicSnapshot(
    input,
    locomotionMode,
    mountedOccupancy
  );
  const { linearVelocity, position, yawRadians } = canonicalKinematicSnapshot;
  const lookSnapshot =
    input.look === undefined
      ? freezePlayerLookSnapshot({
          pitchRadians: 0,
          yawRadians
        })
      : freezePlayerLookSnapshot(input.look);
  const presentationIntent = freezePlayerPresentationIntentSnapshot(
    input.presentationIntent
  );
  const groundedBody = freezePlayerGroundedBodySnapshot(
    input.groundedBody,
    Math.abs(linearVelocity.y) <= 0.05,
    linearVelocity,
    position,
    yawRadians
  );
  const groundedSupport = freezePlayerGroundedSupportSnapshot(
    input.groundedSupport,
    locomotionMode
  );
  const swimBody = freezePlayerSwimBodySnapshot(
    input.swimBody,
    locomotionMode,
    mountedOccupancy,
    linearVelocity,
    position,
    yawRadians
  );
  const kinematicTraversalAction =
    input.groundedBody?.jumpBody === undefined
      ? resolveMetaverseTraversalKinematicActionSnapshot({
          grounded: Math.abs(linearVelocity.y) <= 0.05,
          locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
          mounted: mountedTraversalState,
          verticalSpeedUnitsPerSecond: linearVelocity.y
        })
      : mountedTraversalState || locomotionMode !== "grounded"
        ? resolveMetaverseTraversalKinematicActionSnapshot({
            grounded: true,
            locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
            mounted: mountedTraversalState,
            verticalSpeedUnitsPerSecond: 0
          })
        : resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(
            groundedBody.jumpBody
          );
  const traversalAuthorityInput =
    input.traversalAuthority ??
    resolveMetaverseTraversalAuthoritySnapshotInput({
      activeAction: kinematicTraversalAction,
      currentTick,
      locomotionMode: locomotionMode === "swim" ? "swim" : "grounded",
      mounted: mountedTraversalState,
      pendingActionKind: "none",
      pendingActionSequence: 0,
      resolvedActionKind: "none",
      resolvedActionSequence: 0,
      resolvedActionState: "none"
    });
  const weaponState =
    input.weaponState === undefined || input.weaponState === null
      ? null
      : createMetaverseRealtimePlayerWeaponStateSnapshot(input.weaponState);
  const combat =
    input.combat === undefined || input.combat === null
      ? null
      : createMetaversePlayerCombatSnapshot(input.combat);

  return Object.freeze({
    angularVelocityRadiansPerSecond: normalizeFiniteNumber(
      input.angularVelocityRadiansPerSecond ?? 0
    ),
    characterId: normalizeCharacterId(input.characterId),
    combat,
    groundedBody,
    groundedSupport,
    look: lookSnapshot,
    locomotionMode,
    mountedOccupancy,
    presentationIntent,
    playerId: input.playerId,
    stateSequence: normalizeFiniteNonNegativeInteger(input.stateSequence ?? 0),
    swimBody,
    teamId: normalizeMetaversePlayerTeamId(input.teamId, input.playerId),
    traversalAuthority:
      createMetaverseTraversalAuthoritySnapshot(traversalAuthorityInput),
    weaponState,
    username: input.username
  });
}

export function readMetaverseRealtimePlayerActiveBodyKinematicSnapshot(
  playerSnapshot: Pick<
    MetaverseRealtimePlayerSnapshot,
    "groundedBody" | "locomotionMode" | "swimBody"
  >
): Pick<MetaverseSurfaceDriveBodyRuntimeSnapshot, "linearVelocity" | "position" | "yawRadians"> {
  if (
    playerSnapshot.locomotionMode === "swim" &&
    playerSnapshot.swimBody !== null
  ) {
    return playerSnapshot.swimBody;
  }

  return playerSnapshot.groundedBody;
}

function freezeVehicleSnapshot(
  input: MetaverseRealtimeVehicleSnapshotInput
): MetaverseRealtimeVehicleSnapshot {
  return Object.freeze({
    angularVelocityRadiansPerSecond: normalizeFiniteNumber(
      input.angularVelocityRadiansPerSecond
    ),
    environmentAssetId: normalizeEnvironmentAssetId(input.environmentAssetId),
    linearVelocity: createMetaversePresenceVector3Snapshot(input.linearVelocity),
    position: createMetaversePresenceVector3Snapshot(input.position),
    seats: Object.freeze(input.seats.map(freezeVehicleSeatSnapshot)),
    vehicleId: input.vehicleId,
    yawRadians: createRadians(input.yawRadians)
  });
}

function freezeEnvironmentBodySnapshot(
  input: MetaverseRealtimeEnvironmentBodySnapshotInput
): MetaverseRealtimeEnvironmentBodySnapshot {
  return Object.freeze({
    environmentAssetId: normalizeEnvironmentAssetId(input.environmentAssetId),
    linearVelocity: createMetaversePresenceVector3Snapshot(input.linearVelocity),
    position: createMetaversePresenceVector3Snapshot(input.position),
    yawRadians: createRadians(input.yawRadians)
  });
}

function assertSeatOccupancyMatchesCanonical(
  playerId: MetaversePlayerId,
  mountedOccupancy: MetaverseRealtimeMountedOccupancySnapshot,
  canonicalOccupancy: MetaverseRealtimeMountedOccupancySnapshot
): void {
  if (
    mountedOccupancy.vehicleId !== canonicalOccupancy.vehicleId ||
    mountedOccupancy.environmentAssetId !== canonicalOccupancy.environmentAssetId ||
    mountedOccupancy.seatId !== canonicalOccupancy.seatId ||
    mountedOccupancy.occupantRole !== canonicalOccupancy.occupantRole
  ) {
    throw new Error(
      `Metaverse realtime player ${playerId} seat occupancy must match the authoritative vehicle seat state.`
    );
  }
}

function resolvePlayerMountedOccupancy(
  playerId: MetaversePlayerId,
  mountedOccupancyInput: MetaverseRealtimeMountedOccupancySnapshotInput | null | undefined,
  canonicalSeatOccupancy: MetaverseRealtimeMountedOccupancySnapshot | null,
  vehicleSnapshotById: ReadonlyMap<
    MetaverseVehicleId,
    MetaverseRealtimeVehicleSnapshot
  >
): MetaverseRealtimeMountedOccupancySnapshot | null {
  if (mountedOccupancyInput === undefined || mountedOccupancyInput === null) {
    return canonicalSeatOccupancy;
  }

  const mountedOccupancy = freezeMountedOccupancySnapshot(mountedOccupancyInput);

  if (mountedOccupancy.occupancyKind === "seat") {
    if (canonicalSeatOccupancy === null) {
      throw new Error(
        `Metaverse realtime player ${playerId} seat occupancy requires a matching occupied vehicle seat.`
      );
    }

    assertSeatOccupancyMatchesCanonical(
      playerId,
      mountedOccupancy,
      canonicalSeatOccupancy
    );

    return canonicalSeatOccupancy;
  }

  if (canonicalSeatOccupancy !== null) {
    throw new Error(
      `Metaverse realtime player ${playerId} cannot resolve entry occupancy while a vehicle seat claims the player at the same tick.`
    );
  }

  const occupiedVehicle = vehicleSnapshotById.get(mountedOccupancy.vehicleId);

  if (
    occupiedVehicle === undefined ||
    occupiedVehicle.environmentAssetId !== mountedOccupancy.environmentAssetId
  ) {
    throw new Error(
      `Metaverse realtime player ${playerId} entry occupancy must reference a vehicle present in the same world snapshot.`
    );
  }

  return mountedOccupancy;
}

export function createMetaverseVehicleId(
  rawValue: string
): MetaverseVehicleId | null {
  const normalizedValue = rawValue.trim();

  if (
    normalizedValue.length === 0 ||
    normalizedValue.length > 64 ||
    !metaverseVehicleIdPattern.test(normalizedValue)
  ) {
    return null;
  }

  return normalizedValue as MetaverseVehicleId;
}

export function createMetaverseRealtimeTickSnapshot(
  input: MetaverseRealtimeTickSnapshotInput
): MetaverseRealtimeTickSnapshot {
  const currentTick = normalizeFiniteNonNegativeInteger(input.currentTick);
  const tickIntervalMs = createMilliseconds(input.tickIntervalMs);
  const simulationTimeMs = createMilliseconds(
    input.simulationTimeMs ??
      input.serverTimeMs ??
      currentTick * Number(tickIntervalMs)
  );
  const emittedAtServerTimeMs = createMilliseconds(
    input.emittedAtServerTimeMs ??
      input.serverTimeMs ??
      Number(simulationTimeMs)
  );

  return Object.freeze({
    currentTick,
    emittedAtServerTimeMs,
    owner: "server",
    serverTimeMs: emittedAtServerTimeMs,
    simulationTimeMs,
    tickIntervalMs
  });
}

export function createMetaverseRealtimePlayerLookSnapshot(
  input: MetaverseRealtimePlayerLookSnapshotInput
): MetaverseRealtimePlayerLookSnapshot {
  return freezePlayerLookSnapshot(input);
}

export function createMetaverseRealtimeObserverPlayerSnapshot(
  input: MetaverseRealtimeObserverPlayerSnapshotInput
): MetaverseRealtimeObserverPlayerSnapshot {
  return freezeObserverPlayerSnapshot(input);
}

export function createMetaverseRealtimeMountedOccupancySnapshot(
  input: MetaverseRealtimeMountedOccupancySnapshotInput
): MetaverseRealtimeMountedOccupancySnapshot {
  return freezeMountedOccupancySnapshot(input);
}

export function createMetaverseRealtimeVehicleSeatSnapshot(
  input: MetaverseRealtimeVehicleSeatSnapshotInput
): MetaverseRealtimeVehicleSeatSnapshot {
  return freezeVehicleSeatSnapshot(input);
}

export function createMetaverseRealtimePlayerSnapshot(
  input: MetaverseRealtimePlayerSnapshotInput
): MetaverseRealtimePlayerSnapshot {
  return freezePlayerSnapshot(
    input,
    input.mountedOccupancy === undefined || input.mountedOccupancy === null
      ? null
      : freezeMountedOccupancySnapshot(input.mountedOccupancy),
    0
  );
}

export function createMetaverseRealtimeVehicleSnapshot(
  input: MetaverseRealtimeVehicleSnapshotInput
): MetaverseRealtimeVehicleSnapshot {
  return freezeVehicleSnapshot(input);
}

export function createMetaverseRealtimeEnvironmentBodySnapshot(
  input: MetaverseRealtimeEnvironmentBodySnapshotInput
): MetaverseRealtimeEnvironmentBodySnapshot {
  return freezeEnvironmentBodySnapshot(input);
}

export function createMetaverseRealtimeWorldSnapshot(
  input: MetaverseRealtimeWorldSnapshotInput
): MetaverseRealtimeWorldSnapshot {
  const tick = createMetaverseRealtimeTickSnapshot(input.tick);
  const combatMatch =
    input.combatMatch === undefined || input.combatMatch === null
      ? null
      : createMetaverseCombatMatchSnapshot(input.combatMatch);
  const combatEvents = (input.combatEvents ?? []).map(
    createMetaverseCombatEventSnapshot
  );
  const combatFeed = (input.combatFeed ?? []).map(
    createMetaverseCombatFeedEventSnapshot
  );
  const environmentBodies = (input.environmentBodies ?? []).map(
    freezeEnvironmentBodySnapshot
  );
  const projectiles = (input.projectiles ?? []).map(
    createMetaverseCombatProjectileSnapshot
  );
  const vehicles = input.vehicles.map(freezeVehicleSnapshot);
  const environmentBodySnapshotByEnvironmentAssetId = new Map<
    string,
    MetaverseRealtimeEnvironmentBodySnapshot
  >();
  const vehicleSnapshotById = new Map<
    MetaverseVehicleId,
    MetaverseRealtimeVehicleSnapshot
  >();
  const canonicalSeatOccupancyByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseRealtimeMountedOccupancySnapshot
  >();

  for (const environmentBody of environmentBodies) {
    if (
      environmentBodySnapshotByEnvironmentAssetId.has(
        environmentBody.environmentAssetId
      )
    ) {
      throw new Error(
        `Metaverse realtime world snapshot includes duplicate environment body environmentAssetId ${environmentBody.environmentAssetId}.`
      );
    }

    environmentBodySnapshotByEnvironmentAssetId.set(
      environmentBody.environmentAssetId,
      environmentBody
    );
  }

  for (const vehicle of vehicles) {
    if (vehicleSnapshotById.has(vehicle.vehicleId)) {
      throw new Error(
        `Metaverse realtime world snapshot includes duplicate vehicleId ${vehicle.vehicleId}.`
      );
    }

    vehicleSnapshotById.set(vehicle.vehicleId, vehicle);

    for (const seat of vehicle.seats) {
      if (seat.occupantPlayerId === null) {
        continue;
      }

      if (canonicalSeatOccupancyByPlayerId.has(seat.occupantPlayerId)) {
        throw new Error(
          `Metaverse realtime world snapshot assigns player ${seat.occupantPlayerId} to more than one occupied vehicle seat.`
        );
      }

      canonicalSeatOccupancyByPlayerId.set(
        seat.occupantPlayerId,
        Object.freeze({
          entryId: null,
          environmentAssetId: vehicle.environmentAssetId,
          occupancyKind: "seat",
          occupantRole: seat.occupantRole,
          seatId: seat.seatId,
          vehicleId: vehicle.vehicleId
        })
      );
    }
  }

  const players = input.players.map((playerInput) =>
    freezePlayerSnapshot(
      playerInput,
      resolvePlayerMountedOccupancy(
        playerInput.playerId,
        playerInput.mountedOccupancy,
        canonicalSeatOccupancyByPlayerId.get(playerInput.playerId) ?? null,
        vehicleSnapshotById
      ),
      tick.currentTick
    )
  );
  const playerIds = new Set<MetaversePlayerId>();

  for (const player of players) {
    if (playerIds.has(player.playerId)) {
      throw new Error(
        `Metaverse realtime world snapshot includes duplicate playerId ${player.playerId}.`
      );
    }

    playerIds.add(player.playerId);
  }

  for (const occupantPlayerId of canonicalSeatOccupancyByPlayerId.keys()) {
    if (!playerIds.has(occupantPlayerId)) {
      throw new Error(
        `Metaverse realtime vehicle seat occupancy references missing player ${occupantPlayerId}.`
      );
    }
  }

  const observerPlayer =
    input.observerPlayer === undefined || input.observerPlayer === null
      ? null
      : freezeObserverPlayerSnapshot(input.observerPlayer);

  if (observerPlayer !== null && !playerIds.has(observerPlayer.playerId)) {
    throw new Error(
      `Metaverse realtime world snapshot observer player ${observerPlayer.playerId} must reference a player present in the same world snapshot.`
    );
  }

  return Object.freeze({
    combatEvents: Object.freeze(combatEvents),
    combatFeed: Object.freeze(combatFeed),
    combatMatch,
    environmentBodies: Object.freeze(environmentBodies),
    observerPlayer,
    players: Object.freeze(players),
    projectiles: Object.freeze(projectiles),
    snapshotSequence: normalizeFiniteNonNegativeInteger(input.snapshotSequence ?? 0),
    tick,
    vehicles: Object.freeze(vehicles)
  });
}

export function createMetaverseRealtimeWorldEvent(
  input: MetaverseRealtimeWorldEventInput
): MetaverseRealtimeWorldEvent {
  return Object.freeze({
    type: "world-snapshot",
    world: createMetaverseRealtimeWorldSnapshot(input.world)
  });
}
