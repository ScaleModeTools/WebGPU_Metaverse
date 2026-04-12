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

test("createWebTransportHttpFallbackInvoker retries on HTTP after a WebTransport channel failure and stays there", async () => {
  const [
    { createWebTransportHttpFallbackInvoker },
    { ReliableWebTransportJsonRequestChannelError }
  ] = await Promise.all([
    clientLoader.load("/src/network/adapters/webtransport-http-fallback.ts"),
    clientLoader.load(
      "/src/network/adapters/reliable-webtransport-json-request-channel.ts"
    )
  ]);
  const requests = [];
  const invoker = createWebTransportHttpFallbackInvoker(
    {
      async request(label) {
        requests.push(`primary:${label}`);
        throw new ReliableWebTransportJsonRequestChannelError(
          "WebTransport stream failed."
        );
      }
    },
    {
      async request(label) {
        requests.push(`fallback:${label}`);
        return `${label}:ok`;
      }
    }
  );

  const firstResult = await invoker.invoke((transport) => transport.request("one"));
  const secondResult = await invoker.invoke((transport) => transport.request("two"));

  assert.equal(firstResult, "one:ok");
  assert.equal(secondResult, "two:ok");
  assert.equal(invoker.hasPrimaryTransportSucceeded, false);
  assert.equal(invoker.lastFallbackError, "WebTransport stream failed.");
  assert.equal(invoker.usingFallback, true);
  assert.deepEqual(requests, [
    "primary:one",
    "fallback:one",
    "fallback:two"
  ]);
});

test("createWebTransportHttpFallbackInvoker preserves domain errors without switching transports", async () => {
  const { createWebTransportHttpFallbackInvoker } = await clientLoader.load(
    "/src/network/adapters/webtransport-http-fallback.ts"
  );
  const requests = [];
  const invoker = createWebTransportHttpFallbackInvoker(
    {
      async request(label) {
        requests.push(`primary:${label}`);
        throw new Error("Unknown metaverse player: harbor-pilot-1");
      }
    },
    {
      async request(label) {
        requests.push(`fallback:${label}`);
        return `${label}:ok`;
      }
    }
  );

  await assert.rejects(
    () => invoker.invoke((transport) => transport.request("one")),
    /Unknown metaverse player/
  );

  assert.equal(invoker.hasPrimaryTransportSucceeded, false);
  assert.equal(invoker.lastFallbackError, null);
  assert.equal(invoker.usingFallback, false);
  assert.deepEqual(requests, ["primary:one"]);
});

test("createWebTransportHttpFallbackInvoker records successful primary transport use before any fallback", async () => {
  const { createWebTransportHttpFallbackInvoker } = await clientLoader.load(
    "/src/network/adapters/webtransport-http-fallback.ts"
  );
  const invoker = createWebTransportHttpFallbackInvoker(
    {
      async request(label) {
        return `${label}:primary`;
      }
    },
    {
      async request(label) {
        return `${label}:fallback`;
      }
    }
  );

  const result = await invoker.invoke((transport) => transport.request("one"));

  assert.equal(result, "one:primary");
  assert.equal(invoker.hasPrimaryTransportSucceeded, true);
  assert.equal(invoker.lastFallbackError, null);
  assert.equal(invoker.usingFallback, false);
});
