import type {
  MetaverseControlModeId
} from "./metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "./metaverse-locomotion-mode";
import type { MetaverseCameraSnapshot } from "./presentation";
import type { MetaverseTelemetrySnapshot } from "./telemetry";
import type {
  FocusedExperiencePortalSnapshot,
  FocusedMountableSnapshot,
  MountedEnvironmentSnapshot
} from "./mounted";
import type {
  MetaverseWorldSnapshotStreamTelemetrySnapshot,
  RealtimeDatagramTransportStatusSnapshot,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";

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
  readonly focusedMountable: FocusedMountableSnapshot | null;
  readonly focusedPortal: FocusedExperiencePortalSnapshot | null;
  readonly lifecycle: MetaverseRuntimeLifecycleState;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedEnvironment: MountedEnvironmentSnapshot | null;
  readonly presence: {
    readonly joined: boolean;
    readonly lastError: string | null;
    readonly remotePlayerCount: number;
    readonly state: MetaversePresenceHudState;
  };
  readonly telemetry: MetaverseTelemetrySnapshot;
  readonly transport: {
    readonly presenceReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldDriverDatagram: RealtimeDatagramTransportStatusSnapshot;
    readonly worldReliable: RealtimeReliableTransportStatusSnapshot;
    readonly worldSnapshotStream: MetaverseWorldSnapshotStreamTelemetrySnapshot;
  };
}
