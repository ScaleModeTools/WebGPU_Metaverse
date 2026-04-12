import type { CoopSyncPlayerPresenceCommand } from "@webgpu-metaverse/shared";

export interface DuckHuntCoopRoomPlayerPresenceDatagramTransport {
  dispose?(): void;
  sendPlayerPresenceDatagram(
    command: CoopSyncPlayerPresenceCommand
  ): Promise<void>;
}
