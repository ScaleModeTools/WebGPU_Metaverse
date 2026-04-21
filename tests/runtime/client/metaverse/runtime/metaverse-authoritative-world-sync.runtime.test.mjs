import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

function createMountedSeatOccupancy({
  environmentAssetId = "metaverse-hub-skiff-v1",
  seatId = "driver-seat"
} = {}) {
  return Object.freeze({
    environmentAssetId,
    entryId: null,
    occupancyKind: "seat",
    occupantRole: "driver",
    seatId
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseAuthoritativeWorldSync forwards fresh authoritative local pose without owning traversal action sequence plumbing", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const authoritativeLocalPlayerPose = Object.freeze({
    inputSequence: 17,
    position: Object.freeze({
      x: 4,
      y: 1.6,
      z: -8
    }),
    yawRadians: 0.45
  });
  let syncedAuthoritativePose = null;

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose() {
        throw new Error(
          "syncRemoteVehiclePresentationPose should stay idle for local pose sync."
        );
      },
      syncRemoteEnvironmentBodyPresentationPose() {
        throw new Error(
          "syncRemoteEnvironmentBodyPresentationPose should stay idle for local pose sync."
        );
      }
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {},
      syncAuthoritativeEnvironmentBodyCollisionPose() {
        throw new Error(
          "syncAuthoritativeEnvironmentBodyCollisionPose should stay idle for local pose sync."
        );
      }
    },
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([]),
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return authoritativeLocalPlayerPose;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([]);
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: null,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for local pose sync.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for local pose sync."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for local pose sync.");
      },
      syncAuthoritativeLocalPlayerPose(nextAuthoritativeLocalPlayerPose) {
        syncedAuthoritativePose = nextAuthoritativeLocalPlayerPose;
      },
      syncAuthoritativeVehiclePose() {
        throw new Error(
          "syncAuthoritativeVehiclePose should stay idle for local pose sync."
        );
      }
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose() {
        throw new Error(
          "syncAuthoritativeVehicleCollisionPose should stay idle for local pose sync."
        );
      }
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.deepEqual(
    syncedAuthoritativePose,
    authoritativeLocalPlayerPose
  );
});

test("MetaverseAuthoritativeWorldSync force-snaps only the first fresh authoritative local pose as the spawn bootstrap", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const authoritativeLocalPlayerSamples = [
    Object.freeze({
      authoritativeSnapshotAgeMs: 0,
      authoritativeTick: 10,
      lastProcessedInputSequence: 3,
      lastProcessedTraversalOrientationSequence: 3,
      pose: Object.freeze({
        look: Object.freeze({
          pitchRadians: -0.2,
          yawRadians: 1.25
        })
      }),
      receivedAtWallClockMs: 1_000,
      snapshotSequence: 1
    }),
    Object.freeze({
      authoritativeSnapshotAgeMs: 0,
      authoritativeTick: 11,
      lastProcessedInputSequence: 4,
      lastProcessedTraversalOrientationSequence: 4,
      pose: Object.freeze({
        look: Object.freeze({
          pitchRadians: -0.1,
          yawRadians: 1.4
        })
      }),
      receivedAtWallClockMs: 1_050,
      snapshotSequence: 2
    })
  ];
  const authoritativeSyncCalls = [];

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose() {},
      syncRemoteEnvironmentBodyPresentationPose() {}
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {},
      syncAuthoritativeEnvironmentBodyCollisionPose() {}
    },
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([]),
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerSample() {
        return authoritativeLocalPlayerSamples.shift() ?? null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([]);
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: null,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for spawn bootstrap.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for spawn bootstrap."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for spawn bootstrap.");
      },
      syncAuthoritativeLocalPlayerPose(
        authoritativePlayerSnapshot,
        syncOptions
      ) {
        authoritativeSyncCalls.push(
          Object.freeze({
            authoritativePlayerSnapshot,
            syncOptions: syncOptions ?? null
          })
        );
      },
      syncAuthoritativeVehiclePose() {
        throw new Error(
          "syncAuthoritativeVehiclePose should stay idle for spawn bootstrap."
        );
      }
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose() {}
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();
  worldSync.syncAuthoritativeWorldSnapshots();

  assert.equal(authoritativeSyncCalls.length, 2);
  assert.deepEqual(authoritativeSyncCalls[0]?.syncOptions, {
    forceSnap: true,
    intentionalDiscontinuityCause: "spawn",
    syncAuthoritativeLook: true
  });
  assert.equal(authoritativeSyncCalls[1]?.syncOptions, null);
});

test("MetaverseAuthoritativeWorldSync reconciles the locally mounted vehicle from fresh authoritative vehicle truth", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const localMountedOccupancy = createMountedSeatOccupancy();
  const authoritativeVehicleSyncCalls = [];
  const remoteVehiclePresentationSyncCalls = [];
  const remoteVehicleCollisionSyncCalls = [];

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose(environmentAssetId, poseSnapshot) {
        remoteVehiclePresentationSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      },
      syncRemoteEnvironmentBodyPresentationPose() {
        throw new Error(
          "syncRemoteEnvironmentBodyPresentationPose should stay idle for vehicle sync."
        );
      }
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {},
      syncAuthoritativeEnvironmentBodyCollisionPose() {
        throw new Error(
          "syncAuthoritativeEnvironmentBodyCollisionPose should stay idle for vehicle sync."
        );
      }
    },
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([]),
      remoteVehiclePresentations: Object.freeze([
        Object.freeze({
          environmentAssetId: "metaverse-hub-skiff-v1",
          position: Object.freeze({
            x: 18,
            y: 0.15,
            z: -12
          }),
          yawRadians: 0.1
        }),
        Object.freeze({
          environmentAssetId: "metaverse-hub-skiff-v2",
          position: Object.freeze({
            x: 33,
            y: 0.2,
            z: -4
          }),
          yawRadians: -0.25
        })
      ]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: localMountedOccupancy
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([]);
      },
      readFreshAuthoritativeVehicleSnapshot(environmentAssetId) {
        if (environmentAssetId !== "metaverse-hub-skiff-v1") {
          return null;
        }

        return Object.freeze({
          linearVelocity: Object.freeze({
            x: 1.5,
            y: 0,
            z: -0.25
          }),
          position: Object.freeze({
            x: 21,
            y: 0.18,
            z: -10
          }),
          yawRadians: 0.42
        });
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: localMountedOccupancy,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for vehicle sync.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for vehicle sync."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for vehicle sync.");
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose(environmentAssetId, poseSnapshot) {
        authoritativeVehicleSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose(environmentAssetId, poseSnapshot) {
        remoteVehicleCollisionSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.deepEqual(remoteVehiclePresentationSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v2",
      poseSnapshot: Object.freeze({
        position: Object.freeze({
          x: 33,
          y: 0.2,
          z: -4
        }),
        yawRadians: -0.25
      })
    })
  ]);
  assert.deepEqual(remoteVehicleCollisionSyncCalls, []);
  assert.deepEqual(authoritativeVehicleSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v1",
      poseSnapshot: Object.freeze({
        linearVelocity: Object.freeze({
          x: 1.5,
          y: 0,
          z: -0.25
        }),
        position: Object.freeze({
          x: 21,
          y: 0.18,
          z: -10
        }),
        yawRadians: 0.42
      })
    })
  ]);
});

test("MetaverseAuthoritativeWorldSync keeps remote vehicle presentation smoothing separate from authoritative collision pose", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const remoteVehiclePresentationSyncCalls = [];
  const remoteVehicleCollisionSyncCalls = [];

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose(environmentAssetId, poseSnapshot) {
        remoteVehiclePresentationSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      },
      syncRemoteEnvironmentBodyPresentationPose() {
        throw new Error(
          "syncRemoteEnvironmentBodyPresentationPose should stay idle for remote vehicle sync."
        );
      }
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {},
      syncAuthoritativeEnvironmentBodyCollisionPose() {
        throw new Error(
          "syncAuthoritativeEnvironmentBodyCollisionPose should stay idle for remote vehicle sync."
        );
      }
    },
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([]),
      remoteVehiclePresentations: Object.freeze([
        Object.freeze({
          environmentAssetId: "metaverse-hub-skiff-v2",
          position: Object.freeze({
            x: 33,
            y: 0.2,
            z: -4
          }),
          yawRadians: -0.25
        })
      ]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([]);
      },
      readFreshAuthoritativeVehicleSnapshot(environmentAssetId) {
        if (environmentAssetId !== "metaverse-hub-skiff-v2") {
          return null;
        }

        return Object.freeze({
          linearVelocity: Object.freeze({
            x: 2.2,
            y: 0,
            z: -0.4
          }),
          position: Object.freeze({
            x: 34.5,
            y: 0.18,
            z: -3.5
          }),
          yawRadians: -0.1
        });
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: null,
      boardEnvironment() {
        throw new Error(
          "boardEnvironment should stay idle for remote vehicle sync."
        );
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for remote vehicle sync."
        );
      },
      occupySeat() {
        throw new Error(
          "occupySeat should stay idle for remote vehicle sync."
        );
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose() {
        throw new Error(
          "syncAuthoritativeVehiclePose should stay idle for non-local remote vehicle sync."
        );
      }
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose(environmentAssetId, poseSnapshot) {
        remoteVehicleCollisionSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.deepEqual(remoteVehiclePresentationSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v2",
      poseSnapshot: Object.freeze({
        position: Object.freeze({
          x: 33,
          y: 0.2,
          z: -4
        }),
        yawRadians: -0.25
      })
    })
  ]);
  assert.deepEqual(remoteVehicleCollisionSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-skiff-v2",
      poseSnapshot: Object.freeze({
        linearVelocity: Object.freeze({
          x: 2.2,
          y: 0,
          z: -0.4
        }),
        position: Object.freeze({
          x: 34.5,
          y: 0.18,
          z: -3.5
        }),
        yawRadians: -0.1
      })
    })
  ]);
});

test("MetaverseAuthoritativeWorldSync clears a rejected local mounted seat claim only after the mismatch hold elapses", async () => {
  const [
    { MetaverseAuthoritativeWorldSync },
    { metaverseLocalAuthorityReconciliationConfig }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/classes/metaverse-authoritative-world-sync.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-world-network.ts")
  ]);
  const localMountedOccupancy = createMountedSeatOccupancy();
  let wallClockMs = 1_100;
  let leaveMountedEnvironmentCallCount = 0;

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose() {},
      syncRemoteEnvironmentBodyPresentationPose() {}
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {},
      syncAuthoritativeEnvironmentBodyCollisionPose() {}
    },
    readWallClockMs: () => wallClockMs,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([]),
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([]);
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: localMountedOccupancy,
      boardEnvironment() {
        throw new Error(
          "boardEnvironment should stay idle for seat-claim rejection."
        );
      },
      leaveMountedEnvironment() {
        leaveMountedEnvironmentCallCount += 1;
      },
      occupySeat() {
        throw new Error(
          "occupySeat should stay idle for seat-claim rejection."
        );
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose() {}
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose() {}
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 0);

  wallClockMs +=
    metaverseLocalAuthorityReconciliationConfig.mountedOccupancyMismatchHoldMs - 1;
  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 0);

  wallClockMs += 1;
  worldSync.syncAuthoritativeWorldSnapshots();
  assert.equal(leaveMountedEnvironmentCallCount, 1);
});

test("MetaverseAuthoritativeWorldSync keeps remote environment body presentation smoothing separate from authoritative collision pose", async () => {
  const { MetaverseAuthoritativeWorldSync } = await clientLoader.load(
    "/src/metaverse/classes/metaverse-authoritative-world-sync.ts"
  );
  const environmentBodyPresentationSyncCalls = [];
  const environmentBodyCollisionSyncCalls = [];
  let authoritativeEnvironmentBodyCollisionSyncResetCount = 0;

  const worldSync = new MetaverseAuthoritativeWorldSync({
    authoritativePlayerMovementEnabled: true,
    dynamicEnvironmentPresentationRuntime: {
      syncRemoteVehiclePresentationPose() {},
      syncRemoteEnvironmentBodyPresentationPose(environmentAssetId, poseSnapshot) {
        environmentBodyPresentationSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    },
    environmentBodyCollisionRuntime: {
      beginAuthoritativeEnvironmentBodyCollisionSync() {
        authoritativeEnvironmentBodyCollisionSyncResetCount += 1;
      },
      syncAuthoritativeEnvironmentBodyCollisionPose(environmentAssetId, poseSnapshot) {
        environmentBodyCollisionSyncCalls.push(
          Object.freeze({
            environmentAssetId,
            poseSnapshot
          })
        );
      }
    },
    readWallClockMs: () => 1_250,
    remoteWorldRuntime: {
      remoteEnvironmentBodyPresentations: Object.freeze([
        Object.freeze({
          environmentAssetId: "metaverse-hub-pushable-crate-v1",
          position: Object.freeze({
            x: -7.1,
            y: 0.46,
            z: 13.4
          }),
          yawRadians: -0.1
        })
      ]),
      remoteVehiclePresentations: Object.freeze([]),
      consumeFreshAckedAuthoritativeLocalPlayerPose() {
        return null;
      },
      readFreshAuthoritativeLocalPlayerSnapshot() {
        return Object.freeze({
          mountedOccupancy: null
        });
      },
      readFreshAuthoritativeEnvironmentBodySnapshots() {
        return Object.freeze([
          Object.freeze({
            environmentAssetId: "metaverse-hub-pushable-crate-v1",
            linearVelocity: Object.freeze({
              x: 0.8,
              y: 0,
              z: -0.1
            }),
            position: Object.freeze({
              x: -7.4,
              y: 0.46,
              z: 13.1
            }),
            yawRadians: -0.25
          })
        ]);
      },
      readFreshAuthoritativeVehicleSnapshot() {
        return null;
      }
    },
    traversalRuntime: {
      mountedEnvironmentSnapshot: null,
      boardEnvironment() {
        throw new Error("boardEnvironment should stay idle for environment body sync.");
      },
      leaveMountedEnvironment() {
        throw new Error(
          "leaveMountedEnvironment should stay idle for environment body sync."
        );
      },
      occupySeat() {
        throw new Error("occupySeat should stay idle for environment body sync.");
      },
      syncAuthoritativeLocalPlayerPose() {},
      syncAuthoritativeVehiclePose() {}
    },
    vehicleCollisionRuntime: {
      syncAuthoritativeVehicleCollisionPose() {}
    }
  });

  worldSync.syncAuthoritativeWorldSnapshots();

  assert.equal(authoritativeEnvironmentBodyCollisionSyncResetCount, 1);
  assert.deepEqual(environmentBodyPresentationSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-pushable-crate-v1",
      poseSnapshot: Object.freeze({
        position: Object.freeze({
          x: -7.1,
          y: 0.46,
          z: 13.4
        }),
        yawRadians: -0.1
      })
    })
  ]);
  assert.deepEqual(environmentBodyCollisionSyncCalls, [
    Object.freeze({
      environmentAssetId: "metaverse-hub-pushable-crate-v1",
      poseSnapshot: Object.freeze({
        linearVelocity: Object.freeze({
          x: 0.8,
          y: 0,
          z: -0.1
        }),
        position: Object.freeze({
          x: -7.4,
          y: 0.46,
          z: 13.1
        }),
        yawRadians: -0.25
      })
    })
  ]);
});
