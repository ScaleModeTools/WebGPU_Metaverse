import type {
  GameplayDebugPanelMode,
  GameplayTelemetrySnapshot
} from "../types/duck-hunt-gameplay-presentation";
import type { HandTrackingTelemetrySnapshot } from "../../../tracking";
import { Badge } from "@/components/ui/badge";

interface DuckHuntGameplayDebugOverlayProps {
  readonly gameplayTelemetry: GameplayTelemetrySnapshot;
  readonly mode: GameplayDebugPanelMode;
  readonly trackingTelemetry: HandTrackingTelemetrySnapshot;
}

function formatMillis(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value)} ms`;
}

function formatPoint(value: { readonly x: number; readonly y: number } | null): string {
  return value === null
    ? "n/a"
    : `${(value.x * 100).toFixed(1)}%, ${(value.y * 100).toFixed(1)}%`;
}

function toViewportStyle(point: { readonly x: number; readonly y: number } | null): {
  readonly left: string;
  readonly top: string;
} {
  return {
    left: `${(point?.x ?? 0) * 100}%`,
    top: `${(point?.y ?? 0) * 100}%`
  };
}

export function DuckHuntGameplayDebugOverlay({
  gameplayTelemetry,
  mode,
  trackingTelemetry
}: DuckHuntGameplayDebugOverlayProps) {
  if (mode === "hidden") {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {mode === "aim-inspector" && gameplayTelemetry.observedAimPoint !== null ? (
        <div
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200 bg-amber-300/65 shadow-[0_0_0_8px_rgb(251_191_36/0.14)]"
          style={toViewportStyle(gameplayTelemetry.observedAimPoint)}
        />
      ) : null}

      {mode === "aim-inspector" && gameplayTelemetry.aimPoint !== null ? (
        <div
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300 shadow-[0_0_0_10px_rgb(56_189_248/0.12)]"
          style={toViewportStyle(gameplayTelemetry.aimPoint)}
        />
      ) : null}

      <div className="surface-game-overlay absolute right-4 bottom-4 w-[min(22rem,calc(100%-2rem))] rounded-[1.4rem] p-4 shadow-[0_16px_48px_rgb(15_23_42/0.32)]">
        <div className="flex flex-wrap gap-2">
          <Badge>{mode === "telemetry" ? "Telemetry" : "Aim inspector"}</Badge>
          <Badge variant="secondary">
            Reticle {gameplayTelemetry.reticleVisualState.replaceAll("-", " ")}
          </Badge>
          <Badge variant="outline">
            Tracking {trackingTelemetry.trackingState}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Frame {gameplayTelemetry.renderedFrameCount} ·{" "}
            {gameplayTelemetry.frameRate.toFixed(1)} fps
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Delta {formatMillis(gameplayTelemetry.frameDeltaMs)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Worker {formatMillis(trackingTelemetry.workerLatencyMs)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Pose age {formatMillis(gameplayTelemetry.trackingPoseAgeMs)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Aim {formatPoint(gameplayTelemetry.aimPoint)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Observed aim {formatPoint(gameplayTelemetry.observedAimPoint)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Thumb drop{" "}
            {gameplayTelemetry.thumbDropDistance === null
              ? "n/a"
              : gameplayTelemetry.thumbDropDistance.toFixed(3)}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            World {Math.round(gameplayTelemetry.worldTimeMs)} ms
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Session {gameplayTelemetry.sessionPhase}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Feedback {gameplayTelemetry.targetFeedbackState}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Weapon {gameplayTelemetry.weaponReadiness}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Frames {trackingTelemetry.framesProcessed}/{trackingTelemetry.framesDispatched}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Skips {trackingTelemetry.inFlightFrameSkips}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Stale {trackingTelemetry.staleSnapshotsIgnored}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Sequence {trackingTelemetry.latestSequenceNumber}
          </div>
          <div className="surface-game-inset type-game-detail rounded-lg px-3 py-2">
            Snapshot {formatMillis(trackingTelemetry.latestPoseAgeMs)}
          </div>
        </div>
      </div>
    </div>
  );
}
