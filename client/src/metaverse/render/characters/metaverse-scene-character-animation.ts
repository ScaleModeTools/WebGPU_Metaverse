import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Group,
  LoopOnce
} from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";

import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCharacterCombatAnimationActionId,
  MetaverseCombatPresentationEvent,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCharacterProofConfig
} from "../../types/metaverse-runtime";

const metaverseCharacterRenderYawOffsetRadians = Math.PI;
const minimumAnimationPlaybackRateMagnitude = 0.01;

export interface MetaverseCharacterCombatAnimationRuntime {
  readonly actionsByActionId: ReadonlyMap<
    MetaverseCharacterCombatAnimationActionId,
    AnimationAction
  >;
  readonly clipsByActionId: ReadonlyMap<
    MetaverseCharacterCombatAnimationActionId,
    AnimationClip
  >;
}

export interface MetaverseCharacterAnimationRuntimeLike {
  activeAnimationActionSetId: "full-body";
  activeAnimationCycleId: number | null;
  activeAnimationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly actionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >;
  readonly anchorGroup: Group;
  readonly combatAnimationRuntime: MetaverseCharacterCombatAnimationRuntime | null;
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
  playbackRateMultiplier: number
): number {
  if (vocabulary === "walk") {
    return 1.1 * playbackRateMultiplier;
  }

  if (vocabulary === "swim") {
    return 1.06;
  }

  return 1;
}

export function createMetaverseCharacterCombatAnimationRuntime(
  mixer: AnimationMixer,
  clipsByActionId: ReadonlyMap<
    MetaverseCharacterCombatAnimationActionId,
    AnimationClip
  >
): MetaverseCharacterCombatAnimationRuntime {
  const actionsByActionId = new Map<
    MetaverseCharacterCombatAnimationActionId,
    AnimationAction
  >();

  for (const [actionId, clip] of clipsByActionId) {
    const action = mixer.clipAction(clip);

    action.enabled = false;
    action.clampWhenFinished = false;
    action.setLoop(LoopOnce, 1);
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(0);
    actionsByActionId.set(actionId, action);
  }

  return {
    actionsByActionId,
    clipsByActionId
  };
}

export function clearCharacterCombatDeathAnimation(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "combatAnimationRuntime"
  >
): void {
  const deathAction =
    characterRuntime.combatAnimationRuntime?.actionsByActionId.get("death");

  if (deathAction === undefined) {
    return;
  }

  deathAction.stop();
  deathAction.enabled = false;
  deathAction.setEffectiveWeight(0);
}

export function triggerCharacterCombatPresentationEvent(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "combatAnimationRuntime"
  >,
  event: MetaverseCombatPresentationEvent
): void {
  if (event.kind === "shot" || event.kind === "projectile-impact") {
    // Weapon fire and projectile impacts are FX-owned presentation events.
    return;
  }

  const combatAnimationRuntime = characterRuntime.combatAnimationRuntime;

  if (combatAnimationRuntime === null) {
    return;
  }

  const actionId: MetaverseCharacterCombatAnimationActionId = event.kind;
  const action = combatAnimationRuntime.actionsByActionId.get(actionId);

  if (action === undefined) {
    return;
  }

  action.stop();
  action.enabled = true;
  action.clampWhenFinished = event.kind === "death";
  action.reset();
  action.setLoop(LoopOnce, 1);
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(0.86);
  action.play();
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
    "actionsByVocabulary" | "skeletonId"
  >,
  attachmentRuntime: MetaverseAttachmentAnimationRuntimeLike | null,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null,
  mountedCharacterRuntime: object | null
): MetaverseCharacterAnimationVocabularyId {
  return targetVocabulary;
}

export function syncCharacterAnimation(
  characterRuntime: MetaverseCharacterAnimationRuntimeLike,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
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
    vocabulary: MetaverseCharacterAnimationVocabularyId
  ): {
    readonly action: AnimationAction;
    readonly actionSetId: MetaverseCharacterAnimationRuntimeLike["activeAnimationActionSetId"];
  } | null => {
    const fullBodyAction = characterRuntime.actionsByVocabulary.get(vocabulary);

    return fullBodyAction === undefined
      ? null
      : {
          action: fullBodyAction,
          actionSetId: "full-body"
        };
  };
  const nextActionSelection = resolveActionByVocabulary(nextVocabulary);
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
    characterRuntime.activeAnimationVocabulary
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
