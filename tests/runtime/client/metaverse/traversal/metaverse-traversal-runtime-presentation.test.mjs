import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createFlatGroundSurfaceColliderSnapshot,
  createTraversalFixtureContext,
  freezeVector3,
  groundedFixedStepSeconds
} from "./fixtures/traversal-test-fixtures.mjs";

let fixtureContext;

const forwardTravelInput = Object.freeze({
  boost: false,
  jump: false,
  moveAxis: 1,
  pitchAxis: 0,
  primaryAction: false,
  secondaryAction: false,
  strafeAxis: 0,
  yawAxis: 0
});

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

test("MetaverseTraversalRuntime routes jump presentation through up, mid, and down animation phases", async () => {
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
    assert.ok(
      observedVocabularies.has("jump-mid") ||
        observedVocabularies.has("jump-down")
    );
    assert.equal(groundedBodyRuntime.snapshot.grounded, true);
    assert.equal(
      traversalRuntime.characterPresentationSnapshot?.animationVocabulary,
      "idle"
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
