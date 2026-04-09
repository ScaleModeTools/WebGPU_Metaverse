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

test("shell audio policy resolves shell and gameplay tracks from navigation state", async () => {
  const { resolveShellBackgroundTrack } = await clientLoader.load(
    "/src/app/states/metaverse-shell-audio-policy.ts"
  );

  assert.equal(resolveShellBackgroundTrack("login"), "shell-attract-loop");
  assert.equal(resolveShellBackgroundTrack("calibration"), "shell-attract-loop");
  assert.equal(resolveShellBackgroundTrack("gameplay"), "birds-arena-loop");
});

test("shell audio policy maps first-weapon gameplay signals to typed audio cues", async () => {
  const { resolveGameplaySignalCue } = await clientLoader.load(
    "/src/app/states/metaverse-shell-audio-policy.ts"
  );

  assert.equal(
    resolveGameplaySignalCue({
      enemyId: "bird-1",
      type: "enemy-hit-confirmed"
    }),
    "enemy-hit"
  );
  assert.equal(
    resolveGameplaySignalCue({
      type: "weapon-fired",
      weaponId: "semiautomatic-pistol"
    }),
    "weapon-pistol-shot"
  );
  assert.equal(
    resolveGameplaySignalCue({
      type: "weapon-reloaded",
      weaponId: "semiautomatic-pistol"
    }),
    "weapon-reload"
  );
});
