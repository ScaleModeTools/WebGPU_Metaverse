import {
  metaverseLocalAuthorityReconciliationConfig
} from "../config/metaverse-world-network";
import type { MetaverseCameraSnapshot } from "../types/metaverse-runtime";

interface MetaverseRuntimeCombatLifecycleBootLifecycle {
  setDeathCameraSnapshot(snapshot: MetaverseCameraSnapshot | null): void;
  setRespawnControlLocked(locked: boolean): void;
}

interface MetaverseRuntimeCombatLifecycleAuthoritativeWorldSync {
  armLocalSpawnBootstrap(): void;
}

interface MetaverseRuntimeCombatLifecycleRemoteWorldRuntime {
  readFreshAuthoritativeLocalPlayerSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): {
    readonly combat: {
      readonly alive: boolean;
    } | null;
  } | null;
  readFreshAuthoritativeWorldSnapshot(
    maxAuthoritativeSnapshotAgeMs: number
  ): {
    readonly combatMatch: {
      readonly phase: "active" | "completed" | "waiting-for-players";
    } | null;
  } | null;
}

interface MetaverseRuntimeCombatLifecycleDependencies {
  readonly authoritativeWorldSync: MetaverseRuntimeCombatLifecycleAuthoritativeWorldSync;
  readonly bootLifecycle: MetaverseRuntimeCombatLifecycleBootLifecycle;
  readonly clearLocalCombatDeathPresentation?: (() => void) | null;
  readonly remoteWorldRuntime: MetaverseRuntimeCombatLifecycleRemoteWorldRuntime;
  readonly weaponPresentationRuntime?: {
    reset(): void;
    setCombatPresentationSuppressed?(suppressed: boolean): void;
  } | null;
}

export class MetaverseRuntimeCombatLifecycle {
  readonly #authoritativeWorldSync: MetaverseRuntimeCombatLifecycleAuthoritativeWorldSync;
  readonly #bootLifecycle: MetaverseRuntimeCombatLifecycleBootLifecycle;
  readonly #clearLocalCombatDeathPresentation: (() => void) | null;
  readonly #remoteWorldRuntime: MetaverseRuntimeCombatLifecycleRemoteWorldRuntime;
  readonly #weaponPresentationRuntime: {
    reset(): void;
    setCombatPresentationSuppressed?(suppressed: boolean): void;
  } | null;

  #lastAuthoritativeAlive: boolean | null = null;
  #lastAuthoritativeMatchPhase:
    | "active"
    | "completed"
    | "waiting-for-players"
    | null = null;

  constructor({
    authoritativeWorldSync,
    bootLifecycle,
    clearLocalCombatDeathPresentation,
    remoteWorldRuntime,
    weaponPresentationRuntime
  }: MetaverseRuntimeCombatLifecycleDependencies) {
    this.#authoritativeWorldSync = authoritativeWorldSync;
    this.#bootLifecycle = bootLifecycle;
    this.#clearLocalCombatDeathPresentation =
      clearLocalCombatDeathPresentation ?? null;
    this.#remoteWorldRuntime = remoteWorldRuntime;
    this.#weaponPresentationRuntime = weaponPresentationRuntime ?? null;
  }

  reset(): void {
    this.#lastAuthoritativeAlive = null;
    this.#lastAuthoritativeMatchPhase = null;
    this.#clearLocalCombatDeathPresentation?.();
    this.#weaponPresentationRuntime?.setCombatPresentationSuppressed?.(false);
  }

  syncLocalCombatState(liveCameraSnapshot: MetaverseCameraSnapshot): void {
    const authoritativeWorldSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeWorldSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const authoritativeLocalPlayerSnapshot =
      this.#remoteWorldRuntime.readFreshAuthoritativeLocalPlayerSnapshot(
        metaverseLocalAuthorityReconciliationConfig.maxAuthoritativeSnapshotAgeMs
      );
    const combatSnapshot = authoritativeLocalPlayerSnapshot?.combat ?? null;
    const matchPhase = authoritativeWorldSnapshot?.combatMatch?.phase ?? null;

    if (combatSnapshot === null) {
      this.#lastAuthoritativeMatchPhase = matchPhase;
      return;
    }

    if (
      combatSnapshot.alive &&
      this.#lastAuthoritativeMatchPhase === "waiting-for-players" &&
      matchPhase === "active"
    ) {
      this.#authoritativeWorldSync.armLocalSpawnBootstrap();
    }

    if (combatSnapshot.alive) {
      this.#weaponPresentationRuntime?.setCombatPresentationSuppressed?.(false);

      if (this.#lastAuthoritativeAlive === false) {
        this.#bootLifecycle.setDeathCameraSnapshot(null);
        this.#bootLifecycle.setRespawnControlLocked(false);
        this.#clearLocalCombatDeathPresentation?.();
        this.#authoritativeWorldSync.armLocalSpawnBootstrap();
      }
    } else if (this.#lastAuthoritativeAlive !== false) {
      this.#bootLifecycle.setDeathCameraSnapshot(liveCameraSnapshot);
      this.#bootLifecycle.setRespawnControlLocked(true);
      this.#weaponPresentationRuntime?.setCombatPresentationSuppressed?.(true);
      this.#weaponPresentationRuntime?.reset();
    }

    this.#lastAuthoritativeAlive = combatSnapshot.alive;
    this.#lastAuthoritativeMatchPhase = matchPhase;
  }
}
