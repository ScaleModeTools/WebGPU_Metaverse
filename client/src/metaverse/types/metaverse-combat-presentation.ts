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
  | "authoritative-fire-event"
  | "authoritative-projectile"
  | "authoritative-projectile-resolution"
  | "authoritative-shot-resolution";

export type MetaverseCombatPresentationShotFx =
  | "muzzle-only"
  | "pistol-world-impact"
  | "pistol-tracer"
  | "rocket-muzzle";

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

export interface MetaverseCombatPresentationEvent {
  readonly actionSequence?: number | null;
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
  readonly kind: MetaverseCombatPresentationEventKind;
  readonly originWorld?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly playerId: string;
  readonly projectileId?: string | null;
  readonly sequence: number;
  readonly shotFx?: MetaverseCombatPresentationShotFx | null;
  readonly source?: MetaverseCombatPresentationEventSource | null;
  readonly startedAtMs: number;
  readonly visualKey?: string | null;
  readonly weaponId: string | null;
}

export type MetaverseCombatAudioCuePlayer = (
  cueId: MetaverseCombatAudioCueId,
  options?: AudioCuePlaybackOptions
) => void;
