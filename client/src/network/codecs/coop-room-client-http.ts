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
