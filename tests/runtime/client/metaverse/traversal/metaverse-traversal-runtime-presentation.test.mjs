import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createFlatGroundSurfaceColliderSnapshot,
  createTraversalFixtureContext,
  forwardTravelInput,
  freezeVector3,
  groundedFixedStepSeconds
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

before(async () => {
  fixtureContext = await createTraversalFixtureContext();
});

after(async () => {
  await fixtureContext?.dispose();
});

test("MetaverseTraversalRuntime keeps swim character presentation partially submerged for idle and moving swim", async () => {
  const { config, groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness();

  try {
    traversalRuntime.boot();

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "swim-idle"
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.position.y,
      config.ocean.height -
        config.bodyPresentation.swimIdleBodySubmersionDepthMeters
    );

    for (let frame = 0; frame < 20; frame += 1) {
      traversalRuntime.advance(forwardTravelInput, 1 / 60);
    }

    assert.equal(traversalRuntime.locomotionMode, "swim");
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "swim"
    );
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.position.y,
      config.ocean.height -
        config.bodyPresentation.swimMovingBodySubmersionDepthMeters
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime routes jump presentation through up and mid phases before grounded recovery", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();

    const observedVocabularies = new Set();

    for (let frame = 0; frame < 180; frame += 1) {
      traversalRuntime.advance(
        Object.freeze({
          boost: false,
          jump: frame === 0,
          moveAxis: 0,
          pitchAxis: 0,
          primaryAction: false,
          secondaryAction: false,
          strafeAxis: 0,
          yawAxis: 0
        }),
        1 / 60
      );

      const animationVocabulary =
        traversalRuntime.characterPresentationSnapshot?.animationVocabulary;

      if (animationVocabulary !== undefined) {
        observedVocabularies.add(animationVocabulary);
      }
    }

    assert.ok(observedVocabularies.has("jump-up"));
    assert.ok(observedVocabularies.has("jump-mid"));
    assert.ok(!observedVocabularies.has("jump-down"));
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime restarts the grounded walk presentation cycle on quick strafe direction flips", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();

    const strafeLeftInput = Object.freeze({
      boost: false,
      jump: false,
      moveAxis: 0,
      pitchAxis: 0,
      primaryAction: false,
      secondaryAction: false,
      strafeAxis: -1,
      yawAxis: 0
    });
    const idleInput = Object.freeze({
      ...strafeLeftInput,
      strafeAxis: 0
    });
    const strafeRightInput = Object.freeze({
      ...strafeLeftInput,
      strafeAxis: 1
    });

    traversalRuntime.advance(strafeLeftInput, groundedFixedStepSeconds);

    const leftBurstPresentation = traversalRuntime.characterPresentationSnapshot;

    assert.equal(leftBurstPresentation?.animationVocabulary, "walk");
    assert.equal(typeof leftBurstPresentation?.animationCycleId, "number");

    traversalRuntime.advance(idleInput, groundedFixedStepSeconds * 0.5);
    traversalRuntime.advance(strafeRightInput, groundedFixedStepSeconds);

    const rightBurstPresentation = traversalRuntime.characterPresentationSnapshot;

    assert.equal(rightBurstPresentation?.animationVocabulary, "walk");
    assert.ok(
      (rightBurstPresentation?.animationCycleId ?? 0) >
        (leftBurstPresentation?.animationCycleId ?? 0)
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects grounded character presentation between authoritative fixed steps", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();
    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds);

    const rawGroundedPosition = groundedBodyRuntime.snapshot.position;
    const groundedCharacterPosition =
      traversalRuntime.characterPresentationSnapshot?.position;

    assert.notEqual(groundedCharacterPosition, null);

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds * 0.5);

    assert.equal(groundedBodyRuntime.snapshot.position.z, rawGroundedPosition.z);
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        groundedCharacterPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        groundedBodyRuntime.snapshot.position.z - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects grounded jump descent ballistically between authoritative fixed steps", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();

    const airbornePosition = freezeVector3(0, 1.8, 24);
    const downwardVelocity = freezeVector3(0, -4, 0);
    const predictionSeconds = groundedFixedStepSeconds * 0.9;
    const linearProjectedY =
      airbornePosition.y + downwardVelocity.y * predictionSeconds;

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: downwardVelocity,
      position: airbornePosition,
      yawRadians: 0
    });

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 0,
        pitchAxis: 0,
        yawAxis: 0
      }),
      predictionSeconds
    );

    assert.ok(
      Math.abs(groundedBodyRuntime.snapshot.position.y - airbornePosition.y) <
        0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y <
        linearProjectedY - 0.005
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime clamps grounded jump descent presentation to authored support before touchdown", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [createFlatGroundSurfaceColliderSnapshot()]
    });

  try {
    traversalRuntime.boot();

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, -5.7, 0),
      position: freezeVector3(0, 0.65, 24),
      yawRadians: 0
    });

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 0,
        pitchAxis: 0,
        yawAxis: 0
      }),
      groundedFixedStepSeconds * 0.9
    );

    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y >= 0.1 - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime ignores overhead support when clamping grounded presentation beneath the active capsule bottom", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createTraversalHarness({
      surfaceColliderSnapshots: [
        createFlatGroundSurfaceColliderSnapshot(),
        Object.freeze({
          halfExtents: freezeVector3(4, 0.15, 4),
          rotation: Object.freeze({ x: 0, y: 0, z: 0, w: 1 }),
          translation: freezeVector3(0, 1.35, 24),
          traversalAffordance: "support"
        })
      ]
    });

  try {
    traversalRuntime.boot();

    groundedBodyRuntime.syncAuthoritativeState({
      grounded: false,
      linearVelocity: freezeVector3(0, -5.7, 0),
      position: freezeVector3(0, 0.3, 24),
      yawRadians: 0
    });

    traversalRuntime.advance(
      Object.freeze({
        boost: false,
        moveAxis: 0,
        pitchAxis: 0,
        yawAxis: 0
      }),
      groundedFixedStepSeconds * 0.9
    );

    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y >= 0.1 - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.y < 0.5,
      `expected presentation to clamp against reachable floor support, received ${traversalRuntime.characterPresentationSnapshot.position.y}`
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});

test("MetaverseTraversalRuntime projects swim character presentation between authoritative fixed steps", async () => {
  const { groundedBodyRuntime, traversalRuntime } =
    await fixtureContext.createOpenWaterTraversalHarness();

  try {
    traversalRuntime.boot();
    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds);

    const rawSwimPose = traversalRuntime.localTraversalPoseSnapshot;
    const swimCharacterPosition =
      traversalRuntime.characterPresentationSnapshot?.position;

    assert.notEqual(rawSwimPose, null);
    assert.notEqual(swimCharacterPosition, null);

    traversalRuntime.advance(forwardTravelInput, groundedFixedStepSeconds * 0.5);

    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        swimCharacterPosition.z - 0.0001
    );
    assert.ok(
      traversalRuntime.characterPresentationSnapshot.position.z <
        rawSwimPose.position.z - 0.0001
    );
  } finally {
    groundedBodyRuntime.dispose();
  }
});
