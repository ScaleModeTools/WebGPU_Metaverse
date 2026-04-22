import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseJoinPresenceCommand,
  createMetaversePlayerId,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createUsername
} from "@webgpu-metaverse/shared";

import { MetaverseAuthoritativeWorldRuntime } from "../../../server/dist/metaverse/classes/metaverse-authoritative-world-runtime.js";
import { MetaverseWorldHttpAdapter } from "../../../server/dist/metaverse/adapters/metaverse-world-http-adapter.js";
import {
  authoredWaterBaySkiffYawRadians
} from "../metaverse-authored-world-test-fixtures.mjs";

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

test("MetaverseWorldHttpAdapter serves authoritative metaverse world snapshots", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldHttpAdapter(runtime);
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        animationVocabulary: "idle",
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = createResponseCapture();
  const handled = await adapter.handleRequest(
    { method: "GET" },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world?playerId=harbor-pilot-1"),
    200
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.type, "world-snapshot");
  assert.equal(response.json.world.players[0]?.playerId, "harbor-pilot-1");
  assert.equal(
    response.json.world.players[0]?.mountedOccupancy?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(response.json.world.vehicles.length, 1);
  assert.equal(
    response.json.world.vehicles[0]?.seats[0]?.occupantPlayerId,
    "harbor-pilot-1"
  );
});

test("MetaverseWorldHttpAdapter accepts driver vehicle control commands on the explicit command route", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldHttpAdapter(runtime);
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "driver",
          seatId: "driver-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = createResponseCapture();
  const commandBody = JSON.stringify(
    createMetaverseSyncDriverVehicleControlCommand({
      controlIntent: {
        boost: false,
        environmentAssetId: "metaverse-hub-skiff-v1",
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      controlSequence: 1,
      playerId
    })
  );
  const handled = await adapter.handleRequest(
    {
      method: "POST",
      on(eventName, listener) {
        if (eventName === "data") {
          listener(commandBody);
        }

        if (eventName === "end") {
          listener();
        }
      }
    },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world/commands"),
    100
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.type, "world-snapshot");
});

test("MetaverseWorldHttpAdapter accepts traversal intent commands on the explicit command route", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldHttpAdapter(runtime);
  const playerId = createMetaversePlayerId("traversal-harbor-pilot-1");
  const username = createUsername("Traversal Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = createResponseCapture();
  const commandBody = JSON.stringify(
    createMetaverseSyncPlayerTraversalIntentCommand({
      intent: {
        actionIntent: {
          kind: "none",
          pressed: false
        },
        bodyControl: {
          boost: false,
          moveAxis: 1,
          strafeAxis: 0,
          turnAxis: 0.25
        },
        facing: {
          pitchRadians: 0,
          yawRadians: 0.25
        },
        sequence: 2,
        locomotionMode: "grounded",
      },
      playerId
    })
  );
  const handled = await adapter.handleRequest(
    {
      method: "POST",
      on(eventName, listener) {
        if (eventName === "data") {
          listener(commandBody);
        }

        if (eventName === "end") {
          listener();
        }
      }
    },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world/commands"),
    100
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.type, "world-snapshot");
  assert.equal(response.json.world.observerPlayer?.lastProcessedTraversalSequence, 1);

  runtime.advanceToTime(200);

  const worldSnapshot = runtime.readWorldSnapshot(200, playerId);

  assert.equal(worldSnapshot.observerPlayer?.lastProcessedTraversalSequence, 2);
  assert.equal(worldSnapshot.players[0]?.locomotionMode, "grounded");
  assert.equal(worldSnapshot.players[0]?.stateSequence, 2);
});

test("MetaverseWorldHttpAdapter accepts explicit player look commands on the explicit command route", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldHttpAdapter(runtime);
  const playerId = createMetaversePlayerId("look-harbor-pilot-1");
  const username = createUsername("Look Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        locomotionMode: "mounted",
        mountedOccupancy: {
          environmentAssetId: "metaverse-hub-skiff-v1",
          entryId: null,
          occupancyKind: "seat",
          occupantRole: "passenger",
          seatId: "port-bench-seat"
        },
        position: {
          x: 0,
          y: 0.4,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0.25
      },
      username
    }),
    0
  );

  const response = createResponseCapture();
  const commandBody = JSON.stringify(
    createMetaverseSyncPlayerLookIntentCommand({
      lookIntent: {
        pitchRadians: -0.4,
        yawRadians: 1.2
      },
      lookSequence: 2,
      playerId
    })
  );
  const handled = await adapter.handleRequest(
    {
      method: "POST",
      on(eventName, listener) {
        if (eventName === "data") {
          listener(commandBody);
        }

        if (eventName === "end") {
          listener();
        }
      }
    },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world/commands"),
    100
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.type, "world-snapshot");
  assert.equal(response.json.world.players[0]?.look.pitchRadians, -0.4);
  assert.equal(response.json.world.players[0]?.look.yawRadians, 1.2);
  assert.equal(
    response.json.world.players[0]?.groundedBody?.yawRadians,
    authoredWaterBaySkiffYawRadians
  );
});

test("MetaverseWorldHttpAdapter accepts reliable mounted occupancy commands on the explicit command route", async () => {
  const runtime = new MetaverseAuthoritativeWorldRuntime();
  const adapter = new MetaverseWorldHttpAdapter(runtime);
  const playerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");

  assert.notEqual(playerId, null);
  assert.notEqual(username, null);

  runtime.acceptPresenceCommand(
    createMetaverseJoinPresenceCommand({
      characterId: "mesh2motion-humanoid-v1",
      playerId,
      pose: {
        position: {
          x: 0,
          y: 1.62,
          z: 24
        },
        stateSequence: 1,
        yawRadians: 0
      },
      username
    }),
    0
  );

  const response = createResponseCapture();
  const commandBody = JSON.stringify(
    createMetaverseSyncMountedOccupancyCommand({
      mountedOccupancy: {
        environmentAssetId: "metaverse-hub-skiff-v1",
        entryId: null,
        occupancyKind: "seat",
        occupantRole: "driver",
        seatId: "driver-seat"
      },
      playerId
    })
  );
  const handled = await adapter.handleRequest(
    {
      method: "POST",
      on(eventName, listener) {
        if (eventName === "data") {
          listener(commandBody);
        }

        if (eventName === "end") {
          listener();
        }
      }
    },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world/commands"),
    100
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.type, "world-snapshot");
  assert.equal(response.json.world.players[0]?.locomotionMode, "mounted");
  assert.equal(
    response.json.world.players[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
});

test("MetaverseWorldHttpAdapter returns conflict for unknown observers", async () => {
  const adapter = new MetaverseWorldHttpAdapter(
    new MetaverseAuthoritativeWorldRuntime()
  );
  const response = createResponseCapture();
  const handled = await adapter.handleRequest(
    { method: "GET" },
    response,
    new URL("http://127.0.0.1:3210/metaverse/world?playerId=missing-player"),
    0
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 409);
  assert.equal(response.json.error, "Unknown metaverse player: missing-player");
});
