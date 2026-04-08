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
  HandTriggerCalibrationSnapshot
} from "@thumbshooter/shared";

import type {
  GameplayDebugPanelMode,
  GameplaySignal,
  GameplayTelemetrySnapshot,
  HandTrackingTelemetrySnapshot
} from "../../game";
import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { LocalArenaSimulation } from "../../game/classes/local-arena-simulation";
import { WebGpuGameplayRuntime } from "../../game/classes/webgpu-gameplay-runtime";
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
  readonly debugPanelMode: GameplayDebugPanelMode;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly onBestScoreChange: (bestScore: number) => void;
  readonly onGameplaySignal: (signal: GameplaySignal) => void;
  readonly onOpenMenu: () => void;
  readonly selectedReticleLabel: string;
  readonly triggerCalibration: HandTriggerCalibrationSnapshot | null;
  readonly username: string;
  readonly weaponLabel: string;
}

export function GameplayStageScreen({
  aimCalibration,
  audioStatusLabel,
  bestScore,
  debugPanelMode,
  handTrackingRuntime,
  onBestScoreChange,
  onGameplaySignal,
  onOpenMenu,
  selectedReticleLabel,
  triggerCalibration,
  username,
  weaponLabel
}: GameplayStageScreenProps) {
  const showDeveloperUi = import.meta.env.DEV;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bestScoreRef = useRef(bestScore);
  const runtimeStartVersionRef = useRef(0);
  const handleGameplaySignal = useEffectEvent((signal: GameplaySignal) => {
    onGameplaySignal(signal);
  });
  const [arenaSimulation] = useState(
    () =>
      new LocalArenaSimulation(aimCalibration, undefined, {
        emitGameplaySignal: handleGameplaySignal,
        triggerCalibration
      })
  );
  const [gameplayRuntime] = useState(
    () => new WebGpuGameplayRuntime(handTrackingRuntime, arenaSimulation)
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
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
    handTrackingRuntime.telemetrySnapshot;

  useEffect(() => {
    let cancelled = false;

    void handTrackingRuntime.ensureStarted().catch((error) => {
      if (cancelled) {
        return;
      }

      setRuntimeError((currentValue) =>
        currentValue ??
        handTrackingRuntime.snapshot.failureReason ??
        (error instanceof Error ? error.message : "Hand tracking runtime failed.")
      );
    });

    return () => {
      cancelled = true;
    };
  }, [handTrackingRuntime]);

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
  }, [gameplayRuntime, handTrackingRuntime]);

  useEffect(() => {
    const nextBestScore = hudSnapshot.session.score;

    if (nextBestScore <= bestScoreRef.current) {
      return;
    }

    bestScoreRef.current = nextBestScore;
    onBestScoreChange(nextBestScore);
  }, [hudSnapshot.session.score, onBestScoreChange]);

  return (
    <ImmersiveStageFrame>
      <div className="relative flex-1 overflow-hidden">
        <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.08),_transparent_28%)]" />
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
          hudSnapshot={hudSnapshot}
          onOpenMenu={onOpenMenu}
          onRestartSession={handleRestartSession}
          onRetryRuntime={handleRetryRuntime}
          runtimeError={runtimeError}
          selectedReticleLabel={selectedReticleLabel}
          username={username}
          weaponLabel={weaponLabel}
        />
      </div>
    </ImmersiveStageFrame>
  );
}
