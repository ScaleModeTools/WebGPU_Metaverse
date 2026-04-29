import { type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";
import { formatMetaversePlayerTeamLabel } from "./metaverse-player-team-pill";
import {
  createDeveloperReport,
  formatCount,
  formatHeldWeaponMainHandDiagnosis,
  formatHeldWeaponGripStatus,
  formatOptionalCentimeters,
  formatOptionalDegrees,
  formatOptionalMilliseconds
} from "./developer-overlay/metaverse-developer-overlay-formatting";

interface MetaverseDeveloperOverlayProps {
  readonly className?: string;
  readonly hudScaleStyle?: CSSProperties;
  readonly hudSnapshot: MetaverseHudSnapshot;
  readonly layout?: "modal" | "overlay";
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
  layout = "overlay",
  onSetupRequest
}: MetaverseDeveloperOverlayProps) {
  const connectedPlayerCount = hudSnapshot.presence.remotePlayerCount + 1;
  const heldWeaponGrip = hudSnapshot.telemetry.localHeldWeaponGrip;
  const isModalLayout = layout === "modal";
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
    },
    {
      label: "Team",
      value: formatMetaversePlayerTeamLabel(hudSnapshot.presence.localTeamId)
    },
    {
      label: "Matchmaking",
      value:
        hudSnapshot.combat.matchPhase === null
          ? "free roam"
          : hudSnapshot.combat.matchPhase.replaceAll("-", " ")
    },
    {
      label: "Grip",
      value: formatHeldWeaponGripStatus(hudSnapshot)
    },
    {
      label: "Grip Main",
      value: formatOptionalCentimeters(heldWeaponGrip.mainHandGripErrorMeters)
    },
    {
      label: "Grip Off",
      value: formatOptionalCentimeters(heldWeaponGrip.offHandFinalErrorMeters)
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
        "pointer-events-auto flex min-w-0 w-full flex-col gap-2",
        isModalLayout ? "items-stretch" : "items-end",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      style={hudScaleStyle}
    >
      <div
        className={[
          "flex max-w-full flex-wrap gap-2",
          isModalLayout ? "justify-start" : "justify-end"
        ].join(" ")}
      >
        {developerPills.map((pill) => (
          <MetaverseDeveloperPill
            key={pill.label}
            label={pill.label}
            value={pill.value}
          />
        ))}
      </div>

      <div
        className={[
          "flex flex-wrap gap-2",
          isModalLayout ? "justify-start" : "justify-end"
        ].join(" ")}
      >
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

      {isModalLayout ? (
        <div className="w-full rounded-[1.25rem] border border-white/10 bg-[rgb(15_23_42_/_0.48)] p-4 text-sm text-slate-100">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
            Local Grip Debug
          </div>
          <div className="mt-3 space-y-1 font-mono text-[0.82rem] leading-6 text-slate-200">
            <div>
              Phase: {heldWeaponGrip.phase} · mount {heldWeaponGrip.attachmentMountKind} · socket {heldWeaponGrip.heldMountSocketName ?? "n/a"}
            </div>
            <div>
              Weapon: {heldWeaponGrip.weaponId ?? "n/a"} · aim {heldWeaponGrip.aimMode ?? "n/a"} · ads {heldWeaponGrip.adsBlend?.toFixed(2) ?? "n/a"}
            </div>
            <div>
              Pose: ads anchor {heldWeaponGrip.adsAnchorPoseActive ? "yes" : "no"} · support palm {heldWeaponGrip.supportPalmHintActive ? "yes" : "no"} · off-hand {heldWeaponGrip.offHandTargetKind} · profile {heldWeaponGrip.poseProfileId ?? "n/a"} · state {heldWeaponGrip.weaponStatePresent ? "yes" : "no"}
            </div>
            <div>
              Main {heldWeaponGrip.mainHandSocket} {formatOptionalCentimeters(heldWeaponGrip.mainHandGripErrorMeters)} · grip cmp {formatOptionalCentimeters(heldWeaponGrip.mainHandGripSocketComparisonErrorMeters)} · palm cmp {formatOptionalCentimeters(heldWeaponGrip.mainHandPalmSocketComparisonErrorMeters)}
            </div>
            <div>
              Main stages: solve {formatOptionalCentimeters(heldWeaponGrip.mainHandSolveErrorMeters)} · post pole {formatOptionalCentimeters(heldWeaponGrip.mainHandPostPoleBiasErrorMeters)} · final {formatOptionalCentimeters(heldWeaponGrip.mainHandGripErrorMeters)} · pole {formatOptionalDegrees(heldWeaponGrip.mainHandPoleAngleRadians)}
            </div>
            <div>
              Reach: target {formatOptionalCentimeters(heldWeaponGrip.mainHandTargetDistanceMeters)} · max {formatOptionalCentimeters(heldWeaponGrip.mainHandMaxReachMeters)} · clamp {formatOptionalCentimeters(heldWeaponGrip.mainHandReachClampDeltaMeters)} · slack {formatOptionalCentimeters(heldWeaponGrip.mainHandReachSlackMeters)}
            </div>
            <div>
              Off {heldWeaponGrip.offHandSocket} pre {formatOptionalCentimeters(heldWeaponGrip.offHandPreSolveErrorMeters)} solve {formatOptionalCentimeters(heldWeaponGrip.offHandInitialSolveErrorMeters)} final {formatOptionalCentimeters(heldWeaponGrip.offHandFinalErrorMeters)} · pole {formatOptionalDegrees(heldWeaponGrip.offHandPoleAngleRadians)} · refine {formatCount(heldWeaponGrip.offHandRefinementPassCount)}
            </div>
            <div>
              Diagnosis: {formatHeldWeaponMainHandDiagnosis(heldWeaponGrip)}
            </div>
            <div>
              Last degraded: {heldWeaponGrip.lastDegradedReason ?? "none"} · {formatOptionalMilliseconds(heldWeaponGrip.lastDegradedAgeMs)} ago · {formatCount(heldWeaponGrip.degradedFrameCount)} total
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
