import type {
  MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  MetaverseSyncDriverVehicleControlCommand
} from "@webgpu-metaverse/shared";
import {
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram
} from "@webgpu-metaverse/shared";

import { LatestWinsWebTransportJsonDatagramChannel } from "./latest-wins-webtransport-json-datagram-channel";
import type { MetaverseRealtimeWorldDriverVehicleControlDatagramTransport } from "../types/metaverse-realtime-world-driver-vehicle-control-datagram-transport";

interface MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransportConfig {
  readonly webTransportUrl: string;
}

interface MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramChannel {
  dispose(): void;
  sendDatagram(
    datagram: MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram
  ): Promise<void>;
}

interface WebTransportDatagramStreamLike {
  readonly writable: WritableStream<Uint8Array>;
}

interface WebTransportLike {
  readonly closed?: Promise<unknown>;
  readonly datagrams?: WebTransportDatagramStreamLike;
  readonly ready?: Promise<unknown>;
  close(closeInfo?: {
    readonly closeCode?: number;
    readonly reason?: string;
  }): void;
}

interface MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransportDependencies {
  readonly channel?: MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramChannel;
  readonly webTransportFactory?: (url: string) => WebTransportLike;
}

export function createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport(
  config: MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransportConfig,
  dependencies: MetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransportDependencies = {}
): MetaverseRealtimeWorldDriverVehicleControlDatagramTransport {
  const channel =
    dependencies.channel ??
    new LatestWinsWebTransportJsonDatagramChannel<MetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram>(
      {
        url: config.webTransportUrl
      },
      dependencies.webTransportFactory === undefined
        ? {}
        : {
            webTransportFactory: dependencies.webTransportFactory
          }
    );

  return Object.freeze({
    dispose() {
      channel.dispose();
    },
    async sendDriverVehicleControlDatagram(
      command: MetaverseSyncDriverVehicleControlCommand
    ): Promise<void> {
      await channel.sendDatagram(
        createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
          command
        })
      );
    }
  });
}
