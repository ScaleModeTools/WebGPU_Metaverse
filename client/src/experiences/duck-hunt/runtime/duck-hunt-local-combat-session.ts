import { createMilliseconds } from "@thumbshooter/shared";

import { duckHuntLocalCombatSessionConfig } from "../config/duck-hunt-local-combat-session";
import type {
  LocalCombatSessionConfig,
  LocalCombatSessionPhase,
  LocalCombatSessionSnapshot,
  LocalCombatShotOutcome
} from "../../../game/types/local-combat-session";

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function freezeSessionSnapshot(
  phase: LocalCombatSessionPhase,
  roundDurationMs: LocalCombatSessionSnapshot["roundDurationMs"],
  roundNumber: number,
  roundTimeRemainingMs: number,
  hitsThisSession: number,
  killsThisSession: number,
  score: number,
  streak: number
): LocalCombatSessionSnapshot {
  return Object.freeze({
    hitsThisSession,
    killsThisSession,
    phase,
    restartReady: phase !== "active",
    roundDurationMs,
    roundNumber,
    roundTimeRemainingMs: createMilliseconds(roundTimeRemainingMs),
    score,
    streak
  });
}

function resolveRoundDurationMs(
  roundNumber: number,
  config: LocalCombatSessionConfig
): number {
  const roundIndex = Math.max(0, Math.floor(roundNumber) - 1);
  const durationReductionMs =
    roundIndex * Number(config.durationLossPerRoundMs);

  return Math.max(
    Number(config.minimumRoundDurationMs),
    Number(config.roundDurationMs) - durationReductionMs
  );
}

export class DuckHuntLocalCombatSession {
  readonly #config: LocalCombatSessionConfig;
  readonly #enemyCount: number;

  #elapsedRoundTimeMs = 0;
  #hitsThisSession = 0;
  #killsThisSession = 0;
  #lastUpdatedAtMs: number | null = null;
  #phase: LocalCombatSessionPhase = "active";
  #roundDurationMs: LocalCombatSessionSnapshot["roundDurationMs"];
  #roundNumber = 1;
  #score = 0;
  #snapshot: LocalCombatSessionSnapshot;
  #streak = 0;

  constructor(
    enemyCount: number,
    config: LocalCombatSessionConfig = duckHuntLocalCombatSessionConfig
  ) {
    this.#config = config;
    this.#enemyCount = normalizeCount(enemyCount);
    this.#roundDurationMs = createMilliseconds(resolveRoundDurationMs(1, config));
    this.#snapshot = this.#buildSnapshot();
  }

  get phase(): LocalCombatSessionPhase {
    return this.#phase;
  }

  get snapshot(): LocalCombatSessionSnapshot {
    return this.#snapshot;
  }

  beginFrame(nowMs: number): LocalCombatSessionSnapshot {
    const safeNowMs =
      Number.isFinite(nowMs) && nowMs >= 0
        ? nowMs
        : this.#lastUpdatedAtMs ?? 0;

    if (this.#phase !== "active") {
      return this.#snapshot;
    }

    if (this.#lastUpdatedAtMs === null) {
      this.#lastUpdatedAtMs = safeNowMs;
      this.#snapshot = this.#buildSnapshot();
      return this.#snapshot;
    }

    const elapsedDeltaMs = Math.max(0, safeNowMs - this.#lastUpdatedAtMs);

    this.#lastUpdatedAtMs = safeNowMs;
    this.#elapsedRoundTimeMs = Math.min(
      Number(this.#roundDurationMs),
      this.#elapsedRoundTimeMs + elapsedDeltaMs
    );

    if (this.#elapsedRoundTimeMs >= Number(this.#roundDurationMs)) {
      this.#phase = "failed";
      this.#streak = 0;
    }

    this.#snapshot = this.#buildSnapshot();
    return this.#snapshot;
  }

  recordShotOutcome(outcome: LocalCombatShotOutcome): LocalCombatSessionSnapshot {
    if (this.#phase !== "active") {
      return this.#snapshot;
    }

    if (outcome.hitConfirmed) {
      this.#hitsThisSession += 1;
    } else {
      this.#streak = 0;
    }

    if (outcome.killConfirmed) {
      this.#killsThisSession += 1;
      this.#score += this.#config.scorePerKill;
      this.#streak += 1;
    }

    this.#snapshot = this.#buildSnapshot();
    return this.#snapshot;
  }

  advanceRound(): void {
    if (this.#phase !== "completed") {
      return;
    }

    this.#elapsedRoundTimeMs = 0;
    this.#hitsThisSession = 0;
    this.#killsThisSession = 0;
    this.#lastUpdatedAtMs = null;
    this.#phase = "active";
    this.#roundNumber += 1;
    this.#roundDurationMs = createMilliseconds(
      resolveRoundDurationMs(this.#roundNumber, this.#config)
    );
    this.#streak = 0;
    this.#snapshot = this.#buildSnapshot();
  }

  reset(): void {
    this.#elapsedRoundTimeMs = 0;
    this.#hitsThisSession = 0;
    this.#killsThisSession = 0;
    this.#lastUpdatedAtMs = null;
    this.#phase = "active";
    this.#roundDurationMs = createMilliseconds(
      resolveRoundDurationMs(1, this.#config)
    );
    this.#roundNumber = 1;
    this.#score = 0;
    this.#streak = 0;
    this.#snapshot = this.#buildSnapshot();
  }

  syncEnemyProgress(downedEnemyCount: number): LocalCombatSessionSnapshot {
    if (this.#phase !== "active") {
      return this.#snapshot;
    }

    if (normalizeCount(downedEnemyCount) >= this.#enemyCount) {
      this.#phase = "completed";
    }

    this.#snapshot = this.#buildSnapshot();
    return this.#snapshot;
  }

  #buildSnapshot(): LocalCombatSessionSnapshot {
    return freezeSessionSnapshot(
      this.#phase,
      this.#roundDurationMs,
      this.#roundNumber,
      Math.max(0, Number(this.#roundDurationMs) - this.#elapsedRoundTimeMs),
      this.#hitsThisSession,
      this.#killsThisSession,
      this.#score,
      this.#streak
    );
  }
}
