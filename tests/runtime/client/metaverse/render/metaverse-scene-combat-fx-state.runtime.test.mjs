import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

function countSceneChildrenByName(scene, name) {
  return scene.children.filter((child) => child.name === name).length;
}

function findObjectByName(object, name) {
  if (object.name === name) {
    return object;
  }

  for (const child of object.children ?? []) {
    const found = findObjectByName(child, name);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function createVector3(Vector3, input) {
  return new Vector3(input.x, input.y, input.z);
}

function assertObjectLiesOnSegment(Vector3, object, startInput, endInput) {
  const start = createVector3(Vector3, startInput);
  const end = createVector3(Vector3, endInput);
  const segment = end.clone().sub(start);
  const segmentLength = segment.length();

  assert.ok(segmentLength > 0);

  const direction = segment.multiplyScalar(1 / segmentLength);
  const centerOffset = object.position.clone().sub(start);
  const projectedMeters = centerOffset.dot(direction);
  const closestPoint = start.clone().addScaledVector(direction, projectedMeters);

  assert.ok(projectedMeters >= -0.0001);
  assert.ok(projectedMeters <= segmentLength + 0.0001);
  assert.ok(object.position.distanceTo(closestPoint) < 0.0001);
}

function assertCylinderAxisMatchesSegment(Vector3, cylinder, startInput, endInput) {
  const start = createVector3(Vector3, startInput);
  const end = createVector3(Vector3, endInput);
  const expectedDirection = end.clone().sub(start).normalize();
  const cylinderAxis = new Vector3(0, 1, 0)
    .applyQuaternion(cylinder.quaternion)
    .normalize();

  assert.ok(cylinderAxis.dot(expectedDirection) > 0.999);
}

test("MetaverseSceneCombatFxState keeps authoritative pistol tracers keyed", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const authoritativeTracerEvent = Object.freeze({
    actionSequence: 4,
    directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
    endWorld: Object.freeze({ x: 0, y: 1.25, z: -9 }),
    kind: "shot",
    originWorld: Object.freeze({ x: 0.2, y: 1.4, z: 0 }),
    playerId: "local-player",
    sequence: 4,
    shotFx: "pistol-tracer",
    source: "authoritative-shot-resolution",
    startedAtMs: 120,
    visualKey: "authoritative-shot-resolution:pistol-tracer:local-player:pistol:4",
    weaponId: "metaverse-service-pistol-v2"
  });

  combatFxState.triggerCombatPresentationEvent(authoritativeTracerEvent);
  combatFxState.triggerCombatPresentationEvent(authoritativeTracerEvent);

  assert.equal(countSceneChildrenByName(scene, "metaverse_combat_fx/muzzle_flash"), 1);
  assert.equal(countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_tracer"), 1);

  const tracerBody = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_tracer/body"
  );
  const tracerGlow = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_tracer/glow"
  );

  assert.notEqual(tracerBody, null);
  assert.notEqual(tracerGlow, null);
  assert.equal(tracerBody.type, "Mesh");
  assert.equal(tracerGlow.type, "Mesh");
  assert.equal(tracerBody.visible, true);
  assert.equal(tracerGlow.visible, true);
  assert.equal(tracerBody.material.depthTest, false);
  assert.equal(tracerGlow.material.depthTest, false);
});

test("MetaverseSceneCombatFxState animates pistol tracer slugs and expires them", async () => {
  const [{ Scene, Vector3 }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 7,
      directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
      endWorld: Object.freeze({ x: 0, y: 1.4, z: -20 }),
      kind: "shot",
      originWorld: Object.freeze({ x: 0, y: 1.4, z: 0 }),
      playerId: "local-player",
      sequence: 7,
      shotFx: "pistol-tracer",
      source: "authoritative-shot-resolution",
      startedAtMs: 100,
      visualKey: "authoritative-shot-resolution:pistol-tracer:local-player:pistol:7",
      weaponId: "metaverse-service-pistol-v2"
    })
  );

  const tracerBody = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_tracer/body"
  );

  assert.notEqual(tracerBody, null);
  assert.equal(tracerBody.type, "Mesh");
  assert.ok(tracerBody.scale.y > 0);
  assert.ok(tracerBody.scale.y <= 20);
  assertObjectLiesOnSegment(
    Vector3,
    tracerBody,
    { x: 0, y: 1.4, z: 0 },
    { x: 0, y: 1.4, z: -20 }
  );
  assertCylinderAxisMatchesSegment(
    Vector3,
    tracerBody,
    { x: 0, y: 1.4, z: 0 },
    { x: 0, y: 1.4, z: -20 }
  );

  combatFxState.syncProjectiles([], 160);
  assert.ok(tracerBody.position.z < 0);

  combatFxState.syncProjectiles([], 260);
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_tracer"),
    0
  );
});

test("MetaverseSceneCombatFxState ignores unspecified shot FX", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 4,
      directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
      kind: "shot",
      originWorld: Object.freeze({ x: 0.2, y: 1.4, z: 0 }),
      playerId: "local-player",
      sequence: 4,
      source: "authoritative-shot-resolution",
      startedAtMs: 100,
      visualKey: "authoritative-shot-resolution:unspecified:local-player:pistol:4",
      weaponId: "metaverse-service-pistol-v2"
    })
  );

  assert.equal(countSceneChildrenByName(scene, "metaverse_combat_fx/muzzle_flash"), 0);
  assert.equal(countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_tracer"), 0);
});

test("MetaverseSceneCombatFxState renders pistol world impacts without explosion slots", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 18,
      kind: "shot",
      originWorld: Object.freeze({ x: 0, y: 1.62, z: -1.2 }),
      playerId: "local-player",
      sequence: 18,
      shotFx: "pistol-world-impact",
      source: "authoritative-shot-resolution",
      startedAtMs: 100,
      visualKey: "authoritative-shot-resolution:pistol-world-impact:local-player:pistol:18",
      weaponId: "metaverse-service-pistol-v2"
    })
  );

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_world_impact"),
    1
  );
  const impact = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_world_impact"
  );
  const impactCore = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_world_impact/core"
  );
  const impactDust = findObjectByName(
    scene,
    "metaverse_combat_fx/pistol_world_impact/dust"
  );

  assert.notEqual(impact, null);
  assert.notEqual(impactCore, null);
  assert.notEqual(impactDust, null);
  assert.equal(impact.position.y > 1.62, true);
  assert.equal(impactCore.material.depthTest, false);
  assert.equal(impactDust.material.depthTest, false);
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_explosion"),
    0
  );
});

test("MetaverseSceneCombatFxState updates one rocket visual and emits event-owned resolved explosion", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const projectileBase = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_000,
    ownerPlayerId: "rocket-owner",
    position: Object.freeze({ x: 0, y: 1.4, z: -2 }),
    projectileId: "rocket-owner:8",
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 8,
    spawnedAtTimeMs: 1_000,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 8,
      directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
      kind: "shot",
      originWorld: Object.freeze({ x: 0, y: 1.4, z: 0 }),
      playerId: "rocket-owner",
      projectileId: "rocket-owner:8",
      sequence: 8,
      shotFx: "rocket-muzzle",
      source: "authoritative-projectile",
      startedAtMs: 90,
      visualKey: "authoritative-projectile:rocket-muzzle:rocket-owner:8",
      weaponId: "metaverse-rocket-launcher-v1"
    })
  );
  combatFxState.syncProjectiles(
    [
      Object.freeze({
        ...projectileBase,
        resolution: "active"
      })
    ],
    100
  );
  combatFxState.syncProjectiles(
    [
      Object.freeze({
        ...projectileBase,
        position: Object.freeze({ x: 0, y: 1.4, z: -4 }),
        resolution: "active"
      })
    ],
    120
  );

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    1
  );

  const resolvedProjectile = Object.freeze({
    ...projectileBase,
    position: Object.freeze({ x: 0, y: 1.4, z: -5 }),
    resolution: "hit-world",
    resolvedAtTimeMs: 1_200
  });

  combatFxState.syncProjectiles([resolvedProjectile], 150);
  combatFxState.syncProjectiles([resolvedProjectile], 160);

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    0
  );
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_explosion"),
    0
  );
  combatFxState.triggerCombatPresentationEvent({
    actionSequence: 8,
    kind: "projectile-impact",
    originWorld: Object.freeze({ x: 0, y: 1.4, z: -5 }),
    playerId: "rocket-owner",
    projectileId: "rocket-owner:8",
    sequence: 9,
    source: "authoritative-projectile-resolution",
    startedAtMs: 170,
    visualKey: "authoritative-projectile-resolution:rocket-owner:8",
    weaponId: "metaverse-rocket-launcher-v1"
  });
  combatFxState.triggerCombatPresentationEvent({
    actionSequence: 8,
    kind: "projectile-impact",
    originWorld: Object.freeze({ x: 0, y: 1.4, z: -5 }),
    playerId: "rocket-owner",
    projectileId: "rocket-owner:8",
    sequence: 9,
    source: "authoritative-projectile-resolution",
    startedAtMs: 180,
    visualKey: "authoritative-projectile-resolution:rocket-owner:8",
    weaponId: "metaverse-rocket-launcher-v1"
  });
  combatFxState.triggerCombatPresentationEvent({
    actionSequence: 8,
    kind: "projectile-impact",
    originWorld: Object.freeze({ x: 0, y: 1.4, z: -5 }),
    playerId: "rocket-owner",
    projectileId: "rocket-owner:8",
    sequence: 10,
    source: "authoritative-projectile-resolution",
    startedAtMs: 190,
    visualKey: "authoritative-projectile-resolution:rocket-owner:8:replayed",
    weaponId: "metaverse-rocket-launcher-v1"
  });
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_explosion"),
    1
  );
});

test("MetaverseSceneCombatFxState keeps a close rocket launch visible without active snapshots", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 18,
      directionWorld: Object.freeze({ x: 0, y: -0.94, z: -0.34 }),
      endWorld: Object.freeze({ x: 0, y: 0.05, z: -0.55 }),
      kind: "shot",
      originWorld: Object.freeze({ x: 0, y: 1.3, z: -0.08 }),
      playerId: "rocket-owner",
      projectileId: "rocket-owner:close-feet",
      sequence: 18,
      shotFx: "rocket-muzzle",
      source: "authoritative-projectile",
      startedAtMs: 100,
      visualKey: "authoritative-projectile:rocket-muzzle:rocket-owner:close-feet",
      weaponId: "metaverse-rocket-launcher-v1"
    })
  );
  combatFxState.syncProjectiles([], 110);

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    0
  );
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_launch_projectile"),
    1
  );

  const rocketBody = findObjectByName(
    scene,
    "metaverse_combat_fx/rocket_launch_projectile/body"
  );
  const rocketTrail = findObjectByName(
    scene,
    "metaverse_combat_fx/rocket_launch_projectile/trail"
  );

  assert.notEqual(rocketBody, null);
  assert.notEqual(rocketTrail, null);
  assert.equal(rocketBody.visible, true);
  assert.equal(rocketTrail.visible, true);
  assert.equal(rocketBody.material.depthTest, false);
  assert.equal(rocketTrail.material.depthTest, false);

  combatFxState.syncProjectiles([], 240);
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_launch_projectile"),
    0
  );
});

test("MetaverseSceneCombatFxState removes expired rockets without explosion slots", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const projectileBase = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_000,
    ownerPlayerId: "rocket-owner",
    position: Object.freeze({ x: 0, y: 1.4, z: -2 }),
    projectileId: "rocket-owner:expired",
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 8,
    spawnedAtTimeMs: 1_000,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatFxState.syncProjectiles(
    [
      Object.freeze({
        ...projectileBase,
        resolution: "active"
      })
    ],
    100
  );
  combatFxState.syncProjectiles(
    [
      Object.freeze({
        ...projectileBase,
        resolution: "expired",
        resolvedAtTimeMs: 1_200
      })
    ],
    150
  );

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    0
  );
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_explosion"),
    0
  );
});

test("MetaverseSceneCombatFxState self-heals active rockets from projectile snapshots without launch events", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const projectile = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_000,
    ownerPlayerId: "rocket-owner",
    position: Object.freeze({ x: 0.1, y: 1.34, z: -3.1 }),
    projectileId: "rocket-owner:launch-bridge",
    resolution: "active",
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 8,
    spawnedAtTimeMs: 1_000,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatFxState.syncProjectiles([projectile], 100);

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    1
  );
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_tracer"),
    0
  );

  combatFxState.syncProjectiles([projectile], 180);

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    1
  );
  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/pistol_tracer"),
    0
  );
});

test("MetaverseSceneCombatFxState prefers rocket launch bridge origin from projectile launch event", async () => {
  const [{ Scene, Vector3 }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const projectileId = "rocket-owner:launch-event-bridge";
  const launchBridgeOrigin = Object.freeze({ x: 0.35, y: 1.52, z: -0.05 });
  const projectile = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_000,
    ownerPlayerId: "rocket-owner",
    position: Object.freeze({ x: 0.1, y: 1.34, z: -3.1 }),
    projectileId,
    resolution: "active",
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 8,
    spawnedAtTimeMs: 1_000,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 8,
      directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
      kind: "shot",
      originWorld: launchBridgeOrigin,
      playerId: "rocket-owner",
      projectileId,
      sequence: 8,
      shotFx: "rocket-muzzle",
      source: "authoritative-projectile",
      startedAtMs: 90,
      visualKey: "authoritative-projectile:rocket-muzzle:rocket-owner",
      weaponId: "metaverse-rocket-launcher-v1"
    })
  );
  combatFxState.syncProjectiles([projectile], 100);

  const rocketBody = findObjectByName(
    scene,
    "metaverse_combat_fx/rocket_projectile/body"
  );

  assert.notEqual(rocketBody, null);
  assert.equal(rocketBody.position.x, launchBridgeOrigin.x);
  assert.equal(rocketBody.position.y, launchBridgeOrigin.y);
  assert.equal(rocketBody.position.z, launchBridgeOrigin.z);

  combatFxState.syncProjectiles([projectile], 140);
  assertObjectLiesOnSegment(
    Vector3,
    rocketBody,
    launchBridgeOrigin,
    projectile.position
  );
});

test("MetaverseSceneCombatFxState starts rocket bridge from launch event when a snapshot arrived first", async () => {
  const [{ Scene }, { MetaverseSceneCombatFxState }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/combat/metaverse-scene-combat-fx-state.ts"
    )
  ]);
  const scene = new Scene();
  const combatFxState = new MetaverseSceneCombatFxState({
    scene
  });
  const projectileId = "rocket-owner:late-launch-event-bridge";
  const launchBridgeOrigin = Object.freeze({ x: 0.35, y: 1.52, z: -0.05 });
  const projectile = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0, z: -1 }),
    expiresAtTimeMs: 7_000,
    ownerPlayerId: "rocket-owner",
    position: Object.freeze({ x: 0.1, y: 1.34, z: -3.1 }),
    projectileId,
    resolution: "active",
    resolvedAtTimeMs: null,
    resolvedHitZone: null,
    resolvedPlayerId: null,
    sourceActionSequence: 8,
    spawnedAtTimeMs: 1_000,
    velocityMetersPerSecond: 70,
    weaponId: "metaverse-rocket-launcher-v1"
  });

  combatFxState.syncProjectiles([projectile], 100);

  assert.equal(
    countSceneChildrenByName(scene, "metaverse_combat_fx/rocket_projectile"),
    1
  );
  combatFxState.triggerCombatPresentationEvent(
    Object.freeze({
      actionSequence: 8,
      directionWorld: Object.freeze({ x: 0, y: 0, z: -1 }),
      kind: "shot",
      originWorld: launchBridgeOrigin,
      playerId: "rocket-owner",
      projectileId,
      sequence: 8,
      shotFx: "rocket-muzzle",
      source: "authoritative-projectile",
      startedAtMs: 104,
      visualKey: "authoritative-projectile:rocket-muzzle:rocket-owner:late",
      weaponId: "metaverse-rocket-launcher-v1"
    })
  );
  combatFxState.syncProjectiles([projectile], 104);

  const rocketBody = findObjectByName(
    scene,
    "metaverse_combat_fx/rocket_projectile/body"
  );

  assert.notEqual(rocketBody, null);
  assert.equal(rocketBody.position.x, launchBridgeOrigin.x);
  assert.equal(rocketBody.position.y, launchBridgeOrigin.y);
  assert.equal(rocketBody.position.z, launchBridgeOrigin.z);
});
