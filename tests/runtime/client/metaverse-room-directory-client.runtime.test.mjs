import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseJoinRoomRequest,
  createMetaverseNextMatchRequest,
  createMetaversePlayerId,
  createMetaverseQuickJoinRoomRequest,
  createMetaverseRoomAssignmentSnapshot,
  createMetaverseRoomDirectorySnapshot,
  createMetaverseRoomId,
  createMetaverseRoomSessionId
} from "@webgpu-metaverse/shared";

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

test("MetaverseRoomDirectoryClient fetches typed metaverse room summaries with match-mode filtering", async () => {
  const { MetaverseRoomDirectoryClient } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const directorySnapshot = createMetaverseRoomDirectorySnapshot({
    rooms: [
      {
        blueTeamPlayerCount: 1,
        blueTeamScore: 3,
        bundleId: "deathmatch",
        capacity: 8,
        connectedPlayerCount: 2,
        launchVariationId: "shell-team-deathmatch",
        leaderPlayerId: requireValue(
          createMetaversePlayerId("room-leader"),
          "leaderPlayerId"
        ),
        matchMode: "team-deathmatch",
        phase: "waiting-for-players",
        redTeamPlayerCount: 1,
        redTeamScore: 4,
        roomId: requireValue(createMetaverseRoomId("tdm-harbor"), "roomId"),
        roomSessionId: requireValue(
          createMetaverseRoomSessionId("tdm-harbor-session-1"),
          "roomSessionId"
        ),
        scoreLimit: 50,
        status: "available",
        timeRemainingMs: 600_000
      }
    ]
  });
  const requests = [];
  const directoryClient = new MetaverseRoomDirectoryClient(
    {
      roomCollectionPath: "/metaverse/rooms",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        requests.push({
          cache: init?.cache ?? null,
          url: String(input)
        });
        return createJsonResponse(true, directorySnapshot);
      }
    }
  );

  const fetchedSnapshot = await directoryClient.fetchSnapshot("team-deathmatch");

  assert.equal(
    requests[0]?.url,
    "http://127.0.0.1:3210/metaverse/rooms?matchMode=team-deathmatch"
  );
  assert.equal(requests[0]?.cache, "no-store");
  assert.equal(fetchedSnapshot.rooms[0]?.roomId, "tdm-harbor");
  assert.equal(fetchedSnapshot.rooms[0]?.redTeamScore, 4);
  assert.equal(fetchedSnapshot.rooms[0]?.blueTeamPlayerCount, 1);
});

test("MetaverseRoomDirectoryClient posts quick-join, explicit room-join, and next-match requests", async () => {
  const { MetaverseRoomDirectoryClient } = await clientLoader.load(
    "/src/network/index.ts"
  );
  const quickJoinAssignment = createMetaverseRoomAssignmentSnapshot({
    bundleId: "staging-ground",
    capacity: 16,
    connectedPlayerCount: 1,
    launchVariationId: "shell-free-roam",
    matchMode: "free-roam",
    roomId: requireValue(
      createMetaverseRoomId("free-roam-staging-ground-a1"),
      "quickJoinRoomId"
    ),
    roomSessionId: requireValue(
      createMetaverseRoomSessionId("free-roam-staging-ground-a1-session-1"),
      "quickJoinRoomSessionId"
    )
  });
  const joinedAssignment = createMetaverseRoomAssignmentSnapshot({
    bundleId: "deathmatch",
    capacity: 8,
    connectedPlayerCount: 2,
    launchVariationId: "shell-team-deathmatch",
    leaderPlayerId: requireValue(
      createMetaversePlayerId("tdm-leader"),
      "joinedLeaderPlayerId"
    ),
    matchMode: "team-deathmatch",
    roomId: requireValue(createMetaverseRoomId("tdm-hangar"), "joinRoomId"),
    roomSessionId: requireValue(
      createMetaverseRoomSessionId("tdm-hangar-session-1"),
      "joinRoomSessionId"
    )
  });
  const requests = [];
  let requestCount = 0;
  const directoryClient = new MetaverseRoomDirectoryClient(
    {
      roomCollectionPath: "/metaverse/rooms",
      serverOrigin: "http://127.0.0.1:3210"
    },
    {
      async fetch(input, init) {
        requests.push({
          body: init?.body ?? null,
          headers: init?.headers ?? null,
          method: init?.method ?? "GET",
          url: String(input)
        });
        requestCount += 1;

        return createJsonResponse(
          true,
          requestCount === 1 ? quickJoinAssignment : joinedAssignment
        );
      }
    }
  );
  const freeRoamPlayerId = requireValue(
    createMetaversePlayerId("free-roam-player"),
    "freeRoamPlayerId"
  );
  const teamDeathmatchPlayerId = requireValue(
    createMetaversePlayerId("tdm-wing"),
    "teamDeathmatchPlayerId"
  );
  const roomId = requireValue(createMetaverseRoomId("tdm-hangar"), "roomId");

  const resolvedQuickJoinAssignment = await directoryClient.quickJoinRoom(
    createMetaverseQuickJoinRoomRequest({
      matchMode: "free-roam",
      playerId: freeRoamPlayerId
    })
  );
  const resolvedJoinAssignment = await directoryClient.joinRoom(
    roomId,
    createMetaverseJoinRoomRequest({
      playerId: teamDeathmatchPlayerId
    })
  );
  const resolvedNextMatchAssignment = await directoryClient.requestNextMatch(
    roomId,
    createMetaverseNextMatchRequest({
      playerId: teamDeathmatchPlayerId
    })
  );

  assert.equal(requests[0]?.url, "http://127.0.0.1:3210/metaverse/rooms/quick-join");
  assert.equal(requests[0]?.method, "POST");
  assert.equal(requests[0]?.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(String(requests[0]?.body)), {
    bundleId: null,
    launchVariationId: null,
    matchMode: "free-roam",
    playerId: freeRoamPlayerId
  });
  assert.equal(requests[1]?.url, "http://127.0.0.1:3210/metaverse/rooms/tdm-hangar/join");
  assert.equal(requests[1]?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[1]?.body)), {
    bundleId: null,
    launchVariationId: null,
    playerId: teamDeathmatchPlayerId
  });
  assert.equal(
    requests[2]?.url,
    "http://127.0.0.1:3210/metaverse/rooms/tdm-hangar/next-match"
  );
  assert.equal(requests[2]?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[2]?.body)), {
    playerId: teamDeathmatchPlayerId
  });
  assert.equal(resolvedQuickJoinAssignment.roomId, "free-roam-staging-ground-a1");
  assert.equal(resolvedJoinAssignment.roomId, "tdm-hangar");
  assert.equal(resolvedJoinAssignment.connectedPlayerCount, 2);
  assert.equal(resolvedNextMatchAssignment.roomId, "tdm-hangar");
});
