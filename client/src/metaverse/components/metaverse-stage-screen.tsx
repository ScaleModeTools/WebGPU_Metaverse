import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import type {
  ExperienceId,
  GameplayInputModeId,
  GameplaySessionMode
} from "@webgpu-metaverse/shared";

import { DuckHuntLaunchPanel } from "../../experiences/duck-hunt/components/duck-hunt-launch-panel";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";
import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import {
  metaverseControlModes,
  resolveMetaverseControlMode
} from "../config/metaverse-control-modes";
import {
  createMetaverseLocalPlayerIdentity,
  createMetaversePresenceClient
} from "../config/metaverse-presence-network";
import { createMetaverseWorldClient } from "../config/metaverse-world-network";
import {
  resolveMetaverseLocomotionMode
} from "../config/metaverse-locomotion-modes";
import { MetaverseDeveloperOverlay } from "./metaverse-developer-overlay";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentProofConfig
} from "../types/metaverse-runtime";
import { WebGpuMetaverseRuntime } from "../classes/webgpu-metaverse-runtime";

interface MetaverseStageScreenProps {
  readonly attachmentProofConfig: MetaverseAttachmentProofConfig | null;
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly characterProofConfig: MetaverseCharacterProofConfig | null;
  readonly coopRoomIdDraft: string;
  readonly environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly gameplayInputMode: GameplayInputModeId;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onMetaverseControlModeChange: (
    controlMode: MetaverseControlModeId
  ) => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly onSetupRequest: () => void;
  readonly sessionMode: GameplaySessionMode;
  readonly username: string;
}

export function MetaverseStageScreen({
  attachmentProofConfig,
  audioStatusLabel,
  calibrationQualityLabel,
  characterProofConfig,
  coopRoomIdDraft,
  environmentProofConfig,
  gameplayInputMode,
  metaverseControlMode,
  onCoopRoomIdDraftChange,
  onExperienceLaunchRequest,
  onMetaverseControlModeChange,
  onRecalibrationRequest,
  onSessionModeChange,
  onSetupRequest,
  sessionMode,
  username
}: MetaverseStageScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metaverseRuntime = useMemo(
    () => {
      const localPlayerIdentity = createMetaverseLocalPlayerIdentity(
        username,
        characterProofConfig?.characterId ?? "metaverse-mannequin-v1"
      );

      return new WebGpuMetaverseRuntime(undefined, {
        attachmentProofConfig,
        characterProofConfig,
        createMetaversePresenceClient,
        createMetaverseWorldClient,
        environmentProofConfig,
        localPlayerIdentity
      });
    },
    [
      attachmentProofConfig,
      characterProofConfig,
      environmentProofConfig,
      username
    ]
  );
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
  const selectedControlMode = resolveMetaverseControlMode(metaverseControlMode);
  const selectedLocomotionMode = resolveMetaverseLocomotionMode(
    hudSnapshot.locomotionMode
  );
  const showDeveloperOverlay = import.meta.env.DEV;

  useEffect(() => {
    metaverseRuntime.setControlMode(metaverseControlMode);
  }, [metaverseControlMode, metaverseRuntime]);

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    let cancelled = false;
    setRuntimeError(null);

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
  const focusedMountable = hudSnapshot.focusedMountable;
  const focusDistanceLabel =
    focusedPortal === null
      ? null
      : `${focusedPortal.distanceFromCamera.toFixed(1)}m from portal`;
  const mountedEnvironment = hudSnapshot.mountedEnvironment;
  const mountDistanceLabel =
    focusedMountable === null
      ? null
      : `${focusedMountable.distanceFromCamera.toFixed(1)}m inside mount collider`;
  const focusedBoardingEntries = focusedMountable?.boardingEntries ?? [];
  const selectableSeatTargets =
    mountedEnvironment === null
      ? focusedMountable?.directSeatTargets ?? []
      : mountedEnvironment.directSeatTargets.filter(
          (seatTarget) => seatTarget.seatId !== mountedEnvironment.seatId
        );

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
                Keep hub traversal and hub controls separate. Surface travel,
                swimming, and mounted travel now transition from runtime state
                instead of a manual locomotion selector.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-3xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  Current locomotion state: {selectedLocomotionMode.label}
                </div>
                <div className="rounded-3xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  {selectedLocomotionMode.description}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedLocomotionMode.controlsSummary.map((instruction) => (
                    <div
                      className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground"
                      key={instruction}
                    >
                      {instruction}
                    </div>
                  ))}
                </div>
                <ToggleGroup
                  className="w-full justify-start"
                  onValueChange={(nextValue) => {
                    if (nextValue.length === 0) {
                      return;
                    }

                    onMetaverseControlModeChange(nextValue as MetaverseControlModeId);
                  }}
                  type="single"
                  value={metaverseControlMode}
                  variant="outline"
                >
                  {metaverseControlModes.map((controlMode) => (
                    <ToggleGroupItem
                      className="flex-1"
                      key={controlMode.id}
                      value={controlMode.id}
                    >
                      {controlMode.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="rounded-3xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                  {selectedControlMode.description}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedControlMode.controlsSummary.map((instruction) => (
                    <div
                      className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground"
                      key={instruction}
                    >
                      {instruction}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={onSetupRequest} type="button" variant="outline">
                  Open setup
                </Button>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  Hub controls: {resolveMetaverseControlMode(hudSnapshot.controlMode).label}
                </div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  Locomotion: {resolveMetaverseLocomotionMode(hudSnapshot.locomotionMode).label}
                </div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  Presence: {hudSnapshot.presence.state}
                </div>
                <div className="rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  Remote players: {hudSnapshot.presence.remotePlayerCount}
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
                  ? "The first portal leads to Duck Hunt. More experiences can join this shell while hub controls stay separate from experience-local gameplay input."
                  : focusDistanceLabel}
              </p>
              {hudSnapshot.presence.lastError !== null ? (
                <p className="mt-3 text-sm text-amber-200">
                  Presence issue: {hudSnapshot.presence.lastError}
                </p>
              ) : null}
              {runtimeError !== null ? (
                <p className="mt-3 text-sm text-destructive">{runtimeError}</p>
              ) : null}
            </div>

            {mountedEnvironment !== null || focusedMountable !== null ? (
              <div className="pointer-events-auto max-w-sm rounded-[1.4rem] border border-border/70 bg-card/82 p-4 shadow-[0_20px_60px_rgb(15_23_42_/_0.22)] backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Vehicle Access
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {mountedEnvironment !== null
                    ? mountedEnvironment.occupancyKind === "seat"
                      ? `${mountedEnvironment.label}: ${mountedEnvironment.occupantLabel}.`
                      : `${mountedEnvironment.label} boarded via ${mountedEnvironment.occupantLabel.toLowerCase()}.`
                    : `${focusedMountable?.label} is in range.`}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mountedEnvironment !== null
                    ? mountedEnvironment.occupancyKind === "entry"
                      ? "Boarding is separate from seat ownership here. Direct seats stay claimable until you intentionally take one."
                      : mountedEnvironment.occupantRole === "driver"
                        ? "Hub movement controls now drive this vehicle. Propulsion cuts out when the hull is beached on hard ground."
                        : "This seat keeps vehicle steering locked to the active driver."
                    : focusedBoardingEntries.length > 0 &&
                        selectableSeatTargets.length > 0
                      ? "Board the deck first or take a direct seat now."
                      : mountDistanceLabel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mountedEnvironment === null
                    ? focusedBoardingEntries.map((entry) => (
                        <Button
                          key={entry.entryId}
                          onClick={() => {
                            metaverseRuntime.boardMountable(entry.entryId);
                          }}
                          type="button"
                        >
                          {entry.label}
                        </Button>
                      ))
                    : null}
                  {selectableSeatTargets.map((seatTarget) => (
                    <Button
                      key={seatTarget.seatId}
                      onClick={() => {
                        metaverseRuntime.occupySeat(seatTarget.seatId);
                      }}
                      type="button"
                      variant={mountedEnvironment === null ? "outline" : "default"}
                    >
                      {mountedEnvironment === null
                        ? `Sit ${seatTarget.label}`
                        : `Move to ${seatTarget.label}`}
                    </Button>
                  ))}
                  {mountedEnvironment !== null ? (
                    <Button
                      onClick={() => {
                        metaverseRuntime.leaveMountedEnvironment();
                      }}
                      type="button"
                      variant="outline"
                    >
                      Leave {mountedEnvironment.label}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            {focusedPortal?.experienceId === "duck-hunt" ? (
              <div className="pointer-events-auto w-full max-w-2xl">
                <DuckHuntLaunchPanel
                  audioStatusLabel={audioStatusLabel}
                  calibrationQualityLabel={calibrationQualityLabel}
                  coopRoomIdDraft={coopRoomIdDraft}
                  inputMode={gameplayInputMode}
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

        {showDeveloperOverlay ? (
          <MetaverseDeveloperOverlay hudSnapshot={hudSnapshot} />
        ) : null}
      </div>
    </ImmersiveStageFrame>
  );
}
