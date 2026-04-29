import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  deathmatchMapBundle,
  resolveMetaverseMapPlayerSpawnNode,
  resolveMetaverseMapPlayerSpawnSupportPosition,
  resolveMetaversePlayerTeamId
} from "@webgpu-metaverse/shared/metaverse/world";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseTeamDeathmatchLocalPlayerIdentity keeps client spawn on the authoritative team lane", async () => {
  const {
    createMetaverseLocalPlayerIdentity,
    createMetaverseTeamDeathmatchLocalPlayerIdentity
  } = await clientLoader.load("/src/metaverse/config/metaverse-presence-network.ts");
  const { createMetaverseRuntimeConfig } = await clientLoader.load(
    "/src/metaverse/config/metaverse-runtime.ts"
  );
  const characterId = "mesh2motion-humanoid-v1";
  const freeRoamIdentity = createMetaverseLocalPlayerIdentity(
    "TDM Startup Pilot",
    characterId
  );
  const teamDeathmatchIdentity = createMetaverseTeamDeathmatchLocalPlayerIdentity(
    "TDM Startup Pilot",
    characterId
  );
  const expectedTeamId = resolveMetaversePlayerTeamId(
    teamDeathmatchIdentity.playerId
  );
  const expectedSpawnNode = resolveMetaverseMapPlayerSpawnNode({
    occupiedPlayerSnapshots: Object.freeze([]),
    playerId: teamDeathmatchIdentity.playerId,
    playerSpawnNodes: deathmatchMapBundle.playerSpawnNodes,
    playerSpawnSelection: deathmatchMapBundle.playerSpawnSelection,
    playerTeamId: expectedTeamId
  });

  assert.equal(freeRoamIdentity.teamId, undefined);
  assert.equal(teamDeathmatchIdentity.teamId, expectedTeamId);
  assert.notEqual(expectedSpawnNode, null);

  const expectedSpawnPosition = resolveMetaverseMapPlayerSpawnSupportPosition({
    compiledWorld: deathmatchMapBundle.compiledWorld,
    spawnPosition: expectedSpawnNode.position
  });
  const runtimeConfig = createMetaverseRuntimeConfig(
    "deathmatch",
    teamDeathmatchIdentity.playerId,
    teamDeathmatchIdentity.teamId
  );

  assert.deepEqual(runtimeConfig.groundedBody.spawnPosition, expectedSpawnPosition);
  assert.equal(runtimeConfig.camera.initialYawRadians, expectedSpawnNode.yawRadians);
});
