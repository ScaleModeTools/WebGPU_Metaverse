import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncPresenceCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaversePresenceHttpAdapter } from "../../../server/dist/metaverse/adapters/metaverse-presence-http-adapter.js";
import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";

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

function createRequest(method, body = null) {
  const request = new EventEmitter();

  request.method = method;
  request.emitBody = () => {
    if (body !== null) {
      request.emit("data", Buffer.from(JSON.stringify(body)));
    }

    request.emit("end");
  };

  return request;
}

test("MetaversePresenceHttpAdapter handles nested pose join, sync, and snapshot polling", async () => {
  const adapter = new MetaversePresenceHttpAdapter(
    new MetaverseAuthoritativeWorldRuntime()
  );
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  const joinRequest = createRequest("POST", createMetaverseJoinPresenceCommand({
    characterId: "mesh2motion-humanoid-v1",
    playerId,
      pose: {
        animationVocabulary: "idle",
        look: {
          pitchRadians: -0.15,
          yawRadians: 0.25
        },
        locomotionMode: "grounded",
        mountedOccupancy: null,
        position: {
          x: 0,
          y: 1.62,
        z: 24
      },
      yawRadians: 0
    },
    username
  }));
  const joinResponse = createResponseCapture();
  const joinPromise = adapter.handleRequest(
    joinRequest,
    joinResponse,
    new URL("http://127.0.0.1:3210/metaverse/presence/commands"),
    0
  );

  joinRequest.emitBody();

  const joinHandled = await joinPromise;

  assert.equal(joinHandled, true);
  assert.equal(joinResponse.statusCode, 200);
  assert.equal(joinResponse.json.type, "presence-roster");
  assert.equal(joinResponse.json.roster.players[0]?.playerId, "harbor-pilot-1");
  assert.equal(joinResponse.json.roster.players[0]?.pose.look.pitchRadians, -0.15);
  assert.equal(joinResponse.json.roster.players[0]?.pose.look.yawRadians, 0.25);
  assert.equal(joinResponse.json.roster.players[0]?.pose.position.x, 0);
  assert.equal(joinResponse.json.roster.players[0]?.pose.stateSequence, 0);

  const syncRequest = createRequest(
    "POST",
    createMetaverseSyncPresenceCommand({
      playerId,
      pose: {
        animationVocabulary: "walk",
        look: {
          pitchRadians: 0.3,
          yawRadians: 1.1
        },
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 2.5,
          y: 1.62,
          z: 22
        },
        stateSequence: 1,
        yawRadians: 0.6
      }
    })
  );
  const syncResponse = createResponseCapture();
  const syncPromise = adapter.handleRequest(
    syncRequest,
    syncResponse,
    new URL("http://127.0.0.1:3210/metaverse/presence/commands"),
    50
  );

  syncRequest.emitBody();

  const syncHandled = await syncPromise;

  assert.equal(syncHandled, true);
  assert.equal(syncResponse.statusCode, 200);
  assert.equal(syncResponse.json.roster.players[0]?.pose.position.x, 2.5);
  assert.equal(syncResponse.json.roster.players[0]?.pose.stateSequence, 1);
  assert.equal(syncResponse.json.roster.players[0]?.pose.look.pitchRadians, 0.3);
  assert.equal(syncResponse.json.roster.players[0]?.pose.look.yawRadians, 0.6);
  assert.equal(syncResponse.json.roster.players[0]?.pose.locomotionMode, "mounted");
  assert.equal(
    syncResponse.json.roster.players[0]?.pose.mountedOccupancy?.seatId,
    "driver-seat"
  );

  const pollResponse = createResponseCapture();
  const pollHandled = await adapter.handleRequest(
    { method: "GET" },
    pollResponse,
    new URL("http://127.0.0.1:3210/metaverse/presence?playerId=harbor-pilot-1"),
    100
  );

  assert.equal(pollHandled, true);
  assert.equal(pollResponse.statusCode, 200);
  assert.equal(pollResponse.json.type, "presence-roster");
  assert.equal(pollResponse.json.roster.players.length, 1);
  assert.equal(pollResponse.json.roster.players[0]?.pose.look.pitchRadians, 0.3);
  assert.equal(pollResponse.json.roster.players[0]?.pose.look.yawRadians, 0.6);
  assert.equal(pollResponse.json.roster.players[0]?.pose.position.x, 2.5);
  assert.equal(
    pollResponse.json.roster.players[0]?.pose.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
});

test("MetaversePresenceHttpAdapter returns conflict for unknown observers", async () => {
  const adapter = new MetaversePresenceHttpAdapter(
    new MetaverseAuthoritativeWorldRuntime()
  );
  const response = createResponseCapture();
  const handled = await adapter.handleRequest(
    { method: "GET" },
    response,
    new URL("http://127.0.0.1:3210/metaverse/presence?playerId=missing-player"),
    0
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 409);
  assert.equal(response.json.error, "Unknown metaverse player: missing-player");
});
