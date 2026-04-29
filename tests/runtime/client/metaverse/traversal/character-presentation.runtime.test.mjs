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

function createAnimationActionStub(duration = 1.2) {
  return {
    enabled: false,
    lastCrossFadeFrom: null,
    lastEffectiveTimeScale: null,
    lastEffectiveWeight: null,
    time: -1,
    zeroSlopeAtEnd: false,
    zeroSlopeAtStart: false,
    crossFadeFrom(previousAction, fadeSeconds, warp) {
      this.lastCrossFadeFrom = {
        fadeSeconds,
        previousAction,
        warp
      };
      return this;
    },
    getClip() {
      return { duration };
    },
    play() {
      this.played = true;
      return this;
    },
    reset() {
      this.wasReset = true;
      this.time = 0;
      return this;
    },
    setEffectiveTimeScale(value) {
      this.lastEffectiveTimeScale = value;
      return this;
    },
    setEffectiveWeight(value) {
      this.lastEffectiveWeight = value;
      return this;
    }
  };
}

test("default grounded traversal tuning keeps walk and boost presentation aligned with shell speed", async () => {
  const [{ metaverseRuntimeConfig }, { resolveCharacterAnimationPlaybackRateMultiplier }] =
    await Promise.all([
      clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
      clientLoader.load(
        "/src/metaverse/traversal/presentation/character-presentation.ts"
      )
  ]);

  assert.equal(metaverseRuntimeConfig.groundedBody.baseSpeedUnitsPerSecond, 6);
  assert.equal(metaverseRuntimeConfig.groundedBody.jumpImpulseUnitsPerSecond, 6.8);
  assert.equal(metaverseRuntimeConfig.groundedBody.boostMultiplier, 1.25);
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: false,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded",
      moveAxis: 1
    }),
    1.5
  );
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: true,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded",
      moveAxis: 1
    }),
    1.875
  );
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: false,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded",
      moveAxis: -1
    }),
    -1.5
  );
  assert.equal(
    resolveCharacterAnimationPlaybackRateMultiplier({
      animationVocabulary: "walk",
      boost: true,
      config: metaverseRuntimeConfig,
      locomotionMode: "grounded",
      moveAxis: -1
    }),
    -1.875
  );
});

test("walk animation restart preserves negative playback for backward movement", async () => {
  const [{ syncCharacterAnimation }] = await Promise.all([
    clientLoader.load("/src/metaverse/render/characters/metaverse-scene-character-animation.ts")
  ]);
  const idleAction = createAnimationActionStub();
  const walkAction = createAnimationActionStub(2.4);
  const characterRuntime = {
    activeAnimationActionSetId: "full-body",
    activeAnimationCycleId: 0,
    activeAnimationVocabulary: "idle",
    actionsByVocabulary: new Map([
      ["idle", idleAction],
      ["walk", walkAction]
    ]),
    anchorGroup: {},
    skeletonId: "humanoid_v2"
  };

  syncCharacterAnimation(characterRuntime, "walk", 1, -1.5);

  assert.equal(walkAction.lastEffectiveTimeScale, -1.6500000000000001);
  assert.equal(walkAction.time, 2.4);
  assert.equal(walkAction.played, true);
});
