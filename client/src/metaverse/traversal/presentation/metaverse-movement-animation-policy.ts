import type {
  MetaverseCharacterAnimationVocabularyId
} from "../../types/metaverse-runtime";

export interface MetaverseMovementAnimationPolicyModeConfig {
  readonly enterSpeedUnitsPerSecond: number;
  readonly exitSpeedUnitsPerSecond: number;
  readonly holdMs: number;
  readonly intentEnterThreshold: number;
  readonly minimumAppliedSpeedUnitsPerSecond: number;
}

export interface MetaverseMovementAnimationPolicyConfig {
  readonly grounded: MetaverseMovementAnimationPolicyModeConfig;
  readonly jump: {
    readonly downEnterVerticalSpeedUnitsPerSecond: number;
    readonly upEnterVerticalSpeedUnitsPerSecond: number;
  };
  readonly swim: MetaverseMovementAnimationPolicyModeConfig;
}

export interface MetaverseMovementAnimationPolicyInput {
  readonly grounded: boolean;
  readonly inputMagnitude: number;
  readonly locomotionMode: "grounded" | "swim";
  readonly planarSpeedUnitsPerSecond: number;
  readonly verticalSpeedUnitsPerSecond: number;
}

export const metaverseMovementAnimationPolicyConfig = Object.freeze({
  grounded: Object.freeze({
    enterSpeedUnitsPerSecond: 0.72,
    exitSpeedUnitsPerSecond: 0.34,
    holdMs: 140,
    intentEnterThreshold: 0.16,
    minimumAppliedSpeedUnitsPerSecond: 0.08
  }),
  jump: Object.freeze({
    downEnterVerticalSpeedUnitsPerSecond: -0.35,
    upEnterVerticalSpeedUnitsPerSecond: 0.35
  }),
  swim: Object.freeze({
    enterSpeedUnitsPerSecond: 0.4,
    exitSpeedUnitsPerSecond: 0.18,
    holdMs: 180,
    intentEnterThreshold: 0.12,
    minimumAppliedSpeedUnitsPerSecond: 0.05
  })
} satisfies MetaverseMovementAnimationPolicyConfig);

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function resolveJumpAnimationVocabulary(
  verticalSpeedUnitsPerSecond: number,
  config: MetaverseMovementAnimationPolicyConfig["jump"]
): Extract<
  MetaverseCharacterAnimationVocabularyId,
  "jump-down" | "jump-mid" | "jump-up"
> {
  if (
    verticalSpeedUnitsPerSecond >
    toFiniteNumber(config.upEnterVerticalSpeedUnitsPerSecond, 0.35)
  ) {
    return "jump-up";
  }

  if (
    verticalSpeedUnitsPerSecond <
    toFiniteNumber(config.downEnterVerticalSpeedUnitsPerSecond, -0.35)
  ) {
    return "jump-down";
  }

  return "jump-mid";
}

function resolveMovingAnimationVocabulary(
  currentVocabulary: MetaverseCharacterAnimationVocabularyId,
  movingVocabulary: "walk" | "swim",
  idleVocabulary: "idle" | "swim-idle",
  holdRemainingMs: number,
  inputMagnitude: number,
  planarSpeedUnitsPerSecond: number,
  config: MetaverseMovementAnimationPolicyModeConfig
): {
  readonly holdRemainingMs: number;
  readonly vocabulary: MetaverseCharacterAnimationVocabularyId;
} {
  const normalizedHoldMs = Math.max(0, toFiniteNumber(config.holdMs, 0));
  const normalizedInputMagnitude = clamp01(inputMagnitude);
  const normalizedPlanarSpeedUnitsPerSecond = Math.max(
    0,
    toFiniteNumber(planarSpeedUnitsPerSecond, 0)
  );
  const moveInputSupportsMovement =
    normalizedInputMagnitude >=
      clamp01(toFiniteNumber(config.intentEnterThreshold, 0)) &&
    normalizedPlanarSpeedUnitsPerSecond >=
      Math.max(0, toFiniteNumber(config.minimumAppliedSpeedUnitsPerSecond, 0));
  const shouldEnterMoving =
    normalizedPlanarSpeedUnitsPerSecond >=
      Math.max(0, toFiniteNumber(config.enterSpeedUnitsPerSecond, 0)) ||
    moveInputSupportsMovement;
  const shouldHoldMoving =
    currentVocabulary === movingVocabulary &&
    (normalizedPlanarSpeedUnitsPerSecond >=
      Math.max(0, toFiniteNumber(config.exitSpeedUnitsPerSecond, 0)) ||
      moveInputSupportsMovement ||
      holdRemainingMs > 0);

  if (shouldEnterMoving) {
    return {
      holdRemainingMs: normalizedHoldMs,
      vocabulary: movingVocabulary
    };
  }

  if (shouldHoldMoving) {
    return {
      holdRemainingMs,
      vocabulary: movingVocabulary
    };
  }

  return {
    holdRemainingMs: 0,
    vocabulary: idleVocabulary
  };
}

export class MetaverseMovementAnimationPolicyRuntime {
  readonly #config: MetaverseMovementAnimationPolicyConfig;

  #holdRemainingMs = 0;
  #vocabulary: MetaverseCharacterAnimationVocabularyId = "idle";

  constructor(
    config: MetaverseMovementAnimationPolicyConfig = metaverseMovementAnimationPolicyConfig
  ) {
    this.#config = config;
  }

  get animationVocabulary(): MetaverseCharacterAnimationVocabularyId {
    return this.#vocabulary;
  }

  reset(vocabulary: MetaverseCharacterAnimationVocabularyId = "idle"): void {
    this.#holdRemainingMs = 0;
    this.#vocabulary = vocabulary;
  }

  advance(
    input: MetaverseMovementAnimationPolicyInput,
    deltaSeconds: number
  ): MetaverseCharacterAnimationVocabularyId {
    const normalizedDeltaMs =
      deltaSeconds > 0 ? Math.max(0, toFiniteNumber(deltaSeconds, 0) * 1000) : 0;

    this.#holdRemainingMs = Math.max(0, this.#holdRemainingMs - normalizedDeltaMs);

    if (input.locomotionMode === "swim") {
      const nextState = resolveMovingAnimationVocabulary(
        this.#vocabulary,
        "swim",
        "swim-idle",
        this.#holdRemainingMs,
        input.inputMagnitude,
        input.planarSpeedUnitsPerSecond,
        this.#config.swim
      );

      this.#holdRemainingMs = nextState.holdRemainingMs;
      this.#vocabulary = nextState.vocabulary;
      return this.#vocabulary;
    }

    if (!input.grounded) {
      this.#holdRemainingMs = 0;
      this.#vocabulary = resolveJumpAnimationVocabulary(
        input.verticalSpeedUnitsPerSecond,
        this.#config.jump
      );
      return this.#vocabulary;
    }

    const nextState = resolveMovingAnimationVocabulary(
      this.#vocabulary,
      "walk",
      "idle",
      this.#holdRemainingMs,
      input.inputMagnitude,
      input.planarSpeedUnitsPerSecond,
      this.#config.grounded
    );

    this.#holdRemainingMs = nextState.holdRemainingMs;
    this.#vocabulary = nextState.vocabulary;
    return this.#vocabulary;
  }
}
