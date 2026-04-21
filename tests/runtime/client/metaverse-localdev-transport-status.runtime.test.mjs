import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { createServer } from "vite";

const repoRoot = process.cwd();
const clientRoot = resolve(repoRoot, "client");
const clientConfigPath = resolve(clientRoot, "vite.config.ts");

function createJsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

async function loadSharedContracts(loader) {
  return loader.load("/../packages/shared/src/index.ts");
}

function createPresenceRosterEvent(sharedContracts, playerId) {
  return sharedContracts.createMetaversePresenceRosterEvent({
    players: [
      {
        characterId: "mesh2motion-humanoid-v1",
        playerId,
        pose: {
          animationVocabulary: "idle",
          locomotionMode: "grounded",
          position: {
            x: 0,
            y: 1.62,
            z: 24
          },
          stateSequence: 1,
          yawRadians: 0
        },
        username: "Harbor Pilot"
      }
    ],
    snapshotSequence: 1,
    tickIntervalMs: 90
  });
}

function createRealtimeWorldEvent(
  sharedContracts,
  playerId,
  snapshotSequence = 1
) {
  const vehicleId = sharedContracts.createMetaverseVehicleId(
    "metaverse-hub-skiff-v1"
  );

  assert.notEqual(vehicleId, null);

  return sharedContracts.createMetaverseRealtimeWorldEvent({
    world: {
      players: [
        {
          animationVocabulary: "idle",
          characterId: "mesh2motion-humanoid-v1",
          groundedBody: {
            linearVelocity: {
              x: 0,
              y: 0,
              z: 0
            },
            position: {
              x: 0,
              y: 0.4,
              z: 24
            },
            yawRadians: 0
          },
          locomotionMode: "mounted",
          playerId,
          stateSequence: snapshotSequence,
          username: "Harbor Pilot"
        }
      ],
      snapshotSequence,
      tick: {
        currentTick: snapshotSequence,
        serverTimeMs: snapshotSequence * 50,
        tickIntervalMs: 50
      },
      vehicles: [
        {
          angularVelocityRadiansPerSecond: 0,
          environmentAssetId: "metaverse-hub-skiff-v1",
          linearVelocity: {
            x: 0,
            y: 0,
            z: -10.5
          },
          position: {
            x: 0,
            y: 0.4,
            z: 24 - snapshotSequence
          },
          seats: [
            {
              occupantPlayerId: playerId,
              occupantRole: "driver",
              seatId: "driver-seat"
            }
          ],
          vehicleId,
          yawRadians: 0
        }
      ]
    }
  });
}

function createFailingDatagramWritable(
  message,
  failureState = {
    remainingFailureCount: Number.POSITIVE_INFINITY
  }
) {
  return new WritableStream({
    write() {
      if (failureState.remainingFailureCount > 0) {
        failureState.remainingFailureCount -= 1;
        throw new Error(message);
      }
    }
  });
}

function createEnvScopedWebTransportConstructor({
  bidirectionalErrorMessage,
  datagramErrorMessage,
  datagramFailureCount
}) {
  const datagramFailureState = {
    remainingFailureCount:
      datagramFailureCount ?? Number.POSITIVE_INFINITY
  };

  return class FakeWebTransport {
    constructor() {
      this.closed = Promise.resolve();
      this.datagrams = {
        writable: createFailingDatagramWritable(
          datagramErrorMessage,
          datagramFailureState
        )
      };
      this.ready = Promise.resolve();
    }

    async createBidirectionalStream() {
      throw new Error(bidirectionalErrorMessage);
    }

    close() {}
  };
}

async function createClientModuleLoaderWithEnv(envOverrides) {
  const previousEntries = new Map();

  for (const [name, value] of Object.entries(envOverrides)) {
    previousEntries.set(name, process.env[name]);

    if (value === null) {
      delete process.env[name];
      continue;
    }

    process.env[name] = value;
  }

  let server;

  try {
    server = await createServer({
      appType: "custom",
      configFile: clientConfigPath,
      logLevel: "error",
      optimizeDeps: {
        include: [],
        noDiscovery: true
      },
      root: clientRoot,
      server: {
        hmr: false,
        middlewareMode: true
      }
    });
  } catch (error) {
    for (const [name, previousValue] of previousEntries) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }

    throw error;
  }

  return {
    async close() {
      await server.close();

      for (const [name, previousValue] of previousEntries) {
        if (previousValue === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = previousValue;
        }
      }
    },
    async load(modulePath) {
      return server.ssrLoadModule(modulePath);
    }
  };
}

function waitForTimers(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("createMetaversePresenceClient reports default HTTP when WebTransport is not requested", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL: "",
    VITE_METAVERSE_REALTIME_TRANSPORT: "http"
  });

  try {
    const { createMetaversePresenceClient } = await loader.load(
      "/src/metaverse/config/metaverse-presence-network.ts"
    );
    const client = createMetaversePresenceClient();

    assert.equal(client.reliableTransportStatusSnapshot.preference, "http");
    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "not-requested"
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaversePresenceClient reports WebTransport-preferred as unconfigured without a URL", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL: null,
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred"
  });

  try {
    const { createMetaversePresenceClient } = await loader.load(
      "/src/metaverse/config/metaverse-presence-network.ts"
    );
    const client = createMetaversePresenceClient();

    assert.equal(
      client.reliableTransportStatusSnapshot.preference,
      "webtransport-preferred"
    );
    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "unconfigured"
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaversePresenceClient reports localdev WebTransport self-check failures without treating them as plain missing URLs", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR:
      "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/presence: Opening handshake failed.",
    VITE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS: "self-check-failed",
    VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL: null,
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred"
  });

  try {
    const { createMetaversePresenceClient } = await loader.load(
      "/src/metaverse/config/metaverse-presence-network.ts"
    );
    const client = createMetaversePresenceClient();

    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "localdev-self-check-failed"
    );
    assert.equal(
      client.reliableTransportStatusSnapshot.lastTransportError,
      "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/presence: Opening handshake failed."
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaversePresenceClient reports runtime fallback after a configured non-localhost WebTransport failure", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL:
      "https://example.test/metaverse/presence",
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred"
  });
  const originalFetch = globalThis.fetch;
  const originalWebTransport = globalThis.WebTransport;

  try {
    const sharedContracts = await loadSharedContracts(loader);
    const playerId =
      sharedContracts.createMetaversePlayerId("harbor-pilot-1");
    const username = sharedContracts.createUsername("Harbor Pilot");

    assert.notEqual(playerId, null);
    assert.notEqual(username, null);

    globalThis.fetch = async () =>
      createJsonResponse(createPresenceRosterEvent(sharedContracts, playerId));
    globalThis.WebTransport = createEnvScopedWebTransportConstructor({
      bidirectionalErrorMessage: "WebTransport stream failed.",
      datagramErrorMessage: "Datagram transport unavailable."
    });

    const { createMetaversePresenceClient } = await loader.load(
      "/src/metaverse/config/metaverse-presence-network.ts"
    );
    const client = createMetaversePresenceClient();

    await client.ensureJoined({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "grounded",
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    });

    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(client.reliableTransportStatusSnapshot.fallbackActive, true);
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "runtime-fallback"
    );
    assert.equal(
      client.reliableTransportStatusSnapshot.lastTransportError,
      "WebTransport stream failed."
    );

    client.dispose();
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }

    if (originalWebTransport === undefined) {
      delete globalThis.WebTransport;
    } else {
      globalThis.WebTransport = originalWebTransport;
    }

    await loader.close();
  }
});

test("createMetaverseWorldClient reports default HTTP when WebTransport is not requested", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_REALTIME_TRANSPORT: "http",
    VITE_METAVERSE_WORLD_WEBTRANSPORT_URL: ""
  });

  try {
    const { createMetaverseWorldClient } = await loader.load(
      "/src/metaverse/config/metaverse-world-network.ts"
    );
    const client = createMetaverseWorldClient();

    assert.equal(client.reliableTransportStatusSnapshot.preference, "http");
    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "not-requested"
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "unavailable");
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.webTransportStatus,
      "not-requested"
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaverseWorldClient reports WebTransport-preferred as unconfigured without a URL", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred",
    VITE_METAVERSE_WORLD_WEBTRANSPORT_URL: null
  });

  try {
    const { createMetaverseWorldClient } = await loader.load(
      "/src/metaverse/config/metaverse-world-network.ts"
    );
    const client = createMetaverseWorldClient();

    assert.equal(
      client.reliableTransportStatusSnapshot.preference,
      "webtransport-preferred"
    );
    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "unconfigured"
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "unavailable");
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.webTransportStatus,
      "unconfigured"
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaverseWorldClient reports localdev WebTransport self-check failures for both reliable and datagram lanes", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR:
      "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/world: Opening handshake failed.",
    VITE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS: "self-check-failed",
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred",
    VITE_METAVERSE_WORLD_WEBTRANSPORT_URL: null
  });

  try {
    const { createMetaverseWorldClient } = await loader.load(
      "/src/metaverse/config/metaverse-world-network.ts"
    );
    const client = createMetaverseWorldClient();

    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "localdev-self-check-failed"
    );
    assert.equal(
      client.reliableTransportStatusSnapshot.lastTransportError,
      "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/world: Opening handshake failed."
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "unavailable");
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.webTransportStatus,
      "localdev-self-check-failed"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
      "Localdev WebTransport self-check failed for https://127.0.0.1:3211/metaverse/world: Opening handshake failed."
    );

    client.dispose();
  } finally {
    await loader.close();
  }
});

test("createMetaverseWorldClient keeps reliable and datagram lane truth separate under fallback and recovers the datagram lane", async () => {
  const loader = await createClientModuleLoaderWithEnv({
    VITE_METAVERSE_REALTIME_TRANSPORT: "webtransport-preferred",
    VITE_METAVERSE_WORLD_WEBTRANSPORT_URL:
      "https://127.0.0.1:3211/metaverse/world"
  });
  const originalFetch = globalThis.fetch;
  const originalWebTransport = globalThis.WebTransport;
  let snapshotSequence = 1;

  try {
    const sharedContracts = await loadSharedContracts(loader);
    const playerId =
      sharedContracts.createMetaversePlayerId("harbor-pilot-1");

    assert.notEqual(playerId, null);

    globalThis.fetch = async (_input, init) => {
      const nextEvent = createRealtimeWorldEvent(
        sharedContracts,
        playerId,
        snapshotSequence++
      );

      return createJsonResponse(
        init?.method === "POST" ? nextEvent : nextEvent
      );
    };
    globalThis.WebTransport = createEnvScopedWebTransportConstructor({
      bidirectionalErrorMessage: "WebTransport stream failed.",
      datagramErrorMessage: "Datagram transport unavailable.",
      datagramFailureCount: 1
    });

    const { createMetaverseWorldClient } = await loader.load(
      "/src/metaverse/config/metaverse-world-network.ts"
    );
    const client = createMetaverseWorldClient();

    await client.ensureConnected(playerId);

    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(client.reliableTransportStatusSnapshot.fallbackActive, true);
    assert.equal(
      client.reliableTransportStatusSnapshot.webTransportStatus,
      "localdev-host-unavailable"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
      "webtransport-datagram"
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");

    client.syncDriverVehicleControl({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      playerId
    });

    await waitForTimers(40);

    assert.equal(client.reliableTransportStatusSnapshot.activeTransport, "http");
    assert.equal(client.reliableTransportStatusSnapshot.fallbackActive, true);
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
      "reliable-command-fallback"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.state,
      "degraded-to-reliable"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.webTransportStatus,
      "runtime-fallback"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
      "Datagram transport unavailable."
    );

    await waitForTimers(40);

    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
      "webtransport-datagram"
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
      "Datagram transport unavailable."
    );

    client.syncDriverVehicleControl({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 0.6,
        strafeAxis: 0,
        yawAxis: 0.1
      },
      playerId
    });

    await waitForTimers(80);

    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.activeTransport,
      "webtransport-datagram"
    );
    assert.equal(client.driverVehicleControlDatagramStatusSnapshot.state, "active");
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.webTransportStatus,
      "active"
    );
    assert.equal(
      client.driverVehicleControlDatagramStatusSnapshot.lastTransportError,
      null
    );

    client.dispose();
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }

    if (originalWebTransport === undefined) {
      delete globalThis.WebTransport;
    } else {
      globalThis.WebTransport = originalWebTransport;
    }

    await loader.close();
  }
});
