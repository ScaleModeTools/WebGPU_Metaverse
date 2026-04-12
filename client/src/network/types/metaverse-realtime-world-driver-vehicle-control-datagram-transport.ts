import type { MetaverseSyncDriverVehicleControlCommand } from "@webgpu-metaverse/shared";

export interface MetaverseRealtimeWorldDriverVehicleControlDatagramTransport {
  dispose?(): void;
  sendDriverVehicleControlDatagram(
    command: MetaverseSyncDriverVehicleControlCommand
  ): Promise<void>;
}
