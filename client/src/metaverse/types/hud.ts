import type {
  MetaverseControlModeId
} from "./metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";
import type { MetaverseCameraSnapshot } from "./presentation";
import type { MetaverseTelemetrySnapshot } from "./telemetry";
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
  readonly enemyPingAgeMs: number | null;
  readonly enemyPingIntervalMs: number;
  readonly friendlyContacts: readonly MetaverseHudRadarContactSnapshot[];
  readonly localTeamId: MetaversePlayerTeamId | null;
  readonly rangeMeters: number;
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
  readonly failureReason: string | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly lifecycle: MetaverseRuntimeLifecycleState;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedInteraction: MetaverseMountedInteractionSnapshot;
  readonly mountedInteractionHud: MetaverseMountedInteractionHudSnapshot;
  readonly presence: {
    readonly joined: boolean;
    readonly lastError: string | null;
    readonly localTeamId: MetaversePlayerTeamId | null;
    readonly remotePlayerCount: number;
    readonly state: MetaversePresenceHudState;
  };
  readonly radar: MetaverseHudRadarSnapshot;
  readonly telemetry: MetaverseTelemetrySnapshot;
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
