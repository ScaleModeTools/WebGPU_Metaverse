import type {
  CoopPlayerId,
  CoopPlayerPresenceSnapshotInput,
  CoopRoomId,
  CoopRoomSnapshot,
  Milliseconds,
  CoopVector3SnapshotInput
} from "@webgpu-metaverse/shared";

import type { AuthoritativeServerClockConfig } from "../../../network";
import type { LocalArenaSimulationConfig } from "./duck-hunt-local-arena-simulation";
import type { WeaponDefinition } from "./duck-hunt-weapon-contract";

export interface CoopArenaSimulationConfig {
  readonly camera: LocalArenaSimulationConfig["camera"];
  readonly feedback: {
    readonly holdDurationMs: Milliseconds;
  };
  readonly projection: {
    readonly interpolationDelayMs: number;
    readonly maxExtrapolationMs: number;
  };
  readonly serverClock: AuthoritativeServerClockConfig;
  readonly targeting: {
    readonly acquireRadius: number;
  };
  readonly weapon: WeaponDefinition;
}

export interface CoopArenaRoomSource {
  readonly roomId: CoopRoomId;
  readonly roomSnapshotBuffer?: readonly CoopRoomSnapshot[];
  readonly roomSnapshot: CoopRoomSnapshot | null;
  fireShot: (
    origin: CoopVector3SnapshotInput,
    aimDirection: CoopVector3SnapshotInput,
    options?: {
      readonly clientEstimatedSimulationTimeMs?: number;
      readonly weaponId?: string;
    }
  ) => void;
  syncPlayerPresence: (
    presence: Omit<CoopPlayerPresenceSnapshotInput, "lastUpdatedTick" | "stateSequence">
  ) => void;
}

export interface CoopArenaLocalIdentity {
  readonly playerId: CoopPlayerId;
}
