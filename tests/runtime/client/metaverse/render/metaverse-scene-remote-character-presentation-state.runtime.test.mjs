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
    humanoidV2PistolPoseRuntime: null,
    mixer: {
      update() {}
    }
  };
  const interactivePresentationState = {
    attachmentProofRuntime: null,
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
        clearPistolPoseWeights() {},
        captureHeldWeaponPoseRuntime() {},
        cloneAttachmentRuntime() {
          return null;
        },
        cloneCharacterRuntime(_sourceCharacterRuntime, playerId) {
          const anchorGroup = new Group();

          anchorGroup.name = `metaverse_character/test/${playerId}`;
          return {
            anchorGroup,
            heldWeaponPoseRuntime: null,
            humanoidV2PistolPoseRuntime: null,
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
        },
        syncPistolPoseWeights() {}
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
