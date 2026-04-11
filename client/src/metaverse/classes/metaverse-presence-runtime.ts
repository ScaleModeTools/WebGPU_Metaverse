import type {
  MetaversePlayerId,
  MetaversePresenceAnimationVocabularyId,
  MetaversePresenceLocomotionModeId,
  MetaversePresencePoseSnapshotInput,
  MetaversePresenceRosterSnapshot,
  Username
} from "@webgpu-metaverse/shared";

import type {
  MetaversePresenceClientStatusSnapshot,
  MetaversePresenceJoinRequest
} from "@/network";
import type {
  MetaverseCharacterPresentationSnapshot,
  MetaverseHudSnapshot,
  MetaverseRemoteCharacterPresentationSnapshot
} from "../types/metaverse-runtime";

export interface MetaverseLocalPlayerIdentity {
  readonly characterId: string;
  readonly playerId: MetaversePlayerId;
  readonly username: Username;
}

export interface MetaversePresenceClientRuntime {
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

interface MetaversePresencePoseChangeKey {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly x: number;
  readonly y: number;
  readonly yawRadians: number;
  readonly z: number;
}

interface MetaversePresenceRosterPlayerChangeKey {
  readonly animationVocabulary: MetaversePresenceAnimationVocabularyId;
  readonly characterId: string;
  readonly locomotionMode: MetaversePresenceLocomotionModeId;
  readonly playerId: MetaversePlayerId;
  readonly stateSequence: number;
  readonly username: Username;
  readonly x: number;
  readonly y: number;
  readonly yawRadians: number;
  readonly z: number;
}

interface MetaversePresenceRosterChangeKey {
  readonly players: readonly MetaversePresenceRosterPlayerChangeKey[];
  readonly snapshotSequence: number;
  readonly tickIntervalMs: number;
}

function freezePresenceHudSnapshot(
  state: MetaverseHudSnapshot["presence"]["state"],
  joined: boolean,
  lastError: string | null,
  remotePlayerCount: number
): MetaverseHudSnapshot["presence"] {
  return Object.freeze({
    joined,
    lastError,
    remotePlayerCount,
    state
  });
}

function createPresencePoseInput(
  characterPresentation: MetaverseCharacterPresentationSnapshot,
  locomotionMode: MetaverseHudSnapshot["locomotionMode"]
): Omit<MetaversePresencePoseSnapshotInput, "stateSequence"> {
  return {
    animationVocabulary: characterPresentation.animationVocabulary,
    locomotionMode,
    position: characterPresentation.position,
    yawRadians: characterPresentation.yawRadians
  };
}

function createPresencePoseChangeKey(
  characterPresentation: MetaverseCharacterPresentationSnapshot,
  locomotionMode: MetaverseHudSnapshot["locomotionMode"]
): MetaversePresencePoseChangeKey {
  return {
    animationVocabulary: characterPresentation.animationVocabulary,
    locomotionMode,
    x: characterPresentation.position.x,
    y: characterPresentation.position.y,
    yawRadians: characterPresentation.yawRadians,
    z: characterPresentation.position.z
  };
}

function hasMatchingPresencePoseChangeKey(
  current: MetaversePresencePoseChangeKey | null,
  next: MetaversePresencePoseChangeKey
): boolean {
  return (
    current !== null &&
    current.animationVocabulary === next.animationVocabulary &&
    current.locomotionMode === next.locomotionMode &&
    current.x === next.x &&
    current.y === next.y &&
    current.z === next.z &&
    current.yawRadians === next.yawRadians
  );
}

function hasMatchingRosterChangeKey(
  rosterSnapshot: MetaversePresenceRosterSnapshot,
  changeKey: MetaversePresenceRosterChangeKey | null
): boolean {
  if (
    changeKey === null ||
    changeKey.snapshotSequence !== rosterSnapshot.snapshotSequence ||
    changeKey.tickIntervalMs !== rosterSnapshot.tickIntervalMs ||
    changeKey.players.length !== rosterSnapshot.players.length
  ) {
    return false;
  }

  for (let index = 0; index < rosterSnapshot.players.length; index += 1) {
    const playerSnapshot = rosterSnapshot.players[index]!;
    const playerChangeKey = changeKey.players[index]!;

    if (
      playerChangeKey.playerId !== playerSnapshot.playerId ||
      playerChangeKey.characterId !== playerSnapshot.characterId ||
      playerChangeKey.username !== playerSnapshot.username ||
      playerChangeKey.animationVocabulary !==
        playerSnapshot.pose.animationVocabulary ||
      playerChangeKey.locomotionMode !== playerSnapshot.pose.locomotionMode ||
      playerChangeKey.stateSequence !== playerSnapshot.pose.stateSequence ||
      playerChangeKey.x !== playerSnapshot.pose.position.x ||
      playerChangeKey.y !== playerSnapshot.pose.position.y ||
      playerChangeKey.z !== playerSnapshot.pose.position.z ||
      playerChangeKey.yawRadians !== playerSnapshot.pose.yawRadians
    ) {
      return false;
    }
  }

  return true;
}

function createRosterChangeKey(
  rosterSnapshot: MetaversePresenceRosterSnapshot
): MetaversePresenceRosterChangeKey {
  return Object.freeze({
    players: Object.freeze(
      rosterSnapshot.players.map((playerSnapshot) =>
        Object.freeze({
          animationVocabulary: playerSnapshot.pose.animationVocabulary,
          characterId: playerSnapshot.characterId,
          locomotionMode: playerSnapshot.pose.locomotionMode,
          playerId: playerSnapshot.playerId,
          stateSequence: playerSnapshot.pose.stateSequence,
          username: playerSnapshot.username,
          x: playerSnapshot.pose.position.x,
          y: playerSnapshot.pose.position.y,
          yawRadians: playerSnapshot.pose.yawRadians,
          z: playerSnapshot.pose.position.z
        })
      )
    ),
    snapshotSequence: rosterSnapshot.snapshotSequence,
    tickIntervalMs: rosterSnapshot.tickIntervalMs
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

  boot(
    characterPresentation: MetaverseCharacterPresentationSnapshot | null,
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
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
      locomotionMode
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
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
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

    const nextPresencePose = createPresencePoseChangeKey(
      characterPresentation,
      locomotionMode
    );

    if (
      hasMatchingPresencePoseChangeKey(
        this.#lastPresencePose,
        nextPresencePose
      )
    ) {
      return;
    }

    this.#lastPresencePose = nextPresencePose;
    metaversePresenceClient.syncPresence(
      createPresencePoseInput(characterPresentation, locomotionMode)
    );
  }

  syncRemoteCharacterPresentations(): boolean {
    const metaversePresenceClient = this.#metaversePresenceClient;
    const rosterSnapshot = metaversePresenceClient?.rosterSnapshot ?? null;

    if (rosterSnapshot === null || this.#localPlayerIdentity === null) {
      const hadRemotePresence =
        this.#remoteCharacterPresentations.length > 0 ||
        this.#lastPresenceRosterChangeKey !== null;

      this.#lastPresenceRosterChangeKey = null;
      this.#remoteCharacterPresentations = Object.freeze([]);

      return hadRemotePresence;
    }

    if (
      hasMatchingRosterChangeKey(
        rosterSnapshot,
        this.#lastPresenceRosterChangeKey
      )
    ) {
      return false;
    }

    this.#lastPresenceRosterChangeKey = createRosterChangeKey(rosterSnapshot);
    this.#remoteCharacterPresentations = this.#createRemoteCharacterPresentations(
      rosterSnapshot
    );

    return true;
  }

  resolveHudSnapshot(): MetaverseHudSnapshot["presence"] {
    if (!this.#isConfigured()) {
      return freezePresenceHudSnapshot("disabled", false, null, 0);
    }

    const metaversePresenceClient = this.#metaversePresenceClient;

    if (metaversePresenceClient === null) {
      return freezePresenceHudSnapshot(
        "idle",
        false,
        null,
        this.#remoteCharacterPresentations.length
      );
    }

    return freezePresenceHudSnapshot(
      metaversePresenceClient.statusSnapshot.state,
      metaversePresenceClient.statusSnapshot.joined,
      metaversePresenceClient.statusSnapshot.lastError,
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
    locomotionMode: MetaverseHudSnapshot["locomotionMode"]
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
      pose: createPresencePoseInput(characterPresentation, locomotionMode),
      username: this.#localPlayerIdentity.username
    };
  }

  #createRemoteCharacterPresentations(
    rosterSnapshot: MetaversePresenceRosterSnapshot
  ): readonly MetaverseRemoteCharacterPresentationSnapshot[] {
    if (this.#localPlayerIdentity === null) {
      return Object.freeze([]);
    }

    const remoteCharacterPresentations: MetaverseRemoteCharacterPresentationSnapshot[] =
      [];

    for (const playerSnapshot of rosterSnapshot.players) {
      if (playerSnapshot.playerId === this.#localPlayerIdentity.playerId) {
        continue;
      }

      remoteCharacterPresentations.push(
        Object.freeze({
          characterId: playerSnapshot.characterId,
          playerId: playerSnapshot.playerId,
          presentation: Object.freeze({
            animationVocabulary: playerSnapshot.pose.animationVocabulary,
            position: playerSnapshot.pose.position,
            yawRadians: playerSnapshot.pose.yawRadians
          })
        })
      );
    }

    return Object.freeze(remoteCharacterPresentations);
  }
}
