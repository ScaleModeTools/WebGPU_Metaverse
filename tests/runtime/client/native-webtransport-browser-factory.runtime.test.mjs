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

test("createNativeWebTransportBrowserFactory passes SHA-256 certificate hashes to the browser constructor when configured", async () => {
  const { createNativeWebTransportBrowserFactory } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const constructorCalls = [];

  class FakeWebTransport {
    constructor(url, options) {
      constructorCalls.push({
        options,
        url
      });
    }

    close() {}
  }

  const webTransportFactory = createNativeWebTransportBrowserFactory(
    {
      serverCertificateSha256Hex:
        "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
    },
    {
      webTransportConstructor: FakeWebTransport
    }
  );

  webTransportFactory("https://127.0.0.1:3211/metaverse/world");

  assert.equal(constructorCalls.length, 1);
  assert.equal(
    constructorCalls[0]?.url,
    "https://127.0.0.1:3211/metaverse/world"
  );
  assert.deepEqual(
    Array.from(
      constructorCalls[0]?.options?.serverCertificateHashes?.[0]?.value ?? []
    ),
    [
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
      0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
      0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
    ]
  );
});

test("createNativeWebTransportBrowserFactory omits certificate hashes when no hash is configured", async () => {
  const { createNativeWebTransportBrowserFactory } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const constructorCalls = [];

  class FakeWebTransport {
    constructor(url, options) {
      constructorCalls.push({
        options,
        url
      });
    }

    close() {}
  }

  const webTransportFactory = createNativeWebTransportBrowserFactory(
    {},
    {
      webTransportConstructor: FakeWebTransport
    }
  );

  webTransportFactory("https://127.0.0.1:3211/metaverse/presence");

  assert.equal(constructorCalls.length, 1);
  assert.equal(
    constructorCalls[0]?.url,
    "https://127.0.0.1:3211/metaverse/presence"
  );
  assert.equal(constructorCalls[0]?.options, undefined);
});

test("createNativeWebTransportBrowserFactory rejects invalid certificate hashes", async () => {
  const { createNativeWebTransportBrowserFactory } = await clientLoader.load(
    "/src/network/index.ts"
  );

  class FakeWebTransport {
    close() {}
  }

  assert.throws(
    () =>
      createNativeWebTransportBrowserFactory(
        {
          serverCertificateSha256Hex: "invalid"
        },
        {
          webTransportConstructor: FakeWebTransport
        }
      ),
    /64-character hex string/
  );
});
