import type {
  MetaversePlayerTraversalIntentSnapshot,
  MetaverseSyncPlayerLookIntentCommand,
  MetaverseSyncDriverVehicleControlCommand,
  MetaverseSyncPlayerWeaponStateCommand,
  MetaverseSyncPlayerTraversalIntentCommand
} from "./realtime/metaverse-realtime-world-commands.js";
import type { MetaversePlayerId } from "./metaverse-presence-contract.js";
import type { MetaverseRoomId } from "./metaverse-room-contract.js";
import {
  createMetaversePlayerTraversalIntentSnapshot,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerWeaponStateCommand,
  createMetaverseSyncPlayerTraversalIntentCommand
} from "./realtime/metaverse-realtime-world-commands.js";

export const metaverseRealtimeWorldWebTransportClientDatagramTypes = [
  "world-player-look-intent-datagram",
  "world-player-traversal-intent-datagram",
  "world-player-weapon-state-datagram",
  "world-driver-vehicle-control-datagram"
] as const;

export type MetaverseRealtimeWorldWebTransportClientDatagramType =
  (typeof metaverseRealtimeWorldWebTransportClientDatagramTypes)[number];

export interface MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram {
  readonly command: MetaverseSyncDriverVehicleControlCommand;
  readonly roomId: MetaverseRoomId;
  readonly type: "world-driver-vehicle-control-datagram";
}

export interface MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagramInput {
  readonly command: MetaverseSyncDriverVehicleControlCommand;
  readonly roomId: MetaverseRoomId;
}

export interface MetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram {
  readonly command: MetaverseSyncPlayerLookIntentCommand;
  readonly roomId: MetaverseRoomId;
  readonly type: "world-player-look-intent-datagram";
}

export interface MetaverseRealtimeWorldWebTransportPlayerLookIntentDatagramInput {
  readonly command: MetaverseSyncPlayerLookIntentCommand;
  readonly roomId: MetaverseRoomId;
}

export interface MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram {
  readonly command: MetaverseSyncPlayerTraversalIntentCommand;
  readonly roomId: MetaverseRoomId;
  readonly type: "world-player-traversal-intent-datagram";
}

export interface MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagramInput {
  readonly command: MetaverseSyncPlayerTraversalIntentCommand;
  readonly roomId: MetaverseRoomId;
}

type CompactBoolean = 0 | 1;
type CompactTraversalActionKind = 0 | 1;
type CompactTraversalLocomotionMode = 0 | 1;

export const metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType =
  "pt" as const;

export type MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentSample =
  readonly [
    sequence: number,
    boost: CompactBoolean,
    moveAxis: number,
    strafeAxis: number,
    turnAxis: number,
    pitchRadians: number,
    yawRadians: number,
    locomotionMode: CompactTraversalLocomotionMode,
    actionKind: CompactTraversalActionKind,
    actionPressed: CompactBoolean,
    actionSequence: number
  ];

export interface MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram {
  readonly h?:
    | readonly MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentSample[]
    | undefined;
  readonly i: MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentSample;
  readonly p: MetaversePlayerId;
  readonly r: MetaverseRoomId;
  readonly t: typeof metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType;
}

export interface MetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram {
  readonly command: MetaverseSyncPlayerWeaponStateCommand;
  readonly roomId: MetaverseRoomId;
  readonly type: "world-player-weapon-state-datagram";
}

export interface MetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagramInput {
  readonly command: MetaverseSyncPlayerWeaponStateCommand;
  readonly roomId: MetaverseRoomId;
}

export type MetaverseRealtimeWorldWebTransportClientDatagram =
  | MetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram
  | MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram
  | MetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram
  | MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodeCompactBoolean(value: boolean): CompactBoolean {
  return value ? 1 : 0;
}

function decodeCompactBoolean(value: unknown, label: string): boolean {
  if (value === 0) {
    return false;
  }

  if (value === 1) {
    return true;
  }

  throw new Error(`${label} must be 0 or 1.`);
}

function readCompactNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function encodeCompactTraversalActionKind(
  kind: MetaversePlayerTraversalIntentSnapshot["actionIntent"]["kind"]
): CompactTraversalActionKind {
  return kind === "jump" ? 1 : 0;
}

function decodeCompactTraversalActionKind(
  value: unknown,
  label: string
): MetaversePlayerTraversalIntentSnapshot["actionIntent"]["kind"] {
  if (value === 0) {
    return "none";
  }

  if (value === 1) {
    return "jump";
  }

  throw new Error(`${label} must be 0 or 1.`);
}

function encodeCompactTraversalLocomotionMode(
  locomotionMode: MetaversePlayerTraversalIntentSnapshot["locomotionMode"]
): CompactTraversalLocomotionMode {
  return locomotionMode === "swim" ? 1 : 0;
}

function decodeCompactTraversalLocomotionMode(
  value: unknown,
  label: string
): MetaversePlayerTraversalIntentSnapshot["locomotionMode"] {
  if (value === 0) {
    return "grounded";
  }

  if (value === 1) {
    return "swim";
  }

  throw new Error(`${label} must be 0 or 1.`);
}

function encodeCompactPlayerTraversalIntentSample(
  intent: MetaversePlayerTraversalIntentSnapshot
): MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentSample {
  return Object.freeze([
    intent.sequence,
    encodeCompactBoolean(intent.bodyControl.boost),
    intent.bodyControl.moveAxis,
    intent.bodyControl.strafeAxis,
    intent.bodyControl.turnAxis,
    intent.facing.pitchRadians,
    intent.facing.yawRadians,
    encodeCompactTraversalLocomotionMode(intent.locomotionMode),
    encodeCompactTraversalActionKind(intent.actionIntent.kind),
    encodeCompactBoolean(intent.actionIntent.pressed),
    intent.actionIntent.sequence
  ]);
}

function decodeCompactPlayerTraversalIntentSample(
  sample: unknown,
  label: string
): MetaversePlayerTraversalIntentSnapshot {
  if (!Array.isArray(sample) || sample.length !== 11) {
    throw new Error(`${label} must be an 11-entry compact traversal sample.`);
  }

  return createMetaversePlayerTraversalIntentSnapshot({
    actionIntent: {
      kind: decodeCompactTraversalActionKind(sample[8], `${label}[8]`),
      pressed: decodeCompactBoolean(sample[9], `${label}[9]`),
      sequence: readCompactNumber(sample[10], `${label}[10]`)
    },
    bodyControl: {
      boost: decodeCompactBoolean(sample[1], `${label}[1]`),
      moveAxis: readCompactNumber(sample[2], `${label}[2]`),
      strafeAxis: readCompactNumber(sample[3], `${label}[3]`),
      turnAxis: readCompactNumber(sample[4], `${label}[4]`)
    },
    facing: {
      pitchRadians: readCompactNumber(sample[5], `${label}[5]`),
      yawRadians: readCompactNumber(sample[6], `${label}[6]`)
    },
    locomotionMode: decodeCompactTraversalLocomotionMode(
      sample[7],
      `${label}[7]`
    ),
    sequence: readCompactNumber(sample[0], `${label}[0]`)
  });
}

export function createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram(
  input: MetaverseRealtimeWorldWebTransportPlayerLookIntentDatagramInput
): MetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram {
  return Object.freeze({
    command: createMetaverseSyncPlayerLookIntentCommand(input.command),
    roomId: input.roomId,
    type: "world-player-look-intent-datagram"
  });
}

export function createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram(
  input: MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagramInput
): MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram {
  return Object.freeze({
    command: createMetaverseSyncPlayerTraversalIntentCommand(input.command),
    roomId: input.roomId,
    type: "world-player-traversal-intent-datagram"
  });
}

export function createMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram(
  input: MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagramInput
): MetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram {
  const command = createMetaverseSyncPlayerTraversalIntentCommand(input.command);
  const compactPendingSamples =
    command.pendingIntentSamples === undefined
      ? undefined
      : Object.freeze(
          command.pendingIntentSamples.map((intentSample) =>
            encodeCompactPlayerTraversalIntentSample(intentSample)
          )
        );

  return Object.freeze({
    ...(compactPendingSamples === undefined
      ? {}
      : {
          h: compactPendingSamples
        }),
    i: encodeCompactPlayerTraversalIntentSample(command.intent),
    p: command.playerId,
    r: input.roomId,
    t: metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType
  });
}

export function parseMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram(
  input: unknown
): MetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram {
  if (!isRecord(input)) {
    throw new Error(
      "Metaverse compact traversal datagram must be an object."
    );
  }

  if (
    input.t !==
    metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType
  ) {
    throw new Error(
      `Unsupported compact metaverse traversal datagram type: ${String(input.t)}`
    );
  }

  if (typeof input.p !== "string" || input.p.trim().length === 0) {
    throw new Error("Metaverse compact traversal datagram player id is required.");
  }

  if (typeof input.r !== "string" || input.r.trim().length === 0) {
    throw new Error("Metaverse compact traversal datagram room id is required.");
  }

  if (input.h !== undefined && !Array.isArray(input.h)) {
    throw new Error(
      "Metaverse compact traversal datagram history must be an array."
    );
  }

  return createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
    command: createMetaverseSyncPlayerTraversalIntentCommand({
      intent: decodeCompactPlayerTraversalIntentSample(input.i, "i"),
      ...(input.h === undefined
        ? {}
        : {
            pendingIntentSamples: input.h.map((intentSample, intentIndex) =>
              decodeCompactPlayerTraversalIntentSample(
                intentSample,
                `h[${intentIndex}]`
              )
            )
          }),
      playerId: input.p as MetaversePlayerId
    }),
    roomId: input.r as MetaverseRoomId
  });
}

export function createMetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram(
  input: MetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagramInput
): MetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram {
  return Object.freeze({
    command: createMetaverseSyncPlayerWeaponStateCommand(input.command),
    roomId: input.roomId,
    type: "world-player-weapon-state-datagram"
  });
}

export function createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram(
  input: MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagramInput
): MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram {
  return Object.freeze({
    command: createMetaverseSyncDriverVehicleControlCommand(input.command),
    roomId: input.roomId,
    type: "world-driver-vehicle-control-datagram"
  });
}
