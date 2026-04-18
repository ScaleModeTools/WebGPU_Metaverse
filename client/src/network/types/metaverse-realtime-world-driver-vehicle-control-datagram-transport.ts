import type { MetaverseSyncDriverVehicleControlCommand } from "@webgpu-metaverse/shared/metaverse/realtime";

export interface MetaverseRealtimeWorldDriverVehicleControlDatagramTransport {
  dispose?(): void;
  sendDriverVehicleControlDatagram(
    command: MetaverseSyncDriverVehicleControlCommand
  ): Promise<void>;
}
