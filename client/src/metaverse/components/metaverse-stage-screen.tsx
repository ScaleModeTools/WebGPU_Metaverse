import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import {
  createMetaverseNextMatchRequest,
  type ExperienceId,
  type GameplayInputModeId,
  type MetaverseMatchModeId,
  type MetaverseRoomAssignmentSnapshot
} from "@webgpu-metaverse/shared";

import { metaverseActiveFullBodyCharacterAssetId } from "@/assets/config/character-model-manifest";
import { ImmersiveStageFrame } from "../../ui/components/immersive-stage-frame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { StableInlineText } from "@/components/text-stability";
import { createMetaverseRuntimeConfig } from "../config/metaverse-runtime";
import { createMetaverseRoomDirectoryClient } from "../config/metaverse-room-network";
import {
  createMetaverseLocalPlayerIdentity,
  createMetaverseTeamDeathmatchLocalPlayerIdentity,
  createMetaversePresenceClient
} from "../config/metaverse-presence-network";
import { createMetaverseWorldClient } from "../config/metaverse-world-network";
import { WebGpuMetaverseRuntime } from "../classes/webgpu-metaverse-runtime";
import { registerMetaverseWorldBundleOnServer } from "../world/map-bundles";
import { MetaverseDamageDirectionOverlay } from "./metaverse-damage-direction-overlay";
import { MetaverseInteractionFeedHud } from "./metaverse-interaction-feed-hud";
import { MetaversePlayerRadarHud } from "./metaverse-player-radar-hud";
import {
  MetaverseTeamDeathmatchPostGameOverlay,
  MetaverseTeamDeathmatchScoreboardHud
} from "./metaverse-team-deathmatch-scoreboard-hud";
import { MetaverseWeaponReticleOverlay } from "./metaverse-weapon-reticle-overlay";
import type { AudioCuePlaybackOptions } from "../../audio";
import type { MetaverseCombatAudioCueId } from "../audio";
import type { MetaverseControlModeId } from "../types/metaverse-control-mode";
import type {
  MetaverseAttachmentProofConfig,
  MetaverseCharacterProofConfig,
  MetaverseEnvironmentProofConfig
} from "../types/metaverse-runtime";

interface MetaverseStageScreenProps {
  readonly attachmentProofConfig?: MetaverseAttachmentProofConfig | null;
  readonly attachmentProofConfigs?:
    | readonly MetaverseAttachmentProofConfig[]
    | null;
  readonly audioStatusLabel: string;
  readonly bundleId: string;
  readonly calibrationQualityLabel: string;
  readonly characterProofConfig: MetaverseCharacterProofConfig | null;
  readonly coopRoomIdDraft: string;
  readonly environmentProofConfig: MetaverseEnvironmentProofConfig | null;
  readonly equippedWeaponId: string | null;
  readonly gameplayInputMode: GameplayInputModeId;
  readonly matchMode: MetaverseMatchModeId;
  readonly metaverseControlMode: MetaverseControlModeId;
  readonly onCombatAudioCue: (
    cueId: MetaverseCombatAudioCueId,
    options?: AudioCuePlaybackOptions
  ) => void;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onExperienceLaunchRequest: (experienceId: ExperienceId) => void;
  readonly onRecalibrationRequest: () => void;
  readonly roomAssignment: MetaverseRoomAssignmentSnapshot;
  readonly onSetupRequest: () => void;
  readonly username: string;
  readonly weaponLayoutId?: string | null;
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
    "--game-text-shadow":
      "1px 1px 0 rgb(0 0 0 / 1), 0 0 1px rgb(0 0 0 / 1)",
    "--game-ui-scale": `${scale}`,
    "--metaverse-hud-edge": `${24 * scale}px`,
    "--metaverse-hud-gap": `${24 * scale}px`,
    "--metaverse-hud-inset-padding": `${14 * scale}px`,
    "--metaverse-hud-inset-radius": `${8 * scale}px`,
    "--metaverse-hud-panel-padding": `${20 * scale}px`,
    "--metaverse-hud-panel-radius": `${8 * scale}px`,
    "--metaverse-hud-text-shadow":
      "1px 1px 0 rgb(0 0 0 / 1), 0 0 1px rgb(0 0 0 / 1)"
  } as CSSProperties;
}

function isEditableKeyboardTarget(eventTarget: EventTarget | null): boolean {
  return (
    eventTarget instanceof HTMLElement &&
    (eventTarget.isContentEditable ||
      eventTarget instanceof HTMLInputElement ||
      eventTarget instanceof HTMLTextAreaElement ||
      eventTarget instanceof HTMLSelectElement)
  );
}

function resolveTeamHudTone(
  teamId: "blue" | "red" | null
): {
  readonly barClassName: string;
  readonly insetClassName: string;
  readonly surfaceClassName: string;
} {
  switch (teamId) {
    case "blue":
      return Object.freeze({
        barClassName: "bg-sky-300",
        insetClassName: "bg-[rgb(2_132_199_/_0.18)]",
        surfaceClassName: "border border-sky-200/18 bg-[rgb(14_165_233_/_0.16)]"
      });
    case "red":
      return Object.freeze({
        barClassName: "bg-rose-300",
        insetClassName: "bg-[rgb(225_29_72_/_0.18)]",
        surfaceClassName: "border border-rose-200/18 bg-[rgb(244_63_94_/_0.16)]"
      });
    default:
      return Object.freeze({
        barClassName: "bg-white/85",
        insetClassName: "bg-[rgb(15_23_42_/_0.16)]",
        surfaceClassName: "border border-white/10 bg-[rgb(15_23_42_/_0.34)]"
      });
  }
}

function formatMatchTimeLabel(timeRemainingMs: number | null): string {
  if (timeRemainingMs === null) {
    return "No timer";
  }

  const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");

  return `${minutes}m ${seconds}s`;
}

export function MetaverseStageScreen({
  attachmentProofConfig,
  attachmentProofConfigs,
  audioStatusLabel,
  bundleId,
  calibrationQualityLabel,
  characterProofConfig,
  coopRoomIdDraft,
  environmentProofConfig,
  equippedWeaponId,
  gameplayInputMode,
  matchMode,
  metaverseControlMode,
  onCombatAudioCue,
  onCoopRoomIdDraftChange,
  onExperienceLaunchRequest,
  onRecalibrationRequest,
  roomAssignment,
  onSetupRequest,
  username,
  weaponLayoutId = null
}: MetaverseStageScreenProps) {
  void audioStatusLabel;
  void calibrationQualityLabel;
  void coopRoomIdDraft;
  void gameplayInputMode;
  void onCoopRoomIdDraftChange;
  void onExperienceLaunchRequest;
  void onRecalibrationRequest;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const localCharacterId =
    characterProofConfig?.characterId ?? metaverseActiveFullBodyCharacterAssetId;
  const localPlayerIdentity = useMemo(
    () =>
      matchMode === "team-deathmatch"
        ? createMetaverseTeamDeathmatchLocalPlayerIdentity(
            username,
            localCharacterId
          )
        : createMetaverseLocalPlayerIdentity(username, localCharacterId),
    [localCharacterId, matchMode, username]
  );
  const resolvedAttachmentProofConfigs = useMemo(
    () =>
      attachmentProofConfigs !== undefined
        ? attachmentProofConfigs ?? []
        : attachmentProofConfig === null || attachmentProofConfig === undefined
          ? []
          : [attachmentProofConfig],
    [attachmentProofConfig, attachmentProofConfigs]
  );
  const combatAudioCueRef = useRef(onCombatAudioCue);
  useEffect(() => {
    combatAudioCueRef.current = onCombatAudioCue;
  }, [onCombatAudioCue]);
  const playCombatAudioCue = useCallback(
    (cueId: MetaverseCombatAudioCueId, options?: AudioCuePlaybackOptions) => {
      combatAudioCueRef.current(cueId, options);
    },
    []
  );
  const metaverseRuntime = useMemo(
    () => {
      return new WebGpuMetaverseRuntime(
        createMetaverseRuntimeConfig(
          bundleId,
          localPlayerIdentity.playerId,
          localPlayerIdentity.teamId ?? null
        ),
        {
          attachmentProofConfig: attachmentProofConfig ?? null,
          attachmentProofConfigs: resolvedAttachmentProofConfigs,
          characterProofConfig,
          createMetaversePresenceClient: () =>
            createMetaversePresenceClient(roomAssignment.roomId),
          createMetaverseWorldClient: () =>
            createMetaverseWorldClient(roomAssignment.roomId),
          ensureAuthoritativeWorldBundleSynchronized: () =>
            registerMetaverseWorldBundleOnServer(bundleId),
          environmentProofConfig,
          equippedWeaponId,
          localPlayerIdentity,
          playCombatAudioCue,
          weaponLayoutId
        }
      );
    },
    [
      attachmentProofConfig,
      resolvedAttachmentProofConfigs,
      bundleId,
      characterProofConfig,
      environmentProofConfig,
      equippedWeaponId,
      localPlayerIdentity,
      playCombatAudioCue,
      roomAssignment.roomId,
      roomAssignment.roomSessionId,
      weaponLayoutId
    ]
  );
  const [hudViewport, setHudViewport] = useState({
    height: 720,
    width: 1280
  });
  const [nextMatchError, setNextMatchError] = useState<string | null>(null);
  const [nextMatchPending, setNextMatchPending] = useState(false);
  const [isPauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [isScoreboardKeyboardOpen, setScoreboardKeyboardOpen] = useState(false);
  const [isScoreboardGamepadHeld, setScoreboardGamepadHeld] = useState(false);
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
  const hudSnapshotRef = useRef(hudSnapshot);
  useEffect(() => {
    hudSnapshotRef.current = hudSnapshot;
  }, [hudSnapshot]);
  const subscribeWeaponUiUpdates = useCallback(
    (notifyReact: () => void) =>
      metaverseRuntime.subscribeWeaponUiUpdates(notifyReact),
    [metaverseRuntime]
  );
  const weaponHudSnapshot = useSyncExternalStore(
    subscribeWeaponUiUpdates,
    () => metaverseRuntime.weaponHudSnapshot,
    () => metaverseRuntime.weaponHudSnapshot
  );
  const [isQuitConfirmOpen, setQuitConfirmOpen] = useState(false);
  const togglePauseMenu = useCallback(() => {
    setScoreboardKeyboardOpen(false);
    setScoreboardGamepadHeld(false);
    setQuitConfirmOpen(false);
    setPauseMenuOpen((currentValue) => !currentValue);
  }, []);
  const handlePauseMenuOpenChange = useCallback((open: boolean) => {
    setPauseMenuOpen(open);

    if (!open) {
      setQuitConfirmOpen(false);
    } else {
      setScoreboardKeyboardOpen(false);
      setScoreboardGamepadHeld(false);
    }
  }, []);
  const handleQuitToMenu = useCallback(() => {
    setQuitConfirmOpen(false);
    setPauseMenuOpen(false);
    onSetupRequest();
  }, [onSetupRequest]);
  const handleRequestNextMatch = useCallback(() => {
    if (nextMatchPending) {
      return;
    }

    setNextMatchError(null);
    setNextMatchPending(true);

    const roomDirectoryClient = createMetaverseRoomDirectoryClient();

    void roomDirectoryClient
      .requestNextMatch(
        roomAssignment.roomId,
        createMetaverseNextMatchRequest({
          playerId: localPlayerIdentity.playerId
        })
      )
      .catch((error) => {
        setNextMatchError(
          error instanceof Error ? error.message : "Next match failed."
        );
      })
      .finally(() => {
        setNextMatchPending(false);
      });
  }, [
    localPlayerIdentity.playerId,
    nextMatchPending,
    roomAssignment.roomId
  ]);

  useEffect(() => {
    const { getGamepads } = globalThis.navigator;
    const hasRaf =
      typeof globalThis.requestAnimationFrame === "function" &&
      typeof globalThis.cancelAnimationFrame === "function";

    if (typeof getGamepads !== "function" || !hasRaf) {
      return;
    }

    let isStartPressed = false;
    let isSelectPressed = false;
    let frameId = 0;
    let isMounted = true;

    const pollPauseStart = () => {
      const gamepads = getGamepads.call(globalThis.navigator);
      const isPostGameReportOpen =
        hudSnapshotRef.current.combat.scoreboard.phase === "completed";
      const nextIsStartPressed = gamepads.some(
        (gamepad) => gamepad !== null && gamepad.buttons[9]?.pressed === true
      );
      const nextIsSelectPressed =
        matchMode === "team-deathmatch" &&
        !isPauseMenuOpen &&
        !isQuitConfirmOpen &&
        !isPostGameReportOpen &&
        gamepads.some(
          (gamepad) => gamepad !== null && gamepad.buttons[8]?.pressed === true
        );

      if (nextIsStartPressed && !isStartPressed && !isPostGameReportOpen) {
        togglePauseMenu();
      }

      isStartPressed = nextIsStartPressed;

      if (nextIsSelectPressed !== isSelectPressed) {
        isSelectPressed = nextIsSelectPressed;
        setScoreboardGamepadHeld(nextIsSelectPressed);
      }

      if (isMounted) {
        frameId = globalThis.requestAnimationFrame(pollPauseStart);
      }
    };

    frameId = globalThis.requestAnimationFrame(pollPauseStart);

    return () => {
      isMounted = false;
      globalThis.cancelAnimationFrame(frameId);
    };
  }, [isPauseMenuOpen, isQuitConfirmOpen, matchMode, togglePauseMenu]);

  useEffect(() => {
    const handleScoreboardKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.repeat ||
        matchMode !== "team-deathmatch" ||
        isPauseMenuOpen ||
        isQuitConfirmOpen ||
        hudSnapshotRef.current.combat.scoreboard.phase === "completed"
      ) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setScoreboardKeyboardOpen((currentValue) => !currentValue);
    };

    globalThis.addEventListener("keydown", handleScoreboardKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleScoreboardKeyDown);
    };
  }, [isPauseMenuOpen, isQuitConfirmOpen, matchMode]);

  useEffect(() => {
    const handleMountedInteractionKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        isPauseMenuOpen ||
        isQuitConfirmOpen ||
        hudSnapshotRef.current.combat.scoreboard.phase === "completed"
      ) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      const currentHudSnapshot = hudSnapshotRef.current;
      const mountedInteraction = currentHudSnapshot.mountedInteraction;
      const hasWeaponResourcePrompt =
        currentHudSnapshot.interaction.weaponResource !== null;
      const consumeEvent = () => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      };

      if (event.code === "KeyE") {
        if (mountedInteraction.mountedEnvironment !== null) {
          consumeEvent();
          metaverseRuntime.leaveMountedEnvironment();
          return;
        }

        if (
          !hasWeaponResourcePrompt &&
          mountedInteraction.focusedMountable !== null
        ) {
          consumeEvent();
          metaverseRuntime.toggleMount();
        }

        return;
      }

      if (
        mountedInteraction.mountedEnvironment === null ||
        (event.code !== "Digit1" && event.code !== "Digit2")
      ) {
        return;
      }

      const seatIndex = event.code === "Digit1" ? 0 : 1;
      const seatTarget =
        mountedInteraction.selectableSeatTargets[seatIndex] ?? null;

      if (seatTarget === null) {
        return;
      }

      consumeEvent();
      metaverseRuntime.occupySeat(seatTarget.seatId);
    };
    const listenerOptions = { capture: true };

    globalThis.addEventListener(
      "keydown",
      handleMountedInteractionKeyDown,
      listenerOptions
    );

    return () => {
      globalThis.removeEventListener(
        "keydown",
        handleMountedInteractionKeyDown,
        listenerOptions
      );
    };
  }, [isPauseMenuOpen, isQuitConfirmOpen, metaverseRuntime]);

  useEffect(() => {
    if (matchMode !== "team-deathmatch" || isPauseMenuOpen || isQuitConfirmOpen) {
      setScoreboardKeyboardOpen(false);
      setScoreboardGamepadHeld(false);
    }
  }, [isPauseMenuOpen, isQuitConfirmOpen, matchMode]);

  useEffect(() => {
    const handlePauseKeyDown = (event: KeyboardEvent) => {
      const isPauseKey =
        event.key === "Backspace" || event.key.toLowerCase() === "p";

      if (
        !isPauseKey ||
        event.repeat ||
        isQuitConfirmOpen ||
        hudSnapshotRef.current.combat.scoreboard.phase === "completed"
      ) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      event.preventDefault();
      togglePauseMenu();
    };

    globalThis.addEventListener("keydown", handlePauseKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handlePauseKeyDown);
    };
  }, [isQuitConfirmOpen, togglePauseMenu]);

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
  const combatSnapshot = hudSnapshot.combat;
  const isPostGameReportOpen =
    matchMode === "team-deathmatch" &&
    combatSnapshot.scoreboard.available &&
    combatSnapshot.scoreboard.phase === "completed";
  const localTeamId = hudSnapshot.presence.localTeamId;
  const teamHudTone = resolveTeamHudTone(localTeamId);
  const localIsBlue = localTeamId === "blue";
  const blueTeamScore = localIsBlue
    ? combatSnapshot.teamScore ?? 0
    : combatSnapshot.enemyScore ?? 0;
  const redTeamScore = localIsBlue
    ? combatSnapshot.enemyScore ?? 0
    : combatSnapshot.teamScore ?? 0;
  const scoreLimit = combatSnapshot.scoreLimit;
  const scoreProgressDenominator = Math.max(
    scoreLimit === null ? Math.max(blueTeamScore, redTeamScore, 1) : scoreLimit,
    1
  );
  const blueScorePercent = `${Math.round((blueTeamScore / scoreProgressDenominator) * 100)}%`;
  const redScorePercent = `${Math.round((redTeamScore / scoreProgressDenominator) * 100)}%`;
  const isTeamDeathmatchHudMode = matchMode === "team-deathmatch";
  const showTeamDeathmatchCombatHud =
    isTeamDeathmatchHudMode && combatSnapshot.available;
  const isScoreboardOpen =
    isTeamDeathmatchHudMode &&
    !isPostGameReportOpen &&
    !isPauseMenuOpen &&
    (isScoreboardKeyboardOpen || isScoreboardGamepadHeld);
  const healthRatio = combatSnapshot.available
    ? clamp(combatSnapshot.health / Math.max(1, combatSnapshot.maxHealth), 0, 1)
    : 0;
  const weaponLabel =
    weaponHudSnapshot.visible && weaponHudSnapshot.weaponLabel !== null
      ? weaponHudSnapshot.weaponLabel
      : combatSnapshot.weaponId ?? "Weapon";

  useEffect(() => {
    if (!isPostGameReportOpen) {
      setNextMatchError(null);
      setNextMatchPending(false);
      return;
    }

    setPauseMenuOpen(false);
    setQuitConfirmOpen(false);
    setScoreboardKeyboardOpen(false);
    setScoreboardGamepadHeld(false);
  }, [isPostGameReportOpen]);

  return (
    <ImmersiveStageFrame className="bg-game-stage">
      <div className="relative flex h-full w-full">
        <canvas
          aria-hidden="true"
          className="h-full w-full touch-none"
          ref={canvasRef}
        />

        <MetaverseWeaponReticleOverlay
          hidden={
            !isTeamDeathmatchHudMode ||
            hudSnapshot.boot.phase !== "ready" ||
            runtimeError !== null
          }
          weaponHudSnapshot={weaponHudSnapshot}
        />

        <MetaverseDamageDirectionOverlay
          damageIndicators={combatSnapshot.damageIndicators}
          hidden={
            !showTeamDeathmatchCombatHud ||
            hudSnapshot.boot.phase !== "ready" ||
            runtimeError !== null
          }
        />

        {isScoreboardOpen ? (
          <MetaverseTeamDeathmatchScoreboardHud combatSnapshot={combatSnapshot} />
        ) : null}

        {isPostGameReportOpen ? (
          <MetaverseTeamDeathmatchPostGameOverlay
            combatSnapshot={combatSnapshot}
            nextMatchError={nextMatchError}
            nextMatchPending={nextMatchPending}
            onMainMenu={handleQuitToMenu}
            onNextMatch={handleRequestNextMatch}
          />
        ) : null}

        {showTeamDeathmatchCombatHud ? (
          <div
            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2"
            style={{
              ...hudStyle,
              top: "var(--metaverse-hud-edge)"
            }}
          >
            <div className="w-[min(24rem,calc(100vw-2rem))]">
              <div
                className={[
                  "h-2.5 overflow-hidden rounded-full transition-[width] duration-150 ease-out",
                  teamHudTone.barClassName
                ].join(" ")}
                style={{
                  width: `${healthRatio * 100}%`
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 overflow-x-hidden overflow-y-auto">
          <div
            className="flex min-h-full flex-col justify-between gap-[var(--metaverse-hud-gap)] p-[var(--metaverse-hud-edge)]"
            ref={overlayRef}
            style={hudStyle}
          >
            <div className="flex flex-wrap items-start justify-between gap-[var(--metaverse-hud-gap)]">
              <MetaverseInteractionFeedHud hudSnapshot={hudSnapshot} />

              {isTeamDeathmatchHudMode ? (
                <div className="pointer-events-none ml-auto max-w-[min(14rem,100%)] shrink-0 text-right text-game-foreground [text-shadow:var(--metaverse-hud-text-shadow)]">
                  <p className="type-game-heading truncate text-game-foreground">
                    {weaponLabel}
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <StableInlineText
                      className="type-game-value text-game-foreground"
                      text={`${combatSnapshot.ammoInMagazine}`}
                    />
                    <span className="h-8 w-px shrink-0 bg-white/90" />
                    <StableInlineText
                      className="type-game-value text-game-foreground"
                      text={`${combatSnapshot.ammoInReserve}`}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {isTeamDeathmatchHudMode ? (
              <div className="flex flex-wrap items-end justify-between gap-[var(--metaverse-hud-gap)]">
                <div className="pointer-events-none">
                  {hudSnapshot.boot.phase === "ready" && runtimeError === null ? (
                    <MetaversePlayerRadarHud radarSnapshot={hudSnapshot.radar} />
                  ) : null}
                </div>

	                {showTeamDeathmatchCombatHud ? (
	                  <div className="pointer-events-none ml-auto max-w-[16rem] text-right text-game-foreground [text-shadow:var(--metaverse-hud-text-shadow)]">
	                    <div className="flex flex-col items-end gap-1">
	                      <p className="type-game-heading">Team Deathmatch</p>
	                      <p className="type-game-body text-game-foreground">
	                        {formatMatchTimeLabel(combatSnapshot.timeRemainingMs)}
	                      </p>
	                    </div>

	                    <div className="mt-3 flex flex-col items-end gap-2">
	                      <div className="flex w-full items-center justify-end gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-game-foreground">
	                        <span className="size-2.5 shrink-0 bg-sky-300" />
	                        <span className="w-8 tabular-nums text-game-foreground">
	                          {blueTeamScore}
	                        </span>
	                        <div className="h-2 w-28 overflow-hidden rounded-full">
	                          <div
	                            className="h-full bg-sky-300 transition-[width] duration-150 ease-out"
	                            style={{ width: blueScorePercent }}
	                          />
	                        </div>
	                      </div>

	                      <div className="flex w-full items-center justify-end gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-game-foreground">
	                        <span className="size-2.5 shrink-0 bg-rose-300" />
	                        <span className="w-8 tabular-nums text-game-foreground">
	                          {redTeamScore}
	                        </span>
	                        <div className="h-2 w-28 overflow-hidden rounded-full">
	                          <div
	                            className="h-full bg-rose-300 transition-[width] duration-150 ease-out"
	                            style={{ width: redScorePercent }}
	                          />
	                        </div>
	                      </div>
	                    </div>
	                  </div>
	                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <Dialog onOpenChange={handlePauseMenuOpenChange} open={isPauseMenuOpen}>
          <DialogContent className="max-w-sm border border-white/10 bg-[rgb(2_6_23_/_0.92)] text-game-foreground shadow-none">
            <DialogHeader>
              <DialogTitle>Game Paused</DialogTitle>
              <DialogDescription>
                Resume with <span className="font-medium">Backspace</span>,{" "}
                <span className="font-medium">P</span>, or Start, or return to
                the main menu.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="bg-transparent">
              <Button
                onClick={() => {
                  handlePauseMenuOpenChange(false);
                }}
                type="button"
                variant="outline"
              >
                Resume
              </Button>
              <AlertDialog
                onOpenChange={setQuitConfirmOpen}
                open={isQuitConfirmOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="secondary">
                    Back to Menu
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="surface-game-overlay text-[color:var(--game-foreground)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Quit match?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[color:var(--game-muted)]">
                      Leave the current team deathmatch session and return to
                      the main menu?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="border-[color:var(--game-border)] bg-transparent">
                    <AlertDialogCancel>No</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleQuitToMenu}
                      variant="destructive"
                    >
                      Yes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ImmersiveStageFrame>
  );
}
