import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { readMetaverseTraversalAuthorityLatestActionSequence } from "@webgpu-metaverse/shared/metaverse/traversal";

import {
  createFlatGroundSurfaceColliderSnapshot,
  createTraversalFixtureContext,
  freezeVector3,
  groundedFixedStepSeconds,
  syncAuthoritativeLocalPlayerPose
} from "./fixtures/traversal-test-fixtures.mjs";

const localPlayerRoutineLandingCorrectionThresholdMeters = 0.08;

const idleInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 0,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

const jumpInput = Object.freeze({
  ...idleInput,
  jump: true
});

let fixtureContext;

function createTraversalIntentSnapshot(input) {
  const {
    boost = false,
    inputSequence = 0,
    jump = false,
    jumpActionSequence = 0,
    locomotionMode = "grounded",
    moveAxis = 0,
    strafeAxis = 0,
    yawAxis = 0
  } = input;
  const resolvedActionSequence =
    jump === true || jumpActionSequence > 0 ? jumpActionSequence : 0;

  return Object.freeze({
    actionIntent: Object.freeze({
      kind: resolvedActionSequence > 0 ? "jump" : "none",
      pressed: jump === true,
      sequence: resolvedActionSequence
    }),
    bodyControl: Object.freeze({
      boost,
      moveAxis,
      strafeAxis,
      turnAxis: yawAxis
    }),
    inputSequence,
    locomotionMode
  });
}

async function createFlatGroundedTraversalHarness() {
  return fixtureContext.createTraversalHarness({
    surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
  });
}

function syncLocalAirborneBodyState(
  groundedBodyRuntime,
  position,
  linearVelocity = freezeVector3(0, 0, 0)
) {
  groundedBodyRuntime.syncAuthoritativeState({
    grounded: false,
    linearVelocity,
    position,
    yawRadians: groundedBodyRuntime.snapshot.yawRadians
  });
}

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime reports local traversal startup once a buffered jump edge is stamped with a shared action sequence", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds * 0.5);

    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      createTraversalIntentSnapshot({
        boost: false,
        inputSequence: 1,
        jump: true,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      })
    );

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "startup"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionSequence,
      1
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime advances local traversal authority from rising back to idle after a stamped jump arc lands", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);

    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      createTraversalIntentSnapshot({
        boost: false,
        inputSequence: 1,
        jump: true,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      })
    );

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "rising"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence,
      1
    );

    let stepCount = 0;

    while (groundedBodyRuntime.snapshot.grounded !== true && stepCount < 60) {
      traversalRuntime.advance(idleInput, groundedFixedStepSeconds);
      traversalRuntime.syncIssuedTraversalIntentSnapshot(
        createTraversalIntentSnapshot({
          boost: false,
          inputSequence: 1,
          jump: false,
          jumpActionSequence: 1,
          locomotionMode: "grounded",
          moveAxis: 0,
          strafeAxis: 0,
          yawAxis: 0
        })
      );
      stepCount += 1;
    }

    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "none"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "idle"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence,
      1
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves the latest predicted jump sequence after release while the local jump is still airborne", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      createTraversalIntentSnapshot({
        boost: false,
        inputSequence: 1,
        jump: true,
        jumpActionSequence: 1,
        locomotionMode: "grounded",
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      })
    );

    assert.equal(
      readMetaverseTraversalAuthorityLatestActionSequence(
        traversalRuntime.localTraversalAuthoritySnapshot,
        "jump"
      ),
      1
    );

    traversalRuntime.advance(idleInput, groundedFixedStepSeconds * 0.5);
    traversalRuntime.syncIssuedTraversalIntentSnapshot(
      Object.freeze({
        actionIntent: Object.freeze({
          kind: "none",
          pressed: false,
          sequence: 0
        }),
        bodyControl: Object.freeze({
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        }),
        inputSequence: 1,
        locomotionMode: "grounded"
      })
    );

    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.equal(
      readMetaverseTraversalAuthorityLatestActionSequence(
        traversalRuntime.localTraversalAuthoritySnapshot,
        "jump"
      ),
      1
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine authoritative airborne pose changes while local movement stays grounded", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "rising",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0.6,
        y: 3.4,
        z: -0.8
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: Object.freeze({
        x: 0.2,
        y: 1.2,
        z: 23.4
      }),
      yawRadians: Math.PI * 0.14
    });

    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y
      ) < 0.0001
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
    assert.ok(
      Math.abs(
        (traversalRuntime.characterPresentationSnapshot?.position.y ?? 0) -
          groundedSnapshot.position.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves a local grounded jump ascent against routine authoritative grounded corrections", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);

    const localJumpSnapshot = groundedBodyRuntime.snapshot;

    assert.equal(localJumpSnapshot.grounded, false);
    assert.ok(localJumpSnapshot.position.y > groundedSnapshot.position.y);
    assert.ok(localJumpSnapshot.verticalSpeedUnitsPerSecond > 0);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 0,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      groundedBodyRuntime.snapshot.position.y >= localJumpSnapshot.position.y
    );
    assert.ok(groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "jump-up"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps a local jump ascent when the issued jump edge is routine-rejected", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    const localJumpSnapshot = groundedBodyRuntime.snapshot;

    assert.equal(localJumpSnapshot.grounded, false);
    assert.ok(localJumpSnapshot.position.y > groundedSnapshot.position.y);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        traversalAuthority: Object.freeze({
          currentActionKind: "none",
          currentActionPhase: "idle",
          currentActionSequence: 0,
          lastConsumedActionKind: "none",
          lastConsumedActionSequence: 0,
          lastRejectedActionKind: "jump",
          lastRejectedActionReason: "buffer-expired",
          lastRejectedActionSequence: 1,
          phaseStartedAtTick: 2
        }),
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.lastLocalAuthorityPoseCorrectionReason, "none");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      groundedBodyRuntime.snapshot.position.y >= localJumpSnapshot.position.y
    );
    assert.ok(
      groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "jump-up"
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime buffers a grounded jump tap in shared local traversal authority until the body becomes jump-ready", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    groundedBodyRuntime.teleport(
      freezeVector3(0, 0.35, 24),
      groundedBodyRuntime.snapshot.yawRadians
    );
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionKind,
      "jump"
    );
    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionPhase,
      "startup"
    );
    assert.ok(
      traversalRuntime.localTraversalAuthoritySnapshot.currentActionSequence > 0
    );
    assert.ok(groundedBodyRuntime.snapshot.position.y <= 0.35);

    for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
      traversalRuntime.advance(idleInput, groundedFixedStepSeconds);

      if (
        groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.35
      ) {
        break;
      }
    }

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionKind,
      "jump"
    );
    assert.ok(
      groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.35
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime consumes a grounded jump from snap-distance support through shared local traversal authority", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    groundedBodyRuntime.teleport(
      freezeVector3(0, 0.12, 24),
      groundedBodyRuntime.snapshot.yawRadians
    );

    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);

    assert.equal(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionKind,
      "jump"
    );
    assert.ok(
      traversalRuntime.localTraversalAuthoritySnapshot.lastConsumedActionSequence > 0
    );
    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      if (
        groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.12
      ) {
        break;
      }

      traversalRuntime.advance(idleInput, groundedFixedStepSeconds);
    }

    assert.ok(
      groundedBodyRuntime.snapshot.verticalSpeedUnitsPerSecond > 0 ||
        groundedBodyRuntime.snapshot.position.y > 0.12
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores a rejected jump once local grounded state is already aligned", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: 0,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine authoritative airborne jump phase changes", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneRoutineErrorPosition = freezeVector3(
      groundedSnapshot.position.x,
      groundedSnapshot.position.y +
        localPlayerRoutineLandingCorrectionThresholdMeters * 0.5,
      groundedSnapshot.position.z
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneRoutineErrorPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.lastLocalAuthorityPoseCorrectionReason, "none");
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y
      ) < 0.0001
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores pure authoritative ground-state flicker when the local pose is aligned", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const authoritativeAirbornePose = {
      jumpAuthorityState: "falling",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: Object.freeze({
        x: 0,
        y: 0,
        z: 0
      }),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    };

    syncAuthoritativeLocalPlayerPose(traversalRuntime, authoritativeAirbornePose);

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y
      ) < 0.0001
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps an accepted local jump arc through later zero-distance grounded flicker", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      groundedSnapshot.position,
      freezeVector3(0, 0.2, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      groundedSnapshot.position,
      freezeVector3(0, 0, 0)
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.position.y - groundedSnapshot.position.y) <
        0.0001
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores routine accepted-jump landing mismatch before the local body settles", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneRoutineLandingPosition = freezeVector3(
      groundedSnapshot.position.x,
      groundedSnapshot.position.y +
        localPlayerRoutineLandingCorrectionThresholdMeters * 0.5,
      groundedSnapshot.position.z
    );
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneRoutineLandingPosition,
      freezeVector3(0, -0.2, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0,
          y: -0.2,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneRoutineLandingPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(traversalRuntime.lastLocalAuthorityPoseCorrectionReason, "none");
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneRoutineLandingPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves an accepted jump landing arc against moderate authoritative grounded recovery", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.18,
      groundedSnapshot.position.y + 0.55,
      groundedSnapshot.position.z
    );
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneLandingCarryPosition,
      freezeVector3(0.2, -0.5, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.2,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime resolves accepted jump landing state from traversal authority when legacy jump fields lag", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.18,
      groundedSnapshot.position.y + 0.55,
      groundedSnapshot.position.z
    );
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneLandingCarryPosition,
      freezeVector3(0.2, -0.5, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 0,
        linearVelocity: Object.freeze({
          x: 0.2,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        traversalAuthority: Object.freeze({
          currentActionKind: "jump",
          currentActionPhase: "falling",
          currentActionSequence: 1,
          lastConsumedActionKind: "jump",
          lastConsumedActionSequence: 1,
          lastRejectedActionKind: "none",
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 2
        }),
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "grounded",
        lastAcceptedJumpActionSequence: 0,
        lastProcessedJumpActionSequence: 0,
        linearVelocity: freezeVector3(0, 0, 0),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: groundedSnapshot.position,
        traversalAuthority: Object.freeze({
          currentActionKind: "none",
          currentActionPhase: "idle",
          currentActionSequence: 0,
          lastConsumedActionKind: "jump",
          lastConsumedActionSequence: 1,
          lastRejectedActionKind: "none",
          lastRejectedActionReason: "none",
          lastRejectedActionSequence: 0,
          phaseStartedAtTick: 3
        }),
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime keeps accepted jump landing hold active until the local body actually regrounds", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 0.15,
      groundedSnapshot.position.y + 0.47,
      groundedSnapshot.position.z
    );
    const acceptedGroundedAuthoritySnapshot = {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 1,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: groundedSnapshot.position,
      yawRadians: groundedSnapshot.yawRadians
    };
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneLandingCarryPosition,
      freezeVector3(0.15, -0.5, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.15,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);

    traversalRuntime.advance(idleInput, 0.25);

    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneLandingCarryPosition,
      freezeVector3(0, 0, 0)
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime preserves an accepted moving jump landing arc above the routine correction window", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;
    const airborneLandingCarryPosition = freezeVector3(
      groundedSnapshot.position.x + 1.27,
      groundedSnapshot.position.y + 0.47,
      groundedSnapshot.position.z
    );
    const acceptedGroundedAuthoritySnapshot = {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 1,
      lastProcessedJumpActionSequence: 1,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 0.18,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    };
    traversalRuntime.advance(jumpInput, groundedFixedStepSeconds);
    syncLocalAirborneBodyState(
      groundedBodyRuntime,
      airborneLandingCarryPosition,
      freezeVector3(0.4, -0.5, 0)
    );

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      {
        jumpAuthorityState: "falling",
        lastAcceptedJumpActionSequence: 1,
        lastProcessedJumpActionSequence: 1,
        linearVelocity: Object.freeze({
          x: 0.4,
          y: -0.5,
          z: 0
        }),
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: airborneLandingCarryPosition,
        yawRadians: groundedSnapshot.yawRadians
      },
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);

    syncAuthoritativeLocalPlayerPose(
      traversalRuntime,
      acceptedGroundedAuthoritySnapshot,
      1
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - airborneLandingCarryPosition.x
      ) < 0.0001
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.y - airborneLandingCarryPosition.y
      ) < 0.0001
    );

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(groundedBodyRuntime.snapshot.grounded, false);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime reports gross divergence as the last local-authority pose snap reason", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 4.1,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    });

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 1);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "gross-position-divergence"
    );
    assert.ok(Math.abs(groundedBodyRuntime.snapshot.position.x - 4.1) < 0.0001);
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores moderate grounded authoritative divergence without counting a pose snap", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await createFlatGroundedTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "grounded");

    const groundedSnapshot = groundedBodyRuntime.snapshot;

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "grounded",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, 0),
      locomotionMode: "grounded",
      mountedOccupancy: null,
      position: freezeVector3(
        groundedSnapshot.position.x + 1.8,
        groundedSnapshot.position.y,
        groundedSnapshot.position.z
      ),
      yawRadians: groundedSnapshot.yawRadians
    });

    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.ok(
      Math.abs(
        groundedBodyRuntime.snapshot.position.x - groundedSnapshot.position.x
      ) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores moderate swim authoritative divergence without counting a pose snap", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness();

  try {
    traversalRuntime.boot();
    assert.equal(traversalRuntime.locomotionMode, "swim");

    const swimSnapshot = traversalRuntime.localTraversalPoseSnapshot;

    assert.notEqual(swimSnapshot, null);
    assert.equal(swimSnapshot.locomotionMode, "swim");

    syncAuthoritativeLocalPlayerPose(traversalRuntime, {
      jumpAuthorityState: "none",
      lastAcceptedJumpActionSequence: 0,
      lastProcessedJumpActionSequence: 0,
      linearVelocity: freezeVector3(0, 0, -2.2),
      locomotionMode: "swim",
      mountedOccupancy: null,
      position: freezeVector3(
        swimSnapshot.position.x + 1.8,
        swimSnapshot.position.y,
        swimSnapshot.position.z
      ),
      yawRadians: swimSnapshot.yawRadians
    });

    const blendedSwimSnapshot = traversalRuntime.localTraversalPoseSnapshot;

    assert.notEqual(blendedSwimSnapshot, null);
    assert.equal(traversalRuntime.localReconciliationCorrectionCount, 0);
    assert.equal(
      traversalRuntime.lastLocalAuthorityPoseCorrectionReason,
      "none"
    );
    assert.ok(
      Math.abs(blendedSwimSnapshot.position.x - swimSnapshot.position.x) < 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});
