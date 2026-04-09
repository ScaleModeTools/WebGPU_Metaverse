import { createMilliseconds } from "@webgpu-metaverse/shared";

import type {
  WeaponDefinition,
  WeaponHudSnapshot,
  WeaponReadinessState,
  WeaponReloadState,
  WeaponReloadSnapshot
} from "../types/duck-hunt-weapon-contract";

interface WeaponRuntimeFrameInput {
  readonly hasTrackedHand: boolean;
  readonly isReticleOffscreen: boolean;
  readonly nowMs: number;
  readonly sessionActive: boolean;
  readonly triggerPressed: boolean;
}

interface WeaponRuntimeFrameOutcome {
  readonly fired: boolean;
  readonly reloaded: boolean;
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    return 0;
  }

  return nowMs;
}

function freezeReloadSnapshot(
  clipCapacity: number,
  clipRoundsRemaining: number,
  isReloadReady: boolean,
  reloadRemainingMs: number,
  requiresReload: boolean,
  rule: WeaponReloadSnapshot["rule"],
  state: WeaponReloadState
): WeaponReloadSnapshot {
  return Object.freeze({
    clipCapacity,
    clipRoundsRemaining,
    isReloadReady,
    reloadRemainingMs: createMilliseconds(reloadRemainingMs),
    requiresReload,
    rule,
    state
  });
}

function freezeWeaponSnapshot(
  weaponId: WeaponHudSnapshot["weaponId"],
  shotsFired: number,
  hitsLanded: number,
  triggerHeld: boolean,
  cooldownRemainingMs: number,
  readiness: WeaponReadinessState,
  reload: WeaponReloadSnapshot
): WeaponHudSnapshot {
  return Object.freeze({
    cooldownRemainingMs: createMilliseconds(cooldownRemainingMs),
    hitsLanded,
    readiness,
    reload,
    shotsFired,
    triggerHeld,
    weaponId
  });
}

export class DuckHuntWeaponRuntime {
  readonly #definition: WeaponDefinition;

  #clipRoundsRemaining: number;
  #cooldownEndsAtMs = 0;
  #hitsLanded = 0;
  #reloadEndsAtMs: number | null = null;
  #shotsFired = 0;
  #triggerHeld = false;

  constructor(definition: WeaponDefinition) {
    this.#definition = definition;
    this.#clipRoundsRemaining = definition.reload.clipCapacity;
  }

  get definition(): WeaponDefinition {
    return this.#definition;
  }

  get triggerHeld(): boolean {
    return this.#triggerHeld;
  }

  advance(input: WeaponRuntimeFrameInput): WeaponRuntimeFrameOutcome {
    const nowMs = normalizeNowMs(input.nowMs);
    const reloadReady = this.#isReloadReady(
      input.sessionActive,
      input.hasTrackedHand,
      input.isReticleOffscreen
    );
    let reloaded = false;

    if (this.#reloadEndsAtMs !== null) {
      if (!reloadReady) {
        this.#reloadEndsAtMs = null;
      } else if (nowMs >= this.#reloadEndsAtMs) {
        this.#clipRoundsRemaining = this.#definition.reload.clipCapacity;
        this.#reloadEndsAtMs = null;
        reloaded = true;
      }
    }

    if (
      this.#reloadEndsAtMs === null &&
      reloadReady &&
      !reloaded
    ) {
      this.#reloadEndsAtMs = nowMs + this.#definition.reload.durationMs;
    }

    let fired = false;

    if (this.#canFire(input, nowMs)) {
      this.#clipRoundsRemaining -= 1;
      this.#cooldownEndsAtMs = nowMs + this.#definition.cadence.shotIntervalMs;
      this.#shotsFired += 1;
      fired = true;
    }

    if (!input.sessionActive) {
      this.#triggerHeld = false;
    } else if (input.hasTrackedHand) {
      this.#triggerHeld = input.triggerPressed;
    }

    return Object.freeze({
      fired,
      reloaded
    });
  }

  createHudSnapshot(input: WeaponRuntimeFrameInput): WeaponHudSnapshot {
    const nowMs = normalizeNowMs(input.nowMs);
    const cooldownRemainingMs = Math.max(0, this.#cooldownEndsAtMs - nowMs);
    const requiresReload = this.#clipRoundsRemaining === 0;
    const reloadReady = this.#isReloadReady(
      input.sessionActive,
      input.hasTrackedHand,
      input.isReticleOffscreen
    );
    const reload = freezeReloadSnapshot(
      this.#definition.reload.clipCapacity,
      this.#clipRoundsRemaining,
      reloadReady,
      this.#reloadEndsAtMs === null ? 0 : Math.max(0, this.#reloadEndsAtMs - nowMs),
      requiresReload,
      this.#definition.reload.rule,
      this.#resolveReloadState(requiresReload)
    );

    return freezeWeaponSnapshot(
      this.#definition.weaponId,
      this.#shotsFired,
      this.#hitsLanded,
      this.#triggerHeld,
      cooldownRemainingMs,
      this.#resolveReadinessState(input, cooldownRemainingMs, requiresReload),
      reload
    );
  }

  recordConfirmedHit(): void {
    this.#hitsLanded += 1;
  }

  reset(triggerPressed = false): void {
    this.#clipRoundsRemaining = this.#definition.reload.clipCapacity;
    this.#cooldownEndsAtMs = 0;
    this.#hitsLanded = 0;
    this.#reloadEndsAtMs = null;
    this.#shotsFired = 0;
    this.#triggerHeld = triggerPressed;
  }

  #canFire(input: WeaponRuntimeFrameInput, nowMs: number): boolean {
    if (
      !input.sessionActive ||
      !input.hasTrackedHand ||
      input.isReticleOffscreen ||
      this.#clipRoundsRemaining <= 0 ||
      this.#reloadEndsAtMs !== null ||
      nowMs < this.#cooldownEndsAtMs ||
      !input.triggerPressed
    ) {
      return false;
    }

    return this.#definition.triggerMode === "auto" || !this.#triggerHeld;
  }

  #isReloadReady(
    sessionActive: boolean,
    hasTrackedHand: boolean,
    isReticleOffscreen: boolean
  ): boolean {
    return (
      sessionActive &&
      hasTrackedHand &&
      isReticleOffscreen &&
      this.#clipRoundsRemaining === 0
    );
  }

  #resolveReadinessState(
    input: WeaponRuntimeFrameInput,
    cooldownRemainingMs: number,
    requiresReload: boolean
  ): WeaponReadinessState {
    if (!input.sessionActive) {
      return "round-paused";
    }

    if (this.#reloadEndsAtMs !== null) {
      return "reloading";
    }

    if (requiresReload) {
      return "reload-required";
    }

    if (!input.hasTrackedHand) {
      return "tracking-unavailable";
    }

    if (this.#definition.triggerMode === "single" && this.#triggerHeld) {
      return "trigger-reset-required";
    }

    if (cooldownRemainingMs > 0) {
      return "cooldown";
    }

    return "ready";
  }

  #resolveReloadState(requiresReload: boolean): WeaponReloadState {
    if (!requiresReload) {
      return "full";
    }

    return this.#reloadEndsAtMs === null ? "blocked" : "reloading";
  }
}
