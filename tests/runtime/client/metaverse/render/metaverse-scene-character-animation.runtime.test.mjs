import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";

import { createClientModuleLoader } from "../../load-client-module.mjs";
import {
  createHumanoidV2CharacterScene,
  createTestBattleRifleHoldProfile,
  createTestRocketLauncherHoldProfile,
  createTestServicePistolHoldProfile
} from "../../metaverse-runtime-proof-slice-fixtures.mjs";

let clientLoader;

before(async () => {
  clientLoader = await createClientModuleLoader();
});

after(async () => {
  await clientLoader?.close();
});

test("syncCharacterAnimation uses authored jump vocabularies directly", async () => {
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
    skeletonId: "humanoid_v2"
  };

  idleAction.play();

  syncCharacterAnimation(characterRuntime, "jump-up", 1);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-up");
  assert.equal(characterRuntime.activeAnimationCycleId, 1);

  syncCharacterAnimation(characterRuntime, "jump-mid", 2);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-mid");
  assert.equal(characterRuntime.activeAnimationCycleId, 2);

  syncCharacterAnimation(characterRuntime, "jump-down", 3);
  assert.equal(characterRuntime.activeAnimationVocabulary, "jump-down");
  assert.equal(characterRuntime.activeAnimationCycleId, 3);
});

test("combat presentation keeps shots out of animation overlays and routes hit and death procedurally", async () => {
  const { triggerCharacterCombatPresentationEvent } = await clientLoader.load(
    "/src/metaverse/render/characters/metaverse-scene-character-animation.ts"
  );
  const deathRagdollEvents = [];
  const proceduralHitReactionEvents = [];
  const characterRuntime = {
    deathRagdollRuntime: {
      clear() {},
      trigger(event) {
        deathRagdollEvents.push(event);
      }
    },
    proceduralHitReactionRuntime: {
      trigger(event) {
        proceduralHitReactionEvents.push(event);
      }
    }
  };

  triggerCharacterCombatPresentationEvent(characterRuntime, {
    kind: "shot",
    playerId: "local-player",
    sequence: 1,
    startedAtMs: 10,
    weaponId: "metaverse-service-pistol-v2"
  });

  assert.equal(proceduralHitReactionEvents.length, 0);

  const hitEvent = {
    kind: "hit",
    playerId: "local-player",
    sequence: 2,
    startedAtMs: 20,
    weaponId: "metaverse-service-pistol-v2"
  };

  triggerCharacterCombatPresentationEvent(characterRuntime, hitEvent);

  assert.deepEqual(proceduralHitReactionEvents, [hitEvent]);

  const deathEvent = {
    kind: "death",
    playerId: "local-player",
    sequence: 3,
    startedAtMs: 30,
    weaponId: "metaverse-service-pistol-v2"
  };

  triggerCharacterCombatPresentationEvent(characterRuntime, deathEvent);

  assert.deepEqual(deathRagdollEvents, [deathEvent]);
});

function createFakeRagdollPhysicsRuntime() {
  const bodies = [];
  const joints = [];
  const removedBodies = [];
  const removedJoints = [];

  return {
    bodies,
    isInitialized: true,
    joints,
    removedBodies,
    removedJoints,
    createDynamicCuboidBody(halfExtents, translation, options = {}) {
      const state = {
        angularVelocity: { x: 0, y: 0, z: 0 },
        halfExtents,
        linearVelocity: { x: 0, y: 0, z: 0 },
        rotation: options.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
        translation: { ...translation }
      };
      const body = {
        state,
        linvel() {
          return state.linearVelocity;
        },
        rotation() {
          return state.rotation;
        },
        setAngvel(velocity) {
          state.angularVelocity = { ...velocity };
        },
        setLinvel(velocity) {
          state.linearVelocity = { ...velocity };
        },
        setRotation(rotation) {
          state.rotation = { ...rotation };
        },
        setTranslation(nextTranslation) {
          state.translation = { ...nextTranslation };
        },
        translation() {
          return state.translation;
        }
      };

      bodies.push(body);

      return {
        body,
        collider: {
          setRotation() {},
          setTranslation() {},
          translation() {
            return state.translation;
          }
        }
      };
    },
    createSphericalImpulseJoint(parentBody, childBody, parentAnchor, childAnchor) {
      const joint = {
        childAnchor,
        childBody,
        handle: joints.length + 1,
        parentAnchor,
        parentBody
      };

      joints.push(joint);

      return joint;
    },
    createVector3(x, y, z) {
      return { x, y, z };
    },
    removeImpulseJoint(joint) {
      removedJoints.push(joint);
    },
    removeRigidBody(body) {
      removedBodies.push(body);
    }
  };
}

test("MetaverseCharacterRapierRagdollRuntime drives humanoid bones from Rapier bodies and joints", async () => {
  const [
    { Bone, Group, Vector3 },
    { MetaverseCharacterRapierRagdollRuntime }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-character-ragdoll.ts"
    )
  ]);
  const characterScene = new Group();
  const physicsRuntime = createFakeRagdollPhysicsRuntime();
  const addBone = (boneName, parentBone = null, position = null) => {
    const bone = new Bone();

    bone.name = boneName;
    if (position !== null) {
      bone.position.copy(position);
    }

    if (parentBone === null) {
      characterScene.add(bone);
    } else {
      parentBone.add(bone);
    }

    return bone;
  };

  const root = addBone("root");
  const pelvis = addBone("pelvis", root, new Vector3(0, 0.94, 0));
  const spine01 = addBone("spine_01", pelvis, new Vector3(0, 0.16, 0));
  const spine02 = addBone("spine_02", spine01, new Vector3(0, 0.17, 0));
  const spine03 = addBone("spine_03", spine02, new Vector3(0, 0.18, 0));
  const neck = addBone("neck_01", spine03, new Vector3(0, 0.12, 0));
  const head = addBone("head", neck, new Vector3(0, 0.12, 0));
  addBone("head_leaf", head, new Vector3(0, 0.14, 0));
  const clavicleL = addBone("clavicle_l", spine03, new Vector3(-0.11, 0.08, 0));
  const upperarmL = addBone("upperarm_l", clavicleL, new Vector3(-0.17, 0, 0));
  const lowerarmL = addBone("lowerarm_l", upperarmL, new Vector3(-0.22, 0, 0));
  const handL = addBone("hand_l", lowerarmL, new Vector3(-0.17, 0, 0));
  addBone("middle_01_l", handL, new Vector3(-0.045, 0.04, 0));
  const clavicleR = addBone("clavicle_r", spine03, new Vector3(0.11, 0.08, 0));
  const upperarmR = addBone("upperarm_r", clavicleR, new Vector3(0.17, 0, 0));
  const lowerarmR = addBone("lowerarm_r", upperarmR, new Vector3(0.22, 0, 0));
  const handR = addBone("hand_r", lowerarmR, new Vector3(0.17, 0, 0));
  addBone("middle_01_r", handR, new Vector3(0.045, 0.04, 0));
  const thighL = addBone("thigh_l", pelvis, new Vector3(-0.09, -0.12, 0));
  const calfL = addBone("calf_l", thighL, new Vector3(0, -0.39, 0));
  const footL = addBone("foot_l", calfL, new Vector3(0, -0.36, 0.03));
  addBone("ball_l", footL, new Vector3(0, -0.03, 0.15));
  const thighR = addBone("thigh_r", pelvis, new Vector3(0.09, -0.12, 0));
  const calfR = addBone("calf_r", thighR, new Vector3(0, -0.39, 0));
  const footR = addBone("foot_r", calfR, new Vector3(0, -0.36, 0.03));
  addBone("ball_r", footR, new Vector3(0, -0.03, 0.15));
  characterScene.updateMatrixWorld(true);

  const pelvisStartWorld = pelvis.getWorldPosition(new Vector3());
  const ragdollRuntime = new MetaverseCharacterRapierRagdollRuntime({
    characterScene,
    physicsRuntime
  });

  ragdollRuntime.trigger({
    damageSourceDirectionWorld: {
      x: 1,
      y: 0,
      z: 0
    },
    kind: "death",
    playerId: "local-player",
    sequence: 4,
    startedAtMs: 100,
    weaponId: "metaverse-service-pistol-v2"
  });

  assert.equal(ragdollRuntime.isActive, true);
  assert.equal(physicsRuntime.bodies.length, 17);
  assert.equal(physicsRuntime.joints.length, 16);
  assert.ok(physicsRuntime.bodies[0].state.halfExtents.x > 0);
  assert.ok(physicsRuntime.bodies[0].state.halfExtents.y > 0);
  assert.ok(physicsRuntime.bodies[0].state.halfExtents.z > 0);
  assert.ok(physicsRuntime.bodies[0].state.linearVelocity.x < 0);

  physicsRuntime.bodies[0].setTranslation({
    ...physicsRuntime.bodies[0].state.translation,
    x: physicsRuntime.bodies[0].state.translation.x - 0.42
  });
  ragdollRuntime.apply(140);

  assert.ok(pelvis.getWorldPosition(new Vector3()).x < pelvisStartWorld.x - 0.3);

  ragdollRuntime.clear();
  assert.equal(ragdollRuntime.isActive, false);
  assert.ok(
    pelvis.getWorldPosition(new Vector3()).distanceTo(pelvisStartWorld) < 0.000001
  );
  assert.equal(physicsRuntime.removedBodies.length, 17);
  assert.equal(physicsRuntime.removedJoints.length, 16);
});

test("product metaverse runtime does not consume legacy pistol aim pose identifiers", async () => {
  const repoRoot = process.cwd();
  const runtimeRoot = path.join(repoRoot, "client/src/metaverse");
  const forbiddenPatterns = [
    "Pistol_Aim_",
    "Pistol_Idle_Loop",
    "Pistol_Reload",
    "Pistol_Shoot",
    "humanoidV2Pistol",
    "held_object_lower_body",
    "actor_forward_fallback"
  ];
  const runtimeFiles = [];
  const collectRuntimeFiles = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await collectRuntimeFiles(entryPath);
        continue;
      }

      if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".mjs")
      ) {
        runtimeFiles.push(entryPath);
      }
    }
  };

  await collectRuntimeFiles(runtimeRoot);

  for (const filePath of runtimeFiles) {
    const sourceText = await readFile(filePath, "utf8");

    for (const forbiddenPattern of forbiddenPatterns) {
      assert.equal(
        sourceText.includes(forbiddenPattern),
        false,
        `Product runtime file ${path.relative(repoRoot, filePath)} must not consume legacy held-object aim pose identifier ${forbiddenPattern}.`
      );
    }
  }
});

test("held weapon pose runtime restores sampled local TRS baselines", async () => {
  const [
    { Bone, Quaternion, Vector3 },
    {
      captureHumanoidV2HeldWeaponPoseRuntime,
      prepareHumanoidV2HeldWeaponPoseRuntime,
      restoreHumanoidV2HeldWeaponPoseRuntime
    }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const drivenBone = new Bone();
  const sampledAnimationPosition = new Vector3(0.12, 0.2, -0.08);
  const sampledAnimationQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.42
  );
  const sampledAnimationScale = new Vector3(1.1, 0.95, 1.05);
  const rigNeutralPosition = new Vector3(0.02, -0.03, 0.04);
  const rigNeutralQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    0.18
  );
  const rigNeutralScale = new Vector3(1, 1, 1);
  const solvedIkPosition = new Vector3(-0.4, 0.7, 0.2);
  const solvedIkQuaternion = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    -0.77
  );
  const solvedIkScale = new Vector3(0.7, 1.4, 1.2);
  const heldWeaponPoseRuntime = {
    drivenBones: [
      {
        bone: drivenBone,
        rigNeutralLocalPosition: rigNeutralPosition.clone(),
        rigNeutralLocalQuaternion: rigNeutralQuaternion.clone(),
        rigNeutralLocalScale: rigNeutralScale.clone(),
        sampledLocalPosition: new Vector3(),
        sampledLocalQuaternion: new Quaternion(),
        sampledLocalScale: new Vector3(),
        solveStartLocalPosition: new Vector3(),
        solveStartLocalQuaternion: new Quaternion(),
        solveStartLocalScale: new Vector3()
      }
    ]
  };

  drivenBone.position.copy(solvedIkPosition);
  drivenBone.quaternion.copy(solvedIkQuaternion);
  drivenBone.scale.copy(solvedIkScale);
  prepareHumanoidV2HeldWeaponPoseRuntime(heldWeaponPoseRuntime);

  assert.ok(
    drivenBone.position.distanceTo(rigNeutralPosition) < 0.000001,
    "Expected pre-mixer held-weapon prepare to restore rig-neutral position."
  );
  assert.ok(
    drivenBone.quaternion.angleTo(rigNeutralQuaternion) < 0.000001,
    "Expected pre-mixer held-weapon prepare to restore rig-neutral rotation."
  );
  assert.ok(
    drivenBone.scale.distanceTo(rigNeutralScale) < 0.000001,
    "Expected pre-mixer held-weapon prepare to restore rig-neutral scale."
  );

  drivenBone.position.copy(sampledAnimationPosition);
  drivenBone.quaternion.copy(sampledAnimationQuaternion);
  drivenBone.scale.copy(sampledAnimationScale);
  captureHumanoidV2HeldWeaponPoseRuntime(heldWeaponPoseRuntime);
  drivenBone.position.copy(solvedIkPosition);
  drivenBone.quaternion.copy(solvedIkQuaternion);
  drivenBone.scale.copy(solvedIkScale);
  restoreHumanoidV2HeldWeaponPoseRuntime(heldWeaponPoseRuntime);

  assert.ok(
    drivenBone.position.distanceTo(sampledAnimationPosition) < 0.000001,
    `Expected sampled held-weapon restore to recover local position ${sampledAnimationPosition.toArray()}, but got ${drivenBone.position.toArray()}.`
  );
  assert.ok(
    drivenBone.quaternion.angleTo(sampledAnimationQuaternion) < 0.000001,
    `Expected sampled held-weapon restore to recover local rotation, but delta was ${drivenBone.quaternion.angleTo(sampledAnimationQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    drivenBone.scale.distanceTo(sampledAnimationScale) < 0.000001,
    `Expected sampled held-weapon restore to recover local scale ${sampledAnimationScale.toArray()}, but got ${drivenBone.scale.toArray()}.`
  );
});

test("resolveHeldWeaponOffHandEffectorNode separates support-palm hints from secondary grips", async () => {
  const [
    { Bone, Quaternion, Vector3 },
    { resolveHeldWeaponOffHandEffectorNode }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const handLBone = new Bone();
  const leftGripSocketNode = new Bone();
  const leftPalmSocketNode = new Bone();
  const leftSupportSocketNode = new Bone();
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
  leftSupportSocketNode.name = "support_l_socket";
  handLBone.add(leftGripSocketNode);
  handLBone.add(leftPalmSocketNode);
  handLBone.add(leftSupportSocketNode);
  leftGripSocketNode.position.set(-0.08, 0.04, 0.03);
  leftGripSocketNode.quaternion.copy(gripLocalQuaternion);
  leftPalmSocketNode.position.set(-0.03, -0.02, 0.01);
  leftPalmSocketNode.quaternion.copy(palmLocalQuaternion);
  leftSupportSocketNode.position.set(-0.01, 0.09, 0.06);
  leftSupportSocketNode.quaternion.copy(palmLocalQuaternion);
  const heldWeaponPoseRuntime =
    {
      leftGripSocketNode,
      leftPalmSocketNode,
      leftSupportSocketNode
    };

  assert.equal(
    resolveHeldWeaponOffHandEffectorNode(
      heldWeaponPoseRuntime,
      {
        secondaryCharacterSocketRole: "palm_l_socket"
      }
    ),
    leftPalmSocketNode
  );
  assert.equal(
    resolveHeldWeaponOffHandEffectorNode(
      heldWeaponPoseRuntime,
      {
        secondaryCharacterSocketRole: "support_l_socket"
      }
    ),
    leftSupportSocketNode
  );
  assert.equal(
    resolveHeldWeaponOffHandEffectorNode(
      heldWeaponPoseRuntime,
      {
        secondaryCharacterSocketRole: null
      }
    ),
    leftGripSocketNode
  );
});

test("resolveHeldWeaponMainHandEffectorNode uses the palm socket only when the held mount targets palm_r_socket", async () => {
  const [{ Bone }, { resolveHeldWeaponMainHandEffectorNode }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const rightGripSocketNode = new Bone();
  const rightPalmSocketNode = new Bone();

  rightGripSocketNode.name = "grip_r_socket";
  rightPalmSocketNode.name = "palm_r_socket";

  assert.equal(
    resolveHeldWeaponMainHandEffectorNode(
      {
        rightGripSocketNode,
        rightPalmSocketNode
      },
      {
        primaryCharacterSocketRole: "grip_r_socket"
      }
    ),
    rightGripSocketNode
  );
  assert.equal(
    resolveHeldWeaponMainHandEffectorNode(
      {
        rightGripSocketNode,
        rightPalmSocketNode
      },
      {
        primaryCharacterSocketRole: "palm_r_socket"
      }
    ),
    rightPalmSocketNode
  );
});

test("resolveHeldWeaponOffHandEffectorNode uses the support socket when an authored support marker is present", async () => {
  const [{ Bone }, { resolveHeldWeaponOffHandEffectorNode }] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
    )
  ]);
  const leftGripSocketNode = new Bone();
  const leftSupportSocketNode = new Bone();

  leftGripSocketNode.name = "grip_l_socket";
  leftSupportSocketNode.name = "support_l_socket";

  assert.equal(
    resolveHeldWeaponOffHandEffectorNode(
      {
        leftGripSocketNode,
        leftSupportSocketNode
      },
      {
        secondaryCharacterSocketRole: null
      }
    ),
    leftGripSocketNode
  );
  assert.equal(
    resolveHeldWeaponOffHandEffectorNode(
      {
        leftGripSocketNode,
        leftSupportSocketNode
      },
      {
        secondaryCharacterSocketRole: "support_l_socket"
      }
    ),
    leftSupportSocketNode
  );
});

test("createHeldWeaponPoseRuntime captures sampled TRS for held-object arms and fingers", async () => {
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
    new Vector3(-0.06, 0.05, 0.01)
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handLBone,
    "palm_l_socket",
    new Vector3(-0.04, 0.03, 0)
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handLBone,
    "support_l_socket",
    new Vector3(-0.04, 0.03, 0)
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handRBone,
    "grip_r_socket",
    new Vector3(0.06, 0.05, -0.01)
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handRBone,
    "palm_r_socket",
    new Vector3(0.04, 0.03, 0)
  );
  upsertMetaverseSceneSyntheticSocketNode(
    characterScene,
    handRBone,
    "support_r_socket",
    new Vector3(0.04, 0.03, 0)
  );
  characterScene.updateMatrixWorld(true);
  const rightGripSocketNode = findMetaverseSceneSocketNode(
    characterScene,
    "grip_r_socket"
  );
  const leftSupportSocketNode = findMetaverseSceneSocketNode(
    characterScene,
    "support_l_socket"
  );

  const heldWeaponPoseRuntime = createHeldWeaponPoseRuntime(characterScene, {
    findBoneNode: findMetaverseSceneBoneNode,
    findSocketNode: findMetaverseSceneSocketNode
  });
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.right.primary_trigger_grip,
    "Expected right primary trigger contact frame to be available."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.right.heavy_trigger_grip,
    "Expected right heavy trigger contact frame to be available."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.left.support_palm,
    "Expected left support palm contact frame to be available."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.left.support_handle_grip,
    "Expected left support handle contact frame to be available."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.left.barrel_cradle,
    "Expected barrel cradle contact frame to be available for future rocket tuning."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.right.primary_trigger_grip.node.position.distanceTo(
      rightGripSocketNode.position
    ) > 0.001,
    "Expected primary trigger grip contact frame to carry a calibrated offset from the raw grip socket."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.left.support_handle_grip.node.position.distanceTo(
      leftSupportSocketNode.position
    ) > 0.001,
    "Expected support handle contact frame to carry a calibrated offset from the raw support socket."
  );
  assert.ok(
    heldWeaponPoseRuntime.contactFrameRuntimeByHand.left.support_palm.node.quaternion.angleTo(
      heldWeaponPoseRuntime.contactFrameRuntimeByHand.right.support_palm.node.quaternion
    ) > 0.08,
    "Expected support palm contact calibration to use hand-specific orientation instead of sharing the same left/right frame."
  );
  const sampledDrivenBoneByName = new Map(
    heldWeaponPoseRuntime.drivenBones.map((drivenBone) => [
      drivenBone.bone.name,
      drivenBone
    ])
  );

  for (const boneName of [
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "thumb_01_l",
    "thumb_02_l",
    "thumb_03_l",
    "index_01_l",
    "index_02_l",
    "index_03_l",
    "middle_01_l",
    "middle_02_l",
    "middle_03_l",
    "ring_01_l",
    "ring_02_l",
    "ring_03_l",
    "pinky_01_l",
    "pinky_02_l",
    "pinky_03_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "thumb_01_r",
    "thumb_02_r",
    "thumb_03_r",
    "index_01_r",
    "index_02_r",
    "index_03_r",
    "middle_01_r",
    "middle_02_r",
    "middle_03_r",
    "ring_01_r",
    "ring_02_r",
    "ring_03_r",
    "pinky_01_r",
    "pinky_02_r",
    "pinky_03_r"
  ]) {
    const drivenBone = sampledDrivenBoneByName.get(boneName);

    assert.ok(drivenBone, `Expected ${boneName} to be held-object driven.`);
    assert.ok(
      drivenBone.sampledLocalPosition,
      `Expected ${boneName} to store sampled local position.`
    );
    assert.ok(
      drivenBone.sampledLocalQuaternion,
      `Expected ${boneName} to store sampled local rotation.`
    );
    assert.ok(
      drivenBone.sampledLocalScale,
      `Expected ${boneName} to store sampled local scale.`
    );
    assert.ok(
      drivenBone.rigNeutralLocalPosition,
      `Expected ${boneName} to store rig-neutral local position.`
    );
    assert.ok(
      drivenBone.rigNeutralLocalQuaternion,
      `Expected ${boneName} to store rig-neutral local rotation.`
    );
    assert.ok(
      drivenBone.rigNeutralLocalScale,
      `Expected ${boneName} to store rig-neutral local scale.`
    );
    assert.ok(
      drivenBone.solveStartLocalPosition,
      `Expected ${boneName} to store solve-start local position.`
    );
    assert.ok(
      drivenBone.solveStartLocalQuaternion,
      `Expected ${boneName} to store solve-start local rotation.`
    );
    assert.ok(
      drivenBone.solveStartLocalScale,
      `Expected ${boneName} to store solve-start local scale.`
    );
    assert.equal(
      "restoreSource" in drivenBone,
      false,
      `Expected ${boneName} to avoid authored/bind-pose restore source.`
    );
  }
});

test("held-object solver profiles drive grip assignment and finger pose policy", async () => {
  const {
    resolveMetaverseHeldObjectSolverProfile
  } = await clientLoader.load(
    "/src/metaverse/render/characters/metaverse-held-object-solver-profile.ts"
  );
  const { resolveActiveGripAssignment } = await clientLoader.load(
    "/src/metaverse/render/characters/metaverse-scene-held-weapon-pose.ts"
  );
  const pistolProfile = resolveMetaverseHeldObjectSolverProfile(
    createTestServicePistolHoldProfile()
  );
  const battleRifleProfile = resolveMetaverseHeldObjectSolverProfile(
    createTestBattleRifleHoldProfile()
  );
  const rocketProfile = resolveMetaverseHeldObjectSolverProfile(
    createTestRocketLauncherHoldProfile()
  );

  assert.equal(pistolProfile.poseProfileId, "sidearm.one_hand_optional_support");
  assert.equal(pistolProfile.primaryHand, "right");
  assert.equal(pistolProfile.offhandPolicy, "optional_support_palm");
  assert.equal(pistolProfile.fingerPose.primary, "pistol_grip_trigger_index");
  assert.equal(pistolProfile.fingerPose.secondary, "support_palm_optional");
  assert.equal(
    pistolProfile.contactBindings.primary.contactFrameId,
    "primary_trigger_grip"
  );
  assert.equal(pistolProfile.contactBindings.primary.weaponSocketRole, "grip.primary");
  assert.equal(pistolProfile.contactBindings.secondary?.contactFrameId, "support_palm");
  assert.equal(pistolProfile.contactBindings.secondary?.strength, "soft");
  assert.equal(pistolProfile.adsCalibration.adsAnchorPositionalWeight, 0.45);
  assert.equal(pistolProfile.adsCalibration.maxAdsGripTargetDeltaMeters, 0.16);
  assert.equal(pistolProfile.adsCalibration.supportPalmFadeStartPitchRadians, null);
  assert.equal(pistolProfile.adsCalibration.supportPalmFadeEndPitchRadians, null);
  assert.equal(pistolProfile.upperLimbOwnership, "hard_ik");
  assert.equal(pistolProfile.sampledInfluence.handPrimary, 0);
  assert.equal(pistolProfile.sampledInfluence.fingers, 0);
  assert.equal(battleRifleProfile.poseProfileId, "long_gun.two_hand_shoulder");
  assert.equal(battleRifleProfile.primaryHand, "right");
  assert.equal(battleRifleProfile.offhandPolicy, "required_support_grip");
  assert.equal(battleRifleProfile.fingerPose.primary, "long_gun_trigger_grip");
  assert.equal(battleRifleProfile.fingerPose.secondary, "relaxed_open");
  assert.equal(
    battleRifleProfile.contactBindings.primary.contactFrameId,
    "primary_trigger_grip"
  );
  assert.equal(
    battleRifleProfile.contactBindings.secondary?.contactFrameId,
    "barrel_cradle"
  );
  assert.equal(battleRifleProfile.contactBindings.secondary?.strength, "hard");
  assert.equal(battleRifleProfile.adsCalibration.adsAnchorPositionalWeight, 0.4);
  assert.equal(battleRifleProfile.adsCalibration.maxAdsGripTargetDeltaMeters, 0.14);
  assert.equal(battleRifleProfile.upperLimbOwnership, "hard_ik");
  assert.equal(battleRifleProfile.sampledInfluence.handSecondary, 0);
  assert.equal(battleRifleProfile.sampledInfluence.fingers, 0);
  assert.equal(rocketProfile.poseProfileId, "shoulder_heavy.two_hand_shouldered");
  assert.equal(rocketProfile.primaryHand, "right");
  assert.equal(rocketProfile.offhandPolicy, "required_support_grip");
  assert.equal(rocketProfile.fingerPose.primary, "heavy_trigger_grip");
  assert.equal(rocketProfile.fingerPose.secondary, "support_handle_grip");
  assert.equal(
    rocketProfile.contactBindings.primary.contactFrameId,
    "heavy_trigger_grip"
  );
  assert.equal(
    rocketProfile.contactBindings.secondary?.contactFrameId,
    "support_handle_grip"
  );
  assert.equal(rocketProfile.contactBindings.secondary?.strength, "hard");
  assert.equal(rocketProfile.adsCalibration.adsAnchorPositionalWeight, 0.35);
  assert.equal(rocketProfile.adsCalibration.maxAdsGripTargetDeltaMeters, 0.16);
  assert.equal(rocketProfile.upperLimbOwnership, "hard_ik");
  assert.equal(rocketProfile.sampledInfluence.handSecondary, 0);
  assert.equal(rocketProfile.sampledInfluence.fingers, 0);
  assert.deepEqual(
    resolveActiveGripAssignment({
      heldMount: {
        socketName: "grip_r_socket"
      },
      holdProfile: createTestServicePistolHoldProfile(),
      offHandGripMount: {},
      offHandTargetKind: "support-palm-hint"
    }),
    {
      primaryCharacterSocketRole: "grip_r_socket",
      primaryHand: "right",
      secondaryCharacterSocketRole: "palm_l_socket",
      secondaryHand: "left"
    }
  );
  assert.deepEqual(
    resolveActiveGripAssignment({
      heldMount: {
        socketName: "grip_r_socket"
      },
      holdProfile: createTestBattleRifleHoldProfile(),
      offHandGripMount: {},
      offHandTargetKind: "secondary-grip"
    }),
    {
      primaryCharacterSocketRole: "grip_r_socket",
      primaryHand: "right",
      secondaryCharacterSocketRole: "support_l_socket",
      secondaryHand: "left"
    }
  );
  assert.deepEqual(
    resolveActiveGripAssignment({
      heldMount: {
        socketName: "grip_r_socket"
      },
      holdProfile: createTestRocketLauncherHoldProfile(),
      offHandGripMount: {},
      offHandTargetKind: "secondary-grip"
    }),
    {
      primaryCharacterSocketRole: "grip_r_socket",
      primaryHand: "right",
      secondaryCharacterSocketRole: "support_l_socket",
      secondaryHand: "left"
    }
  );
  assert.throws(
    () =>
      resolveMetaverseHeldObjectSolverProfile(
        createTestServicePistolHoldProfile({
          offhandPolicy: "required_support_grip"
        })
      ),
    /expects offhand policy optional_support_palm/
  );
});

test("shipped metaverse attachment hold profiles have configured held-object solver profiles", async () => {
  const [
    { metaverseAttachmentProofConfigs },
    { resolveMetaverseHeldObjectSolverProfile }
  ] = await Promise.all([
    clientLoader.load("/src/metaverse/world/proof/index.ts"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-held-object-solver-profile.ts"
    )
  ]);

  assert.deepEqual(
    metaverseAttachmentProofConfigs.map(
      (attachmentProofConfig) => attachmentProofConfig.attachmentId
    ),
    [
      "metaverse-service-pistol-v2",
      "metaverse-compact-smg-v1",
      "metaverse-battle-rifle-v1",
      "metaverse-breacher-shotgun-v1",
      "metaverse-longshot-sniper-v1",
      "metaverse-rocket-launcher-v1"
    ]
  );

  for (const attachmentProofConfig of metaverseAttachmentProofConfigs) {
    const solverProfile = resolveMetaverseHeldObjectSolverProfile(
      attachmentProofConfig.holdProfile
    );

    assert.equal(
      solverProfile.poseProfileId,
      attachmentProofConfig.holdProfile.poseProfileId
    );
    assert.equal(
      solverProfile.offhandPolicy,
      attachmentProofConfig.holdProfile.offhandPolicy
    );
  }
});

test("local long-gun ADS hides held meshes and local character hands", async () => {
  const [
    { Group },
    {
      syncLocalCleanAdsCharacterPresentation,
      syncLocalScopedAdsAttachmentPresentation
    }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-local-character-presentation.ts"
    )
  ]);
  const createAttachmentRuntime = (holdProfile) => ({
    holdProfile,
    presentationGroup: {
      visible: true
    }
  });
  const createCharacterRuntime = () => ({
    anchorGroup: new Group()
  });
  const pistolAttachment = createAttachmentRuntime(
    createTestServicePistolHoldProfile()
  );
  const shotgunAttachment = createAttachmentRuntime(
    createTestBattleRifleHoldProfile({
      adsPolicy: "iron_sights"
    })
  );
  const battleRifleAttachment = createAttachmentRuntime(
    createTestBattleRifleHoldProfile()
  );
  const rocketAttachment = createAttachmentRuntime(
    createTestRocketLauncherHoldProfile()
  );
  const pistolCharacter = createCharacterRuntime();
  const shotgunCharacter = createCharacterRuntime();
  const battleRifleCharacter = createCharacterRuntime();
  const rocketCharacter = createCharacterRuntime();

  syncLocalScopedAdsAttachmentPresentation(pistolAttachment, {
    aimMode: "ads"
  });
  syncLocalScopedAdsAttachmentPresentation(shotgunAttachment, {
    aimMode: "ads"
  });
  syncLocalScopedAdsAttachmentPresentation(battleRifleAttachment, {
    aimMode: "ads"
  });
  syncLocalScopedAdsAttachmentPresentation(rocketAttachment, {
    aimMode: "ads"
  });
  syncLocalCleanAdsCharacterPresentation(
    pistolCharacter,
    pistolAttachment,
    { aimMode: "ads" }
  );
  syncLocalCleanAdsCharacterPresentation(
    shotgunCharacter,
    shotgunAttachment,
    { aimMode: "ads" }
  );
  syncLocalCleanAdsCharacterPresentation(
    battleRifleCharacter,
    battleRifleAttachment,
    { aimMode: "ads" }
  );
  syncLocalCleanAdsCharacterPresentation(
    rocketCharacter,
    rocketAttachment,
    { aimMode: "ads" }
  );

  assert.equal(pistolAttachment.presentationGroup.visible, true);
  assert.equal(shotgunAttachment.presentationGroup.visible, false);
  assert.equal(battleRifleAttachment.presentationGroup.visible, false);
  assert.equal(rocketAttachment.presentationGroup.visible, false);
  assert.equal(pistolCharacter.anchorGroup.visible, true);
  assert.equal(shotgunCharacter.anchorGroup.visible, false);
  assert.equal(battleRifleCharacter.anchorGroup.visible, false);
  assert.equal(rocketCharacter.anchorGroup.visible, false);

  syncLocalScopedAdsAttachmentPresentation(battleRifleAttachment, {
    aimMode: "hip-fire"
  });

  assert.equal(battleRifleAttachment.presentationGroup.visible, true);
});

test("held weapon presentation stays inactive without an active weapon state", async () => {
  const [
    { Group },
    {
      shouldUseHeldWeaponCharacterPresentation
    },
    { advanceLocalCharacterAnimation, syncLocalCharacterPresentation }
  ] = await Promise.all([
    import("three/webgpu"),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-character-animation.ts"
    ),
    clientLoader.load(
      "/src/metaverse/render/characters/metaverse-scene-local-character-presentation.ts"
    )
  ]);
  const characterRuntime = {
    actionsByVocabulary: new Map([
      ["idle", { setEffectiveTimeScale() {} }]
    ]),
    activeAnimationCycleId: null,
    activeAnimationVocabulary: "idle",
    anchorGroup: new Group(),
    firstPersonHeadAnchorNodes: [],
    heldWeaponPoseRuntime: {},
    mixer: {
      update() {}
    },
    deathRagdollRuntime: {
      apply() {},
      clear() {},
      isActive: false,
      trigger() {}
    },
    proceduralHitReactionRuntime: {
      apply() {},
      trigger() {}
    },
    skeletonId: "humanoid_v2"
  };
  const attachmentRuntime = {
    activeMountKind: "held",
    attachmentId: "metaverse-service-pistol-v1"
  };
  const cameraSnapshot = {
    lookDirection: { x: 0, y: 0, z: -1 },
    pitchRadians: 0,
    position: { x: 0, y: 1.6, z: 0 },
    yawRadians: 0
  };
  const characterPresentation = {
    animationPlaybackRateMultiplier: 1,
    animationVocabulary: "idle",
    position: { x: 0, y: 0, z: 0 },
    yawRadians: 0
  };
  const bodyPresentation = {
    groundedFirstPersonHeadClearanceMeters: 0.1,
    groundedFirstPersonHeadOcclusionRadiusMeters: 0.2
  };
  const calls = {
    restoreHeldWeaponPoseRuntime: 0,
    syncHeldWeaponPose: 0
  };

  assert.equal(
    shouldUseHeldWeaponCharacterPresentation(attachmentRuntime, null, null),
    false
  );
  assert.equal(
    shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      Object.freeze({
        aimMode: "hip-fire",
        weaponId: "metaverse-service-rifle-v1"
      }),
      null
    ),
    false
  );
  assert.equal(
    shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      Object.freeze({
        aimMode: "hip-fire",
        weaponId: "metaverse-service-pistol-v1"
      }),
      null
    ),
    true
  );
  advanceLocalCharacterAnimation(
    characterRuntime,
    attachmentRuntime,
    characterPresentation,
    null,
    null,
    cameraSnapshot,
    1 / 60,
    {
      maxPitchRadians: Math.PI * 0.5,
      minPitchRadians: -Math.PI * 0.5
    },
    {
      captureHeldWeaponPoseRuntime() {
        calls.captureHeldWeaponPoseRuntime =
          (calls.captureHeldWeaponPoseRuntime ?? 0) + 1;
      },
      prepareHeldWeaponPoseRuntime() {
        calls.prepareHeldWeaponPoseRuntime =
          (calls.prepareHeldWeaponPoseRuntime ?? 0) + 1;
      },
      restoreHeldWeaponPoseRuntime() {
        calls.restoreHeldWeaponPoseRuntime += 1;
      }
    }
  );

  syncLocalCharacterPresentation(
    characterRuntime,
    attachmentRuntime,
    null,
    cameraSnapshot,
    0,
    characterPresentation,
    bodyPresentation,
    null,
    null,
    null,
    {
      applyMountedAnchorTransform() {},
      restoreHeldWeaponPoseRuntime() {
        calls.restoreHeldWeaponPoseRuntime += 1;
      },
      syncHeldWeaponPose() {
        calls.syncHeldWeaponPose += 1;
      }
    }
  );

  assert.deepEqual(calls, {
    captureHeldWeaponPoseRuntime: 1,
    prepareHeldWeaponPoseRuntime: 1,
    restoreHeldWeaponPoseRuntime: 1,
    syncHeldWeaponPose: 0
  });
});

test("createMetaverseScene keeps traversal as the held-object IK base locally and remotely", async () => {
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

  const thumb01LBone = addBone("thumb_01_l", handLBone, new Vector3(-0.04, -0.02, 0.06));
  const thumb02LBone = addBone("thumb_02_l", thumb01LBone, new Vector3(-0.035, -0.012, 0.018));
  addBone("thumb_03_l", thumb02LBone, new Vector3(-0.03, -0.01, 0.012));
  const index01LBone = addBone("index_01_l", handLBone, new Vector3(-0.1, 0, 0.03));
  const index02LBone = addBone("index_02_l", index01LBone, new Vector3(-0.055, -0.004, -0.004));
  addBone("index_03_l", index02LBone, new Vector3(-0.04, -0.004, -0.003));
  const middle01LBone = addBone("middle_01_l", handLBone, new Vector3(-0.11, 0, 0));
  const middle02LBone = addBone("middle_02_l", middle01LBone, new Vector3(-0.055, -0.004, 0));
  addBone("middle_03_l", middle02LBone, new Vector3(-0.04, -0.004, 0));
  const ring01LBone = addBone("ring_01_l", handLBone, new Vector3(-0.1, 0, -0.03));
  const ring02LBone = addBone("ring_02_l", ring01LBone, new Vector3(-0.05, -0.004, 0.002));
  addBone("ring_03_l", ring02LBone, new Vector3(-0.035, -0.004, 0.002));
  const pinky01LBone = addBone("pinky_01_l", handLBone, new Vector3(-0.08, 0, -0.05));
  const pinky02LBone = addBone("pinky_02_l", pinky01LBone, new Vector3(-0.044, -0.004, 0.002));
  addBone("pinky_03_l", pinky02LBone, new Vector3(-0.032, -0.004, 0.002));
  const thumb01RBone = addBone("thumb_01_r", handRBone, new Vector3(0.04, -0.02, 0.06));
  const thumb02RBone = addBone("thumb_02_r", thumb01RBone, new Vector3(0.035, -0.012, 0.018));
  addBone("thumb_03_r", thumb02RBone, new Vector3(0.03, -0.01, 0.012));
  const index01RBone = addBone("index_01_r", handRBone, new Vector3(0.1, 0, 0.03));
  const index02RBone = addBone("index_02_r", index01RBone, new Vector3(0.055, -0.004, -0.004));
  addBone("index_03_r", index02RBone, new Vector3(0.04, -0.004, -0.003));
  const middle01RBone = addBone("middle_01_r", handRBone, new Vector3(0.11, 0, 0));
  const middle02RBone = addBone("middle_02_r", middle01RBone, new Vector3(0.055, -0.004, 0));
  addBone("middle_03_r", middle02RBone, new Vector3(0.04, -0.004, 0));
  const ring01RBone = addBone("ring_01_r", handRBone, new Vector3(0.1, 0, -0.03));
  const ring02RBone = addBone("ring_02_r", ring01RBone, new Vector3(0.05, -0.004, 0.002));
  addBone("ring_03_r", ring02RBone, new Vector3(0.035, -0.004, 0.002));
  const pinky01RBone = addBone("pinky_01_r", handRBone, new Vector3(0.08, 0, -0.05));
  const pinky02RBone = addBone("pinky_02_r", pinky01RBone, new Vector3(0.044, -0.004, 0.002));
  addBone("pinky_03_r", pinky02RBone, new Vector3(0.032, -0.004, 0.002));

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
    bonesByName.get("thumb_02_l"),
    bonesByName.get("thumb_03_l"),
    bonesByName.get("index_01_l"),
    bonesByName.get("index_02_l"),
    bonesByName.get("index_03_l"),
    bonesByName.get("middle_01_l"),
    bonesByName.get("middle_02_l"),
    bonesByName.get("middle_03_l"),
    bonesByName.get("ring_01_l"),
    bonesByName.get("ring_02_l"),
    bonesByName.get("ring_03_l"),
    bonesByName.get("pinky_01_l"),
    bonesByName.get("pinky_02_l"),
    bonesByName.get("pinky_03_l"),
    bonesByName.get("thumb_01_r"),
    bonesByName.get("thumb_02_r"),
    bonesByName.get("thumb_03_r"),
    bonesByName.get("index_01_r"),
    bonesByName.get("index_02_r"),
    bonesByName.get("index_03_r"),
    bonesByName.get("middle_01_r"),
    bonesByName.get("middle_02_r"),
    bonesByName.get("middle_03_r"),
    bonesByName.get("ring_01_r"),
    bonesByName.get("ring_02_r"),
    bonesByName.get("ring_03_r"),
    bonesByName.get("pinky_01_r"),
    bonesByName.get("pinky_02_r"),
    bonesByName.get("pinky_03_r"),
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
    "/models/metaverse/characters/metaverse-humanoid-base-pack.glb";
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
  const attachmentScene = new Group();
  const attachmentMesh = new Mesh(
    new BoxGeometry(0.28, 0.08, 0.08),
    new MeshStandardMaterial({ color: 0x4b5563 })
  );
  const adsCameraAnchor = new Group();
  const forwardMarker = new Group();
  const gripHandSocket = new Group();
  const supportMarker = new Group();
  const triggerMarker = new Group();
  const upMarker = new Group();

  attachmentMesh.position.set(0.16, 0, 0);
  attachmentScene.name = "metaverse_service_pistol_root";
  adsCameraAnchor.name = "metaverse_service_pistol_ads_camera_anchor";
  adsCameraAnchor.position.set(0.016, 0.059, 0);
  forwardMarker.name = "metaverse_service_pistol_forward_marker";
  forwardMarker.position.set(1, 0, 0);
  gripHandSocket.name = "metaverse_service_pistol_grip_hand_r_socket";
  gripHandSocket.position.set(0.079, -0.048, 0);
  supportMarker.name = "metaverse_service_pistol_support_marker";
  supportMarker.position.set(0.018, -0.137, 0);
  triggerMarker.name = "metaverse_service_pistol_trigger_marker";
  triggerMarker.position.set(0.082, -0.061, -0.008);
  upMarker.name = "metaverse_service_pistol_up_marker";
  upMarker.position.set(0, 1, 0);
  attachmentScene.add(
    attachmentMesh,
    adsCameraAnchor,
    forwardMarker,
    gripHandSocket,
    supportMarker,
    triggerMarker,
    upMarker
  );

  const sceneRuntime = createMetaverseScene(metaverseRuntimeConfig, {
    attachmentProofConfig: {
      attachmentId: "metaverse-service-pistol-v1",
      heldMount: {
        attachmentSocketRole: "grip.primary",
        socketName: "palm_r_socket",
      },
      holdProfile: createTestServicePistolHoldProfile(),
      label: "Metaverse service pistol",
      modelPath: "/models/metaverse/attachments/metaverse-service-pistol.gltf",
      modules: [],
      mountedHolsterMount: null
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
      label: "Mesh2Motion humanoid",
      modelPath: "/models/metaverse/characters/metaverse-humanoid-base-pack.glb",
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
            scene: characterScene
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
  const resolveClosestPointOnSegment = (segmentStart, segmentEnd, targetPoint) => {
    const segmentOffset = segmentEnd.clone().sub(segmentStart);
    const segmentLengthSq = segmentOffset.lengthSq();

    if (segmentLengthSq <= 0.000001) {
      return segmentStart.clone();
    }

    return segmentStart
      .clone()
      .addScaledVector(
        segmentOffset,
        Math.max(
          0,
          Math.min(
            1,
            targetPoint.clone().sub(segmentStart).dot(segmentOffset) /
              segmentLengthSq
          )
        )
      );
  };

  const cameraSnapshot = {
    lookDirection: {
      x: normalizedLookDirection.x,
      y: normalizedLookDirection.y,
      z: normalizedLookDirection.z
    },
    pitchRadians: Math.asin(normalizedLookDirection.y),
    position: { x: 0, y: 1.62, z: -0.12 },
    yawRadians: Math.atan2(normalizedLookDirection.x, -normalizedLookDirection.z)
  };
  const characterPresentation = {
    animationVocabulary: "walk",
    position: { x: 0, y: 0, z: 0 },
    yawRadians: 0
  };
  const activeWeaponState = Object.freeze({
    activeSlotId: "primary",
    aimMode: "hip-fire",
    slots: Object.freeze([
      Object.freeze({
        attachmentId: "metaverse-service-pistol-v1",
        equipped: true,
        slotId: "primary",
        weaponId: "metaverse-service-pistol-v1",
        weaponInstanceId: "test-player:primary:metaverse-service-pistol-v1"
      })
    ]),
    weaponId: "metaverse-service-pistol-v1"
  });
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
    activeWeaponState,
    null,
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
  const supportMarkerNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_support_marker"
  );
  const upMarkerNode = sceneRuntime.scene.getObjectByName(
    "metaverse_service_pistol_up_marker"
  );
  const leftSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_l_support"
  );
  const leftGripSocketNode = sceneRuntime.scene.getObjectByName("grip_l_socket");
  const leftPalmSocketNode = sceneRuntime.scene.getObjectByName("palm_l_socket");
  const leftSupportSocketNode = sceneRuntime.scene.getObjectByName("support_l_socket");
  const leftSupportPalmContactFrameNode = sceneRuntime.scene.getObjectByName(
    "metaverse_left_support_palm_contact_frame"
  );
  const leftSupportHandleContactFrameNode = sceneRuntime.scene.getObjectByName(
    "metaverse_left_support_handle_grip_contact_frame"
  );
  const rightSupportPointNode = sceneRuntime.scene.getObjectByName(
    "metaverse_attachment_support_point/metaverse-service-pistol-v1/hand_r_support"
  );
  const rightPalmSocketNode = sceneRuntime.scene.getObjectByName("palm_r_socket");
  const rightGripSocketNode = sceneRuntime.scene.getObjectByName("grip_r_socket");
  const rightPrimaryTriggerContactFrameNode = sceneRuntime.scene.getObjectByName(
    "metaverse_right_primary_trigger_grip_contact_frame"
  );
  const rightIndexBaseNode = sceneRuntime.scene.getObjectByName("index_01_r");
  const rightIndexMiddleNode = sceneRuntime.scene.getObjectByName("index_02_r");
  const rightIndexTipNode = sceneRuntime.scene.getObjectByName("index_03_r");
  const rightThumbBaseNode = sceneRuntime.scene.getObjectByName("thumb_01_r");
  const rightMiddleBaseNode = sceneRuntime.scene.getObjectByName("middle_01_r");
  const rightRingBaseNode = sceneRuntime.scene.getObjectByName("ring_01_r");
  const rightPinkyBaseNode = sceneRuntime.scene.getObjectByName("pinky_01_r");
  const leftPinkyBaseNode = sceneRuntime.scene.getObjectByName("pinky_01_l");

  assert.ok(attachmentRoot);
  assert.ok(adsCameraAnchorNode);
  assert.ok(gripHandSocketNode);
  assert.ok(forwardMarkerNode);
  assert.ok(triggerMarkerNode);
  assert.ok(supportMarkerNode);
  assert.ok(upMarkerNode);
  assert.equal(leftSupportPointNode, undefined);
  assert.equal(rightSupportPointNode, undefined);
  assert.ok(leftGripSocketNode);
  assert.ok(leftPalmSocketNode);
  assert.ok(leftSupportSocketNode);
  assert.ok(leftSupportPalmContactFrameNode);
  assert.ok(leftSupportHandleContactFrameNode);
  assert.ok(rightPalmSocketNode);
  assert.ok(rightGripSocketNode);
  assert.ok(rightPrimaryTriggerContactFrameNode);
  assert.ok(rightIndexBaseNode);
  assert.ok(rightIndexMiddleNode);
  assert.ok(rightIndexTipNode);
  assert.ok(rightThumbBaseNode);
  assert.ok(rightMiddleBaseNode);
  assert.ok(rightRingBaseNode);
  assert.ok(rightPinkyBaseNode);
  assert.ok(leftPinkyBaseNode);

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
    .applyQuaternion(
      rightPrimaryTriggerContactFrameNode.getWorldQuaternion(new Quaternion())
    )
    .normalize();
  const rightHandUp = new Vector3(0, 1, 0)
    .applyQuaternion(
      rightPrimaryTriggerContactFrameNode.getWorldQuaternion(new Quaternion())
    )
    .normalize();
  const initialLeftSupportContactLocalPosition = attachmentRoot.worldToLocal(
    leftSupportPalmContactFrameNode.getWorldPosition(new Vector3())
  );
  const triggerMarkerWorldPosition = triggerMarkerNode.getWorldPosition(
    new Vector3()
  );
  const supportMarkerWorldPosition = supportMarkerNode.getWorldPosition(
    new Vector3()
  );
  const supportMarkerLocalPosition = attachmentRoot.worldToLocal(
    supportMarkerWorldPosition.clone()
  );
  const rightIndexBaseWorldPosition = rightIndexBaseNode.getWorldPosition(
    new Vector3()
  );
  const rightIndexMiddleWorldPosition = rightIndexMiddleNode.getWorldPosition(
    new Vector3()
  );
  const rightIndexTipWorldPosition = rightIndexTipNode.getWorldPosition(new Vector3());
  const rightTriggerContactWorldPosition = (() => {
    const baseSegmentClosestPoint = resolveClosestPointOnSegment(
      rightIndexBaseWorldPosition,
      rightIndexMiddleWorldPosition,
      triggerMarkerWorldPosition
    );
    const tipSegmentClosestPoint = resolveClosestPointOnSegment(
      rightIndexMiddleWorldPosition,
      rightIndexTipWorldPosition,
      triggerMarkerWorldPosition
    );

    return baseSegmentClosestPoint.distanceTo(triggerMarkerWorldPosition) <=
      tipSegmentClosestPoint.distanceTo(triggerMarkerWorldPosition)
      ? baseSegmentClosestPoint
      : tipSegmentClosestPoint;
  })();
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
  const targetGripAcross = normalizedLookDirection
    .clone()
    .cross(targetGripUp)
    .normalize();
  const hipFireGripPosition = clavicleRBone
    .getWorldPosition(new Vector3())
    .clone()
    .addScaledVector(normalizedLookDirection, 0.34)
    .addScaledVector(targetGripAcross, 0.2)
    .addScaledVector(targetGripUp, 0);
  const centeredShoulderGripPosition = clavicleRBone
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
    weaponUpDirection.angleTo(targetGripUp) < 0.24,
    `Expected weapon up ${weaponUpDirection.toArray()} to stay upright against ${targetGripUp.toArray()}.`
  );
  assert.ok(
    gripCameraForwardDistance > 0,
    `Expected authored grip ${gripHandSocketNode.getWorldPosition(new Vector3()).toArray()} to stay in front of the traversal camera ${traversalCameraPosition.toArray()} along look ${normalizedLookDirection.toArray()}, but forward distance was ${gripCameraForwardDistance.toFixed(4)} meters.`
  );
  assert.ok(
    rightPrimaryTriggerContactFrameNode
      .getWorldPosition(new Vector3())
      .distanceTo(hipFireGripPosition) <
      rightPrimaryTriggerContactFrameNode
        .getWorldPosition(new Vector3())
        .distanceTo(centeredShoulderGripPosition),
    `Expected primary trigger contact frame ${rightPrimaryTriggerContactFrameNode.getWorldPosition(new Vector3()).toArray()} to stay near the lowered hip-fire hold ${hipFireGripPosition.toArray()}.`
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
    rightTriggerContactWorldPosition.distanceTo(triggerMarkerWorldPosition) < 0.02,
    `Expected the visible right index chain contact ${rightTriggerContactWorldPosition.toArray()} to stay near the authored trigger marker ${triggerMarkerWorldPosition.toArray()} without overextending the finger chain.`
  );
  assert.ok(
    leftSupportPalmContactFrameNode
      .getWorldPosition(new Vector3())
      .distanceTo(supportMarkerWorldPosition) < 0.12,
    `Expected left support palm contact frame ${leftSupportPalmContactFrameNode.getWorldPosition(new Vector3()).toArray()} to use the authored support marker ${supportMarkerWorldPosition.toArray()} as a soft support hint.`
  );
  assert.ok(
    triggerMarkerWorldPosition.distanceTo(
      rightPalmSocketNode.getWorldPosition(new Vector3())
    ) > 0.015,
    `Expected authored trigger marker ${triggerMarkerWorldPosition.toArray()} to remain distinct from the grip-alignment hand socket target.`
  );
  const primaryContactGripError = gripHandSocketNode
    .getWorldPosition(new Vector3())
    .distanceTo(
      rightPrimaryTriggerContactFrameNode.getWorldPosition(new Vector3())
    );

  assert.ok(
    primaryContactGripError < 0.05,
    `Expected the authored weapon grip socket to align with the calibrated primary trigger contact frame despite traversal walk arm swing, but error was ${primaryContactGripError.toFixed(4)} meters.`
  );
  assert.ok(
    rightMiddleBaseNode.quaternion.angleTo(new Quaternion()) > 0.01,
    "Expected the sidearm solver profile to curl the primary-hand grip fingers instead of relying on pistol aim clips."
  );
  assert.ok(
    rightThumbBaseNode.quaternion.angleTo(new Quaternion()) > 0.28,
    "Expected the tuned pistol grip pose to oppose the right thumb around the service pistol grip."
  );
  assert.ok(
    rightMiddleBaseNode.quaternion.angleTo(new Quaternion()) > 0.5,
    "Expected the tuned pistol grip pose to curl the right middle finger visibly around the service pistol grip."
  );
  assert.ok(
    rightRingBaseNode.quaternion.angleTo(new Quaternion()) > 0.56,
    "Expected the tuned pistol grip pose to curl the right ring finger visibly around the service pistol grip."
  );
  assert.ok(
    rightPinkyBaseNode.quaternion.angleTo(new Quaternion()) > 0.6,
    "Expected the tuned pistol grip pose to curl the right pinky visibly around the service pistol grip."
  );
  assert.ok(
    leftPinkyBaseNode.quaternion.angleTo(new Quaternion()) > 0.01,
    "Expected the optional support-palm solver profile to pose the secondary hand when support is active."
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

  const rightMiddleOneFrameQuaternion = rightMiddleBaseNode.quaternion.clone();
  const leftPinkyOneFrameQuaternion = leftPinkyBaseNode.quaternion.clone();
  const rightGripSocketLocalPosition = rightGripSocketNode.position.clone();
  const rightGripSocketLocalQuaternion = rightGripSocketNode.quaternion.clone();
  const rightPalmSocketLocalPosition = rightPalmSocketNode.position.clone();
  const rightPalmSocketLocalQuaternion = rightPalmSocketNode.quaternion.clone();
  const rightPrimaryContactFrameLocalPosition =
    rightPrimaryTriggerContactFrameNode.position.clone();
  const rightPrimaryContactFrameLocalQuaternion =
    rightPrimaryTriggerContactFrameNode.quaternion.clone();
  const leftSupportPalmContactFrameLocalPosition =
    leftSupportPalmContactFrameNode.position.clone();
  const leftSupportPalmContactFrameLocalQuaternion =
    leftSupportPalmContactFrameNode.quaternion.clone();
  const leftSupportHandleContactFrameLocalPosition =
    leftSupportHandleContactFrameNode.position.clone();
  const leftSupportHandleContactFrameLocalQuaternion =
    leftSupportHandleContactFrameNode.quaternion.clone();
  const leftSupportSocketLocalPosition = leftSupportSocketNode.position.clone();
  const leftSupportSocketLocalQuaternion =
    leftSupportSocketNode.quaternion.clone();
  const assertQuaternionNormalized = (quaternion, label) => {
    const length = Math.sqrt(
      quaternion.x * quaternion.x +
        quaternion.y * quaternion.y +
        quaternion.z * quaternion.z +
        quaternion.w * quaternion.w
    );

    assert.ok(
      Number.isFinite(length),
      `Expected ${label} quaternion length to stay finite.`
    );
    assert.ok(
      Math.abs(length - 1) < 0.000001,
      `Expected ${label} quaternion to stay normalized, but length was ${length}.`
    );
  };

  for (let frameIndex = 0; frameIndex < 600; frameIndex += 1) {
    sceneRuntime.syncPresentation(
      cameraSnapshot,
      null,
      32 + frameIndex * 16,
      1 / 60,
      characterPresentation,
      activeWeaponState,
      null,
      []
    );
  }

  sceneRuntime.scene.updateMatrixWorld(true);

  const repeatedWeaponForward = forwardMarkerNode
    .getWorldPosition(new Vector3())
    .sub(gripHandSocketNode.getWorldPosition(new Vector3()))
    .normalize();
  const repeatedLeftHandScale = handLBone.getWorldScale(new Vector3());
  const repeatedGripError = gripHandSocketNode
    .getWorldPosition(new Vector3())
    .distanceTo(
      rightPrimaryTriggerContactFrameNode.getWorldPosition(new Vector3())
    );

  assert.ok(
    repeatedWeaponForward.angleTo(initialWeaponForward) < 0.02,
    `Expected held weapon forward to stay stable across repeated standing frames, but delta was ${repeatedWeaponForward.angleTo(initialWeaponForward).toFixed(4)} radians.`
  );
  assert.ok(
    repeatedGripError < 0.05 &&
      Math.abs(repeatedGripError - primaryContactGripError) < 0.005,
    `Expected held weapon grip error not to grow across 600 frames, but initial error was ${primaryContactGripError.toFixed(6)} meters and final error was ${repeatedGripError.toFixed(6)} meters.`
  );
  assert.ok(
    rightMiddleBaseNode.quaternion.angleTo(rightMiddleOneFrameQuaternion) <
      0.000001,
    `Expected repeated pistol finger pose to match the one-frame result, but delta was ${rightMiddleBaseNode.quaternion.angleTo(rightMiddleOneFrameQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    leftPinkyBaseNode.quaternion.angleTo(leftPinkyOneFrameQuaternion) <
      0.000001,
    `Expected repeated support-palm finger pose to match the one-frame result, but delta was ${leftPinkyBaseNode.quaternion.angleTo(leftPinkyOneFrameQuaternion).toFixed(6)} radians.`
  );
  assert.ok(
    rightGripSocketNode.position.distanceTo(rightGripSocketLocalPosition) <
      0.000001,
    "Expected grip_r_socket local position to stay stable across held-object frames."
  );
  assert.ok(
    rightGripSocketNode.quaternion.angleTo(rightGripSocketLocalQuaternion) <
      0.000001,
    "Expected grip_r_socket local rotation to stay stable across held-object frames."
  );
  assert.ok(
    rightPalmSocketNode.position.distanceTo(rightPalmSocketLocalPosition) <
      0.000001,
    "Expected palm_r_socket local position to stay stable across held-object frames."
  );
  assert.ok(
    rightPalmSocketNode.quaternion.angleTo(rightPalmSocketLocalQuaternion) <
      0.000001,
    "Expected palm_r_socket local rotation to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportSocketNode.position.distanceTo(leftSupportSocketLocalPosition) <
      0.000001,
    "Expected support_l_socket local position to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportSocketNode.quaternion.angleTo(leftSupportSocketLocalQuaternion) <
      0.000001,
    "Expected support_l_socket local rotation to stay stable across held-object frames."
  );
  assert.ok(
    rightPrimaryTriggerContactFrameNode.position.distanceTo(
      rightPrimaryContactFrameLocalPosition
    ) < 0.000001,
    "Expected primary trigger contact frame local position to stay stable across held-object frames."
  );
  assert.ok(
    rightPrimaryTriggerContactFrameNode.quaternion.angleTo(
      rightPrimaryContactFrameLocalQuaternion
    ) < 0.000001,
    "Expected primary trigger contact frame local rotation to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportPalmContactFrameNode.position.distanceTo(
      leftSupportPalmContactFrameLocalPosition
    ) < 0.000001,
    "Expected support palm contact frame local position to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportPalmContactFrameNode.quaternion.angleTo(
      leftSupportPalmContactFrameLocalQuaternion
    ) < 0.000001,
    "Expected support palm contact frame local rotation to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportHandleContactFrameNode.position.distanceTo(
      leftSupportHandleContactFrameLocalPosition
    ) < 0.000001,
    "Expected support handle contact frame local position to stay stable across held-object frames."
  );
  assert.ok(
    leftSupportHandleContactFrameNode.quaternion.angleTo(
      leftSupportHandleContactFrameLocalQuaternion
    ) < 0.000001,
    "Expected support handle contact frame local rotation to stay stable across held-object frames."
  );
  for (const [quaternion, label] of [
    [handRBone.quaternion, "hand_r"],
    [rightMiddleBaseNode.quaternion, "middle_01_r"],
    [leftPinkyBaseNode.quaternion, "pinky_01_l"]
  ]) {
    assertQuaternionNormalized(quaternion, label);
  }
  assert.ok(
    repeatedLeftHandScale.distanceTo(new Vector3(1, 1, 1)) < 0.000001,
    `Expected left hand world scale ${repeatedLeftHandScale.toArray()} to stay normalized across repeated standing frames.`
  );

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    32 + 601 * 16,
    1 / 60,
    characterPresentation,
    null,
    null,
    []
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  assert.ok(
    rightMiddleBaseNode.quaternion.angleTo(new Quaternion()) < 0.000001,
    `Expected inactive weapon state to clear stale right-hand finger pose, but delta was ${rightMiddleBaseNode.quaternion.angleTo(new Quaternion()).toFixed(6)} radians.`
  );
  assert.ok(
    handRBone.quaternion.angleTo(new Quaternion()) < 0.000001,
    `Expected inactive weapon state to clear stale right hand pose, but delta was ${handRBone.quaternion.angleTo(new Quaternion()).toFixed(6)} radians.`
  );

  const pitchedLookDirection = new Vector3(0.1, -0.42, -0.9).normalize();

  sceneRuntime.syncPresentation(
    {
      lookDirection: {
        x: pitchedLookDirection.x,
        y: pitchedLookDirection.y,
        z: pitchedLookDirection.z
      },
      pitchRadians: Math.asin(pitchedLookDirection.y),
      position: { x: 0, y: 1.62, z: -0.12 },
      yawRadians: Math.atan2(pitchedLookDirection.x, -pitchedLookDirection.z)
    },
    null,
    176,
    1 / 60,
    characterPresentation,
    activeWeaponState,
    null,
    []
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const pitchedLeftSupportContactLocalPosition = attachmentRoot.worldToLocal(
    leftSupportPalmContactFrameNode.getWorldPosition(new Vector3())
  );

  assert.ok(
    pitchedLeftSupportContactLocalPosition.distanceTo(
      initialLeftSupportContactLocalPosition
    ) <
      0.12,
    `Expected left support contact ${pitchedLeftSupportContactLocalPosition.toArray()} to stay anchored near ${initialLeftSupportContactLocalPosition.toArray()} across pitch changes.`
  );
  assert.ok(
    pitchedLeftSupportContactLocalPosition.distanceTo(supportMarkerLocalPosition) <
      0.12,
    `Expected pitched left support contact ${pitchedLeftSupportContactLocalPosition.toArray()} to use the authored support marker ${supportMarkerLocalPosition.toArray()} as a soft support hint.`
  );

  const downAdsLookDirection = new Vector3(0.08, -0.56, -0.82).normalize();
  const downAdsCameraPosition = { x: 0.32, y: 2.08, z: -0.62 };

  sceneRuntime.syncPresentation(
    {
      lookDirection: {
        x: downAdsLookDirection.x,
        y: downAdsLookDirection.y,
        z: downAdsLookDirection.z
      },
      pitchRadians: Math.asin(downAdsLookDirection.y),
      position: downAdsCameraPosition,
      yawRadians: Math.atan2(downAdsLookDirection.x, -downAdsLookDirection.z)
    },
    null,
    192,
    1 / 60,
    characterPresentation,
    Object.freeze({
      activeSlotId: "primary",
      aimMode: "ads",
      slots: Object.freeze([
        Object.freeze({
          attachmentId: "metaverse-service-pistol-v1",
          equipped: true,
          slotId: "primary",
          weaponId: "metaverse-service-pistol-v1",
          weaponInstanceId: "test-player:primary:metaverse-service-pistol-v1"
        })
      ]),
      weaponId: "metaverse-service-pistol-v1"
    }),
    1,
    []
  );
  sceneRuntime.scene.updateMatrixWorld(true);

  const adsDownPrimaryContactCameraForwardDistance =
    rightPrimaryTriggerContactFrameNode
      .getWorldPosition(new Vector3())
      .sub(
        new Vector3(
          downAdsCameraPosition.x,
          downAdsCameraPosition.y,
          downAdsCameraPosition.z
        )
      )
      .dot(downAdsLookDirection);

  const adsDownLeftSupportContactLocalPosition = attachmentRoot.worldToLocal(
    leftSupportPalmContactFrameNode.getWorldPosition(new Vector3())
  );
  const adsDownPrimaryTriggerContactLocalPosition = attachmentRoot.worldToLocal(
    rightPrimaryTriggerContactFrameNode.getWorldPosition(new Vector3())
  );
  const adsDownSupportMarkerLocalPosition = attachmentRoot.worldToLocal(
    supportMarkerNode.getWorldPosition(new Vector3())
  );
  const supportPalmSideWorldDirection = new Vector3(0, 0, 1)
    .applyQuaternion(
      leftSupportPalmContactFrameNode.getWorldQuaternion(new Quaternion())
    )
    .normalize();
  const supportPalmToPistolWorldDirection = supportMarkerNode
    .getWorldPosition(new Vector3())
    .sub(leftSupportPalmContactFrameNode.getWorldPosition(new Vector3()))
    .normalize();

  assert.ok(
    adsDownLeftSupportContactLocalPosition.distanceTo(
      adsDownSupportMarkerLocalPosition
    ) < 0.12,
    `Expected steep down ADS support palm ${adsDownLeftSupportContactLocalPosition.toArray()} to stay cupped near grip.secondary ${adsDownSupportMarkerLocalPosition.toArray()}.`
  );
  assert.ok(
    adsDownLeftSupportContactLocalPosition.y <=
      adsDownPrimaryTriggerContactLocalPosition.y + 0.025,
    `Expected secondary support contact local Y ${adsDownLeftSupportContactLocalPosition.y.toFixed(4)} to stay below or level with primary trigger contact local Y ${adsDownPrimaryTriggerContactLocalPosition.y.toFixed(4)}.`
  );
  assert.ok(
    supportPalmSideWorldDirection.dot(supportPalmToPistolWorldDirection) > 0.12,
    `Expected left support palm side to face the pistol support marker, but dot was ${supportPalmSideWorldDirection.dot(supportPalmToPistolWorldDirection).toFixed(4)}.`
  );
  assert.ok(
    adsDownPrimaryContactCameraForwardDistance > 0,
    `Expected ADS clamp to keep pistol primary contact in front of the camera instead of pulling behind the chest, but forward distance was ${adsDownPrimaryContactCameraForwardDistance.toFixed(4)} meters.`
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
    }),
    weaponState: activeWeaponState
  });

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    160,
    1 / 60,
    characterPresentation,
    activeWeaponState,
    null,
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
  const remoteHeadBone = remoteCharacterRoot?.getObjectByName("head") ?? null;
  const remotePitchUpLookDirection = new Vector3(
    0,
    Math.sin(0.45),
    -Math.cos(0.45)
  ).normalize();

  assert.ok(remoteCharacterRoot);
  assert.ok(remoteAttachmentRoot);
  assert.ok(remoteHeadBone);

  const remoteHeadNeutralQuaternion = remoteHeadBone.quaternion.clone();
  const remoteWeaponPitchUpForward = new Vector3(1, 0, 0)
    .applyQuaternion(remoteAttachmentRoot.getWorldQuaternion(new Quaternion()))
    .normalize();

  sceneRuntime.syncPresentation(
    cameraSnapshot,
    null,
    176,
    1 / 60,
    characterPresentation,
    activeWeaponState,
    null,
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
    remoteHeadNeutralQuaternion.angleTo(remoteHeadPitchedQuaternion) < 0.001,
    `Expected remote humanoid_v2 head pitch to stay out of held-object IK, but delta was ${remoteHeadNeutralQuaternion.angleTo(remoteHeadPitchedQuaternion).toFixed(4)} radians.`
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
