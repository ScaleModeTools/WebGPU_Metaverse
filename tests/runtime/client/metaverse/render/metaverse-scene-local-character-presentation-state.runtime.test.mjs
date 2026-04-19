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

test("MetaverseSceneLocalCharacterPresentationState owns local animation advance, mounted sync, and attachment mount reset", async () => {
  const [
    { Group },
    { MetaverseSceneLocalCharacterPresentationState },
    { createMetaverseSceneMountedPresentationSnapshot }
  ] =
    await Promise.all([
      import("three/webgpu"),
      clientLoader.load(
        "/src/metaverse/render/characters/metaverse-scene-local-character-presentation-state.ts"
      ),
      clientLoader.load(
        "/src/metaverse/render/mounts/metaverse-scene-mounted-presentation-snapshot.ts"
      )
    ]);
  const calls = [];
  const cameraSnapshot = Object.freeze({
    lookDirection: Object.freeze({ x: 0, y: 0, z: -1 }),
    pitchRadians: 0,
    position: Object.freeze({ x: 5, y: 1.62, z: 9 }),
    yawRadians: 0
  });
  const characterPresentation = Object.freeze({
    animationVocabulary: "idle",
    position: Object.freeze({
      x: 1,
      y: 2,
      z: 3
    }),
    yawRadians: 0.25
  });
  const mountedEnvironment = Object.freeze({
    cameraPolicyId: "vehicle-follow",
    controlRoutingPolicyId: "vehicle-surface-drive",
    directSeatTargets: Object.freeze([]),
    environmentAssetId: "metaverse-hub-skiff-v1",
    entryId: null,
    label: "Metaverse hub skiff",
    lookLimitPolicyId: "driver-forward",
    occupancyAnimationId: "seated",
    occupancyKind: "seat",
    occupantRole: "driver",
    occupantLabel: "Take helm",
    seatId: "driver_seat",
    seatTargets: Object.freeze([])
  });
  const mountedOccupancyPresentationState = Object.freeze({
    constrainToAnchor: true,
    holsterHeldAttachment: true,
    keepFreeRoam: false,
    lookConstraintBounds: Object.freeze({
      maxPitchRadians: 0.6,
      maxYawOffsetRadians: 0,
      minPitchRadians: -0.6
    }),
    mountedCharacterAnimationVocabulary: "seated",
    usesMountedAnchorCamera: false,
    usesVehicleFollowCamera: true
  });
  const mountedPresentationSnapshot =
    createMetaverseSceneMountedPresentationSnapshot(mountedEnvironment);
  const characterRuntime = {
    activeAnimationActionSetId: "full-body",
    activeAnimationVocabulary: "idle",
    actionsByVocabulary: new Map([["idle", Object.freeze({})]]),
    anchorGroup: new Group(),
    firstPersonHeadAnchorNodes: [],
    heldWeaponPoseRuntime: null,
    humanoidV2PistolLowerBodyActionsByVocabulary: null,
    humanoidV2PistolPoseRuntime: null,
    mixer: {
      update(deltaSeconds) {
        calls.push(["mixer-update", deltaSeconds]);
      }
    },
    skeletonId: "humanoid_v2"
  };
  const localCharacterPresentationState =
    new MetaverseSceneLocalCharacterPresentationState({
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
        attachmentProofRuntime: null,
        characterProofRuntime: characterRuntime,
        syncAttachmentMount(nextMountedEnvironment) {
          calls.push(["sync-attachment-mount", nextMountedEnvironment]);
        }
      },
      localCharacterPresentationDependencies: {
        applyMountedAnchorTransform() {
          calls.push("apply-mounted-anchor-transform");
        },
        restoreHeldWeaponPoseRuntime() {
          calls.push("restore-held-weapon-pose-runtime");
        },
        syncHeldWeaponPose() {
          calls.push("sync-held-weapon-pose");
        }
      },
      mountInteractionState: {
        readMountedCharacterRuntime() {
          calls.push("read-mounted-character-runtime");
          return null;
        },
        syncMountedCharacterRuntime(
          nextMountedEnvironment,
          nextMountedOccupancyPresentationState
        ) {
          calls.push([
            "sync-mounted-character-runtime",
            nextMountedEnvironment,
            nextMountedOccupancyPresentationState
          ]);
        }
      }
    });

  const presentedCameraSnapshot = localCharacterPresentationState.syncPresentation(
    cameraSnapshot,
    1 / 60,
    characterPresentation,
    mountedPresentationSnapshot
  );

  assert.equal(presentedCameraSnapshot, cameraSnapshot);
  assert.deepEqual(calls, [
    "read-mounted-character-runtime",
    ["mixer-update", 1 / 60],
    [
      "sync-mounted-character-runtime",
      mountedEnvironment,
      mountedOccupancyPresentationState
    ],
    ["sync-attachment-mount", mountedOccupancyPresentationState],
    "read-mounted-character-runtime"
  ]);
  assert.equal(characterRuntime.anchorGroup.position.x, 1);
  assert.equal(characterRuntime.anchorGroup.position.y, 2);
  assert.equal(characterRuntime.anchorGroup.position.z, 3);

  localCharacterPresentationState.resetPresentation();

  assert.deepEqual(calls.slice(5), [["sync-attachment-mount", null]]);
});
