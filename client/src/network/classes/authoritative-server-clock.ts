import type { AuthoritativeServerClockConfig } from "../types/authoritative-server-clock";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export class AuthoritativeServerClock {
  readonly #config: AuthoritativeServerClockConfig;

  #clockOffsetMs: number | null = null;
  #lastObservedServerTimeMs: number | null = null;

  constructor(config: AuthoritativeServerClockConfig) {
    this.#config = config;
  }

  get clockOffsetEstimateMs(): number | null {
    return this.#clockOffsetMs;
  }

  reset(): void {
    this.#clockOffsetMs = null;
    this.#lastObservedServerTimeMs = null;
  }

  observeServerTime(
    serverTimeMs: number,
    localWallClockMs: number
  ): void {
    if (!Number.isFinite(serverTimeMs) || !Number.isFinite(localWallClockMs)) {
      return;
    }

    if (
      this.#lastObservedServerTimeMs !== null &&
      serverTimeMs <= this.#lastObservedServerTimeMs
    ) {
      return;
    }

    this.#lastObservedServerTimeMs = serverTimeMs;

    const observedClockOffsetMs = serverTimeMs - localWallClockMs;

    if (this.#clockOffsetMs === null) {
      this.#clockOffsetMs = observedClockOffsetMs;
      return;
    }

    if (observedClockOffsetMs <= this.#clockOffsetMs) {
      return;
    }

    const correctionStepMs = clamp(
      (observedClockOffsetMs - this.#clockOffsetMs) *
        normalizeFiniteNumber(this.#config.clockOffsetCorrectionAlpha, 0),
      0,
      Math.max(0, normalizeFiniteNumber(this.#config.clockOffsetMaxStepMs, 0))
    );

    this.#clockOffsetMs += correctionStepMs;
  }

  readEstimatedServerTimeMs(localWallClockMs: number): number {
    if (!Number.isFinite(localWallClockMs)) {
      return 0;
    }

    return localWallClockMs + (this.#clockOffsetMs ?? 0);
  }

  readTargetServerTimeMs(
    localWallClockMs: number,
    interpolationDelayMs: number = 0
  ): number {
    return (
      this.readEstimatedServerTimeMs(localWallClockMs) -
      Math.max(0, normalizeFiniteNumber(interpolationDelayMs, 0))
    );
  }
}
