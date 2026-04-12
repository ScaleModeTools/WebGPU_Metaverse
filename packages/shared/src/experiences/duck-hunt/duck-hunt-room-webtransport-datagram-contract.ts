import type { CoopSyncPlayerPresenceCommand } from "./duck-hunt-room-contract.js";
import { createCoopSyncPlayerPresenceCommand } from "./duck-hunt-room-contract.js";

export const duckHuntCoopRoomWebTransportClientDatagramTypes = [
  "coop-room-player-presence-datagram"
] as const;

export type DuckHuntCoopRoomWebTransportClientDatagramType =
  (typeof duckHuntCoopRoomWebTransportClientDatagramTypes)[number];

export interface DuckHuntCoopRoomWebTransportPlayerPresenceDatagram {
  readonly command: CoopSyncPlayerPresenceCommand;
  readonly type: "coop-room-player-presence-datagram";
}

export interface DuckHuntCoopRoomWebTransportPlayerPresenceDatagramInput {
  readonly command: CoopSyncPlayerPresenceCommand;
}

export type DuckHuntCoopRoomWebTransportClientDatagram =
  DuckHuntCoopRoomWebTransportPlayerPresenceDatagram;

export function createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram(
  input: DuckHuntCoopRoomWebTransportPlayerPresenceDatagramInput
): DuckHuntCoopRoomWebTransportPlayerPresenceDatagram {
  return Object.freeze({
    command: createCoopSyncPlayerPresenceCommand(input.command),
    type: "coop-room-player-presence-datagram"
  });
}
