import assert from "node:assert/strict";
import test from "node:test";

import {
  captureMetaverseAuthoritativeLastGroundedBodySnapshot,
  createMetaverseAuthoritativeLastGroundedBodySnapshot
} from "../../../../server/src/metaverse/authority/players/metaverse-authoritative-last-grounded-body-snapshot.js";

test("Metaverse authoritative last grounded body snapshot normalizes partial grounded state", () => {
  const snapshot = createMetaverseAuthoritativeLastGroundedBodySnapshot({
    contact: {
      supportingContactDetected: true
    },
    jumpBody: {
      grounded: true,
      jumpReady: true
    },
    positionYMeters: 0.6
  });

  assert.equal(snapshot.contact.supportingContactDetected, true);
  assert.equal(snapshot.contact.blockedPlanarMovement, false);
  assert.equal(snapshot.jumpBody.grounded, true);
  assert.equal(snapshot.jumpBody.jumpReady, true);
  assert.equal(snapshot.driveTarget.targetPlanarSpeedUnitsPerSecond, 0);
  assert.equal(snapshot.positionYMeters, 0.6);
});

test("Metaverse authoritative last grounded body snapshot captures grounded runtime body owners", () => {
  const snapshot = captureMetaverseAuthoritativeLastGroundedBodySnapshot({
    contact: Object.freeze({
      appliedMovementDelta: Object.freeze({
        x: 0.2,
        y: 0,
        z: 0
      }),
      blockedPlanarMovement: true,
      blockedVerticalMovement: false,
      desiredMovementDelta: Object.freeze({
        x: 0.4,
        y: 0,
        z: 0
      }),
      supportingContactDetected: true
    }),
    driveTarget: Object.freeze({
      boost: true,
      moveAxis: 1,
      movementMagnitude: 1,
      strafeAxis: 0,
      targetForwardSpeedUnitsPerSecond: 8,
      targetPlanarSpeedUnitsPerSecond: 8,
      targetStrafeSpeedUnitsPerSecond: 0
    }),
    jumpBody: Object.freeze({
      grounded: true,
      jumpGroundContactGraceSecondsRemaining: 0.1,
      jumpReady: false,
      jumpSnapSuppressionActive: true,
      verticalSpeedUnitsPerSecond: 2.4
    }),
    position: Object.freeze({
      y: 1.25
    })
  });

  assert.equal(snapshot.contact.blockedPlanarMovement, true);
  assert.equal(snapshot.driveTarget.boost, true);
  assert.equal(snapshot.jumpBody.jumpSnapSuppressionActive, true);
  assert.equal(snapshot.positionYMeters, 1.25);
});
