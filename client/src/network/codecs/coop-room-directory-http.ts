import type {
  CoopRoomDirectorySnapshot,
  CoopRoomDirectorySnapshotInput
} from "@thumbshooter/shared";
import { createCoopRoomDirectorySnapshot } from "@thumbshooter/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveCoopRoomDirectoryUrl(serverOrigin: string): string {
  return new URL("/", serverOrigin).toString();
}

export function parseCoopRoomDirectorySnapshot(
  payload: unknown
): CoopRoomDirectorySnapshot {
  if (!isRecord(payload) || !Array.isArray(payload.coOpRooms)) {
    throw new Error("Co-op room directory response did not include a room list.");
  }

  return createCoopRoomDirectorySnapshot(
    payload as unknown as CoopRoomDirectorySnapshotInput
  );
}
