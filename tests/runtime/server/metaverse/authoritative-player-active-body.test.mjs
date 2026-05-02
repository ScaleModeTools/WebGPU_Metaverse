import assert from "node:assert/strict";
import test from "node:test";

import {
  readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot,
  readMetaverseAuthoritativePlayerActiveBodyPositionSnapshot,
  readMetaverseAuthoritativePlayerActiveBodyYawRadians
} from "../../../../server/dist/metaverse/authority/players/metaverse-authoritative-player-active-body.js";

function createVector3(x, y, z) {
  return Object.freeze({ x, y, z });
}

function createBodySnapshot({ linearVelocity, position, yawRadians }) {
  return Object.freeze({
    linearVelocity,
    position,
    yawRadians
  });
}

test("Metaverse authoritative active body reads grounded capsule truth", () => {
  const groundedBodySnapshot = createBodySnapshot({
    linearVelocity: createVector3(1, 0, -2),
    position: createVector3(4, 1.2, -6),
    yawRadians: 0.75
  });
  const playerRuntime = {
    groundedBodyRuntime: {
      snapshot: groundedBodySnapshot
    },
    locomotionMode: "grounded",
    swimBodyRuntime: {
      snapshot: createBodySnapshot({
        linearVelocity: createVector3(99, 99, 99),
        position: createVector3(99, 99, 99),
        yawRadians: 99
      })
    }
  };

  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime),
    groundedBodySnapshot
  );
  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyPositionSnapshot(playerRuntime),
    groundedBodySnapshot.position
  );
  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime),
    groundedBodySnapshot.yawRadians
  );
});

test("Metaverse authoritative active body reads swim body truth while swimming", () => {
  const swimBodySnapshot = createBodySnapshot({
    linearVelocity: createVector3(-1, 0, 3),
    position: createVector3(-2, 0, 8),
    yawRadians: -0.4
  });
  const playerRuntime = {
    groundedBodyRuntime: {
      snapshot: createBodySnapshot({
        linearVelocity: createVector3(0, -8, 0),
        position: createVector3(7, -3, 7),
        yawRadians: 1.1
      })
    },
    locomotionMode: "swim",
    swimBodyRuntime: {
      snapshot: swimBodySnapshot
    }
  };

  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyKinematicSnapshot(playerRuntime),
    swimBodySnapshot
  );
  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyPositionSnapshot(playerRuntime),
    swimBodySnapshot.position
  );
  assert.equal(
    readMetaverseAuthoritativePlayerActiveBodyYawRadians(playerRuntime),
    swimBodySnapshot.yawRadians
  );
});
