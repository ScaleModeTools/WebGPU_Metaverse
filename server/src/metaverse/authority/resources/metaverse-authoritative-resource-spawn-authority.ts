import type { MetaverseMatchModeId } from "@webgpu-metaverse/shared";
import type { MetaverseIssuePlayerActionCommand } from "@webgpu-metaverse/shared/metaverse";
import type { MetaversePlayerId } from "@webgpu-metaverse/shared/metaverse/presence";
import type { MetaverseRealtimeResourceSpawnSnapshotInput } from "@webgpu-metaverse/shared/metaverse/realtime";
import type { MetaverseMapBundleResourceSpawnSnapshot } from "@webgpu-metaverse/shared/metaverse/world";

interface MetaverseAuthoritativeResourceSpawnPlayerRuntimeState {
  readonly playerId: MetaversePlayerId;
  positionX: number;
  positionY: number;
  positionZ: number;
}

interface MutableMetaverseResourceSpawnRuntimeState {
  available: boolean;
  readonly authoredResourceSpawn: MetaverseMapBundleResourceSpawnSnapshot | null;
  nextRespawnAtServerTimeMs: number | null;
  resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot;
  readonly source: "authored" | "dropped";
}

interface MetaverseAuthoritativeResourceSpawnAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativeResourceSpawnPlayerRuntimeState
> {
  readonly incrementSnapshotSequence: () => void;
  readonly matchMode: MetaverseMatchModeId | null;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly resourceSpawns: readonly MetaverseMapBundleResourceSpawnSnapshot[];
  readonly grantWeaponResourcePickup: (input: {
    readonly nowMs: number;
    readonly playerRuntime: PlayerRuntime;
    readonly resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot;
  }) => boolean;
  readonly interactWeaponResource?: (input: {
    readonly action: Extract<
      MetaverseIssuePlayerActionCommand["action"],
      { readonly kind: "interact-weapon-resource" }
    >;
    readonly nowMs: number;
    readonly playerRuntime: PlayerRuntime;
    readonly resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot | null;
  }) => {
    readonly accepted: boolean;
    readonly consumeResourceSpawn?: boolean;
    readonly droppedResourceSpawn?: MetaverseMapBundleResourceSpawnSnapshot | null;
  };
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

function shouldEnableResourceSpawn(
  resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot,
  matchMode: MetaverseMatchModeId | null
): boolean {
  if (resourceSpawn.modeTags.length === 0) {
    return true;
  }

  return matchMode !== null && resourceSpawn.modeTags.includes(matchMode);
}

function createDistanceBetweenPlayerAndResource(
  playerRuntime: MetaverseAuthoritativeResourceSpawnPlayerRuntimeState,
  resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot
): number {
  return Math.hypot(
    playerRuntime.positionX - resourceSpawn.position.x,
    playerRuntime.positionY - resourceSpawn.position.y,
    playerRuntime.positionZ - resourceSpawn.position.z
  );
}

export class MetaverseAuthoritativeResourceSpawnAuthority<
  PlayerRuntime extends MetaverseAuthoritativeResourceSpawnPlayerRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeResourceSpawnAuthorityDependencies<PlayerRuntime>;
  readonly #resourceSpawnStatesById = new Map<
    string,
    MutableMetaverseResourceSpawnRuntimeState
  >();

  constructor(
    dependencies: MetaverseAuthoritativeResourceSpawnAuthorityDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;

    for (const resourceSpawn of dependencies.resourceSpawns) {
      if (!shouldEnableResourceSpawn(resourceSpawn, dependencies.matchMode)) {
        continue;
      }

      this.#resourceSpawnStatesById.set(resourceSpawn.spawnId, {
        authoredResourceSpawn: resourceSpawn,
        available: true,
        nextRespawnAtServerTimeMs: null,
        resourceSpawn,
        source: "authored"
      });
    }
  }

  advanceResourceSpawns(_tickIntervalSeconds: number, nowMs: number): void {
    const normalizedNowMs = normalizeNowMs(nowMs);
    let changed = false;

    for (const state of this.#resourceSpawnStatesById.values()) {
      if (
        state.source === "authored" &&
        !state.available &&
        state.nextRespawnAtServerTimeMs !== null &&
        state.nextRespawnAtServerTimeMs <= normalizedNowMs
      ) {
        state.resourceSpawn = state.authoredResourceSpawn ?? state.resourceSpawn;
        state.available = true;
        state.nextRespawnAtServerTimeMs = null;
        changed = true;
      }
    }

    for (const state of this.#resourceSpawnStatesById.values()) {
      if (!state.available) {
        continue;
      }

      for (const playerRuntime of this.#dependencies.playersById.values()) {
        if (
          createDistanceBetweenPlayerAndResource(
            playerRuntime,
            state.resourceSpawn
          ) > state.resourceSpawn.pickupRadiusMeters
        ) {
          continue;
        }

        if (
          !this.#dependencies.grantWeaponResourcePickup({
            nowMs: normalizedNowMs,
            playerRuntime,
            resourceSpawn: state.resourceSpawn
          })
        ) {
          continue;
        }

        this.#consumeResourceSpawnState(state, normalizedNowMs);
        changed = true;
        break;
      }
    }

    if (changed) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }

  acceptInteractWeaponResourceAction(
    command: MetaverseIssuePlayerActionCommand,
    nowMs: number
  ): void {
    if (command.action.kind !== "interact-weapon-resource") {
      return;
    }

    const interactWeaponResource = this.#dependencies.interactWeaponResource;

    if (interactWeaponResource === undefined) {
      return;
    }

    const normalizedNowMs = normalizeNowMs(nowMs);
    const playerRuntime = this.#dependencies.playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    const pickupState = this.#readNearestAvailableResourceSpawnState(
      playerRuntime
    );
    const result = interactWeaponResource({
      action: command.action,
      nowMs: normalizedNowMs,
      playerRuntime,
      resourceSpawn: pickupState?.resourceSpawn ?? null
    });
    let changed = false;

    if (result.accepted && result.consumeResourceSpawn === true && pickupState !== null) {
      this.#consumeResourceSpawnState(pickupState, normalizedNowMs);
      changed = true;
    }

    if (result.accepted && result.droppedResourceSpawn !== null && result.droppedResourceSpawn !== undefined) {
      this.#resourceSpawnStatesById.set(result.droppedResourceSpawn.spawnId, {
        authoredResourceSpawn: null,
        available: true,
        nextRespawnAtServerTimeMs: null,
        resourceSpawn: result.droppedResourceSpawn,
        source: "dropped"
      });
      changed = true;
    }

    if (changed) {
      this.#dependencies.incrementSnapshotSequence();
    }
  }

  #consumeResourceSpawnState(
    state: MutableMetaverseResourceSpawnRuntimeState,
    nowMs: number
  ): void {
    if (state.source === "dropped") {
      this.#resourceSpawnStatesById.delete(state.resourceSpawn.spawnId);
      return;
    }

    state.available = false;
    state.nextRespawnAtServerTimeMs =
      nowMs + state.resourceSpawn.respawnCooldownMs;
  }

  #readNearestAvailableResourceSpawnState(
    playerRuntime: MetaverseAuthoritativeResourceSpawnPlayerRuntimeState
  ): MutableMetaverseResourceSpawnRuntimeState | null {
    let nearestState: MutableMetaverseResourceSpawnRuntimeState | null = null;
    let nearestDistanceMeters = Number.POSITIVE_INFINITY;

    for (const state of this.#resourceSpawnStatesById.values()) {
      if (!state.available) {
        continue;
      }

      const distanceMeters = createDistanceBetweenPlayerAndResource(
        playerRuntime,
        state.resourceSpawn
      );

      if (
        distanceMeters > state.resourceSpawn.pickupRadiusMeters ||
        distanceMeters >= nearestDistanceMeters
      ) {
        continue;
      }

      nearestState = state;
      nearestDistanceMeters = distanceMeters;
    }

    return nearestState;
  }

  readResourceSpawnSnapshots(): readonly MetaverseRealtimeResourceSpawnSnapshotInput[] {
    return Object.freeze(
      [...this.#resourceSpawnStatesById.values()]
        .filter((state) => state.available)
        .sort((leftState, rightState) =>
          leftState.resourceSpawn.spawnId.localeCompare(
            rightState.resourceSpawn.spawnId
          )
        )
        .map((state) => ({
          assetId: state.resourceSpawn.assetId,
          pickupRadiusMeters: state.resourceSpawn.pickupRadiusMeters,
          position: state.resourceSpawn.position,
          spawnId: state.resourceSpawn.spawnId,
          weaponId: state.resourceSpawn.weaponId,
          yawRadians: state.resourceSpawn.yawRadians
        }))
    );
  }
}
