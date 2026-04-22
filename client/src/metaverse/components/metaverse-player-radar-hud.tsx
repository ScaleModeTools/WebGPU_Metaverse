import type { MetaversePlayerTeamId } from "@webgpu-metaverse/shared";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaversePlayerRadarHudProps {
  readonly radarSnapshot: MetaverseHudSnapshot["radar"];
}

const radarViewSize = 160;
const radarCenter = radarViewSize / 2;
const radarRadius = 68;

function resolveMetaversePlayerTeamAccent(teamId: MetaversePlayerTeamId): {
  readonly fill: string;
  readonly glow: string;
  readonly stroke: string;
} {
  switch (teamId) {
    case "red":
      return Object.freeze({
        fill: "#fb7185",
        glow: "rgba(251, 113, 133, 0.45)",
        stroke: "#fda4af"
      });
    case "blue":
      return Object.freeze({
        fill: "#38bdf8",
        glow: "rgba(56, 189, 248, 0.42)",
        stroke: "#7dd3fc"
      });
    default: {
      const exhaustiveCheck: never = teamId;
      throw new Error(`Unsupported metaverse radar team: ${exhaustiveCheck}`);
    }
  }
}

export function MetaversePlayerRadarHud({
  radarSnapshot
}: MetaversePlayerRadarHudProps) {
  const pulseProgress =
    radarSnapshot.enemyPingAgeMs === null
      ? 1
      : Math.min(radarSnapshot.enemyPingAgeMs / radarSnapshot.enemyPingIntervalMs, 1);
  const pulseRadius = radarRadius * pulseProgress;
  const pulseOpacity =
    radarSnapshot.enemyPingAgeMs === null ? 0 : Math.max(0, 0.32 - pulseProgress * 0.26);

  return (
    <svg
      aria-label="Player radar"
      className="h-auto w-full max-w-[13rem]"
      viewBox={`0 0 ${radarViewSize} ${radarViewSize}`}
    >
      <defs>
        <filter id="metaverse-radar-contact-glow">
          <feGaussianBlur result="blur" stdDeviation="2" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx={radarCenter}
        cy={radarCenter}
        fill="rgba(15, 23, 42, 0.78)"
        r={radarRadius}
        stroke="rgba(148, 163, 184, 0.22)"
        strokeWidth="1.2"
      />
      <circle
        cx={radarCenter}
        cy={radarCenter}
        fill="none"
        r={radarRadius * 0.66}
        stroke="rgba(148, 163, 184, 0.14)"
        strokeWidth="1"
      />
      <circle
        cx={radarCenter}
        cy={radarCenter}
        fill="none"
        r={radarRadius * 0.33}
        stroke="rgba(148, 163, 184, 0.12)"
        strokeWidth="1"
      />
      <path
        d={`M ${radarCenter} ${radarCenter - radarRadius} L ${radarCenter} ${radarCenter + radarRadius}`}
        stroke="rgba(148, 163, 184, 0.12)"
        strokeWidth="1"
      />
      <path
        d={`M ${radarCenter - radarRadius} ${radarCenter} L ${radarCenter + radarRadius} ${radarCenter}`}
        stroke="rgba(148, 163, 184, 0.12)"
        strokeWidth="1"
      />

      {pulseOpacity > 0 ? (
        <circle
          cx={radarCenter}
          cy={radarCenter}
          fill="none"
          r={pulseRadius}
          stroke="rgba(248, 113, 113, 0.7)"
          strokeOpacity={pulseOpacity}
          strokeWidth="1.6"
        />
      ) : null}

      {radarSnapshot.friendlyContacts.map((contact) => {
        const accent = resolveMetaversePlayerTeamAccent(contact.teamId);

        return (
          <g
            key={`friendly-${contact.username}`}
            filter="url(#metaverse-radar-contact-glow)"
          >
            <title>{`${contact.username} · ${contact.distanceMeters.toFixed(0)}m`}</title>
            <circle
              cx={radarCenter + contact.radarX * radarRadius}
              cy={radarCenter + contact.radarY * radarRadius}
              fill={accent.fill}
              r={contact.clamped ? 4.5 : 4}
              stroke={accent.stroke}
              strokeWidth="1.1"
              style={{ filter: `drop-shadow(0 0 10px ${accent.glow})` }}
            />
          </g>
        );
      })}

      {radarSnapshot.enemyContacts.map((contact) => {
        const accent = resolveMetaversePlayerTeamAccent(contact.teamId);
        const contactX = radarCenter + contact.radarX * radarRadius;
        const contactY = radarCenter + contact.radarY * radarRadius;
        const contactSize = contact.clamped ? 10 : 8;

        return (
          <g
            key={`enemy-${contact.username}`}
            filter="url(#metaverse-radar-contact-glow)"
          >
            <title>{`${contact.username} · ${contact.distanceMeters.toFixed(0)}m`}</title>
            <rect
              fill={accent.fill}
              height={contactSize}
              rx="1.5"
              stroke={accent.stroke}
              strokeWidth="1"
              style={{ filter: `drop-shadow(0 0 12px ${accent.glow})` }}
              transform={`translate(${contactX} ${contactY}) rotate(45) translate(${contactSize / -2} ${contactSize / -2})`}
              width={contactSize}
            />
          </g>
        );
      })}
    </svg>
  );
}
