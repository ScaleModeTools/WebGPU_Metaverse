import { createMetaversePresenceRosterSnapshot } from "@webgpu-metaverse/shared";

export class FakeMetaversePresenceClient {
  constructor(localPlayerId, localUsername, remotePlayerId) {
    this.disposeCalls = 0;
    this.ensureJoinedRequests = [];
    this.listeners = new Set();
    this.localPlayerId = localPlayerId;
    this.localUsername = localUsername;
    this.remotePlayerId = remotePlayerId;
    this.rosterSnapshot = null;
    this.reliableTransportStatusSnapshot = Object.freeze({
      activeTransport: "http",
      browserWebTransportAvailable: false,
      enabled: true,
      fallbackActive: false,
      lastTransportError: null,
      preference: "http",
      webTransportConfigured: false,
      webTransportStatus: "not-requested"
    });
    this.statusSnapshot = Object.freeze({
      joined: false,
      lastError: null,
      lastSnapshotSequence: null,
      playerId: null,
      state: "idle"
    });
    this.syncPresenceCalls = [];
  }

  ensureJoined(request) {
    this.ensureJoinedRequests.push(request);
    this.statusSnapshot = Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: this.localPlayerId,
      state: "connected"
    });
    this.rosterSnapshot = createMetaversePresenceRosterSnapshot({
      players: [
        {
          characterId: request.characterId,
          playerId: this.localPlayerId,
          pose: {
            ...request.pose,
            stateSequence: 1
          },
          username: this.localUsername
        },
        {
          characterId: "metaverse-mannequin-v1",
          playerId: this.remotePlayerId,
          pose: {
            animationVocabulary: "walk",
            locomotionMode: "swim",
            position: {
              x: -3,
              y: 0.2,
              z: 8
            },
            stateSequence: 1,
            yawRadians: 0.45
          },
          username: "Remote Sailor"
        }
      ],
      snapshotSequence: 1,
      tickIntervalMs: 120
    });
    this.#notifyUpdates();

    return Promise.resolve(this.rosterSnapshot);
  }

  subscribeUpdates(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  syncPresence(pose) {
    this.syncPresenceCalls.push(pose);
  }

  dispose() {
    this.disposeCalls += 1;
    this.statusSnapshot = Object.freeze({
      joined: false,
      lastError: null,
      lastSnapshotSequence: this.statusSnapshot.lastSnapshotSequence,
      playerId: this.localPlayerId,
      state: "disposed"
    });
    this.#notifyUpdates();
  }

  #notifyUpdates() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
