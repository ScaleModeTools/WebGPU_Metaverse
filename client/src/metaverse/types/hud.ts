import type {
  MetaverseControlModeId
} from "./metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";
import type { MetaverseCameraSnapshot } from "./presentation";
import type { MetaverseSceneTelemetrySnapshot } from "./telemetry";
import type {
  FocusedExperiencePortalSnapshot,
  MetaverseMountedInteractionSnapshot,
  MountableBoardingEntrySnapshot,
  MountableSeatSelectionSnapshot
} from "./mounted";
import type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";
import type {
  MetaversePlayerId,
  MetaversePlayerTeamId,
  ReticleColor,
  ReticleId
} from "@webgpu-metaverse/shared";
import type {
  MetaverseRealtimePlayerWeaponAimModeId
} from "@webgpu-metaverse/shared/metaverse/realtime";

export const metaverseRuntimeLifecycleStates = [
  "idle",
  "booting",
  "running",
  "failed"
] as const;

export const metaversePresenceHudStates = [
  "disabled",
  "idle",
  "joining",
  "connected",
  "error",
  "disposed"
] as const;

export type MetaverseRuntimeLifecycleState =
  (typeof metaverseRuntimeLifecycleStates)[number];
export type MetaversePresenceHudState =
  (typeof metaversePresenceHudStates)[number];

export const metaverseBootPhaseStates = [
  "idle",
  "renderer-init",
  "scene-prewarm",
  "presence-joining",
  "world-connecting",
  "ready",
  "failed"
] as const;

export type MetaverseBootPhaseState =
  (typeof metaverseBootPhaseStates)[number];

export interface MetaverseWeaponHudSnapshot {
  readonly adsTransitionMs: number;
  readonly aimMode: MetaverseRealtimePlayerWeaponAimModeId;
  readonly reticleColor: ReticleColor;
  readonly reticleId: ReticleId;
  readonly reticleStyleId: string;
  readonly visible: boolean;
  readonly weaponId: string | null;
  readonly weaponLabel: string | null;
}

export interface MetaverseHudRadarContactSnapshot {
  readonly clamped: boolean;
  readonly distanceMeters: number;
  readonly radarX: number;
  readonly radarY: number;
  readonly teamId: MetaversePlayerTeamId;
  readonly username: string;
}

export interface MetaverseHudRadarSnapshot {
  readonly available: boolean;
  readonly enemyContacts: readonly MetaverseHudRadarContactSnapshot[];
  readonly friendlyContacts: readonly MetaverseHudRadarContactSnapshot[];
  readonly localTeamId: MetaversePlayerTeamId | null;
  readonly rangeMeters: number;
}

export interface MetaverseHudCombatFeedEntrySnapshot {
  readonly ageMs: number;
  readonly local: boolean;
  readonly sequence: number;
  readonly summary: string;
  readonly type: "damage" | "kill" | "spawn";
}

export interface MetaverseHudDamageIndicatorSnapshot {
  readonly ageMs: number;
  readonly damage: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly intensity: number;
  readonly sequence: number;
}

export interface MetaverseHudCombatScoreboardPlayerSnapshot {
  readonly accuracyRatio: number | null;
  readonly alive: boolean;
  readonly assists: number;
  readonly deaths: number;
  readonly headshotKills: number;
  readonly isLocalPlayer: boolean;
  readonly kills: number;
  readonly playerId: MetaversePlayerId;
  readonly shotsFired: number;
  readonly shotsHit: number;
  readonly teamId: MetaversePlayerTeamId;
  readonly username: string;
}

export interface MetaverseHudCombatScoreboardTeamSnapshot {
  readonly playerCount: number;
  readonly players: readonly MetaverseHudCombatScoreboardPlayerSnapshot[];
  readonly score: number;
  readonly teamId: MetaversePlayerTeamId;
}

export interface MetaverseHudCombatScoreboardSnapshot {
  readonly available: boolean;
  readonly phase: "active" | "completed" | "waiting-for-players" | null;
  readonly scoreLimit: number | null;
  readonly teams: readonly MetaverseHudCombatScoreboardTeamSnapshot[];
  readonly timeRemainingMs: number | null;
  readonly winnerTeamId: MetaversePlayerTeamId | null;
}

export interface MetaverseHudCombatSnapshot {
  readonly accuracyRatio: number | null;
  readonly alive: boolean;
  readonly ammoInMagazine: number;
  readonly ammoInReserve: number;
  readonly assists: number;
  readonly available: boolean;
  readonly deaths: number;
  readonly damageIndicators: readonly MetaverseHudDamageIndicatorSnapshot[];
  readonly enemyScore: number | null;
  readonly friendlyFireEnabled: boolean;
  readonly headshotKills: number;
  readonly health: number;
  readonly killFeed: readonly MetaverseHudCombatFeedEntrySnapshot[];
  readonly kills: number;
  readonly matchPhase: "active" | "completed" | "waiting-for-players" | null;
  readonly maxHealth: number;
  readonly reloadRemainingMs: number;
  readonly respawnRemainingMs: number;
  readonly scoreboard: MetaverseHudCombatScoreboardSnapshot;
  readonly scoreLimit: number | null;
  readonly shotsFired: number;
  readonly shotsHit: number;
  readonly spawnProtectionRemainingMs: number;
  readonly teamScore: number | null;
  readonly timeRemainingMs: number | null;
  readonly weaponId: string | null;
}

export interface MetaverseHudWeaponResourceInteractionSnapshot {
  readonly distanceMeters: number;
  readonly weaponId: string;
}

export interface MetaverseHudInteractionSnapshot {
  readonly weaponResource: MetaverseHudWeaponResourceInteractionSnapshot | null;
}

export interface MetaverseHudSnapshot {
  readonly boot: {
    readonly authoritativeWorldConnected: boolean;
    readonly phase: MetaverseBootPhaseState;
    readonly presenceJoined: boolean;
    readonly rendererInitialized: boolean;
    readonly scenePrewarmed: boolean;
  };
  readonly camera: MetaverseCameraSnapshot;
  readonly controlMode: MetaverseControlModeId;
  readonly combat: MetaverseHudCombatSnapshot;
  readonly failureReason: string | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly lifecycle: MetaverseRuntimeLifecycleState;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly mountedInteractionHud: MetaverseMountedInteractionHudSnapshot;
  readonly interaction: MetaverseHudInteractionSnapshot;
  readonly presence: {
    readonly joined: boolean;
    readonly lastError: string | null;
    readonly localTeamId: MetaversePlayerTeamId | null;
    readonly remotePlayerCount: number;
    readonly state: MetaversePresenceHudState;
  };
  readonly radar: MetaverseHudRadarSnapshot;
  readonly telemetry: MetaverseSceneTelemetrySnapshot;
  readonly transport: {
    readonly presenceReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldDriverDatagram: RealtimeDatagramTransportStatusSnapshot;
    readonly worldReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldSnapshotStream: MetaverseWorldSnapshotStreamTelemetrySnapshot;
  };
  readonly weapon: MetaverseWeaponHudSnapshot;
}

export interface MetaverseMountedInteractionHudSnapshot {
  readonly boardingEntries: readonly MountableBoardingEntrySnapshot[];
  readonly detail: string | null;
  readonly heading: string | null;
  readonly leaveActionLabel: string | null;
  readonly seatTargetButtonVariant: "default" | "outline";
  readonly seatTargets: readonly MountableSeatSelectionSnapshot[];
  readonly visible: boolean;
}
