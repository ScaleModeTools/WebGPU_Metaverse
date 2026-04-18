import type {
  MetaversePlayerId,
  MetaverseRealtimeWorldSnapshot,
  Milliseconds
} from "@webgpu-metaverse/shared";

export const metaverseWorldClientStates = [
  "idle",
  "connecting",
  "connected",
  "error",
  "disposed"
] as const;

export type MetaverseWorldClientState =
  (typeof metaverseWorldClientStates)[number];

export const metaverseWorldSnapshotPaths = [
  "http-polling",
  "reliable-snapshot-stream",
  "fallback-polling"
] as const;

export type MetaverseWorldSnapshotPath =
  (typeof metaverseWorldSnapshotPaths)[number];

export const metaverseWorldSnapshotStreamLivenessStates = [
  "inactive",
  "subscribed",
  "reconnecting",
  "fallback-polling"
] as const;

export type MetaverseWorldSnapshotStreamLiveness =
  (typeof metaverseWorldSnapshotStreamLivenessStates)[number];

export interface MetaverseWorldClientConfig {
  readonly defaultCommandIntervalMs: Milliseconds;
  readonly defaultPollIntervalMs: Milliseconds;
  readonly maxBufferedSnapshots: number;
  readonly serverOrigin: string;
  readonly snapshotStreamReconnectDelayMs: Milliseconds;
  readonly worldCommandPath: string;
  readonly worldPath: string;
}

export interface MetaverseWorldClientStatusSnapshot {
  readonly connected: boolean;
  readonly lastError: string | null;
  readonly lastSnapshotSequence: number | null;
  readonly lastWorldTick: number | null;
  readonly playerId: MetaversePlayerId | null;
  readonly state: MetaverseWorldClientState;
}

export interface MetaverseWorldSnapshotStreamTelemetrySnapshot {
  readonly available: boolean;
  readonly fallbackActive: boolean;
  readonly lastTransportError: string | null;
  readonly liveness: MetaverseWorldSnapshotStreamLiveness;
  readonly path: MetaverseWorldSnapshotPath;
  readonly reconnectCount: number;
}

export interface MetaverseWorldClientTelemetrySnapshot {
  readonly driverVehicleControlDatagramSendFailureCount: number;
  readonly latestSnapshotUpdateRateHz: number | null;
  readonly playerLookInputDatagramSendFailureCount: number;
  readonly playerTraversalInputDatagramSendFailureCount: number;
  readonly snapshotStream: MetaverseWorldSnapshotStreamTelemetrySnapshot;
}

export interface MetaverseWorldSnapshotStore {
  readonly worldSnapshotBuffer: readonly MetaverseRealtimeWorldSnapshot[];
}
