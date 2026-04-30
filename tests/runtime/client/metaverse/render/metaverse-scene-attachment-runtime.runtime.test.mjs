import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createHumanoidV2CharacterScene,
  createTestServicePistolHoldProfile
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

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

function createTestWeaponState(weaponId) {
  return Object.freeze({
    activeSlotId: "primary",
    aimMode: "hip-fire",
    slots: Object.freeze([
      Object.freeze({
        attachmentId: weaponId,
        equipped: true,
        slotId: "primary",
        weaponId,
        weaponInstanceId: `test-player:primary:${weaponId}`
      })
    ]),
    weaponId
  });
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("syncAttachmentProofRuntimeMount hides weapon attachments until weapon state matches", async () => {
  const [
    { Group, Quaternion, Vector3 },
    { syncAttachmentProofRuntimeMount }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/attachments/metaverse-scene-attachment-runtime.ts"
    )
  ]);
  const characterScene = new Group();
  const heldSocket = new Group();
  const holsterSocket = new Group();
  const attachmentRoot = new Group();
  const presentationGroup = new Group();
  const attachmentRuntime = {
    activeMountKind: null,
    attachmentId: "metaverse-service-pistol-v1",
    attachmentRoot,
    heldMount: {
      localPosition: new Vector3(0.01, -0.02, 0.03),
      localQuaternion: new Quaternion(),
      socketName: "palm_r_socket"
    },
    mountedHolsterMount: {
      localPosition: new Vector3(0.12, 0.03, -0.04),
      localQuaternion: new Quaternion(),
      socketName: "back_socket"
    },
    presentationGroup
  };
  const nodeResolvers = {
    findSocketNode(scene, socketName) {
      const socketNode = scene.getObjectByName(socketName);

      assert.ok(socketNode, `Expected fixture socket ${socketName}.`);

      return socketNode;
    }
  };

  heldSocket.name = "palm_r_socket";
  holsterSocket.name = "back_socket";
  attachmentRoot.name = "metaverse_attachment/metaverse-service-pistol-v1";
  characterScene.add(heldSocket, holsterSocket);
  attachmentRoot.add(presentationGroup);

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    { scene: characterScene },
    null,
    nodeResolvers,
    null
  );

  assert.equal(attachmentRuntime.activeMountKind, null);
  assert.equal(attachmentRoot.parent, heldSocket);
  assert.equal(attachmentRoot.visible, false);

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    { scene: characterScene },
    null,
    nodeResolvers,
    createTestWeaponState("metaverse-battle-rifle-v1")
  );

  assert.equal(attachmentRuntime.activeMountKind, null);
  assert.equal(attachmentRoot.visible, false);

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    { scene: characterScene },
    null,
    nodeResolvers,
    createTestWeaponState("metaverse-service-pistol-v1")
  );

  assert.equal(attachmentRuntime.activeMountKind, "held");
  assert.equal(attachmentRoot.parent, heldSocket);
  assert.equal(attachmentRoot.visible, true);
  presentationGroup.visible = false;

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    { scene: characterScene },
    Object.freeze({
      holsterHeldAttachment: true
    }),
    nodeResolvers,
    createTestWeaponState("metaverse-service-pistol-v1")
  );

  assert.equal(attachmentRuntime.activeMountKind, "mounted-holster");
  assert.equal(attachmentRoot.parent, holsterSocket);
  assert.equal(attachmentRoot.visible, true);
  assert.equal(presentationGroup.visible, true);

  syncAttachmentProofRuntimeMount(
    attachmentRuntime,
    { scene: characterScene },
    null,
    nodeResolvers,
    null
  );

  assert.equal(attachmentRuntime.activeMountKind, null);
  assert.equal(attachmentRoot.parent, holsterSocket);
  assert.equal(attachmentRoot.visible, false);
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
    "/models/metaverse/characters/metaverse-humanoid-base-pack.glb";
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
  const interactClip = new AnimationClip("interact", -1, []);
  const seatedClip = new AnimationClip("seated", -1, []);
  const animationPackScene = new Group();
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );
  const gripHandSocket = new Group();
  const forwardMarker = new Group();
  const upMarker = new Group();
  const supportMarker = new Group();
  const triggerMarker = new Group();
  const adsCameraAnchor = new Group();
  const backSocket = new Group();

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  gripHandSocket.name = "metaverse_service_pistol_grip_hand_r_socket";
  gripHandSocket.position.set(-0.01, 0.02, -0.03);
  forwardMarker.name = "metaverse_service_pistol_forward_marker";
  forwardMarker.position.set(0.28, 0.02, -0.03);
  upMarker.name = "metaverse_service_pistol_up_marker";
  upMarker.position.set(-0.01, 0.12, -0.03);
  supportMarker.name = "metaverse_service_pistol_support_marker";
  supportMarker.position.set(0.037, -0.137, 0);
  triggerMarker.name = "metaverse_service_pistol_trigger_marker";
  triggerMarker.position.set(0.026, 0.012, 0.004);
  adsCameraAnchor.name = "metaverse_service_pistol_ads_camera_anchor";
  adsCameraAnchor.position.set(0.07, 0.04, -0.03);
  backSocket.name = "metaverse_service_pistol_back_socket";
  backSocket.position.set(0.12, -0.04, 0.03);
  backSocket.quaternion.set(0, 0.7071067811865475, -0.7071067811865476, 0);
  attachmentScene.add(
    attachmentMesh,
    gripHandSocket,
    forwardMarker,
    upMarker,
    supportMarker,
    triggerMarker,
    adsCameraAnchor,
    backSocket
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketRole: "grip.primary",
        socketName: "palm_r_socket"
      },
      holdProfile: createTestServicePistolHoldProfile({
        sockets: [
          {
            nodeName: "metaverse_service_pistol_grip_hand_r_socket",
            role: "grip.primary"
          },
          {
            nodeName: "metaverse_service_pistol_forward_marker",
            role: "basis.forward"
          },
          {
            nodeName: "metaverse_service_pistol_up_marker",
            role: "basis.up"
          },
          {
            nodeName: "metaverse_service_pistol_trigger_marker",
            role: "trigger.index"
          },
          {
            nodeName: "metaverse_service_pistol_support_marker",
            role: "grip.secondary"
          },
          {
            nodeName: "metaverse_service_pistol_ads_camera_anchor",
            role: "camera.ads_anchor"
          },
          {
            nodeName: "metaverse_service_pistol_back_socket",
            role: "carry.back"
          }
        ]
      }),
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
      mountedHolsterMount: {
        attachmentSocketRole: "carry.back",
        socketName: "back_socket"
      }
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
      modelPath: "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
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
            animations: [idleClip, walkClip, interactClip, seatedClip],
            scene: characterScene
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

  const activeWeaponState = createTestWeaponState("metaverse-service-pistol-v1");

  const characterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1"
  );

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.equal(
    warnings.some((message) => message.includes("missing authored walk animation")),
    false
  );
  assert.ok(characterRoot);

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
    activeWeaponState,
    null,
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
  assert.equal(attachmentRoot.visible, true);
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
    authoredSupportSocket.position.distanceTo(new Vector3(0.037, -0.137, 0)) <
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
    activeWeaponState,
    null,
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
    activeWeaponState,
    null,
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
    activeWeaponState,
    null,
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
    activeWeaponState,
    null,
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
      activeWeaponState,
      null,
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
    activeWeaponState,
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
