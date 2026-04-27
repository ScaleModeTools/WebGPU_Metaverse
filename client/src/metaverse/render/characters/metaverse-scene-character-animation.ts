import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group
} from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import {
  isHumanoidV2PistolAimOverlayTrack,
  isHumanoidV2PistolPitchDrivenTrack,
  isHumanoidV2PistolLowerBodyTrack
} from "../humanoid-v2-rig";

import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCharacterProofConfig,
  MetaverseHumanoidV2PistolPoseId,
  MetaverseRuntimeConfig
} from "../../types/metaverse-runtime";
import { metaverseHumanoidV2PistolPoseIds } from "../../types/metaverse-runtime";

const humanoidV2PistolLowerBodyVocabularyIds = Object.freeze([
  "idle",
  "walk"
] as const satisfies readonly MetaverseCharacterAnimationVocabularyId[]);
const humanoidV2PistolPoseWeightEpsilon = 0.000001;
const metaverseCharacterRenderYawOffsetRadians = Math.PI;
const minimumAnimationPlaybackRateMagnitude = 0.01;

export interface HumanoidV2PistolPoseRuntime {
  readonly actionsByPoseId: ReadonlyMap<
    MetaverseHumanoidV2PistolPoseId,
    AnimationAction
  >;
  readonly clipsByPoseId: ReadonlyMap<
    MetaverseHumanoidV2PistolPoseId,
    AnimationClip
  >;
}

export interface MetaverseCharacterAnimationRuntimeLike {
  activeAnimationActionSetId: "full-body" | "humanoid_v2_pistol_lower_body";
  activeAnimationCycleId: number | null;
  activeAnimationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly actionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >;
  readonly anchorGroup: Group;
  readonly humanoidV2PistolLowerBodyActionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  > | null;
  readonly humanoidV2PistolPoseRuntime: HumanoidV2PistolPoseRuntime | null;
  readonly skeletonId: MetaverseCharacterProofConfig["skeletonId"];
}

export interface MetaverseAttachmentAnimationRuntimeLike {
  readonly activeMountKind: "held" | "mounted-holster" | null;
  readonly attachmentId: string;
}

export function shouldUseHeldWeaponCharacterPresentation(
  attachmentRuntime: MetaverseAttachmentAnimationRuntimeLike | null,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  mountedCharacterRuntime: unknown | null
): boolean {
  return (
    weaponState !== null &&
    mountedCharacterRuntime === null &&
    attachmentRuntime !== null &&
    weaponState.weaponId === attachmentRuntime.attachmentId &&
    attachmentRuntime.activeMountKind === "held"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRadians(rawValue: number): number {
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

function resolveCharacterRenderYawRadians(yawRadians: number): number {
  return wrapRadians(metaverseCharacterRenderYawOffsetRadians - yawRadians);
}

function resolveAnimationPlaybackRate(
  vocabulary: MetaverseCharacterAnimationVocabularyId,
  useHumanoidV2PistolLayering: boolean,
  playbackRateMultiplier: number
): number {
  if (vocabulary === "walk") {
    return (useHumanoidV2PistolLayering ? 1 : 1.1) * playbackRateMultiplier;
  }

  if (vocabulary === "swim") {
    return 1.06;
  }

  return 1;
}

function createHumanoidV2LowerBodyLocomotionClip(
  clip: AnimationClip
): AnimationClip {
  const lowerBodyTracks = clip.tracks.filter((track) =>
    isHumanoidV2PistolLowerBodyTrack(track.name)
  );

  if (lowerBodyTracks.length === 0) {
    throw new Error(
      `Metaverse humanoid_v2 lower-body locomotion clip ${clip.name} did not retain any lower-body tracks.`
    );
  }

  return new AnimationClip(
    `${clip.name}__metaverse_lower_body`,
    clip.duration,
    lowerBodyTracks,
    clip.blendMode
  );
}

export function createHumanoidV2UpperBodyPistolPoseClip(
  clip: AnimationClip
): AnimationClip {
  const upperBodyTracks = clip.tracks.filter((track) =>
    isHumanoidV2PistolAimOverlayTrack(track.name)
  );

  if (upperBodyTracks.length === 0) {
    throw new Error(
      `Metaverse humanoid_v2 pistol pose clip ${clip.name} did not retain any upper-body tracks.`
    );
  }

  return new AnimationClip(
    `${clip.name}__metaverse_upper_body`,
    clip.duration,
    upperBodyTracks,
    clip.blendMode
  );
}

export function createHumanoidV2PitchSelectivePistolPoseClip(
  pitchClip: AnimationClip,
  neutralClip: AnimationClip
): AnimationClip {
  const pitchTracksByName = new Map(
    pitchClip.tracks.map((track) => [track.name, track])
  );
  const hybridTracks = neutralClip.tracks.map((track) => {
    const pitchTrack = pitchTracksByName.get(track.name);

    if (
      pitchTrack !== undefined &&
      isHumanoidV2PistolPitchDrivenTrack(track.name)
    ) {
      return pitchTrack.clone();
    }

    return track.clone();
  });

  return new AnimationClip(
    `${pitchClip.name}__metaverse_pitch_selective`,
    neutralClip.duration,
    hybridTracks,
    neutralClip.blendMode
  );
}

export function createHumanoidV2PistolLowerBodyActionsByVocabulary(
  mixer: AnimationMixer,
  clipsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationClip
  >
): ReadonlyMap<MetaverseCharacterAnimationVocabularyId, AnimationAction> {
  const actionsByVocabulary = new Map<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >();

  for (const vocabulary of humanoidV2PistolLowerBodyVocabularyIds) {
    const clip = clipsByVocabulary.get(vocabulary);

    if (clip === undefined) {
      continue;
    }

    actionsByVocabulary.set(
      vocabulary,
      mixer.clipAction(createHumanoidV2LowerBodyLocomotionClip(clip))
    );
  }

  return actionsByVocabulary;
}

export function createHumanoidV2PistolPoseRuntime(
  mixer: AnimationMixer,
  clipsByPoseId: ReadonlyMap<MetaverseHumanoidV2PistolPoseId, AnimationClip>
): HumanoidV2PistolPoseRuntime {
  const actionsByPoseId = new Map<
    MetaverseHumanoidV2PistolPoseId,
    AnimationAction
  >();

  for (const poseId of metaverseHumanoidV2PistolPoseIds) {
    const clip = clipsByPoseId.get(poseId);

    if (clip === undefined) {
      throw new Error(
        `Metaverse humanoid_v2 pistol pose runtime is missing ${poseId}.`
      );
    }

    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(0);
    action.play();
    actionsByPoseId.set(poseId, action);
  }

  return {
    actionsByPoseId,
    clipsByPoseId
  };
}

export function syncCharacterPresentation(
  characterRuntime: Pick<MetaverseCharacterAnimationRuntimeLike, "anchorGroup">,
  characterPresentation: MetaverseCharacterPresentationSnapshot | null,
  mountedCharacterRuntime: object | null
): void {
  const shouldShowCharacter =
    characterPresentation !== null || mountedCharacterRuntime !== null;

  characterRuntime.anchorGroup.visible = shouldShowCharacter;

  if (characterPresentation === null || mountedCharacterRuntime !== null) {
    return;
  }

  characterRuntime.anchorGroup.position.set(
    characterPresentation.position.x,
    characterPresentation.position.y,
    characterPresentation.position.z
  );
  characterRuntime.anchorGroup.rotation.set(
    0,
    resolveCharacterRenderYawRadians(characterPresentation.yawRadians),
    0
  );
  characterRuntime.anchorGroup.updateMatrixWorld(true);
}

export function resolveHeldCharacterAnimationVocabulary(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "actionsByVocabulary" | "humanoidV2PistolPoseRuntime" | "skeletonId"
  >,
  attachmentRuntime: MetaverseAttachmentAnimationRuntimeLike | null,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  mountedCharacterRuntime: object | null
): MetaverseCharacterAnimationVocabularyId {
  if (
    !shouldUseHeldWeaponCharacterPresentation(
      attachmentRuntime,
      weaponState,
      mountedCharacterRuntime
    ) ||
    targetVocabulary !== "idle" ||
    !characterRuntime.actionsByVocabulary.has("aim")
  ) {
    return targetVocabulary;
  }

  return characterRuntime.humanoidV2PistolPoseRuntime === null
    ? "aim"
    : targetVocabulary;
}

export function syncCharacterAnimation(
  characterRuntime: MetaverseCharacterAnimationRuntimeLike,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  useHumanoidV2PistolLayering: boolean = false,
  animationCycleId?: number | null,
  animationPlaybackRateMultiplier: number = 1
): void {
  const resolveNextVocabulary = (): MetaverseCharacterAnimationVocabularyId => {
    const fallbackCandidates: readonly MetaverseCharacterAnimationVocabularyId[] =
      targetVocabulary === "swim-idle"
        ? ["swim-idle", "idle"]
        : targetVocabulary === "swim"
          ? ["swim", "walk", "idle"]
          : targetVocabulary === "jump-up" ||
              targetVocabulary === "jump-mid" ||
              targetVocabulary === "jump-down"
            ? [targetVocabulary, "walk", "idle"]
            : [targetVocabulary, "idle"];

    for (const vocabulary of fallbackCandidates) {
      if (characterRuntime.actionsByVocabulary.has(vocabulary)) {
        return vocabulary;
      }
    }

    return "idle";
  };
  const nextVocabulary = resolveNextVocabulary();
  const resolveActionByVocabulary = (
    vocabulary: MetaverseCharacterAnimationVocabularyId,
    preferHumanoidV2PistolLayering: boolean
  ): {
    readonly action: AnimationAction;
    readonly actionSetId: MetaverseCharacterAnimationRuntimeLike["activeAnimationActionSetId"];
  } | null => {
    if (preferHumanoidV2PistolLayering) {
      const lowerBodyAction =
        characterRuntime.humanoidV2PistolLowerBodyActionsByVocabulary?.get(
          vocabulary
        );

      if (lowerBodyAction !== undefined) {
        return {
          action: lowerBodyAction,
          actionSetId: "humanoid_v2_pistol_lower_body"
        };
      }
    }

    const fullBodyAction = characterRuntime.actionsByVocabulary.get(vocabulary);

    return fullBodyAction === undefined
      ? null
      : {
          action: fullBodyAction,
          actionSetId: "full-body"
        };
  };
  const nextActionSelection = resolveActionByVocabulary(
    nextVocabulary,
    useHumanoidV2PistolLayering
  );
  const resolvedAnimationCycleId =
    animationCycleId === null || animationCycleId === undefined
      ? characterRuntime.activeAnimationCycleId
      : Math.max(0, Math.trunc(animationCycleId));
  const resolvedAnimationPlaybackRateMultiplier =
    !Number.isFinite(animationPlaybackRateMultiplier)
      ? 1
      : animationPlaybackRateMultiplier === 0
        ? minimumAnimationPlaybackRateMagnitude
        : Math.sign(animationPlaybackRateMultiplier) *
          Math.max(
            minimumAnimationPlaybackRateMagnitude,
            Math.abs(animationPlaybackRateMultiplier)
          );
  const nextPlaybackRate = resolveAnimationPlaybackRate(
    nextVocabulary,
    useHumanoidV2PistolLayering,
    resolvedAnimationPlaybackRateMultiplier
  );
  const shouldRestartCurrentAction =
    resolvedAnimationCycleId !== null &&
    resolvedAnimationCycleId !== characterRuntime.activeAnimationCycleId;

  if (nextActionSelection === null) {
    return;
  }

  if (
    nextVocabulary === characterRuntime.activeAnimationVocabulary &&
    nextActionSelection.actionSetId ===
      characterRuntime.activeAnimationActionSetId &&
    !shouldRestartCurrentAction
  ) {
    nextActionSelection.action.setEffectiveTimeScale(nextPlaybackRate);
    return;
  }

  const previousActionSelection = resolveActionByVocabulary(
    characterRuntime.activeAnimationVocabulary,
    characterRuntime.activeAnimationActionSetId ===
      "humanoid_v2_pistol_lower_body"
  );
  const nextAction = nextActionSelection.action;
  const previousAction = previousActionSelection?.action;
  const previousVocabulary = characterRuntime.activeAnimationVocabulary;

  nextAction.enabled = true;
  nextAction.setEffectiveTimeScale(nextPlaybackRate);
  nextAction.setEffectiveWeight(1);
  nextAction.zeroSlopeAtStart = true;
  nextAction.zeroSlopeAtEnd = nextVocabulary === "idle";
  nextAction.reset();
  nextAction.time = nextPlaybackRate < 0 ? nextAction.getClip().duration : 0;
  nextAction.play();

  if (previousAction !== undefined && previousAction !== nextAction) {
    previousAction.zeroSlopeAtEnd = nextVocabulary === "idle";

    if (
      previousVocabulary === "idle" &&
      (nextVocabulary === "walk" || nextVocabulary === "swim")
    ) {
      nextAction.crossFadeFrom(previousAction, 0.24, true);
    } else if (
      (previousVocabulary === "walk" || previousVocabulary === "swim") &&
      nextVocabulary === "idle"
    ) {
      previousAction.setEffectiveTimeScale(0.92);
      nextAction.crossFadeFrom(previousAction, 0.32, false);
    } else {
      nextAction.crossFadeFrom(previousAction, 0.18, true);
    }
  }

  characterRuntime.activeAnimationActionSetId = nextActionSelection.actionSetId;
  characterRuntime.activeAnimationCycleId = resolvedAnimationCycleId;
  characterRuntime.activeAnimationVocabulary = nextVocabulary;
}

function setHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime,
  weights: Readonly<Record<MetaverseHumanoidV2PistolPoseId, number>>
): void {
  for (const poseId of metaverseHumanoidV2PistolPoseIds) {
    const action = pistolPoseRuntime.actionsByPoseId.get(poseId);

    if (action === undefined) {
      continue;
    }

    const weight = clamp(weights[poseId], 0, 1);
    action.enabled = weight > humanoidV2PistolPoseWeightEpsilon;
    action.setEffectiveWeight(weight);
  }
}

export function clearHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime
): void {
  setHumanoidV2PistolPoseWeights(pistolPoseRuntime, {
    down: 0,
    neutral: 0,
    up: 0
  });
}

export function syncHumanoidV2PistolPoseWeights(
  pistolPoseRuntime: HumanoidV2PistolPoseRuntime,
  pitchRadians: number,
  orientation: Pick<
    MetaverseRuntimeConfig["orientation"],
    "maxPitchRadians" | "minPitchRadians"
  >
): void {
  const downRangeRadians = Math.max(
    Math.abs(orientation.minPitchRadians),
    humanoidV2PistolPoseWeightEpsilon
  );
  const upRangeRadians = Math.max(
    orientation.maxPitchRadians,
    humanoidV2PistolPoseWeightEpsilon
  );
  const clampedPitchRadians = clamp(
    pitchRadians,
    orientation.minPitchRadians,
    orientation.maxPitchRadians
  );
  const downWeight =
    clampedPitchRadians < 0
      ? clamp(Math.abs(clampedPitchRadians) / downRangeRadians, 0, 1)
      : 0;
  const upWeight =
    clampedPitchRadians > 0
      ? clamp(clampedPitchRadians / upRangeRadians, 0, 1)
      : 0;
  const neutralWeight = clamp(1 - Math.max(downWeight, upWeight), 0, 1);

  setHumanoidV2PistolPoseWeights(pistolPoseRuntime, {
    down: downWeight,
    neutral: neutralWeight,
    up: upWeight
  });
}
