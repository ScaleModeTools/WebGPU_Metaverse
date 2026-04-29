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

test("MetaverseSceneRemoteCharacterPresentationState owns remote runtime sync and reset", async () => {
  const [{ Group, Scene }, { MetaverseSceneRemoteCharacterPresentationState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/characters/metaverse-scene-remote-character-presentation-state.ts"
      )
    ]);
  const scene = new Scene();
  const mixerUpdateCalls = [];
  const sourceCharacterRuntime = {
    anchorGroup: new Group(),
    heldWeaponPoseRuntime: null,
    mixer: {
      update() {}
    }
  };
  const interactivePresentationState = {
    attachmentProofRuntimesByAttachmentId: new Map(),
    characterProofRuntime: sourceCharacterRuntime
  };
  const remoteCharacterPresentationState =
    new MetaverseSceneRemoteCharacterPresentationState({
      config: {
        orientation: {
          maxPitchRadians: Math.PI * 0.5,
          minPitchRadians: -Math.PI * 0.5
        }
      },
      interactivePresentationState,
      remoteCharacterPresentationDependencies: {
        applyMountedAnchorTransform() {},
        captureHeldWeaponPoseRuntime() {},
        prepareHeldWeaponPoseRuntime() {},
        cloneAttachmentRuntime() {
          return null;
        },
        cloneCharacterRuntime(_sourceCharacterRuntime, playerId) {
          const anchorGroup = new Group();

          anchorGroup.name = `metaverse_character/test/${playerId}`;
          return {
            anchorGroup,
            heldWeaponPoseRuntime: null,
            mixer: {
              update(deltaSeconds) {
                mixerUpdateCalls.push(deltaSeconds);
              }
            }
          };
        },
        resolveHeldAnimationVocabulary(
          _characterRuntime,
          _attachmentRuntime,
          targetVocabulary
        ) {
          return targetVocabulary;
        },
        resolveMountedEnvironmentRuntime() {
          return null;
        },
        restoreHeldWeaponPoseRuntime() {},
        syncAttachmentMount() {},
        syncCharacterAnimation() {},
        syncCharacterPresentation(characterRuntime, characterPresentation) {
          characterRuntime.anchorGroup.position.set(
            characterPresentation.position.x,
            characterPresentation.position.y,
            characterPresentation.position.z
          );
          characterRuntime.anchorGroup.rotation.set(
            0,
            Math.PI - characterPresentation.yawRadians,
            0
          );
          characterRuntime.anchorGroup.updateMatrixWorld(true);
        },
        syncHeldWeaponPose() {},
        syncMountedCharacterRuntime() {
          return null;
        }
      },
      scene
    });

  remoteCharacterPresentationState.syncPresentation(
    [
      Object.freeze({
        aimCamera: null,
        characterId: "mesh2motion-humanoid-v1",
        look: Object.freeze({
          pitchRadians: 0,
          yawRadians: 0
        }),
        mountedOccupancy: null,
        playerId: "remote-sailor-2",
        poseSyncMode: "runtime-server-sampled",
        presentation: Object.freeze({
          animationVocabulary: "idle",
          position: Object.freeze({
            x: 3,
            y: 1.2,
            z: -4
          }),
          yawRadians: 0.4
        })
      })
    ],
    1 / 60
  );

  const remoteCharacterRoot = scene.getObjectByName(
    "metaverse_character/test/remote-sailor-2"
  );

  assert.ok(remoteCharacterRoot);
  assert.equal(remoteCharacterRoot.position.x, 3);
  assert.equal(remoteCharacterRoot.position.y, 1.2);
  assert.equal(remoteCharacterRoot.position.z, -4);
  assert.deepEqual(mixerUpdateCalls, [1 / 60]);

  remoteCharacterPresentationState.resetPresentation();

  assert.equal(
    scene.getObjectByName("metaverse_character/test/remote-sailor-2"),
    undefined
  );
});

test("MetaverseSceneRemoteCharacterPresentationState restores held pose runtime when remote weapon state is absent", async () => {
  const [{ Group, Scene }, { MetaverseSceneRemoteCharacterPresentationState }] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/characters/metaverse-scene-remote-character-presentation-state.ts"
      )
    ]);
  const scene = new Scene();
  const calls = {
    captureHeldWeaponPoseRuntime: 0,
    restoreHeldWeaponPoseRuntime: 0,
    syncHeldWeaponPose: 0,
    syncHeldWeaponPoseAimStates: []
  };
  const sourceCharacterRuntime = {
    anchorGroup: new Group(),
    heldWeaponPoseRuntime: {},
    mixer: {
      update() {}
    }
  };
  const sourceAttachmentRuntime = {
    activeMountKind: "held",
    attachmentId: "metaverse-service-pistol-v1",
    holdProfile: Object.freeze({
      poseProfileId: "sidearm.one_hand_optional_support"
    })
  };
  const remoteCharacterPresentationState =
    new MetaverseSceneRemoteCharacterPresentationState({
      config: {
        bodyPresentation: {
          groundedFirstPersonHeadClearanceMeters: 0.1,
          groundedFirstPersonHeadOcclusionRadiusMeters: 0.2
        },
        orientation: {
          maxPitchRadians: Math.PI * 0.5,
          minPitchRadians: -Math.PI * 0.5
        }
      },
      interactivePresentationState: {
        attachmentProofRuntimesByAttachmentId: new Map([
          [sourceAttachmentRuntime.attachmentId, sourceAttachmentRuntime]
        ]),
        characterProofRuntime: sourceCharacterRuntime
      },
      remoteCharacterPresentationDependencies: {
        applyMountedAnchorTransform() {},
        captureHeldWeaponPoseRuntime() {
          calls.captureHeldWeaponPoseRuntime += 1;
        },
        prepareHeldWeaponPoseRuntime() {},
        cloneAttachmentRuntime(sourceRuntime) {
          return {
            activeMountKind: null,
            attachmentId: sourceRuntime.attachmentId,
            holdProfile: sourceRuntime.holdProfile
          };
        },
        cloneCharacterRuntime(_sourceCharacterRuntime, playerId) {
          const anchorGroup = new Group();

          anchorGroup.name = `metaverse_character/test/${playerId}`;

          return {
            anchorGroup,
            heldWeaponPoseRuntime: {},
            mixer: {
              update() {}
            }
          };
        },
        resolveHeldAnimationVocabulary(
          _characterRuntime,
          _attachmentRuntime,
          targetVocabulary
        ) {
          return targetVocabulary;
        },
        resolveMountedEnvironmentRuntime() {
          return null;
        },
        restoreHeldWeaponPoseRuntime() {
          calls.restoreHeldWeaponPoseRuntime += 1;
        },
        syncAttachmentMount(attachmentRuntime, _characterRuntime, _mountedOccupancy, weaponState) {
          attachmentRuntime.activeMountKind =
            weaponState?.weaponId === attachmentRuntime.attachmentId
              ? "held"
              : null;
        },
        syncCharacterAnimation() {},
        syncCharacterPresentation(characterRuntime, characterPresentation) {
          characterRuntime.anchorGroup.position.set(
            characterPresentation.position.x,
            characterPresentation.position.y,
            characterPresentation.position.z
          );
          characterRuntime.anchorGroup.updateMatrixWorld(true);
        },
        syncHeldWeaponPose(
          _characterRuntime,
          _heldWeaponPoseRuntime,
          _attachmentRuntime,
          aimState
        ) {
          calls.syncHeldWeaponPose += 1;
          calls.syncHeldWeaponPoseAimStates.push(aimState);
        },
        syncMountedCharacterRuntime() {
          return null;
        }
      },
      scene
    });
  const remotePresentation = Object.freeze({
    aimCamera: null,
    characterId: "mesh2motion-humanoid-v1",
    look: Object.freeze({
      pitchRadians: 0,
      yawRadians: 0
    }),
    mountedOccupancy: null,
    playerId: "remote-sailor-2",
    poseSyncMode: "runtime-server-sampled",
    presentation: Object.freeze({
      animationVocabulary: "idle",
      position: Object.freeze({
        x: 3,
        y: 1.2,
        z: -4
      }),
      yawRadians: 0.4
    }),
    weaponState: null
  });

  remoteCharacterPresentationState.syncPresentation([remotePresentation], 1 / 60);

  assert.deepEqual(calls, {
    captureHeldWeaponPoseRuntime: 1,
    restoreHeldWeaponPoseRuntime: 1,
    syncHeldWeaponPose: 0,
    syncHeldWeaponPoseAimStates: []
  });

  remoteCharacterPresentationState.syncPresentation(
    [
      Object.freeze({
        ...remotePresentation,
        aimCamera: Object.freeze({
          lookDirection: Object.freeze({ x: 0, y: 0, z: -1 }),
          pitchRadians: 0,
          position: Object.freeze({ x: 3, y: 2.8, z: -4 }),
          yawRadians: 0
        }),
        weaponState: Object.freeze({
          aimMode: "hip-fire",
          weaponId: "metaverse-service-pistol-v1"
        })
      })
    ],
    1 / 60
  );

  assert.deepEqual(calls, {
    captureHeldWeaponPoseRuntime: 2,
    restoreHeldWeaponPoseRuntime: 2,
    syncHeldWeaponPose: 1,
    syncHeldWeaponPoseAimStates: [
      calls.syncHeldWeaponPoseAimStates[0]
    ]
  });
  assert.equal(
    calls.syncHeldWeaponPoseAimStates[0]?.quality,
    "replicated_pitch_yaw"
  );
  assert.equal(
    calls.syncHeldWeaponPoseAimStates[0]?.source,
    "remote_replicated"
  );

  remoteCharacterPresentationState.syncPresentation(
    [
      Object.freeze({
        ...remotePresentation,
        aimCamera: null,
        weaponState: Object.freeze({
          aimMode: "hip-fire",
          weaponId: "metaverse-service-pistol-v1"
        })
      })
    ],
    1 / 60
  );

  assert.equal(calls.syncHeldWeaponPose, 2);
  assert.equal(
    calls.syncHeldWeaponPoseAimStates[1]?.quality,
    "last_known_replicated"
  );
  remoteCharacterPresentationState.syncPresentation(
    [
      Object.freeze({
        ...remotePresentation,
        aimCamera: null,
        weaponState: Object.freeze({
          aimMode: "hip-fire",
          weaponId: "metaverse-service-pistol-v1"
        })
      })
    ],
    0.3
  );

  assert.equal(calls.syncHeldWeaponPose, 2);
});
