import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createMetaversePlayerId, createUsername } from "@webgpu-metaverse/shared";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { FakeMetaverseWorldClient } from "../runtime/fixtures/fake-world-client.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("MetaverseRemoteWorldCommandTransport adapts grounded traversal, look, mounted occupancy, and driver control into world-client commands", async () => {
  const { MetaverseRemoteWorldCommandTransport } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-command-transport.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");
  const worldClient = new FakeMetaverseWorldClient();
  const commandTransport = new MetaverseRemoteWorldCommandTransport({
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username
    },
    readWorldClient: () => worldClient
  });

  const previewSnapshot = commandTransport.previewLocalTraversalIntent(
    {
      boost: true,
      jump: true,
      moveAxis: 1,
      strafeAxis: -0.25,
      yawAxis: 0.5
    },
    {
      pitchRadians: 0.2,
      yawRadians: 1.3
    },
    "grounded"
  );
  const syncedSnapshot = commandTransport.syncLocalTraversalIntent(
    {
      boost: true,
      jump: true,
      moveAxis: 1,
      strafeAxis: -0.25,
      yawAxis: 0.5
    },
    {
      pitchRadians: 0.2,
      yawRadians: 1.3
    },
    "grounded"
  );

  commandTransport.syncLocalPlayerLook({
    pitchRadians: 0.1,
    yawRadians: 0.8
  });
  commandTransport.syncMountedOccupancy({
    entryId: null,
    environmentAssetId: "harbor-skiff",
    occupancyKind: "seat",
    occupantRole: "driver",
    seatId: "driver-seat"
  });
  commandTransport.syncLocalDriverVehicleControl({
    controlIntent: {
      boost: true,
      moveAxis: 1,
      strafeAxis: 0,
      yawAxis: -0.4
    },
    environmentAssetId: "harbor-skiff"
  });

  assert.equal(previewSnapshot?.actionIntent.kind, "jump");
  assert.equal(previewSnapshot?.facing.yawRadians, 1.3);
  assert.equal(syncedSnapshot?.actionIntent.kind, "jump");
  assert.equal(syncedSnapshot?.inputSequence, 1);
  assert.equal(
    worldClient.playerTraversalIntentRequests[0]?.playerId,
    localPlayerId
  );
  assert.equal(
    worldClient.playerTraversalIntentRequests[0]?.intent.bodyControl.moveAxis,
    1
  );
  assert.equal(
    worldClient.playerLookIntentRequests[0]?.lookIntent.yawRadians,
    0.8
  );
  assert.equal(
    worldClient.mountedOccupancyRequests[0]?.mountedOccupancy?.seatId,
    "driver-seat"
  );
  assert.equal(
    worldClient.driverVehicleControlRequests[0]?.controlIntent.environmentAssetId,
    "harbor-skiff"
  );
});

test("MetaverseRemoteWorldCommandTransport clears traversal/look lanes when the local state is not authority-routed", async () => {
  const { MetaverseRemoteWorldCommandTransport } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-command-transport.ts"
  );
  const localPlayerId = createMetaversePlayerId("harbor-pilot-1");
  const username = createUsername("Harbor Pilot");
  const worldClient = new FakeMetaverseWorldClient();
  const commandTransport = new MetaverseRemoteWorldCommandTransport({
    localPlayerIdentity: {
      characterId: "metaverse-mannequin-v1",
      playerId: localPlayerId,
      username
    },
    readWorldClient: () => worldClient
  });

  assert.equal(
    commandTransport.syncLocalTraversalIntent(
      {
        boost: false,
        jump: true,
        moveAxis: 1,
        strafeAxis: 0,
        yawAxis: 0
      },
      {
        pitchRadians: 0,
        yawRadians: 0
      },
      "mounted"
    ),
    null
  );
  commandTransport.syncLocalPlayerLook(null);

  assert.equal(worldClient.playerTraversalIntentRequests[0], null);
  assert.equal(worldClient.playerLookIntentRequests[0], null);
});
