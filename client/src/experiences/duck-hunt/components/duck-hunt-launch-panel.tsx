import { useEffect, useState } from "react";

import {
  createCoopRoomId,
  readExperienceCatalogEntry,
  readExperienceTickOwner,
  resolveGameplayInputMode,
  type CoopRoomDirectoryEntrySnapshot,
  type GameplayInputModeId,
  type GameplaySessionMode
} from "@webgpu-metaverse/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";

import {
  createDuckHuntCoopRoomDirectoryClient,
  createSuggestedDuckHuntCoopRoomIdDraft,
  duckHuntRoomDirectoryRefreshIntervalMs
} from "../network";

interface DuckHuntLaunchPanelProps {
  readonly audioStatusLabel: string;
  readonly calibrationQualityLabel: string;
  readonly coopRoomIdDraft: string;
  readonly inputMode: GameplayInputModeId;
  readonly onCoopRoomIdDraftChange: (coopRoomIdDraft: string) => void;
  readonly onLaunchRequest: () => void;
  readonly onRecalibrationRequest: () => void;
  readonly onSessionModeChange: (mode: GameplaySessionMode) => void;
  readonly sessionMode: GameplaySessionMode;
}

function resolveCoopRoomPhaseLabel(
  roomEntry: CoopRoomDirectoryEntrySnapshot
): string {
  if (roomEntry.phase === "waiting-for-players") {
    return "Lobby";
  }

  if (roomEntry.phase === "active") {
    return roomEntry.roundPhase === "cooldown" ? "Cooldown" : "Live";
  }

  if (roomEntry.phase === "failed") {
    return "Failed";
  }

  return "Cleared";
}

function formatDirectoryRoundTime(roundTimeRemainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(roundTimeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCoopRoomStatus(
  roomEntry: CoopRoomDirectoryEntrySnapshot
): string {
  if (roomEntry.phase === "active") {
    return roomEntry.roundPhase === "cooldown"
      ? `Round ${roomEntry.roundNumber + 1} starts in ${formatDirectoryRoundTime(
          roomEntry.roundPhaseRemainingMs
        )}`
      : `Round ${roomEntry.roundNumber} live with ${roomEntry.birdsRemaining} birds remaining`;
  }

  if (roomEntry.phase === "failed") {
    return `Round ${roomEntry.roundNumber} failed with ${roomEntry.birdsRemaining} birds remaining`;
  }

  return `${roomEntry.connectedPlayerCount}/${roomEntry.capacity} connected · ${roomEntry.readyPlayerCount}/${roomEntry.requiredReadyPlayerCount} ready`;
}

export function DuckHuntLaunchPanel({
  audioStatusLabel,
  calibrationQualityLabel,
  coopRoomIdDraft,
  inputMode,
  onCoopRoomIdDraftChange,
  onLaunchRequest,
  onRecalibrationRequest,
  onSessionModeChange,
  sessionMode
}: DuckHuntLaunchPanelProps) {
  const duckHuntCatalogEntry = readExperienceCatalogEntry("duck-hunt");
  const selectedInputMode = resolveGameplayInputMode(inputMode);
  const launchPanelFrameClassName =
    "surface-shell-inset rounded-[var(--metaverse-hud-inset-radius)] px-[var(--metaverse-hud-inset-padding)] py-[var(--metaverse-hud-inset-padding)]";
  const launchPanelSeparatorClassName = "bg-[color:var(--shell-border)]";
  const [coopRoomDirectoryClient] = useState(
    createDuckHuntCoopRoomDirectoryClient
  );
  const [coopRoomEntries, setCoopRoomEntries] = useState<
    readonly CoopRoomDirectoryEntrySnapshot[]
  >([]);
  const [coopRoomDirectoryError, setCoopRoomDirectoryError] = useState<string | null>(
    null
  );
  const [coopRoomDirectoryLoading, setCoopRoomDirectoryLoading] = useState(false);
  const normalizedCoopRoomIdDraft =
    sessionMode === "co-op" ? createCoopRoomId(coopRoomIdDraft) : null;
  const coopRoomIdValid =
    sessionMode !== "co-op" || normalizedCoopRoomIdDraft !== null;
  const sortedCoopRoomEntries = [...coopRoomEntries].sort((leftRoom, rightRoom) => {
    const phasePriority = (roomEntry: CoopRoomDirectoryEntrySnapshot): number => {
      if (roomEntry.phase === "active") {
        return 0;
      }

      if (roomEntry.phase === "waiting-for-players") {
        return 1;
      }

      if (roomEntry.phase === "failed") {
        return 2;
      }

      return 3;
    };

    const priorityDelta = phasePriority(leftRoom) - phasePriority(rightRoom);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return leftRoom.roomId.localeCompare(rightRoom.roomId);
  });
  const selectedExistingRoom =
    normalizedCoopRoomIdDraft === null
      ? null
      : sortedCoopRoomEntries.find(
          (roomEntry) => roomEntry.roomId === normalizedCoopRoomIdDraft
        ) ?? null;
  const tickOwner = readExperienceTickOwner("duck-hunt", sessionMode);

  useEffect(() => {
    if (sessionMode !== "co-op") {
      setCoopRoomEntries([]);
      setCoopRoomDirectoryError(null);
      setCoopRoomDirectoryLoading(false);
      return;
    }

    let cancelled = false;

    const loadDirectory = async () => {
      if (!cancelled) {
        setCoopRoomDirectoryLoading(true);
      }

      try {
        const roomDirectorySnapshot = await coopRoomDirectoryClient.fetchSnapshot();

        if (cancelled) {
          return;
        }

        setCoopRoomEntries(roomDirectorySnapshot.coOpRooms);
        setCoopRoomDirectoryError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCoopRoomEntries([]);
        setCoopRoomDirectoryError(
          error instanceof Error
            ? error.message
            : "Duck Hunt room directory fetch failed."
        );
      } finally {
        if (!cancelled) {
          setCoopRoomDirectoryLoading(false);
        }
      }
    };

    void loadDirectory();
    const refreshHandle = globalThis.setInterval(() => {
      void loadDirectory();
    }, duckHuntRoomDirectoryRefreshIntervalMs);

    return () => {
      cancelled = true;
      globalThis.clearInterval(refreshHandle);
    };
  }, [coopRoomDirectoryClient, sessionMode]);

  return (
    <div className="surface-shell-panel-strong w-full max-w-2xl rounded-[var(--metaverse-hud-panel-radius)] p-[var(--metaverse-hud-panel-padding)] shadow-[0_28px_90px_rgb(15_23_42/0.28)]">
      <div className="flex max-h-full flex-col gap-4 overflow-y-auto overscroll-contain">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge>Portal ready</Badge>
              <Badge variant="secondary">{audioStatusLabel}</Badge>
              <Badge variant="outline">
                Tick owner: {tickOwner === "server" ? "Server" : "Client"}
              </Badge>
            </div>
            <div>
              <h2 className="type-shell-heading text-[calc(1.35rem*var(--game-ui-scale))]">
                {duckHuntCatalogEntry.label}
              </h2>
              <p className="type-shell-body mt-1">
                {duckHuntCatalogEntry.shortDescription}
              </p>
            </div>
          </div>
          {selectedInputMode.requiresCalibration ? (
            <Button onClick={onRecalibrationRequest} type="button" variant="outline">
              Recalibrate
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className={launchPanelFrameClassName}>
            <p className="type-shell-banner">
              Input
            </p>
            <p className="type-shell-heading mt-2">
              {selectedInputMode.label}
            </p>
            <p className="type-shell-body mt-2">
              {selectedInputMode.description}
            </p>
          </div>
          <div className={launchPanelFrameClassName}>
            <p className="type-shell-banner">
              Portal
            </p>
            <p className="type-shell-heading mt-2">
              Ocean launch
            </p>
            <p className="type-shell-body mt-2">
              {duckHuntCatalogEntry.portalSummary}
            </p>
          </div>
          <div className={launchPanelFrameClassName}>
            <p className="type-shell-banner">
              Calibration
            </p>
            <p className="type-shell-heading mt-2">
              {selectedInputMode.requiresCalibration ? "Worker tracking live" : "Not required"}
            </p>
            <p className="type-shell-body mt-2">
              {selectedInputMode.requiresCalibration
                ? calibrationQualityLabel
                : "Mouse mode skips webcam permission and nine-point aiming setup."}
            </p>
          </div>
        </div>

        <Separator className={launchPanelSeparatorClassName} />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-shell-title">Session mode</p>
              <p className="type-shell-body">
                Single-player keeps the round on the local client. Co-op joins a
                server-owned room tick for shared birds and team state.
              </p>
            </div>
            {coopRoomDirectoryLoading && sessionMode === "co-op" ? (
              <Badge variant="secondary">Refreshing rooms</Badge>
            ) : null}
          </div>

          <ToggleGroup
            className="w-full"
            onValueChange={(nextValue) => {
              if (nextValue.length === 0) {
                return;
              }

              onSessionModeChange(nextValue as GameplaySessionMode);
            }}
            type="single"
            value={sessionMode}
            variant="outline"
          >
            <ToggleGroupItem className="flex-1" value="single-player">
              Single player
            </ToggleGroupItem>
            <ToggleGroupItem className="flex-1" value="co-op">
              Co-op
            </ToggleGroupItem>
          </ToggleGroup>
        </section>

        {sessionMode === "single-player" ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={onLaunchRequest} type="button">
              Launch Duck Hunt
            </Button>
            <p className="type-shell-body self-center">
              Local round state and best-score tracking resume inside the experience.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className={launchPanelFrameClassName}>
              <div className="flex flex-col gap-1">
                <Label
                  className="type-shell-title text-[color:var(--shell-foreground)]"
                  htmlFor="duck-hunt-coop-room-id"
                >
                  Room code
                </Label>
                <p className="type-shell-body">
                  Join an active room or create a fresh code for a new lobby.
                </p>
              </div>

              <Input
                aria-invalid={!coopRoomIdValid}
                className="mt-3"
                id="duck-hunt-coop-room-id"
                onChange={(event) => {
                  onCoopRoomIdDraftChange(event.target.value);
                }}
                placeholder="duck-hunt-harbor"
                value={coopRoomIdDraft}
              />

              <p
                className={`mt-3 type-shell-body ${
                  coopRoomIdValid && selectedExistingRoom === null
                    ? ""
                    : "text-destructive"
                }`}
              >
                {!coopRoomIdValid
                  ? "Enter a non-empty room code before launching co-op."
                  : selectedExistingRoom !== null
                    ? "That room is already live. Join it from the list below or generate another code."
                    : "This code is available for a fresh lobby."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={!coopRoomIdValid || selectedExistingRoom !== null}
                  onClick={onLaunchRequest}
                  type="button"
                >
                  Create room
                </Button>
                <Button
                  onClick={() => {
                    onCoopRoomIdDraftChange(
                      createSuggestedDuckHuntCoopRoomIdDraft()
                    );
                  }}
                  type="button"
                  variant="outline"
                >
                  New code
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {coopRoomDirectoryError !== null ? (
                <div className="surface-shell-danger rounded-[var(--metaverse-hud-inset-radius)] px-[var(--metaverse-hud-inset-padding)] py-[var(--metaverse-hud-inset-padding)]">
                  <p className="type-shell-body text-[color:var(--shell-danger-foreground)]">
                    {coopRoomDirectoryError}
                  </p>
                </div>
              ) : null}

              {sortedCoopRoomEntries.length === 0 ? (
                <div className={`${launchPanelFrameClassName} type-shell-body`}>
                  No live Duck Hunt co-op rooms yet. Create one with the code above.
                </div>
              ) : (
                sortedCoopRoomEntries.map((roomEntry) => {
                  const selectedRoom =
                    normalizedCoopRoomIdDraft !== null &&
                    roomEntry.roomId === normalizedCoopRoomIdDraft;

                  return (
                    <div
                      className={`${launchPanelFrameClassName} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
                      key={roomEntry.roomId}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="type-shell-title">
                            {roomEntry.roomId}
                          </p>
                          <Badge variant={selectedRoom ? "secondary" : "outline"}>
                            {resolveCoopRoomPhaseLabel(roomEntry)}
                          </Badge>
                        </div>
                        <p className="type-shell-body">
                          {formatCoopRoomStatus(roomEntry)}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          onCoopRoomIdDraftChange(roomEntry.roomId);
                          onLaunchRequest();
                        }}
                        type="button"
                      >
                        Join room
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
