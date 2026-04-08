import type { CoopRoomDirectoryClientConfig } from "../types/coop-room-directory";

function resolveDirectoryServerOrigin(): string {
  const configuredOrigin = import.meta.env?.VITE_SERVER_ORIGIN?.trim();

  if (configuredOrigin !== undefined && configuredOrigin.length > 0) {
    return configuredOrigin;
  }

  return "http://127.0.0.1:3210";
}

export const coopRoomDirectoryClientConfig = {
  serverOrigin: resolveDirectoryServerOrigin()
} as const satisfies CoopRoomDirectoryClientConfig;
