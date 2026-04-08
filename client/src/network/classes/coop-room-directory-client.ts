import type { CoopRoomDirectorySnapshot } from "@thumbshooter/shared";

import { coopRoomDirectoryClientConfig } from "../config/coop-room-directory";
import {
  parseCoopRoomDirectorySnapshot,
  resolveCoopRoomDirectoryUrl
} from "../codecs/coop-room-directory-http";
import { parseCoopRoomErrorMessage } from "../codecs/coop-room-client-http";
import type { CoopRoomDirectoryClientConfig } from "../types/coop-room-directory";

interface CoopRoomDirectoryClientDependencies {
  readonly fetch?: typeof globalThis.fetch;
}

function resolveFetchDependency(
  fetchDependency: typeof globalThis.fetch | undefined
): typeof globalThis.fetch {
  if (fetchDependency !== undefined) {
    return fetchDependency;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("Fetch API is unavailable for the co-op room directory client.");
}

export class CoopRoomDirectoryClient {
  readonly #config: CoopRoomDirectoryClientConfig;
  readonly #fetch: typeof globalThis.fetch;

  constructor(
    config: CoopRoomDirectoryClientConfig = coopRoomDirectoryClientConfig,
    dependencies: CoopRoomDirectoryClientDependencies = {}
  ) {
    this.#config = config;
    this.#fetch = resolveFetchDependency(dependencies.fetch);
  }

  async fetchSnapshot(): Promise<CoopRoomDirectorySnapshot> {
    const response = await this.#fetch(
      resolveCoopRoomDirectoryUrl(this.#config.serverOrigin)
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseCoopRoomErrorMessage(payload, "Co-op room directory fetch failed.")
      );
    }

    return parseCoopRoomDirectorySnapshot(payload);
  }
}
