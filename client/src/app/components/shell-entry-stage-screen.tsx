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
  const showToolLauncher = import.meta.env.DEV;
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
    <section className="relative overflow-x-hidden bg-game-stage text-game-foreground">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          <div className="flex w-full flex-col items-center gap-5 text-center">
            <button
              aria-label={resolveLaunchActionLabel(
                "free-roam",
                capabilityStatus,
                nextMetaverseStep
              )}
              className="group w-full rounded-lg px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
              disabled={!canLaunchFreeRoam}
              onClick={() => handleLaunchRequest("free-roam")}
              type="button"
            >
              <span className="font-heading text-5xl font-semibold leading-none text-game-foreground transition-colors group-hover:text-primary sm:text-6xl">
                Metaverse
              </span>
            </button>
            <button
              aria-label={resolveLaunchActionLabel(
                "team-deathmatch",
                capabilityStatus,
                nextMetaverseStep
              )}
              className="group w-full rounded-lg px-3 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
              disabled={!canLaunchTeamDeathmatch}
              onClick={() => handleLaunchRequest("team-deathmatch")}
              type="button"
            >
              <span className="font-heading text-5xl font-semibold leading-none text-game-foreground transition-colors group-hover:text-primary sm:text-6xl">
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
            <form className="flex flex-col gap-2" onSubmit={onSubmit}>
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

            {showToolLauncher ? (
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
      </div>
    </section>
  );
}
