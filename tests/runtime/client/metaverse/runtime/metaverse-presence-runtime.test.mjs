import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePresenceRosterSnapshot,
  createMetaversePlayerId,
  resolveMetaversePlayerTeamId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaversePresenceRuntime detects roster object mutations without relying on replacement", async () => {
  const { MetaversePresenceRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-presence-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const rosterSnapshot = {
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        playerId: localPlayerId,
        pose: {
          animationVocabulary: "idle",
          look: {
            pitchRadians: 0,
            yawRadians: 0
          },
          locomotionMode: "grounded",
          position: {
            x: 0,
            y: 1,
            z: 0
          },
          stateSequence: 1,
          yawRadians: 0
        },
        username: localUsername
      },
      {
        characterId: "mesh2motion-humanoid-v1",
        playerId: remotePlayerId,
        pose: {
          animationVocabulary: "walk",
          look: {
            pitchRadians: -0.2,
            yawRadians: 0.85
          },
          locomotionMode: "mounted",
          mountedOccupancy: {
            environmentAssetId: "metaverse-hub-skiff-v1",
            entryId: null,
            occupancyKind: "seat",
            occupantRole: "passenger",
            seatId: "port-bench-seat"
          },
          position: {
            x: -3,
            y: 0.2,
            z: 8
          },
          stateSequence: 1,
          yawRadians: 0.45
        },
        username: remoteUsername
      }
    ],
    snapshotSequence: 1,
    tickIntervalMs: 120
  };
  let disposeCalls = 0;
  const fakePresenceClient = {
    rosterSnapshot,
    statusSnapshot: Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: localPlayerId,
      state: "connected"
    }),
    dispose() {
      disposeCalls += 1;
    },
    ensureJoined() {
      return Promise.resolve(rosterSnapshot);
    },
    subscribeUpdates() {
      return () => {};
    },
    syncPresence() {}
  };
  const presenceRuntime = new MetaversePresenceRuntime({
    createMetaversePresenceClient: () => fakePresenceClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      teamId: resolveMetaversePlayerTeamId(localPlayerId),
      username: localUsername
    },
    onPresenceUpdate() {}
  });

  presenceRuntime.boot(
    {
      animationVocabulary: "idle",
      position: {
        x: 0,
        y: 1,
        z: 0
      },
      yawRadians: 0
    },
    {
      pitchRadians: 0,
      yawRadians: 0
    },
    "grounded",
    null
  );
  presenceRuntime.syncRemoteCharacterPresentations();

  assert.equal(presenceRuntime.remoteCharacterPresentations.length, 1);
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.presentation.position.x,
    -3
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "port-bench-seat"
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.look.pitchRadians,
    -0.2
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.look.yawRadians,
    0.85
  );

  rosterSnapshot.players[1] = {
    ...rosterSnapshot.players[1],
    pose: {
      ...rosterSnapshot.players[1].pose,
      look: {
        pitchRadians: 0.15,
        yawRadians: 0.35
      },
      mountedOccupancy: {
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      position: {
        x: -2,
        y: 0.2,
        z: 8
      },
      stateSequence: 2
    }
  };
  presenceRuntime.syncRemoteCharacterPresentations();

  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.presentation.position.x,
    -2
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.look.pitchRadians,
    0.15
  );
  assert.equal(
    presenceRuntime.remoteCharacterPresentations[0]?.look.yawRadians,
    0.35
  );

  presenceRuntime.dispose();

  assert.equal(disposeCalls, 1);
});

test("MetaversePresenceRuntime syncs canonical mounted occupancy through the presence client", async () => {
  const { MetaversePresenceRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-presence-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const localUsername = createUsername("Harbor Pilot");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(localUsername, null);

  const syncPresenceCalls = [];
  const fakePresenceClient = {
    rosterSnapshot: createMetaversePresenceRosterSnapshot({
      players: [],
      snapshotSequence: 2,
      tickIntervalMs: 120
    }),
    statusSnapshot: Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: localPlayerId,
      state: "connected"
    }),
    dispose() {},
    ensureJoined() {
      return Promise.resolve(this.rosterSnapshot);
    },
    subscribeUpdates() {
      return () => {};
    },
    syncPresence(pose) {
      syncPresenceCalls.push(pose);
    }
  };
  const presenceRuntime = new MetaversePresenceRuntime({
    createMetaversePresenceClient: () => fakePresenceClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      teamId: resolveMetaversePlayerTeamId(localPlayerId),
      username: localUsername
    },
    onPresenceUpdate() {}
  });

  presenceRuntime.boot(
    {
      animationVocabulary: "idle",
      position: {
        x: 0,
        y: 1,
        z: 0
      },
      yawRadians: 0
    },
    {
      pitchRadians: 0.1,
      yawRadians: 0.2
    },
    "grounded",
    null
  );
  presenceRuntime.syncPresencePose(
    {
      animationVocabulary: "seated",
      position: {
        x: 11.5,
        y: 1.1,
        z: -14.2
      },
      yawRadians: 0.6
    },
    {
      pitchRadians: 0.32,
      yawRadians: 1.1
    },
    "mounted",
    Object.freeze({
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      directSeatTargets: Object.freeze([]),
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Metaverse hub skiff",
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Take helm",
      occupantRole: "driver",
      seatTargets: Object.freeze([]),
      seatId: "driver-seat"
    })
  );

  assert.ok(syncPresenceCalls.length >= 1);
  assert.equal(
    syncPresenceCalls.at(-1)?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(syncPresenceCalls.at(-1)?.mountedOccupancy?.seatId, "driver-seat");
  assert.equal(
    syncPresenceCalls.at(-1)?.mountedOccupancy?.occupancyKind,
    "seat"
  );
  assert.equal(syncPresenceCalls.at(-1)?.look?.pitchRadians, 0.32);
  assert.equal(syncPresenceCalls.at(-1)?.look?.yawRadians, 1.1);
});

test("MetaversePresenceRuntime sends the assigned team before first spawn join", async () => {
  const { MetaversePresenceRuntime } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-presence-runtime.ts"
  );
  const localPlayerId = createMetaversePlayerId("team-aware-join-pilot");
  const localUsername = createUsername("Team Join Pilot");

  assert.notEqual(localPlayerId, null);
  assert.notEqual(localUsername, null);

  const ensureJoinedCalls = [];
  const fakePresenceClient = {
    rosterSnapshot: createMetaversePresenceRosterSnapshot({
      players: [],
      snapshotSequence: 1,
      tickIntervalMs: 120
    }),
    statusSnapshot: Object.freeze({
      joined: true,
      lastError: null,
      lastSnapshotSequence: 1,
      playerId: localPlayerId,
      state: "connected"
    }),
    dispose() {},
    ensureJoined(request) {
      ensureJoinedCalls.push(request);
      return Promise.resolve(this.rosterSnapshot);
    },
    subscribeUpdates() {
      return () => {};
    },
    syncPresence() {}
  };
  const assignedTeamId = resolveMetaversePlayerTeamId(localPlayerId);
  const presenceRuntime = new MetaversePresenceRuntime({
    createMetaversePresenceClient: () => fakePresenceClient,
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      teamId: assignedTeamId,
      username: localUsername
    },
    onPresenceUpdate() {}
  });

  presenceRuntime.boot(
    {
      animationVocabulary: "idle",
      position: {
        x: 0,
        y: 1,
        z: 0
      },
      yawRadians: 0
    },
    {
      pitchRadians: 0,
      yawRadians: 0
    },
    "grounded",
    null
  );
  await Promise.resolve();

  assert.equal(ensureJoinedCalls.length, 1);
  assert.equal(ensureJoinedCalls[0]?.teamId, assignedTeamId);
  assert.equal(presenceRuntime.localTeamId, assignedTeamId);
});
