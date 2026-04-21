import type { MetaverseGroundedBodySnapshot } from "@/physics";

import type { MetaverseCharacterAnimationVocabularyId } from "../../types/presentation";

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
  readonly moveAxis: number;
  readonly planarSpeedUnitsPerSecond: number;
  readonly strafeAxis: number;
  readonly verticalSpeedUnitsPerSecond: number;
}

export interface GroundedMovementAnimationPolicyInputConfig {
  readonly groundedBodySnapshot: Pick<
    MetaverseGroundedBodySnapshot,
    "grounded" | "jumpBody" | "linearVelocity"
  >;
  readonly inputMagnitude: number;
  readonly moveAxis: number;
  readonly strafeAxis: number;
}

export const metaverseMovementAnimationPolicyConfig = Object.freeze({
  grounded: Object.freeze({
    enterSpeedUnitsPerSecond: 0.52,
    exitSpeedUnitsPerSecond: 0.2,
    holdMs: 90,
    intentEnterThreshold: 0.12,
    minimumAppliedSpeedUnitsPerSecond: 0.05
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

export function createGroundedMovementAnimationPolicyInput({
  groundedBodySnapshot,
  inputMagnitude,
  moveAxis,
  strafeAxis
}: GroundedMovementAnimationPolicyInputConfig): MetaverseMovementAnimationPolicyInput {
  return {
    grounded: groundedBodySnapshot.grounded,
    inputMagnitude,
    locomotionMode: "grounded",
    moveAxis,
    planarSpeedUnitsPerSecond: Math.hypot(
      groundedBodySnapshot.linearVelocity.x,
      groundedBodySnapshot.linearVelocity.z
    ),
    strafeAxis,
    verticalSpeedUnitsPerSecond:
      groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond
  };
}

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

function sanitizeSignedAxis(value: number): number {
  return clamp(toFiniteNumber(value, 0), -1, 1);
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

  #animationCycleId = 0;
  #holdRemainingMs = 0;
  #movementDirectionKey: string | null = null;
  #vocabulary: MetaverseCharacterAnimationVocabularyId = "idle";

  constructor(
    config: MetaverseMovementAnimationPolicyConfig = metaverseMovementAnimationPolicyConfig
  ) {
    this.#config = config;
  }

  get animationVocabulary(): MetaverseCharacterAnimationVocabularyId {
    return this.#vocabulary;
  }

  get animationCycleId(): number {
    return this.#animationCycleId;
  }

  reset(vocabulary: MetaverseCharacterAnimationVocabularyId = "idle"): void {
    this.#animationCycleId = 0;
    this.#holdRemainingMs = 0;
    this.#movementDirectionKey = null;
    this.#vocabulary = vocabulary;
  }

  #resolveMovementDirectionKey(
    input: Pick<
      MetaverseMovementAnimationPolicyInput,
      "inputMagnitude" | "moveAxis" | "strafeAxis"
    >,
    config: MetaverseMovementAnimationPolicyModeConfig
  ): string | null {
    if (
      clamp01(input.inputMagnitude) <
      clamp01(toFiniteNumber(config.intentEnterThreshold, 0))
    ) {
      return null;
    }

    const directionAxisDeadzone = Math.max(
      0.25,
      clamp01(toFiniteNumber(config.intentEnterThreshold, 0))
    );
    const moveAxis = sanitizeSignedAxis(input.moveAxis);
    const strafeAxis = sanitizeSignedAxis(input.strafeAxis);
    const moveDirection =
      Math.abs(moveAxis) >= directionAxisDeadzone
        ? Math.sign(moveAxis).toString()
        : "0";
    const strafeDirection =
      Math.abs(strafeAxis) >= directionAxisDeadzone
        ? Math.sign(strafeAxis).toString()
        : "0";

    return moveDirection === "0" && strafeDirection === "0"
      ? null
      : `${moveDirection}:${strafeDirection}`;
  }

  #syncMovementCycleId(
    currentVocabulary: MetaverseCharacterAnimationVocabularyId,
    nextVocabulary: MetaverseCharacterAnimationVocabularyId,
    input: Pick<
      MetaverseMovementAnimationPolicyInput,
      "inputMagnitude" | "moveAxis" | "strafeAxis"
    >,
    config: MetaverseMovementAnimationPolicyModeConfig
  ): void {
    const nextDirectionKey =
      nextVocabulary === "walk" || nextVocabulary === "swim"
        ? this.#resolveMovementDirectionKey(input, config)
        : null;

    if (
      (currentVocabulary !== nextVocabulary &&
        (nextVocabulary === "walk" || nextVocabulary === "swim")) ||
      (nextVocabulary === currentVocabulary &&
        nextDirectionKey !== null &&
        nextDirectionKey !== this.#movementDirectionKey)
    ) {
      this.#animationCycleId += 1;
    }

    this.#movementDirectionKey = nextDirectionKey;
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

      this.#syncMovementCycleId(
        this.#vocabulary,
        nextState.vocabulary,
        input,
        this.#config.swim
      );
      this.#holdRemainingMs = nextState.holdRemainingMs;
      this.#vocabulary = nextState.vocabulary;
      return this.#vocabulary;
    }

    if (!input.grounded) {
      this.#holdRemainingMs = 0;
      this.#movementDirectionKey = null;
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

    this.#syncMovementCycleId(
      this.#vocabulary,
      nextState.vocabulary,
      input,
      this.#config.grounded
    );
    this.#holdRemainingMs = nextState.holdRemainingMs;
    this.#vocabulary = nextState.vocabulary;
    return this.#vocabulary;
  }
}
