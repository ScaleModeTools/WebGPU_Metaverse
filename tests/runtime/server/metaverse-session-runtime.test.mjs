import assert from "node:assert/strict";
import test from "node:test";

import { MetaverseSessionRuntime } from "../../../server/dist/metaverse/classes/metaverse-session-runtime.js";

test("MetaverseSessionRuntime exposes the shared hub session snapshot", () => {
  const runtime = new MetaverseSessionRuntime();
  const sessionSnapshot = runtime.readSessionSnapshot();

  assert.equal(sessionSnapshot.activeExperienceId, null);
  assert.deepEqual(sessionSnapshot.availableExperienceIds, ["duck-hunt"]);
  assert.equal(sessionSnapshot.selectedSessionMode, null);
  assert.equal(sessionSnapshot.tickOwner, "server");
  assert.ok(Object.isFrozen(sessionSnapshot.availableExperienceIds));
});
