import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import { createHumanoidV2CharacterScene } from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("syncCharacterAnimation uses authored jump vocabularies before locomotion fallback", async () => {
  const [
    { AnimationClip, AnimationMixer, Group, NumberKeyframeTrack },
    { syncCharacterAnimation }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-character-animation.ts"
    )
  ]);
  const anchorGroup = new Group();
  const mixer = new AnimationMixer(anchorGroup);
  const createAction = (clipName, targetPositionX) =>
    mixer.clipAction(
      new AnimationClip(clipName, 1, [
        new NumberKeyframeTrack(
          ".position[x]",
          [0, 1],
          [0, targetPositionX]
        )
      ])
    );
  const idleAction = createAction("idle", 0);
  const walkAction = createAction("walk", 1);
  const jumpUpAction = createAction("jump-up", 2);
  const jumpMidAction = createAction("jump-mid", 3);
  const jumpDownAction = createAction("jump-down", 4);
  const characterRuntime = {
    activeAnimationActionSetId: "full-body",
    activeAnimationCycleId: 0,
    activeAnimationVocabulary: "idle",
    actionsByVocabulary: new Map([
      ["idle", idleAction],
      ["walk", walkAction],
      ["jump-up", jumpUpAction],
      ["jump-mid", jumpMidAction],
      ["jump-down", jumpDownAction]
    ]),
    anchorGroup,
    humanoidV2PistolLowerBodyActionsByVocabulary: null,
    humanoidV2PistolPoseRuntime: null,
    skeletonId: "humanoid_v2"
  };

  idleAction.play();

  syncCharacterAnimation(characterRuntime, "jump-up", false, 1);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-up");
  assert.equal(characterRuntime.activeAnimationCycleId, 1);

  syncCharacterAnimation(characterRuntime, "jump-mid", false, 2);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-mid");
  assert.equal(characterRuntime.activeAnimationCycleId, 2);

  syncCharacterAnimation(characterRuntime, "jump-down", false, 3);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-down");
  assert.equal(characterRuntime.activeAnimationCycleId, 3);
});

test("held weapon pose runtime restores sampled and authored baselines by restore source", async () => {
  const [
    { Bone, Quaternion, Vector3 },
    {
      captureHumanoidV2HeldWeaponPoseRuntime,
      restoreHumanoidV2HeldWeaponPoseRuntime
    }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const sampledDrivenBone = new Bone();
  const authoredDrivenBone = new Bone();

  sampledDrivenBone.name = "clavicle_r";
  authoredDrivenBone.name = "upperarm_r";

  const sampledDrivenBoneStartupQuaternion =
    sampledDrivenBone.quaternion.clone();
  const authoredDrivenBoneStartupQuaternion =
    authoredDrivenBone.quaternion.clone();
  const sampledAnimationQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.42
  );
  const unsampledAnimationQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    -0.31
  );
  const solvedIkQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -0.77
  );
  const heldWeaponPoseRuntime = {
    drivenBones: [
      {
        authoredLocalQuaternion: sampledDrivenBoneStartupQuaternion.clone(),
        bone: sampledDrivenBone,
        restoreSource: "sampled",
        sampledLocalQuaternion: new Quaternion()
      },
      {
        authoredLocalQuaternion: authoredDrivenBoneStartupQuaternion.clone(),
        bone: authoredDrivenBone,
        restoreSource: "authored",
        sampledLocalQuaternion: new Quaternion()
      }
    ]
  };

  sampledDrivenBone.quaternion.copy(sampledAnimationQuaternion);
  authoredDrivenBone.quaternion.copy(unsampledAnimationQuaternion);
  captureHumanoidV2HeldWeaponPoseRuntime(heldWeaponPoseRuntime);
  sampledDrivenBone.quaternion.copy(solvedIkQuaternion);
  authoredDrivenBone.quaternion.copy(solvedIkQuaternion);
  restoreHumanoidV2HeldWeaponPoseRuntime(heldWeaponPoseRuntime);

  assert.ok(
    sampledDrivenBone.quaternion.angleTo(sampledAnimationQuaternion) < 0.000001,
    `Expected sampled held-weapon restore to recover the overlay pose, but delta was ${sampledDrivenBone.quaternion.angleTo(sampledAnimationQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    sampledDrivenBone.quaternion.angleTo(sampledDrivenBoneStartupQuaternion) > 0.1,
    `Expected sampled held-weapon restore to avoid snapping back to the authored startup pose, but delta was ${sampledDrivenBone.quaternion.angleTo(sampledDrivenBoneStartupQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    authoredDrivenBone.quaternion.angleTo(authoredDrivenBoneStartupQuaternion) <
      0.000001,
    `Expected authored held-weapon restore to recover the stable arm baseline, but delta was ${authoredDrivenBone.quaternion.angleTo(authoredDrivenBoneStartupQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    authoredDrivenBone.quaternion.angleTo(unsampledAnimationQuaternion) > 0.1,
    `Expected authored held-weapon restore to ignore unsampled live arm twist, but delta was ${authoredDrivenBone.quaternion.angleTo(unsampledAnimationQuaternion).toFixed(6)} radians.`
  );
});

test("captureHumanoidV2HeldWeaponPoseRuntime initializes the implicit offhand grip from grip_l_socket instead of the palm socket", async () => {
  const [
    { Bone, Group, Quaternion, Vector3 },
    { captureHumanoidV2HeldWeaponPoseRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const sceneRoot = new Group();
  const characterScene = new Group();
  const handLBone = new Bone();
  const leftGripSocketNode = new Bone();
  const leftPalmSocketNode = new Bone();
  const attachmentRoot = new Group();
  const gripLocalQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    -0.34
  );
  const palmLocalQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.41
  );

  handLBone.name = "hand_l";
  leftGripSocketNode.name = "grip_l_socket";
  leftPalmSocketNode.name = "palm_l_socket";
  handLBone.add(leftGripSocketNode);
  handLBone.add(leftPalmSocketNode);
  leftGripSocketNode.position.set(-0.08, 0.04, 0.03);
  leftGripSocketNode.quaternion.copy(gripLocalQuaternion);
  leftPalmSocketNode.position.set(-0.03, -0.02, 0.01);
  leftPalmSocketNode.quaternion.copy(palmLocalQuaternion);
  characterScene.add(handLBone);
  sceneRoot.add(characterScene);
  sceneRoot.add(attachmentRoot);
  attachmentRoot.position.set(0.18, 0.27, -0.14);
  attachmentRoot.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.23);
  sceneRoot.updateMatrixWorld(true);

  const expectedGripLocalPosition = attachmentRoot.worldToLocal(
    leftGripSocketNode.getWorldPosition(new Vector3())
  );
  const expectedPalmLocalPosition = attachmentRoot.worldToLocal(
    leftPalmSocketNode.getWorldPosition(new Vector3())
  );
  const expectedGripLocalQuaternion = attachmentRoot
    .getWorldQuaternion(new Quaternion())
    .invert()
    .multiply(leftGripSocketNode.getWorldQuaternion(new Quaternion()))
    .normalize();
  const expectedPalmLocalQuaternion = attachmentRoot
    .getWorldQuaternion(new Quaternion())
    .invert()
    .multiply(leftPalmSocketNode.getWorldQuaternion(new Quaternion()))
    .normalize();
  const attachmentRuntime = {
    attachmentRoot,
    implicitOffHandGripLocalPosition: null,
    implicitOffHandGripLocalQuaternion: null
  };

  captureHumanoidV2HeldWeaponPoseRuntime(
    {
      drivenBones: [],
      leftGripSocketNode
    },
    attachmentRuntime
  );

  assert.ok(attachmentRuntime.implicitOffHandGripLocalPosition);
  assert.ok(attachmentRuntime.implicitOffHandGripLocalQuaternion);
  assert.ok(
    attachmentRuntime.implicitOffHandGripLocalPosition.distanceTo(
      expectedGripLocalPosition
    ) < 0.000001,
    `Expected implicit offhand grip position ${attachmentRuntime.implicitOffHandGripLocalPosition.toArray()} to match left grip socket ${expectedGripLocalPosition.toArray()}.`
  );
  assert.ok(
    attachmentRuntime.implicitOffHandGripLocalPosition.distanceTo(
      expectedPalmLocalPosition
    ) > 0.01,
    `Expected implicit offhand grip position ${attachmentRuntime.implicitOffHandGripLocalPosition.toArray()} to avoid the palm socket ${expectedPalmLocalPosition.toArray()}.`
  );
  assert.ok(
    attachmentRuntime.implicitOffHandGripLocalQuaternion.angleTo(
      expectedGripLocalQuaternion
    ) < 0.000001,
    `Expected implicit offhand grip quaternion to match the left grip socket basis, but delta was ${attachmentRuntime.implicitOffHandGripLocalQuaternion.angleTo(expectedGripLocalQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    attachmentRuntime.implicitOffHandGripLocalQuaternion.angleTo(
      expectedPalmLocalQuaternion
    ) > 0.05,
    `Expected implicit offhand grip quaternion to avoid the palm socket basis, but delta was ${attachmentRuntime.implicitOffHandGripLocalQuaternion.angleTo(expectedPalmLocalQuaternion).toFixed(6)} radians.`
  );
});

test("createHeldWeaponPoseRuntime samples shoulders and elbows but restores hand grip bones from authored baselines", async () => {
  const [
    {
      Bone,
      BoxGeometry,
      Float32BufferAttribute,
      Group,
      MeshStandardMaterial,
      Skeleton,
      SkinnedMesh,
      Uint16BufferAttribute,
      Vector3
    },
    { createHeldWeaponPoseRuntime },
    {
      findMetaverseSceneBoneNode,
      findMetaverseSceneSocketNode,
      upsertMetaverseSceneSyntheticSocketNode
    }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    ),
    clientLoader.load("/src/metaverse/render/metaverse-scene-proof-node-resolvers.ts")
  ]);
  const { characterScene } = createHumanoidV2CharacterScene({
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
  const handLBone = findMetaverseSceneBoneNode(
    characterScene,
    "hand_l",
    "held weapon pose runtime test"
  );
  const handRBone = findMetaverseSceneBoneNode(
    characterScene,
    "hand_r",
    "held weapon pose runtime test"
  );

  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handLBone,
    "grip_l_socket",
    new Vector3(-0.06, 0.05, 0.01),
    false
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handLBone,
    "palm_l_socket",
    new Vector3(-0.04, 0.03, 0),
    false
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handRBone,
    "grip_r_socket",
    new Vector3(0.06, 0.05, -0.01),
    false
  );
  characterScene.updateMatrixWorld(true);

  const heldWeaponPoseRuntime = createHeldWeaponPoseRuntime(characterScene, {
    findBoneNode: findMetaverseSceneBoneNode,
    findSocketNode: findMetaverseSceneSocketNode
  });
  const restoreSourceByBoneName = new Map(
    heldWeaponPoseRuntime.drivenBones.map((drivenBone) => [
      drivenBone.bone.name,
      drivenBone.restoreSource
    ])
  );

  assert.equal(restoreSourceByBoneName.get("clavicle_l"), "sampled");
  assert.equal(restoreSourceByBoneName.get("upperarm_l"), "sampled");
  assert.equal(restoreSourceByBoneName.get("lowerarm_l"), "sampled");
  assert.equal(restoreSourceByBoneName.get("hand_l"), "sampled");
  assert.equal(restoreSourceByBoneName.get("clavicle_r"), "sampled");
  assert.equal(restoreSourceByBoneName.get("upperarm_r"), "sampled");
  assert.equal(restoreSourceByBoneName.get("lowerarm_r"), "sampled");
  assert.equal(restoreSourceByBoneName.get("hand_r"), "sampled");
});

test("createHumanoidV2PitchSelectivePistolPoseClip keeps all tracks on the neutral hold when IK owns pistol pitch response", async () => {
  const [
    { AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3 },
    { createHumanoidV2PitchSelectivePistolPoseClip }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-character-animation.ts"
    )
  ]);
  const pitchSpineQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -0.4
  );
  const neutralUpperarmQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.18
  );
  const pitchUpperarmQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    -0.6
  );
  const neutralLowerarmQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.05
  );
  const pitchLowerarmQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    -0.34
  );
  const neutralHandQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    0.08
  );
  const pitchHandQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    -0.27
  );
  const createStaticQuaternionTrack = (trackName, quaternion) =>
    new QuaternionKeyframeTrack(trackName, [0, 1], [
      ...quaternion.toArray(),
      ...quaternion.toArray()
    ]);
  const neutralClip = new AnimationClip("Pistol_Aim_Neutral", 1, [
    createStaticQuaternionTrack("spine_02.quaternion", new Quaternion()),
    createStaticQuaternionTrack("upperarm_l.quaternion", neutralUpperarmQuaternion),
    createStaticQuaternionTrack("lowerarm_l.quaternion", neutralLowerarmQuaternion),
    createStaticQuaternionTrack("hand_l.quaternion", neutralHandQuaternion)
  ]);
  const pitchClip = new AnimationClip("Pistol_Aim_Down", 1, [
    createStaticQuaternionTrack("spine_02.quaternion", pitchSpineQuaternion),
    createStaticQuaternionTrack("upperarm_l.quaternion", pitchUpperarmQuaternion),
    createStaticQuaternionTrack("lowerarm_l.quaternion", pitchLowerarmQuaternion),
    createStaticQuaternionTrack("hand_l.quaternion", pitchHandQuaternion)
  ]);

  const stabilizedClip = createHumanoidV2PitchSelectivePistolPoseClip(
    pitchClip,
    neutralClip
  );
  const stabilizedSpineTrack = stabilizedClip.tracks.find(
    (track) => track.name === "spine_02.quaternion"
  );
  const stabilizedUpperarmTrack = stabilizedClip.tracks.find(
    (track) => track.name === "upperarm_l.quaternion"
  );
  const stabilizedLowerarmTrack = stabilizedClip.tracks.find(
    (track) => track.name === "lowerarm_l.quaternion"
  );
  const stabilizedHandTrack = stabilizedClip.tracks.find(
    (track) => track.name === "hand_l.quaternion"
  );

  assert.ok(stabilizedSpineTrack instanceof QuaternionKeyframeTrack);
  assert.ok(stabilizedUpperarmTrack instanceof QuaternionKeyframeTrack);
  assert.ok(stabilizedLowerarmTrack instanceof QuaternionKeyframeTrack);
  assert.ok(stabilizedHandTrack instanceof QuaternionKeyframeTrack);
  assert.deepEqual(
    Array.from(stabilizedSpineTrack.values),
    Array.from(neutralClip.tracks[0].values)
  );
  assert.deepEqual(
    Array.from(stabilizedUpperarmTrack.values),
    Array.from(neutralClip.tracks[1].values)
  );
  assert.deepEqual(
    Array.from(stabilizedLowerarmTrack.values),
    Array.from(neutralClip.tracks[2].values)
  );
  assert.deepEqual(
    Array.from(stabilizedHandTrack.values),
    Array.from(neutralClip.tracks[3].values)
  );
});

test("syncHumanoidV2PistolPoseWeights uses neutral as the center pose between down and up", async () => {
  const {
    syncHumanoidV2PistolPoseWeights
  } = await clientLoader.load(
    "/src/metaverse/render/characters/metaverse-scene-character-animation.ts"
  );
  const weightsByPoseId = new Map();
  const createAction = (poseId) => ({
    enabled: false,
    setEffectiveWeight(weight) {
      weightsByPoseId.set(poseId, weight);
    }
  });
  const pistolPoseRuntime = {
    actionsByPoseId: new Map([
      ["down", createAction("down")],
      ["neutral", createAction("neutral")],
      ["up", createAction("up")]
    ])
  };
  const orientation = {
    maxPitchRadians: 1,
    minPitchRadians: -1
  };
  const assertWeight = (poseId, expectedWeight) => {
    assert.ok(
      Math.abs((weightsByPoseId.get(poseId) ?? 0) - expectedWeight) < 0.000001,
      `Expected ${poseId} weight ${(weightsByPoseId.get(poseId) ?? 0).toFixed(6)} to match ${expectedWeight.toFixed(6)}.`
    );
  };

  syncHumanoidV2PistolPoseWeights(pistolPoseRuntime, 0.35, orientation);

  assertWeight("neutral", 0.65);
  assertWeight("down", 0);
  assertWeight("up", 0.35);

  syncHumanoidV2PistolPoseWeights(pistolPoseRuntime, 0, orientation);

  assertWeight("neutral", 1);
  assertWeight("down", 0);
  assertWeight("up", 0);

  syncHumanoidV2PistolPoseWeights(pistolPoseRuntime, -0.6, orientation);

  assertWeight("neutral", 0.4);
  assertWeight("down", 0.6);
  assertWeight("up", 0);
});

test("createMetaverseScene layers humanoid_v2 pistol pitch over walk locally and remotely", async () => {
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
      Vector3
    },
    { createMetaverseScene },
    { metaverseRuntimeConfig }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load("/src/metaverse/render/webgpu-metaverse-scene.ts"),
    clientLoader.load("/src/metaverse/config/metaverse-runtime.ts")
  ]);

  const bodyGeometry = new BoxGeometry(0.42, 1.86, 0.28);
  const vertexCount = bodyGeometry.attributes.position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices[index * 4] = 0;
    skinWeights[index * 4] = 1;
  }

  bodyGeometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  bodyGeometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));

  const bonesByName = new Map();
  const addBone = (boneName, parentBone = null, position = null) => {
    const bone = new Bone();

    bone.name = boneName;
    if (position !== null) {
      bone.position.copy(position);
    }

    bonesByName.set(boneName, bone);
    parentBone?.add(bone);

    return bone;
  };

  const rootBone = addBone("root");
  const pelvisBone = addBone("pelvis", rootBone, new Vector3(0, 0.92, 0));
  const spine01Bone = addBone("spine_01", pelvisBone, new Vector3(0, 0.18, 0));
  const spine02Bone = addBone("spine_02", spine01Bone, new Vector3(0, 0.18, 0));
  const spine03Bone = addBone("spine_03", spine02Bone, new Vector3(0, 0.18, 0));
  const neckBone = addBone("neck_01", spine03Bone, new Vector3(0, 0.16, 0));
  const headBone = addBone("head", neckBone, new Vector3(0, 0.14, 0));
  const clavicleLBone = addBone("clavicle_l", spine03Bone, new Vector3(-0.12, 0.1, 0));
  const upperarmLBone = addBone("upperarm_l", clavicleLBone, new Vector3(-0.18, 0, 0));
  const lowerarmLBone = addBone("lowerarm_l", upperarmLBone, new Vector3(-0.22, 0, 0));
  const handLBone = addBone("hand_l", lowerarmLBone, new Vector3(-0.18, 0, 0));
  const clavicleRBone = addBone("clavicle_r", spine03Bone, new Vector3(0.12, 0.1, 0));
  const upperarmRBone = addBone("upperarm_r", clavicleRBone, new Vector3(0.18, 0, 0));
  const lowerarmRBone = addBone("lowerarm_r", upperarmRBone, new Vector3(0.22, 0, 0));
  const handRBone = addBone("hand_r", lowerarmRBone, new Vector3(0.18, 0, 0));
  const thighLBone = addBone("thigh_l", pelvisBone, new Vector3(-0.1, -0.26, 0));
  const calfLBone = addBone("calf_l", thighLBone, new Vector3(0, -0.42, 0));
  const footLBone = addBone("foot_l", calfLBone, new Vector3(0, -0.4, 0.06));
  const ballLBone = addBone("ball_l", footLBone, new Vector3(0, 0, 0.12));
  const thighRBone = addBone("thigh_r", pelvisBone, new Vector3(0.1, -0.26, 0));
  const calfRBone = addBone("calf_r", thighRBone, new Vector3(0, -0.42, 0));
  const footRBone = addBone("foot_r", calfRBone, new Vector3(0, -0.4, 0.06));
  const ballRBone = addBone("ball_r", footRBone, new Vector3(0, 0, 0.12));

  addBone("thumb_01_l", handLBone, new Vector3(-0.04, -0.02, 0.06));
  addBone("index_01_l", handLBone, new Vector3(-0.1, 0, 0.03));
  addBone("middle_01_l", handLBone, new Vector3(-0.11, 0, 0));
  addBone("ring_01_l", handLBone, new Vector3(-0.1, 0, -0.03));
  addBone("pinky_01_l", handLBone, new Vector3(-0.08, 0, -0.05));
  addBone("thumb_01_r", handRBone, new Vector3(0.04, -0.02, 0.06));
  const index01RBone = addBone("index_01_r", handRBone, new Vector3(0.1, 0, 0.03));
  const index02RBone = addBone("index_02_r", index01RBone, new Vector3(0.055, -0.004, -0.004));
  addBone("index_03_r", index02RBone, new Vector3(0.04, -0.004, -0.003));
  addBone("middle_01_r", handRBone, new Vector3(0.11, 0, 0));
  addBone("ring_01_r", handRBone, new Vector3(0.1, 0, -0.03));
  addBone("pinky_01_r", handRBone, new Vector3(0.08, 0, -0.05));

  const headSocketBone = addBone("head_socket", headBone, new Vector3(0, 0.12, 0));
  const handLSocketBone = addBone("hand_l_socket", handLBone, new Vector3(-0.05, 0, 0));
  const handRSocketBone = addBone(
    "hand_r_socket",
    handRBone,
    new Vector3(0.159, -0.031, 0.023)
  );
  const hipSocketBone = addBone("hip_socket", pelvisBone, new Vector3(0.16, -0.08, -0.06));
  const seatSocketBone = addBone("seat_socket", pelvisBone, new Vector3(0, -0.02, -0.08));

  upperarmLBone.quaternion.setFromUnitVectors(
    new Vector3(-1, 0, 0),
    new Vector3(0.28, -0.04, -0.96).normalize()
  );
  lowerarmLBone.quaternion.setFromUnitVectors(
    new Vector3(-1, 0, 0),
    new Vector3(0.68, -0.02, -0.73).normalize()
  );
  upperarmRBone.quaternion.setFromUnitVectors(
    new Vector3(1, 0, 0),
    new Vector3(0.64, -0.04, -0.77).normalize()
  );
  lowerarmRBone.quaternion.setFromUnitVectors(
    new Vector3(1, 0, 0),
    new Vector3(0.9, -0.02, -0.44).normalize()
  );

  const skinnedMesh = new SkinnedMesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0x9ca3af })
  );
  const characterScene = new Group();
  const skeleton = new Skeleton([
    rootBone,
    pelvisBone,
    spine01Bone,
    spine02Bone,
    spine03Bone,
    neckBone,
    headBone,
    clavicleLBone,
    upperarmLBone,
    lowerarmLBone,
    handLBone,
    clavicleRBone,
    upperarmRBone,
    lowerarmRBone,
    handRBone,
    thighLBone,
    calfLBone,
    footLBone,
    ballLBone,
    thighRBone,
    calfRBone,
    footRBone,
    ballRBone,
    bonesByName.get("thumb_01_l"),
    bonesByName.get("index_01_l"),
    bonesByName.get("middle_01_l"),
    bonesByName.get("ring_01_l"),
    bonesByName.get("pinky_01_l"),
    bonesByName.get("thumb_01_r"),
    bonesByName.get("index_01_r"),
    bonesByName.get("index_02_r"),
    bonesByName.get("index_03_r"),
    bonesByName.get("middle_01_r"),
    bonesByName.get("ring_01_r"),
    bonesByName.get("pinky_01_r"),
    headSocketBone,
    handLSocketBone,
    handRSocketBone,
    hipSocketBone,
    seatSocketBone
  ]);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);
  characterScene.add(skinnedMesh);

  const authoredAnimationPackPath =
    "/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb";
  const pistolPoseAnimationPackPath =
    "/models/metaverse/characters/all_pistol_animations.glb";
  const createStaticQuaternionTrack = (trackName, quaternion) =>
    new QuaternionKeyframeTrack(trackName, [0, 1], [
      ...quaternion.toArray(),
      ...quaternion.toArray()
    ]);
  const idleClip = new AnimationClip("idle", 1, [
    createStaticQuaternionTrack("thigh_r.quaternion", new Quaternion())
  ]);
  const walkClip = new AnimationClip("walk", 1, [
    createStaticQuaternionTrack(
      "upperarm_r.quaternion",
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.55)
    ),
    createStaticQuaternionTrack(
      "thigh_r.quaternion",
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.22)
    )
  ]);
  const pistolAimDownClip = new AnimationClip("Pistol_Aim_Down", 1, [
    createStaticQuaternionTrack(
      "clavicle_r.quaternion",
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.18)
    )
  ]);
  const pistolAimNeutralClip = new AnimationClip("Pistol_Aim_Neutral", 1, [
    createStaticQuaternionTrack("clavicle_r.quaternion", new Quaternion())
  ]);
  const pistolAimUpClip = new AnimationClip("Pistol_Aim_Up", 1, [
    createStaticQuaternionTrack(
      "clavicle_r.quaternion",
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.18)
    )
  ]);
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );
  const adsCameraAnchor = new Group();
  const forwardMarker = new Group();
  const gripHandSocket = new Group();
  const triggerMarker = new Group();
  const upMarker = new Group();

  attachmentMesh.position.set(0.16, 0, 0);
  attachmentScene.name = "metaverse_service_pistol_root";
  adsCameraAnchor.name = "metaverse_service_pistol_ads_camera_anchor";
  adsCameraAnchor.position.set(0.016, 0.059, 0);
  forwardMarker.name = "metaverse_service_pistol_forward_marker";
  forwardMarker.position.set(1, 0, 0);
  gripHandSocket.name = "metaverse_service_pistol_grip_hand_r_socket";
  gripHandSocket.position.set(0.052, -0.055, 0);
  triggerMarker.name = "metaverse_service_pistol_trigger_marker";
  triggerMarker.position.set(0.088, -0.032, 0);
  upMarker.name = "metaverse_service_pistol_up_marker";
  upMarker.position.set(0, 1, 0);
  attachmentScene.add(
    attachmentMesh,
    adsCameraAnchor,
    forwardMarker,
    gripHandSocket,
    triggerMarker,
    upMarker
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        adsCameraAnchorNodeName: "metaverse_service_pistol_ads_camera_anchor",
        attachmentSocketNodeName: "metaverse_service_pistol_grip_hand_r_socket",
        forwardReferenceNodeName: "metaverse_service_pistol_forward_marker",
        offHandSupportPointId: null,
        socketName: "grip_r_socket",
        triggerMarkerNodeName: "metaverse_service_pistol_trigger_marker",
        upReferenceNodeName: "metaverse_service_pistol_up_marker"
      },
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
      mountedHolsterMount: null,
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
        }
      ],
      characterId: "mesh2motion-humanoid-v1",
      humanoidV2PistolPoseProofConfig: {
        clipNamesByPoseId: {
          down: "Pistol_Aim_Down",
          neutral: "Pistol_Aim_Neutral",
          up: "Pistol_Aim_Up"
        },
        sourcePath: pistolPoseAnimationPackPath
      },
      label: "Mesh2Motion humanoid",
      modelPath: "/models/metaverse/characters/mesh2motion-humanoid.glb",
      skeletonId: "humanoid_v2",
      socketNames: [
        "hand_r_socket",
        "hand_l_socket",
        "head_socket",
        "hip_socket",
        "seat_socket"
      ]
    },
    createSceneAssetLoader: () => ({
      async loadAsync(path) {
        if (path === "/models/metaverse/attachments/metaverse-service-pistol.gltf") {
          return {
            animations: [],
            scene: attachmentScene
          };
        }

        if (path === authoredAnimationPackPath) {
          return {
            animations: [idleClip, walkClip],
            scene: new Group()
          };
        }

        if (path === pistolPoseAnimationPackPath) {
          return {
            animations: [
              pistolAimDownClip,
              pistolAimNeutralClip,
              pistolAimUpClip
            ],
            scene: new Group()
          };
        }

        return {
          animations: [],
          scene: characterScene
        };
      }
    }),
    warn() {}
  });

  await sceneRuntime.boot();

  sceneRuntime.scene.updateMatrixWorld(true);

  const initialLeftSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_l_support"
  );
  const initialRightSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_r_support"
  );

  assert.equal(initialLeftSupportPointNode, undefined);
  assert.equal(initialRightSupportPointNode, undefined);

  const lookDirection = new Vector3(0.14, 0.12, -0.982601648);
  const normalizedLookDirection = lookDirection.clone().normalize();
  const resolvePointToLookRayDistance = (point, origin, direction) => {
    const pointOffset = point.clone().sub(origin);

    return pointOffset
      .addScaledVector(direction, -pointOffset.dot(direction))
      .length();
  };

  const cameraSnapshot = {
    lookDirection: {
      x: normalizedLookDirection.x,
      y: normalizedLookDirection.y,
      z: normalizedLookDirection.z
    },
    pitchRadians: 0.12,
    position: { x: 0, y: 1.62, z: -0.12 },
    yawRadians: 0
  };
  const characterPresentation = {
    animationVocabulary: "walk",
    position: { x: 0, y: 0, z: 0 },
    yawRadians: 0
  };
  const traversalCameraPosition = new Vector3(
    cameraSnapshot.position.x,
    cameraSnapshot.position.y,
    cameraSnapshot.position.z
  );

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    16,
    1 / 60,
    characterPresentation,
    []
  );

  sceneRuntime.scene.updateMatrixWorld(true);

  const attachmentRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment/metaverse-service-pistol-v1"
  );
  const adsCameraAnchorNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_ads_camera_anchor"
  );
  const gripHandSocketNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_grip_hand_r_socket"
  );
  const forwardMarkerNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_forward_marker"
  );
  const triggerMarkerNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_trigger_marker"
  );
  const upMarkerNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_up_marker"
  );
  const leftSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_l_support"
  );
  const leftGripSocketNode = sceneRuntime.scene.getObjectByName("grip_l_socket");
  const leftPalmSocketNode = sceneRuntime.scene.getObjectByName("palm_l_socket");
  const rightSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_r_support"
  );
  const rightGripSocketNode = sceneRuntime.scene.getObjectByName("grip_r_socket");
  const rightTriggerContactNode = sceneRuntime.scene.getObjectByName("index_03_r");

  assert.ok(attachmentRoot);
  assert.ok(adsCameraAnchorNode);
  assert.ok(gripHandSocketNode);
  assert.ok(forwardMarkerNode);
  assert.ok(triggerMarkerNode);
  assert.ok(upMarkerNode);
  assert.equal(leftSupportPointNode, undefined);
  assert.equal(rightSupportPointNode, undefined);
  assert.ok(leftGripSocketNode);
  assert.ok(leftPalmSocketNode);
  assert.ok(rightGripSocketNode);
  assert.ok(rightTriggerContactNode);

  const initialWeaponForward = forwardMarkerNode
    .getWorldPosition(new Vector3())
    .sub(gripHandSocketNode.getWorldPosition(new Vector3()))
    .normalize();
  const renderedCameraPosition = sceneRuntime.camera.position.clone();
  const targetGripUp = new Vector3(0, 1, 0);

  targetGripUp.addScaledVector(
    normalizedLookDirection,
    -targetGripUp.dot(normalizedLookDirection)
  );
  targetGripUp.normalize();
  const rightHandForward = new Vector3(1, 0, 0)
    .applyQuaternion(rightGripSocketNode.getWorldQuaternion(new Quaternion()))
    .normalize();
  const rightHandUp = new Vector3(0, 1, 0)
    .applyQuaternion(rightGripSocketNode.getWorldQuaternion(new Quaternion()))
    .normalize();
  const initialLeftPalmLocalPosition = attachmentRoot.worldToLocal(
    leftPalmSocketNode.getWorldPosition(new Vector3())
  );
  const initialLeftGripLocalPosition = attachmentRoot.worldToLocal(
    leftGripSocketNode.getWorldPosition(new Vector3())
  );
  const rightTriggerContactWorldPosition = rightTriggerContactNode.getWorldPosition(
    new Vector3()
  );
  const triggerMarkerWorldPosition = triggerMarkerNode.getWorldPosition(
    new Vector3()
  );
  const adsCameraAnchorWorldPosition = adsCameraAnchorNode.getWorldPosition(
    new Vector3()
  );
  const forwardMarkerWorldPosition = forwardMarkerNode.getWorldPosition(new Vector3());
  const upMarkerWorldPosition = upMarkerNode.getWorldPosition(new Vector3());
  const weaponUpDirection = upMarkerWorldPosition
    .sub(gripHandSocketNode.getWorldPosition(new Vector3()))
    .normalize();
  const gripCameraForwardDistance = gripHandSocketNode
    .getWorldPosition(new Vector3())
    .sub(traversalCameraPosition)
    .dot(normalizedLookDirection);
  const shoulderAnchoredGripPosition = clavicleRBone
    .getWorldPosition(new Vector3())
    .clone()
    .addScaledVector(normalizedLookDirection, 0.42);
  const resolveElbowFlexionRadians = (upperarmBone, lowerarmBone, handBone) => {
    const elbowWorldPosition = lowerarmBone.getWorldPosition(new Vector3());
    const elbowToShoulder = upperarmBone
      .getWorldPosition(new Vector3())
      .sub(elbowWorldPosition);
    const elbowToHand = handBone.getWorldPosition(new Vector3()).sub(elbowWorldPosition);

    return Math.PI - elbowToShoulder.angleTo(elbowToHand);
  };
  const leftElbowFlexionRadians = resolveElbowFlexionRadians(
    upperarmLBone,
    lowerarmLBone,
    handLBone
  );
  const rightElbowFlexionRadians = resolveElbowFlexionRadians(
    upperarmRBone,
    lowerarmRBone,
    handRBone
  );

  assert.ok(
    initialWeaponForward.angleTo(normalizedLookDirection) < 0.28,
    `Expected weapon forward ${initialWeaponForward.toArray()} to track camera look ${normalizedLookDirection.toArray()}.`
  );
  assert.ok(
    weaponUpDirection.angleTo(targetGripUp) < 0.12,
    `Expected weapon up ${weaponUpDirection.toArray()} to stay upright against ${targetGripUp.toArray()}.`
  );
  assert.ok(
    gripCameraForwardDistance > 0,
    `Expected authored grip ${gripHandSocketNode.getWorldPosition(new Vector3()).toArray()} to stay in front of the traversal camera ${traversalCameraPosition.toArray()} along look ${normalizedLookDirection.toArray()}, but forward distance was ${gripCameraForwardDistance.toFixed(4)} meters.`
  );
  assert.ok(
    rightGripSocketNode
      .getWorldPosition(new Vector3())
      .distanceTo(shoulderAnchoredGripPosition) < 0.08,
    `Expected right grip ${rightGripSocketNode.getWorldPosition(new Vector3()).toArray()} to stay near the right-shoulder hold ${shoulderAnchoredGripPosition.toArray()}.`
  );
  assert.ok(
    adsCameraAnchorWorldPosition.distanceTo(traversalCameraPosition) > 0.08,
    `Expected hip-fire ADS camera anchor ${adsCameraAnchorWorldPosition.toArray()} to stay offset from traversal camera ${traversalCameraPosition.toArray()} instead of snapping onto it.`
  );
  assert.ok(
    rightHandForward.angleTo(normalizedLookDirection) < 0.14,
    `Expected right hand forward ${rightHandForward.toArray()} to track camera look ${normalizedLookDirection.toArray()}.`
  );
  assert.ok(
    rightHandUp.angleTo(targetGripUp) < 0.12,
    `Expected right hand up ${rightHandUp.toArray()} to stay upright against ${targetGripUp.toArray()}.`
  );
  assert.ok(
    rightTriggerContactWorldPosition.distanceTo(triggerMarkerWorldPosition) < 0.05,
    `Expected right trigger contact ${rightTriggerContactWorldPosition.toArray()} to stay near the authored trigger marker ${triggerMarkerWorldPosition.toArray()} without overextending the arm.`
  );
  assert.ok(
    triggerMarkerWorldPosition.distanceTo(
      rightGripSocketNode.getWorldPosition(new Vector3())
    ) > 0.015,
    `Expected authored trigger marker ${triggerMarkerWorldPosition.toArray()} to remain distinct from the grip-alignment hand socket target.`
  );
  assert.ok(
    gripHandSocketNode
      .getWorldPosition(new Vector3())
      .distanceTo(rightGripSocketNode.getWorldPosition(new Vector3())) < 0.000001,
    "Expected the authored weapon grip socket to align exactly with the character grip socket."
  );
  assert.ok(
    renderedCameraPosition.distanceTo(traversalCameraPosition) < 0.000001,
    `Expected rendered held-weapon camera ${renderedCameraPosition.toArray()} to stay locked to the raw traversal camera ${traversalCameraPosition.toArray()}.`
  );
  assert.ok(
    leftElbowFlexionRadians > 0.03,
    `Expected left elbow to avoid fully locking in the held-weapon pose, but flexion was ${leftElbowFlexionRadians.toFixed(4)} radians.`
  );
  assert.ok(
    rightElbowFlexionRadians > 0.16,
    `Expected right elbow to stay bent in the held-weapon pose, but flexion was ${rightElbowFlexionRadians.toFixed(4)} radians.`
  );
  assert.ok(
    spine01Bone.quaternion.angleTo(new Quaternion()) < 0.001,
    `Expected lower torso spine_01 bend to stay near authored pose, but angle was ${spine01Bone.quaternion.angleTo(new Quaternion()).toFixed(4)} radians.`
  );
  assert.ok(
    spine02Bone.quaternion.angleTo(new Quaternion()) < 0.001,
    `Expected lower torso spine_02 bend to stay near authored pose, but angle was ${spine02Bone.quaternion.angleTo(new Quaternion()).toFixed(4)} radians.`
  );
  assert.ok(
    spine03Bone.quaternion.angleTo(new Quaternion()) < 0.02,
    `Expected upper torso spine_03 bend to stay controlled, but angle was ${spine03Bone.quaternion.angleTo(new Quaternion()).toFixed(4)} radians.`
  );

  for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
    sceneRuntime.syncPresentation(
      cameraSnapshot,
      null,
      32 + frameIndex * 16,
      1 / 60,
      characterPresentation,
      []
    );
  }

  sceneRuntime.scene.updateMatrixWorld(true);

  const repeatedWeaponForward = forwardMarkerNode
    .getWorldPosition(new Vector3())
    .sub(gripHandSocketNode.getWorldPosition(new Vector3()))
    .normalize();
  const repeatedLeftHandScale = handLBone.getWorldScale(new Vector3());

  assert.ok(
    repeatedWeaponForward.angleTo(initialWeaponForward) < 0.02,
    `Expected held weapon forward to stay stable across repeated standing frames, but delta was ${repeatedWeaponForward.angleTo(initialWeaponForward).toFixed(4)} radians.`
  );
  assert.ok(
    repeatedLeftHandScale.distanceTo(new Vector3(1, 1, 1)) < 0.000001,
    `Expected left hand world scale ${repeatedLeftHandScale.toArray()} to stay normalized across repeated standing frames.`
  );

  const pitchedLookDirection = new Vector3(0.1, -0.42, -0.9).normalize();

  sceneRuntime.syncPresentation(
    {
      lookDirection: {
        x: pitchedLookDirection.x,
        y: pitchedLookDirection.y,
        z: pitchedLookDirection.z
      },
      pitchRadians: -0.4,
      position: { x: 0, y: 1.62, z: -0.12 },
      yawRadians: 0
    },
    null,
    176,
    1 / 60,
    characterPresentation,
    []
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const pitchedLeftPalmLocalPosition = attachmentRoot.worldToLocal(
    leftPalmSocketNode.getWorldPosition(new Vector3())
  );
  const pitchedLeftGripLocalPosition = attachmentRoot.worldToLocal(
    leftGripSocketNode.getWorldPosition(new Vector3())
  );

  assert.ok(
    pitchedLeftPalmLocalPosition.distanceTo(initialLeftPalmLocalPosition) < 0.24,
    `Expected left-hand palm ${pitchedLeftPalmLocalPosition.toArray()} to stay anchored near ${initialLeftPalmLocalPosition.toArray()} across pitch changes.`
  );
  assert.ok(
    pitchedLeftGripLocalPosition.distanceTo(initialLeftGripLocalPosition) < 0.24,
    `Expected left-hand grip ${pitchedLeftGripLocalPosition.toArray()} to stay anchored near ${initialLeftGripLocalPosition.toArray()} across pitch changes.`
  );

  const createRemoteAimCameraSnapshot = (position, pitchRadians, yawRadians) => {
    const lookDirection = new Vector3(
      Math.sin(yawRadians) * Math.cos(pitchRadians),
      Math.sin(pitchRadians),
      -Math.cos(yawRadians) * Math.cos(pitchRadians)
    ).normalize();

    return Object.freeze({
      lookDirection: Object.freeze({
        x: lookDirection.x,
        y: lookDirection.y,
        z: lookDirection.z
      }),
      pitchRadians,
      position: Object.freeze({
        x:
          position.x +
          Math.sin(yawRadians) *
            metaverseRuntimeConfig.bodyPresentation
              .groundedFirstPersonForwardOffsetMeters,
        y:
          position.y + metaverseRuntimeConfig.groundedBody.eyeHeightMeters,
        z:
          position.z -
          Math.cos(yawRadians) *
            metaverseRuntimeConfig.bodyPresentation
              .groundedFirstPersonForwardOffsetMeters
      }),
      yawRadians
    });
  };
  const remotePitchUpPresentation = Object.freeze({
    aimCamera: createRemoteAimCameraSnapshot(
      Object.freeze({
        x: 1.5,
        y: 0,
        z: -1
      }),
      0.45,
      0
    ),
    characterId: "mesh2motion-humanoid-v1",
    look: Object.freeze({
      pitchRadians: 0.45,
      yawRadians: 0
    }),
    mountedOccupancy: null,
    playerId: "remote-aimer",
    poseSyncMode: "runtime-server-sampled",
    presentation: Object.freeze({
      animationVocabulary: "walk",
      position: Object.freeze({
        x: 1.5,
        y: 0,
        z: -1
      }),
      yawRadians: 0
    })
  });

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    160,
    1 / 60,
    characterPresentation,
    [remotePitchUpPresentation]
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const remoteCharacterRoot = sceneRuntime.scene.getObjectByName(
    "metaverse_character/mesh2motion-humanoid-v1/remote-aimer"
  );
  const remoteAttachmentRoot =
    remoteCharacterRoot?.getObjectByName(
      "metaverse_attachment/metaverse-service-pistol-v1"
    ) ?? null;
  const remoteClavicleBone =
    remoteCharacterRoot?.getObjectByName("clavicle_r") ?? null;
  const remoteHeadBone = remoteCharacterRoot?.getObjectByName("head") ?? null;
  const remotePitchUpLookDirection = new Vector3(
    0,
    Math.sin(0.45),
    -Math.cos(0.45)
  ).normalize();

  assert.ok(remoteCharacterRoot);
  assert.ok(remoteAttachmentRoot);
  assert.ok(remoteClavicleBone);
  assert.ok(remoteHeadBone);

  const remoteHeadNeutralQuaternion = remoteHeadBone.quaternion.clone();
  const remoteClaviclePitchUpQuaternion = remoteClavicleBone.quaternion.clone();
  const remoteWeaponPitchUpForward = new Vector3(1, 0, 0)
    .applyQuaternion(remoteAttachmentRoot.getWorldQuaternion(new Quaternion()))
    .normalize();

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    176,
    1 / 60,
    characterPresentation,
    [
      Object.freeze({
        ...remotePitchUpPresentation,
        aimCamera: createRemoteAimCameraSnapshot(
          remotePitchUpPresentation.presentation.position,
          -0.45,
          0
        ),
        look: Object.freeze({
          pitchRadians: -0.45,
          yawRadians: 0
        })
      })
    ]
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const remoteClaviclePitchDownQuaternion = remoteClavicleBone.quaternion.clone();
  const remoteHeadPitchedQuaternion = remoteHeadBone.quaternion.clone();
  const remotePitchDownLookDirection = new Vector3(
    0,
    Math.sin(-0.45),
    -Math.cos(-0.45)
  ).normalize();
  const remoteWeaponPitchDownForward = new Vector3(1, 0, 0)
    .applyQuaternion(remoteAttachmentRoot.getWorldQuaternion(new Quaternion()))
    .normalize();

  assert.ok(
    remoteClaviclePitchUpQuaternion.angleTo(remoteClaviclePitchDownQuaternion) <
      0.001,
    `Expected remote humanoid_v2 clavicle pitch to stay on the neutral pistol overlay while IK owns arm pitch response, but delta was ${remoteClaviclePitchUpQuaternion.angleTo(remoteClaviclePitchDownQuaternion).toFixed(4)} radians.`
  );
  assert.ok(
    remoteHeadNeutralQuaternion.angleTo(remoteHeadPitchedQuaternion) < 0.001,
    `Expected remote humanoid_v2 head pitch to stay out of pistol aim layering, but delta was ${remoteHeadNeutralQuaternion.angleTo(remoteHeadPitchedQuaternion).toFixed(4)} radians.`
  );
  assert.ok(
    remoteWeaponPitchUpForward.angleTo(remotePitchUpLookDirection) < 0.32,
    `Expected remote weapon forward ${remoteWeaponPitchUpForward.toArray()} to track replicated up-look ${remotePitchUpLookDirection.toArray()}.`
  );
  assert.ok(
    remoteWeaponPitchDownForward.angleTo(remotePitchDownLookDirection) < 0.32,
    `Expected remote weapon forward ${remoteWeaponPitchDownForward.toArray()} to track replicated down-look ${remotePitchDownLookDirection.toArray()}.`
  );
  assert.ok(
    remoteWeaponPitchUpForward.angleTo(remoteWeaponPitchDownForward) > 0.2,
    `Expected remote weapon forward to change with replicated pitch, but delta was ${remoteWeaponPitchUpForward.angleTo(remoteWeaponPitchDownForward).toFixed(4)} radians.`
  );
});
