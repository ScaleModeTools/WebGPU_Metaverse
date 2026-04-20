import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createHumanoidV2CharacterScene } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

function assertQuaternionArraysEquivalent(actual, expected, tolerance, message) {
  assert.equal(actual.length, expected.length, `${message} length mismatch.`);

  let maxDirectDelta = 0;
  let maxNegatedDelta = 0;

  for (let index = 0; index < actual.length; index += 1) {
    maxDirectDelta = Math.max(maxDirectDelta, Math.abs(actual[index] - expected[index]));
    maxNegatedDelta = Math.max(maxNegatedDelta, Math.abs(actual[index] + expected[index]));
  }

  assert.ok(
    Math.min(maxDirectDelta, maxNegatedDelta) <= tolerance,
    `${message}: expected ${expected.join(",")}, received ${actual.join(",")}.`
  );
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("createMetaverseScene separates deck boarding from direct seat entry on a dynamic environment asset", async () => {
  const [
    {
      AnimationClip,
      Bone,
      BoxGeometry,
      Float32BufferAttribute,
      Group,
      Mesh,
      MeshStandardMaterial,
      Quaternion,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute,
      Vector3
    },
    { createMetaverseScene },
    { metaverseRuntimeConfig },
    { resolveEnvironmentSimulationYawFromRenderYaw }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts"),
    clientLoader.load("/src/metaverse/traversal/presentation/mount-presentation.ts")
  ]);
  const { characterScene, socketNames } = createHumanoidV2CharacterScene({
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    MeshStandardMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3
  });

  const idleClip = new AnimationClip("idle", -1, []);
  const walkClip = new AnimationClip("walk", -1, []);
  const skiffScene = new Group();
  const skiffHull = new Mesh(
    new BoxGeometry(5.8, 0.6, 2.4),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const deckEntry = new Group();
  const driverSeat = new Group();
  const portBenchSeat = new Group();
  const portBenchRearSeat = new Group();
  const starboardBenchSeat = new Group();
  const starboardBenchRearSeat = new Group();

  skiffHull.position.y = 0.3;
  deckEntry.name = "deck_entry";
  deckEntry.position.set(-2.12, 1, 0);
  driverSeat.name = "driver_seat";
  driverSeat.position.set(1.32, 1, 0);
  driverSeat.rotation.y = Math.PI * 0.5;
  portBenchSeat.name = "port_bench_seat";
  portBenchSeat.position.set(0.65, 1, -0.72);
  portBenchRearSeat.name = "port_bench_rear_seat";
  portBenchRearSeat.position.set(-0.65, 1, -0.72);
  starboardBenchSeat.name = "starboard_bench_seat";
  starboardBenchSeat.position.set(0.65, 1, 0.72);
  starboardBenchSeat.rotation.y = Math.PI;
  starboardBenchRearSeat.name = "starboard_bench_rear_seat";
  starboardBenchRearSeat.position.set(-0.65, 1, 0.72);
  starboardBenchRearSeat.rotation.y = Math.PI;
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(
    skiffHull,
    deckEntry,
    driverSeat,
    portBenchSeat,
    portBenchRearSeat,
    starboardBenchSeat,
    starboardBenchRearSeat
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
          vocabulary: "walk"
        }
      ],
      characterId: "mesh2motion-humanoid-v1",
      label: "Mesh2Motion humanoid",
      modelPath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
      skeletonId: "humanoid_v2",
      socketNames
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/environment/metaverse-hub-skiff.gltf") {
          return {
            animations: [],
            scene: skiffScene
          };
        }

        return {
          animations: [idleClip, walkClip],
          scene: characterScene
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collisionPath: "/models/metaverse/environment/metaverse-hub-skiff-collision.gltf",
          collider: {
            center: { x: 0, y: 1, z: 0 },
            shape: "box",
            size: { x: 6.2, y: 2.4, z: 3.2 }
          },
          environmentAssetId: "metaverse-hub-skiff-v1",
          label: "Metaverse hub skiff",
          lods: [
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-skiff.gltf",
              tier: "high"
            }
          ],
          orientation: {
            forwardModelYawRadians: Math.PI * 0.5
          },
          placement: "dynamic",
          placements: [
            {
              position: { x: 11.5, y: 0.1, z: -14.2 },
              rotationYRadians: Math.PI * 0.8,
              scale: 1
            }
          ],
          physicsColliders: null,
          entries: [
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              dismountOffset: { x: 0, y: 0, z: 1.2 },
              entryId: "deck-entry",
              entryNodeName: "deck_entry",
              label: "Board deck",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "standing",
              occupantRole: "passenger"
            }
          ],
          seats: [
            {
              cameraPolicyId: "vehicle-follow",
              controlRoutingPolicyId: "vehicle-surface-drive",
              directEntryEnabled: true,
              dismountOffset: { x: 0, y: 0, z: 1 },
              label: "Take helm",
              lookLimitPolicyId: "driver-forward",
              occupancyAnimationId: "seated",
              seatId: "driver-seat",
              seatNodeName: "driver_seat",
              seatRole: "driver"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat",
              seatNodeName: "port_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Port bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "port-bench-seat-rear",
              seatNodeName: "port_bench_rear_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench front",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat",
              seatNodeName: "starboard_bench_seat",
              seatRole: "passenger"
            },
            {
              cameraPolicyId: "seat-follow",
              controlRoutingPolicyId: "look-only",
              directEntryEnabled: false,
              dismountOffset: { x: 0, y: 0, z: 0.8 },
              label: "Starboard bench rear",
              lookLimitPolicyId: "passenger-bench",
              occupancyAnimationId: "seated",
              seatId: "starboard-bench-seat-rear",
              seatNodeName: "starboard_bench_rear_seat",
              seatRole: "passenger"
            }
          ],
          traversalAffordance: "mount"
        }
      ]
    },
    warn() {}
  });

  await sceneRuntime.boot();

  const cameraSnapshot = {
    lookDirection: { x: 0, y: 0, z: -1 },
    pitchRadians: 0,
    position: { x: 11.5, y: 1.2, z: -14.2 },
    yawRadians: 0
  };
  const characterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1"
  );
  const originalParent = characterRoot.parent;
  const originalWorldPosition = characterRoot.getWorldPosition(new Vector3());
  const originalWorldQuaternion = characterRoot.getWorldQuaternion(new Quaternion());

  const initialInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0
  );

  assert.equal(
    initialInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(initialInteractionSnapshot.focusedMountable?.boardingEntries.length, 1);
  assert.equal(initialInteractionSnapshot.focusedMountable?.directSeatTargets.length, 1);
  assert.equal("mountedEnvironment" in initialInteractionSnapshot, false);

  const passengerSeatMountedEnvironment = sceneRuntime.resolveSeatOccupancy(
    cameraSnapshot,
    "port-bench-seat"
  );
  const passengerSeatInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    passengerSeatMountedEnvironment
  );

  assert.equal(passengerSeatInteractionSnapshot.focusedMountable, null);
  assert.equal("mountedEnvironment" in passengerSeatInteractionSnapshot, false);
  assert.equal(
    characterRoot.parent?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/port-bench-seat"
  );

  const boardedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    null
  );

  assert.equal("mountedEnvironment" in boardedInteractionSnapshot, false);
  assert.equal(
    boardedInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );

  const boardedMountedEnvironment = sceneRuntime.resolveBoardFocusedMountable(
    cameraSnapshot
  );
  const mountedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    boardedMountedEnvironment
  );

  assert.equal(mountedInteractionSnapshot.focusedMountable, null);
  assert.equal("mountedEnvironment" in mountedInteractionSnapshot, false);
  assert.equal(boardedMountedEnvironment?.environmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(boardedMountedEnvironment?.occupancyKind, "entry");
  assert.equal(boardedMountedEnvironment?.entryId, "deck-entry");
  assert.equal(boardedMountedEnvironment?.seatId, null);
  assert.equal(boardedMountedEnvironment?.directSeatTargets.length, 1);
  assert.equal(boardedMountedEnvironment?.seatTargets.length, 5);
  assert.equal(characterRoot.parent, originalParent);
  assert.ok(
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) <
      0.000001
  );
  assertQuaternionArraysEquivalent(
    characterRoot.getWorldQuaternion(new Quaternion()).toArray(),
    originalWorldQuaternion.toArray(),
    0.000001,
    "Standing deck boarding should keep the character free-roaming instead of seat-mounting it"
  );

  const driverSeatMountedEnvironment = sceneRuntime.resolveSeatOccupancy(
    cameraSnapshot,
    "driver-seat"
  );
  const driverSeatInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    driverSeatMountedEnvironment
  );

  assert.equal(driverSeatInteractionSnapshot.focusedMountable, null);
  assert.equal("mountedEnvironment" in driverSeatInteractionSnapshot, false);
  assert.equal(driverSeatMountedEnvironment?.occupancyKind, "seat");
  assert.equal(driverSeatMountedEnvironment?.seatId, "driver-seat");
  assert.equal(driverSeatMountedEnvironment?.occupantRole, "driver");
  assert.equal(
    characterRoot.parent?.name,
    "metaverse_environment_seat_anchor/metaverse-hub-skiff-v1/driver-seat"
  );

  sceneRuntime.scene.updateMatrixWorld(true);
  const mountedEnvironmentSeatSocket = characterRoot.parent;
  const mountedCharacterSeatSocket = characterRoot.getObjectByName("seat_socket");
  const mountedSkiffRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_asset/metaverse-hub-skiff-v1"
  );

  assert.ok(mountedEnvironmentSeatSocket);
  assert.ok(mountedCharacterSeatSocket);
  assert.ok(mountedSkiffRoot);
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );
  const mountedCharacterForward = new Vector3(0, 0, 1)
    .applyQuaternion(characterRoot.getWorldQuaternion(new Quaternion()))
    .normalize();
  const mountedSkiffSimulationYawRadians =
    resolveEnvironmentSimulationYawFromRenderYaw(
      {
        orientation: {
          forwardModelYawRadians: Math.PI * 0.5
        }
      },
      mountedSkiffRoot.rotation.y
    );
  const mountedSkiffForward = new Vector3(
    Math.sin(mountedSkiffSimulationYawRadians),
    0,
    -Math.cos(mountedSkiffSimulationYawRadians)
  ).normalize();
  const mountedCharacterLocalQuaternion = characterRoot.quaternion.clone();

  assert.ok(mountedCharacterForward.angleTo(mountedSkiffForward) < 0.001);

  const mountedSeatWorldPosition = mountedEnvironmentSeatSocket.getWorldPosition(
    new Vector3()
  );
  const mountedCharacterWorldPosition = characterRoot.getWorldPosition(
    new Vector3()
  );

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    1000,
    0.016,
    null,
    [],
    driverSeatMountedEnvironment
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const bobbedSeatWorldPosition = mountedEnvironmentSeatSocket.getWorldPosition(
    new Vector3()
  );
  const bobbedCharacterWorldPosition = characterRoot.getWorldPosition(
    new Vector3()
  );

  assert.ok(
    Math.abs(bobbedSeatWorldPosition.y - mountedSeatWorldPosition.y) > 0.05
  );
  assert.ok(
    Math.abs(bobbedCharacterWorldPosition.y - mountedCharacterWorldPosition.y) >
      0.05
  );
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  sceneRuntime.setDynamicEnvironmentPose("metaverse-hub-skiff-v1", {
    position: { x: 11.5, y: 0.1, z: -14.2 },
    yawRadians: 0.55
  });
  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0.016,
    null,
    [],
    driverSeatMountedEnvironment
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );
  const turnedCharacterForward = new Vector3(0, 0, 1)
    .applyQuaternion(characterRoot.getWorldQuaternion(new Quaternion()))
    .normalize();
  const turnedSkiffSimulationYawRadians =
    resolveEnvironmentSimulationYawFromRenderYaw(
      {
        orientation: {
          forwardModelYawRadians: Math.PI * 0.5
        }
      },
      mountedSkiffRoot.rotation.y
    );
  const turnedSkiffForward = new Vector3(
    Math.sin(turnedSkiffSimulationYawRadians),
    0,
    -Math.cos(turnedSkiffSimulationYawRadians)
  ).normalize();

  assert.ok(turnedCharacterForward.angleTo(turnedSkiffForward) < 0.001);
  assert.ok(
    characterRoot.quaternion.angleTo(mountedCharacterLocalQuaternion) < 0.001
  );

  const dismountedInteractionSnapshot = sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    0,
    0,
    null,
    [],
    null
  );

  assert.equal("mountedEnvironment" in dismountedInteractionSnapshot, false);
  assert.equal(
    dismountedInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(characterRoot.parent, originalParent);
  assert.ok(
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) <
      0.001
  );
  assert.ok(
    characterRoot.getWorldQuaternion(new Quaternion()).angleTo(originalWorldQuaternion) <
      0.001
  );
});
