import { useEffect, useRef, useState } from "react";

import {
  resolveGameplayInputMode,
  type GameplayInputModeId
} from "@webgpu-metaverse/shared";
import type {
  CoopGameplaySessionPlayerSnapshot,
  GameplayHudSnapshot
} from "../../game";
import {
  PretextParagraph,
  StableInlineText
} from "@/components/text-stability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const coopReadyActionLabels = ["Ready up", "Unready"] as const;
const coopLobbyBadgeReserveTexts = [
  "Single-player",
  "Joining room",
  "Room cleared",
  "Ready to launch"
] as const;
const audioStatusLabels = [
  "Awaiting user gesture",
  "Unlocking audio",
  "Audio unlock failed",
  "Audio unavailable",
  "Audio unlocked",
  "Audio unlocked, Strudel primed"
] as const;

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
    if (hudSnapshot.session.phase === "failed") {
      return `Round ${hudSnapshot.session.roundNumber} failed with ${hudSnapshot.session.birdsRemaining} birds still airborne`;
    }

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
    return `Round ${hudSnapshot.session.roundNumber} • ${formatRoundTime(
      hudSnapshot.session.roundTimeRemainingMs
    )} remaining`;
  }

  if (hudSnapshot.session.phase === "completed") {
    return `Round ${hudSnapshot.session.roundNumber} cleared`;
  }

  return `Run ended on round ${hudSnapshot.session.roundNumber}`;
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
          : `Timer expired in round ${hudSnapshot.session.roundNumber} with ${hudSnapshot.session.birdsRemaining} birds still airborne.`,
      headline:
        hudSnapshot.session.phase === "completed"
          ? "Harbor cleared"
          : "Room failed",
      showRestart: false
    };
  }

  if (hudSnapshot.session.phase === "completed") {
    return {
      headline: `Round ${hudSnapshot.session.roundNumber} cleared`,
      detail:
        hudSnapshot.session.score > bestScore
          ? `New best score: ${displayedBestScore}. Round ${hudSnapshot.session.roundNumber + 1} is ready.`
          : `All enemies downed with ${hudSnapshot.session.score} total points. Round ${hudSnapshot.session.roundNumber + 1} is ready.`,
      showRestart: true
    };
  }

  return {
    headline: "Run failed",
    detail: `Timer expired in round ${hudSnapshot.session.roundNumber} with ${hudSnapshot.arena.liveEnemyCount} enemies still airborne.`,
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

  if (hudSnapshot.session.phase === "failed") {
    return `Round ${hudSnapshot.session.roundNumber} failed`;
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

  if (phase === "failed" && playerSnapshot.lastOutcome === null) {
    return playerSnapshot.ready ? "Session failed" : "Observed failed round";
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

function isAimPointInsideElement(
  aimPoint: GameplayHudSnapshot["aimPoint"],
  overlayElement: HTMLDivElement | null,
  targetElement: HTMLElement | null
): boolean {
  if (aimPoint === null || overlayElement === null || targetElement === null) {
    return false;
  }

  const overlayRect = overlayElement.getBoundingClientRect();

  if (overlayRect.width <= 0 || overlayRect.height <= 0) {
    return false;
  }

  const targetRect = targetElement.getBoundingClientRect();
  const aimClientX = overlayRect.left + overlayRect.width * aimPoint.x;
  const aimClientY = overlayRect.top + overlayRect.height * aimPoint.y;

  return (
    aimClientX >= targetRect.left &&
    aimClientX <= targetRect.right &&
    aimClientY >= targetRect.top &&
    aimClientY <= targetRect.bottom
  );
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
      : hudSnapshot.session.phase === "completed" ||
          hudSnapshot.session.phase === "failed"
        ? formatRoundSummary(hudSnapshot, bestScore, displayedBestScore)
        : null;
  const coopLocalPlayer =
    hudSnapshot.session.mode === "co-op"
      ? hudSnapshot.session.players.find((playerSnapshot) => playerSnapshot.isLocalPlayer) ??
        null
      : null;
  const gamePanelClassName = "surface-game-panel rounded-[1.5rem] p-4";
  const gameStrongPanelClassName =
    "surface-game-panel-strong rounded-[1.75rem] p-5";
  const gameInsetPanelClassName = "surface-game-inset rounded-xl p-4";
  const singlePlayerRestartLabel =
    hudSnapshot.session.mode === "single-player" &&
    hudSnapshot.session.phase === "completed"
      ? `Start round ${hudSnapshot.session.roundNumber + 1}`
      : "Restart run";
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const coopReadyButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousTriggerHeldRef = useRef(hudSnapshot.weapon.triggerHeld);
  const [reticleHoveringReadyAction, setReticleHoveringReadyAction] =
    useState(false);
  const readyActionShootable =
    inputMode !== "mouse" &&
    coopReadyActionAvailable &&
    !coopReadyActionDisabled &&
    !coopReadyActionBusy;

  useEffect(() => {
    setReticleHoveringReadyAction(
      readyActionShootable &&
        isAimPointInsideElement(
          hudSnapshot.aimPoint,
          overlayRef.current,
          coopReadyButtonRef.current
        )
    );
  }, [
    hudSnapshot.aimPoint,
    readyActionShootable,
    coopReadyActionAvailable,
    coopReadyActionBusy,
    coopReadyActionDisabled
  ]);

  useEffect(() => {
    const triggerHeld = hudSnapshot.weapon.triggerHeld;
    const triggerPressedThisFrame =
      triggerHeld && !previousTriggerHeldRef.current;

    previousTriggerHeldRef.current = triggerHeld;

    if (!readyActionShootable || !reticleHoveringReadyAction || !triggerPressedThisFrame) {
      return;
    }

    onToggleCoopReady();
  }, [
    hudSnapshot.weapon.triggerHeld,
    onToggleCoopReady,
    readyActionShootable,
    reticleHoveringReadyAction
  ]);

  return (
    <div className="relative z-10 flex h-full select-none flex-col gap-6 p-6" ref={overlayRef}>
      <div className="flex flex-wrap items-start justify-end gap-3">
        <Badge variant="outline">
          <StableInlineText
            reserveTexts={audioStatusLabels}
            text={audioStatusLabel}
          />
        </Badge>
        <div className="flex gap-3">
          {runtimeError !== null ? (
            <Button
              onClick={onRetryRuntime}
              type="button"
              variant="outline"
            >
              Retry runtime
            </Button>
          ) : null}
          <Button
            onClick={onOpenMenu}
            type="button"
            variant="secondary"
          >
            Open menu
          </Button>
        </div>
      </div>

      {runtimeError !== null ? (
        <div className="surface-game-danger ml-auto max-w-lg rounded-[1.5rem] px-4 py-3 text-sm">
          <PretextParagraph text={runtimeError} />
        </div>
      ) : null}

      <div className="flex-1" />

      {roundSummary !== null ? (
        <div className={`${gameStrongPanelClassName} mx-auto w-full max-w-xl text-center`}>
          <p className="type-game-banner">
            {roundSummary.headline}
          </p>
          <p className="type-game-value mt-3">
            {hudSnapshot.session.mode === "single-player"
              ? `${hudSnapshot.session.score} points`
              : `${hudSnapshot.session.teamHitsLanded} team hits`}
          </p>
          <PretextParagraph
            className="type-game-body mt-3"
            text={roundSummary.detail}
          />
          {roundSummary.showRestart ? (
            <Button
              className="mt-5"
              onClick={onRestartSession}
              type="button"
              variant="secondary"
            >
              {hudSnapshot.session.mode === "single-player"
                ? singlePlayerRestartLabel
                : "Restart round"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className={gamePanelClassName}>
          <p className="type-game-title">Player</p>
          <p className="type-game-value mt-2">{username}</p>
          <p className="type-game-body mt-2">
            {hudSnapshot.session.mode === "co-op"
              ? `${selectedReticleLabel} • Co-op`
              : selectedReticleLabel}
          </p>
        </div>
        <div className={gamePanelClassName}>
          <p className="type-game-title">Session</p>
          <p className="type-game-value mt-2">
            {formatSessionPhase(hudSnapshot)}
          </p>
          <PretextParagraph
            className="type-game-body mt-2"
            text={formatSessionStatus(hudSnapshot)}
          />
        </div>
        <div className={gamePanelClassName}>
          <p className="type-game-title">
            {hudSnapshot.session.mode === "co-op" ? "Team" : "Score"}
          </p>
          <p className="type-game-value mt-2">
            {hudSnapshot.session.mode === "co-op"
              ? hudSnapshot.session.teamHitsLanded
              : hudSnapshot.session.score}
          </p>
          <p className="type-game-body mt-2">
            {hudSnapshot.session.mode === "co-op"
              ? `${hudSnapshot.session.teamShotsFired} team shots`
              : `Best ${displayedBestScore}`}
          </p>
        </div>
        <div className={gamePanelClassName}>
          <p className="type-game-title">Combat</p>
          <p className="type-game-value mt-2">
            {hudSnapshot.session.mode === "co-op"
              ? `${coopLocalPlayer?.hitsLanded ?? 0}`
              : `x${hudSnapshot.session.streak}`}
          </p>
          <p className="type-game-body mt-2">
            {hudSnapshot.session.mode === "co-op"
              ? `${coopLocalPlayer?.shotsFired ?? 0} local shots`
              : `${hudSnapshot.session.killsThisSession} kills this round`}
          </p>
        </div>
        <div className={gamePanelClassName}>
          <p className="type-game-title">{weaponLabel}</p>
          <PretextParagraph
            className="type-game-body mt-2"
            text={formatWeaponReadiness(hudSnapshot, inputMode)}
          />
          <p className="type-game-caption mt-2">
            {formatClipState(hudSnapshot)}
          </p>
          <p className="type-game-caption mt-2">
            {`${hudSnapshot.weapon.shotsFired} shots / ${hudSnapshot.weapon.hitsLanded} hits`}
          </p>
        </div>
        <div className={gamePanelClassName}>
          <p className="type-game-title">Arena</p>
          <p className="type-game-body mt-2">
            {formatArenaState(hudSnapshot)}
          </p>
          <p className="type-game-body mt-2">
            {formatTargetFeedback(hudSnapshot, inputMode)}
          </p>
        </div>
      </div>

      {hudSnapshot.session.mode === "co-op" ? (
        <div className="surface-game-panel rounded-[1.75rem] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="type-game-title">Team activity</p>
              <PretextParagraph
                className="type-game-body mt-1"
                text="Shared room snapshots drive teammate status, round cadence, shot outcomes, and bird pressure."
              />
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">
                <StableInlineText
                  reserveTexts={coopLobbyBadgeReserveTexts}
                  text={formatCoopLobbyBadge(hudSnapshot)}
                />
              </Badge>
              {coopStartActionAvailable ? (
                <Button
                  aria-busy={coopStartActionBusy || undefined}
                  disabled={coopStartActionDisabled || coopStartActionBusy}
                  onClick={onStartCoopSession}
                  type="button"
                >
                  <StableInlineText text="Start game" />
                </Button>
              ) : null}
              {coopReadyActionAvailable ? (
                <Button
                  aria-busy={coopReadyActionBusy || undefined}
                  className={
                    reticleHoveringReadyAction
                      ? "ring-2 ring-sky-300/70 shadow-[0_0_0_5px_rgb(56_189_248_/_0.18)]"
                      : undefined
                  }
                  disabled={coopReadyActionDisabled || coopReadyActionBusy}
                  onClick={onToggleCoopReady}
                  ref={coopReadyButtonRef}
                  type="button"
                  variant="secondary"
                >
                  <StableInlineText
                    reserveTexts={coopReadyActionLabels}
                    text={coopReadyActionLabel}
                  />
                </Button>
              ) : null}
            </div>
          </div>

          {hudSnapshot.session.players.length === 0 ? (
            <div className={`${gameInsetPanelClassName} type-game-body mt-4`}>
              <PretextParagraph text="Waiting for the room snapshot to confirm your player slot." />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {hudSnapshot.session.players.map((playerSnapshot) => (
                <div
                  className={gameInsetPanelClassName}
                  key={playerSnapshot.playerId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="type-game-title">
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
                  <PretextParagraph
                    className="type-game-body mt-2"
                    text={formatCoopPlayerOutcome(
                      playerSnapshot,
                      hudSnapshot.session.phase
                    )}
                  />
                  {hudSnapshot.session.phase === "waiting-for-players" &&
                  hudSnapshot.session.localPlayerIsLeader &&
                  !playerSnapshot.isLocalPlayer ? (
                    <Button
                      aria-busy={
                        coopKickActionPendingPlayerId === playerSnapshot.playerId ||
                        undefined
                      }
                      className="mt-3"
                      disabled={coopKickActionPendingPlayerId !== null}
                      onClick={() => {
                        onKickCoopPlayer(playerSnapshot.playerId);
                      }}
                      size="xs"
                      type="button"
                      variant="destructive"
                    >
                      Boot player
                    </Button>
                  ) : null}
                  <p className="type-game-caption mt-3">
                    {`${playerSnapshot.hitsLanded} hits / ${playerSnapshot.shotsFired} shots`}
                  </p>
                  <p className="type-game-caption mt-2">
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
