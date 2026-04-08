import {
  resolveGameplayInputMode,
  type GameplayHudSnapshot,
  type GameplayInputModeId
} from "../../game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GameplayHudOverlayProps {
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly hudSnapshot: GameplayHudSnapshot;
  readonly inputMode: GameplayInputModeId;
  readonly onOpenMenu: () => void;
  readonly onRestartSession: () => void;
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

function formatTargetFeedback(
  hudSnapshot: GameplayHudSnapshot,
  inputMode: GameplayInputModeId
): string {
  const selectedInputMode = resolveGameplayInputMode(inputMode);

  if (hudSnapshot.targetFeedback.state === "tracking-lost") {
    return selectedInputMode.hudCopy.trackingLost;
  }

  if (hudSnapshot.targetFeedback.state === "offscreen") {
    return "Reticle off-screen";
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

function formatWeaponReadiness(
  hudSnapshot: GameplayHudSnapshot,
  inputMode: GameplayInputModeId
): string {
  const selectedInputMode = resolveGameplayInputMode(inputMode);

  switch (hudSnapshot.weapon.readiness) {
    case "round-paused":
      return "Round paused for restart";
    case "tracking-unavailable":
      return selectedInputMode.hudCopy.trackingUnavailable;
    case "trigger-reset-required":
      return selectedInputMode.hudCopy.triggerResetRequired;
    case "cooldown":
      return `Recovering ${Math.ceil(hudSnapshot.weapon.cooldownRemainingMs)} ms`;
    case "reload-required":
      return hudSnapshot.weapon.reload.isReloadReady
        ? "Move farther off-screen to reload"
        : "Move reticle off-screen to reload";
    case "reloading":
      return `Reloading ${Math.ceil(hudSnapshot.weapon.reload.reloadRemainingMs)} ms`;
    case "ready":
      return "Ready";
  }
}

function formatClipState(hudSnapshot: GameplayHudSnapshot): string {
  const {
    clipCapacity,
    clipRoundsRemaining,
    state
  } = hudSnapshot.weapon.reload;

  if (state === "reloading") {
    return `Clip ${clipRoundsRemaining} / ${clipCapacity} • Reloading`;
  }

  if (state === "blocked") {
    return `Clip ${clipRoundsRemaining} / ${clipCapacity} • Reload required`;
  }

  return `Clip ${clipRoundsRemaining} / ${clipCapacity}`;
}

function formatRoundTime(roundTimeRemainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(roundTimeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSessionPhase(phase: GameplayHudSnapshot["session"]["phase"]): string {
  if (phase === "active") {
    return "Active";
  }

  if (phase === "completed") {
    return "Completed";
  }

  return "Failed";
}

function formatSessionStatus(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.session.phase === "active") {
    return `${formatRoundTime(hudSnapshot.session.roundTimeRemainingMs)} remaining`;
  }

  return "Restart ready";
}

function formatRoundSummary(
  hudSnapshot: GameplayHudSnapshot,
  bestScore: number,
  displayedBestScore: number
): { readonly headline: string; readonly detail: string } {
  if (hudSnapshot.session.phase === "completed") {
    return {
      headline: "Arena cleared",
      detail:
        hudSnapshot.session.score > bestScore
          ? `All enemies downed. New best score: ${displayedBestScore}.`
          : `All enemies downed with ${hudSnapshot.session.score} points.`
    };
  }

  return {
    headline: "Round failed",
    detail: `Timer expired with ${hudSnapshot.arena.liveEnemyCount} enemies still airborne.`
  };
}

export function GameplayHudOverlay({
  audioStatusLabel,
  bestScore,
  hudSnapshot,
  inputMode,
  onOpenMenu,
  onRestartSession,
  onRetryRuntime,
  runtimeError,
  selectedReticleLabel,
  username,
  weaponLabel
}: GameplayHudOverlayProps) {
  const displayedBestScore = Math.max(bestScore, hudSnapshot.session.score);
  const roundSummary =
    hudSnapshot.session.restartReady
      ? formatRoundSummary(hudSnapshot, bestScore, displayedBestScore)
      : null;

  return (
    <div className="relative flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-end gap-3">
        <Badge variant="outline">{audioStatusLabel}</Badge>
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

      {runtimeError !== null ? (
        <div className="ml-auto max-w-lg rounded-[1.5rem] border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm text-red-100 backdrop-blur-md">
          {runtimeError}
        </div>
      ) : null}

      <div className="flex-1" />

      {roundSummary !== null ? (
        <div className="mx-auto w-full max-w-xl rounded-[1.75rem] border border-white/16 bg-slate-950/55 p-5 text-center backdrop-blur-md">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/52">
            {roundSummary.headline}
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {hudSnapshot.session.score} points
          </p>
          <p className="mt-3 text-sm text-white/72">{roundSummary.detail}</p>
          <Button
            className="mt-5"
            onClick={onRestartSession}
            type="button"
            variant="secondary"
          >
            Restart round
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Player</p>
          <p className="mt-2 text-2xl font-semibold text-white">{username}</p>
          <p className="mt-2 text-sm text-white/72">{selectedReticleLabel}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Session</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatSessionPhase(hudSnapshot.session.phase)}
          </p>
          <p className="mt-2 text-sm text-white/72">{formatSessionStatus(hudSnapshot)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Score</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {hudSnapshot.session.score}
          </p>
          <p className="mt-2 text-sm text-white/72">{`Best ${displayedBestScore}`}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Combat</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {`x${hudSnapshot.session.streak}`}
          </p>
          <p className="mt-2 text-sm text-white/72">
            {`${hudSnapshot.session.killsThisSession} kills this round`}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">{weaponLabel}</p>
          <p className="mt-2 text-sm text-white/82">
            {formatWeaponReadiness(hudSnapshot, inputMode)}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/52">
            {formatClipState(hudSnapshot)}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/52">
            {`${hudSnapshot.weapon.shotsFired} shots / ${hudSnapshot.weapon.hitsLanded} hits`}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Arena</p>
          <p className="mt-2 text-sm text-white/82">
            {formatArenaState(hudSnapshot)}
          </p>
          <p className="mt-2 text-sm text-white/72">
            {formatTargetFeedback(hudSnapshot, inputMode)}
          </p>
        </div>
      </div>
    </div>
  );
}
