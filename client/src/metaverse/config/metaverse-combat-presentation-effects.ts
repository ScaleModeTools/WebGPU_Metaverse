import type { MetaverseCombatProjectileResolutionId } from "@webgpu-metaverse/shared";

import type { MetaverseCombatAudioCueId } from "../audio";
import type {
  MetaverseCombatPresentationImpactFx,
  MetaverseCombatPresentationShotFx
} from "../types/metaverse-runtime";

interface MetaverseCombatProjectileImpactPresentationEffect {
  readonly audioCueId: MetaverseCombatAudioCueId;
  readonly impactFx: MetaverseCombatPresentationImpactFx;
}

interface MetaverseCombatWeaponPresentationEffects {
  readonly hitscanWorldImpactFx?: MetaverseCombatPresentationShotFx | null;
  readonly projectileImpactByResolution?: Partial<
    Record<
      Extract<MetaverseCombatProjectileResolutionId, "hit-player" | "hit-world">,
      MetaverseCombatProjectileImpactPresentationEffect
    >
  >;
  readonly shotAudioCueId: MetaverseCombatAudioCueId;
  readonly shotFxByDeliveryModel: Partial<
    Record<
      "authoritative-projectile" | "hitscan-tracer",
      MetaverseCombatPresentationShotFx
    >
  >;
}

function createHitscanWeaponPresentationEffects(): MetaverseCombatWeaponPresentationEffects {
  return Object.freeze({
    hitscanWorldImpactFx: "pistol-world-impact",
    shotAudioCueId: "metaverse-pistol-shot",
    shotFxByDeliveryModel: Object.freeze({
      "hitscan-tracer": "pistol-tracer"
    })
  });
}

const metaverseCombatWeaponPresentationEffectsByWeaponId = new Map<
  string,
  MetaverseCombatWeaponPresentationEffects
>([
  [
    "metaverse-rocket-launcher-v1",
    Object.freeze({
      projectileImpactByResolution: Object.freeze({
        "hit-player": Object.freeze({
          audioCueId: "metaverse-rocket-explosion",
          impactFx: "rocket-explosion"
        }),
        "hit-world": Object.freeze({
          audioCueId: "metaverse-rocket-explosion",
          impactFx: "rocket-explosion"
        })
      }),
      shotAudioCueId: "metaverse-rocket-launch",
      shotFxByDeliveryModel: Object.freeze({
        "authoritative-projectile": "rocket-muzzle"
      })
    } satisfies MetaverseCombatWeaponPresentationEffects)
  ],
  [
    "metaverse-service-pistol-v2",
    Object.freeze({
      projectileImpactByResolution: Object.freeze({
        "hit-world": Object.freeze({
          audioCueId: "metaverse-world-impact",
          impactFx: "world-impact"
        })
      }),
      shotAudioCueId: "metaverse-pistol-shot",
      shotFxByDeliveryModel: Object.freeze({
        "hitscan-tracer": "pistol-tracer"
      }),
      hitscanWorldImpactFx: "pistol-world-impact"
    } satisfies MetaverseCombatWeaponPresentationEffects)
  ],
  ["metaverse-compact-smg-v1", createHitscanWeaponPresentationEffects()],
  ["metaverse-battle-rifle-v1", createHitscanWeaponPresentationEffects()],
  ["metaverse-breacher-shotgun-v1", createHitscanWeaponPresentationEffects()],
  ["metaverse-longshot-sniper-v1", createHitscanWeaponPresentationEffects()]
]);

function readMetaverseCombatWeaponPresentationEffects(
  weaponId: string
): MetaverseCombatWeaponPresentationEffects | null {
  return (
    metaverseCombatWeaponPresentationEffectsByWeaponId.get(weaponId) ?? null
  );
}

export function readMetaverseCombatShotAudioCueId(
  weaponId: string
): MetaverseCombatAudioCueId | null {
  return (
    readMetaverseCombatWeaponPresentationEffects(weaponId)?.shotAudioCueId ?? null
  );
}

export function readMetaverseCombatShotFx(input: {
  readonly presentationDeliveryModel:
    | "authoritative-projectile"
    | "hitscan-tracer";
  readonly weaponId: string;
}): MetaverseCombatPresentationShotFx | null {
  return (
    readMetaverseCombatWeaponPresentationEffects(input.weaponId)
      ?.shotFxByDeliveryModel[input.presentationDeliveryModel] ?? null
  );
}

export function readMetaverseCombatHitscanWorldImpactFx(
  weaponId: string
): MetaverseCombatPresentationShotFx | null {
  return (
    readMetaverseCombatWeaponPresentationEffects(weaponId)
      ?.hitscanWorldImpactFx ?? null
  );
}

export function readMetaverseCombatProjectileImpactPresentationEffect(input: {
  readonly resolutionKind: MetaverseCombatProjectileResolutionId;
  readonly weaponId: string;
}): MetaverseCombatProjectileImpactPresentationEffect | null {
  if (
    input.resolutionKind !== "hit-player" &&
    input.resolutionKind !== "hit-world"
  ) {
    return null;
  }

  return (
    readMetaverseCombatWeaponPresentationEffects(input.weaponId)
      ?.projectileImpactByResolution?.[input.resolutionKind] ?? null
  );
}
