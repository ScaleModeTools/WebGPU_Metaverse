import {
  clamp,
  toFiniteNumber
} from "./metaverse-surface-traversal-simulation.js";
import {
  createMetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalActiveActionSnapshot
} from "./metaverse-traversal-contract.js";

export interface MetaverseGroundedJumpPhysicsConfigSnapshot {
  readonly airborneMovementDampingFactor: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpGroundContactGraceSeconds: number;
  readonly jumpImpulseUnitsPerSecond: number;
}

export interface MetaverseGroundedJumpContinuationSnapshot {
  readonly jumpGroundContactGraceSecondsRemaining: number;
  readonly jumpReady: boolean;
  readonly jumpSnapSuppressionActive: boolean;
}

export interface MetaverseGroundedJumpBodySnapshot
  extends MetaverseGroundedJumpContinuationSnapshot {
  readonly grounded: boolean;
  readonly verticalSpeedUnitsPerSecond: number;
}

const metaverseGroundedJumpActionVerticalSpeedTolerance = 0.05;

function normalizeFiniteNonNegativeSeconds(value: number): number {
  return Math.max(0, toFiniteNumber(value, 0));
}

export function createMetaverseGroundedJumpPhysicsConfigSnapshot(
  input: Partial<MetaverseGroundedJumpPhysicsConfigSnapshot> = {}
): MetaverseGroundedJumpPhysicsConfigSnapshot {
  return Object.freeze({
    airborneMovementDampingFactor: clamp(
      toFiniteNumber(input.airborneMovementDampingFactor ?? 0.42, 0.42),
      0,
      1
    ),
    gravityUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(input.gravityUnitsPerSecond ?? 18, 18)
    ),
    jumpGroundContactGraceSeconds: Math.max(
      0,
      toFiniteNumber(input.jumpGroundContactGraceSeconds ?? 0.2, 0.2)
    ),
    jumpImpulseUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(input.jumpImpulseUnitsPerSecond ?? 6.8, 6.8)
    )
  });
}

export function createMetaverseGroundedJumpBodySnapshot(
  input: Partial<MetaverseGroundedJumpBodySnapshot> = {}
): MetaverseGroundedJumpBodySnapshot {
  const grounded = input.grounded === true;
  const jumpGroundContactGraceSecondsRemaining =
    normalizeFiniteNonNegativeSeconds(
      input.jumpGroundContactGraceSecondsRemaining ?? 0
    );

  return Object.freeze({
    grounded,
    jumpGroundContactGraceSecondsRemaining,
    jumpReady:
      grounded ||
      jumpGroundContactGraceSecondsRemaining > 0 ||
      input.jumpReady === true,
    jumpSnapSuppressionActive:
      grounded ? false : input.jumpSnapSuppressionActive === true,
    verticalSpeedUnitsPerSecond: grounded
      ? 0
      : toFiniteNumber(input.verticalSpeedUnitsPerSecond ?? 0, 0)
  });
}

export function resolveMetaverseGroundedJumpMovementDampingFactor(
  grounded: boolean,
  config: MetaverseGroundedJumpPhysicsConfigSnapshot
): number {
  return grounded ? 1 : config.airborneMovementDampingFactor;
}

export function resolveMetaverseGroundedJumpVerticalSpeedUnitsPerSecond(input: {
  readonly currentVerticalSpeedUnitsPerSecond: number;
  readonly deltaSeconds: number;
  readonly jumpRequested: boolean;
  readonly config: MetaverseGroundedJumpPhysicsConfigSnapshot;
}): number {
  return (
    (input.jumpRequested
      ? Math.max(
          toFiniteNumber(input.currentVerticalSpeedUnitsPerSecond, 0),
          input.config.jumpImpulseUnitsPerSecond
        )
      : toFiniteNumber(input.currentVerticalSpeedUnitsPerSecond, 0)) -
    input.config.gravityUnitsPerSecond *
      Math.max(0, toFiniteNumber(input.deltaSeconds, 0))
  );
}

export function resolveMetaverseGroundedJumpContinuationSnapshot(input: {
  readonly config: MetaverseGroundedJumpPhysicsConfigSnapshot;
  readonly deltaSeconds: number;
  readonly grounded: boolean;
  readonly jumpGroundContactGraceSecondsRemaining: number;
  readonly jumpRequested: boolean;
  readonly jumpSnapSuppressionActive: boolean;
}): MetaverseGroundedJumpContinuationSnapshot {
  const jumpGroundContactGraceSecondsRemaining =
    input.jumpRequested === true
      ? 0
      : input.grounded === true
        ? normalizeFiniteNonNegativeSeconds(
            input.config.jumpGroundContactGraceSeconds
          )
        : Math.max(
            0,
            normalizeFiniteNonNegativeSeconds(
              input.jumpGroundContactGraceSecondsRemaining
            ) -
              Math.max(0, toFiniteNumber(input.deltaSeconds, 0))
          );

  return Object.freeze({
    jumpGroundContactGraceSecondsRemaining,
    jumpReady:
      input.grounded === true ||
      jumpGroundContactGraceSecondsRemaining > 0,
    jumpSnapSuppressionActive:
      input.grounded === true
        ? false
        : input.jumpSnapSuppressionActive === true ||
          input.jumpRequested === true
  });
}

export function resolveMetaverseGroundedJumpSynchronizedState(input: {
  readonly config: MetaverseGroundedJumpPhysicsConfigSnapshot;
  readonly currentJumpSnapSuppressionActive: boolean;
  readonly grounded: boolean;
}): MetaverseGroundedJumpContinuationSnapshot {
  return Object.freeze({
    jumpGroundContactGraceSecondsRemaining:
      input.grounded === true
        ? normalizeFiniteNonNegativeSeconds(
            input.config.jumpGroundContactGraceSeconds
          )
        : 0,
    jumpReady: input.grounded === true,
    jumpSnapSuppressionActive:
      input.grounded === true
        ? false
        : input.currentJumpSnapSuppressionActive
  });
}

export function resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(
  jumpBodySnapshot: Pick<
    MetaverseGroundedJumpBodySnapshot,
    "grounded" | "verticalSpeedUnitsPerSecond"
  >
): MetaverseTraversalActiveActionSnapshot {
  if (jumpBodySnapshot.grounded) {
    return createMetaverseTraversalActiveActionSnapshot();
  }

  return createMetaverseTraversalActiveActionSnapshot({
    kind: "jump",
    phase:
      jumpBodySnapshot.verticalSpeedUnitsPerSecond >
      metaverseGroundedJumpActionVerticalSpeedTolerance
        ? "rising"
        : "falling"
  });
}
