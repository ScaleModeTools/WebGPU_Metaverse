import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { AffineAimTransformSnapshot } from "@thumbshooter/shared";

import type {
  GameplayDebugPanelMode,
  GameplaySignal,
  GameplayTelemetrySnapshot,
  HandTrackingTelemetrySnapshot
} from "../../game";
import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { LocalArenaSimulation } from "../../game/classes/local-arena-simulation";
import { WebGpuGameplayRuntime } from "../../game/classes/webgpu-gameplay-runtime";
import { GameplayDebugOverlay, GameplayHudOverlay } from "../../ui";
import { Card } from "@/components/ui/card";

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
  username,
  weaponLabel
}: GameplayStageScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bestScoreRef = useRef(bestScore);
  const handleGameplaySignal = useEffectEvent((signal: GameplaySignal) => {
    onGameplaySignal(signal);
  });
  const [arenaSimulation] = useState(
    () =>
      new LocalArenaSimulation(aimCalibration, undefined, {
        emitGameplaySignal: handleGameplaySignal
      })
  );
  const [gameplayRuntime] = useState(
    () => new WebGpuGameplayRuntime(handTrackingRuntime, arenaSimulation)
  );
  const [hudSnapshot, setHudSnapshot] = useState(() => gameplayRuntime.hudSnapshot);
  const [gameplayTelemetry, setGameplayTelemetry] = useState<GameplayTelemetrySnapshot>(
    () => gameplayRuntime.telemetrySnapshot
  );
  const [trackingTelemetry, setTrackingTelemetry] = useState<HandTrackingTelemetrySnapshot>(
    () => handTrackingRuntime.telemetrySnapshot
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const handleStartRuntime = useEffectEvent(async () => {
    if (canvasRef.current === null) {
      return;
    }

    try {
      const snapshot = await gameplayRuntime.start(canvasRef.current);

      setHudSnapshot(snapshot);
      setGameplayTelemetry(gameplayRuntime.telemetrySnapshot);
      setTrackingTelemetry(handTrackingRuntime.telemetrySnapshot);
      setRuntimeError(null);
    } catch (error) {
      setHudSnapshot(gameplayRuntime.hudSnapshot);
      setGameplayTelemetry(gameplayRuntime.telemetrySnapshot);
      setTrackingTelemetry(handTrackingRuntime.telemetrySnapshot);
      setRuntimeError(
        gameplayRuntime.hudSnapshot.failureReason ??
          (error instanceof Error ? error.message : "Gameplay runtime failed.")
      );
    }
  });

  const handleRetryRuntime = useEffectEvent(() => {
    gameplayRuntime.dispose();
    setHudSnapshot(gameplayRuntime.hudSnapshot);
    setGameplayTelemetry(gameplayRuntime.telemetrySnapshot);
    setTrackingTelemetry(handTrackingRuntime.telemetrySnapshot);
    setRuntimeError(null);
    void handleStartRuntime();
  });

  const handleRestartSession = useEffectEvent(() => {
    setRuntimeError(null);
    setHudSnapshot(gameplayRuntime.restartSession());
    setGameplayTelemetry(gameplayRuntime.telemetrySnapshot);
  });

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  useEffect(() => {
    void handleStartRuntime();

    const intervalHandle = window.setInterval(() => {
      setHudSnapshot(gameplayRuntime.hudSnapshot);
      setGameplayTelemetry(gameplayRuntime.telemetrySnapshot);
      setTrackingTelemetry(handTrackingRuntime.telemetrySnapshot);
    }, 150);

    return () => {
      window.clearInterval(intervalHandle);
      gameplayRuntime.dispose();
    };
  }, [gameplayRuntime, handleStartRuntime]);

  useEffect(() => {
    const nextBestScore = hudSnapshot.session.score;

    if (nextBestScore <= bestScoreRef.current) {
      return;
    }

    bestScoreRef.current = nextBestScore;
    onBestScoreChange(nextBestScore);
  }, [hudSnapshot.session.score, onBestScoreChange]);

  return (
    <Card className="relative min-h-[36rem] overflow-hidden rounded-[2rem] border-border/70 bg-card/88 shadow-[0_28px_90px_rgb(15_23_42_/_0.2)] backdrop-blur-xl">
      <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.08),_transparent_28%)]" />
      <GameplayDebugOverlay
        gameplayTelemetry={gameplayTelemetry}
        mode={debugPanelMode}
        trackingTelemetry={trackingTelemetry}
      />
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
    </Card>
  );
}
