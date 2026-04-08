import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createCoopRoomDirectorySnapshot,
  createCoopRoomId,
  createCoopSessionId
} from "@thumbshooter/shared";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function requireValue(value, label) {
  assert.notEqual(value, null, `${label} should resolve`);
  return value;
}

function createJsonResponse(ok, payload) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

test("CoopRoomDirectoryClient fetches typed room summaries from the server root", async () => {
  const { CoopRoomDirectoryClient } = await clientLoader.load("/src/network/index.ts");
  const directorySnapshot = createCoopRoomDirectorySnapshot({
    coOpRooms: [
      {
        birdsRemaining: 3,
        capacity: 4,
        connectedPlayerCount: 2,
        phase: "waiting-for-players",
        readyPlayerCount: 2,
        requiredReadyPlayerCount: 2,
        roomId: requireValue(createCoopRoomId("co-op-harbor"), "roomId"),
        sessionId: requireValue(
          createCoopSessionId("co-op-harbor-session-1"),
          "sessionId"
        ),
        tick: 8
      }
    ]
  });
  const requests = [];
  const directoryClient = new CoopRoomDirectoryClient(
    {
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input) {
        requests.push(String(input));
        return createJsonResponse(true, directorySnapshot);
      }
    }
  );

  const fetchedSnapshot = await directoryClient.fetchSnapshot();

  assert.equal(requests[0], "http://127.0.0.1:3210/");
  assert.equal(fetchedSnapshot.coOpRooms[0]?.roomId, "co-op-harbor");
  assert.equal(fetchedSnapshot.coOpRooms[0]?.readyPlayerCount, 2);
  assert.equal(fetchedSnapshot.coOpRooms[0]?.capacity, 4);
});
