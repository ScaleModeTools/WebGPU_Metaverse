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

test("default grounded traversal tuning keeps walk and boost presentation aligned with shell speed", async () => {
  const [{ metaverseRuntimeConfig }, { resolveCharacterAnimationPlaybackRateMultiplier }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
      clientLoader.load(
        "/src/metaverse/traversal/presentation/character-presentation.ts"
      )
    ]);

  assert.equal(metaverseRuntimeConfig.groundedBody.baseSpeedUnitsPerSecond, 6);
  assert.equal(metaverseRuntimeConfig.groundedBody.jumpImpulseUnitsPerSecond, 7.1);
  assert.equal(metaverseRuntimeConfig.groundedBody.boostMultiplier, 1.25);
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: false,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded"
    }),
    1.5
  );
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: true,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded"
    }),
    1.875
  );
});
