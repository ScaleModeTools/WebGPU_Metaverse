import type { Radians } from "../unit-measurements.js";
import { createRadians } from "../unit-measurements.js";

export const metaverseTraversalLocomotionModeIds = [
  "grounded",
  "swim"
] as const;

export const metaverseTraversalJumpAuthorityStateIds = [
  "none",
  "grounded",
  "rising",
  "falling"
] as const;

export const metaverseTraversalActionResolutionStateIds = [
  "none",
  "accepted",
  "rejected-buffer-expired"
] as const;

export const metaverseTraversalActionKindIds = [
  "none",
  "jump"
] as const;

export const metaverseTraversalActionPhaseIds = [
  "idle",
  "startup",
  "rising",
  "falling"
] as const;

export const metaverseTraversalActionRejectionReasonIds = [
  "none",
  "buffer-expired"
] as const;

export type MetaverseTraversalLocomotionModeId =
  (typeof metaverseTraversalLocomotionModeIds)[number];
export type MetaverseTraversalJumpAuthorityStateId =
  (typeof metaverseTraversalJumpAuthorityStateIds)[number];
export type MetaverseTraversalActionResolutionStateId =
  (typeof metaverseTraversalActionResolutionStateIds)[number];
export type MetaverseTraversalActionKindId =
  (typeof metaverseTraversalActionKindIds)[number];
export type MetaverseTraversalActionPhaseId =
  (typeof metaverseTraversalActionPhaseIds)[number];
export type MetaverseTraversalActionRejectionReasonId =
  (typeof metaverseTraversalActionRejectionReasonIds)[number];

export interface MetaverseTraversalBodyControlSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly turnAxis: number;
}

export interface MetaverseTraversalBodyControlSnapshotInput {
  readonly boost?: boolean;
  readonly moveAxis?: number;
  readonly strafeAxis?: number;
  readonly turnAxis?: number;
}

export interface MetaverseTraversalFacingSnapshot {
  readonly pitchRadians: Radians;
  readonly yawRadians: Radians;
}

export interface MetaverseTraversalFacingSnapshotInput {
  readonly pitchRadians?: number;
  readonly yawRadians?: number;
}

export interface MetaverseTraversalActionIntentSnapshot {
  readonly kind: MetaverseTraversalActionKindId;
  readonly pressed: boolean;
  readonly sequence: number;
}

export interface MetaverseTraversalActionIntentSnapshotInput {
  readonly kind?: MetaverseTraversalActionKindId;
  readonly pressed?: boolean;
  readonly sequence?: number;
}

export interface MetaverseTraversalAuthoritySnapshot {
  readonly currentActionKind: MetaverseTraversalActionKindId;
  readonly currentActionPhase: MetaverseTraversalActionPhaseId;
  readonly currentActionSequence: number;
  readonly lastConsumedActionKind: MetaverseTraversalActionKindId;
  readonly lastConsumedActionSequence: number;
  readonly lastRejectedActionKind: MetaverseTraversalActionKindId;
  readonly lastRejectedActionReason: MetaverseTraversalActionRejectionReasonId;
  readonly lastRejectedActionSequence: number;
  readonly phaseStartedAtTick: number;
}

export interface MetaverseTraversalAuthoritySnapshotInput {
  readonly currentActionKind?: MetaverseTraversalActionKindId;
  readonly currentActionPhase?: MetaverseTraversalActionPhaseId;
  readonly currentActionSequence?: number;
  readonly lastConsumedActionKind?: MetaverseTraversalActionKindId;
  readonly lastConsumedActionSequence?: number;
  readonly lastRejectedActionKind?: MetaverseTraversalActionKindId;
  readonly lastRejectedActionReason?: MetaverseTraversalActionRejectionReasonId;
  readonly lastRejectedActionSequence?: number;
  readonly phaseStartedAtTick?: number;
}

function toFiniteNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeFiniteNonNegativeInteger(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function clampNormalizedAxis(value: number | undefined): number {
  const normalizedValue = toFiniteNumber(value, 0);

  return Math.max(-1, Math.min(1, normalizedValue));
}

function resolveTraversalActionKind(
  value: MetaverseTraversalActionKindId | undefined
): MetaverseTraversalActionKindId {
  return value !== undefined && metaverseTraversalActionKindIds.includes(value)
    ? value
    : "none";
}

function resolveTraversalActionPhase(
  value: MetaverseTraversalActionPhaseId | undefined
): MetaverseTraversalActionPhaseId {
  return value !== undefined && metaverseTraversalActionPhaseIds.includes(value)
    ? value
    : "idle";
}

function resolveTraversalActionRejectionReason(
  value: MetaverseTraversalActionRejectionReasonId | undefined
): MetaverseTraversalActionRejectionReasonId {
  return value !== undefined &&
    metaverseTraversalActionRejectionReasonIds.includes(value)
    ? value
    : "none";
}

export function createMetaverseTraversalBodyControlSnapshot(
  input: MetaverseTraversalBodyControlSnapshotInput | undefined = undefined
): MetaverseTraversalBodyControlSnapshot {
  return Object.freeze({
    boost: input?.boost === true,
    moveAxis: clampNormalizedAxis(input?.moveAxis),
    strafeAxis: clampNormalizedAxis(input?.strafeAxis),
    turnAxis: clampNormalizedAxis(input?.turnAxis)
  });
}

export function createMetaverseTraversalFacingSnapshot(
  input: MetaverseTraversalFacingSnapshotInput | undefined = undefined
): MetaverseTraversalFacingSnapshot {
  return Object.freeze({
    pitchRadians: createRadians(input?.pitchRadians ?? 0),
    yawRadians: createRadians(input?.yawRadians ?? 0)
  });
}

export function createMetaverseTraversalActionIntentSnapshot(
  input: MetaverseTraversalActionIntentSnapshotInput | undefined = undefined,
  defaultSequence = 0
): MetaverseTraversalActionIntentSnapshot {
  const kind = resolveTraversalActionKind(input?.kind);
  const pressed = input?.pressed === true && kind !== "none";
  const sequence =
    kind === "none"
      ? 0
      : normalizeFiniteNonNegativeInteger(
          input?.sequence ?? (pressed ? defaultSequence : 0)
        );
  const resolvedKind =
    kind !== "none" && (pressed || sequence > 0) ? kind : "none";

  return Object.freeze({
    kind: resolvedKind,
    pressed,
    sequence: resolvedKind === "none" ? 0 : sequence
  });
}

export function createMetaverseTraversalAuthoritySnapshot(
  input: MetaverseTraversalAuthoritySnapshotInput = {}
): MetaverseTraversalAuthoritySnapshot {
  const currentActionKind = resolveTraversalActionKind(input.currentActionKind);
  const currentActionPhase =
    currentActionKind === "none"
      ? "idle"
      : resolveTraversalActionPhase(input.currentActionPhase);
  const lastConsumedActionKind = resolveTraversalActionKind(
    input.lastConsumedActionKind
  );
  const lastRejectedActionKind = resolveTraversalActionKind(
    input.lastRejectedActionKind
  );
  const lastRejectedActionReason = resolveTraversalActionRejectionReason(
    input.lastRejectedActionReason
  );

  return Object.freeze({
    currentActionKind,
    currentActionPhase,
    currentActionSequence: normalizeFiniteNonNegativeInteger(
      input.currentActionSequence
    ),
    lastConsumedActionKind,
    lastConsumedActionSequence:
      lastConsumedActionKind === "none"
        ? 0
        : normalizeFiniteNonNegativeInteger(input.lastConsumedActionSequence),
    lastRejectedActionKind,
    lastRejectedActionReason,
    lastRejectedActionSequence:
      lastRejectedActionKind === "none"
        ? 0
        : normalizeFiniteNonNegativeInteger(input.lastRejectedActionSequence),
    phaseStartedAtTick:
      currentActionKind === "none"
        ? 0
        : normalizeFiniteNonNegativeInteger(input.phaseStartedAtTick)
  });
}
