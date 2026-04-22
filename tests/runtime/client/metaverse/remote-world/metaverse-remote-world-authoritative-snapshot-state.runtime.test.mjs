import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGroundedBodyRuntimeSnapshot,
  createMetaversePlayerId,
  createMetaverseRealtimeWorldSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  FakeMetaverseWorldClient,
  createRealtimeWorldSnapshot
} from "../../metaverse-runtime-test-fixtures.mjs";

let clientLoader;

class FakeAuthoritativeServerClock {
  #clockOffsetEstimateMs = 0;
  #lastObservedServerTimeMs = null;

  observeServerTime(serverTimeMs, localWallClockMs) {
    if (
      this.#lastObservedServerTimeMs !== null &&
      serverTimeMs <= this.#lastObservedServerTimeMs
    ) {
      return;
    }

    this.#lastObservedServerTimeMs = serverTimeMs;
    this.#clockOffsetEstimateMs = serverTimeMs - localWallClockMs;
  }

  readEstimatedServerTimeMs(localWallClockMs) {
    return localWallClockMs + this.#clockOffsetEstimateMs;
  }
}

async function createAuthoritativeSnapshotHarness({
  latestAcceptedSnapshotReceivedAtMs = null,
  latestPlayerTraversalSequence = 0,
  latestPlayerLookSequence = 0,
  latestPlayerTraversalSampleId = 0,
  latestPlayerTraversalSequence = 0,
  latestPlayerWeaponSequence = 0,
  localPlayerId,
  readWallClockMs,
  worldSnapshots
}) {
  const { MetaverseRemoteWorldAuthoritativeSnapshotState } =
    await clientLoader.load(
      "/src/metaverse/remote-world/metaverse-remote-world-authoritative-snapshot-state.ts"
    );
  const fakeWorldClient = new FakeMetaverseWorldClient(worldSnapshots);

  fakeWorldClient.latestPlayerTraversalSequence = latestPlayerTraversalSequence;
  fakeWorldClient.latestPlayerLookSequence = latestPlayerLookSequence;
  fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot =
    latestPlayerTraversalSampleId > 0
      ? Object.freeze({
          sequence: latestPlayerTraversalSampleId
        })
      : null;
  fakeWorldClient.latestPlayerTraversalSequence =
    latestPlayerTraversalSequence;
  fakeWorldClient.latestPlayerWeaponSequence = latestPlayerWeaponSequence;

  return {
    authoritativeSnapshotState: new MetaverseRemoteWorldAuthoritativeSnapshotState(
      {
        authoritativeServerClock: new FakeAuthoritativeServerClock(),
        readLatestAcceptedSnapshotReceivedAtMs: () =>
          latestAcceptedSnapshotReceivedAtMs,
        readLatestPlayerInputSequence: () => fakeWorldClient.latestPlayerTraversalSequence,
        readLatestPlayerTraversalSampleId: () =>
          fakeWorldClient.latestPlayerIssuedTraversalIntentSnapshot?.sequence ?? 0,
        readLatestPlayerTraversalSequence: () =>
          fakeWorldClient.latestPlayerTraversalSequence,
        readLocalPlayerId: () => localPlayerId,
        readWallClockMs,
        readWorldSnapshotBuffer: () => fakeWorldClient.worldSnapshotBuffer
      }
    ),
    fakeWorldClient
  };
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState refreshes latest authoritative vehicle lookups when the latest snapshot changes", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 8,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 8,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    8
  );

  fakeWorldClient.publishWorldSnapshotBuffer([
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 12,
      remoteUsername,
      serverTimeMs: 1_050,
      snapshotSequence: 2,
      vehicleX: 12,
      yawRadians: 0.2
    })
  ]);
  currentWallClockMs = 1_050;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    12
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState returns the latest authoritative vehicle snapshot only while it remains fresh", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_150,
          snapshotSequence: 2,
          vehicleX: 12,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    )?.position.x,
    12
  );

  currentWallClockMs = 1_500;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeVehicleSnapshot(
      "metaverse-hub-skiff-v1",
      120
    ),
    null
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState preserves the latest authoritative local processed-input ack and freshness gate", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localLastProcessedTraversalSequence: 4,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localLastProcessedTraversalSequence: 6,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_150,
          snapshotSequence: 2,
          vehicleX: 12,
          yawRadians: 0
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedTraversalSequence,
    6
  );
  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedTraversalSequence,
    6
  );

  fakeWorldClient.latestPlayerTraversalSequence = 7;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120),
    null
  );

  currentWallClockMs = 1_500;

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120),
    null
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState ignores look-sequence drift but waits for traversal ack", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      latestPlayerLookSequence: 5,
      latestPlayerTraversalSequence: 2,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localLastProcessedTraversalSequence: 6,
          localLastProcessedLookSequence: 4,
          localLastProcessedTraversalSequence: 1,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0.2
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedLookSequence,
    4
  );
  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120),
    null
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  fakeWorldClient.latestPlayerTraversalSequence = 1;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedTraversalSequence,
    6
  );
  assert.notEqual(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  fakeWorldClient.latestPlayerLookSequence = 4;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedLookSequence,
    4
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState waits for traversal sample-id ack before exposing acked local authority", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-sample-ack-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-sample-ack-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_100;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      latestPlayerTraversalSampleId: 7,
      latestPlayerTraversalSequence: 2,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localLastProcessedTraversalSequence: 6,
          localLastProcessedTraversalSequence: 6,
          localLastProcessedTraversalSequence: 2,
          localPlayerId,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0.2
        })
      ]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120),
    null
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  fakeWorldClient.publishWorldSnapshotBuffer([
    createRealtimeWorldSnapshot({
      currentTick: 11,
      localLastProcessedTraversalSequence: 6,
      localLastProcessedTraversalSequence: 7,
      localLastProcessedTraversalSequence: 2,
      localPlayerId,
      localUsername,
      remotePlayerId,
      remotePlayerX: 12,
      remoteUsername,
      serverTimeMs: 1_050,
      snapshotSequence: 2,
      vehicleX: 12,
      yawRadians: 0.2
    })
  ]);
  currentWallClockMs = 1_050;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSnapshot(120)
      ?.lastProcessedTraversalSequence,
    7
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.lastProcessedTraversalSequence,
    7
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState keeps acked authoritative local player poses raw for local authority sync", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localAnimationVocabulary: "swim",
          localJumpAuthorityState: "none",
          localLastAcceptedJumpActionSequence: 0,
          localLastProcessedTraversalSequence: 6,
          localLastProcessedJumpActionSequence: 0,
          localLinearVelocity: {
            x: 0,
            y: 0,
            z: -6
          },
          localLocomotionMode: "swim",
          localPlayerId,
          localPlayerY: 0,
          localPlayerZ: 24,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10
        }),
        createRealtimeWorldSnapshot({
          currentTick: 11,
          localAnimationVocabulary: "jump-up",
          localJumpAuthorityState: "rising",
          localLastAcceptedJumpActionSequence: 2,
          localLastProcessedTraversalSequence: 6,
          localLastProcessedJumpActionSequence: 2,
          localLinearVelocity: {
            x: 0,
            y: 4,
            z: -6
          },
          localLocomotionMode: "grounded",
          localPlayerId,
          localPlayerY: 1.1,
          localPlayerZ: 23.7,
          localUsername,
          remotePlayerId,
          remotePlayerX: 12,
          remoteUsername,
          serverTimeMs: 1_050,
          snapshotSequence: 2,
          vehicleX: 12
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.equal(ackedLocalPlayerPose.position.z, 23.7);
  assert.equal(ackedLocalPlayerPose.traversalAuthority.currentActionKind, "jump");
  assert.equal(
    ackedLocalPlayerPose.traversalAuthority.currentActionPhase,
    "rising"
  );
  assert.equal(ackedLocalPlayerPose.traversalAuthority.currentActionSequence, 2);
  assert.equal(
    ackedLocalPlayerPose.traversalAuthority.lastConsumedActionSequence,
    2
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState preserves the shared swim body owner on acked local swim authority", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localAnimationVocabulary: "swim",
          localLastProcessedTraversalSequence: 6,
          localLinearVelocity: {
            x: 1,
            y: 0,
            z: -6
          },
          localLocomotionMode: "swim",
          localPlayerId,
          localPlayerX: 4,
          localPlayerY: 0,
          localPlayerZ: 18,
          localYawRadians: 0.25,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10,
          yawRadians: 0.25
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.deepEqual(ackedLocalPlayerPose.swimBody?.linearVelocity, {
    x: 1,
    y: 0,
    z: -6
  });
  assert.deepEqual(ackedLocalPlayerPose.swimBody?.position, {
    x: 4,
    y: 0,
    z: 18
  });
  assert.equal(ackedLocalPlayerPose.swimBody?.yawRadians, 0.25);
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState reads acked grounded yaw from the active body owner", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_000;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [
        createRealtimeWorldSnapshot({
          currentTick: 10,
          localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
            grounded: true,
            linearVelocity: {
              x: 2,
              y: 0,
              z: -1
            },
            position: {
              x: 6,
              y: 0.25,
              z: 22
            },
            yawRadians: 0.75
          }),
          localLastProcessedTraversalSequence: 6,
          localLinearVelocity: {
            x: 0,
            y: 0,
            z: 0
          },
          localLocomotionMode: "grounded",
          localPlayerId,
          localPlayerX: 4,
          localPlayerY: 0,
          localPlayerZ: 18,
          localYawRadians: 0.25,
          localUsername,
          remotePlayerId,
          remotePlayerX: 10,
          remoteUsername,
          serverTimeMs: 1_000,
          snapshotSequence: 1,
          vehicleX: 10
        })
      ]
    });

  const ackedLocalPlayerPose =
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerPose(120);

  assert.notEqual(ackedLocalPlayerPose, null);
  assert.deepEqual(ackedLocalPlayerPose.position, {
    x: 6,
    y: 0.25,
    z: 22
  });
  assert.deepEqual(ackedLocalPlayerPose.linearVelocity, {
    x: 2,
    y: 0,
    z: -1
  });
  assert.equal(ackedLocalPlayerPose.yawRadians, 0.75);
  assert.equal(ackedLocalPlayerPose.groundedBody.yawRadians, 0.75);
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState consumes each fresh acked authoritative local player pose once even when unchanged raw authority is republished", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const initialWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });
  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [initialWorldSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  const unchangedLocalPlayerWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 12,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 15,
    remoteUsername,
    serverTimeMs: 1_080,
    snapshotSequence: 2,
    vehicleX: 15
  });

  fakeWorldClient.publishWorldSnapshotBuffer([
    initialWorldSnapshot,
    unchangedLocalPlayerWorldSnapshot
  ]);
  currentWallClockMs = 1_080;

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );
  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );

  const movedLocalPlayerWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 13,
    localAnimationVocabulary: "idle",
    localJumpAuthorityState: "grounded",
    localLastAcceptedJumpActionSequence: 0,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedJumpActionSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.4,
    localUsername,
    remotePlayerId,
    remotePlayerX: 16,
    remoteUsername,
    serverTimeMs: 1_110,
    snapshotSequence: 3,
    vehicleX: 16
  });

  fakeWorldClient.publishWorldSnapshotBuffer([
    unchangedLocalPlayerWorldSnapshot,
    movedLocalPlayerWorldSnapshot
  ]);
  currentWallClockMs = 1_110;

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.4
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState does not redeliver local authority for body-state-only changes", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;
  const bodyPosition = {
    x: 0,
    y: 0.6,
    z: 23.7
  };

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const initialWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
      grounded: true,
      linearVelocity: {
        x: 0,
        y: 0,
        z: -6
      },
      position: bodyPosition,
      yawRadians: 0
    }),
    localJumpAuthorityState: "grounded",
    localLastProcessedTraversalSequence: 6,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });
  const { authoritativeSnapshotState, fakeWorldClient } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [initialWorldSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );

  const bodyStateOnlyWorldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localGroundedBody: createMetaverseGroundedBodyRuntimeSnapshot({
      contact: {
        blockedPlanarMovement: true,
        blockedVerticalMovement: false,
        supportingContactDetected: true
      },
      grounded: true,
      interaction: {
        applyImpulsesToDynamicBodies: true
      },
      linearVelocity: {
        x: 0,
        y: 0,
        z: -6
      },
      position: bodyPosition,
      yawRadians: 0
    }),
    localJumpAuthorityState: "grounded",
    localLastProcessedTraversalSequence: 6,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });

  fakeWorldClient.publishWorldSnapshotBuffer([bodyStateOnlyWorldSnapshot]);

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120),
    null
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState keeps pose reconciliation acked when only weapon acknowledgement lags", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_050;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const worldSnapshot = createRealtimeWorldSnapshot({
    currentTick: 11,
    localJumpAuthorityState: "grounded",
    localLastProcessedTraversalSequence: 6,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedWeaponSequence: 0,
    localLinearVelocity: {
      x: 0,
      y: 0,
      z: -6
    },
    localLocomotionMode: "grounded",
    localPlayerId,
    localPlayerY: 0.6,
    localPlayerZ: 23.7,
    localUsername,
    remotePlayerId,
    remotePlayerX: 12,
    remoteUsername,
    serverTimeMs: 1_050,
    snapshotSequence: 1,
    vehicleX: 12
  });
  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestPlayerTraversalSequence: 6,
      latestPlayerWeaponSequence: 3,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [worldSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.consumeFreshAckedAuthoritativeLocalPlayerPose(120)
      ?.position.z,
    23.7
  );
});

test("MetaverseRemoteWorldAuthoritativeSnapshotState ages acked local authority from local receipt time instead of emitted server time", async () => {
  const localPlayerId = createMetaversePlayerId("harbor-pilot-local-receive-anchor-1");
  const remotePlayerId = createMetaversePlayerId("remote-sailor-local-receive-anchor-2");
  const localUsername = createUsername("Harbor Pilot");
  const remoteUsername = createUsername("Remote Sailor");
  let currentWallClockMs = 1_200;

  assert.notEqual(localPlayerId, null);
  assert.notEqual(remotePlayerId, null);
  assert.notEqual(localUsername, null);
  assert.notEqual(remoteUsername, null);

  const baselineSnapshot = createRealtimeWorldSnapshot({
    currentTick: 10,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedTraversalSequence: 6,
    localLastProcessedTraversalSequence: 6,
    localPlayerId,
    localUsername,
    remotePlayerId,
    remotePlayerX: 10,
    remoteUsername,
    serverTimeMs: 1_120,
    snapshotSequence: 1,
    vehicleX: 10,
    yawRadians: 0
  });
  const receivedSnapshot = createMetaverseRealtimeWorldSnapshot({
    ...baselineSnapshot,
    tick: {
      ...baselineSnapshot.tick,
      emittedAtServerTimeMs: 1_120,
      simulationTimeMs: 1_000
    }
  });
  const { authoritativeSnapshotState } =
    await createAuthoritativeSnapshotHarness({
      latestAcceptedSnapshotReceivedAtMs: 1_200,
      latestPlayerTraversalSequence: 6,
      latestPlayerTraversalSampleId: 6,
      latestPlayerTraversalSequence: 6,
      localPlayerId,
      readWallClockMs: () => currentWallClockMs,
      worldSnapshots: [receivedSnapshot]
    });

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSample(120)
      ?.authoritativeSnapshotAgeMs,
    0
  );

  currentWallClockMs = 1_260;

  assert.equal(
    authoritativeSnapshotState.readFreshAckedAuthoritativeLocalPlayerSample(120)
      ?.authoritativeSnapshotAgeMs,
    60
  );
});
