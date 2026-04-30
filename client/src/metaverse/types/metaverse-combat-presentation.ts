import type {
  MetaverseCombatHitZoneId,
  MetaverseCombatImpactSurfaceSnapshot
} from "@webgpu-metaverse/shared";

import type { AudioCuePlaybackOptions } from "../../audio";
import type { MetaverseCombatAudioCueId } from "../audio";

export const metaverseCombatPresentationEventKinds = [
  "shot",
  "projectile-impact",
  "hit",
  "death"
] as const;

export type MetaverseCombatPresentationEventKind =
  (typeof metaverseCombatPresentationEventKinds)[number];

export type MetaverseCombatPresentationEventSource =
  | "authoritative-projectile"
  | "authoritative-projectile-resolution"
  | "authoritative-shot-resolution";

export type MetaverseCombatPresentationShotFx =
  | "pistol-world-impact"
  | "pistol-tracer"
  | "rocket-muzzle";

export type MetaverseCombatPresentationImpactFx =
  | "rocket-explosion"
  | "world-impact";

export interface MetaverseRenderedWeaponMuzzleQuery {
  readonly playerId: string;
  readonly role: "projectile.muzzle";
  readonly slotId?: string | null;
  readonly weaponId: string;
  readonly weaponInstanceId?: string | null;
}

export interface MetaverseRenderedWeaponMuzzleFrame {
  readonly forwardWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly originWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly playerId: string;
  readonly sampledAtRenderFrame: number;
  readonly source: "rendered-projectile-muzzle";
  readonly weaponId: string;
  readonly weaponInstanceId?: string | null;
}

export type MetaverseRenderedWeaponMuzzleResolver = (
  query: MetaverseRenderedWeaponMuzzleQuery
) => MetaverseRenderedWeaponMuzzleFrame | null;

interface MetaverseCombatPresentationEventBase {
  readonly actionSequence?: number | null;
  readonly authoritativeTimeMs?: number | null;
  readonly damageAmount?: number | null;
  readonly damageSourceDirectionWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly directionWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly endWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly hitZone?: MetaverseCombatHitZoneId | null;
  readonly impactNormalWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly impactSurface?: MetaverseCombatImpactSurfaceSnapshot | null;
  readonly kind: MetaverseCombatPresentationEventKind;
  readonly originWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly playerId: string;
  readonly projectileId?: string | null;
  readonly sequence: number;
  readonly source?: MetaverseCombatPresentationEventSource | null;
  readonly startedAtMs: number;
  readonly targetPlayerId?: string | null;
  readonly weaponId: string | null;
}

export interface MetaverseCombatPresentationShotEvent
  extends MetaverseCombatPresentationEventBase {
  readonly kind: "shot";
  readonly shotFx: MetaverseCombatPresentationShotFx;
  readonly visualKey: string;
}

export interface MetaverseCombatPresentationProjectileImpactEvent
  extends MetaverseCombatPresentationEventBase {
  readonly impactFx: MetaverseCombatPresentationImpactFx;
  readonly kind: "projectile-impact";
  readonly projectileId: string;
  readonly visualKey: string;
}

export interface MetaverseCombatPresentationHitEvent
  extends MetaverseCombatPresentationEventBase {
  readonly kind: "hit";
  readonly visualKey?: string | null;
}

export interface MetaverseCombatPresentationDeathEvent
  extends MetaverseCombatPresentationEventBase {
  readonly kind: "death";
  readonly visualKey?: string | null;
}

export type MetaverseCombatPresentationEvent =
  | MetaverseCombatPresentationDeathEvent
  | MetaverseCombatPresentationHitEvent
  | MetaverseCombatPresentationProjectileImpactEvent
  | MetaverseCombatPresentationShotEvent;

export type MetaverseCombatAudioCuePlayer = (
  cueId: MetaverseCombatAudioCueId,
  options?: AudioCuePlaybackOptions
) => void;
