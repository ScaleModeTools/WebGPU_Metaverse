import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import type {
  AffineAimTransformSnapshot,
  CoopRoomId,
  CoopPlayerId,
  HandTriggerCalibrationSnapshot
} from "@thumbshooter/shared";
import { createCoopPlayerId, type Username } from "@thumbshooter/shared";

import type {
  GameplayDebugPanelMode,
  GameplayInputModeId,
  GameplayInputSource,
  GameplaySessionMode,
  GameplaySignal,
  GameplayTelemetrySnapshot,
  HandTrackingTelemetrySnapshot
} from "../../game";
import { CoopArenaSimulation } from "../../game/classes/coop-arena-simulation";
import { LocalArenaSimulation } from "../../game/classes/local-arena-simulation";
import { WebGpuGameplayRuntime } from "../../game/classes/webgpu-gameplay-runtime";
import type { GameplayArenaRuntime } from "../../game/types/gameplay-arena-runtime";
import {
  CoopRoomClient,
  coopRoomClientConfig,
  type CoopRoomClientStatusSnapshot
} from "../../network";
import {
  GameplayDebugOverlay,
  GameplayDeveloperPanel,
  GameplayHudOverlay
} from "../../ui";

import { ImmersiveStageFrame } from "./immersive-stage-frame";

interface GameplayStageScreenProps {
  readonly aimCalibration: AffineAimTransformSnapshot;
  readonly audioStatusLabel: string;
  readonly bestScore: number;
  readonly coopRoomId: CoopRoomId;
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly inputMode: GameplayInputModeId;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onOpenMenu: () => void;
  readonly selectedReticleLabel: string;
  readonly sessionMode: GameplaySessionMode;
  readonly trackingSource: GameplayInputSource;
  readonly triggerCalibration: HandTriggerCalibrationSnapshot | null;
  readonly username: Username;
  readonly weaponLabel: string;
}

function createEphemeralCoopPlayerId(username: string): CoopPlayerId {
  const normalizedUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const randomSuffix =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  const playerId = createCoopPlayerId(
    `${normalizedUsername.length === 0 ? "player" : normalizedUsername}-${randomSuffix}`
  );

  if (playerId === null) {
    throw new Error("Unable to create a co-op player id for gameplay.");
  }

  return playerId;
}

function createIdleCoopRoomStatusSnapshot(
  roomId: CoopRoomId
): CoopRoomClientStatusSnapshot {
  return Object.freeze({
    joined: false,
    lastError: null,
    lastSnapshotTick: null,
    playerId: null,
    roomId,
    state: "idle"
  });
}

export function GameplayStageScreen({
  aimCalibration,
  audioStatusLabel,
  bestScore,
  coopRoomId,
  debugPanelMode,
  inputMode,
  onBestScoreChange,
  onGameplaySignal,
  onOpenMenu,
  selectedReticleLabel,
  sessionMode,
  trackingSource,
  triggerCalibration,
  username,
  weaponLabel
}: GameplayStageScreenProps) {
  const showDeveloperUi = import.meta.env.DEV;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coopRoomDisposeHandleRef =
    useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bestScoreRef = useRef(bestScore);
  const runtimeStartVersionRef = useRef(0);
  const handleGameplaySignal = useEffectEvent((signal: GameplaySignal) => {
    onGameplaySignal(signal);
  });
  const [coopPlayerId] = useState(() =>
    sessionMode === "co-op" ? createEphemeralCoopPlayerId(username) : null
  );
  const [coopRoomClient] = useState(() =>
    sessionMode === "co-op"
      ? new CoopRoomClient({
          ...coopRoomClientConfig,
          roomId: coopRoomId
        })
      : null
  );
  const [idleCoopRoomStatusSnapshot] = useState(() =>
    createIdleCoopRoomStatusSnapshot(coopRoomId)
  );
  const [arenaSimulation] = useState<GameplayArenaRuntime>(() =>
    sessionMode === "co-op" && coopRoomClient !== null && coopPlayerId !== null
      ? new CoopArenaSimulation(aimCalibration, coopRoomClient, undefined, {
          emitGameplaySignal: handleGameplaySignal,
          playerId: coopPlayerId,
          triggerCalibration
        })
      : new LocalArenaSimulation(aimCalibration, undefined, {
          emitGameplaySignal: handleGameplaySignal,
          triggerCalibration
        })
  );
  const [gameplayRuntime] = useState(
    () => new WebGpuGameplayRuntime(trackingSource, arenaSimulation)
  );
  const subscribeCoopRoomUpdates = useCallback(
    (notifyReact: () => void) =>
      coopRoomClient?.subscribeUpdates(notifyReact) ?? (() => {}),
    [coopRoomClient]
  );
  const coopRoomStatus = useSyncExternalStore(
    subscribeCoopRoomUpdates,
    () => coopRoomClient?.statusSnapshot ?? idleCoopRoomStatusSnapshot,
    () => coopRoomClient?.statusSnapshot ?? idleCoopRoomStatusSnapshot
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [coopKickActionPendingPlayerId, setCoopKickActionPendingPlayerId] =
    useState<CoopPlayerId | null>(null);
  const [coopReadyActionPending, setCoopReadyActionPending] = useState(false);
  const [coopSessionStartPending, setCoopSessionStartPending] = useState(false);
  const subscribeGameplayUiUpdates = useCallback(
    (notifyReact: () => void) => gameplayRuntime.subscribeUiUpdates(notifyReact),
    [gameplayRuntime]
  );
  const hudSnapshot = useSyncExternalStore(
    subscribeGameplayUiUpdates,
    () => gameplayRuntime.hudSnapshot,
    () => gameplayRuntime.hudSnapshot
  );
  const gameplayTelemetry: GameplayTelemetrySnapshot = gameplayRuntime.telemetrySnapshot;
  const trackingTelemetry: HandTrackingTelemetrySnapshot =
    trackingSource.telemetrySnapshot;
  const coopLocalPlayer =
    hudSnapshot.session.mode === "co-op"
      ? hudSnapshot.session.players.find((playerSnapshot) => playerSnapshot.isLocalPlayer) ??
        null
      : null;

  useEffect(() => {
    let cancelled = false;

    void trackingSource.ensureStarted().catch((error) => {
      if (cancelled) {
        return;
      }

      setRuntimeError((currentValue) =>
        currentValue ??
        trackingSource.snapshot.failureReason ??
        (error instanceof Error ? error.message : "Gameplay input failed.")
      );
    });

    return () => {
      cancelled = true;
    };
  }, [trackingSource]);

  useEffect(() => {
    if (coopRoomClient === null || coopPlayerId === null) {
      return;
    }

    if (coopRoomDisposeHandleRef.current !== null) {
      globalThis.clearTimeout(coopRoomDisposeHandleRef.current);
      coopRoomDisposeHandleRef.current = null;
    }

    let cancelled = false;

    void coopRoomClient
      .ensureJoined({
        playerId: coopPlayerId,
        ready: false,
        username
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
      });

    return () => {
      cancelled = true;
      coopRoomDisposeHandleRef.current = globalThis.setTimeout(() => {
        coopRoomDisposeHandleRef.current = null;
        coopRoomClient.dispose();
      }, 0);
    };
  }, [coopPlayerId, coopRoomClient, username]);

  useEffect(() => {
    if (trackingSource.attachViewport === undefined || viewportRef.current === null) {
      return;
    }

    return trackingSource.attachViewport(viewportRef.current);
  }, [trackingSource]);

  const handleStartRuntime = useEffectEvent(async () => {
    if (canvasRef.current === null) {
      return;
    }

    const startVersion = runtimeStartVersionRef.current + 1;

    runtimeStartVersionRef.current = startVersion;

    try {
      await gameplayRuntime.start(canvasRef.current);

      if (startVersion !== runtimeStartVersionRef.current) {
        return;
      }

      setRuntimeError(null);
    } catch (error) {
      if (startVersion !== runtimeStartVersionRef.current) {
        return;
      }

      setRuntimeError(
        gameplayRuntime.hudSnapshot.failureReason ??
          (error instanceof Error ? error.message : "Gameplay runtime failed.")
      );
    }
  });

  const handleRetryRuntime = useEffectEvent(() => {
    gameplayRuntime.dispose();
    setRuntimeError(null);
    void handleStartRuntime();
  });

  const handleRestartSession = useEffectEvent(() => {
    setRuntimeError(null);
    gameplayRuntime.restartSession();
  });

  const handleToggleCoopReady = useEffectEvent(() => {
    if (
      coopRoomClient === null ||
      coopLocalPlayer === null ||
      coopReadyActionPending ||
      hudSnapshot.session.mode !== "co-op" ||
      hudSnapshot.session.phase !== "waiting-for-players"
    ) {
      return;
    }

    setCoopReadyActionPending(true);
    void coopRoomClient
      .setPlayerReady(!coopLocalPlayer.ready)
      .catch(() => {
        // The room client snapshots surface transport errors to the HUD.
      })
      .finally(() => {
        setCoopReadyActionPending(false);
      });
  });

  const handleStartCoopSession = useEffectEvent(() => {
    if (
      coopRoomClient === null ||
      coopSessionStartPending ||
      hudSnapshot.session.mode !== "co-op" ||
      !hudSnapshot.session.localPlayerCanStart
    ) {
      return;
    }

    setCoopSessionStartPending(true);
    void coopRoomClient
      .startSession()
      .catch(() => {
        // The room client snapshots surface transport errors to the HUD.
      })
      .finally(() => {
        setCoopSessionStartPending(false);
      });
  });

  const handleKickCoopPlayer = useEffectEvent((targetPlayerId: CoopPlayerId) => {
    if (
      coopRoomClient === null ||
      coopKickActionPendingPlayerId !== null ||
      hudSnapshot.session.mode !== "co-op" ||
      hudSnapshot.session.phase !== "waiting-for-players" ||
      !hudSnapshot.session.localPlayerIsLeader ||
      targetPlayerId === coopPlayerId
    ) {
      return;
    }

    setCoopKickActionPendingPlayerId(targetPlayerId);
    void coopRoomClient
      .kickPlayer(targetPlayerId)
      .catch(() => {
        // The room client snapshots surface transport errors to the HUD.
      })
      .finally(() => {
        setCoopKickActionPendingPlayerId((currentPlayerId) =>
          currentPlayerId === targetPlayerId ? null : currentPlayerId
        );
      });
  });

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  useEffect(() => {
    void handleStartRuntime();

    return () => {
      runtimeStartVersionRef.current += 1;
      gameplayRuntime.dispose();
    };
    // Effect events must stay out of dependency arrays or the runtime gets
    // torn down on the first post-boot rerender before RAF can advance.
  }, [gameplayRuntime, trackingSource]);

  useEffect(() => {
    if (hudSnapshot.session.mode !== "single-player") {
      return;
    }

    const nextBestScore = hudSnapshot.session.score;

    if (nextBestScore <= bestScoreRef.current) {
      return;
    }

    bestScoreRef.current = nextBestScore;
    onBestScoreChange(nextBestScore);
  }, [hudSnapshot.session, onBestScoreChange]);

  return (
    <ImmersiveStageFrame>
      <div className="relative flex-1 overflow-hidden" ref={viewportRef}>
        <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgb(56_189_248/0.08),transparent_28%)]" />
        {showDeveloperUi ? (
          <>
            <GameplayDeveloperPanel gameplayTelemetry={gameplayTelemetry} />
            <GameplayDebugOverlay
              gameplayTelemetry={gameplayTelemetry}
              mode={debugPanelMode}
              trackingTelemetry={trackingTelemetry}
            />
          </>
        ) : null}
        <GameplayHudOverlay
          audioStatusLabel={audioStatusLabel}
          bestScore={bestScore}
          coopReadyActionAvailable={
            hudSnapshot.session.mode === "co-op" &&
            hudSnapshot.session.phase === "waiting-for-players"
          }
          coopReadyActionBusy={coopReadyActionPending}
          coopReadyActionDisabled={
            coopLocalPlayer === null ||
            coopReadyActionPending ||
            coopRoomStatus.state === "joining" ||
            coopRoomStatus.state === "disposed"
          }
          coopReadyActionLabel={
            coopLocalPlayer?.ready === true ? "Unready" : "Ready up"
          }
          coopStartActionAvailable={
            hudSnapshot.session.mode === "co-op" &&
            hudSnapshot.session.localPlayerCanStart
          }
          coopStartActionBusy={coopSessionStartPending}
          coopStartActionDisabled={
            coopSessionStartPending ||
            coopRoomStatus.state === "joining" ||
            coopRoomStatus.state === "disposed" ||
            !(
              hudSnapshot.session.mode === "co-op" &&
              hudSnapshot.session.localPlayerCanStart
            )
          }
          hudSnapshot={hudSnapshot}
          inputMode={inputMode}
          onOpenMenu={onOpenMenu}
          onKickCoopPlayer={handleKickCoopPlayer}
          onRestartSession={handleRestartSession}
          onRetryRuntime={handleRetryRuntime}
          onStartCoopSession={handleStartCoopSession}
          onToggleCoopReady={handleToggleCoopReady}
          coopKickActionPendingPlayerId={coopKickActionPendingPlayerId}
          runtimeError={runtimeError ?? coopRoomStatus.lastError}
          selectedReticleLabel={selectedReticleLabel}
          username={username}
          weaponLabel={weaponLabel}
        />
      </div>
    </ImmersiveStageFrame>
  );
}
