import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createMetaverseRoomId } from "@webgpu-metaverse/shared";

import { MetaverseRoomHttpAdapter } from "../../../server/dist/metaverse/adapters/metaverse-room-http-adapter.js";
import { MetaverseRoomDirectory } from "../../../server/dist/metaverse/classes/metaverse-room-directory.js";

function createResponseCapture() {
  const headers = new Map();
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
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    writeHead(nextStatusCode, nextHeaders = {}) {
      statusCode = nextStatusCode;

      for (const [name, value] of Object.entries(nextHeaders)) {
        headers.set(name.toLowerCase(), value);
      }
    }
  };
}

function createRequest(method) {
  const request = new PassThrough();
  request.method = method;
  return request;
}

async function dispatchJsonRequest(adapter, { body, method, pathname, nowMs }) {
  const request = createRequest(method);
  const response = createResponseCapture();
  const handlePromise = adapter.handleRequest(
    request,
    response,
    new URL(`http://127.0.0.1:3210${pathname}`),
    nowMs
  );

  if (body === undefined) {
    request.end();
  } else {
    request.end(JSON.stringify(body));
  }

  const handled = await handlePromise;

  return {
    handled,
    response
  };
}

test("MetaverseRoomHttpAdapter quick-joins free roam and lists room summaries", async () => {
  const adapter = new MetaverseRoomHttpAdapter(new MetaverseRoomDirectory());

  const quickJoinResult = await dispatchJsonRequest(adapter, {
    body: {
      matchMode: "free-roam",
      playerId: "free-roam-player"
    },
    method: "POST",
    nowMs: 0,
    pathname: "/metaverse/rooms/quick-join"
  });

  assert.equal(quickJoinResult.handled, true);
  assert.equal(quickJoinResult.response.statusCode, 200);
  assert.equal(quickJoinResult.response.json.bundleId, "private-build");
  assert.equal(quickJoinResult.response.json.matchMode, "free-roam");

  const directoryResult = await dispatchJsonRequest(adapter, {
    method: "GET",
    nowMs: 10,
    pathname: "/metaverse/rooms?matchMode=free-roam"
  });

  assert.equal(directoryResult.handled, true);
  assert.equal(directoryResult.response.statusCode, 200);
  assert.equal(directoryResult.response.json.status, "metaverse-room-routing-ready");
  assert.equal(directoryResult.response.json.rooms.length, 1);
  assert.equal(
    directoryResult.response.json.rooms[0].roomId,
    quickJoinResult.response.json.roomId
  );
});

test("MetaverseRoomHttpAdapter creates and rejoins explicit team deathmatch rooms", async () => {
  const adapter = new MetaverseRoomHttpAdapter(new MetaverseRoomDirectory());
  const roomId = createMetaverseRoomId("tdm-hangar");

  assert.notEqual(roomId, null);

  const firstJoinResult = await dispatchJsonRequest(adapter, {
    body: {
      playerId: "tdm-leader"
    },
    method: "POST",
    nowMs: 0,
    pathname: `/metaverse/rooms/${roomId}/join`
  });
  const secondJoinResult = await dispatchJsonRequest(adapter, {
    body: {
      playerId: "tdm-wing"
    },
    method: "POST",
    nowMs: 10,
    pathname: `/metaverse/rooms/${roomId}/join`
  });

  assert.equal(firstJoinResult.handled, true);
  assert.equal(firstJoinResult.response.statusCode, 200);
  assert.equal(firstJoinResult.response.json.roomId, roomId);
  assert.equal(firstJoinResult.response.json.bundleId, "private-build");
  assert.equal(firstJoinResult.response.json.matchMode, "team-deathmatch");
  assert.equal(firstJoinResult.response.json.leaderPlayerId, "tdm-leader");
  assert.equal(secondJoinResult.handled, true);
  assert.equal(secondJoinResult.response.statusCode, 200);
  assert.equal(secondJoinResult.response.json.roomId, roomId);
  assert.equal(secondJoinResult.response.json.connectedPlayerCount, 2);
  assert.equal(secondJoinResult.response.json.leaderPlayerId, "tdm-leader");

  const earlyNextMatchResult = await dispatchJsonRequest(adapter, {
    body: {
      playerId: "tdm-wing"
    },
    method: "POST",
    nowMs: 20,
    pathname: `/metaverse/rooms/${roomId}/next-match`
  });

  assert.equal(earlyNextMatchResult.handled, true);
  assert.equal(earlyNextMatchResult.response.statusCode, 409);
  assert.match(
    earlyNextMatchResult.response.json.error,
    /not ready for the next match/
  );
});
