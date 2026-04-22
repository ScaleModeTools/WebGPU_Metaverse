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

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createFakeWebTransportDatagramSession(maxDatagramSize = undefined) {
  const datagramStream = new TransformStream();
  const clientDatagramReader = datagramStream.readable.getReader();
  let closeCallCount = 0;

  return {
    get closeCallCount() {
      return closeCallCount;
    },
    async readClientDatagram() {
      const { done, value } = await clientDatagramReader.read();

      assert.equal(done, false);
      return JSON.parse(new TextDecoder().decode(value));
    },
    transport: {
      closed: Promise.resolve(),
      close() {
        closeCallCount += 1;
      },
      datagrams: {
        ...(maxDatagramSize === undefined ? {} : { maxDatagramSize }),
        writable: datagramStream.writable
      },
      ready: Promise.resolve()
    }
  };
}

function createBlockingWebTransportDatagramSession() {
  const writtenDatagrams = [];
  let closeCallCount = 0;
  let releaseCurrentWrite = null;

  return {
    get closeCallCount() {
      return closeCallCount;
    },
    get writtenDatagrams() {
      return writtenDatagrams;
    },
    releaseWrite() {
      const release = releaseCurrentWrite;

      releaseCurrentWrite = null;
      release?.();
    },
    transport: {
      closed: Promise.resolve(),
      close() {
        closeCallCount += 1;
      },
      datagrams: {
        writable: new WritableStream({
          write(chunk) {
            writtenDatagrams.push(JSON.parse(new TextDecoder().decode(chunk)));

            return new Promise((resolve) => {
              releaseCurrentWrite = resolve;
            });
          }
        })
      },
      ready: Promise.resolve()
    }
  };
}

test("LatestWinsWebTransportJsonDatagramChannel serializes sequential JSON datagrams over one WebTransport datagram writer", async () => {
  const { LatestWinsWebTransportJsonDatagramChannel } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const fakeSession = createFakeWebTransportDatagramSession();
  const channel = new LatestWinsWebTransportJsonDatagramChannel(
    {
      url: "https://example.test/metaverse-datagrams"
    },
    {
      webTransportFactory() {
        return fakeSession.transport;
      }
    }
  );

  const firstSendPromise = channel.sendDatagram({
    controlSequence: 1,
    type: "world-driver-vehicle-control-datagram"
  });
  assert.deepEqual(await fakeSession.readClientDatagram(), {
    controlSequence: 1,
    type: "world-driver-vehicle-control-datagram"
  });
  await firstSendPromise;

  const secondSendPromise = channel.sendDatagram({
    controlSequence: 2,
    type: "world-driver-vehicle-control-datagram"
  });
  assert.deepEqual(await fakeSession.readClientDatagram(), {
    controlSequence: 2,
    type: "world-driver-vehicle-control-datagram"
  });
  await secondSendPromise;

  channel.dispose();
  await flushAsyncWork();

  assert.ok(fakeSession.closeCallCount >= 1);
});

test("LatestWinsWebTransportJsonDatagramChannel rejects sends after disposal", async () => {
  const { LatestWinsWebTransportJsonDatagramChannel } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const channel = new LatestWinsWebTransportJsonDatagramChannel(
    {
      url: "https://example.test/metaverse-datagrams"
    },
    {
      webTransportFactory() {
        return createFakeWebTransportDatagramSession().transport;
      }
    }
  );

  channel.dispose();

  await assert.rejects(
    () =>
      channel.sendDatagram({
        type: "after-dispose"
      }),
    /already been disposed/
  );
});

test("LatestWinsWebTransportJsonDatagramChannel coalesces pending datagrams to the latest payload while a write is blocked", async () => {
  const { LatestWinsWebTransportJsonDatagramChannel } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const fakeSession = createBlockingWebTransportDatagramSession();
  const channel = new LatestWinsWebTransportJsonDatagramChannel(
    {
      url: "https://example.test/metaverse-datagrams"
    },
    {
      webTransportFactory() {
        return fakeSession.transport;
      }
    }
  );

  const firstSendPromise = channel.sendDatagram({
    controlSequence: 1,
    type: "world-driver-vehicle-control-datagram"
  });
  await flushAsyncWork();
  assert.deepEqual(fakeSession.writtenDatagrams, [
    {
      controlSequence: 1,
      type: "world-driver-vehicle-control-datagram"
    }
  ]);

  const secondSendPromise = channel.sendDatagram({
    controlSequence: 2,
    type: "world-driver-vehicle-control-datagram"
  });
  const thirdSendPromise = channel.sendDatagram({
    controlSequence: 3,
    type: "world-driver-vehicle-control-datagram"
  });

  await secondSendPromise;

  fakeSession.releaseWrite();
  await firstSendPromise;
  await flushAsyncWork();

  assert.deepEqual(fakeSession.writtenDatagrams, [
    {
      controlSequence: 1,
      type: "world-driver-vehicle-control-datagram"
    },
    {
      controlSequence: 3,
      type: "world-driver-vehicle-control-datagram"
    }
  ]);

  fakeSession.releaseWrite();
  await thirdSendPromise;

  channel.dispose();
  await flushAsyncWork();

  assert.ok(fakeSession.closeCallCount >= 1);
});

test("LatestWinsWebTransportJsonDatagramChannel rejects datagrams that exceed the transport payload budget", async () => {
  const { LatestWinsWebTransportJsonDatagramChannel } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const fakeSession = createFakeWebTransportDatagramSession(64);
  const channel = new LatestWinsWebTransportJsonDatagramChannel(
    {
      url: "https://example.test/metaverse-datagrams"
    },
    {
      webTransportFactory() {
        return fakeSession.transport;
      }
    }
  );

  await assert.rejects(
    () =>
      channel.sendDatagram({
        payload: "x".repeat(256),
        type: "world-driver-vehicle-control-datagram"
      }),
    /exceeds max datagram size 64 bytes/
  );

  channel.dispose();
  await flushAsyncWork();

  assert.ok(fakeSession.closeCallCount >= 1);
});
