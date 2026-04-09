import {
  resolveGameplayInputMode,
  type CoopGameplaySessionPlayerSnapshot,
  type GameplayHudSnapshot,
  type GameplayInputModeId
} from "../../game";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GameplayHudOverlayProps {
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly coopKickActionPendingPlayerId:
    | CoopGameplaySessionPlayerSnapshot["playerId"]
    | null;
  readonly coopReadyActionAvailable: boolean;
  readonly coopReadyActionBusy: boolean;
  readonly coopReadyActionDisabled: boolean;
  readonly coopReadyActionLabel: string;
  readonly coopStartActionAvailable: boolean;
  readonly coopStartActionBusy: boolean;
  readonly coopStartActionDisabled: boolean;
  readonly hudSnapshot: GameplayHudSnapshot;
  readonly inputMode: GameplayInputModeId;
  readonly onKickCoopPlayer: (
    playerId: CoopGameplaySessionPlayerSnapshot["playerId"]
  ) => void;
  readonly onOpenMenu: () => void;
  readonly onRestartSession: () => void;
  readonly onRetryRuntime: () => void;
  readonly onStartCoopSession: () => void;
  readonly onToggleCoopReady: () => void;
  readonly runtimeError: string | null;
  readonly selectedReticleLabel: string;
  readonly username: string;
  readonly weaponLabel: string;
}

function formatCoopLobbyCounts(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.session.mode !== "co-op") {
    return "Single-player";
  }

  if (hudSnapshot.session.playerCount === 0) {
    return "Joining room";
  }

  return `${hudSnapshot.session.connectedPlayerCount}/${hudSnapshot.session.capacity} connected • ${hudSnapshot.session.readyPlayerCount}/${hudSnapshot.session.requiredReadyPlayerCount} ready`;
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
  const mouseInputSelected = inputMode === "mouse";

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
      if (mouseInputSelected) {
        return "Swipe to the screen edge to reload";
      }

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

function formatSessionPhase(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.session.phase === "waiting-for-players") {
    return "Waiting";
  }

  if (hudSnapshot.session.mode === "co-op" && hudSnapshot.session.roundPhase === "cooldown") {
    return "Cooldown";
  }

  if (hudSnapshot.session.phase === "active") {
    return "Active";
  }

  if (hudSnapshot.session.phase === "completed") {
    return "Completed";
  }

  return "Failed";
}

function formatSessionStatus(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.session.mode === "co-op") {
    if (hudSnapshot.session.phase === "waiting-for-players") {
      if (hudSnapshot.session.playerCount === 0) {
        return "Joining room...";
      }

      if (hudSnapshot.session.localPlayerCanStart) {
        return `Leader can start round ${hudSnapshot.session.roundNumber}`;
      }

      if (
        hudSnapshot.session.readyPlayerCount >=
        hudSnapshot.session.requiredReadyPlayerCount
      ) {
        return "Waiting for the party leader";
      }

      return formatCoopLobbyCounts(hudSnapshot);
    }

    if (hudSnapshot.session.phase === "completed") {
      return "Shared room cleared";
    }

    if (hudSnapshot.session.roundPhase === "cooldown") {
      return `Round ${hudSnapshot.session.roundNumber + 1} starts in ${formatRoundTime(
        hudSnapshot.session.roundPhaseRemainingMs
      )}`;
    }

    return `Round ${hudSnapshot.session.roundNumber} • ${hudSnapshot.session.birdsRemaining} birds • ${formatRoundTime(
      hudSnapshot.session.roundPhaseRemainingMs
    )} remaining`;
  }

  if (hudSnapshot.session.phase === "active") {
    return `${formatRoundTime(hudSnapshot.session.roundTimeRemainingMs)} remaining`;
  }

  return "Restart ready";
}

function formatRoundSummary(
  hudSnapshot: GameplayHudSnapshot,
  bestScore: number,
  displayedBestScore: number
): { readonly detail: string; readonly headline: string; readonly showRestart: boolean } {
  if (hudSnapshot.session.mode === "co-op") {
    return {
      detail:
        hudSnapshot.session.phase === "completed"
          ? `Team landed ${hudSnapshot.session.teamHitsLanded} hits across ${hudSnapshot.session.teamShotsFired} shots.`
          : `${hudSnapshot.session.birdsRemaining} birds are still airborne.`,
      headline:
        hudSnapshot.session.phase === "completed"
          ? "Harbor cleared"
          : "Room still in progress",
      showRestart: false
    };
  }

  if (hudSnapshot.session.phase === "completed") {
    return {
      headline: "Arena cleared",
      detail:
        hudSnapshot.session.score > bestScore
          ? `All enemies downed. New best score: ${displayedBestScore}.`
          : `All enemies downed with ${hudSnapshot.session.score} points.`,
      showRestart: true
    };
  }

  return {
    headline: "Round failed",
    detail: `Timer expired with ${hudSnapshot.arena.liveEnemyCount} enemies still airborne.`,
    showRestart: true
  };
}

function formatCoopLobbyBadge(hudSnapshot: GameplayHudSnapshot): string {
  if (hudSnapshot.session.mode !== "co-op") {
    return "Single-player";
  }

  if (hudSnapshot.session.phase === "completed") {
    return "Room cleared";
  }

  if (hudSnapshot.session.phase === "active") {
    if (hudSnapshot.session.roundPhase === "cooldown") {
      return `Round ${hudSnapshot.session.roundNumber + 1} in ${formatRoundTime(
        hudSnapshot.session.roundPhaseRemainingMs
      )}`;
    }

    return `Round ${hudSnapshot.session.roundNumber} • ${hudSnapshot.session.birdsRemaining} birds`;
  }

  const lobbyCounts = formatCoopLobbyCounts(hudSnapshot);

  if (
    hudSnapshot.session.phase === "waiting-for-players" &&
    hudSnapshot.session.readyPlayerCount >=
      hudSnapshot.session.requiredReadyPlayerCount &&
    hudSnapshot.session.playerCount > 0
  ) {
    return `${lobbyCounts} • Ready to launch`;
  }

  return lobbyCounts;
}

function formatCoopPlayerOutcome(
  playerSnapshot: CoopGameplaySessionPlayerSnapshot,
  phase: GameplayHudSnapshot["session"]["phase"]
): string {
  if (phase === "waiting-for-players") {
    if (playerSnapshot.ready) {
      return playerSnapshot.isLeader ? "Leader ready" : "Ready in lobby";
    }

    return playerSnapshot.isLeader ? "Party leader" : "Not ready";
  }

  if (playerSnapshot.lastOutcome === null) {
    return playerSnapshot.ready ? "In session" : "Observing this round";
  }

  if (playerSnapshot.lastOutcome === "hit") {
    return "Last shot hit";
  }

  if (playerSnapshot.lastOutcome === "scatter") {
    return "Last shot scattered birds";
  }

  return "Last shot missed";
}

export function GameplayHudOverlay({
  audioStatusLabel,
  bestScore,
  coopKickActionPendingPlayerId,
  coopReadyActionAvailable,
  coopReadyActionBusy,
  coopReadyActionDisabled,
  coopReadyActionLabel,
  coopStartActionAvailable,
  coopStartActionBusy,
  coopStartActionDisabled,
  hudSnapshot,
  inputMode,
  onKickCoopPlayer,
  onOpenMenu,
  onRestartSession,
  onRetryRuntime,
  onStartCoopSession,
  onToggleCoopReady,
  runtimeError,
  selectedReticleLabel,
  username,
  weaponLabel
}: GameplayHudOverlayProps) {
  const displayedBestScore =
    hudSnapshot.session.mode === "single-player"
      ? Math.max(bestScore, hudSnapshot.session.score)
      : bestScore;
  const roundSummary =
    hudSnapshot.session.mode === "single-player"
      ? hudSnapshot.session.restartReady
        ? formatRoundSummary(hudSnapshot, bestScore, displayedBestScore)
        : null
      : hudSnapshot.session.phase === "completed"
        ? formatRoundSummary(hudSnapshot, bestScore, displayedBestScore)
        : null;
  const coopLocalPlayer =
    hudSnapshot.session.mode === "co-op"
      ? hudSnapshot.session.players.find((playerSnapshot) => playerSnapshot.isLocalPlayer) ??
        null
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
            {hudSnapshot.session.mode === "single-player"
              ? `${hudSnapshot.session.score} points`
              : `${hudSnapshot.session.teamHitsLanded} team hits`}
          </p>
          <p className="mt-3 text-sm text-white/72">{roundSummary.detail}</p>
          {roundSummary.showRestart ? (
            <Button
              className="mt-5"
              onClick={onRestartSession}
              type="button"
              variant="secondary"
            >
              Restart round
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Player</p>
          <p className="mt-2 text-2xl font-semibold text-white">{username}</p>
          <p className="mt-2 text-sm text-white/72">
            {hudSnapshot.session.mode === "co-op"
              ? `${selectedReticleLabel} • Co-op`
              : selectedReticleLabel}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Session</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatSessionPhase(hudSnapshot)}
          </p>
          <p className="mt-2 text-sm text-white/72">{formatSessionStatus(hudSnapshot)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">
            {hudSnapshot.session.mode === "co-op" ? "Team" : "Score"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {hudSnapshot.session.mode === "co-op"
              ? hudSnapshot.session.teamHitsLanded
              : hudSnapshot.session.score}
          </p>
          <p className="mt-2 text-sm text-white/72">
            {hudSnapshot.session.mode === "co-op"
              ? `${hudSnapshot.session.teamShotsFired} team shots`
              : `Best ${displayedBestScore}`}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/12 bg-white/6 p-4 backdrop-blur-md">
          <p className="text-sm font-medium text-white">Combat</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {hudSnapshot.session.mode === "co-op"
              ? `${coopLocalPlayer?.hitsLanded ?? 0}`
              : `x${hudSnapshot.session.streak}`}
          </p>
          <p className="mt-2 text-sm text-white/72">
            {hudSnapshot.session.mode === "co-op"
              ? `${coopLocalPlayer?.shotsFired ?? 0} local shots`
              : `${hudSnapshot.session.killsThisSession} kills this round`}
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

      {hudSnapshot.session.mode === "co-op" ? (
        <div className="rounded-[1.75rem] border border-white/12 bg-white/6 p-5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Team activity</p>
              <p className="mt-1 text-sm text-white/72">
                Shared room snapshots drive teammate status, round cadence, shot outcomes, and bird pressure.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{formatCoopLobbyBadge(hudSnapshot)}</Badge>
              {coopStartActionAvailable ? (
                <Button
                  disabled={coopStartActionDisabled || coopStartActionBusy}
                  onClick={onStartCoopSession}
                  type="button"
                >
                  {coopStartActionBusy ? "Starting..." : "Start game"}
                </Button>
              ) : null}
              {coopReadyActionAvailable ? (
                <Button
                  disabled={coopReadyActionDisabled || coopReadyActionBusy}
                  onClick={onToggleCoopReady}
                  type="button"
                  variant="secondary"
                >
                  {coopReadyActionBusy ? "Updating..." : coopReadyActionLabel}
                </Button>
              ) : null}
            </div>
          </div>

          {hudSnapshot.session.players.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/12 bg-slate-950/38 p-4 text-sm text-white/72">
              Waiting for the room snapshot to confirm your player slot.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {hudSnapshot.session.players.map((playerSnapshot) => (
                <div
                  className="rounded-xl border border-white/12 bg-slate-950/38 p-4"
                  key={playerSnapshot.playerId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {playerSnapshot.username}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={playerSnapshot.isLocalPlayer ? "secondary" : "outline"}>
                        {playerSnapshot.isLocalPlayer ? "You" : "Teammate"}
                      </Badge>
                      {playerSnapshot.isLeader ? (
                        <Badge variant="outline">Leader</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/72">
                    {formatCoopPlayerOutcome(playerSnapshot, hudSnapshot.session.phase)}
                  </p>
                  {hudSnapshot.session.phase === "waiting-for-players" &&
                  hudSnapshot.session.localPlayerIsLeader &&
                  !playerSnapshot.isLocalPlayer ? (
                    <Button
                      className="mt-3"
                      disabled={coopKickActionPendingPlayerId !== null}
                      onClick={() => {
                        onKickCoopPlayer(playerSnapshot.playerId);
                      }}
                      size="xs"
                      type="button"
                      variant="destructive"
                    >
                      {coopKickActionPendingPlayerId === playerSnapshot.playerId
                        ? "Removing..."
                        : "Boot player"}
                    </Button>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.22em] text-white/52">
                    {`${playerSnapshot.hitsLanded} hits / ${playerSnapshot.shotsFired} shots`}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/52">
                    {`${playerSnapshot.scatterEventsCaused} scatter events`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
