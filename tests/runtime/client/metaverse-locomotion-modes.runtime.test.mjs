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

test("metaverse locomotion config keeps mounted on the compatibility surface only", async () => {
  const locomotionModes = await clientLoader.load(
    "/src/metaverse/config/metaverse-locomotion-modes.ts"
  );

  assert.equal(locomotionModes.defaultMetaverseLocomotionMode, "grounded");
  assert.deepEqual(
    locomotionModes.metaversePrimaryLocomotionModes.map((mode) => mode.id),
    ["grounded", "swim", "fly"]
  );
  assert.deepEqual(
    locomotionModes.metaverseCompatibilityLocomotionModes.map((mode) => mode.id),
    ["grounded", "swim", "fly", "mounted"]
  );
  assert.equal(
    locomotionModes.resolveMetaversePrimaryLocomotionMode("grounded").label,
    "Grounded"
  );
  assert.equal(
    locomotionModes.resolveMetaverseLocomotionMode("mounted").label,
    "Mounted"
  );
});
