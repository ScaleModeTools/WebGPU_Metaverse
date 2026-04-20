import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMetaverseUnmountedTraversalBodyStep,
  clearMetaverseUnmountedTraversalPendingActions,
  createMetaverseUnmountedTraversalStateSnapshot,
  createMetaverseTraversalActionStateSnapshot,
  prepareMetaverseUnmountedTraversalStep,
  queueMetaverseUnmountedTraversalAction,
  queueMetaverseTraversalAction,
  resolveMetaverseUnmountedTraversalTransition,
  resolveMetaverseUnmountedTraversalStep
} from "@webgpu-metaverse/shared";

const surfacePolicyConfig = Object.freeze({
  capsuleHalfHeightMeters: 0.48,
  capsuleRadiusMeters: 0.34,
  gravityUnitsPerSecond: 18,
  jumpImpulseUnitsPerSecond: 6.8,
  oceanHeightMeters: 0,
  stepHeightMeters: 0.28
});

function createSupportCollider(surfaceHeightMeters) {
  return Object.freeze({
    halfExtents: Object.freeze({
      x: 1,
      y: 0.1,
      z: 1
    }),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    }),
    rotationYRadians: 0,
    translation: Object.freeze({
      x: 0,
      y: surfaceHeightMeters - 0.1,
      z: 0
    }),
    traversalAffordance: "support"
  });
}

function createNarrowSupportCollider(surfaceHeightMeters, halfWidthMeters = 0.12) {
  return Object.freeze({
    halfExtents: Object.freeze({
      x: halfWidthMeters,
      y: 0.1,
      z: halfWidthMeters
    }),
    ownerEnvironmentAssetId: null,
    rotation: Object.freeze({
      x: 0,
      y: 0,
      z: 0,
      w: 1
    }),
    rotationYRadians: 0,
    translation: Object.freeze({
      x: 0,
      y: surfaceHeightMeters - 0.1,
      z: 0
    }),
    traversalAffordance: "support"
  });
}

const waterRegionSnapshots = Object.freeze([
  Object.freeze({
    halfExtents: Object.freeze({
      x: 3,
      y: 0,
      z: 3
    }),
    rotationYRadians: 0,
    translation: Object.freeze({
      x: 0,
      y: 0,
      z: 0
    }),
    waterRegionId: "test-water"
  })
]);

function createGroundedBodySnapshot({
  grounded,
  jumpReady,
  position,
  verticalSpeedUnitsPerSecond,
  yawRadians
}) {
  return Object.freeze({
    grounded,
    jumpBody: Object.freeze({
      grounded,
      jumpGroundContactGraceSecondsRemaining: 0,
      jumpReady,
      jumpSnapSuppressionActive: false,
      verticalSpeedUnitsPerSecond
    }),
    position: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    yawRadians
  });
}

const groundedBodyConfig = Object.freeze({
  controllerOffsetMeters: 0.02,
  maxTurnSpeedRadiansPerSecond: 1.9,
  snapToGroundDistanceMeters: 0.22
});

test("shared unmounted traversal state keeps locomotion ownership while queueing and clearing actions", () => {
  const queuedState = queueMetaverseUnmountedTraversalAction(
    createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "swim"
    }),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 7
      },
      bufferSeconds: 0.2
    }
  );

  assert.equal(queuedState.locomotionMode, "swim");
  assert.equal(queuedState.actionState.pendingActionKind, "jump");
  assert.equal(queuedState.actionState.pendingActionSequence, 7);

  const clearedState =
    clearMetaverseUnmountedTraversalPendingActions(queuedState);

  assert.equal(clearedState.locomotionMode, "swim");
  assert.equal(clearedState.actionState.pendingActionKind, "none");
  assert.equal(clearedState.actionState.resolvedActionKind, "none");
});

test("shared unmounted grounded traversal prep owns jump support plus autostep routing", () => {
  const actionState = queueMetaverseTraversalAction(
    createMetaverseTraversalActionStateSnapshot(),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 4
      },
      bufferSeconds: 0.2
    }
  );
  const step = prepareMetaverseUnmountedTraversalStep({
    bodyControl: Object.freeze({
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    }),
    deltaSeconds: 1 / 30,
    groundedBodyConfig,
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: true,
      jumpReady: true,
      position: Object.freeze({
        x: 0,
        y: 0.2,
        z: 0
      }),
      verticalSpeedUnitsPerSecond: 0,
      yawRadians: 0
    }),
    jumpSupportVerticalSpeedTolerance: 0.5,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([createSupportCollider(0.2)]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    traversalState: Object.freeze({
      actionState,
      locomotionMode: "grounded"
    }),
    waterRegionSnapshots
  });

  assert.equal(step.locomotionMode, "grounded");
  assert.equal(step.surfaceJumpSupported, true);
  assert.equal(step.groundedJumpSupported, true);
  assert.equal(step.jumpRequested, true);
  assert.equal(step.bodyIntent.jump, true);
  assert.equal(step.bodyIntent.jumpReadyOverride, true);
  assert.equal(step.bodyIntent.snapToGroundOverrideEnabled, true);
});

test("shared unmounted grounded traversal prep keeps snap-to-ground armed on supported floor when no water region overlaps the player", () => {
  const step = prepareMetaverseUnmountedTraversalStep({
    bodyControl: Object.freeze({
      boost: false,
      moveAxis: 0,
      strafeAxis: 0,
      turnAxis: 0
    }),
    deltaSeconds: 1 / 30,
    groundedBodyConfig,
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: true,
      jumpReady: true,
      position: Object.freeze({
        x: 0,
        y: 0.6,
        z: 24
      }),
      verticalSpeedUnitsPerSecond: 0,
      yawRadians: 0
    }),
    jumpSupportVerticalSpeedTolerance: 0.5,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([
      Object.freeze({
        ...createSupportCollider(0.6),
        translation: Object.freeze({
          x: 0,
          y: 0.5,
          z: 24
        })
      })
    ]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    traversalState: Object.freeze({
      actionState: createMetaverseTraversalActionStateSnapshot(),
      locomotionMode: "grounded"
    }),
    waterRegionSnapshots: Object.freeze([])
  });

  assert.equal(step.locomotionMode, "grounded");
  assert.equal(step.bodyIntent.snapToGroundOverrideEnabled, true);
});

test("shared unmounted traversal body-step helper sequences grounded prep body advance and outcome resolution on one path", () => {
  const queuedJumpState = queueMetaverseUnmountedTraversalAction(
    createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "grounded"
    }),
    {
      actionIntent: {
        kind: "jump",
        pressed: true,
        sequence: 9
      },
      bufferSeconds: 0.2
    }
  );
  let groundedAdvanceInput = null;
  const bodyStep = advanceMetaverseUnmountedTraversalBodyStep({
    advanceGroundedBodySnapshot: (input) => {
      groundedAdvanceInput = input;

      return createGroundedBodySnapshot({
        grounded: false,
        jumpReady: false,
        position: Object.freeze({
          x: 0.22,
          y: 0.34,
          z: 0
        }),
        verticalSpeedUnitsPerSecond: 4.1,
        yawRadians: 0.18
      });
    },
    advanceSwimBodySnapshot: () => {
      throw new Error("grounded test should not advance the swim body");
    },
    bodyControl: Object.freeze({
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    }),
    deltaSeconds: 1 / 30,
    groundedBodyConfig,
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: true,
      jumpReady: true,
      position: Object.freeze({
        x: 0,
        y: 0.2,
        z: 0
      }),
      verticalSpeedUnitsPerSecond: 0,
      yawRadians: 0
    }),
    jumpSupportVerticalSpeedTolerance: 0.5,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([createSupportCollider(0.2)]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    traversalState: queuedJumpState,
    waterRegionSnapshots
  });

  assert.equal(bodyStep.preparedTraversalStep.locomotionMode, "grounded");
  assert.equal(bodyStep.groundedBodySnapshot?.grounded, false);
  assert.equal(bodyStep.swimBodySnapshot, null);
  assert.equal(bodyStep.locomotionOutcome.locomotionMode, "grounded");
  assert.equal(groundedAdvanceInput.bodyIntent.jump, true);
  assert.equal(groundedAdvanceInput.bodyIntent.jumpReadyOverride, true);
  assert.equal(groundedAdvanceInput.bodyIntent.snapToGroundOverrideEnabled, true);
  assert.equal(groundedAdvanceInput.autostepHeightMeters, null);
});

test("shared unmounted traversal body-step helper sequences swim prep body advance and outcome resolution on one path", () => {
  let swimAdvanceInput = null;
  const bodyStep = advanceMetaverseUnmountedTraversalBodyStep({
    advanceGroundedBodySnapshot: () => {
      throw new Error("swim test should not advance the grounded body");
    },
    advanceSwimBodySnapshot: (input) => {
      swimAdvanceInput = input;

      return Object.freeze({
        position: Object.freeze({
          x: 0.15,
          y: 0,
          z: -0.1
        }),
        yawRadians: 0.24
      });
    },
    bodyControl: Object.freeze({
      boost: true,
      moveAxis: 0.6,
      strafeAxis: -0.4,
      turnAxis: 0.2
    }),
    deltaSeconds: 1 / 30,
    groundedBodyConfig,
    groundedBodySnapshot: null,
    jumpSupportVerticalSpeedTolerance: 0.5,
    preferredLookYawRadians: 0.24,
    surfaceColliderSnapshots: Object.freeze([]),
    surfacePolicyConfig,
    swimBodySnapshot: Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      yawRadians: 0
    }),
    traversalState: createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "swim"
    }),
    waterRegionSnapshots
  });

  assert.equal(bodyStep.preparedTraversalStep.locomotionMode, "swim");
  assert.equal(bodyStep.groundedBodySnapshot, null);
  assert.equal(bodyStep.swimBodySnapshot?.yawRadians, 0.24);
  assert.equal(bodyStep.locomotionOutcome.locomotionMode, "swim");
  assert.equal(swimAdvanceInput.bodyControl.boost, true);
  assert.equal(swimAdvanceInput.bodyControl.moveAxis, 0.6);
  assert.equal(swimAdvanceInput.bodyControl.strafeAxis, -0.4);
  assert.equal(swimAdvanceInput.bodyControl.turnAxis, 0.2);
  assert.equal(swimAdvanceInput.preferredLookYawRadians, 0.24);
  assert.equal(swimAdvanceInput.waterlineHeightMeters, 0);
});

test("shared unmounted traversal transition helper reports swim entry and grounded exit semantics", () => {
  const swimEntryTransition = resolveMetaverseUnmountedTraversalTransition({
    locomotionOutcome: Object.freeze({
      grounded: false,
      locomotionMode: "swim",
      supportHeightMeters: null,
      waterlineHeightMeters: 0.12
    }),
    preparedTraversalStep: Object.freeze({
      locomotionMode: "grounded"
    })
  });

  assert.deepEqual(swimEntryTransition, {
    enteredGrounded: false,
    enteredSwim: true,
    grounded: false,
    locomotionMode: "swim",
    positionYMeters: 0.12,
    positionYSource: "waterline",
    resetVerticalVelocity: true
  });

  const groundedExitTransition = resolveMetaverseUnmountedTraversalTransition({
    locomotionOutcome: Object.freeze({
      grounded: true,
      locomotionMode: "grounded",
      supportHeightMeters: 0.6,
      waterlineHeightMeters: 0
    }),
    preparedTraversalStep: Object.freeze({
      locomotionMode: "swim"
    })
  });

  assert.deepEqual(groundedExitTransition, {
    enteredGrounded: true,
    enteredSwim: false,
    grounded: true,
    locomotionMode: "grounded",
    positionYMeters: 0.6,
    positionYSource: "support",
    resetVerticalVelocity: true
  });
});

test("shared unmounted grounded traversal outcome keeps airborne travel grounded until the waterline is actually reached", () => {
  const groundedPreparedStep = Object.freeze({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: false,
      jump: false,
      jumpReadyOverride: false,
      moveAxis: 0,
      snapToGroundOverrideEnabled: false,
      strafeAxis: 0,
      turnAxis: 0
    }),
    groundedJumpSupported: false,
    jumpRequested: false,
    locomotionMode: "grounded",
    surfaceJumpSupported: false,
    traversalState: createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "grounded"
    })
  });
  const airborneOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      jumpReady: false,
      position: Object.freeze({
        x: 0,
        y: 0.2,
        z: 0
      }),
      verticalSpeedUnitsPerSecond: -1,
      yawRadians: 0
    }),
    preparedTraversalStep: groundedPreparedStep,
    surfaceColliderSnapshots: Object.freeze([]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    waterRegionSnapshots
  });

  assert.equal(airborneOutcome.locomotionMode, "grounded");
  assert.equal(airborneOutcome.grounded, false);
  assert.equal(airborneOutcome.waterlineHeightMeters, 0);

  const waterEntryOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      jumpReady: false,
      position: Object.freeze({
        x: 0,
        y: 0.04,
        z: 0
      }),
      verticalSpeedUnitsPerSecond: -1,
      yawRadians: 0
    }),
    preparedTraversalStep: groundedPreparedStep,
    surfaceColliderSnapshots: Object.freeze([]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    waterRegionSnapshots
  });

  assert.equal(waterEntryOutcome.locomotionMode, "swim");
  assert.equal(waterEntryOutcome.grounded, false);
});

test("shared unmounted grounded traversal outcome does not fabricate water entry on supported floor outside authored water regions", () => {
  const groundedPreparedStep = Object.freeze({
    autostepHeightMeters: null,
    bodyIntent: Object.freeze({
      boost: false,
      jump: false,
      jumpReadyOverride: false,
      moveAxis: 0,
      snapToGroundOverrideEnabled: true,
      strafeAxis: 0,
      turnAxis: 0
    }),
    groundedJumpSupported: true,
    jumpRequested: false,
    locomotionMode: "grounded",
    surfaceJumpSupported: true,
    traversalState: createMetaverseUnmountedTraversalStateSnapshot({
      locomotionMode: "grounded"
    })
  });
  const groundedOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: true,
      jumpReady: true,
      position: Object.freeze({
        x: 0,
        y: 0.6,
        z: 24
      }),
      verticalSpeedUnitsPerSecond: 0,
      yawRadians: 0
    }),
    preparedTraversalStep: groundedPreparedStep,
    surfaceColliderSnapshots: Object.freeze([
      Object.freeze({
        ...createSupportCollider(0.6),
        translation: Object.freeze({
          x: 0,
          y: 0.5,
          z: 24
        })
      })
    ]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    waterRegionSnapshots: Object.freeze([])
  });

  assert.equal(groundedOutcome.locomotionMode, "grounded");
  assert.equal(groundedOutcome.grounded, true);
  assert.equal(
    groundedOutcome.automaticSurfaceSnapshot.debug.reason,
    "capability-maintained"
  );
  assert.equal(groundedOutcome.supportHeightMeters, 0.6);
});

test("shared unmounted swim traversal outcome exits onto step-eligible authored support", () => {
  const swimExitOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: null,
    preparedTraversalStep: Object.freeze({
      bodyControl: Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
      locomotionMode: "swim",
      traversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "swim"
      }),
      waterlineHeightMeters: 0
    }),
    surfaceColliderSnapshots: Object.freeze([createSupportCollider(0.2)]),
    surfacePolicyConfig,
    swimBodySnapshot: Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      yawRadians: 0
    }),
    waterRegionSnapshots
  });

  assert.equal(swimExitOutcome.locomotionMode, "grounded");
  assert.equal(swimExitOutcome.grounded, true);
  assert.equal(swimExitOutcome.supportHeightMeters, 0.2);
  assert.equal(swimExitOutcome.waterlineHeightMeters, 0);
  assert.equal(
    swimExitOutcome.automaticSurfaceSnapshot.debug.reason,
    "capability-transition-validated"
  );
});

test("shared unmounted swim traversal outcome reports a blocked capability transition when partial authored support is not yet enough to exit", () => {
  const blockedSwimOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: null,
    preparedTraversalStep: Object.freeze({
      bodyControl: Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        turnAxis: 0
      }),
      locomotionMode: "swim",
      traversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "swim"
      }),
      waterlineHeightMeters: 0
    }),
    surfaceColliderSnapshots: Object.freeze([createNarrowSupportCollider(0.2)]),
    surfacePolicyConfig,
    swimBodySnapshot: Object.freeze({
      position: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      yawRadians: 0
    }),
    waterRegionSnapshots
  });

  assert.equal(blockedSwimOutcome.locomotionMode, "swim");
  assert.equal(blockedSwimOutcome.grounded, false);
  assert.equal(
    blockedSwimOutcome.automaticSurfaceSnapshot.debug.reason,
    "capability-transition-blocked"
  );
  assert.equal(
    blockedSwimOutcome.automaticSurfaceSnapshot.debug
      .supportingAffordanceSampleCount,
    1
  );
});

test("shared unmounted grounded traversal outcome enters swim once airborne travel drops below the waterline even if shoreline probes can see future support", () => {
  const airborneWaterEntryOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      jumpReady: false,
      position: Object.freeze({
        x: 0,
        y: 0.04,
        z: -0.9
      }),
      verticalSpeedUnitsPerSecond: -1,
      yawRadians: 0
    }),
    preparedTraversalStep: Object.freeze({
      autostepHeightMeters: null,
      bodyIntent: Object.freeze({
        boost: false,
        jump: false,
        jumpReadyOverride: false,
        moveAxis: 0,
        snapToGroundOverrideEnabled: false,
        strafeAxis: 0,
        turnAxis: 0
      }),
      groundedJumpSupported: false,
      jumpRequested: false,
      locomotionMode: "grounded",
      surfaceJumpSupported: false,
      traversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "grounded"
      })
    }),
    surfaceColliderSnapshots: Object.freeze([
      Object.freeze({
        ...createSupportCollider(0.2),
        translation: Object.freeze({
          x: 0,
          y: 0.1,
          z: 0.8
        })
      })
    ]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    waterRegionSnapshots
  });

  assert.equal(airborneWaterEntryOutcome.locomotionMode, "swim");
  assert.equal(airborneWaterEntryOutcome.grounded, false);
});

test("shared unmounted grounded traversal prep suppresses snap-to-ground while entering water", () => {
  const step = prepareMetaverseUnmountedTraversalStep({
    bodyControl: Object.freeze({
      boost: false,
      moveAxis: 1,
      strafeAxis: 0,
      turnAxis: 0
    }),
    deltaSeconds: 1 / 30,
    groundedBodyConfig,
    groundedBodySnapshot: createGroundedBodySnapshot({
      grounded: false,
      jumpReady: false,
      position: Object.freeze({
        x: 0,
        y: 0.18,
        z: 0
      }),
      verticalSpeedUnitsPerSecond: -1,
      yawRadians: 0
    }),
    jumpSupportVerticalSpeedTolerance: 0.5,
    preferredLookYawRadians: null,
    surfaceColliderSnapshots: Object.freeze([]),
    surfacePolicyConfig,
    swimBodySnapshot: null,
    traversalState: Object.freeze({
      actionState: createMetaverseTraversalActionStateSnapshot(),
      locomotionMode: "grounded"
    }),
    waterRegionSnapshots
  });

  assert.equal(step.locomotionMode, "grounded");
  assert.equal(step.bodyIntent.snapToGroundOverrideEnabled, false);
});
