import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("resolveControllerActionMatrix applies global button swaps without dropping utility bindings", async () => {
  const { resolveControllerActionMatrix } = await clientLoader.load(
    "/src/input/index.ts"
  );

  const matrix = resolveControllerActionMatrix({
    globalBindingPresetId: "swap-primary-secondary",
    duckHuntControllerSchemeId: "mouse",
    metaverseControllerSchemeId: "gamepad"
  });

  assert.equal(matrix.globalBindingPreset.id, "swap-primary-secondary");
  assert.equal(matrix.duckHunt.buttonActionByBindingId["mouse-right"], "fire");
  assert.equal(
    matrix.metaverse.buttonActionByBindingId["gamepad-left-trigger"],
    "move-forward"
  );
  assert.equal(
    matrix.metaverse.buttonActionByBindingId["gamepad-right-trigger"],
    "move-backward"
  );
  assert.equal(
    matrix.metaverse.buttonActionByBindingId["gamepad-right-bumper"],
    "boost"
  );
});

test("resolveControllerActionMatrix exposes planned Duck Hunt gamepad aim schemes", async () => {
  const { resolveControllerActionMatrix } = await clientLoader.load(
    "/src/input/index.ts"
  );

  const matrix = resolveControllerActionMatrix({
    globalBindingPresetId: "standard",
    duckHuntControllerSchemeId: "gamepad-right-stick-aim",
    metaverseControllerSchemeId: "keyboard"
  });

  assert.equal(matrix.duckHunt.scheme.status, "planned");
  assert.equal(
    matrix.duckHunt.analogActionByInputId["gamepad-right-stick-aim-2d"],
    "aim-axis"
  );
  assert.equal(
    matrix.duckHunt.buttonActionByBindingId["gamepad-right-trigger"],
    "fire"
  );
  assert.equal(
    matrix.duckHunt.buttonActionByBindingId["gamepad-right-bumper"],
    "reload"
  );
});
