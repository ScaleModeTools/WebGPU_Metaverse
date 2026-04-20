import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceWebTransportErrorMessage,
  createMetaversePresenceWebTransportServerEventMessage,
  createUsername
} from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaversePresenceWebTransportTransport sends explicit presence request envelopes", async () => {
  const { createMetaversePresenceWebTransportTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const requests = [];
  let disposed = false;
  const transport = createMetaversePresenceWebTransportTransport(
    {
      webTransportUrl: "https://example.test/metaverse/presence"
    },
    {
      channel: {
        dispose() {
          disposed = true;
        },
        async sendRequest(request) {
          requests.push(request);
          return createMetaversePresenceWebTransportServerEventMessage({
            event: createMetaversePresenceRosterEvent(
              {
              players: [],
              snapshotSequence: requests.length,
              tickIntervalMs: 150
              }
            )
          });
        }
      }
    }
  );

  await transport.sendCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        yawRadians: 0
      },
      username
    })
  );
  await transport.pollRosterSnapshot(playerId);
  transport.dispose?.();

  assert.equal(requests[0]?.type, "presence-command-request");
  assert.equal(requests[0]?.command.type, "join-presence");
  assert.equal(requests[1]?.type, "presence-roster-request");
  assert.equal(requests[1]?.observerPlayerId, playerId);
  assert.equal(disposed, true);
});

test("createMetaversePresenceWebTransportTransport surfaces typed error frames as errors", async () => {
  const { createMetaversePresenceWebTransportTransport } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const playerId = createMetaversePlayerId("missing-player");

  assert.notEqual(playerId, null);

  const transport = createMetaversePresenceWebTransportTransport(
    {
      webTransportUrl: "https://example.test/metaverse/presence"
    },
    {
      channel: {
        dispose() {},
        async sendRequest() {
          return createMetaversePresenceWebTransportErrorMessage({
            message: "Unknown metaverse player: missing-player"
          });
        }
      }
    }
  );

  await assert.rejects(
    () => transport.pollRosterSnapshot(playerId),
    /Unknown metaverse player/
  );
});
