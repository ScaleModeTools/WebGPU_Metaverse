import type {
  MetaverseJoinRoomRequest,
  MetaverseMatchModeId,
  MetaverseNextMatchRequest,
  MetaverseQuickJoinRoomRequest,
  MetaverseRoomAssignmentSnapshot,
  MetaverseRoomDirectorySnapshot,
  MetaverseRoomId
} from "@webgpu-metaverse/shared";

import {
  parseMetaverseRoomAssignmentSnapshot,
  parseMetaverseRoomDirectorySnapshot,
  parseMetaverseRoomErrorMessage,
  resolveMetaverseRoomDirectoryUrl,
  resolveMetaverseRoomJoinUrl,
  resolveMetaverseRoomNextMatchUrl,
  resolveMetaverseRoomQuickJoinUrl,
  serializeMetaverseJoinRoomRequest,
  serializeMetaverseNextMatchRequest,
  serializeMetaverseQuickJoinRoomRequest
} from "../codecs/metaverse-room-directory-http";
import type {
  MetaverseRoomDirectoryClientConfig,
  MetaverseRoomDirectoryClientRuntime
} from "../types/metaverse-room-directory";

interface MetaverseRoomDirectoryClientDependencies {
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

  throw new Error(
    "Fetch API is unavailable for the metaverse room directory client."
  );
}

export class MetaverseRoomDirectoryClient
  implements MetaverseRoomDirectoryClientRuntime
{
  readonly #config: MetaverseRoomDirectoryClientConfig;
  readonly #fetch: typeof globalThis.fetch;

  constructor(
    config: MetaverseRoomDirectoryClientConfig,
    dependencies: MetaverseRoomDirectoryClientDependencies = {}
  ) {
    this.#config = config;
    this.#fetch = resolveFetchDependency(dependencies.fetch);
  }

  async fetchSnapshot(
    matchMode?: MetaverseMatchModeId
  ): Promise<MetaverseRoomDirectorySnapshot> {
    const response = await this.#fetch(
      resolveMetaverseRoomDirectoryUrl(
        this.#config.serverOrigin,
        this.#config.roomCollectionPath,
        matchMode
      ),
      {
        cache: "no-store"
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseMetaverseRoomErrorMessage(
          payload,
          "Metaverse room directory fetch failed."
        )
      );
    }

    return parseMetaverseRoomDirectorySnapshot(payload);
  }

  async quickJoinRoom(
    request: MetaverseQuickJoinRoomRequest
  ): Promise<MetaverseRoomAssignmentSnapshot> {
    const response = await this.#fetch(
      resolveMetaverseRoomQuickJoinUrl(
        this.#config.serverOrigin,
        this.#config.roomCollectionPath
      ),
      {
        body: serializeMetaverseQuickJoinRoomRequest(request),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseMetaverseRoomErrorMessage(payload, "Metaverse quick join failed.")
      );
    }

    return parseMetaverseRoomAssignmentSnapshot(payload);
  }

  async joinRoom(
    roomId: MetaverseRoomId,
    request: MetaverseJoinRoomRequest
  ): Promise<MetaverseRoomAssignmentSnapshot> {
    const response = await this.#fetch(
      resolveMetaverseRoomJoinUrl(
        this.#config.serverOrigin,
        this.#config.roomCollectionPath,
        roomId
      ),
      {
        body: serializeMetaverseJoinRoomRequest(request),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseMetaverseRoomErrorMessage(payload, "Metaverse room join failed.")
      );
    }

    return parseMetaverseRoomAssignmentSnapshot(payload);
  }

  async requestNextMatch(
    roomId: MetaverseRoomId,
    request: MetaverseNextMatchRequest
  ): Promise<MetaverseRoomAssignmentSnapshot> {
    const response = await this.#fetch(
      resolveMetaverseRoomNextMatchUrl(
        this.#config.serverOrigin,
        this.#config.roomCollectionPath,
        roomId
      ),
      {
        body: serializeMetaverseNextMatchRequest(request),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        parseMetaverseRoomErrorMessage(payload, "Metaverse next match failed.")
      );
    }

    return parseMetaverseRoomAssignmentSnapshot(payload);
  }
}
