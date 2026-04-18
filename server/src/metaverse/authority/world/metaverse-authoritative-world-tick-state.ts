import { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";

interface MetaverseAuthoritativeWorldTickStateDependencies {
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly readTickIntervalMs: () => number;
  readonly syncMountedPlayerWorldStateFromVehicles: (nowMs: number) => void;
  readonly advanceUnmountedPlayerRuntimes: (
    tickIntervalSeconds: number,
    nowMs: number
  ) => void;
  readonly advanceVehicleRuntimes: (
    tickIntervalSeconds: number,
    nowMs: number
  ) => void;
}

export class MetaverseAuthoritativeWorldTickState {
  readonly #dependencies: MetaverseAuthoritativeWorldTickStateDependencies;

  #currentTick = 0;
  #lastAdvancedAtMs: number | null = null;
  #snapshotSequence = 0;

  constructor(dependencies: MetaverseAuthoritativeWorldTickStateDependencies) {
    this.#dependencies = dependencies;
  }

  get currentTick(): number {
    return this.#currentTick;
  }

  get lastAdvancedAtMs(): number | null {
    return this.#lastAdvancedAtMs;
  }

  get snapshotSequence(): number {
    return this.#snapshotSequence;
  }

  incrementSnapshotSequence(): void {
    this.#snapshotSequence += 1;
  }

  advanceToTime(nowMs: number): void {
    if (this.#lastAdvancedAtMs === null) {
      this.#lastAdvancedAtMs = nowMs;
      return;
    }

    const tickIntervalMs = Number(this.#dependencies.readTickIntervalMs());

    if (!Number.isFinite(tickIntervalMs) || tickIntervalMs <= 0) {
      return;
    }

    let advancedTick = false;
    const tickIntervalSeconds = tickIntervalMs / 1_000;

    while (this.#lastAdvancedAtMs + tickIntervalMs <= nowMs) {
      this.#lastAdvancedAtMs += tickIntervalMs;
      this.#dependencies.physicsRuntime.stepSimulation(tickIntervalSeconds);
      this.#dependencies.advanceVehicleRuntimes(
        tickIntervalSeconds,
        this.#lastAdvancedAtMs
      );
      this.#dependencies.physicsRuntime.stepSimulation(tickIntervalSeconds);
      this.#dependencies.advanceUnmountedPlayerRuntimes(
        tickIntervalSeconds,
        this.#lastAdvancedAtMs
      );
      this.#dependencies.syncMountedPlayerWorldStateFromVehicles(
        this.#lastAdvancedAtMs
      );
      this.#currentTick += 1;
      advancedTick = true;
    }

    if (advancedTick) {
      this.#snapshotSequence += 1;
    }
  }
}
