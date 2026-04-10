import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "./load-client-module.mjs";

let clientLoader;

class FakeMetaverseRenderer {
  compileAsyncCalls = [];
  disposed = false;
  initCalls = 0;
  pixelRatio = null;
  renderCalls = 0;
  sizes = [];

  async compileAsync(scene, camera) {
    this.compileAsyncCalls.push({
      camera,
      scene
    });
  }

  async init() {
    this.initCalls += 1;
  }

  render() {
    this.renderCalls += 1;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = pixelRatio;
  }

  setSize(width, height) {
    this.sizes.push([width, height]);
  }

  dispose() {
    this.disposed = true;
  }
}

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("WebGpuMetaverseRuntime starts from an idle snapshot and rejects missing navigator.gpu explicitly", async () => {
  const { WebGpuMetaverseRuntime } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-runtime.ts"
  );
  const runtime = new WebGpuMetaverseRuntime();

  assert.equal(runtime.hudSnapshot.lifecycle, "idle");
  assert.equal(runtime.hudSnapshot.focusedMountable, null);
  assert.equal(runtime.hudSnapshot.focusedPortal, null);
  assert.equal(runtime.hudSnapshot.mountedEnvironment, null);
  assert.equal(runtime.hudSnapshot.controlMode, "keyboard");

  await assert.rejects(
    () => runtime.start({}, {}),
    /WebGPU is unavailable for the metaverse runtime/
  );
  assert.equal(runtime.hudSnapshot.lifecycle, "failed");
});

test("resolveMetaverseMouseLookAxes keeps the center dead zone quiet and turns toward edges", async () => {
  const { resolveMetaverseMouseLookAxes } = await clientLoader.load(
    "/src/metaverse/states/metaverse-flight.ts"
  );

  assert.deepEqual(
    resolveMetaverseMouseLookAxes(0.5, 0.5, 1280, 720, {
      deadZoneViewportFraction: 0.2,
      responseExponent: 1.55
    }),
    {
      pitchAxis: 0,
      yawAxis: 0
    }
  );

  const rightTurnAxes = resolveMetaverseMouseLookAxes(0.96, 0.5, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });
  const downwardTiltAxes = resolveMetaverseMouseLookAxes(0.5, 0.96, 1280, 720, {
    deadZoneViewportFraction: 0.2,
    responseExponent: 1.55
  });

  assert.ok(rightTurnAxes.yawAxis > 0);
  assert.equal(rightTurnAxes.pitchAxis, 0);
  assert.ok(downwardTiltAxes.pitchAxis < 0);
  assert.equal(downwardTiltAxes.yawAxis, 0);
});

test("WebGpuMetaverseRuntime prewarms the booted scene before the first render when compileAsync is available", async () => {
  const { WebGpuMetaverseRuntime } = await clientLoader.load(
    "/src/metaverse/classes/webgpu-metaverse-runtime.ts"
  );
  const renderer = new FakeMetaverseRenderer();
  const originalWindow = globalThis.window;
  let scheduledFrame = null;
  const fakeCanvas = {
    addEventListener() {},
    clientHeight: 720,
    clientWidth: 1280,
    removeEventListener() {}
  };

  globalThis.window = {
    addEventListener() {},
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    devicePixelRatio: 1.5,
    removeEventListener() {},
    requestAnimationFrame(callback) {
      scheduledFrame = callback;
      return 1;
    }
  };

  try {
    const runtime = new WebGpuMetaverseRuntime(undefined, {
      cancelAnimationFrame: globalThis.window.cancelAnimationFrame.bind(globalThis.window),
      createRenderer: () => renderer,
      devicePixelRatio: 1.5,
      requestAnimationFrame: globalThis.window.requestAnimationFrame.bind(globalThis.window)
    });
    const startSnapshot = await runtime.start(fakeCanvas, {
      gpu: {}
    });

    assert.equal(startSnapshot.lifecycle, "running");
    assert.equal(renderer.initCalls, 1);
    assert.equal(renderer.compileAsyncCalls.length, 1);
    assert.equal(renderer.renderCalls, 1);
    assert.equal(renderer.pixelRatio, 1.5);
    assert.deepEqual(renderer.sizes.at(0), [1280, 720]);
    assert.equal(renderer.compileAsyncCalls[0]?.scene?.isScene, true);
    assert.equal(renderer.compileAsyncCalls[0]?.camera?.isPerspectiveCamera, true);
    assert.equal(typeof scheduledFrame, "function");

    runtime.dispose();

    assert.equal(renderer.disposed, true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("createMetaverseScene keeps portal material nodes stable across presentation syncs", async () => {
  const [{ createMetaverseScene }, { metaverseRuntimeConfig }] = await Promise.all([
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);
  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig);
  const ringMesh = sceneRuntime.scene.getObjectByName("metaverse_portal/duck-hunt/ring");
  const beamMesh = sceneRuntime.scene.getObjectByName("metaverse_portal/duck-hunt/beam");

  assert.ok(ringMesh);
  assert.ok(beamMesh);

  const initialRingColorNode = ringMesh.material.colorNode;
  const initialRingEmissiveNode = ringMesh.material.emissiveNode;
  const initialBeamColorNode = beamMesh.material.colorNode;
  const initialBeamEmissiveNode = beamMesh.material.emissiveNode;
  const initialBeamOpacityNode = beamMesh.material.opacityNode;

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    null,
    500,
    0
  );
  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    {
      distanceFromCamera: 12,
      experienceId: "duck-hunt",
      label: "Duck Hunt!"
    },
    1500,
    0
  );

  assert.equal(ringMesh.material.colorNode, initialRingColorNode);
  assert.equal(ringMesh.material.emissiveNode, initialRingEmissiveNode);
  assert.equal(beamMesh.material.colorNode, initialBeamColorNode);
  assert.equal(beamMesh.material.emissiveNode, initialBeamEmissiveNode);
  assert.equal(beamMesh.material.opacityNode, initialBeamOpacityNode);
  assert.equal(beamMesh.material.opacityNode.value, 0.92);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 6, z: -40 },
      yawRadians: 0
    },
    null,
    2200,
    0
  );

  assert.equal(beamMesh.material.opacityNode.value, 0.76);
});

test("metaverse asset proof resolves a socket-compatible attachment config from manifests", async () => {
  const {
    metaverseAttachmentProofConfig,
    metaverseCharacterProofConfig
  } = await clientLoader.load("/src/app/states/metaverse-asset-proof.ts");

  assert.equal(
    metaverseAttachmentProofConfig.attachmentId,
    "metaverse-service-pistol-v1"
  );
  assert.equal(metaverseAttachmentProofConfig.socketName, "hand_r_socket");
  assert.ok(
    metaverseCharacterProofConfig.socketNames.includes(
      metaverseAttachmentProofConfig.socketName
    )
  );
});

test("metaverse asset proof resolves static, instanced, and dynamic environment config from manifests", async () => {
  const { metaverseEnvironmentProofConfig } = await clientLoader.load(
    "/src/app/states/metaverse-asset-proof.ts"
  );

  assert.equal(metaverseEnvironmentProofConfig.assets.length, 3);

  const crateAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-crate-v1"
  );
  const dockAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-dock-v1"
  );
  const skiffAsset = metaverseEnvironmentProofConfig.assets.find(
    (asset) => asset.environmentAssetId === "metaverse-hub-skiff-v1"
  );

  assert.ok(crateAsset);
  assert.equal(crateAsset.placement, "instanced");
  assert.ok(crateAsset.lods.length >= 2);
  assert.ok(crateAsset.placements.length > 1);

  assert.ok(dockAsset);
  assert.equal(dockAsset.placement, "static");
  assert.ok(dockAsset.lods.length >= 2);
  assert.equal(dockAsset.placements.length, 1);

  assert.ok(skiffAsset);
  assert.equal(skiffAsset.placement, "dynamic");
  assert.equal(skiffAsset.lods.length, 1);
  assert.equal(skiffAsset.placements.length, 1);
  assert.equal(skiffAsset.mount?.seatSocketName, "seat_socket");
  assert.equal(skiffAsset.collider?.shape, "box");
});

test("createMetaverseScene boots one manifest-driven character and hand socket attachment proof slice", async () => {
  const [
    { AnimationClip, Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Quaternion, QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, VectorKeyframeTrack },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const loadPaths = [];
  const bodyGeometry = new BoxGeometry(0.4, 1.8, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.45;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.45;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.45;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.25;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();
    socketBone.name = socketName;
    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);
  socketBones[0].position.y = 0.18;
  socketBones[1].position.x = -0.35;
  socketBones[2].position.x = 0.35;
  socketBones[3].position.set(0.2, -0.08, -0.08);
  socketBones[4].position.set(0, 0, -0.08);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const idleClip = new AnimationClip("idle", -1, [
    new VectorKeyframeTrack("humanoid_root.position", [0, 1], [0, 0, 0, 0, 0.05, 0]),
    new QuaternionKeyframeTrack("chest.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.08).toArray()
    ]),
    new QuaternionKeyframeTrack("hand_r_socket.quaternion", [0, 1], [
      ...new Quaternion().toArray(),
      ...new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3).toArray()
    ])
  ]);
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );

  attachmentScene.name = "metaverse_service_pistol_root";
  attachmentMesh.position.x = 0.14;
  attachmentScene.add(attachmentMesh);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      socketName: "hand_r_socket"
    },
    characterProofConfig: {
      animationClipName: "idle",
      animationSourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
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

        return {
          animations: [idleClip],
          scene: characterScene
        };
      }
    }),
    warn() {}
  });

  await sceneRuntime.boot();

  assert.deepEqual(loadPaths, [
    "/models/metaverse/characters/metaverse-mannequin.gltf",
    "/models/metaverse/attachments/metaverse-service-pistol.gltf"
  ]);
  assert.ok(
    sceneRuntime.scene.getObjectByName("metaverse_character/metaverse-mannequin-v1")
  );
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/hand_r_socket"));
  assert.ok(sceneRuntime.scene.getObjectByName("socket_debug/head_socket"));

  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );

  assert.ok(attachmentRoot);
  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.equal(attachmentRoot.position.length(), 0);
  assert.deepEqual(attachmentRoot.quaternion.toArray(), [0, 0, 0, 1]);

  sceneRuntime.scene.updateMatrixWorld(true);

  const handSocket = sceneRuntime.scene.getObjectByName("hand_r_socket");
  assert.ok(handSocket);
  const initialAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  handSocket.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.3);
  sceneRuntime.scene.updateMatrixWorld(true);

  const nextAttachmentQuaternion = attachmentRoot.getWorldQuaternion(
    new Quaternion()
  );

  assert.equal(attachmentRoot.parent?.name, "hand_r_socket");
  assert.equal(attachmentRoot.position.length(), 0);
  assert.deepEqual(attachmentRoot.quaternion.toArray(), [0, 0, 0, 1]);
  assert.ok(initialAttachmentQuaternion.angleTo(nextAttachmentQuaternion) > 0.001);
});

test("createMetaverseScene switches environment LOD tiers and instantiates repeated props", async () => {
  const [
    { BoxGeometry, Group, Mesh, MeshStandardMaterial },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const loadPaths = [];
  const createEnvironmentScene = (name, color, size) => {
    const scene = new Group();
    const mesh = new Mesh(
      new BoxGeometry(size.x, size.y, size.z),
      new MeshStandardMaterial({ color })
    );

    mesh.position.y = size.y / 2;
    mesh.name = `${name}_mesh`;
    scene.name = name;
    scene.add(mesh);

    return scene;
  };
  const dockHighScene = createEnvironmentScene(
    "metaverse_hub_dock_high",
    0x9fb3c8,
    { x: 8, y: 0.6, z: 4 }
  );
  const dockLowScene = createEnvironmentScene(
    "metaverse_hub_dock_low",
    0x7b8794,
    { x: 8, y: 0.4, z: 4 }
  );
  const crateHighScene = createEnvironmentScene(
    "metaverse_hub_crate_high",
    0xa16207,
    { x: 0.9, y: 0.9, z: 0.9 }
  );
  const crateLowScene = createEnvironmentScene(
    "metaverse_hub_crate_low",
    0x854d0e,
    { x: 0.84, y: 0.84, z: 0.84 }
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: null,
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        loadPaths.push(path);

        switch (path) {
          case "/models/metaverse/environment/metaverse-hub-dock-high.gltf":
            return {
              animations: [],
              scene: dockHighScene
            };
          case "/models/metaverse/environment/metaverse-hub-dock-low.gltf":
            return {
              animations: [],
              scene: dockLowScene
            };
          case "/models/metaverse/environment/metaverse-hub-crate-high.gltf":
            return {
              animations: [],
              scene: crateHighScene
            };
          case "/models/metaverse/environment/metaverse-hub-crate-low.gltf":
            return {
              animations: [],
              scene: crateLowScene
            };
          default:
            throw new Error(`Unexpected environment asset path ${path}`);
        }
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collider: null,
          environmentAssetId: "metaverse-hub-dock-v1",
          label: "Metaverse hub dock",
          lods: [
            {
              maxDistanceMeters: 18,
              modelPath: "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
              tier: "high"
            },
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
              tier: "low"
            }
          ],
          mount: null,
          placement: "static",
          placements: [
            {
              position: { x: 0, y: 0, z: -6 },
              rotationYRadians: 0,
              scale: 1
            }
          ]
        },
        {
          collider: null,
          environmentAssetId: "metaverse-hub-crate-v1",
          label: "Metaverse hub crate",
          lods: [
            {
              maxDistanceMeters: 10,
              modelPath: "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
              tier: "high"
            },
            {
              maxDistanceMeters: null,
              modelPath: "/models/metaverse/environment/metaverse-hub-crate-low.gltf",
              tier: "low"
            }
          ],
          mount: null,
          placement: "instanced",
          placements: [
            {
              position: { x: 1.5, y: 0, z: -4 },
              rotationYRadians: 0,
              scale: 1
            },
            {
              position: { x: 3.2, y: 0, z: -4.8 },
              rotationYRadians: Math.PI * 0.1,
              scale: 0.92
            }
          ]
        }
      ]
    },
    warn() {}
  });

  await sceneRuntime.boot();

  assert.deepEqual(loadPaths, [
    "/models/metaverse/environment/metaverse-hub-dock-high.gltf",
    "/models/metaverse/environment/metaverse-hub-dock-low.gltf",
    "/models/metaverse/environment/metaverse-hub-crate-high.gltf",
    "/models/metaverse/environment/metaverse-hub-crate-low.gltf"
  ]);

  const dockHighLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_static/metaverse-hub-dock-v1/0/high"
  );
  const dockLowLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_static/metaverse-hub-dock-v1/0/low"
  );
  const crateHighLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_lod/metaverse-hub-crate-v1/high"
  );
  const crateLowLod = sceneRuntime.scene.getObjectByName(
    "metaverse_environment_lod/metaverse-hub-crate-v1/low"
  );

  assert.ok(dockHighLod);
  assert.ok(dockLowLod);
  assert.ok(crateHighLod);
  assert.ok(crateLowLod);
  assert.equal(dockHighLod.isBundleGroup, true);
  assert.equal(dockLowLod.isBundleGroup, true);
  assert.equal(crateHighLod.isBundleGroup, true);
  assert.equal(crateLowLod.isBundleGroup, true);
  assert.ok(crateHighLod.children[0]?.isInstancedMesh);
  assert.equal(dockHighLod.matrixAutoUpdate, false);
  assert.equal(dockLowLod.matrixAutoUpdate, false);
  assert.equal(crateHighLod.matrixAutoUpdate, false);
  assert.equal(crateLowLod.matrixAutoUpdate, false);
  assert.equal(crateHighLod.children[0]?.matrixAutoUpdate, false);

  const viewportRenderer = {
    setPixelRatio() {},
    setSize() {}
  };

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  const dockHighBundleVersion = dockHighLod.version;
  const crateHighBundleVersion = crateHighLod.version;

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 720,
      clientWidth: 1280
    },
    1
  );

  assert.equal(dockHighLod.version, dockHighBundleVersion);
  assert.equal(crateHighLod.version, crateHighBundleVersion);

  sceneRuntime.syncViewport(
    viewportRenderer,
    {
      clientHeight: 900,
      clientWidth: 1440
    },
    1
  );

  assert.equal(dockHighLod.version, dockHighBundleVersion + 1);
  assert.equal(crateHighLod.version, crateHighBundleVersion + 1);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.6, z: 0 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, true);
  assert.equal(dockLowLod.visible, false);
  assert.equal(crateHighLod.visible, true);
  assert.equal(crateLowLod.visible, false);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 1.6, z: 30 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, false);
  assert.equal(dockLowLod.visible, true);
  assert.equal(crateHighLod.visible, false);
  assert.equal(crateLowLod.visible, true);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 0, z: 11.3 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, false);
  assert.equal(dockLowLod.visible, true);

  sceneRuntime.syncPresentation(
    {
      lookDirection: { x: 0, y: 0, z: -1 },
      pitchRadians: 0,
      position: { x: 0, y: 0, z: 10.6 },
      yawRadians: 0
    },
    null,
    0,
    0
  );

  assert.equal(dockHighLod.visible, true);
  assert.equal(dockLowLod.visible, false);
});

test("createMetaverseScene mounts and dismounts a dynamic environment asset through seat_socket alignment", async () => {
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
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const bodyGeometry = new BoxGeometry(0.4, 1.8, 0.3);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const rootBone = new Bone();
  rootBone.name = "humanoid_root";
  const hipsBone = new Bone();
  hipsBone.name = "hips";
  hipsBone.position.y = 0.45;
  rootBone.add(hipsBone);
  const spineBone = new Bone();
  spineBone.name = "spine";
  spineBone.position.y = 0.45;
  hipsBone.add(spineBone);
  const chestBone = new Bone();
  chestBone.name = "chest";
  chestBone.position.y = 0.45;
  spineBone.add(chestBone);
  const neckBone = new Bone();
  neckBone.name = "neck";
  neckBone.position.y = 0.25;
  chestBone.add(neckBone);
  const socketNames = [
    "head_socket",
    "hand_l_socket",
    "hand_r_socket",
    "hip_socket",
    "seat_socket"
  ];
  const socketBones = socketNames.map((socketName) => {
    const socketBone = new Bone();
    socketBone.name = socketName;
    return socketBone;
  });

  neckBone.add(socketBones[0]);
  chestBone.add(socketBones[1], socketBones[2]);
  hipsBone.add(socketBones[3], socketBones[4]);
  socketBones[0].position.y = 0.18;
  socketBones[1].position.x = -0.35;
  socketBones[2].position.x = 0.35;
  socketBones[3].position.set(0.2, -0.08, -0.08);
  socketBones[4].position.set(0, 0, -0.08);

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0xa8b8d1 })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    hipsBone,
    spineBone,
    chestBone,
    neckBone,
    ...socketBones
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const idleClip = new AnimationClip("idle", -1, []);
  const skiffScene = new Group();
  const skiffHull = new Mesh(
    new BoxGeometry(4.2, 0.6, 1.8),
    new MeshStandardMaterial({ color: 0x475569 })
  );
  const seatSocket = new Group();

  skiffHull.position.y = 0.3;
  seatSocket.name = "seat_socket";
  seatSocket.position.set(0, 1, 0);
  skiffScene.name = "metaverse_hub_skiff_root";
  skiffScene.add(skiffHull, seatSocket);

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    characterProofConfig: {
      animationClipName: "idle",
      animationSourcePath: "/models/metaverse/characters/metaverse-mannequin.gltf",
      characterId: "metaverse-mannequin-v1",
      label: "Metaverse mannequin",
      modelPath: "/models/metaverse/characters/metaverse-mannequin.gltf",
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
          animations: [idleClip],
          scene: characterScene
        };
      }
    }),
    environmentProofConfig: {
      assets: [
        {
          collider: {
            center: { x: 0, y: 1, z: 0 },
            shape: "box",
            size: { x: 5, y: 3, z: 3 }
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
          mount: {
            seatSocketName: "seat_socket"
          },
          placement: "dynamic",
          placements: [
            {
              position: { x: 11.5, y: 0.1, z: -14.2 },
              rotationYRadians: Math.PI * 0.8,
              scale: 1
            }
          ]
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
    "metaverse_character/metaverse-mannequin-v1"
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

  assert.equal(initialInteractionSnapshot.focusedMountable?.environmentAssetId, "metaverse-hub-skiff-v1");
  assert.equal(initialInteractionSnapshot.mountedEnvironment, null);

  const mountedInteractionSnapshot = sceneRuntime.toggleMount(cameraSnapshot);

  assert.equal(mountedInteractionSnapshot.focusedMountable, null);
  assert.equal(
    mountedInteractionSnapshot.mountedEnvironment?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(characterRoot.parent?.name, "seat_socket");

  sceneRuntime.scene.updateMatrixWorld(true);
  const mountedEnvironmentSeatSocket = characterRoot.parent;
  const mountedCharacterSeatSocket = characterRoot.getObjectByName("seat_socket");

  assert.ok(mountedEnvironmentSeatSocket);
  assert.ok(mountedCharacterSeatSocket);
  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  sceneRuntime.syncPresentation(cameraSnapshot, null, 1200, 0.016);
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    mountedEnvironmentSeatSocket
      .getWorldPosition(new Vector3())
      .distanceTo(
        mountedCharacterSeatSocket.getWorldPosition(new Vector3())
      ) < 0.001
  );

  const dismountedInteractionSnapshot = sceneRuntime.toggleMount(cameraSnapshot);

  assert.equal(dismountedInteractionSnapshot.mountedEnvironment, null);
  assert.equal(
    dismountedInteractionSnapshot.focusedMountable?.environmentAssetId,
    "metaverse-hub-skiff-v1"
  );
  assert.equal(characterRoot.parent, originalParent);
  assert.ok(
    characterRoot.getWorldPosition(new Vector3()).distanceTo(originalWorldPosition) < 0.001
  );
  assert.ok(
    characterRoot.getWorldQuaternion(new Quaternion()).angleTo(originalWorldQuaternion) <
      0.001
  );
});
