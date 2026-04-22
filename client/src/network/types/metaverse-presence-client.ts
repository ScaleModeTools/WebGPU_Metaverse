import type {
  MetaversePlayerId,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterSnapshot,
  Milliseconds,
  Username
} from "@webgpu-metaverse/shared";

export const metaversePresenceClientStates = [
  "idle",
  "joining",
  "connected",
  "error",
  "disposed"
] as const;

export type MetaversePresenceClientState =
  (typeof metaversePresenceClientStates)[number];

export interface MetaversePresenceClientConfig {
  readonly defaultPollIntervalMs: Milliseconds;
  readonly presencePath: string;
  readonly serverOrigin: string;
}

export interface MetaversePresenceJoinRequest {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly pose: Omit<MetaversePresencePoseSnapshotInput, "stateSequence">;
  readonly username: Username;
}

export interface MetaversePresenceClientStatusSnapshot {
  readonly joined: boolean;
  readonly lastError: string | null;
  readonly lastSnapshotSequence: number | null;
  readonly playerId: MetaversePlayerId | null;
  readonly state: MetaversePresenceClientState;
}

export interface MetaversePresenceSnapshotStore {
  readonly rosterSnapshot: MetaversePresenceRosterSnapshot | null;
  syncPresence: (
    pose: Omit<MetaversePresencePoseSnapshotInput, "stateSequence">
  ) => void;
}
