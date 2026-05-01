import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
  type FormEvent
} from "react";

import type {
  GameplayInputModeId,
  MetaverseMatchModeId,
  MetaverseRoomDirectoryEntrySnapshot
} from "@webgpu-metaverse/shared";

import { EngineToolLauncher, GamePlaylistsLauncher } from "../../engine-tool";
import {
  createMetaverseRoomDirectoryClient,
  createSuggestedMetaverseTeamDeathmatchRoomIdDraft,
  metaverseRoomDirectoryRefreshIntervalMs
} from "../../metaverse/config/metaverse-room-network";
import type { WebGpuMetaverseCapabilitySnapshot } from "../../metaverse/types/webgpu-capability";
import type { MetaverseEntryStepId } from "../../navigation";
import { MetaverseLaunchCinematicCanvas } from "../../metaverse";
import { metaverseShellLaunchDevAccessConfig } from "../config/metaverse-shell-launch-dev-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon } from "lucide-react";

interface ShellEntryStageScreenProps {
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly hasConfirmedProfile: boolean;
  readonly hasStoredProfile: boolean;
  readonly inputMode: GameplayInputModeId;
  readonly loginError: string | null;
  readonly matchMode: MetaverseMatchModeId;
  readonly metaverseLaunchError: string | null;
  readonly metaverseLaunchPending: boolean;
  readonly metaverseRoomIdDraft: string;
  readonly nextMetaverseStep: MetaverseEntryStepId | null;
  readonly onClearProfile: () => void;
  readonly onEditProfile: () => void;
  readonly onEnterMetaverse: (
    matchMode: MetaverseMatchModeId,
    metaverseRoomIdOverride?: string
  ) => void;
  readonly onMatchModeChange: (matchMode: MetaverseMatchModeId) => void;
  readonly onMetaverseRoomIdDraftChange: (metaverseRoomIdDraft: string) => void;
  readonly onOpenGamePlaylistsRequest: () => void;
  readonly onOpenToolRequest: () => void;
  readonly onRequestPermission: () => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly setUsernameDraft: (value: string) => void;
  readonly usernameDraft: string;
}

function resolveLaunchActionLabel(
  matchMode: MetaverseMatchModeId,
  capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"],
  nextMetaverseStep: MetaverseEntryStepId | null
): string {
  if (nextMetaverseStep === "metaverse") {
    return matchMode === "team-deathmatch"
      ? "Join Team Deathmatch"
      : "Enter Free Roam";
  }

  if (nextMetaverseStep === "permissions") {
    return "Camera setup";
  }

  if (nextMetaverseStep === "calibration") {
    return "Calibration";
  }

  if (capabilityStatus === "checking") {
    return "Checking WebGPU";
  }

  return "Metaverse unavailable";
}

function isJoinableTeamDeathmatchRoom(
  roomEntry: MetaverseRoomDirectoryEntrySnapshot
): boolean {
  return (
    roomEntry.status === "available" &&
    roomEntry.connectedPlayerCount < roomEntry.capacity &&
    roomEntry.phase !== "completed"
  );
}

function teamDeathmatchRoomEntriesMatch(
  leftEntries: readonly MetaverseRoomDirectoryEntrySnapshot[],
  rightEntries: readonly MetaverseRoomDirectoryEntrySnapshot[]
): boolean {
  if (leftEntries === rightEntries) {
    return true;
  }

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  for (let entryIndex = 0; entryIndex < leftEntries.length; entryIndex += 1) {
    const leftEntry = leftEntries[entryIndex];
    const rightEntry = rightEntries[entryIndex];

    if (
      leftEntry?.roomId !== rightEntry?.roomId ||
      leftEntry?.roomSessionId !== rightEntry?.roomSessionId ||
      leftEntry?.phase !== rightEntry?.phase ||
      leftEntry?.status !== rightEntry?.status ||
      leftEntry?.connectedPlayerCount !== rightEntry?.connectedPlayerCount ||
      leftEntry?.capacity !== rightEntry?.capacity ||
      leftEntry?.redTeamScore !== rightEntry?.redTeamScore ||
      leftEntry?.blueTeamScore !== rightEntry?.blueTeamScore ||
      leftEntry?.redTeamPlayerCount !== rightEntry?.redTeamPlayerCount ||
      leftEntry?.blueTeamPlayerCount !== rightEntry?.blueTeamPlayerCount ||
      leftEntry?.timeRemainingMs !== rightEntry?.timeRemainingMs ||
      leftEntry?.leaderPlayerId !== rightEntry?.leaderPlayerId
    ) {
      return false;
    }
  }

  return true;
}

export function ShellEntryStageScreen({
  capabilityStatus,
  hasConfirmedProfile,
  hasStoredProfile,
  inputMode,
  loginError,
  metaverseLaunchError,
  metaverseLaunchPending,
  nextMetaverseStep,
  onClearProfile,
  onEnterMetaverse,
  onMatchModeChange,
  onMetaverseRoomIdDraftChange,
  onOpenGamePlaylistsRequest,
  onOpenToolRequest,
  onRequestPermission,
  onRecalibrationRequest,
  onSubmit,
  setUsernameDraft,
  usernameDraft
}: ShellEntryStageScreenProps) {
  const [roomDirectoryClient] = useState(createMetaverseRoomDirectoryClient);
  const [teamDeathmatchRoomEntries, setTeamDeathmatchRoomEntries] = useState<
    readonly MetaverseRoomDirectoryEntrySnapshot[]
  >([]);
  const [teamDeathmatchRoomDirectoryError, setTeamDeathmatchRoomDirectoryError] =
    useState<string | null>(null);
  const canLaunch = nextMetaverseStep !== null;
  const canLaunchFreeRoam = canLaunch && !metaverseLaunchPending;
  const canLaunchTeamDeathmatch =
    canLaunch && !metaverseLaunchPending;
  const showRecalibrationButton =
    hasConfirmedProfile &&
    inputMode === "camera-thumb-trigger" &&
    nextMetaverseStep === "metaverse";
  const showLaunchDevButtons =
    import.meta.env.DEV &&
    !metaverseShellLaunchDevAccessConfig.hideEntryScreenButtons;
  const selectedTeamDeathmatchRoom =
    teamDeathmatchRoomEntries.find(isJoinableTeamDeathmatchRoom) ?? null;

  const applyTeamDeathmatchRoomDirectorySnapshot = useEffectEvent(
    (
      roomEntries:
        | readonly MetaverseRoomDirectoryEntrySnapshot[]
        | null,
      errorMessage: string | null
    ) => {
      startTransition(() => {
        if (roomEntries !== null) {
          setTeamDeathmatchRoomEntries((currentRoomEntries) =>
            teamDeathmatchRoomEntriesMatch(currentRoomEntries, roomEntries)
              ? currentRoomEntries
              : roomEntries
          );
        }
        setTeamDeathmatchRoomDirectoryError((currentErrorMessage) =>
          currentErrorMessage === errorMessage ? currentErrorMessage : errorMessage
        );
      });
    }
  );

  useEffect(() => {
    let cancelled = false;

    const loadDirectory = async () => {
      try {
        const roomDirectorySnapshot = await roomDirectoryClient.fetchSnapshot(
          "team-deathmatch"
        );

        if (cancelled) {
          return;
        }

        applyTeamDeathmatchRoomDirectorySnapshot(roomDirectorySnapshot.rooms, null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        applyTeamDeathmatchRoomDirectorySnapshot(
          null,
          error instanceof Error
            ? error.message
            : "Team Deathmatch room directory fetch failed."
        );
      }
    };

    void loadDirectory();
    const refreshHandle = globalThis.setInterval(() => {
      void loadDirectory();
    }, metaverseRoomDirectoryRefreshIntervalMs);

    return () => {
      cancelled = true;
      globalThis.clearInterval(refreshHandle);
    };
  }, [
    applyTeamDeathmatchRoomDirectorySnapshot,
    roomDirectoryClient
  ]);

  function handleLaunchRequest(selectedMatchMode: MetaverseMatchModeId): void {
    onMatchModeChange(selectedMatchMode);

    const metaverseRoomIdOverride =
      selectedMatchMode === "team-deathmatch"
        ? selectedTeamDeathmatchRoom?.roomId ??
          createSuggestedMetaverseTeamDeathmatchRoomIdDraft()
        : undefined;

    if (metaverseRoomIdOverride !== undefined) {
      onMetaverseRoomIdDraftChange(metaverseRoomIdOverride);
    }

    if (nextMetaverseStep === "permissions") {
      onRequestPermission();
      return;
    }

    if (nextMetaverseStep === "calibration") {
      onRecalibrationRequest();
      return;
    }

    onEnterMetaverse(selectedMatchMode, metaverseRoomIdOverride);
  }

  return (
    <section className="relative min-h-dvh overflow-hidden bg-game-stage text-game-foreground">
      <MetaverseLaunchCinematicCanvas
        capabilityStatus={capabilityStatus}
        launchPending={metaverseLaunchPending}
      />
      <div className="relative z-10 min-h-dvh w-full">
        <div
          className={`absolute bottom-28 left-4 flex w-[calc(100%-2rem)] max-w-5xl flex-col gap-5 transition-all duration-500 ease-out sm:left-7 sm:w-[calc(100%-3.5rem)] lg:left-12 lg:w-[calc(100%-6rem)] ${
            metaverseLaunchPending
              ? "translate-y-3 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <div className="flex w-full flex-col items-start gap-3 text-left">
            <button
              aria-label={resolveLaunchActionLabel(
                "free-roam",
                capabilityStatus,
                nextMetaverseStep
              )}
              className="group w-full rounded-lg px-0 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
              disabled={!canLaunchFreeRoam}
              onClick={() => handleLaunchRequest("free-roam")}
              type="button"
            >
              <span className="block font-heading text-4xl font-semibold leading-none text-game-foreground transition-colors [text-shadow:0_3px_18px_rgb(0_0_0_/_0.75)] group-hover:text-primary sm:text-6xl lg:text-7xl">
                Metaverse
              </span>
            </button>
            <button
              aria-label={resolveLaunchActionLabel(
                "team-deathmatch",
                capabilityStatus,
                nextMetaverseStep
              )}
              className="group w-full rounded-lg px-0 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
              disabled={!canLaunchTeamDeathmatch}
              onClick={() => handleLaunchRequest("team-deathmatch")}
              type="button"
            >
              <span className="block whitespace-nowrap font-heading text-4xl font-semibold leading-none text-game-foreground transition-colors [text-shadow:0_3px_18px_rgb(0_0_0_/_0.75)] group-hover:text-primary sm:text-6xl lg:text-7xl">
                Team Deathmatch
              </span>
            </button>
          </div>

          {teamDeathmatchRoomDirectoryError !== null ? (
            <p className="max-w-md text-center text-sm leading-6 text-game-muted">
              {teamDeathmatchRoomDirectoryError}
            </p>
          ) : null}

          {metaverseLaunchError !== null ? (
            <div className="surface-game-danger w-full max-w-xl rounded-[1.5rem] px-4 py-4 text-sm leading-6">
              {metaverseLaunchError}
            </div>
          ) : null}

          <div className="flex w-full max-w-sm flex-col gap-3">
            {showLaunchDevButtons ? (
              <div className="flex flex-col gap-2">
                <EngineToolLauncher
                  className="w-full"
                  onOpenToolRequest={onOpenToolRequest}
                />
                <GamePlaylistsLauncher
                  className="w-full"
                  onOpenGamePlaylistsRequest={onOpenGamePlaylistsRequest}
                />
              </div>
            ) : null}

            {showRecalibrationButton ? (
              <Button
                className="w-full"
                onClick={onRecalibrationRequest}
                size="lg"
                type="button"
                variant="outline"
              >
                Recalibrate
              </Button>
            ) : null}
          </div>
        </div>

        <form
          className={`absolute bottom-7 left-1/2 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 transition-all duration-500 ease-out ${
            metaverseLaunchPending
              ? "translate-y-3 opacity-0"
              : "translate-y-0 opacity-100"
          }`}
          onSubmit={onSubmit}
        >
          <div className="flex items-center gap-2">
            <Input
              aria-invalid={loginError !== null}
              aria-label="Player name"
              autoComplete="nickname"
              className="h-11 flex-1"
              id="login-username"
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder="Unknown"
              value={usernameDraft}
            />
            {hasStoredProfile || hasConfirmedProfile ? (
              <Button
                aria-label="Clear local profile"
                onClick={onClearProfile}
                size="icon"
                type="button"
                variant="outline"
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
          {loginError !== null ? (
            <div className="surface-game-danger rounded-xl px-3 py-2 text-sm leading-6">
              {loginError}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
