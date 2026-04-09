import assert from "node:assert/strict";
import test from "node:test";

import { MetaverseSessionRuntime } from "../../../server/dist/metaverse/classes/metaverse-session-runtime.js";
import { MetaverseSessionHttpAdapter } from "../../../server/dist/metaverse/adapters/metaverse-session-http-adapter.js";

function createResponseCapture() {
  let body = "";
  let statusCode = null;

  return {
    end(chunk = "") {
      body = String(chunk);
    },
    get json() {
      return body.length === 0 ? null : JSON.parse(body);
    },
    get statusCode() {
      return statusCode;
    },
    setHeader() {},
    writeHead(nextStatusCode) {
      statusCode = nextStatusCode;
    }
  };
}

test("MetaverseSessionHttpAdapter handles the metaverse session route", () => {
  const adapter = new MetaverseSessionHttpAdapter(new MetaverseSessionRuntime());
  const response = createResponseCapture();
  const handled = adapter.handleRequest(
    { method: "GET" },
    response,
    new URL("http://127.0.0.1:3210/metaverse/session")
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json.availableExperienceIds, ["duck-hunt"]);
});

test("MetaverseSessionHttpAdapter ignores unrelated routes", () => {
  const adapter = new MetaverseSessionHttpAdapter(new MetaverseSessionRuntime());
  const response = createResponseCapture();
  const handled = adapter.handleRequest(
    { method: "GET" },
    response,
    new URL("http://127.0.0.1:3210/experiences/duck-hunt/coop/rooms")
  );

  assert.equal(handled, false);
  assert.equal(response.statusCode, null);
  assert.equal(response.json, null);
});
