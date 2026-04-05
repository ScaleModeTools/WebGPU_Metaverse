import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { AffineAimTransformSnapshot } from "@thumbshooter/shared";

import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { LocalArenaSimulation } from "../../game/classes/local-arena-simulation";
import { WebGpuGameplayRuntime } from "../../game/classes/webgpu-gameplay-runtime";
import { GameplayHudOverlay } from "../../ui";
import { Card } from "@/components/ui/card";

interface GameplayStageScreenProps {
  readonly aimCalibration: AffineAimTransformSnapshot;
  readonly audioStatusLabel: string;
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly onOpenMenu: () => void;
  readonly selectedReticleLabel: string;
  readonly username: string;
  readonly weaponLabel: string;
}

function aimPointMatches(
  currentValue: { readonly x: number; readonly y: number } | null,
  nextValue: { readonly x: number; readonly y: number } | null
): boolean {
  if (currentValue === nextValue) {
    return true;
  }

  if (currentValue === null || nextValue === null) {
    return false;
  }

  return currentValue.x === nextValue.x && currentValue.y === nextValue.y;
}

export function GameplayStageScreen({
  aimCalibration,
  audioStatusLabel,
  handTrackingRuntime,
  onOpenMenu,
  selectedReticleLabel,
  username,
  weaponLabel
}: GameplayStageScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [arenaSimulation] = useState(
    () => new LocalArenaSimulation(aimCalibration)
  );
  const [gameplayRuntime] = useState(
    () => new WebGpuGameplayRuntime(handTrackingRuntime, arenaSimulation)
  );
  const [hudSnapshot, setHudSnapshot] = useState(() => gameplayRuntime.hudSnapshot);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const handleStartRuntime = useEffectEvent(async () => {
    if (canvasRef.current === null) {
      return;
    }

    try {
      const snapshot = await gameplayRuntime.start(canvasRef.current);

      setHudSnapshot(snapshot);
      setRuntimeError(null);
    } catch (error) {
      setHudSnapshot(gameplayRuntime.hudSnapshot);
      setRuntimeError(
        gameplayRuntime.hudSnapshot.failureReason ??
          (error instanceof Error ? error.message : "Gameplay runtime failed.")
      );
    }
  });

  const handleRetryRuntime = useEffectEvent(() => {
    gameplayRuntime.dispose();
    setHudSnapshot(gameplayRuntime.hudSnapshot);
    setRuntimeError(null);
    void handleStartRuntime();
  });

  useEffect(() => {
    void handleStartRuntime();

    const intervalHandle = window.setInterval(() => {
      const nextSnapshot = gameplayRuntime.hudSnapshot;

      setHudSnapshot((currentSnapshot) => {
        if (
          currentSnapshot.lifecycle === nextSnapshot.lifecycle &&
          currentSnapshot.trackingState === nextSnapshot.trackingState &&
          currentSnapshot.failureReason === nextSnapshot.failureReason &&
          aimPointMatches(currentSnapshot.aimPoint, nextSnapshot.aimPoint)
        ) {
          return currentSnapshot;
        }

        return nextSnapshot;
      });
    }, 150);

    return () => {
      window.clearInterval(intervalHandle);
      gameplayRuntime.dispose();
    };
  }, [gameplayRuntime, handleStartRuntime]);

  return (
    <Card className="relative min-h-[36rem] overflow-hidden rounded-[2rem] border-border/70 bg-card/88 shadow-[0_28px_90px_rgb(15_23_42_/_0.2)] backdrop-blur-xl">
      <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgb(56_189_248_/_0.08),_transparent_28%)]" />
      <GameplayHudOverlay
        audioStatusLabel={audioStatusLabel}
        hudSnapshot={hudSnapshot}
        onOpenMenu={onOpenMenu}
        onRetryRuntime={handleRetryRuntime}
        runtimeError={runtimeError}
        selectedReticleLabel={selectedReticleLabel}
        username={username}
        weaponLabel={weaponLabel}
      />
    </Card>
  );
}
