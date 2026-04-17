import assert from "node:assert/strict";
import test from "node:test";

import {
  clearMetaverseUnmountedTraversalPendingActions,
  createMetaverseUnmountedTraversalStateSnapshot,
  createMetaverseTraversalActionStateSnapshot,
  prepareMetaverseUnmountedTraversalStep,
  queueMetaverseUnmountedTraversalAction,
  queueMetaverseTraversalAction,
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
    groundedBodySnapshot: Object.freeze({
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
    groundedBodySnapshot: Object.freeze({
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
    groundedBodySnapshot: Object.freeze({
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
    groundedBodySnapshot: Object.freeze({
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
    groundedBodySnapshot: Object.freeze({
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
  assert.equal(groundedOutcome.automaticSurfaceSnapshot.debug.reason, "grounded-hold");
  assert.equal(groundedOutcome.supportHeightMeters, 0.6);
});

test("shared unmounted swim traversal outcome exits onto step-eligible authored support", () => {
  const swimOutcome = resolveMetaverseUnmountedTraversalStep({
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

  assert.equal(swimOutcome.locomotionMode, "grounded");
  assert.equal(swimOutcome.grounded, true);
  assert.equal(swimOutcome.supportHeightMeters, 0.2);
  assert.equal(swimOutcome.waterlineHeightMeters, 0);
});

test("shared unmounted grounded traversal outcome enters swim once airborne travel drops below the waterline even if shoreline probes can see future support", () => {
  const airborneWaterEntryOutcome = resolveMetaverseUnmountedTraversalStep({
    groundedBodySnapshot: Object.freeze({
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
    groundedBodySnapshot: Object.freeze({
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
