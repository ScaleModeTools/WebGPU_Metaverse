import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createHumanoidV2CharacterScene } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

function wrapRadians(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function resolveCharacterRenderYawRadians(yawRadians) {
  return wrapRadians(Math.PI - yawRadians);
}

function assertCharacterRenderYawFacesMetaverseYaw(rotationY, yawRadians) {
  assert.ok(Math.abs(Math.sin(rotationY) - Math.sin(yawRadians)) < 0.000001);
  assert.ok(Math.abs(Math.cos(rotationY) + Math.cos(yawRadians)) < 0.000001);
}

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

test("createMetaverseScene boots one manifest-driven character and hand socket attachment proof slice", async () => {
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
      QuaternionKeyframeTrack,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute,
      Vector3,
      VectorKeyframeTrack
    },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const authoredAnimationPackPath =
    "/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb";
  const loadPaths = [];
  const warnings = [];
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

  const idleClip = new AnimationClip("idle", -1, [
    new VectorKeyframeTrack("root.position", [0, 1], [0, 0, 0, 0, 0.05, 0]),
    new QuaternionKeyframeTrack("spine_03.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.08).toArray()
    ]),
    new QuaternionKeyframeTrack("hand_r.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3).toArray()
    ])
  ]);
  const walkClip = new AnimationClip("walk", -1, []);
  const aimClip = new AnimationClip("aim", -1, []);
  const interactClip = new AnimationClip("interact", -1, []);
  const seatedClip = new AnimationClip("seated", -1, []);
  const animationPackScene = new Group();
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );
  const gripHandSocket = new Group();
  const supportMarker = new Group();
  const triggerMarker = new Group();
  const backSocket = new Group();

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  gripHandSocket.name = "metaverse_service_pistol_grip_hand_r_socket";
  gripHandSocket.position.set(-0.01, 0.02, -0.03);
  supportMarker.name = "metaverse_service_pistol_support_marker";
  supportMarker.position.set(0.018, -0.137, 0);
  triggerMarker.name = "metaverse_service_pistol_trigger_marker";
  triggerMarker.position.set(0.026, 0.012, 0.004);
  backSocket.name = "metaverse_service_pistol_back_socket";
  backSocket.position.set(0.12, -0.04, 0.03);
  backSocket.quaternion.set(0, 0.7071067811865475, -0.7071067811865476, 0);
  attachmentScene.add(
    attachmentMesh,
    gripHandSocket,
    supportMarker,
    triggerMarker,
    backSocket
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_grip_hand_r_socket",
        socketName: "palm_r_socket",
        supportMarkerNodeName: "metaverse_service_pistol_support_marker",
        triggerMarkerNodeName: "metaverse_service_pistol_trigger_marker"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
      mountedHolsterMount: {
        attachmentSocketNodeName: "metaverse_service_pistol_back_socket",
        socketName: "back_socket"
      },
      supportPoints: null
    },
    characterProofConfig: {
      animationClips: [
        {
          clipName: "idle",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "idle"
        },
        {
          clipName: "walk",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "walk"
        },
        {
          clipName: "aim",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "aim"
        },
        {
          clipName: "interact",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "interact"
        },
        {
          clipName: "seated",
          sourcePath: authoredAnimationPackPath,
          vocabulary: "seated"
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
        loadPaths.push(path);

        if (path === "/models/metaverse/attachments/metaverse-service-pistol.gltf") {
          return {
            animations: [],
            scene: attachmentScene
          };
        }

        if (path === authoredAnimationPackPath) {
          return {
            animations: [idleClip, walkClip, aimClip, interactClip, seatedClip],
            scene: animationPackScene
          };
        }

        return {
          animations: [],
          scene: characterScene
        };
      }
    }),
    warn(message) {
      warnings.push(message);
    }
  });

  await sceneRuntime.boot();

  const characterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1"
  );

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/mesh2motion-humanoid.glb",
    authoredAnimationPackPath,
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.equal(
    warnings.some((message) => message.includes("missing authored walk animation")),
    false
  );
  assert.ok(characterRoot);
  assert.equal(sceneRuntime.scene.getObjectByName("socket_debug/hand_r_socket"), undefined);
  assert.equal(sceneRuntime.scene.getObjectByName("socket_debug/head_socket"), undefined);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    0,
    0,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "mesh2motion-humanoid-v1",
        aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
        presentation: {
          animationVocabulary: "walk",
          position: { x: -1.5, y: 0, z: -6.2 },
          yawRadians: -0.4
        }
      }
    ]
  );

  assert.equal(characterRoot.visible, true);
  assert.equal(characterRoot.position.x, 3.2);
  assert.equal(characterRoot.position.y, 0);
  assert.equal(characterRoot.position.z, -5.4);
  assert.ok(
    Math.abs(
      wrapRadians(characterRoot.rotation.y - resolveCharacterRenderYawRadians(0.7))
    ) < 0.000001
  );
  assertCharacterRenderYawFacesMetaverseYaw(characterRoot.rotation.y, 0.7);

  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.ok(attachmentRoot);
  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [0, 0, 0, 1],
    0.000001,
    "Attachment grip alignment should keep the pistol upright under the socket"
  );
  const authoredSupportSocket = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_support_marker"
  );
  const leftAttachmentSupportPoint = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_l_support"
  );
  const rightAttachmentSupportPoint = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_r_support"
  );

  assert.ok(authoredSupportSocket);
  assert.equal(leftAttachmentSupportPoint, undefined);
  assert.equal(rightAttachmentSupportPoint, undefined);
  assert.ok(
    authoredSupportSocket.position.distanceTo(new Vector3(0.018, -0.137, 0)) <
      0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    8,
    0,
    {
      animationVocabulary: "seated",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "mesh2motion-humanoid-v1",
        aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
        presentation: {
          animationVocabulary: "walk",
          position: { x: -1.5, y: 0, z: -6.2 },
          yawRadians: -0.4
        }
      }
    ],
    {
      cameraPolicyId: "vehicle-follow",
      controlRoutingPolicyId: "vehicle-surface-drive",
      directSeatTargets: [],
      entryId: null,
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Skiff",
      lookLimitPolicyId: "driver-forward",
      occupancyAnimationId: "seated",
      occupancyKind: "seat",
      occupantLabel: "Driver seat",
      occupantRole: "driver",
      seatTargets: [],
      seatId: "driver"
    }
  );

  assert.equal(attachmentRoot.parent?.name, "back_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.12, 0.03, -0.04)) < 0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    10,
    0,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "mesh2motion-humanoid-v1",
        aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
        presentation: {
          animationVocabulary: "walk",
          position: { x: -1.5, y: 0, z: -6.2 },
          yawRadians: -0.4
        }
      }
    ],
    {
      cameraPolicyId: "seat-follow",
      controlRoutingPolicyId: "look-only",
      directSeatTargets: [],
      entryId: "deck-entry",
      environmentAssetId: "metaverse-hub-skiff-v1",
      label: "Skiff",
      lookLimitPolicyId: "passenger-bench",
      occupancyAnimationId: "standing",
      occupancyKind: "entry",
      occupantLabel: "Board deck",
      occupantRole: "passenger",
      seatTargets: [],
      seatId: null
    }
  );

  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    12,
    0,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "mesh2motion-humanoid-v1",
        aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
        presentation: {
          animationVocabulary: "walk",
          position: { x: -1.5, y: 0, z: -6.2 },
          yawRadians: -0.4
        }
      }
    ]
  );

  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );

  const remoteCharacterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1/remote-pilot-2"
  );

  assert.ok(remoteCharacterRoot);
  assert.equal(remoteCharacterRoot.position.x, -1.5);
  assert.equal(remoteCharacterRoot.position.z, -6.2);
  assert.ok(
    Math.abs(
      wrapRadians(remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(-0.4))
    ) < 0.000001
  );
  assertCharacterRenderYawFacesMetaverseYaw(remoteCharacterRoot.rotation.y, -0.4);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    16,
    1 / 60,
    {
      animationVocabulary: "walk",
      position: { x: 3.2, y: 0, z: -5.4 },
      yawRadians: 0.7
    },
    [
      {
        characterId: "mesh2motion-humanoid-v1",
        aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
        presentation: {
          animationVocabulary: "walk",
          position: { x: 1.2, y: 0, z: -4.8 },
          yawRadians: 0.3
        }
      }
    ]
  );

  assert.ok(remoteCharacterRoot.position.x > -1.5);
  assert.ok(remoteCharacterRoot.position.x < 1.2);
  assert.ok(remoteCharacterRoot.position.z > -6.2);
  assert.ok(remoteCharacterRoot.position.z < -4.8);
  assert.ok(
    Math.abs(
      wrapRadians(
        remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(0.3)
      )
    ) <
      Math.abs(
        wrapRadians(
          resolveCharacterRenderYawRadians(-0.4) -
            resolveCharacterRenderYawRadians(0.3)
        )
      )
  );

  for (let frame = 0; frame < 45; frame += 1) {
    sceneRuntime.syncPresentation(
      {
        lookDirection: { x: 0, y: 0, z: -1 },
        pitchRadians: 0,
        position: { x: 3.2, y: 1.62, z: -5.4 },
        yawRadians: 0.7
      },
      null,
      32 + frame * 16,
      1 / 60,
      {
        animationVocabulary: "walk",
        position: { x: 3.2, y: 0, z: -5.4 },
        yawRadians: 0.7
      },
      [
        {
          characterId: "mesh2motion-humanoid-v1",
          aimCamera: null,
        look: { pitchRadians: 0, yawRadians: 0 },
        mountedOccupancy: null,
        playerId: "remote-pilot-2",
        poseSyncMode: "scene-arrival-smoothed",
          presentation: {
            animationVocabulary: "walk",
            position: { x: 1.2, y: 0, z: -4.8 },
            yawRadians: 0.3
          }
        }
      ]
    );
  }

  assert.ok(Math.abs(remoteCharacterRoot.position.x - 1.2) < 0.05);
  assert.ok(Math.abs(remoteCharacterRoot.position.z - -4.8) < 0.05);
  assert.ok(
    Math.abs(
      wrapRadians(remoteCharacterRoot.rotation.y - resolveCharacterRenderYawRadians(0.3))
    ) < 0.05
  );

  sceneRuntime.scene.updateMatrixWorld(true);

  const gripSocket = sceneRuntime.scene.getObjectByName("palm_r_socket");
  assert.ok(gripSocket);
  const initialAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  gripSocket.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.3);
  sceneRuntime.scene.updateMatrixWorld(true);

  const nextAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 3.2, y: 1.62, z: -5.4 },
      yawRadians: 0.7
    },
    null,
    100,
    0,
    null,
    []
  );

  assert.equal(characterRoot.visible, false);
  assert.equal(attachmentRoot.parent?.name, "palm_r_socket");
  assert.ok(
    attachmentRoot.position.distanceTo(new Vector3(0.01, -0.02, 0.03)) < 0.000001
  );
  assertQuaternionArraysEquivalent(
    attachmentRoot.quaternion.toArray(),
    [0, 0, 0, 1],
    0.000001,
    "Attachment grip alignment should remain stable after presentation sync"
  );
  assert.ok(initialAttachmentQuaternion.angleTo(nextAttachmentQuaternion) > 0.001);
  assert.equal(
    sceneRuntime.scene.getObjectByName(
      "metaverse_character/mesh2motion-humanoid-v1/remote-pilot-2"
    ),
    undefined
  );
});
