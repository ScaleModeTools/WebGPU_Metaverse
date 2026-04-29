import type {
  MetaverseSyncPlayerLookIntentCommand,
  MetaverseSyncDriverVehicleControlCommand,
  MetaverseSyncPlayerWeaponStateCommand,
  MetaverseSyncPlayerTraversalIntentCommand
} from "./realtime/metaverse-realtime-world-commands.js";
import type { MetaverseRoomId } from "./metaverse-room-contract.js";
import {
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
