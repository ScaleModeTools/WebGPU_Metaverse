import type { GameplayHudSnapshot } from "../../game";
import { viewportOverlayPlan } from "../config/viewport-overlay-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GameplayHudOverlayProps {
  readonly audioStatusLabel: string;
  readonly hudSnapshot: GameplayHudSnapshot;
  readonly onOpenMenu: () => void;
  readonly onRetryRuntime: () => void;
  readonly runtimeError: string | null;
  readonly selectedReticleLabel: string;
  readonly username: string;
  readonly weaponLabel: string;
}

function formatArenaState(hudSnapshot: GameplayHudSnapshot): string {
  return [
    `${hudSnapshot.arena.liveEnemyCount} live`,
    `${hudSnapshot.arena.scatterEnemyCount} scatter`,
    `${hudSnapshot.arena.downedEnemyCount} downed`
  ].join(" / ");
}

function formatTargetFeedback(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.targetFeedback.state === "tracking-lost") {
    return "Tracking lost";
  }

  if (hudSnapshot.targetFeedback.state === "clear") {
    return "Clear lane";
  }

  if (hudSnapshot.targetFeedback.state === "miss") {
    return "Miss";
  }

  if (hudSnapshot.targetFeedback.state === "targeted") {
    return hudSnapshot.targetFeedback.enemyLabel === null
      ? "On target"
      : `On ${hudSnapshot.targetFeedback.enemyLabel}`;
  }

  return hudSnapshot.targetFeedback.enemyLabel === null
    ? "Confirmed hit"
    : `Hit ${hudSnapshot.targetFeedback.enemyLabel}`;
}

function formatWeaponReadiness(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.trackingState !== "tracked") {
    return "Awaiting tracked hand";
  }

  if (hudSnapshot.weapon.triggerHeld) {
    return "Release thumb to reset";
  }

  if (hudSnapshot.weapon.cooldownRemainingMs > 0) {
    return `Recovering ${Math.ceil(hudSnapshot.weapon.cooldownRemainingMs)} ms`;
  }

  return "Ready";
}

export function GameplayHudOverlay({
  audioStatusLabel,
  hudSnapshot,
  onOpenMenu,
  onRetryRuntime,
  runtimeError,
  selectedReticleLabel,
  username,
  weaponLabel
}: GameplayHudOverlayProps) {
  return (
    <div className="relative flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            <Badge>{`Instructions: ${viewportOverlayPlan.instructionsPlacement}`}</Badge>
            <Badge variant="secondary">{`HUD: ${viewportOverlayPlan.hudPlacement}`}</Badge>
            <Badge variant="outline">{audioStatusLabel}</Badge>
            <Badge variant="secondary">{`Tracking: ${hudSnapshot.trackingState}`}</Badge>
          </div>
          <p className="mt-4 text-sm text-white/82">
            The local arena simulation now owns enemy movement, scatter, and the
            semiautomatic pistol reset loop on top of the live WebGPU scene.
          </p>
          {runtimeError !== null ? (
            <div className="mt-4 rounded-xl border border-red-300/30 bg-red-500/12 px-3 py-3 text-sm text-red-100">
              {runtimeError}
            </div>
          ) : null}
        </div>

        <div className="flex gap-3">
          {runtimeError !== null ? (
            <Button onClick={onRetryRuntime} type="button" variant="outline">
              Retry runtime
            </Button>
          ) : null}
          <Button onClick={onOpenMenu} type="button" variant="secondary">
            Open menu
          </Button>
        </div>
      </div>

      <div className="flex-1" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Player</p>
          <p className="mt-2 text-2xl font-semibold text-white">{username}</p>
          <p className="mt-2 text-sm text-white/72">{selectedReticleLabel}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Arena</p>
          <p className="mt-2 text-sm text-white/82">{formatArenaState(hudSnapshot)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">{weaponLabel}</p>
          <p className="mt-2 text-sm text-white/82">
            {formatWeaponReadiness(hudSnapshot)}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/52">
            {`${hudSnapshot.weapon.shotsFired} shots / ${hudSnapshot.weapon.hitsLanded} hits`}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Target</p>
          <p className="mt-2 text-sm text-white/82">
            {formatTargetFeedback(hudSnapshot)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Aim</p>
          <p className="mt-2 text-sm text-white/82">
            {hudSnapshot.aimPoint === null
              ? "Awaiting tracked hand"
              : `${hudSnapshot.aimPoint.x.toFixed(2)}, ${hudSnapshot.aimPoint.y.toFixed(2)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
