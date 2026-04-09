import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import type {
  ExperienceId,
  GameplayInputModeId,
  GameplaySessionMode
} from "@thumbshooter/shared";

import { DuckHuntLaunchPanel } from "../../experiences/duck-hunt/components";
import { Button } from "@/components/ui/button";
import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import { WebGpuMetaverseRuntime } from "../classes/webgpu-metaverse-runtime";

interface MetaverseStageScreenProps {
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly coopRoomIdDraft: string;
  readonly inputMode: GameplayInputModeId;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly onSetupRequest: () => void;
  readonly sessionMode: GameplaySessionMode;
  readonly username: string;
}

export function MetaverseStageScreen({
  audioStatusLabel,
  calibrationQualityLabel,
  coopRoomIdDraft,
  inputMode,
  onCoopRoomIdDraftChange,
  onExperienceLaunchRequest,
  onRecalibrationRequest,
  onSessionModeChange,
  onSetupRequest,
  sessionMode,
  username
}: MetaverseStageScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [metaverseRuntime] = useState(() => new WebGpuMetaverseRuntime());
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const subscribeUiUpdates = useCallback(
    (notifyReact: () => void) => metaverseRuntime.subscribeUiUpdates(notifyReact),
    [metaverseRuntime]
  );
  const hudSnapshot = useSyncExternalStore(
    subscribeUiUpdates,
    () => metaverseRuntime.hudSnapshot,
    () => metaverseRuntime.hudSnapshot
  );

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    let cancelled = false;

    void metaverseRuntime.start(canvasRef.current).catch((error) => {
      if (cancelled) {
        return;
      }

      setRuntimeError(
        error instanceof Error ? error.message : "Metaverse boot failed."
      );
    });

    return () => {
      cancelled = true;
      metaverseRuntime.dispose();
    };
  }, [metaverseRuntime]);

  const focusedPortal = hudSnapshot.focusedPortal;
  const focusDistanceLabel =
    focusedPortal === null
      ? null
      : `${focusedPortal.distanceFromCamera.toFixed(1)}m from portal`;

  return (
    <ImmersiveStageFrame className="bg-game-stage">
      <div className="relative flex h-full w-full">
        <canvas
          aria-hidden="true"
          className="h-full w-full touch-none"
          ref={canvasRef}
        />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="pointer-events-auto max-w-md rounded-[1.4rem] border border-border/70 bg-card/82 p-4 shadow-[0_20px_60px_rgb(15_23_42_/_0.22)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Ocean Hub
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">
                Welcome back, {username}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Fly the ocean shell with `WASD`, use the mouse to look, hold
                `Shift` to boost, and tap `Q` or `Space` to move vertically.
                Click the water to capture the mouse, then press `Esc` to unlock
                the cursor for portal UI.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={onSetupRequest} type="button" variant="outline">
                  Open setup
                </Button>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  {hudSnapshot.pointerLockActive
                    ? "Pointer lock live"
                    : "Click the water to capture mouse"}
                </div>
              </div>
            </div>

            <div className="pointer-events-auto max-w-sm rounded-[1.4rem] border border-border/70 bg-card/82 p-4 shadow-[0_20px_60px_rgb(15_23_42_/_0.22)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Portal scan
              </p>
              <p className="mt-2 text-sm text-foreground">
                {focusedPortal === null
                  ? "Approach the glowing ring over the water to inspect an experience."
                  : `${focusedPortal.label} is in range.`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {focusedPortal === null
                  ? "The first portal leads to Duck Hunt. More experiences can join this same shell later."
                  : focusDistanceLabel}
              </p>
              {runtimeError !== null ? (
                <p className="mt-3 text-sm text-destructive">{runtimeError}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            {focusedPortal?.experienceId === "duck-hunt" ? (
              <div className="pointer-events-auto w-full max-w-2xl">
                <DuckHuntLaunchPanel
                  audioStatusLabel={audioStatusLabel}
                  calibrationQualityLabel={calibrationQualityLabel}
                  coopRoomIdDraft={coopRoomIdDraft}
                  inputMode={inputMode}
                  onCoopRoomIdDraftChange={onCoopRoomIdDraftChange}
                  onLaunchRequest={() => {
                    onExperienceLaunchRequest("duck-hunt");
                  }}
                  onRecalibrationRequest={onRecalibrationRequest}
                  onSessionModeChange={onSessionModeChange}
                  sessionMode={sessionMode}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ImmersiveStageFrame>
  );
}
