import type {
  MetaversePlayerId,
  MetaverseRealtimeWorldSnapshot,
  MetaverseSyncDriverVehicleControlCommandInput,
  MetaverseSyncMountedOccupancyCommandInput,
  MetaverseSyncPlayerLookIntentCommandInput,
  MetaverseSyncPlayerWeaponStateCommandInput,
  MetaverseSyncPlayerTraversalIntentCommandInput
} from "@webgpu-metaverse/shared";

import type {
  MetaverseWorldClientStatusSnapshot,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";
import type { MetaversePlayerIssuedTraversalIntentSnapshot } from "./metaverse-player-issued-traversal-intent";

export interface MetaverseWorldClientRuntime {
  readonly currentPollIntervalMs: number;
  readonly driverVehicleControlDatagramStatusSnapshot: RealtimeDatagramTransportStatusSnapshot;
  readonly latestAcceptedSnapshotReceivedAtMs: number | null;
  readonly latestPlayerTraversalSequence: number;
  readonly latestPlayerIssuedTraversalIntentSnapshot:
    | MetaversePlayerIssuedTraversalIntentSnapshot
    | null;
  readonly latestPlayerLookSequence: number;
  readonly latestPlayerWeaponSequence: number;
  readonly reliableTransportStatusSnapshot: RealtimeReliableTransportStatusSnapshot;
  readonly statusSnapshot: MetaverseWorldClientStatusSnapshot;
  readonly telemetrySnapshot: MetaverseWorldClientTelemetrySnapshot;
  readonly worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[];
  ensureConnected(
    playerId: MetaversePlayerId
  ): Promise<MetaverseRealtimeWorldSnapshot>;
  syncDriverVehicleControl(
    commandInput: MetaverseSyncDriverVehicleControlCommandInput | null
  ): void;
  syncMountedOccupancy(
    commandInput: MetaverseSyncMountedOccupancyCommandInput
  ): void;
  syncPlayerLookIntent(
    commandInput: MetaverseSyncPlayerLookIntentCommandInput | null
  ): void;
  syncPlayerWeaponState(
    commandInput: MetaverseSyncPlayerWeaponStateCommandInput | null
  ): void;
  syncPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null;
  previewPlayerTraversalIntent(
    commandInput: MetaverseSyncPlayerTraversalIntentCommandInput | null
  ): MetaversePlayerIssuedTraversalIntentSnapshot | null;
  subscribeUpdates(listener: () => void): () => void;
  dispose(): void;
}

export type {
  MetaverseWorldClientStatusSnapshot,
  MetaverseWorldClientTelemetrySnapshot,
  MetaverseWorldSnapshotStreamTelemetrySnapshot
};
