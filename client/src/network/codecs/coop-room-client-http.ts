import type {
  CoopRoomClientCommand,
  CoopRoomId,
  CoopRoomServerEvent,
  CoopRoomSnapshotInput,
  CoopPlayerId
} from "@thumbshooter/shared";
import { createCoopRoomSnapshotEvent } from "@thumbshooter/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrentRoomSessionPayload(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.birdsCleared === "number" &&
    typeof value.birdsRemaining === "number" &&
    typeof value.phase === "string" &&
    typeof value.roundDurationMs === "number" &&
    typeof value.roundNumber === "number" &&
    typeof value.roundPhase === "string" &&
    typeof value.roundPhaseRemainingMs === "number" &&
    typeof value.requiredReadyPlayerCount === "number" &&
    typeof value.sessionId === "string" &&
    typeof value.teamHitsLanded === "number" &&
    typeof value.teamShotsFired === "number"
  );
}

function isCurrentRoomTickPayload(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.currentTick === "number" &&
    typeof value.tickIntervalMs === "number"
  );
}

function isCurrentRoomPayload(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Array.isArray(value.birds) &&
    typeof value.capacity === "number" &&
    Array.isArray(value.players) &&
    typeof value.roomId === "string" &&
    isCurrentRoomSessionPayload(value.session) &&
    isCurrentRoomTickPayload(value.tick)
  );
}

export function resolveCoopRoomSnapshotUrl(
  serverOrigin: string,
  roomId: CoopRoomId,
  playerId?: CoopPlayerId
): string {
  const snapshotUrl = new URL(`/coop/rooms/${roomId}`, serverOrigin);

  if (playerId !== undefined) {
    snapshotUrl.searchParams.set("playerId", playerId);
  }

  return snapshotUrl.toString();
}

export function resolveCoopRoomCommandUrl(
  serverOrigin: string,
  roomId: CoopRoomId
): string {
  return new URL(`/coop/rooms/${roomId}/commands`, serverOrigin).toString();
}

export function serializeCoopRoomClientCommand(
  command: CoopRoomClientCommand
): string {
  return JSON.stringify(command);
}

export function parseCoopRoomServerEvent(payload: unknown): CoopRoomServerEvent {
  if (!isRecord(payload) || payload.type !== "room-snapshot" || !isRecord(payload.room)) {
    throw new Error("Co-op room response did not include a room snapshot event.");
  }

  if (!isCurrentRoomPayload(payload.room)) {
    throw new Error(
      "Co-op room response did not include the current room snapshot fields."
    );
  }

  return createCoopRoomSnapshotEvent(payload.room as unknown as CoopRoomSnapshotInput);
}

export function parseCoopRoomErrorMessage(
  payload: unknown,
  fallbackMessage: string
): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    const normalizedMessage = payload.error.trim();

    if (normalizedMessage.length > 0) {
      return normalizedMessage;
    }
  }

  return fallbackMessage;
}
