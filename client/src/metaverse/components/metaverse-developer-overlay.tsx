import { type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";
import {
  createDeveloperReport,
  formatCount
} from "./developer-overlay/metaverse-developer-overlay-formatting";

interface MetaverseDeveloperOverlayProps {
  readonly className?: string;
  readonly hudScaleStyle?: CSSProperties;
  readonly hudSnapshot: MetaverseHudSnapshot;
  readonly onSetupRequest: () => void;
}

interface MetaverseDeveloperPillProps {
  readonly label: string;
  readonly value: string;
}

const metaverseDeveloperPillClassName =
  "h-7 max-w-full rounded-full border-[color:var(--shell-foreground)] bg-[color:var(--shell-foreground)] px-3 text-game-foreground shadow-[0_10px_30px_rgb(15_23_42/_0.18)]";

function MetaverseDeveloperPill({
  label,
  value
}: MetaverseDeveloperPillProps) {
  return (
    <Badge className={metaverseDeveloperPillClassName}>
      <span className="truncate">
        {label} {value}
      </span>
    </Badge>
  );
}

export function MetaverseDeveloperOverlay({
  className,
  hudScaleStyle,
  hudSnapshot,
  onSetupRequest
}: MetaverseDeveloperOverlayProps) {
  const connectedPlayerCount = hudSnapshot.presence.remotePlayerCount + 1;
  const developerPills = [
    {
      label: "Boot",
      value: hudSnapshot.boot.phase.replaceAll("-", " ")
    },
    {
      label: "FPS",
      value: hudSnapshot.telemetry.frameRate.toFixed(1)
    },
    {
      label: "Renderer",
      value: hudSnapshot.telemetry.renderer.label
    },
    {
      label: "Draw calls",
      value: formatCount(hudSnapshot.telemetry.renderer.drawCallCount)
    },
    {
      label: "DPR",
      value: hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)
    },
    {
      label: "Triangles",
      value: formatCount(hudSnapshot.telemetry.renderer.triangleCount)
    },
    {
      label: "Connected Players",
      value: formatCount(connectedPlayerCount)
    }
  ] as const;

  function handleCopyReport(): void {
    if (navigator.clipboard?.writeText === undefined) {
      return;
    }

    void navigator.clipboard
      .writeText(createDeveloperReport(hudSnapshot))
      .catch(() => undefined);
  }

  return (
    <div
      className={[
        "pointer-events-auto flex min-w-0 w-full flex-col items-end gap-2",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      style={hudScaleStyle}
    >
      <div className="flex max-w-full flex-wrap justify-end gap-2">
        {developerPills.map((pill) => (
          <MetaverseDeveloperPill
            key={pill.label}
            label={pill.label}
            value={pill.value}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          onClick={handleCopyReport}
          size="sm"
          type="button"
          variant="outline"
        >
          Copy report
        </Button>
        <Button
          onClick={onSetupRequest}
          size="sm"
          type="button"
          variant="outline"
        >
          Main Menu
        </Button>
      </div>
    </div>
  );
}
