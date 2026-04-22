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

test("AuthoritativeServerClock advances locally between fresh server-time observations and ignores duplicate samples", async () => {
  const { AuthoritativeServerClock } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const clock = new AuthoritativeServerClock({
    clockOffsetCorrectionAlpha: 0.5,
    clockOffsetMaxStepMs: 10
  });

  clock.observeServerTime(1_000, 900);

  assert.equal(clock.clockOffsetEstimateMs, 100);
  assert.equal(clock.readEstimatedServerTimeMs(910), 1_010);

  clock.observeServerTime(1_000, 920);

  assert.equal(clock.readEstimatedServerTimeMs(920), 1_020);

  clock.observeServerTime(1_050, 940);

  assert.equal(clock.clockOffsetEstimateMs, 105);
  assert.equal(clock.readEstimatedServerTimeMs(940), 1_045);
  assert.equal(clock.readTargetServerTimeMs(950, 25), 1_030);
});

test("AuthoritativeServerClock resets its offset state explicitly", async () => {
  const { AuthoritativeServerClock } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const clock = new AuthoritativeServerClock({
    clockOffsetCorrectionAlpha: 1,
    clockOffsetMaxStepMs: 1_000
  });

  clock.observeServerTime(5_000, 4_900);
  assert.equal(clock.readEstimatedServerTimeMs(4_920), 5_020);

  clock.reset();

  assert.equal(clock.clockOffsetEstimateMs, null);
  assert.equal(clock.readEstimatedServerTimeMs(4_920), 4_920);
});

test("AuthoritativeServerClock preserves the best observed offset instead of drifting backward on delayed samples", async () => {
  const { AuthoritativeServerClock } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const clock = new AuthoritativeServerClock({
    clockOffsetCorrectionAlpha: 1,
    clockOffsetMaxStepMs: 1_000
  });

  clock.observeServerTime(1_000, 900);
  assert.equal(clock.clockOffsetEstimateMs, 100);

  clock.observeServerTime(1_050, 970);
  assert.equal(clock.clockOffsetEstimateMs, 100);
  assert.equal(clock.readEstimatedServerTimeMs(970), 1_070);

  clock.observeServerTime(1_100, 995);
  assert.equal(clock.clockOffsetEstimateMs, 105);
  assert.equal(clock.readEstimatedServerTimeMs(995), 1_100);
});
