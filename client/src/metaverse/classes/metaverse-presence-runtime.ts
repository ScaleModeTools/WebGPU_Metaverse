import type {
  Username
} from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerId,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import { type MetaversePlayerTeamId } from "@webgpu-metaverse/shared";

import type {
  MetaversePresenceClientStatusSnapshot,
  MetaversePresenceJoinRequest,
  RealtimeReliableTransportStatusSnapshot
} from "@/network";
import { createDisabledRealtimeReliableTransportStatusSnapshot } from "@/network";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseHudSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import {
  createMetaversePresencePoseInput,
  resolveMetaversePresencePoseSyncChange,
  resolveMetaversePresenceRosterSyncChange,
  type MetaversePresencePoseChangeKey,
  type MetaversePresenceRosterChangeKey
} from "../presence/metaverse-presence-sync-diff";

export interface MetaverseLocalPlayerIdentity {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly teamId?: MetaversePlayerTeamId;
  readonly username: Username;
}

export interface MetaversePresenceClientRuntime {
  readonly reliableTransportStatusSnapshot: RealtimeReliableTransportStatusSnapshot;
  readonly rosterSnapshot: MetaversePresenceRosterSnapshot | null;
  readonly statusSnapshot: MetaversePresenceClientStatusSnapshot;
  ensureJoined(
    request: MetaversePresenceJoinRequest
  ): Promise<MetaversePresenceRosterSnapshot>;
  subscribeUpdates(listener: () => void): () => void;
  syncPresence(
    pose: Omit<MetaversePresencePoseSnapshotInput, "stateSequence">
  ): void;
  dispose(): void;
}

interface MetaversePresenceRuntimeDependencies {
  readonly createMetaversePresenceClient:
    | (() => MetaversePresenceClientRuntime)
    | null;
  readonly localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly onPresenceUpdate: () => void;
}

function freezePresenceHudSnapshot(
  state: MetaverseHudSnapshot["presence"]["state"],
  joined: boolean,
  lastError: string | null,
  localTeamId: MetaverseHudSnapshot["presence"]["localTeamId"],
  remotePlayerCount: number
): MetaverseHudSnapshot["presence"] {
  return Object.freeze({
    joined,
    lastError,
    localTeamId,
    remotePlayerCount,
    state
  });
}

export class MetaversePresenceRuntime {
  readonly #createMetaversePresenceClient:
    | (() => MetaversePresenceClientRuntime)
    | null;
  readonly #localPlayerIdentity: MetaverseLocalPlayerIdentity | null;
  readonly #onPresenceUpdate: () => void;

  #lastPresencePose: MetaversePresencePoseChangeKey | null = null;
  #lastPresenceRosterChangeKey: MetaversePresenceRosterChangeKey | null = null;
  #metaversePresenceClient: MetaversePresenceClientRuntime | null = null;
  #metaversePresenceUnsubscribe: (() => void) | null = null;
  #remoteCharacterPresentations: readonly MetaverseRemoteCharacterPresentationSnapshot[] =
    Object.freeze([]);

  constructor({
    createMetaversePresenceClient,
    localPlayerIdentity,
    onPresenceUpdate
  }: MetaversePresenceRuntimeDependencies) {
    this.#createMetaversePresenceClient = createMetaversePresenceClient;
    this.#localPlayerIdentity = localPlayerIdentity;
    this.#onPresenceUpdate = onPresenceUpdate;
  }

  get remoteCharacterPresentations(): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    return this.#remoteCharacterPresentations;
  }

  get connectionRequired(): boolean {
    return this.#isConfigured();
  }

  get isJoined(): boolean {
    return this.#metaversePresenceClient?.statusSnapshot.joined ?? false;
  }

  get reliableTransportStatusSnapshot(): RealtimeReliableTransportStatusSnapshot {
    return (
      this.#metaversePresenceClient?.reliableTransportStatusSnapshot ??
      createDisabledRealtimeReliableTransportStatusSnapshot()
    );
  }

  get localTeamId(): MetaversePlayerTeamId | null {
    const resolvedRosterTeamId =
      this.#metaversePresenceClient?.rosterSnapshot?.players.find(
        (playerSnapshot) =>
          playerSnapshot.playerId === this.#localPlayerIdentity?.playerId
      )?.teamId ?? null;

    if (resolvedRosterTeamId !== null) {
      return resolvedRosterTeamId;
    }

    if (this.#localPlayerIdentity === null) {
      return null;
    }

    return this.#localPlayerIdentity.teamId ?? null;
  }

  boot(
    characterPresentation: MetaverseCharacterPresentationSnapshot | null,
    lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    this.dispose();

    if (!this.#isConfigured()) {
      return;
    }

    const metaversePresenceClient =
      this.#createMetaversePresenceClient?.() ?? null;

    if (metaversePresenceClient === null) {
      return;
    }

    this.#metaversePresenceClient = metaversePresenceClient;
    this.#metaversePresenceUnsubscribe =
      metaversePresenceClient.subscribeUpdates(() => {
        if (this.#metaversePresenceClient !== metaversePresenceClient) {
          return;
        }

        this.syncRemoteCharacterPresentations();
        this.#onPresenceUpdate();
      });

    const joinRequest = this.#createJoinRequest(
      characterPresentation,
      lookSnapshot,
      locomotionMode,
      mountedEnvironment
    );

    if (joinRequest === null) {
      return;
    }

    void metaversePresenceClient.ensureJoined(joinRequest).catch(() => {
      if (this.#metaversePresenceClient !== metaversePresenceClient) {
        return;
      }

      this.#onPresenceUpdate();
    });
  }

  dispose(): void {
    this.#metaversePresenceUnsubscribe?.();
    this.#metaversePresenceUnsubscribe = null;
    this.#metaversePresenceClient?.dispose();
    this.#metaversePresenceClient = null;
    this.#lastPresencePose = null;
    this.#lastPresenceRosterChangeKey = null;
    this.#remoteCharacterPresentations = Object.freeze([]);
  }

  syncPresencePose(
    characterPresentation: MetaverseCharacterPresentationSnapshot | null,
    lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    const metaversePresenceClient = this.#metaversePresenceClient;

    if (
      metaversePresenceClient === null ||
      this.#localPlayerIdentity === null ||
      !metaversePresenceClient.statusSnapshot.joined ||
      characterPresentation === null
    ) {
      return;
    }

    const poseSyncChange = resolveMetaversePresencePoseSyncChange(
      this.#lastPresencePose,
      characterPresentation,
      lookSnapshot,
      locomotionMode,
      mountedEnvironment
    );

    if (!poseSyncChange.changed) {
      return;
    }

    this.#lastPresencePose = poseSyncChange.nextChangeKey;
    metaversePresenceClient.syncPresence(poseSyncChange.poseInput);
  }

  syncRemoteCharacterPresentations(): boolean {
    const metaversePresenceClient = this.#metaversePresenceClient;
    const rosterSyncChange = resolveMetaversePresenceRosterSyncChange(
      this.#lastPresenceRosterChangeKey,
      metaversePresenceClient?.rosterSnapshot ?? null,
      this.#localPlayerIdentity?.playerId ?? null
    );

    if (!rosterSyncChange.changed) {
      return false;
    }

    this.#lastPresenceRosterChangeKey = rosterSyncChange.nextChangeKey;
    this.#remoteCharacterPresentations =
      rosterSyncChange.remoteCharacterPresentations;

    return true;
  }

  resolveHudSnapshot(): MetaverseHudSnapshot["presence"] {
    if (!this.#isConfigured()) {
      return freezePresenceHudSnapshot("disabled", false, null, null, 0);
    }

    const metaversePresenceClient = this.#metaversePresenceClient;

    if (metaversePresenceClient === null) {
      return freezePresenceHudSnapshot(
        "idle",
        false,
        null,
        this.localTeamId,
        this.#remoteCharacterPresentations.length
      );
    }

    return freezePresenceHudSnapshot(
      metaversePresenceClient.statusSnapshot.state,
      metaversePresenceClient.statusSnapshot.joined,
      metaversePresenceClient.statusSnapshot.lastError,
      this.localTeamId,
      this.#remoteCharacterPresentations.length
    );
  }

  #isConfigured(): boolean {
    return (
      this.#createMetaversePresenceClient !== null &&
      this.#localPlayerIdentity !== null
    );
  }

  #createJoinRequest(
    characterPresentation: MetaverseCharacterPresentationSnapshot | null,
    lookSnapshot: Pick<MetaverseCameraSnapshot, "pitchRadians" | "yawRadians">,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"],
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): MetaversePresenceJoinRequest | null {
    if (
      this.#localPlayerIdentity === null ||
      characterPresentation === null
    ) {
      return null;
    }

    return {
      characterId: this.#localPlayerIdentity.characterId,
      playerId: this.#localPlayerIdentity.playerId,
      pose: createMetaversePresencePoseInput(
        characterPresentation,
        lookSnapshot,
        locomotionMode,
        mountedEnvironment
      ),
      username: this.#localPlayerIdentity.username
    };
  }
}
