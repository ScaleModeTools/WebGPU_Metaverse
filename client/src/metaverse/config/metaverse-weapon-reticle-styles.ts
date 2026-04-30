export type MetaverseWeaponReticleShapeId =
  | "ring"
  | "dot"
  | "spread"
  | "crosshair"
  | "scope"
  | "bracket"
  | "smart-link";

export interface MetaverseWeaponReticleStyleConfig {
  readonly adsScale: number;
  readonly hipScale: number;
  readonly scopedAdsOverlay: boolean;
  readonly shape: MetaverseWeaponReticleShapeId;
  readonly sizePx: number;
}

const defaultWeaponReticleStyleConfig = Object.freeze({
  adsScale: 1,
  hipScale: 1.28,
  scopedAdsOverlay: false,
  shape: "ring",
  sizePx: 42
} satisfies MetaverseWeaponReticleStyleConfig);

export const metaverseWeaponReticleStyles = Object.freeze({
  "battle-rifle-dot": Object.freeze({
    adsScale: 1,
    hipScale: 1.34,
    scopedAdsOverlay: true,
    shape: "crosshair",
    sizePx: 54
  } satisfies MetaverseWeaponReticleStyleConfig),
  "combat-2x": Object.freeze({
    adsScale: 1,
    hipScale: 1.18,
    scopedAdsOverlay: true,
    shape: "scope",
    sizePx: 30
  } satisfies MetaverseWeaponReticleStyleConfig),
  "pistol-ring": Object.freeze({
    adsScale: 1,
    hipScale: 1.22,
    scopedAdsOverlay: false,
    shape: "ring",
    sizePx: 40
  } satisfies MetaverseWeaponReticleStyleConfig),
  "red-dot": Object.freeze({
    adsScale: 1,
    hipScale: 1.16,
    scopedAdsOverlay: false,
    shape: "dot",
    sizePx: 28
  } satisfies MetaverseWeaponReticleStyleConfig),
  "rocket-lock-bracket": Object.freeze({
    adsScale: 1,
    hipScale: 1.12,
    scopedAdsOverlay: true,
    shape: "bracket",
    sizePx: 58
  } satisfies MetaverseWeaponReticleStyleConfig),
  "scope-4x": Object.freeze({
    adsScale: 1,
    hipScale: 1.12,
    scopedAdsOverlay: true,
    shape: "scope",
    sizePx: 24
  } satisfies MetaverseWeaponReticleStyleConfig),
  "scope-6x-variable": Object.freeze({
    adsScale: 1,
    hipScale: 1.08,
    scopedAdsOverlay: true,
    shape: "scope",
    sizePx: 22
  } satisfies MetaverseWeaponReticleStyleConfig),
  "shotgun-spread": Object.freeze({
    adsScale: 1,
    hipScale: 1.36,
    scopedAdsOverlay: false,
    shape: "spread",
    sizePx: 64
  } satisfies MetaverseWeaponReticleStyleConfig),
  "smart-link-lock": Object.freeze({
    adsScale: 1,
    hipScale: 1.08,
    scopedAdsOverlay: false,
    shape: "smart-link",
    sizePx: 52
  } satisfies MetaverseWeaponReticleStyleConfig),
  "smg-dot": Object.freeze({
    adsScale: 1,
    hipScale: 1.3,
    scopedAdsOverlay: false,
    shape: "dot",
    sizePx: 46
  } satisfies MetaverseWeaponReticleStyleConfig),
  "sniper-mil-dot": Object.freeze({
    adsScale: 1,
    hipScale: 1.08,
    scopedAdsOverlay: true,
    shape: "scope",
    sizePx: 20
  } satisfies MetaverseWeaponReticleStyleConfig)
} satisfies Record<string, MetaverseWeaponReticleStyleConfig>);

export function resolveMetaverseWeaponReticleStyleConfig(
  reticleStyleId: string
): MetaverseWeaponReticleStyleConfig {
  return Object.hasOwn(metaverseWeaponReticleStyles, reticleStyleId)
    ? metaverseWeaponReticleStyles[
        reticleStyleId as keyof typeof metaverseWeaponReticleStyles
      ]
    : defaultWeaponReticleStyleConfig;
}
