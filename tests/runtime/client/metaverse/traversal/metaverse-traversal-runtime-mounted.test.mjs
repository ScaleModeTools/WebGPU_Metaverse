import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { authoredWaterBayOpenWaterSpawn } from "../../../metaverse-authored-world-test-fixtures.mjs";
import {
  createMountedAnchorKey,
  createMountedEnvironmentSnapshot,
  createTraversalFixtureContext,
  freezeVector3,
  syncAuthoritativeLocalPlayerPose
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime applies authoritative mounted vehicle poses for passenger occupancy", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        "metaverse-hub-skiff-v1": Object.freeze({
          position: freezeVector3(0, 0.3, 18),
          yawRadians: 0
        })
      },
      mountableEnvironmentConfigs: {
        "metaverse-hub-skiff-v1": {
          label: "Metaverse hub skiff",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            }),
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Port bench",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat",
              seatNodeName: "port_bench_seat",
              seatRole: "passenger"
            })
          ]
        }
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.occupySeat("metaverse-hub-skiff-v1", "port-bench-seat");

    traversalRuntime.syncAuthoritativeVehiclePose("metaverse-hub-skiff-v1", {
      position: freezeVector3(6, 0.55, 14),
      yawRadians: 0.8
    });

    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "seated"
    );
    assert.ok(Math.abs(traversalRuntime.cameraSnapshot.position.x - 6) < 4);
    assert.ok(
      Math.abs(traversalRuntime.characterPresentationSnapshot?.position.x - 6) <
        0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime applies authoritative mounted vehicle corrections for local driver occupancy", async () => {
  const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        "metaverse-hub-skiff-v1": Object.freeze({
          position: freezeVector3(0, 0.3, 18),
          yawRadians: 0
        })
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.occupySeat("metaverse-hub-skiff-v1", "driver-seat");

    const poseWriteCountBeforeSync = dynamicPoseWrites.length;

    traversalRuntime.syncAuthoritativeVehiclePose("metaverse-hub-skiff-v1", {
      position: freezeVector3(6, 0.55, 14),
      yawRadians: 0.8
    });

    assert.equal(dynamicPoseWrites.length, poseWriteCountBeforeSync + 1);
    assert.ok(
      Math.abs(
        (traversalRuntime.characterPresentationSnapshot?.position.x ?? 0) - 6
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime seeds mounted vehicle occupancy from collision pose instead of scene presentation pose", async () => {
  const collisionPose = Object.freeze({
    position: freezeVector3(12, 0.55, 9),
    yawRadians: 0.8
  });
  const presentationPose = Object.freeze({
    position: freezeVector3(2, 0.3, 18),
    yawRadians: 0
  });
  const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentCollisionPoses: {
        "metaverse-hub-skiff-v1": collisionPose
      },
      dynamicEnvironmentPoses: {
        "metaverse-hub-skiff-v1": presentationPose
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.occupySeat("metaverse-hub-skiff-v1", "driver-seat");

    assert.deepEqual(dynamicPoseWrites.at(-1)?.poseSnapshot, collisionPose);
    assert.ok(
      Math.abs(
        (traversalRuntime.characterPresentationSnapshot?.position.x ?? 0) -
          collisionPose.position.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(traversalRuntime.cameraSnapshot.yawRadians - collisionPose.yawRadians) <
        0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime routes mounted vehicle occupancy through the traversal owner and restores swim on dismount", async () => {
  const vehicleAssetId = "metaverse-test-canoe-v1";
  const { config, dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(
            authoredWaterBayOpenWaterSpawn.x,
            0.12,
            authoredWaterBayOpenWaterSpawn.z
          ),
          yawRadians: 0
        })
      }
    });

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");

    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(vehicleAssetId, "Metaverse test canoe")
    );

    assert.equal(traversalRuntime.locomotionMode, "mounted");
    assert.equal(dynamicPoseWrites.at(-1)?.environmentAssetId, vehicleAssetId);
    const mountedCamera = traversalRuntime.cameraSnapshot;

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 1
      }),
      1 / 60
    );

    const mountedVehiclePoseAfterMouseLook =
      dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(mountedVehiclePoseAfterMouseLook?.yawRadians > 0);
    assert.equal(
      traversalRuntime.cameraSnapshot.yawRadians,
      mountedVehiclePoseAfterMouseLook?.yawRadians
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.yawRadians,
      mountedVehiclePoseAfterMouseLook?.yawRadians
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians > mountedCamera.yawRadians
    );
    assert.ok(dynamicPoseWrites.length >= 2);

    traversalRuntime.syncMountedEnvironment(null);

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.cameraSnapshot.position.y,
      config.ocean.height +
        config.swim.cameraEyeHeightMeters +
        config.bodyPresentation.swimThirdPersonHeightOffsetMeters
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime maps mounted driver input onto vehicle-local travel axes", async () => {
  const initialPosition = freezeVector3(
    authoredWaterBayOpenWaterSpawn.x,
    0.12,
    authoredWaterBayOpenWaterSpawn.z
  );
  const cases = [
    {
      input: Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      label: "forward",
      validate(poseSnapshot) {
        assert.ok(poseSnapshot.position.z < initialPosition.z);
        assert.equal(poseSnapshot.yawRadians, 0);
      }
    },
    {
      input: Object.freeze({
        boost: false,
        jump: false,
        moveAxis: -1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      label: "backward",
      validate(poseSnapshot) {
        assert.ok(poseSnapshot.position.z > initialPosition.z);
        assert.equal(poseSnapshot.yawRadians, 0);
      }
    },
    {
      input: Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 0,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: -1,
        yawAxis: 0
      }),
      label: "turn-left",
      validate(poseSnapshot) {
        assert.equal(poseSnapshot.position.x, initialPosition.x);
        assert.equal(poseSnapshot.position.z, initialPosition.z);
        assert.ok(poseSnapshot.yawRadians < 0);
      }
    },
    {
      input: Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 0,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 1,
        yawAxis: 0
      }),
      label: "turn-right",
      validate(poseSnapshot) {
        assert.equal(poseSnapshot.position.x, initialPosition.x);
        assert.equal(poseSnapshot.position.z, initialPosition.z);
        assert.ok(poseSnapshot.yawRadians > 0);
      }
    }
  ];

  for (const inputCase of cases) {
    const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
      await fixtureContext.createOpenWaterTraversalHarness({
        dynamicEnvironmentPoses: {
          "metaverse-hub-skiff-v1": Object.freeze({
            position: initialPosition,
            yawRadians: 0
          })
        }
      });

    try {
      traversalRuntime.boot();
      traversalRuntime.syncMountedEnvironment(
        createMountedEnvironmentSnapshot(
          "metaverse-hub-skiff-v1",
          "Metaverse hub skiff"
        )
      );
      traversalRuntime.advance(inputCase.input, 0.25);

      const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

      assert.ok(poseSnapshot, `Missing mounted driver pose for ${inputCase.label}.`);
      inputCase.validate(poseSnapshot);
    } finally {
      groundedBodyRuntime.dispose();
    }
  }
});

test("MetaverseTraversalRuntime suppresses vehicle steering for passenger control policy", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const initialPosition = freezeVector3(0, 0.12, 24);
  const { dynamicPoseWrites, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: initialPosition,
          yawRadians: 0
        })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Passenger seat",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "passenger-seat",
              seatNodeName: "passenger_seat",
              seatRole: "passenger"
            })
          ]
        }
      }
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(
        vehicleAssetId,
        "Metaverse test shuttle",
        {
          controlRoutingPolicyId: "look-only",
          occupantLabel: "Passenger seat",
          occupantRole: "passenger",
          seatId: "passenger-seat",
          occupancyKind: "seat"
        }
      )
    );
    traversalRuntime.advance(
      Object.freeze({
        boost: true,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 1,
        yawAxis: 1
      }),
      0.25
    );

    const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(poseSnapshot);
    assert.equal(poseSnapshot.position.x, initialPosition.x);
    assert.equal(poseSnapshot.position.y, initialPosition.y);
    assert.equal(poseSnapshot.position.z, initialPosition.z);
    assert.equal(poseSnapshot.yawRadians, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps standing deck entry occupancy grounded and walkable", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            })
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedPosition = traversalRuntime.characterPresentationSnapshot?.position;

    assert.equal(traversalRuntime.mountedEnvironmentSnapshot?.entryId, "deck-entry");
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
    assert.ok(boardedPosition);
    assert.ok(groundedBodyRuntime.snapshot.grounded);
    assert.ok(Math.abs(groundedBodyRuntime.snapshot.position.y - 1) < 0.05);
    assert.ok(Math.abs((boardedPosition?.x ?? 0) - deckEntryAnchor.x) < 0.5);
    assert.ok(Math.abs((boardedPosition?.z ?? 0) - deckEntryAnchor.z) < 0.5);

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        jump: false,
        moveAxis: 1,
        pitchAxis: 0,
        primaryAction: false,
        secondaryAction: false,
        strafeAxis: 0,
        yawAxis: 0
      }),
      0.25
    );

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "walk"
    );
    assert.ok(
      Math.hypot(
        (traversalRuntime.characterPresentationSnapshot?.position.x ?? 0) -
          (boardedPosition?.x ?? 0),
        (traversalRuntime.characterPresentationSnapshot?.position.z ?? 0) -
          (boardedPosition?.z ?? 0)
      ) > 0.001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime leaves grounded free-roam deck occupancy on the live body until authoritative player correction arrives", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            })
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedSnapshot = groundedBodyRuntime.snapshot;
    const seededLinearVelocity = freezeVector3(0.75, 0, 0.2);

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: true,
      interaction: boardedSnapshot.interaction,
      linearVelocity: seededLinearVelocity,
      position: boardedSnapshot.position,
      yawRadians: boardedSnapshot.yawRadians
    });

    traversalRuntime.syncAuthoritativeVehiclePose(vehicleAssetId, {
      position: freezeVector3(1.0, 0.12, 24),
      yawRadians: 0
    });

    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - boardedSnapshot.position.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.z - boardedSnapshot.position.z
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.x -
          seededLinearVelocity.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.z -
          seededLinearVelocity.z
      ) < 0.000001
    );

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      linearVelocity: seededLinearVelocity,
      locomotionMode: "grounded",
      mountedOccupancy: Object.freeze({
        environmentAssetId: vehicleAssetId,
        entryId: "deck-entry",
        occupancyKind: "entry",
        occupantRole: "passenger",
        seatId: null
      }),
      position: freezeVector3(
        boardedSnapshot.position.x + 1.6,
        boardedSnapshot.position.y,
        boardedSnapshot.position.z
      ),
      yawRadians: boardedSnapshot.yawRadians
    });

    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      groundedBodyRuntime.snapshot.position.x > boardedSnapshot.position.x + 0.19
    );
    assert.ok(
      groundedBodyRuntime.snapshot.position.x < boardedSnapshot.position.x + 0.21
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime does not force airborne free-roam deck occupancy back onto support when vehicle authority moves", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            })
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedSnapshot = groundedBodyRuntime.snapshot;
    const airbornePosition = freezeVector3(
      boardedSnapshot.position.x,
      boardedSnapshot.position.y + 0.7,
      boardedSnapshot.position.z
    );

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      interaction: boardedSnapshot.interaction,
      linearVelocity: freezeVector3(0.3, 1.15, 0),
      position: airbornePosition,
      yawRadians: boardedSnapshot.yawRadians
    });

    traversalRuntime.syncAuthoritativeVehiclePose(vehicleAssetId, {
      position: freezeVector3(1.0, 0.12, 24),
      yawRadians: 0.35
    });

    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - airbornePosition.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airbornePosition.y
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.z - airbornePosition.z
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime leaves grounded free-roam deck occupancy on the live body when unboarding", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            })
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedSnapshot = groundedBodyRuntime.snapshot;
    const preservedPosition = freezeVector3(
      boardedSnapshot.position.x + 0.28,
      boardedSnapshot.position.y,
      boardedSnapshot.position.z - 0.19
    );
    const preservedLinearVelocity = freezeVector3(0.75, 0, 0.2);
    const preservedYawRadians = 0.31;

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: true,
      interaction: boardedSnapshot.interaction,
      linearVelocity: preservedLinearVelocity,
      position: preservedPosition,
      yawRadians: preservedYawRadians
    });

    traversalRuntime.leaveMountedEnvironment();

    assert.equal(traversalRuntime.mountedEnvironmentSnapshot, null);
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - preservedPosition.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - preservedPosition.y
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.z - preservedPosition.z
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.x -
          preservedLinearVelocity.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.z -
          preservedLinearVelocity.z
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.yawRadians - preservedYawRadians
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime does not reseat airborne free-roam deck occupancy when unboarding", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const deckEntryAnchor = freezeVector3(0.42, 1.38, 24.58);
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      dynamicEnvironmentPoses: {
        [vehicleAssetId]: Object.freeze({
          position: freezeVector3(0, 0.12, 24),
          yawRadians: 0
        })
      },
      mountedEnvironmentAnchorSnapshots: {
        [createMountedAnchorKey(vehicleAssetId, null, "deck-entry")]:
          Object.freeze({
            position: deckEntryAnchor,
            yawRadians: 0
          })
      },
      mountableEnvironmentConfigs: {
        [vehicleAssetId]: {
          entries: [
            Object.freeze({
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: freezeVector3(0, 0, 1),
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            })
          ],
          label: "Metaverse test shuttle",
          seats: [
            Object.freeze({
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: freezeVector3(0, 0, 1),
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            })
          ]
        }
      },
      surfaceColliderSnapshots: [
        Object.freeze({
          halfExtents: freezeVector3(2.3, 0.06, 1.8),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          translation: freezeVector3(0, 0.94, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.boardEnvironment(vehicleAssetId, "deck-entry");

    const boardedSnapshot = groundedBodyRuntime.snapshot;
    const airbornePosition = freezeVector3(
      boardedSnapshot.position.x + 0.12,
      boardedSnapshot.position.y + 0.7,
      boardedSnapshot.position.z - 0.09
    );
    const airborneLinearVelocity = freezeVector3(0.3, 1.15, 0);

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      interaction: boardedSnapshot.interaction,
      linearVelocity: airborneLinearVelocity,
      position: airbornePosition,
      yawRadians: boardedSnapshot.yawRadians
    });

    traversalRuntime.leaveMountedEnvironment();

    assert.equal(traversalRuntime.mountedEnvironmentSnapshot, null);
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - airbornePosition.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airbornePosition.y
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.z - airbornePosition.z
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.x -
          airborneLinearVelocity.x
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.y -
          airborneLinearVelocity.y
      ) < 0.000001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.linearVelocity.z -
          airborneLinearVelocity.z
      ) < 0.000001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps passenger camera look seat-local while mounted truth stays vehicle-owned", async () => {
  const vehicleAssetId = "metaverse-test-shuttle-v1";
  const initialPosition = freezeVector3(0, 0.12, 24);
  const passengerSeatYawRadians = 0.35;
  const {
    dynamicPoseWrites,
    groundedBodyRuntime,
    traversalRuntime
  } = await fixtureContext.createTraversalHarness({
    dynamicEnvironmentPoses: {
      [vehicleAssetId]: Object.freeze({
        position: initialPosition,
        yawRadians: 0
      })
    },
    mountedEnvironmentAnchorSnapshots: {
      [createMountedAnchorKey(vehicleAssetId, "passenger-seat", null)]:
        Object.freeze({
          position: freezeVector3(-0.25, 1.02, 23.52),
          yawRadians: passengerSeatYawRadians
        })
    },
    mountableEnvironmentConfigs: {
      [vehicleAssetId]: {
        label: "Metaverse test shuttle",
        seats: [
          Object.freeze({
            cameraPolicyId: "seat-follow",
            controlRoutingPolicyId: "look-only",
            directEntryEnabled: true,
            dismountOffset: freezeVector3(0, 0, 1),
            label: "Passenger seat",
            lookLimitPolicyId: "passenger-bench",
            occupancyAnimationId: "seated",
            seatId: "passenger-seat",
            seatNodeName: "passenger_seat",
            seatRole: "passenger"
          })
        ]
      }
    }
  });

  try {
    traversalRuntime.boot();
    traversalRuntime.syncMountedEnvironment(
      createMountedEnvironmentSnapshot(
        vehicleAssetId,
        "Metaverse test shuttle",
        {
          cameraPolicyId: "seat-follow",
          controlRoutingPolicyId: "look-only",
          occupantLabel: "Passenger seat",
          occupantRole: "passenger",
          lookLimitPolicyId: "passenger-bench",
          seatId: "passenger-seat",
          occupancyKind: "seat"
        }
      )
    );

    assert.equal(traversalRuntime.characterPresentationSnapshot?.yawRadians, 0);
    assert.equal(
      traversalRuntime.cameraSnapshot.yawRadians,
      passengerSeatYawRadians
    );

    for (let frame = 0; frame < 90; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: false,
          moveAxis: 0,
          pitchAxis: 1,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 1
        }),
        1 / 60
      );
    }

    const poseSnapshot = dynamicPoseWrites.at(-1)?.poseSnapshot;

    assert.ok(poseSnapshot);
    assert.equal(poseSnapshot.position.x, initialPosition.x);
    assert.equal(poseSnapshot.position.z, initialPosition.z);
    assert.equal(poseSnapshot.yawRadians, 0);
    assert.equal(traversalRuntime.characterPresentationSnapshot?.yawRadians, 0);
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians > passengerSeatYawRadians
    );
    assert.ok(
      traversalRuntime.cameraSnapshot.yawRadians <
        passengerSeatYawRadians + Math.PI * 0.46
    );
    assert.ok(traversalRuntime.cameraSnapshot.pitchRadians <= 0.42);
  } finally {
    groundedBodyRuntime.dispose();
  }
});
