import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  createMetaverseGameplayTraversalIntentSnapshotInput,
  createMetaversePlayerId,
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  createUsername
} from "@webgpu-metaverse/shared";

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
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    readWorldClient: () => worldClient
  });

  const previewSnapshot = commandTransport.previewLocalTraversalIntent(
    createMetaverseGameplayTraversalIntentSnapshotInput({
      boost: true,
      jump: true,
      locomotionMode: "grounded",
      moveAxis: 1,
      pitchRadians: 0.2,
      strafeAxis: -0.25,
      turnAxis: 0.5,
      yawRadians: 1.3
    })
  );
  const syncedSnapshot = commandTransport.syncLocalTraversalIntent(
    createMetaverseGameplayTraversalIntentSnapshotInput({
      boost: true,
      jump: true,
      locomotionMode: "grounded",
      moveAxis: 1,
      pitchRadians: 0.2,
      strafeAxis: -0.25,
      turnAxis: 0.5,
      yawRadians: 1.3
    })
  );

  commandTransport.syncLocalPlayerLook({
    pitchRadians: 0.1,
    yawRadians: 0.8
  });
  commandTransport.syncLocalPlayerWeaponState(
    createMetaverseRealtimePlayerWeaponStateSnapshot({
      aimMode: "ads",
      slots: [
        {
          attachmentId: "duck-hunt-pistol",
          equipped: true,
          slotId: "primary",
          weaponId: "duck-hunt-pistol",
          weaponInstanceId: "test-player:primary:duck-hunt-pistol"
        }
      ],
      weaponId: "duck-hunt-pistol"
    })
  );
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
  assert.equal(syncedSnapshot?.actionIntent.kind, "jump");
  assert.equal(syncedSnapshot?.sequence, 1);
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
    worldClient.playerWeaponStateRequests[0]?.weaponState?.aimMode,
    "ads"
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
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    readWorldClient: () => worldClient
  });

  assert.equal(
    commandTransport.syncLocalTraversalIntent(
      createMetaverseGameplayTraversalIntentSnapshotInput({
        boost: false,
        jump: true,
        locomotionMode: null,
        moveAxis: 1,
        pitchRadians: 0,
        strafeAxis: 0,
        turnAxis: 0,
        yawRadians: 0
      })
    ),
    null
  );
  commandTransport.syncLocalPlayerLook(null);
  commandTransport.syncLocalPlayerWeaponState(null);

  assert.equal(worldClient.playerTraversalIntentRequests[0], null);
  assert.equal(worldClient.playerLookIntentRequests[0], null);
  assert.equal(worldClient.playerWeaponStateRequests[0]?.playerId, localPlayerId);
  assert.equal(worldClient.playerWeaponStateRequests[0]?.weaponState, null);
});

test("MetaverseRemoteWorldCommandTransport derives switch weapon instance ids from the local player", async () => {
  const { MetaverseRemoteWorldCommandTransport } = await clientLoader.load(
    "/src/metaverse/remote-world/metaverse-remote-world-command-transport.ts"
  );
  const localPlayerId = createMetaversePlayerId("rocket-switch-pilot");
  const username = createUsername("Rocket Switch Pilot");
  const issuedActions = [];
  const worldClient = {
    issuePlayerAction(commandInput) {
      issuedActions.push(commandInput);
      return 12;
    }
  };
  const commandTransport = new MetaverseRemoteWorldCommandTransport({
    localPlayerIdentity: {
      characterId: "mesh2motion-humanoid-v1",
      playerId: localPlayerId,
      username
    },
    readEstimatedServerTimeMs: () => 1_250,
    readWallClockMs: () => 250,
    readWorldClient: () => worldClient
  });

  const switchIssue = commandTransport.switchActiveWeaponSlot({
    intendedWeaponId: "metaverse-rocket-launcher-v1",
    intendedWeaponInstanceId: "local:secondary:metaverse-rocket-launcher-v1",
    requestedActiveSlotId: "secondary"
  });

  assert.equal(switchIssue?.actionSequence, 12);
  assert.equal(
    issuedActions[0]?.action.intendedWeaponInstanceId,
    `${localPlayerId}:secondary:metaverse-rocket-launcher-v1`
  );
  assert.equal(issuedActions[0]?.action.kind, "switch-active-weapon-slot");
  assert.equal(issuedActions[0]?.action.requestedActiveSlotId, "secondary");

  const interactIssue = commandTransport.interactWeaponResource({
    intendedWeaponInstanceId:
      `${localPlayerId}:secondary:metaverse-rocket-launcher-v1`,
    requestedActiveSlotId: "secondary"
  });

  assert.equal(interactIssue?.actionSequence, 12);
  assert.equal(issuedActions[1]?.action.kind, "interact-weapon-resource");
  assert.equal(
    issuedActions[1]?.action.intendedWeaponInstanceId,
    `${localPlayerId}:secondary:metaverse-rocket-launcher-v1`
  );
  assert.equal(issuedActions[1]?.action.requestedActiveSlotId, "secondary");
});
