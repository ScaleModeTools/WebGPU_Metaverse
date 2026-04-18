import type {
  MetaverseRealtimeWorldEvent
} from "./realtime/metaverse-realtime-world-snapshots.js";
import {
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand
} from "./realtime/metaverse-realtime-world-commands.js";
import type {
  MetaverseRealtimeWorldClientCommand
} from "./realtime/metaverse-realtime-world-commands.js";
import {
  createMetaverseRealtimeWorldEvent
} from "./realtime/metaverse-realtime-world-snapshots.js";
import type { MetaversePlayerId } from "./metaverse-presence-contract.js";

export const metaverseRealtimeWorldWebTransportClientMessageTypes = [
  "world-snapshot-request",
  "world-snapshot-subscribe",
  "world-command-request"
] as const;

export const metaverseRealtimeWorldWebTransportServerMessageTypes = [
  "world-server-event",
  "world-error"
] as const;

export type MetaverseRealtimeWorldWebTransportClientMessageType =
  (typeof metaverseRealtimeWorldWebTransportClientMessageTypes)[number];
export type MetaverseRealtimeWorldWebTransportServerMessageType =
  (typeof metaverseRealtimeWorldWebTransportServerMessageTypes)[number];

export interface MetaverseRealtimeWorldWebTransportSnapshotRequest {
  readonly observerPlayerId: MetaversePlayerId;
  readonly type: "world-snapshot-request";
}

export interface MetaverseRealtimeWorldWebTransportSnapshotRequestInput {
  readonly observerPlayerId: MetaversePlayerId;
}

export interface MetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest {
  readonly observerPlayerId: MetaversePlayerId;
  readonly type: "world-snapshot-subscribe";
}

export interface MetaverseRealtimeWorldWebTransportSnapshotSubscribeRequestInput {
  readonly observerPlayerId: MetaversePlayerId;
}

export interface MetaverseRealtimeWorldWebTransportServerEventMessage {
  readonly event: MetaverseRealtimeWorldEvent;
  readonly type: "world-server-event";
}

export interface MetaverseRealtimeWorldWebTransportServerEventMessageInput {
  readonly event: MetaverseRealtimeWorldEvent;
}

export interface MetaverseRealtimeWorldWebTransportCommandRequest {
  readonly command: MetaverseRealtimeWorldClientCommand;
  readonly type: "world-command-request";
}

export interface MetaverseRealtimeWorldWebTransportCommandRequestInput {
  readonly command: MetaverseRealtimeWorldClientCommand;
}

export interface MetaverseRealtimeWorldWebTransportErrorMessage {
  readonly message: string;
  readonly type: "world-error";
}

export interface MetaverseRealtimeWorldWebTransportErrorMessageInput {
  readonly message: string;
}

export type MetaverseRealtimeWorldWebTransportClientMessage =
  | MetaverseRealtimeWorldWebTransportCommandRequest
  | MetaverseRealtimeWorldWebTransportSnapshotRequest
  | MetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest;

export type MetaverseRealtimeWorldWebTransportServerMessage =
  | MetaverseRealtimeWorldWebTransportErrorMessage
  | MetaverseRealtimeWorldWebTransportServerEventMessage;

export function createMetaverseRealtimeWorldWebTransportSnapshotRequest(
  input: MetaverseRealtimeWorldWebTransportSnapshotRequestInput
): MetaverseRealtimeWorldWebTransportSnapshotRequest {
  return Object.freeze({
    observerPlayerId: input.observerPlayerId,
    type: "world-snapshot-request"
  });
}

export function createMetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest(
  input: MetaverseRealtimeWorldWebTransportSnapshotSubscribeRequestInput
): MetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest {
  return Object.freeze({
    observerPlayerId: input.observerPlayerId,
    type: "world-snapshot-subscribe"
  });
}

function normalizeMetaverseRealtimeWorldClientCommand(
  command: MetaverseRealtimeWorldClientCommand
): MetaverseRealtimeWorldClientCommand {
  switch (command.type) {
    case "sync-driver-vehicle-control":
      return createMetaverseSyncDriverVehicleControlCommand(command);
    case "sync-mounted-occupancy":
      return createMetaverseSyncMountedOccupancyCommand(command);
    case "sync-player-look-intent":
      return createMetaverseSyncPlayerLookIntentCommand(command);
    case "sync-player-traversal-intent":
      return createMetaverseSyncPlayerTraversalIntentCommand(command);
    default: {
      const exhaustiveCommand: never = command;

      throw new Error(
        `Unsupported metaverse realtime world command type: ${exhaustiveCommand}`
      );
    }
  }
}

export function createMetaverseRealtimeWorldWebTransportCommandRequest(
  input: MetaverseRealtimeWorldWebTransportCommandRequestInput
): MetaverseRealtimeWorldWebTransportCommandRequest {
  return Object.freeze({
    command: normalizeMetaverseRealtimeWorldClientCommand(input.command),
    type: "world-command-request"
  });
}

export function createMetaverseRealtimeWorldWebTransportServerEventMessage(
  input: MetaverseRealtimeWorldWebTransportServerEventMessageInput
): MetaverseRealtimeWorldWebTransportServerEventMessage {
  return Object.freeze({
    event: createMetaverseRealtimeWorldEvent({
      world: input.event.world
    }),
    type: "world-server-event"
  });
}

export function createMetaverseRealtimeWorldWebTransportErrorMessage(
  input: MetaverseRealtimeWorldWebTransportErrorMessageInput
): MetaverseRealtimeWorldWebTransportErrorMessage {
  return Object.freeze({
    message: input.message.trim().length === 0
      ? "Metaverse world WebTransport request failed."
      : input.message.trim(),
    type: "world-error"
  });
}
