import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";

interface MetaversePlayerRadarHudProps {
  readonly radarSnapshot: MetaverseHudSnapshot["radar"];
}

const radarViewSize = 160;
const radarCenter = radarViewSize / 2;
const radarRadius = 68;

const radarFriendlyAccent = Object.freeze({
  fill: "#38bdf8",
  glow: "rgba(56, 189, 248, 0.42)",
  stroke: "#7dd3fc"
});

const radarEnemyAccent = Object.freeze({
  fill: "#fb7185",
  glow: "rgba(251, 113, 133, 0.45)",
  stroke: "#fda4af"
});

const radarLocalPlayerAccent = Object.freeze({
  fill: "#60a5fa",
  glow: "rgba(96, 165, 250, 0.44)",
  stroke: "#dbeafe"
});

function resolveRadarMarkerAccent(kind: "enemy" | "friendly" | "local"): {
  readonly fill: string;
  readonly glow: string;
  readonly stroke: string;
} {
  switch (kind) {
    case "enemy":
      return radarEnemyAccent;
    case "friendly":
      return radarFriendlyAccent;
    case "local":
      return radarLocalPlayerAccent;
  }
}

export function MetaversePlayerRadarHud({
  radarSnapshot
}: MetaversePlayerRadarHudProps) {
  const localPlayerAccent = resolveRadarMarkerAccent("local");

  return (
    <svg
      aria-label="Player radar"
      className="h-auto w-full max-w-[13rem]"
      viewBox={`0 0 ${radarViewSize} ${radarViewSize}`}
    >
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

      <title>You</title>
      <circle
        cx={radarCenter}
        cy={radarCenter}
        fill={localPlayerAccent.fill}
        r="4.25"
        style={{ filter: `drop-shadow(0 0 10px ${localPlayerAccent.glow})` }}
      />

      {radarSnapshot.friendlyContacts.map((contact) => {
        const accent = resolveRadarMarkerAccent("friendly");
        const contactX = radarCenter + contact.radarX * radarRadius;
        const contactY = radarCenter + contact.radarY * radarRadius;

        return (
          <g key={`friendly-${contact.username}`}>
            <title>{`${contact.username} · ${contact.distanceMeters.toFixed(0)}m`}</title>
            <circle
              cx={contactX}
              cy={contactY}
              fill={accent.fill}
              r="4"
              stroke={accent.stroke}
              strokeWidth="1.1"
              style={{
                filter: `drop-shadow(0 0 10px ${accent.glow})`,
                transition: "cx 80ms linear, cy 80ms linear"
              }}
            />
          </g>
        );
      })}

      {radarSnapshot.enemyContacts.map((contact) => {
        const accent = resolveRadarMarkerAccent("enemy");
        const contactX = radarCenter + contact.radarX * radarRadius;
        const contactY = radarCenter + contact.radarY * radarRadius;

        return (
          <g key={`enemy-${contact.username}`}>
            <title>{`${contact.username} · ${contact.distanceMeters.toFixed(0)}m`}</title>
            <circle
              cx={contactX}
              cy={contactY}
              fill={accent.fill}
              r="4.5"
              stroke={accent.stroke}
              strokeWidth="1.25"
              style={{
                filter: `drop-shadow(0 0 12px ${accent.glow})`,
                transition: "cx 80ms linear, cy 80ms linear"
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
