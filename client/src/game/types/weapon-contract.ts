import type { Milliseconds } from "@webgpu-metaverse/shared";

import type {
  FirstPlayableWeaponId,
  TriggerGestureMode,
  WeaponReloadRule
} from "./game-foundation";
import type { HandTriggerGestureConfig } from "../../tracking";

export const weaponReadinessStates = [
  "ready",
  "tracking-unavailable",
  "round-paused",
  "trigger-reset-required",
  "cooldown",
  "reload-required",
  "reloading"
] as const;
export const weaponReloadStates = ["full", "blocked", "reloading"] as const;

export type WeaponReadinessState = (typeof weaponReadinessStates)[number];
export type WeaponReloadState = (typeof weaponReloadStates)[number];

export interface WeaponCadenceConfig {
  readonly shotIntervalMs: Milliseconds;
}

export interface WeaponReloadConfig {
  readonly clipCapacity: number;
  readonly durationMs: Milliseconds;
  readonly rule: WeaponReloadRule;
}

export interface WeaponSpreadConfig {
  readonly baseRadius: number;
  readonly maxRadius: number;
  readonly sprayGrowthPerShot: number;
  readonly sprayRecoveryPerSecond: number;
}

export interface WeaponDefinition {
  readonly cadence: WeaponCadenceConfig;
  readonly displayName: string;
  readonly reload: WeaponReloadConfig;
  readonly spread: WeaponSpreadConfig;
  readonly triggerGesture: HandTriggerGestureConfig;
  readonly triggerMode: TriggerGestureMode;
  readonly weaponId: FirstPlayableWeaponId;
}

export interface WeaponReloadSnapshot {
  readonly clipCapacity: number;
  readonly clipRoundsRemaining: number;
  readonly isReloadReady: boolean;
  readonly reloadRemainingMs: Milliseconds;
  readonly requiresReload: boolean;
  readonly rule: WeaponReloadRule;
  readonly state: WeaponReloadState;
}

export interface WeaponHudSnapshot {
  readonly cooldownRemainingMs: Milliseconds;
  readonly hitsLanded: number;
  readonly readiness: WeaponReadinessState;
  readonly reload: WeaponReloadSnapshot;
  readonly shotsFired: number;
  readonly triggerHeld: boolean;
  readonly weaponId: FirstPlayableWeaponId;
}
