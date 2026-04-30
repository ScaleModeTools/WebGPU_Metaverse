import {
  AnimationAction,
  Group
} from "three/webgpu";
import type { MetaverseRealtimePlayerWeaponStateSnapshot } from "@webgpu-metaverse/shared";
import {
  MetaverseCharacterRapierRagdollRuntime
} from "./metaverse-scene-character-ragdoll";

import type {
  MetaverseCharacterAnimationVocabularyId,
  MetaverseCombatPresentationEvent,
  MetaverseCharacterPresentationSnapshot,
  MetaverseCharacterProofConfig
} from "../../types/metaverse-runtime";

const metaverseCharacterRenderYawOffsetRadians = Math.PI;
const minimumAnimationPlaybackRateMagnitude = 0.01;
const metaverseCharacterHitReactionDurationMs = 185;
const metaverseCharacterHitReactionDirectionEpsilon = 0.000001;
const metaverseCharacterHitReactionMaxHorizontalMeters = 0.035;
const metaverseCharacterHitReactionMaxLiftMeters = 0.018;
const metaverseCharacterHitReactionMaxPitchRadians = 0.018;
const metaverseCharacterHitReactionMaxRollRadians = 0.032;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function clampSignedUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}

function resolveProceduralHitReactionIntensity(
  event: MetaverseCombatPresentationEvent
): number {
  const damageAmount = event.damageAmount ?? 0;
  const damageIntensity = Number.isFinite(damageAmount)
    ? clampUnit(damageAmount / 42)
    : 0;
  const hitZoneMultiplier = event.hitZone === "head" ? 1.18 : 1;

  return Math.min(1.15, Math.max(0.34, damageIntensity) * hitZoneMultiplier);
}

function resolveFallbackHitReactionDirection(
  sequence: number
): {
  readonly x: number;
  readonly z: number;
} {
  const angle = sequence * 2.399963229728653;

  return Object.freeze({
    x: Math.sin(angle),
    z: -Math.cos(angle)
  });
}

export class MetaverseCharacterProceduralHitReactionRuntime {
  #activeSequence = -1;
  #intensity = 0;
  #sourceDirectionX = 0;
  #sourceDirectionZ = -1;
  #startedAtMs = 0;

  trigger(event: MetaverseCombatPresentationEvent): void {
    if (event.sequence < this.#activeSequence) {
      return;
    }

    const sourceDirection = event.damageSourceDirectionWorld ?? null;
    const sourceDirectionLength =
      sourceDirection === null
        ? 0
        : Math.hypot(sourceDirection.x, sourceDirection.z);
    const fallbackDirection = resolveFallbackHitReactionDirection(
      event.sequence
    );

    this.#activeSequence = event.sequence;
    this.#startedAtMs = event.startedAtMs;
    this.#intensity = resolveProceduralHitReactionIntensity(event);

    if (
      sourceDirection !== null &&
      sourceDirectionLength > metaverseCharacterHitReactionDirectionEpsilon
    ) {
      this.#sourceDirectionX = sourceDirection.x / sourceDirectionLength;
      this.#sourceDirectionZ = sourceDirection.z / sourceDirectionLength;
    } else {
      this.#sourceDirectionX = fallbackDirection.x;
      this.#sourceDirectionZ = fallbackDirection.z;
    }
  }

  apply(anchorGroup: Group, nowMs: number): void {
    if (this.#activeSequence < 0) {
      return;
    }

    const ageMs = Math.max(0, nowMs - this.#startedAtMs);

    if (ageMs >= metaverseCharacterHitReactionDurationMs) {
      return;
    }

    const alpha = clampUnit(ageMs / metaverseCharacterHitReactionDurationMs);
    const decay = (1 - alpha) * (1 - alpha);
    const oscillation = Math.sin(alpha * Math.PI * 5.25);
    const horizontalMeters =
      metaverseCharacterHitReactionMaxHorizontalMeters *
      this.#intensity *
      decay *
      (0.68 + Math.abs(oscillation) * 0.32);
    const liftMeters =
      metaverseCharacterHitReactionMaxLiftMeters *
      this.#intensity *
      Math.sin(alpha * Math.PI) *
      decay;

    anchorGroup.position.x -= this.#sourceDirectionX * horizontalMeters;
    anchorGroup.position.z -= this.#sourceDirectionZ * horizontalMeters;
    anchorGroup.position.y += liftMeters;
    anchorGroup.rotation.x +=
      metaverseCharacterHitReactionMaxPitchRadians *
      this.#intensity *
      decay *
      oscillation;
    anchorGroup.rotation.z +=
      metaverseCharacterHitReactionMaxRollRadians *
      this.#intensity *
      decay *
      clampSignedUnit(this.#sourceDirectionX) *
      (0.7 + Math.abs(oscillation) * 0.3);
    anchorGroup.updateMatrixWorld(true);
  }
}

export interface MetaverseCharacterAnimationRuntimeLike {
  activeAnimationCycleId: number | null;
  activeAnimationVocabulary: MetaverseCharacterAnimationVocabularyId;
  readonly actionsByVocabulary: ReadonlyMap<
    MetaverseCharacterAnimationVocabularyId,
    AnimationAction
  >;
  readonly anchorGroup: Group;
  readonly deathRagdollRuntime: MetaverseCharacterRapierRagdollRuntime;
  readonly proceduralHitReactionRuntime: MetaverseCharacterProceduralHitReactionRuntime;
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

export function clearCharacterCombatDeathPresentation(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "deathRagdollRuntime"
  >
): void {
  characterRuntime.deathRagdollRuntime.clear();
}

export function triggerCharacterCombatPresentationEvent(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    | "deathRagdollRuntime"
    | "proceduralHitReactionRuntime"
  >,
  event: MetaverseCombatPresentationEvent
): void {
  if (event.kind === "shot" || event.kind === "projectile-impact") {
    // Weapon fire and projectile impacts are FX-owned presentation events.
    return;
  }

  if (event.kind === "hit") {
    characterRuntime.proceduralHitReactionRuntime.trigger(event);
    return;
  }

  if (event.kind === "death") {
    characterRuntime.deathRagdollRuntime.trigger(event);
  }
}

export function syncCharacterProceduralHitReaction(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "anchorGroup" | "proceduralHitReactionRuntime"
  >,
  nowMs: number
): void {
  characterRuntime.proceduralHitReactionRuntime.apply(
    characterRuntime.anchorGroup,
    nowMs
  );
}

export function syncCharacterDeathRagdollPresentation(
  characterRuntime: Pick<
    MetaverseCharacterAnimationRuntimeLike,
    "deathRagdollRuntime"
  >,
  nowMs: number
): void {
  characterRuntime.deathRagdollRuntime.apply(nowMs);
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

export function syncCharacterAnimation(
  characterRuntime: MetaverseCharacterAnimationRuntimeLike,
  targetVocabulary: MetaverseCharacterAnimationVocabularyId,
  animationCycleId?: number | null,
  animationPlaybackRateMultiplier: number = 1
): void {
  let nextVocabulary = targetVocabulary;
  let nextAction = characterRuntime.actionsByVocabulary.get(nextVocabulary);

  if (nextAction === undefined) {
    if (targetVocabulary === "swim") {
      nextVocabulary = "walk";
      nextAction = characterRuntime.actionsByVocabulary.get(nextVocabulary);
    }

    if (
      nextAction === undefined &&
      (targetVocabulary === "jump-up" ||
        targetVocabulary === "jump-mid" ||
        targetVocabulary === "jump-down")
    ) {
      nextVocabulary = "walk";
      nextAction = characterRuntime.actionsByVocabulary.get(nextVocabulary);
    }

    if (nextAction === undefined) {
      nextVocabulary = "idle";
      nextAction = characterRuntime.actionsByVocabulary.get(nextVocabulary);
    }
  }
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

  if (nextAction === undefined) {
    return;
  }

  if (
    nextVocabulary === characterRuntime.activeAnimationVocabulary &&
    !shouldRestartCurrentAction
  ) {
    nextAction.setEffectiveTimeScale(nextPlaybackRate);
    return;
  }

  const previousAction = characterRuntime.actionsByVocabulary.get(
    characterRuntime.activeAnimationVocabulary
  );
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

  characterRuntime.activeAnimationCycleId = resolvedAnimationCycleId;
  characterRuntime.activeAnimationVocabulary = nextVocabulary;
}
