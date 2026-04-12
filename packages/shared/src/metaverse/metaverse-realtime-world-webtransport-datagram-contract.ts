import type { MetaverseSyncDriverVehicleControlCommand } from "./metaverse-realtime-world-contract.js";
import { createMetaverseSyncDriverVehicleControlCommand } from "./metaverse-realtime-world-contract.js";

export const metaverseRealtimeWorldWebTransportClientDatagramTypes = [
  "world-driver-vehicle-control-datagram"
] as const;

export type MetaverseRealtimeWorldWebTransportClientDatagramType =
  (typeof metaverseRealtimeWorldWebTransportClientDatagramTypes)[number];

export interface MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram {
  readonly command: MetaverseSyncDriverVehicleControlCommand;
  readonly type: "world-driver-vehicle-control-datagram";
}

export interface MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagramInput {
  readonly command: MetaverseSyncDriverVehicleControlCommand;
}

export type MetaverseRealtimeWorldWebTransportClientDatagram =
  MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram;

export function createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram(
  input: MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagramInput
): MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram {
  return Object.freeze({
    command: createMetaverseSyncDriverVehicleControlCommand(input.command),
    type: "world-driver-vehicle-control-datagram"
  });
}
