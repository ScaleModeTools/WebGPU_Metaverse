import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocaldevWebTransportClientFailureEnvFileContents,
  LocaldevWebTransportServer,
  createLocaldevWebTransportClientEnvFileContents,
  localdevMetaversePresenceWebTransportPath,
  localdevMetaverseWorldWebTransportPath,
  resolveLocaldevWebTransportServerConfigFromEnvironment,
  verifyLocaldevWebTransportServerHandshake
} from "../../../server/dist/adapters/localdev-webtransport-server.js";

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

function createControlledReadableStream() {
  let controller = null;

  const stream = new ReadableStream({
    start(nextController) {
      controller = nextController;
    }
  });

  return {
    close() {
      controller?.close();
    },
    error(error) {
      controller?.error(error);
    },
    enqueue(value) {
      controller?.enqueue(value);
    },
    stream
  };
}

function createWebTransportSessionCloseError(closeCode) {
  const error = new Error(
    `Session closed (on process 3211) with code ${closeCode} and reason `
  );

  error.name = "WebTransportError";

  return error;
}

function createErroringBidirectionalStream() {
  const incomingFrames = createControlledReadableStream();
  const outgoingFrames = new TransformStream();

  return {
    fail(error) {
      incomingFrames.error(error);
    },
    readable: incomingFrames.stream,
    writable: outgoingFrames.writable
  };
}

function createFakeHttp3Server() {
  const ready = createDeferred();
  let requestCallback = null;
  const sessionStreams = new Map();

  function resolveSessionStream(path) {
    let entry = sessionStreams.get(path);

    if (entry === undefined) {
      entry = createControlledReadableStream();
      sessionStreams.set(path, entry);
    }

    return entry;
  }

  return {
    address() {
      return {
        family: "IPv4",
        host: "127.0.0.1",
        port: 3211
      };
    },
    enqueueSession(path, session) {
      resolveSessionStream(path).enqueue(session);
    },
    invokeRequestCallback(request) {
      if (requestCallback === null) {
        throw new Error("Request callback was not registered.");
      }

      return requestCallback(request);
    },
    ready: ready.promise,
    setRequestCallback(callback) {
      requestCallback = callback;
    },
    sessionStream(path) {
      return resolveSessionStream(path).stream;
    },
    startServer() {
      ready.resolve();
    },
    stopServer() {
      for (const entry of sessionStreams.values()) {
        entry.close();
      }
    }
  };
}

function createFakeWebTransportSession() {
  const closed = createDeferred();
  const incomingBidirectionalStreams = createControlledReadableStream();
  const incomingDatagrams = new TransformStream();
  const incomingDatagramWriter = incomingDatagrams.writable.getWriter();
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  return {
    async close() {
      incomingBidirectionalStreams.close();
      await incomingDatagramWriter.close();
      incomingDatagramWriter.releaseLock();
      closed.resolve();
    },
    closed: closed.promise,
    datagrams: {
      readable: incomingDatagrams.readable
    },
    enqueueIncomingBidirectionalStream(stream) {
      incomingBidirectionalStreams.enqueue(stream);
    },
    incomingBidirectionalStreams: incomingBidirectionalStreams.stream,
    openClientBidirectionalStream() {
      const clientToServer = new TransformStream();
      const serverToClient = new TransformStream();
      const clientWriter = clientToServer.writable.getWriter();
      const clientReader = serverToClient.readable.getReader();

      incomingBidirectionalStreams.enqueue({
        readable: clientToServer.readable,
        writable: serverToClient.writable
      });

      return {
        async close() {
          await clientWriter.close();
          clientWriter.releaseLock();
          clientReader.releaseLock();
        },
        async readJsonFrame() {
          const { done, value } = await clientReader.read();

          assert.equal(done, false);
          return JSON.parse(textDecoder.decode(value).trim());
        },
        async writeJsonFrame(payload) {
          await clientWriter.write(
            textEncoder.encode(`${JSON.stringify(payload)}\n`)
          );
        }
      };
    },
    ready: Promise.resolve(),
    async sendClientDatagram(payload) {
      await incomingDatagramWriter.write(
        textEncoder.encode(JSON.stringify(payload))
      );
    }
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("resolveLocaldevWebTransportServerConfigFromEnvironment resolves enabled localdev WebTransport config from env", () => {
  const resolvedConfig = resolveLocaldevWebTransportServerConfigFromEnvironment(
    {
      WEBGPU_METAVERSE_LOCALDEV_CLIENT_ENV_FILE: "/tmp/client.env",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_FILE: "/tmp/cert.pem",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_SHA256:
        "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CLIENT_HOST: "127.0.0.1",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_ENABLED: "1",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_HOST: "127.0.0.1",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_KEY_FILE: "/tmp/key.pem",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_PORT: "3211",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_SELF_CHECK_HOST: "127.0.0.1",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_SECRET: "localdev-secret"
    },
    (filePath) => {
      if (filePath === "/tmp/cert.pem") {
        return "CERTIFICATE";
      }

      if (filePath === "/tmp/key.pem") {
        return "PRIVATE KEY";
      }

      throw new Error(`Unexpected file path: ${filePath}`);
    }
  );

  assert.notEqual(resolvedConfig, null);
  assert.equal(
    resolvedConfig?.certificateSha256Hex,
    "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
  );
  assert.equal(resolvedConfig?.clientHost, "127.0.0.1");
  assert.equal(resolvedConfig?.clientEnvFilePath, "/tmp/client.env");
  assert.equal(resolvedConfig?.serverConfig.certificatePem, "CERTIFICATE");
  assert.equal(resolvedConfig?.serverConfig.privateKeyPem, "PRIVATE KEY");
  assert.equal(resolvedConfig?.serverConfig.host, "127.0.0.1");
  assert.equal(resolvedConfig?.serverConfig.port, 3211);
  assert.equal(resolvedConfig?.serverConfig.secret, "localdev-secret");
  assert.equal(resolvedConfig?.selfCheckHost, "127.0.0.1");
});

test("resolveLocaldevWebTransportServerConfigFromEnvironment defaults client and self-check hosts when they are omitted", () => {
  const resolvedConfig = resolveLocaldevWebTransportServerConfigFromEnvironment(
    {
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_FILE: "/tmp/cert.pem",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_SHA256:
        "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_ENABLED: "1",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_HOST: "0.0.0.0",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_KEY_FILE: "/tmp/key.pem",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_PORT: "3211",
      WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_SECRET: "localdev-secret"
    },
    (filePath) => {
      if (filePath === "/tmp/cert.pem") {
        return "CERTIFICATE";
      }

      if (filePath === "/tmp/key.pem") {
        return "PRIVATE KEY";
      }

      throw new Error(`Unexpected file path: ${filePath}`);
    }
  );

  assert.notEqual(resolvedConfig, null);
  assert.equal(resolvedConfig?.clientHost, "0.0.0.0");
  assert.equal(resolvedConfig?.selfCheckHost, "127.0.0.1");
});

test("createLocaldevWebTransportClientEnvFileContents writes localdev WebTransport URLs and certificate hashes", () => {
  const clientEnvContents = createLocaldevWebTransportClientEnvFileContents({
    certificateSha256Hex:
      "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    host: "127.0.0.1",
    port: 3211
  });

  assert.match(
    clientEnvContents,
    /VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL=https:\/\/127\.0\.0\.1:3211\/metaverse\/presence/
  );
  assert.match(
    clientEnvContents,
    /VITE_METAVERSE_WORLD_WEBTRANSPORT_SERVER_CERT_SHA256=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff/
  );
});

test("createLocaldevWebTransportClientFailureEnvFileContents writes explicit localdev self-check failure state", () => {
  const clientEnvContents = createLocaldevWebTransportClientFailureEnvFileContents(
    {
      errorMessage:
        "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/world: Opening handshake failed."
    }
  );

  assert.match(
    clientEnvContents,
    /VITE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS=self-check-failed/
  );
  assert.match(
    clientEnvContents,
    /VITE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR=Localdev WebTransport self-check failed for https:\/\/127\.0\.0\.1:3211\/metaverse\/world: Opening handshake failed\./
  );
});

test("verifyLocaldevWebTransportServerHandshake resolves after a successful self-check client connection", async () => {
  const recordedCalls = [];
  const closed = createDeferred();

  await verifyLocaldevWebTransportServerHandshake(
    {
      certificateSha256Hex:
        "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      host: "127.0.0.1",
      port: 3211
    },
    {
      createWebTransportClient(url, options) {
        recordedCalls.push({
          options,
          url
        });

        return {
          closed: closed.promise,
          close() {
            closed.resolve();
          },
          ready: Promise.resolve()
        };
      },
      quicheLoadedPromise: Promise.resolve()
    }
  );

  assert.equal(recordedCalls.length, 1);
  assert.equal(
    recordedCalls[0]?.url,
    "https://127.0.0.1:3211/metaverse/world"
  );
  assert.equal(
    recordedCalls[0]?.options?.serverCertificateHashes?.[0]?.algorithm,
    "sha-256"
  );
  assert.deepEqual(
    Array.from(
      recordedCalls[0]?.options?.serverCertificateHashes?.[0]?.value ?? []
    ),
    Array.from(
      Buffer.from(
        "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        "hex"
      )
    )
  );
});

test("verifyLocaldevWebTransportServerHandshake surfaces self-check failures with the target URL", async () => {
  await assert.rejects(
    verifyLocaldevWebTransportServerHandshake(
      {
        certificateSha256Hex:
          "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        host: "127.0.0.1",
        port: 3211
      },
      {
        createWebTransportClient() {
          return {
            close() {},
            ready: Promise.reject(new Error("Opening handshake failed."))
          };
        },
        quicheLoadedPromise: Promise.resolve()
      }
    ),
    /Localdev WebTransport self-check failed for https:\/\/127\.0\.0\.1:3211\/metaverse\/world: Opening handshake failed\./
  );
});

test("LocaldevWebTransportServer routes reliable frames and datagrams through the configured localdev paths", async () => {
  const fakeHttp3Server = createFakeHttp3Server();
  const recordedPresenceMessages = [];
  const recordedWorldMessages = [];
  const recordedWorldDatagrams = [];
  const localdevServer = new LocaldevWebTransportServer(
    {
      certificatePem: "CERTIFICATE",
      host: "127.0.0.1",
      port: 3211,
      privateKeyPem: "PRIVATE KEY",
      secret: "localdev-secret"
    },
    {
      duckHuntDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      duckHuntReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "duck-hunt-ok",
                type: "coop-room-error"
              };
            }
          };
        }
      },
      metaversePresenceReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage(message) {
              recordedPresenceMessages.push(message);
              return {
                message: "presence-ok",
                type: "presence-error"
              };
            }
          };
        }
      },
      metaverseWorldDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram(datagram) {
              recordedWorldDatagrams.push(datagram);
            }
          };
        }
      },
      metaverseWorldReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage(message) {
              recordedWorldMessages.push(message);
              return {
                message: "world-ok",
                type: "world-error"
              };
            }
          };
        }
      }
    },
    {
      createHttp3Server() {
        return fakeHttp3Server;
      }
    }
  );

  const listeningAddress = await localdevServer.start();

  assert.equal(listeningAddress.host, "127.0.0.1");
  assert.equal(listeningAddress.port, 3211);

  const presenceSession = createFakeWebTransportSession();
  fakeHttp3Server.enqueueSession(
    localdevMetaversePresenceWebTransportPath,
    presenceSession
  );

  const presenceStream = presenceSession.openClientBidirectionalStream();
  await presenceStream.writeJsonFrame({
    observerPlayerId: "observer-player",
    roomId: "metaverse-room-test",
    type: "presence-roster-request"
  });
  assert.deepEqual(await presenceStream.readJsonFrame(), {
    message: "presence-ok",
    type: "presence-error"
  });

  const worldSession = createFakeWebTransportSession();
  fakeHttp3Server.enqueueSession(localdevMetaverseWorldWebTransportPath, worldSession);

  const worldStream = worldSession.openClientBidirectionalStream();
  await worldStream.writeJsonFrame({
    observerPlayerId: "driver-player",
    roomId: "metaverse-room-test",
    type: "world-snapshot-request"
  });
  assert.deepEqual(await worldStream.readJsonFrame(), {
    message: "world-ok",
    type: "world-error"
  });

  await worldSession.sendClientDatagram({
    command: {
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 3,
      playerId: "driver-player"
    },
    roomId: "metaverse-room-test",
    type: "world-driver-vehicle-control-datagram"
  });
  await worldSession.sendClientDatagram({
    command: {
      lookIntent: {
        pitchRadians: 0.35,
        yawRadians: -0.45
      },
      lookSequence: 4,
      playerId: "driver-player",
      type: "sync-player-look-intent"
    },
    roomId: "metaverse-room-test",
    type: "world-player-look-intent-datagram"
  });
  await worldSession.sendClientDatagram({
    command: {
      playerId: "driver-player",
      type: "sync-player-weapon-state",
      weaponSequence: 5,
      weaponState: {
        aimMode: "ads",
        weaponId: "metaverse-service-pistol-v1"
      }
    },
    roomId: "metaverse-room-test",
    type: "world-player-weapon-state-datagram"
  });
  await flushAsyncWork();

  assert.equal(recordedPresenceMessages.length, 1);
  assert.equal(recordedPresenceMessages[0]?.type, "presence-roster-request");
  assert.equal(recordedPresenceMessages[0]?.roomId, "metaverse-room-test");
  assert.equal(recordedWorldMessages.length, 1);
  assert.equal(recordedWorldMessages[0]?.type, "world-snapshot-request");
  assert.equal(recordedWorldMessages[0]?.roomId, "metaverse-room-test");
  assert.equal(recordedWorldDatagrams.length, 3);
  assert.equal(
    recordedWorldDatagrams[0]?.type,
    "world-driver-vehicle-control-datagram"
  );
  assert.equal(
    recordedWorldDatagrams[1]?.type,
    "world-player-look-intent-datagram"
  );
  assert.equal(recordedWorldDatagrams[1]?.command.type, "sync-player-look-intent");
  assert.equal(
    recordedWorldDatagrams[2]?.type,
    "world-player-weapon-state-datagram"
  );
  assert.equal(recordedWorldDatagrams[2]?.command.type, "sync-player-weapon-state");

  await presenceStream.close();
  await worldStream.close();
  await presenceSession.close();
  await worldSession.close();
  localdevServer.stop();
});

test("LocaldevWebTransportServer lets reliable sessions take over a persistent subscription stream after the first frame", async () => {
  const fakeHttp3Server = createFakeHttp3Server();
  const recordedStreamMessages = [];
  const recordedWorldMessages = [];
  const localdevServer = new LocaldevWebTransportServer(
    {
      certificatePem: "CERTIFICATE",
      host: "127.0.0.1",
      port: 3211,
      privateKeyPem: "PRIVATE KEY",
      secret: "localdev-secret"
    },
    {
      duckHuntDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      duckHuntReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "duck-hunt-ok",
                type: "coop-room-error"
              };
            }
          };
        }
      },
      metaversePresenceReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "presence-ok",
                type: "presence-error"
              };
            }
          };
        }
      },
      metaverseWorldDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      metaverseWorldReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            async handleClientStream(message, context) {
              recordedStreamMessages.push(message);
              await context.writeResponse({
                message: "world-stream-ok",
                type: "world-error"
              });
              await context.closed;
              return true;
            },
            receiveClientMessage(message) {
              recordedWorldMessages.push(message);
              return {
                message: "world-ok",
                type: "world-error"
              };
            }
          };
        }
      }
    },
    {
      createHttp3Server() {
        return fakeHttp3Server;
      }
    }
  );

  await localdevServer.start();

  const worldSession = createFakeWebTransportSession();
  fakeHttp3Server.enqueueSession(localdevMetaverseWorldWebTransportPath, worldSession);

  const worldStream = worldSession.openClientBidirectionalStream();
  await worldStream.writeJsonFrame({
    observerPlayerId: "driver-player",
    roomId: "metaverse-room-test",
    type: "world-snapshot-subscribe"
  });

  assert.deepEqual(await worldStream.readJsonFrame(), {
    message: "world-stream-ok",
    type: "world-error"
  });
  assert.equal(recordedStreamMessages.length, 1);
  assert.equal(recordedStreamMessages[0]?.type, "world-snapshot-subscribe");
  assert.equal(recordedStreamMessages[0]?.roomId, "metaverse-room-test");
  assert.equal(recordedWorldMessages.length, 0);

  await worldStream.close();
  await worldSession.close();
  localdevServer.stop();
});

test("LocaldevWebTransportServer suppresses graceful WebTransport close errors for reliable streams", async () => {
  const fakeHttp3Server = createFakeHttp3Server();
  const recordedErrors = [];
  const localdevServer = new LocaldevWebTransportServer(
    {
      certificatePem: "CERTIFICATE",
      host: "127.0.0.1",
      port: 3211,
      privateKeyPem: "PRIVATE KEY",
      secret: "localdev-secret"
    },
    {
      duckHuntDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      duckHuntReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "duck-hunt-ok",
                type: "coop-room-error"
              };
            }
          };
        }
      },
      metaversePresenceReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "presence-ok",
                type: "presence-error"
              };
            }
          };
        }
      },
      metaverseWorldDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      metaverseWorldReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "world-ok",
                type: "world-error"
              };
            }
          };
        }
      }
    },
    {
      createHttp3Server() {
        return fakeHttp3Server;
      },
      logError(message, error) {
        recordedErrors.push({
          error,
          message
        });
      }
    }
  );

  await localdevServer.start();

  const presenceSession = createFakeWebTransportSession();
  fakeHttp3Server.enqueueSession(
    localdevMetaversePresenceWebTransportPath,
    presenceSession
  );

  const failingStream = createErroringBidirectionalStream();
  presenceSession.enqueueIncomingBidirectionalStream(failingStream);

  await flushAsyncWork();
  await flushAsyncWork();

  failingStream.fail(createWebTransportSessionCloseError(0));

  await flushAsyncWork();
  await presenceSession.close();

  assert.equal(recordedErrors.length, 0);

  localdevServer.stop();
});

test("LocaldevWebTransportServer still logs non-zero WebTransport close errors for reliable streams", async () => {
  const fakeHttp3Server = createFakeHttp3Server();
  const recordedErrors = [];
  const localdevServer = new LocaldevWebTransportServer(
    {
      certificatePem: "CERTIFICATE",
      host: "127.0.0.1",
      port: 3211,
      privateKeyPem: "PRIVATE KEY",
      secret: "localdev-secret"
    },
    {
      duckHuntDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      duckHuntReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "duck-hunt-ok",
                type: "coop-room-error"
              };
            }
          };
        }
      },
      metaversePresenceReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "presence-ok",
                type: "presence-error"
              };
            }
          };
        }
      },
      metaverseWorldDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      metaverseWorldReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "world-ok",
                type: "world-error"
              };
            }
          };
        }
      }
    },
    {
      createHttp3Server() {
        return fakeHttp3Server;
      },
      logError(message, error) {
        recordedErrors.push({
          error,
          message
        });
      }
    }
  );

  await localdevServer.start();

  const presenceSession = createFakeWebTransportSession();
  fakeHttp3Server.enqueueSession(
    localdevMetaversePresenceWebTransportPath,
    presenceSession
  );

  const failingStream = createErroringBidirectionalStream();
  presenceSession.enqueueIncomingBidirectionalStream(failingStream);

  await flushAsyncWork();
  await flushAsyncWork();

  failingStream.fail(createWebTransportSessionCloseError(32));

  await flushAsyncWork();
  await presenceSession.close();

  assert.equal(recordedErrors.length, 1);
  assert.match(
    recordedErrors[0]?.message ?? "",
    /Localdev WebTransport reliable request handling failed/
  );

  localdevServer.stop();
});

test("LocaldevWebTransportServer registers a request callback that admits only known localdev session paths", async () => {
  const fakeHttp3Server = createFakeHttp3Server();
  const localdevServer = new LocaldevWebTransportServer(
    {
      certificatePem: "CERTIFICATE",
      host: "127.0.0.1",
      port: 3211,
      privateKeyPem: "PRIVATE KEY",
      secret: "localdev-secret"
    },
    {
      duckHuntDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      duckHuntReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "duck-hunt-ok",
                type: "coop-room-error"
              };
            }
          };
        }
      },
      metaversePresenceReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "presence-ok",
                type: "presence-error"
              };
            }
          };
        }
      },
      metaverseWorldDatagramAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientDatagram() {}
          };
        }
      },
      metaverseWorldReliableAdapter: {
        openSession() {
          return {
            dispose() {},
            receiveClientMessage() {
              return {
                message: "world-ok",
                type: "world-error"
              };
            }
          };
        }
      }
    },
    {
      createHttp3Server() {
        return fakeHttp3Server;
      }
    }
  );

  await localdevServer.start();

  assert.deepEqual(
    await fakeHttp3Server.invokeRequestCallback({
      header: {
        ":path": localdevMetaversePresenceWebTransportPath
      }
    }),
    {
      path: localdevMetaversePresenceWebTransportPath,
      status: 200
    }
  );
  assert.deepEqual(
    await fakeHttp3Server.invokeRequestCallback({
      header: {
        ":path": localdevMetaverseWorldWebTransportPath
      }
    }),
    {
      path: localdevMetaverseWorldWebTransportPath,
      status: 200
    }
  );
  assert.deepEqual(
    await fakeHttp3Server.invokeRequestCallback({
      header: {
        ":path": "/not-a-webtransport-route"
      }
    }),
    {
      path: "/not-a-webtransport-route",
      status: 404
    }
  );
  assert.deepEqual(
    await fakeHttp3Server.invokeRequestCallback({
      header: {}
    }),
    {
      path: "/",
      status: 400
    }
  );

  localdevServer.stop();
});
