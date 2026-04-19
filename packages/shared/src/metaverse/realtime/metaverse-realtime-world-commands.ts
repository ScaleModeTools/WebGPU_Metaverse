import type {
  MetaversePlayerId,
  MetaversePresenceMountedOccupancySnapshot,
  MetaversePresenceMountedOccupancySnapshotInput
} from "../metaverse-presence-contract.js";
import {
  createMetaversePresenceMountedOccupancySnapshot
} from "../metaverse-presence-contract.js";
import {
  createMetaverseTraversalActionIntentSnapshot,
  createMetaverseTraversalBodyControlSnapshot,
  createMetaverseTraversalFacingSnapshot,
  metaverseTraversalActionKindIds,
  metaverseTraversalActionPhaseIds,
  metaverseTraversalActionRejectionReasonIds,
  metaverseTraversalLocomotionModeIds,
  type MetaverseTraversalActionIntentSnapshot as MetaverseSharedTraversalActionIntentSnapshot,
  type MetaverseTraversalActionIntentSnapshotInput as MetaverseSharedTraversalActionIntentSnapshotInput,
  type MetaverseTraversalActionKindId as MetaverseSharedTraversalActionKindId,
  type MetaverseTraversalActionPhaseId as MetaverseSharedTraversalActionPhaseId,
  type MetaverseTraversalActionRejectionReasonId as MetaverseSharedTraversalActionRejectionReasonId,
  type MetaverseTraversalBodyControlSnapshot as MetaverseSharedTraversalBodyControlSnapshot,
  type MetaverseTraversalBodyControlSnapshotInput as MetaverseSharedTraversalBodyControlSnapshotInput,
  type MetaverseTraversalFacingSnapshot as MetaverseSharedTraversalFacingSnapshot,
  type MetaverseTraversalFacingSnapshotInput as MetaverseSharedTraversalFacingSnapshotInput,
  type MetaverseTraversalLocomotionModeId as MetaverseSharedTraversalLocomotionModeId
} from "../metaverse-traversal-contract.js";
import type {
  MetaverseRealtimePlayerLookSnapshot,
  MetaverseRealtimePlayerLookSnapshotInput
} from "./metaverse-realtime-world-snapshots.js";
import {
  createMetaverseRealtimePlayerLookSnapshot
} from "./metaverse-realtime-world-snapshots.js";

export const metaverseRealtimeWorldClientCommandTypes = [
  "sync-mounted-occupancy",
  "sync-player-traversal-intent",
  "sync-player-look-intent",
  "sync-driver-vehicle-control"
] as const;

export const metaversePlayerTraversalIntentLocomotionModeIds =
  metaverseTraversalLocomotionModeIds;
export const metaverseRealtimePlayerTraversalActionKindIds =
  metaverseTraversalActionKindIds;
export const metaverseRealtimePlayerTraversalActionPhaseIds =
  metaverseTraversalActionPhaseIds;
export const metaverseRealtimePlayerTraversalActionRejectionReasonIds =
  metaverseTraversalActionRejectionReasonIds;

export type MetaverseRealtimeWorldClientCommandType =
  (typeof metaverseRealtimeWorldClientCommandTypes)[number];
export type MetaversePlayerTraversalIntentLocomotionModeId =
  MetaverseSharedTraversalLocomotionModeId;
export type MetaverseRealtimePlayerTraversalActionKindId =
  MetaverseSharedTraversalActionKindId;
export type MetaverseRealtimePlayerTraversalActionPhaseId =
  MetaverseSharedTraversalActionPhaseId;
export type MetaverseRealtimePlayerTraversalActionRejectionReasonId =
  MetaverseSharedTraversalActionRejectionReasonId;

export interface MetaverseDriverVehicleControlIntentSnapshot {
  readonly boost: boolean;
  readonly environmentAssetId: string;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly yawAxis: number;
}

export interface MetaverseDriverVehicleControlIntentSnapshotInput {
  readonly boost?: boolean;
  readonly environmentAssetId: string;
  readonly moveAxis?: number;
  readonly strafeAxis?: number;
  readonly yawAxis?: number;
}

export type MetaversePlayerTraversalActionIntentSnapshot =
  MetaverseSharedTraversalActionIntentSnapshot;
export type MetaversePlayerTraversalActionIntentSnapshotInput =
  MetaverseSharedTraversalActionIntentSnapshotInput;
type MetaversePlayerTraversalBodyControlSnapshot =
  MetaverseSharedTraversalBodyControlSnapshot;
type MetaversePlayerTraversalBodyControlSnapshotInput =
  MetaverseSharedTraversalBodyControlSnapshotInput;
type MetaversePlayerTraversalFacingSnapshot =
  MetaverseSharedTraversalFacingSnapshot;
type MetaversePlayerTraversalFacingSnapshotInput =
  MetaverseSharedTraversalFacingSnapshotInput;

export interface MetaversePlayerTraversalIntentSnapshot {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
  readonly facing: MetaversePlayerTraversalFacingSnapshot;
  readonly inputSequence: number;
  readonly locomotionMode: MetaversePlayerTraversalIntentLocomotionModeId;
  readonly orientationSequence: number;
}

export interface MetaversePlayerTraversalIntentSnapshotInput {
  readonly actionIntent?: MetaversePlayerTraversalActionIntentSnapshotInput;
  readonly bodyControl?: MetaversePlayerTraversalBodyControlSnapshotInput;
  readonly facing?: MetaversePlayerTraversalFacingSnapshotInput;
  readonly inputSequence?: number;
  readonly locomotionMode?: MetaversePlayerTraversalIntentLocomotionModeId;
  readonly orientationSequence?: number;
}

export interface MetaverseGameplayTraversalIntentInput {
  readonly boost?: boolean;
  readonly jump?: boolean;
  readonly locomotionMode?: MetaversePlayerTraversalIntentLocomotionModeId | null;
  readonly moveAxis?: number;
  readonly pitchRadians?: number;
  readonly strafeAxis?: number;
  readonly turnAxis?: number;
  readonly yawRadians?: number;
}

export function doMetaversePlayerTraversalSequencedInputsMatch(
  leftIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "actionIntent" | "bodyControl" | "locomotionMode"
  > | null,
  rightIntent: Pick<
    MetaversePlayerTraversalIntentSnapshot,
    "actionIntent" | "bodyControl" | "locomotionMode"
  >
): boolean {
  if (leftIntent === null) {
    return false;
  }

  return (
    leftIntent.actionIntent.kind === rightIntent.actionIntent.kind &&
    leftIntent.actionIntent.pressed === rightIntent.actionIntent.pressed &&
    leftIntent.actionIntent.sequence === rightIntent.actionIntent.sequence &&
    leftIntent.bodyControl.boost === rightIntent.bodyControl.boost &&
    leftIntent.bodyControl.moveAxis === rightIntent.bodyControl.moveAxis &&
    leftIntent.bodyControl.strafeAxis === rightIntent.bodyControl.strafeAxis &&
    leftIntent.locomotionMode === rightIntent.locomotionMode
  );
}

export interface MetaverseSyncDriverVehicleControlCommand {
  readonly controlIntent: MetaverseDriverVehicleControlIntentSnapshot;
  readonly controlSequence: number;
  readonly playerId: MetaversePlayerId;
  readonly type: "sync-driver-vehicle-control";
}

export interface MetaverseSyncDriverVehicleControlCommandInput {
  readonly controlIntent: MetaverseDriverVehicleControlIntentSnapshotInput;
  readonly controlSequence?: number;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseSyncMountedOccupancyCommand {
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null;
  readonly playerId: MetaversePlayerId;
  readonly type: "sync-mounted-occupancy";
}

export interface MetaverseSyncMountedOccupancyCommandInput {
  readonly mountedOccupancy: MetaversePresenceMountedOccupancySnapshotInput | null;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseSyncPlayerTraversalIntentCommand {
  readonly intent: MetaversePlayerTraversalIntentSnapshot;
  readonly playerId: MetaversePlayerId;
  readonly type: "sync-player-traversal-intent";
}

export interface MetaverseSyncPlayerTraversalIntentCommandInput {
  readonly intent: MetaversePlayerTraversalIntentSnapshotInput;
  readonly playerId: MetaversePlayerId;
}

export interface MetaverseSyncPlayerLookIntentCommand {
  readonly lookIntent: MetaverseRealtimePlayerLookSnapshot;
  readonly lookSequence: number;
  readonly playerId: MetaversePlayerId;
  readonly type: "sync-player-look-intent";
}

export interface MetaverseSyncPlayerLookIntentCommandInput {
  readonly lookIntent: MetaverseRealtimePlayerLookSnapshotInput;
  readonly lookSequence?: number;
  readonly playerId: MetaversePlayerId;
}

export type MetaverseRealtimeWorldClientCommand =
  | MetaverseSyncMountedOccupancyCommand
  | MetaverseSyncPlayerTraversalIntentCommand
  | MetaverseSyncPlayerLookIntentCommand
  | MetaverseSyncDriverVehicleControlCommand;

function normalizeFiniteNonNegativeInteger(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  return Math.floor(rawValue);
}

function clampNormalizedAxis(rawValue: number | undefined): number {
  const normalizedValue = rawValue ?? 0;

  if (!Number.isFinite(normalizedValue)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, normalizedValue));
}

function normalizeRequiredIdentifier(rawValue: string, label: string): string {
  const normalizedValue = rawValue.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return normalizedValue;
}

function resolveTraversalIntentLocomotionMode(
  rawValue: MetaversePlayerTraversalIntentSnapshotInput["locomotionMode"]
): MetaversePlayerTraversalIntentLocomotionModeId {
  if (
    rawValue !== undefined &&
    metaversePlayerTraversalIntentLocomotionModeIds.includes(rawValue)
  ) {
    return rawValue;
  }

  return "grounded";
}

export function createMetaverseGameplayTraversalIntentSnapshotInput(
  input: MetaverseGameplayTraversalIntentInput
): MetaversePlayerTraversalIntentSnapshotInput | null {
  if (input.locomotionMode !== "grounded" && input.locomotionMode !== "swim") {
    return null;
  }

  const bodyControlInput = {
    ...(input.boost === undefined ? {} : { boost: input.boost }),
    ...(input.moveAxis === undefined ? {} : { moveAxis: input.moveAxis }),
    ...(input.strafeAxis === undefined
      ? {}
      : { strafeAxis: input.strafeAxis }),
    ...(input.turnAxis === undefined ? {} : { turnAxis: input.turnAxis })
  } satisfies MetaversePlayerTraversalBodyControlSnapshotInput;
  const facingInput = {
    ...(input.pitchRadians === undefined
      ? {}
      : { pitchRadians: input.pitchRadians }),
    ...(input.yawRadians === undefined ? {} : { yawRadians: input.yawRadians })
  } satisfies MetaversePlayerTraversalFacingSnapshotInput;

  return Object.freeze({
    actionIntent:
      input.locomotionMode === "grounded"
        ? createMetaverseTraversalActionIntentSnapshot({
            kind: input.jump === true ? "jump" : "none",
            pressed: input.jump === true
          })
        : createMetaverseTraversalActionIntentSnapshot({
            kind: "none",
            pressed: false
          }),
    bodyControl: createMetaverseTraversalBodyControlSnapshot(bodyControlInput),
    facing: createMetaverseTraversalFacingSnapshot(facingInput),
    locomotionMode: input.locomotionMode
  });
}

function freezeDriverVehicleControlIntentSnapshot(
  input: MetaverseDriverVehicleControlIntentSnapshotInput
): MetaverseDriverVehicleControlIntentSnapshot {
  return Object.freeze({
    boost: input.boost === true,
    environmentAssetId: normalizeRequiredIdentifier(
      input.environmentAssetId,
      "Metaverse realtime environmentAssetId"
    ),
    moveAxis: clampNormalizedAxis(input.moveAxis),
    strafeAxis: clampNormalizedAxis(input.strafeAxis),
    yawAxis: clampNormalizedAxis(input.yawAxis)
  });
}

function freezePlayerTraversalIntentSnapshot(
  input: MetaversePlayerTraversalIntentSnapshotInput
): MetaversePlayerTraversalIntentSnapshot {
  const inputSequence = normalizeFiniteNonNegativeInteger(input.inputSequence ?? 0);
  const orientationSequence = normalizeFiniteNonNegativeInteger(
    input.orientationSequence ?? 0
  );

  return Object.freeze({
    actionIntent: createMetaverseTraversalActionIntentSnapshot(
      input.actionIntent,
      inputSequence
    ),
    bodyControl: createMetaverseTraversalBodyControlSnapshot(input.bodyControl),
    facing: createMetaverseTraversalFacingSnapshot(input.facing),
    inputSequence,
    locomotionMode: resolveTraversalIntentLocomotionMode(input.locomotionMode),
    orientationSequence
  });
}

export function createMetaverseDriverVehicleControlIntentSnapshot(
  input: MetaverseDriverVehicleControlIntentSnapshotInput
): MetaverseDriverVehicleControlIntentSnapshot {
  return freezeDriverVehicleControlIntentSnapshot(input);
}

export function createMetaversePlayerTraversalIntentSnapshot(
  input: MetaversePlayerTraversalIntentSnapshotInput
): MetaversePlayerTraversalIntentSnapshot {
  return freezePlayerTraversalIntentSnapshot(input);
}

export function createMetaverseSyncDriverVehicleControlCommand(
  input: MetaverseSyncDriverVehicleControlCommandInput
): MetaverseSyncDriverVehicleControlCommand {
  return Object.freeze({
    controlIntent: freezeDriverVehicleControlIntentSnapshot(input.controlIntent),
    controlSequence: normalizeFiniteNonNegativeInteger(
      input.controlSequence ?? 0
    ),
    playerId: input.playerId,
    type: "sync-driver-vehicle-control"
  });
}

export function createMetaverseSyncMountedOccupancyCommand(
  input: MetaverseSyncMountedOccupancyCommandInput
): MetaverseSyncMountedOccupancyCommand {
  return Object.freeze({
    mountedOccupancy:
      input.mountedOccupancy === null
        ? null
        : createMetaversePresenceMountedOccupancySnapshot(input.mountedOccupancy),
    playerId: input.playerId,
    type: "sync-mounted-occupancy"
  });
}

export function createMetaverseSyncPlayerTraversalIntentCommand(
  input: MetaverseSyncPlayerTraversalIntentCommandInput
): MetaverseSyncPlayerTraversalIntentCommand {
  return Object.freeze({
    intent: freezePlayerTraversalIntentSnapshot(input.intent),
    playerId: input.playerId,
    type: "sync-player-traversal-intent"
  });
}

export function createMetaverseSyncPlayerLookIntentCommand(
  input: MetaverseSyncPlayerLookIntentCommandInput
): MetaverseSyncPlayerLookIntentCommand {
  return Object.freeze({
    lookIntent: createMetaverseRealtimePlayerLookSnapshot(input.lookIntent),
    lookSequence: normalizeFiniteNonNegativeInteger(input.lookSequence ?? 0),
    playerId: input.playerId,
    type: "sync-player-look-intent"
  });
}
