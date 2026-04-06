import type {
  GameplayDebugPanelMode,
  GameplayTelemetrySnapshot,
  HandTrackingTelemetrySnapshot
} from "../../game";
import { Badge } from "@/components/ui/badge";

interface GameplayDebugOverlayProps {
  readonly gameplayTelemetry: GameplayTelemetrySnapshot;
  readonly mode: GameplayDebugPanelMode;
  readonly trackingTelemetry: HandTrackingTelemetrySnapshot;
}

function formatMillis(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value)} ms`;
}

function formatPoint(value: GameplayTelemetrySnapshot["aimPoint"]): string {
  return value === null
    ? "n/a"
    : `${(value.x * 100).toFixed(1)}%, ${(value.y * 100).toFixed(1)}%`;
}

function toViewportStyle(point: GameplayTelemetrySnapshot["aimPoint"]): {
  readonly left: string;
  readonly top: string;
} {
  return {
    left: `${(point?.x ?? 0) * 100}%`,
    top: `${(point?.y ?? 0) * 100}%`
  };
}

export function GameplayDebugOverlay({
  gameplayTelemetry,
  mode,
  trackingTelemetry
}: GameplayDebugOverlayProps) {
  if (mode === "hidden") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {mode === "aim-inspector" && gameplayTelemetry.observedIndexPoint !== null ? (
        <div
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200 bg-amber-300/65 shadow-[0_0_0_8px_rgb(251_191_36_/_0.14)]"
          style={toViewportStyle(gameplayTelemetry.observedIndexPoint)}
        />
      ) : null}

      {mode === "aim-inspector" && gameplayTelemetry.aimPoint !== null ? (
        <div
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300 shadow-[0_0_0_10px_rgb(56_189_248_/_0.12)]"
          style={toViewportStyle(gameplayTelemetry.aimPoint)}
        />
      ) : null}

      <div className="absolute right-4 bottom-4 w-[min(22rem,calc(100%-2rem))] rounded-[1.4rem] border border-white/14 bg-slate-950/72 p-4 text-white shadow-[0_16px_48px_rgb(15_23_42_/_0.32)] backdrop-blur-md">
        <div className="flex flex-wrap gap-2">
          <Badge>{mode === "telemetry" ? "Telemetry" : "Aim inspector"}</Badge>
          <Badge variant="secondary">
            Reticle {gameplayTelemetry.reticleVisualState.replaceAll("-", " ")}
          </Badge>
          <Badge variant="outline">
            Tracking {trackingTelemetry.trackingState}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-white/78 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Frame {gameplayTelemetry.renderedFrameCount} ·{" "}
            {gameplayTelemetry.frameRate.toFixed(1)} fps
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Delta {formatMillis(gameplayTelemetry.frameDeltaMs)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Worker {formatMillis(trackingTelemetry.workerLatencyMs)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Pose age {formatMillis(gameplayTelemetry.trackingPoseAgeMs)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Aim {formatPoint(gameplayTelemetry.aimPoint)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Raw {formatPoint(gameplayTelemetry.observedIndexPoint)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Thumb drop{" "}
            {gameplayTelemetry.thumbDropDistance === null
              ? "n/a"
              : gameplayTelemetry.thumbDropDistance.toFixed(3)}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            World {Math.round(gameplayTelemetry.worldTimeMs)} ms
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Session {gameplayTelemetry.sessionPhase}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Feedback {gameplayTelemetry.targetFeedbackState}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Weapon {gameplayTelemetry.weaponReadiness}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Frames {trackingTelemetry.framesProcessed}/{trackingTelemetry.framesDispatched}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Skips {trackingTelemetry.inFlightFrameSkips}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Stale {trackingTelemetry.staleSnapshotsIgnored}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Sequence {trackingTelemetry.latestSequenceNumber}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            Snapshot {formatMillis(trackingTelemetry.latestPoseAgeMs)}
          </div>
        </div>
      </div>
    </div>
  );
}
