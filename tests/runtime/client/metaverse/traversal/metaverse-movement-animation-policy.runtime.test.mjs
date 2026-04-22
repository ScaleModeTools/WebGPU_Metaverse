import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseMovementAnimationPolicyRuntime keeps jump loop airborne and only lands on contact", async () => {
  const { MetaverseMovementAnimationPolicyRuntime } = await clientLoader.load(
    "/src/metaverse/traversal/presentation/metaverse-movement-animation-policy.ts"
  );
  const runtime = new MetaverseMovementAnimationPolicyRuntime({
    grounded: {
      enterSpeedUnitsPerSecond: 0.52,
      exitSpeedUnitsPerSecond: 0.2,
      holdMs: 90,
      intentEnterThreshold: 0.12,
      minimumAppliedSpeedUnitsPerSecond: 0.05
    },
    jump: {
      landingHoldMs: 120,
      startupHoldMs: 40
    },
    swim: {
      enterSpeedUnitsPerSecond: 0.4,
      exitSpeedUnitsPerSecond: 0.18,
      holdMs: 180,
      intentEnterThreshold: 0.12,
      minimumAppliedSpeedUnitsPerSecond: 0.05
    }
  });
  const groundedInput = Object.freeze({
    grounded: true,
    inputMagnitude: 0,
    locomotionMode: "grounded",
    moveAxis: 0,
    planarSpeedUnitsPerSecond: 0,
    strafeAxis: 0,
    traversalActionKind: "none",
    traversalActionPhase: "idle",
    verticalSpeedUnitsPerSecond: 0
  });
  const startupInput = Object.freeze({
    ...groundedInput,
    traversalActionKind: "jump",
    traversalActionPhase: "startup"
  });
  const risingInput = Object.freeze({
    ...groundedInput,
    grounded: false,
    traversalActionKind: "jump",
    traversalActionPhase: "rising",
    verticalSpeedUnitsPerSecond: 3.2
  });
  const fallingInput = Object.freeze({
    ...risingInput,
    traversalActionPhase: "falling",
    verticalSpeedUnitsPerSecond: -2.4
  });

  assert.equal(runtime.advance(startupInput, 1 / 60), "jump-up");
  assert.equal(runtime.advance(risingInput, 0.02), "jump-up");
  assert.equal(runtime.advance(risingInput, 0.03), "jump-mid");
  assert.equal(runtime.advance(fallingInput, 0.05), "jump-mid");
  assert.equal(runtime.advance(groundedInput, 1 / 60), "jump-down");
  assert.equal(runtime.advance(groundedInput, 0.05), "jump-down");
  assert.equal(runtime.advance(groundedInput, 0.08), "idle");
});
