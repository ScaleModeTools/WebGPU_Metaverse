import type {
  CoopSyncPlayerPresenceCommand,
  DuckHuntCoopRoomWebTransportPlayerPresenceDatagram
} from "@webgpu-metaverse/shared";
import {
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram
} from "@webgpu-metaverse/shared";

import { LatestWinsWebTransportJsonDatagramChannel } from "./latest-wins-webtransport-json-datagram-channel";
import type { DuckHuntCoopRoomPlayerPresenceDatagramTransport } from "../types/duck-hunt-coop-room-player-presence-datagram-transport";

interface DuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransportConfig {
  readonly webTransportUrl: string;
}

interface DuckHuntCoopRoomPlayerPresenceWebTransportDatagramChannel {
  dispose(): void;
  sendDatagram(
    datagram: DuckHuntCoopRoomWebTransportPlayerPresenceDatagram
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

interface DuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransportDependencies {
  readonly channel?: DuckHuntCoopRoomPlayerPresenceWebTransportDatagramChannel;
  readonly webTransportFactory?: (url: string) => WebTransportLike;
}

export function createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport(
  config: DuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransportConfig,
  dependencies: DuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransportDependencies = {}
): DuckHuntCoopRoomPlayerPresenceDatagramTransport {
  const channel =
    dependencies.channel ??
    new LatestWinsWebTransportJsonDatagramChannel<DuckHuntCoopRoomWebTransportPlayerPresenceDatagram>(
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
    async sendPlayerPresenceDatagram(
      command: CoopSyncPlayerPresenceCommand
    ): Promise<void> {
      await channel.sendDatagram(
        createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
          command
        })
      );
    }
  });
}
