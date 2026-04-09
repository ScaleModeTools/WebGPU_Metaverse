import { useEffect, useState } from "react";

import {
  createCoopRoomId,
  readExperienceCatalogEntry,
  readExperienceTickOwner,
  type CoopRoomDirectoryEntrySnapshot,
  type GameplayInputModeId,
  type GameplaySessionMode
} from "@thumbshooter/shared";

import { resolveGameplayInputMode } from "../../../game";
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
    <div className="w-full max-w-2xl rounded-[1.6rem] border border-border/70 bg-card/88 p-5 shadow-[0_28px_90px_rgb(15_23_42_/_0.28)] backdrop-blur-xl">
      <div className="flex flex-col gap-4">
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
              <h2 className="text-xl font-semibold text-foreground">
                {duckHuntCatalogEntry.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
          <div className="rounded-xl border border-border/70 bg-background/72 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Input
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {selectedInputMode.label}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedInputMode.description}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/72 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Portal
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              Ocean launch
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {duckHuntCatalogEntry.portalSummary}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/72 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Calibration
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {selectedInputMode.requiresCalibration ? "Worker tracking live" : "Not required"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedInputMode.requiresCalibration
                ? calibrationQualityLabel
                : "Mouse mode skips webcam permission and nine-point aiming setup."}
            </p>
          </div>
        </div>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Session mode</p>
              <p className="text-sm text-muted-foreground">
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
            <p className="self-center text-sm text-muted-foreground">
              Local round state and best-score tracking resume inside the experience.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-xl border border-border/70 bg-background/72 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="duck-hunt-coop-room-id">Room code</Label>
                <p className="text-sm text-muted-foreground">
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
                className={`mt-3 text-sm ${
                  coopRoomIdValid && selectedExistingRoom === null
                    ? "text-muted-foreground"
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
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {coopRoomDirectoryError}
                </div>
              ) : null}

              {sortedCoopRoomEntries.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-background/72 px-4 py-4 text-sm text-muted-foreground">
                  No live Duck Hunt co-op rooms yet. Create one with the code above.
                </div>
              ) : (
                sortedCoopRoomEntries.map((roomEntry) => {
                  const selectedRoom =
                    normalizedCoopRoomIdDraft !== null &&
                    roomEntry.roomId === normalizedCoopRoomIdDraft;

                  return (
                    <div
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/72 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      key={roomEntry.roomId}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {roomEntry.roomId}
                          </p>
                          <Badge variant={selectedRoom ? "secondary" : "outline"}>
                            {resolveCoopRoomPhaseLabel(roomEntry)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
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
