import type {
  CoopRoomDirectorySnapshot,
  CoopRoomDirectorySnapshotInput
} from "@thumbshooter/shared";
import { createCoopRoomDirectorySnapshot } from "@thumbshooter/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrentDirectoryEntryPayload(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.birdsRemaining === "number" &&
    typeof value.capacity === "number" &&
    typeof value.connectedPlayerCount === "number" &&
    typeof value.phase === "string" &&
    typeof value.readyPlayerCount === "number" &&
    typeof value.roundNumber === "number" &&
    typeof value.roundPhase === "string" &&
    typeof value.roundPhaseRemainingMs === "number" &&
    typeof value.requiredReadyPlayerCount === "number" &&
    typeof value.roomId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.tick === "number"
  );
}

export function resolveCoopRoomDirectoryUrl(
  serverOrigin: string,
  roomCollectionPath: string
): string {
  return new URL(roomCollectionPath, serverOrigin).toString();
}

export function parseCoopRoomDirectorySnapshot(
  payload: unknown
): CoopRoomDirectorySnapshot {
  if (!isRecord(payload) || !Array.isArray(payload.coOpRooms)) {
    throw new Error("Co-op room directory response did not include a room list.");
  }

  if (!payload.coOpRooms.every((room) => isCurrentDirectoryEntryPayload(room))) {
    throw new Error(
      "Co-op room directory response did not include the current room summary fields."
    );
  }

  return createCoopRoomDirectorySnapshot(
    payload as unknown as CoopRoomDirectorySnapshotInput
  );
}
