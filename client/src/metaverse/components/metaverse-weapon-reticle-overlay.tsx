import type { CSSProperties } from "react";

import { resolveMetaverseWeaponReticleStyleConfig } from "../config/metaverse-weapon-reticle-styles";
import type { MetaverseWeaponHudSnapshot } from "../types/metaverse-runtime";

interface MetaverseWeaponReticleOverlayProps {
  readonly hidden?: boolean;
  readonly weaponHudSnapshot: MetaverseWeaponHudSnapshot;
}

function resolveReticleColor(color: MetaverseWeaponHudSnapshot["reticleColor"]): string {
  switch (color) {
    case "red":
      return "#ff5757";
    case "white":
    default:
      return "#f8fafc";
  }
}

function ReticleSvg({
  className,
  shape
}: {
  readonly className?: string;
  readonly shape: ReturnType<typeof resolveMetaverseWeaponReticleStyleConfig>["shape"];
}) {
  switch (shape) {
    case "dot":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="currentColor" r="5.5" />
          <circle cx="50" cy="50" r="20" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.5" />
        </svg>
      );
    case "spread":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="6" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" />
          <path d="M50 8v14M50 78v14M8 50h14M78 50h14M24 24l10 10M66 66l10 10M24 76l10-10M66 34l10-10" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        </svg>
      );
    case "crosshair":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="15" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.5" />
          <path d="M50 8v18M50 74v18M8 50h18M74 50h18" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
          <circle cx="50" cy="50" fill="currentColor" r="2.75" />
        </svg>
      );
    case "scope":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="34" stroke="currentColor" strokeOpacity="0.85" strokeWidth="2.5" />
          <path d="M50 8v84M8 50h84" stroke="currentColor" strokeOpacity="0.72" strokeWidth="2" />
          <circle cx="50" cy="50" fill="currentColor" r="2.25" />
          <circle cx="50" cy="50" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        </svg>
      );
    case "bracket":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <path d="M24 18H10v14M76 18h14v14M24 82H10V68M76 82h14V68" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          <circle cx="50" cy="50" r="10" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.25" />
        </svg>
      );
    case "smart-link":
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <path d="M50 18l7 7-7 7-7-7 7-7ZM18 50l7-7 7 7-7 7-7-7ZM50 82l-7-7 7-7 7 7-7 7ZM82 50l-7 7-7-7 7-7 7 7Z" fill="currentColor" fillOpacity="0.75" />
          <circle cx="50" cy="50" r="18" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.25" />
          <circle cx="50" cy="50" fill="currentColor" r="3.25" />
        </svg>
      );
    case "ring":
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="24" stroke="currentColor" strokeWidth="3.25" />
          <circle cx="50" cy="50" fill="currentColor" r="2.75" />
        </svg>
      );
  }
}

export function MetaverseWeaponReticleOverlay({
  hidden = false,
  weaponHudSnapshot
}: MetaverseWeaponReticleOverlayProps) {
  if (hidden || !weaponHudSnapshot.visible) {
    return null;
  }

  const reticleStyle = resolveMetaverseWeaponReticleStyleConfig(
    weaponHudSnapshot.reticleStyleId
  );
  const scale =
    weaponHudSnapshot.aimMode === "ads"
      ? reticleStyle.adsScale
      : reticleStyle.hipScale;
  const reticleStyleVariables = {
    "--weapon-reticle-color": resolveReticleColor(weaponHudSnapshot.reticleColor),
    "--weapon-reticle-duration": `${weaponHudSnapshot.adsTransitionMs}ms`,
    "--weapon-reticle-scale": `${scale}`,
    "--weapon-reticle-size": `${reticleStyle.sizePx}px`
  } as CSSProperties;
  const showScopeShade = reticleStyle.shape === "scope";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {showScopeShade ? (
        <div
          className={[
            "absolute inset-0 transition-opacity ease-out",
            weaponHudSnapshot.aimMode === "ads" ? "opacity-100" : "opacity-0"
          ].join(" ")}
          style={{
            background:
              "radial-gradient(circle at center, transparent 0 12%, rgb(2 6 23 / 0.18) 22%, rgb(2 6 23 / 0.72) 100%)",
            transitionDuration: `${weaponHudSnapshot.adsTransitionMs}ms`
          }}
        />
      ) : null}

      <div className="absolute inset-0 flex items-center justify-center" style={reticleStyleVariables}>
        <div
          className="relative h-[var(--weapon-reticle-size)] w-[var(--weapon-reticle-size)] text-[color:var(--weapon-reticle-color)] drop-shadow-[0_0_16px_rgb(255_255_255_/_0.2)] transition-[transform,opacity] ease-out"
          style={{
            opacity: weaponHudSnapshot.aimMode === "ads" ? 1 : 0.92,
            transform: "scale(var(--weapon-reticle-scale))",
            transitionDuration: "var(--weapon-reticle-duration)"
          }}
        >
          <ReticleSvg className="h-full w-full" shape={reticleStyle.shape} />
        </div>
      </div>
    </div>
  );
}
