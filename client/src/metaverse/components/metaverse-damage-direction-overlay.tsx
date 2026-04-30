import type { CSSProperties } from "react";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaverseDamageDirectionOverlayProps {
  readonly damageIndicators: MetaverseHudSnapshot["combat"]["damageIndicators"];
  readonly hidden?: boolean;
}

const metaverseDamageOverlayTtlMs = 1_200;
const metaverseDamageOverlayCenter = 50;
const metaverseDamageOverlayRadius = 42;
const metaverseDamageOverlayHalfAngleRadians = 0.36;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function resolveDamageIndicatorFade(ageMs: number): number {
  return clamp(1 - ageMs / metaverseDamageOverlayTtlMs, 0, 1);
}

function createDamageArcPath(
  directionX: number,
  directionY: number,
  radius: number
): string | null {
  const directionLength = Math.hypot(directionX, directionY);

  if (directionLength <= 0.000001) {
    return null;
  }

  const angleRadians = Math.atan2(
    directionY / directionLength,
    directionX / directionLength
  );
  const startAngle = angleRadians - metaverseDamageOverlayHalfAngleRadians;
  const endAngle = angleRadians + metaverseDamageOverlayHalfAngleRadians;
  const startX =
    metaverseDamageOverlayCenter + Math.cos(startAngle) * radius;
  const startY =
    metaverseDamageOverlayCenter + Math.sin(startAngle) * radius;
  const endX = metaverseDamageOverlayCenter + Math.cos(endAngle) * radius;
  const endY = metaverseDamageOverlayCenter + Math.sin(endAngle) * radius;

  return `M ${startX.toFixed(3)} ${startY.toFixed(3)} A ${radius} ${radius} 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
}

function createDamageFlashStyle(
  damageIndicators: MetaverseHudSnapshot["combat"]["damageIndicators"]
): CSSProperties {
  const strongestDamageAlpha = damageIndicators.reduce((strongest, indicator) => {
    const fade = resolveDamageIndicatorFade(indicator.ageMs);

    return Math.max(strongest, fade * indicator.intensity);
  }, 0);
  const flashAlpha = clamp(strongestDamageAlpha * 0.16, 0, 0.16);
  const edgeAlpha = clamp(strongestDamageAlpha * 0.34, 0, 0.34);

  return {
    background: `radial-gradient(circle at center, rgb(220 38 38 / ${flashAlpha}) 0%, rgb(220 38 38 / ${flashAlpha * 0.58}) 44%, transparent 68%)`,
    boxShadow: `inset 0 0 7rem rgb(220 38 38 / ${edgeAlpha})`
  };
}

export function MetaverseDamageDirectionOverlay({
  damageIndicators,
  hidden = false
}: MetaverseDamageDirectionOverlayProps) {
  if (hidden || damageIndicators.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={createDamageFlashStyle(damageIndicators)}
      />
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {damageIndicators.map((indicator) => {
          const fade = resolveDamageIndicatorFade(indicator.ageMs);
          const opacity = clamp(fade * indicator.intensity, 0, 0.96);
          const path = createDamageArcPath(
            indicator.directionX,
            indicator.directionY,
            metaverseDamageOverlayRadius
          );

          if (path === null || opacity <= 0.01) {
            return null;
          }

          return (
            <path
              d={path}
              fill="none"
              key={indicator.sequence}
              opacity={opacity}
              stroke="rgb(248 113 113)"
              strokeLinecap="round"
              strokeWidth={2.8 + indicator.intensity * 4.4}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}
