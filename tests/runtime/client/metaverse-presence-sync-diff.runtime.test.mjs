import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaversePlayerId,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolveMetaversePresencePoseSyncChange reports only meaningful local pose changes", async () => {
  const {
    resolveMetaversePresencePoseSyncChange
  } = await clientLoader.load(
    "/src/metaverse/presence/metaverse-presence-sync-diff.ts"
  );

  const initialChange = resolveMetaversePresencePoseSyncChange(
    null,
    {
      animationVocabulary: "seated",
      position: {
        x: 11.5,
        y: 1.1,
        z: -4.25
      },
      yawRadians: 0.75
    },
    {
      pitchRadians: 0.1,
      yawRadians: 0.2
    },
    "grounded",
    {
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "passenger",
      seatId: "port-bench-seat"
    }
  );

  assert.equal(initialChange.changed, true);
  assert.deepEqual(initialChange.poseInput.mountedOccupancy, {
    environmentAssetId: "metaverse-hub-skiff-v1",
    entryId: null,
    occupancyKind: "seat",
    occupantRole: "passenger",
    seatId: "port-bench-seat"
  });

  const repeatedChange = resolveMetaversePresencePoseSyncChange(
    initialChange.nextChangeKey,
    {
      animationVocabulary: "seated",
      position: {
        x: 11.5,
        y: 1.1,
        z: -4.25
      },
      yawRadians: 0.75
    },
    {
      pitchRadians: 0.1,
      yawRadians: 0.2
    },
    "grounded",
    {
      environmentAssetId: "metaverse-hub-skiff-v1",
      entryId: null,
      occupancyKind: "seat",
      occupantRole: "passenger",
      seatId: "port-bench-seat"
    }
  );

  assert.equal(repeatedChange.changed, false);
});

test("resolveMetaversePresenceRosterSyncChange detects roster mutations without relying on snapshot replacement", async () => {
  const {
    resolveMetaversePresenceRosterSyncChange
  } = await clientLoader.load(
    "/src/metaverse/presence/metaverse-presence-sync-diff.ts"
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
        characterId: "metaverse-mannequin-v1",
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
        characterId: "metaverse-mannequin-v1",
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

  const initialChange = resolveMetaversePresenceRosterSyncChange(
    null,
    rosterSnapshot,
    localPlayerId
  );

  assert.equal(initialChange.changed, true);
  assert.equal(initialChange.remoteCharacterPresentations.length, 1);
  assert.equal(
    initialChange.remoteCharacterPresentations[0]?.presentation.position.x,
    -3
  );

  const repeatedChange = resolveMetaversePresenceRosterSyncChange(
    initialChange.nextChangeKey,
    rosterSnapshot,
    localPlayerId
  );

  assert.equal(repeatedChange.changed, false);
  assert.equal(repeatedChange.remoteCharacterPresentations.length, 0);

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

  const mutatedChange = resolveMetaversePresenceRosterSyncChange(
    initialChange.nextChangeKey,
    rosterSnapshot,
    localPlayerId
  );

  assert.equal(mutatedChange.changed, true);
  assert.equal(
    mutatedChange.remoteCharacterPresentations[0]?.presentation.position.x,
    -2
  );
  assert.equal(
    mutatedChange.remoteCharacterPresentations[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    mutatedChange.remoteCharacterPresentations[0]?.look.pitchRadians,
    0.15
  );
  assert.equal(
    mutatedChange.remoteCharacterPresentations[0]?.look.yawRadians,
    0.35
  );
});
