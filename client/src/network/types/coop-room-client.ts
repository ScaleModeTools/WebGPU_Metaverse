import type {
  CoopPlayerId,
  CoopPlayerPresenceSnapshotInput,
  CoopRoomId,
  CoopRoomSnapshot,
  Milliseconds,
  Username,
  CoopVector3SnapshotInput
} from "@thumbshooter/shared";

export const coopRoomClientStates = [
  "idle",
  "joining",
  "connected",
  "error",
  "disposed"
] as const;

export type CoopRoomClientState = (typeof coopRoomClientStates)[number];

export interface CoopRoomClientConfig {
  readonly defaultPollIntervalMs: Milliseconds;
  readonly roomId: CoopRoomId;
  readonly roomCollectionPath: string;
  readonly serverOrigin: string;
}

export interface CoopRoomJoinRequest {
  readonly playerId: CoopPlayerId;
  readonly ready: boolean;
  readonly username: Username;
}

export interface CoopRoomClientStatusSnapshot {
  readonly joined: boolean;
  readonly lastError: string | null;
  readonly lastSnapshotTick: number | null;
  readonly playerId: CoopPlayerId | null;
  readonly roomId: CoopRoomId;
  readonly state: CoopRoomClientState;
}

export interface CoopRoomSnapshotStore {
  readonly roomSnapshot: CoopRoomSnapshot | null;
  fireShot: (
    origin: CoopVector3SnapshotInput,
    aimDirection: CoopVector3SnapshotInput
  ) => void;
  syncPlayerPresence: (
    presence: Omit<CoopPlayerPresenceSnapshotInput, "lastUpdatedTick" | "stateSequence">
  ) => void;
}
