import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode
} from "react";

import type {
  ExperienceId,
  GameplayInputModeId,
  GameplaySessionMode
} from "@webgpu-metaverse/shared";

import { DuckHuntLaunchPanel } from "../../experiences/duck-hunt/components/duck-hunt-launch-panel";
import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";
import {
  metaverseControlModes,
  resolveMetaverseControlMode
} from "../config/metaverse-control-modes";
import {
  resolveMetaverseLocomotionMode
} from "../config/metaverse-locomotion-modes";
import {
  createMetaverseLocalPlayerIdentity,
  createMetaversePresenceClient
} from "../config/metaverse-presence-network";
import { createMetaverseWorldClient } from "../config/metaverse-world-network";
import { WebGpuMetaverseRuntime } from "../classes/webgpu-metaverse-runtime";
import { MetaverseDeveloperOverlay } from "./metaverse-developer-overlay";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentProofConfig
} from "../types/metaverse-runtime";

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

interface MetaverseHudSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly strong?: boolean;
}

interface MetaverseHudFrameProps {
  readonly children: ReactNode;
  readonly className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveMetaverseHudScale(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return 1;
  }

  const viewportScale = clamp(
    Math.pow(Math.min(viewportWidth / 1440, viewportHeight / 960), 0.25),
    0.78,
    1
  );
  const dprScale =
    devicePixelRatio <= 1
      ? 1
      : clamp(1 - (devicePixelRatio - 1) * 0.06, 0.88, 1);

  return clamp(viewportScale * dprScale, 0.72, 1);
}

function createMetaverseHudStyle(scale: number): CSSProperties {
  return {
    "--game-ui-scale": `${scale}`,
    "--metaverse-hud-chip-padding-x": `${12 * scale}px`,
    "--metaverse-hud-chip-padding-y": `${8 * scale}px`,
    "--metaverse-hud-edge": `${16 * scale}px`,
    "--metaverse-hud-gap": `${24 * scale}px`,
    "--metaverse-hud-inset-padding": `${14 * scale}px`,
    "--metaverse-hud-inset-radius": `${16 * scale}px`,
    "--metaverse-hud-panel-padding": `${20 * scale}px`,
    "--metaverse-hud-panel-radius": `${24 * scale}px`
  } as CSSProperties;
}

function MetaverseHudSurface({
  children,
  className,
  strong = false
}: MetaverseHudSurfaceProps) {
  return (
    <div
      className={[
        "pointer-events-auto min-w-0 w-full rounded-[var(--metaverse-hud-panel-radius)] p-[var(--metaverse-hud-panel-padding)] shadow-[0_20px_60px_rgb(15_23_42_/_0.22)]",
        strong ? "surface-shell-panel-strong" : "surface-shell-panel",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function MetaverseHudFrame({ children, className }: MetaverseHudFrameProps) {
  return (
    <div
      className={[
        "surface-shell-inset min-w-0 rounded-[var(--metaverse-hud-inset-radius)] px-[var(--metaverse-hud-inset-padding)] py-[var(--metaverse-hud-inset-padding)]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function MetaverseHudChip({ children, className }: MetaverseHudFrameProps) {
  return (
    <div
      className={[
        "surface-shell-inset type-shell-detail rounded-full px-[var(--metaverse-hud-chip-padding-x)] py-[var(--metaverse-hud-chip-padding-y)]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
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
  const overlayRef = useRef<HTMLDivElement | null>(null);
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
  const [hudViewport, setHudViewport] = useState({
    height: 720,
    width: 1280
  });
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
  const activeControlMode = resolveMetaverseControlMode(hudSnapshot.controlMode);
  const showDeveloperOverlay = import.meta.env.DEV;

  useEffect(() => {
    const overlayElement = overlayRef.current;

    if (overlayElement === null) {
      return;
    }

    const syncViewport = (width: number, height: number) => {
      const nextWidth = Math.max(1, width);
      const nextHeight = Math.max(1, height);

      setHudViewport((currentViewport) =>
        currentViewport.width === nextWidth &&
        currentViewport.height === nextHeight
          ? currentViewport
          : {
              height: nextHeight,
              width: nextWidth
            }
      );
    };

    const syncViewportFromRect = (width: number, height: number) => {
      syncViewport(width, height);
    };

    const overlayRect = overlayElement.getBoundingClientRect();
    syncViewportFromRect(overlayRect.width, overlayRect.height);

    if (typeof globalThis.ResizeObserver !== "function") {
      const handleResize = () => {
        const nextRect = overlayElement.getBoundingClientRect();
        syncViewportFromRect(nextRect.width, nextRect.height);
      };

      globalThis.addEventListener("resize", handleResize);

      return () => {
        globalThis.removeEventListener("resize", handleResize);
      };
    }

    const resizeObserver = new globalThis.ResizeObserver((entries) => {
      const overlayEntry = entries[0];

      if (overlayEntry === undefined) {
        return;
      }

      syncViewportFromRect(
        overlayEntry.contentRect.width,
        overlayEntry.contentRect.height
      );
    });

    resizeObserver.observe(overlayElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  const hudStyle = useMemo(
    () =>
      createMetaverseHudStyle(
        resolveMetaverseHudScale(
          hudViewport.width,
          hudViewport.height,
          hudSnapshot.telemetry.renderer.devicePixelRatio
        )
      ),
    [
      hudSnapshot.telemetry.renderer.devicePixelRatio,
      hudViewport.height,
      hudViewport.width
    ]
  );
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
      : mountedEnvironment.seatTargets.filter(
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

        <div className="pointer-events-none absolute inset-0 overflow-x-hidden overflow-y-auto">
          <div
            className="flex min-h-full flex-col justify-between gap-[var(--metaverse-hud-gap)] p-[var(--metaverse-hud-edge)]"
            ref={overlayRef}
            style={hudStyle}
          >
            <div className="flex flex-wrap items-start gap-[var(--metaverse-hud-gap)]">
              <MetaverseHudSurface
                className="max-w-[min(36rem,100%)]"
                strong
              >
                <p className="type-shell-banner">Ocean Hub</p>
                <h1 className="mt-2 text-[calc(1.75rem*var(--game-ui-scale))] leading-[1.05] font-semibold text-[color:var(--shell-foreground)]">
                  Welcome back, {username}
                </h1>
                <p className="type-shell-body mt-3">
                  Keep hub traversal and hub controls separate. Surface travel,
                  swimming, and mounted travel now transition from runtime state
                  instead of a manual locomotion selector.
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  <MetaverseHudFrame>
                    <p className="type-shell-caption">Locomotion</p>
                    <p className="type-shell-heading mt-2">
                      {selectedLocomotionMode.label}
                    </p>
                    <p className="type-shell-body mt-2">
                      {selectedLocomotionMode.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedLocomotionMode.controlsSummary.map((instruction) => (
                        <MetaverseHudChip key={instruction}>
                          {instruction}
                        </MetaverseHudChip>
                      ))}
                    </div>
                  </MetaverseHudFrame>

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

                  <MetaverseHudFrame>
                    <p className="type-shell-caption">Control path</p>
                    <p className="type-shell-heading mt-2">
                      {selectedControlMode.label}
                    </p>
                    <p className="type-shell-body mt-2">
                      {selectedControlMode.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedControlMode.controlsSummary.map((instruction) => (
                        <MetaverseHudChip key={instruction}>
                          {instruction}
                        </MetaverseHudChip>
                      ))}
                    </div>
                  </MetaverseHudFrame>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={onSetupRequest} type="button" variant="outline">
                    Open setup
                  </Button>
                  <MetaverseHudChip>
                    Hub controls: {activeControlMode.label}
                  </MetaverseHudChip>
                  <MetaverseHudChip>
                    Locomotion: {selectedLocomotionMode.label}
                  </MetaverseHudChip>
                  <MetaverseHudChip>
                    Presence: {hudSnapshot.presence.state}
                  </MetaverseHudChip>
                  <MetaverseHudChip>
                    Remote players: {hudSnapshot.presence.remotePlayerCount}
                  </MetaverseHudChip>
                </div>
              </MetaverseHudSurface>

              <MetaverseHudSurface className="max-w-[min(24rem,100%)]">
                <p className="type-shell-banner">Portal scan</p>
                <p className="type-shell-heading mt-2">
                  {focusedPortal === null
                    ? "Approach the glowing ring over the water to inspect an experience."
                    : `${focusedPortal.label} is in range.`}
                </p>
                <p className="type-shell-body mt-3">
                  {focusedPortal === null
                    ? "The first portal leads to Duck Hunt. More experiences can join this shell while hub controls stay separate from experience-local gameplay input."
                    : focusDistanceLabel}
                </p>

                {hudSnapshot.presence.lastError !== null ? (
                  <div className="surface-shell-danger mt-4 rounded-[var(--metaverse-hud-inset-radius)] px-[var(--metaverse-hud-inset-padding)] py-[var(--metaverse-hud-inset-padding)]">
                    <p className="type-shell-body text-[color:var(--shell-danger-foreground)]">
                      Presence issue: {hudSnapshot.presence.lastError}
                    </p>
                  </div>
                ) : null}

                {runtimeError !== null ? (
                  <div className="surface-shell-danger mt-4 rounded-[var(--metaverse-hud-inset-radius)] px-[var(--metaverse-hud-inset-padding)] py-[var(--metaverse-hud-inset-padding)]">
                    <p className="type-shell-body text-[color:var(--shell-danger-foreground)]">
                      {runtimeError}
                    </p>
                  </div>
                ) : null}
              </MetaverseHudSurface>

              {mountedEnvironment !== null || focusedMountable !== null ? (
                <MetaverseHudSurface className="max-w-[min(26rem,100%)]">
                  <p className="type-shell-banner">Vehicle access</p>
                  <p className="type-shell-heading mt-2">
                    {mountedEnvironment !== null
                      ? mountedEnvironment.occupancyKind === "seat"
                        ? `${mountedEnvironment.label}: ${mountedEnvironment.occupantLabel}.`
                        : `${mountedEnvironment.label} boarded via ${mountedEnvironment.occupantLabel.toLowerCase()}.`
                      : `${focusedMountable?.label} is in range.`}
                  </p>
                  <p className="type-shell-body mt-3">
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
                </MetaverseHudSurface>
              ) : null}

              {showDeveloperOverlay ? (
                <MetaverseDeveloperOverlay
                  className="max-w-[min(22rem,100%)]"
                  hudScaleStyle={hudStyle}
                  hudSnapshot={hudSnapshot}
                />
              ) : null}
            </div>

            <div className="flex justify-end">
              {focusedPortal?.experienceId === "duck-hunt" ? (
                <div className="pointer-events-auto w-full max-w-[min(48rem,100%)] max-h-[clamp(18rem,55dvh,34rem)] overflow-y-auto overscroll-contain">
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
        </div>
      </div>
    </ImmersiveStageFrame>
  );
}
