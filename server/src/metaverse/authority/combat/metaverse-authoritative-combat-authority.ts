import {
  createMetaversePlayerActionReceiptSnapshot,
  createMetaverseCombatFeedEventSnapshot,
  createMetaverseCombatMatchSnapshot,
  createMetaverseCombatPlayerWeaponSnapshot,
  createMetaverseCombatProjectileSnapshot,
  createMetaverseCombatAimSnapshot,
  createMetaversePlayerCombatHurtVolumes,
  createMetaversePlayerCombatSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  readMetaverseCombatWeaponProfile,
  resolveMetaverseCombatAimDirectionSnapshot,
  resolveMetaverseCombatHitForSegment,
  type MetaverseCombatActionRejectionReasonId,
  type MetaverseCombatFeedEventSnapshotInput,
  type MetaverseCombatMatchSnapshot,
  type MetaverseCombatPlayerWeaponSnapshotInput,
  type MetaverseCombatProjectileSnapshot,
  type MetaverseCombatProjectileSnapshotInput,
  type MetaverseFireWeaponPlayerActionSnapshot,
  type MetaverseIssuePlayerActionCommand,
  type MetaversePlayerActionFireWeaponRejectionReasonId,
  type MetaversePlayerActionReceiptSnapshot,
  type MetaversePlayerCombatHurtVolumeConfig,
  type MetaversePlayerCombatHurtVolumesSnapshot,
  type MetaversePlayerCombatSnapshot
} from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerId,
  MetaversePlayerTeamId
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseMapBundleSemanticGameplayVolumeSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle
} from "../../types/metaverse-authoritative-rapier.js";
import type { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";

interface MetaverseCombatMountedOccupancyRuntimeState {
  readonly occupancyKind: string;
  readonly occupantRole: string;
}

export interface MetaverseAuthoritativeCombatPlayerRuntimeState<
  MountedOccupancy extends
    | MetaverseCombatMountedOccupancyRuntimeState
    | null = MetaverseCombatMountedOccupancyRuntimeState | null
> {
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  locomotionMode: string;
  mountedOccupancy: MountedOccupancy;
  readonly playerId: MetaversePlayerId;
  readonly teamId: MetaversePlayerTeamId;
  positionX: number;
  positionY: number;
  positionZ: number;
  stateSequence: number;
  unmountedTraversalState: ReturnType<typeof createMetaverseUnmountedTraversalStateSnapshot>;
  weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
  yawRadians: number;
  lookPitchRadians: number;
  lookYawRadians: number;
}

interface MutableMetaverseCombatWeaponRuntimeState {
  ammoInMagazine: number;
  ammoInReserve: number;
  reloadRemainingMs: number;
  shotsFired: number;
  shotsHit: number;
  readonly weaponId: string;
}

interface MutableMetaverseCombatPlayerRuntimeState {
  activeWeaponId: string;
  alive: boolean;
  assists: number;
  readonly damageLedgerByAttackerId: Map<MetaversePlayerId, number>;
  deaths: number;
  headshotKills: number;
  highestProcessedPlayerActionSequence: number;
  health: number;
  kills: number;
  lastFireAtMs: number;
  maxHealth: number;
  readonly playerActionReceiptSequenceOrder: number[];
  readonly recentPlayerActionReceiptsBySequence: Map<
    number,
    MetaversePlayerActionReceiptSnapshot
  >;
  respawnRemainingMs: number;
  spawnProtectionRemainingMs: number;
  readonly weaponsById: Map<string, MutableMetaverseCombatWeaponRuntimeState>;
}

interface MutableMetaverseCombatProjectileRuntimeState {
  readonly direction: PhysicsVector3Snapshot;
  expiresAtTimeMs: number;
  readonly ownerPlayerId: MetaversePlayerId;
  positionX: number;
  positionY: number;
  positionZ: number;
  readonly projectileId: string;
  resolution: MetaverseCombatProjectileSnapshot["resolution"];
  resolvedAtTimeMs: number | null;
  resolvedHitZone: MetaverseCombatProjectileSnapshot["resolvedHitZone"];
  resolvedPlayerId: MetaverseCombatProjectileSnapshot["resolvedPlayerId"];
  readonly sourceActionSequence: number;
  spawnedAtTimeMs: number;
  readonly velocityMetersPerSecond: number;
  readonly weaponId: string;
}

interface MutableMetaverseCombatMatchRuntimeState {
  assistDamageThreshold: number;
  completedAtTimeMs: number | null;
  friendlyFireEnabled: boolean;
  phase: MetaverseCombatMatchSnapshot["phase"];
  respawnDelayMs: number;
  scoreLimit: number;
  readonly teamScoresByTeamId: Map<MetaversePlayerTeamId, number>;
  timeLimitMs: number;
  timeRemainingMs: number;
  startedAtTimeMs: number | null;
  winnerTeamId: MetaversePlayerTeamId | null;
}

interface MetaversePlayerHurtVolumeHistorySample {
  readonly hurtVolumes: MetaversePlayerCombatHurtVolumesSnapshot;
  readonly playerId: MetaversePlayerId;
  readonly simulationTimeMs: number;
}

interface MetaverseAuthoritativeCombatAuthorityDependencies<
  PlayerRuntime extends MetaverseAuthoritativeCombatPlayerRuntimeState
> {
  readonly authoritativeCombatRewindEnabled?: boolean;
  readonly clearDriverVehicleControl: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerTraversalIntent: (playerId: MetaversePlayerId) => void;
  readonly clearPlayerVehicleOccupancy: (playerId: MetaversePlayerId) => void;
  readonly hurtVolumeConfig?: Partial<MetaversePlayerCombatHurtVolumeConfig>;
  readonly incrementSnapshotSequence: () => void;
  readonly killFloorVolumes?:
    readonly MetaverseMapBundleSemanticGameplayVolumeSnapshot[];
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly playerTraversalColliderHandles: ReadonlySet<RapierColliderHandle>;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly readTickIntervalMs: () => number;
  readonly resolveRespawnPose: (
    playerId: MetaversePlayerId,
    teamId: MetaversePlayerTeamId
  ) => {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  };
  readonly syncAuthoritativePlayerLookToCurrentFacing: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncPlayerTraversalAuthorityState: (
    playerRuntime: PlayerRuntime
  ) => void;
  readonly syncPlayerTraversalBodyRuntimes: (
    playerRuntime: PlayerRuntime,
    groundedOverride?: boolean
  ) => void;
}

const defaultCombatWeaponId = "metaverse-service-pistol-v2" as const;
const combatActionReceiptRingMaxEntries = 8;
const combatPlayerActionDedupeCacheMaxEntries = 16;
const combatRewindWindowMs = 200;
const combatHurtVolumeHistoryWindowMs = 200;
const killFloorCombatWeaponId = "metaverse-environment-kill-floor-v1" as const;
const projectileRetentionAfterResolutionMs = 250;
const spawnProtectionDurationMs = 1_000;

function createPhysicsVector3Snapshot(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x,
    y,
    z
  });
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

function normalizeFiniteNonNegativeNumber(
  rawValue: number | undefined,
  fallback = 0
): number {
  if (!Number.isFinite(rawValue ?? fallback)) {
    return Math.max(0, fallback);
  }

  return Math.max(0, rawValue ?? fallback);
}

function normalizeDirection(
  direction: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">
): PhysicsVector3Snapshot | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);

  if (!Number.isFinite(length) || length <= 0.000001) {
    return null;
  }

  return createPhysicsVector3Snapshot(
    direction.x / length,
    direction.y / length,
    direction.z / length
  );
}

function createOffsetVector(
  origin: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  direction: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  distanceMeters: number
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    origin.x + direction.x * distanceMeters,
    origin.y + direction.y * distanceMeters,
    origin.z + direction.z * distanceMeters
  );
}

function createDistanceBetweenPoints(
  left: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  right: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">
): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function createPlayerBodyPositionSnapshot(
  playerRuntime: Pick<
    MetaverseAuthoritativeCombatPlayerRuntimeState,
    "positionX" | "positionY" | "positionZ"
  >
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    playerRuntime.positionX,
    playerRuntime.positionY,
    playerRuntime.positionZ
  );
}

function createProjectilePositionSnapshot(
  projectileRuntime: Pick<
    MutableMetaverseCombatProjectileRuntimeState,
    "positionX" | "positionY" | "positionZ"
  >
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    projectileRuntime.positionX,
    projectileRuntime.positionY,
    projectileRuntime.positionZ
  );
}

function isPlayerPositionInsideKillFloorVolume(
  playerRuntime: Pick<
    MetaverseAuthoritativeCombatPlayerRuntimeState,
    "positionX" | "positionY" | "positionZ"
  >,
  volume: Pick<
    MetaverseMapBundleSemanticGameplayVolumeSnapshot,
    "center" | "rotationYRadians" | "size"
  >
): boolean {
  const planarDeltaX = playerRuntime.positionX - volume.center.x;
  const planarDeltaZ = playerRuntime.positionZ - volume.center.z;
  const cosRotation = Math.cos(volume.rotationYRadians);
  const sinRotation = Math.sin(volume.rotationYRadians);
  const localX = planarDeltaX * cosRotation - planarDeltaZ * sinRotation;
  const localZ = planarDeltaX * sinRotation + planarDeltaZ * cosRotation;

  return (
    Math.abs(localX) <= Math.max(0.125, volume.size.x * 0.5) &&
    Math.abs(localZ) <= Math.max(0.125, volume.size.z * 0.5) &&
    playerRuntime.positionY <= volume.center.y
  );
}

export class MetaverseAuthoritativeCombatAuthority<
  PlayerRuntime extends MetaverseAuthoritativeCombatPlayerRuntimeState
> {
  readonly #dependencies: MetaverseAuthoritativeCombatAuthorityDependencies<PlayerRuntime>;
  readonly #feedEvents: MetaverseCombatFeedEventSnapshotInput[] = [];
  readonly #hurtVolumeHistoryByPlayerId = new Map<
    MetaversePlayerId,
    MetaversePlayerHurtVolumeHistorySample[]
  >();
  readonly #matchState: MutableMetaverseCombatMatchRuntimeState;
  readonly #playerCombatStateByPlayerId = new Map<
    MetaversePlayerId,
    MutableMetaverseCombatPlayerRuntimeState
  >();
  readonly #projectilesById = new Map<
    string,
    MutableMetaverseCombatProjectileRuntimeState
  >();

  #feedSequence = 0;

  constructor(
    dependencies: MetaverseAuthoritativeCombatAuthorityDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;
    this.#matchState = {
      assistDamageThreshold: 50,
      completedAtTimeMs: null,
      friendlyFireEnabled: false,
      phase: "waiting-for-players",
      respawnDelayMs: 3_000,
      scoreLimit: 50,
      startedAtTimeMs: null,
      teamScoresByTeamId: new Map([
        ["red", 0],
        ["blue", 0]
      ]),
      timeLimitMs: 600_000,
      timeRemainingMs: 600_000,
      winnerTeamId: null
    };
  }

  acceptIssuePlayerActionCommand(
    command: MetaverseIssuePlayerActionCommand,
    nowMs: number
  ): void {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.syncCombatState(normalizedNowMs);

    const playerRuntime = this.#dependencies.playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    switch (command.action.kind) {
      case "fire-weapon":
        this.#acceptFireWeaponAction(
          command.playerId,
          command.action,
          normalizedNowMs,
          playerRuntime
        );
        break;
      case "jump":
        break;
      default: {
        const exhaustiveAction: never = command.action;

        throw new Error(
          `Unsupported metaverse player action kind: ${exhaustiveAction}`
        );
      }
    }
  }

  #acceptFireWeaponAction(
    playerId: MetaversePlayerId,
    action: MetaverseFireWeaponPlayerActionSnapshot,
    nowMs: number,
    playerRuntime: PlayerRuntime
  ): void {
    const combatState = this.#ensurePlayerCombatState(playerRuntime);
    const duplicateReceipt = this.#readProcessedPlayerActionReceipt(
      combatState,
      action.actionSequence
    );

    if (duplicateReceipt !== null) {
      return;
    }

    const oldestRetainedReceiptSequence =
      combatState.playerActionReceiptSequenceOrder[0] ?? null;

    if (
      oldestRetainedReceiptSequence !== null &&
      action.actionSequence < oldestRetainedReceiptSequence &&
      action.actionSequence <= combatState.highestProcessedPlayerActionSequence
    ) {
      return;
    }

    if (this.#matchState.phase !== "active") {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "match-inactive",
        weaponId: action.weaponId
      });
      return;
    }

    if (
      !combatState.alive ||
      combatState.spawnProtectionRemainingMs > 0 ||
      playerRuntime.mountedOccupancy !== null
    ) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason:
          !combatState.alive
            ? "player-dead"
            : combatState.spawnProtectionRemainingMs > 0
              ? "spawn-protected"
              : "mounted",
        weaponId: action.weaponId
      });
      return;
    }

    let weaponId: string;
    let weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;

    try {
      weaponId = this.#resolveActiveWeaponId(playerRuntime, action.weaponId);
      weaponProfile = readMetaverseCombatWeaponProfile(weaponId);
    } catch {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "unknown-weapon",
        weaponId: action.weaponId
      });
      return;
    }

    const weaponState = this.#ensureWeaponRuntimeState(combatState, weaponId);

    if (weaponState.reloadRemainingMs > 0) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "reloading",
        weaponId
      });
      return;
    }

    const millisecondsPerShot =
      weaponProfile.roundsPerMinute <= 0
        ? Number.POSITIVE_INFINITY
        : 60_000 / weaponProfile.roundsPerMinute;

    if (nowMs - combatState.lastFireAtMs + 0.0001 < millisecondsPerShot) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "cooldown",
        weaponId
      });
      return;
    }

    if (weaponState.ammoInMagazine <= 0) {
      this.#startReloadIfNeeded(weaponState, weaponProfile);
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "out-of-ammo",
        weaponId
      });
      return;
    }

    const direction = normalizeDirection(
      resolveMetaverseCombatAimDirectionSnapshot(
        createMetaverseCombatAimSnapshot(action.aimSnapshot)
      )
    );

    if (direction === null) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: "invalid-direction",
        weaponId
      });
      return;
    }

    weaponState.ammoInMagazine -= 1;
    weaponState.shotsFired += 1;
    combatState.activeWeaponId = weaponId;
    combatState.lastFireAtMs = nowMs;

    const issuedAtTimeMs = this.#resolveIssuedAtAuthoritativeTimeMs(
      Number(action.issuedAtAuthoritativeTimeMs),
      nowMs
    );
    const origin = this.#createFireOrigin(playerRuntime, weaponProfile);

    if (
      weaponProfile.deliveryModel === "hitscan" &&
      this.#dependencies.authoritativeCombatRewindEnabled === true
    ) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        sourceProjectileId: null,
        weaponId
      });
      this.#resolveHitscanFireAction({
        actionSequence: action.actionSequence,
        attackerPlayerId: playerId,
        direction,
        issuedAtTimeMs,
        nowMs,
        origin,
        weaponId
      });
    } else {
      this.#spawnProjectileFireAction({
        actionSequence: action.actionSequence,
        attackerPlayerId: playerId,
        combatState,
        direction,
        issuedAtTimeMs,
        nowMs,
        origin,
        weaponId,
        weaponProfile
      });
    }

    if (weaponState.ammoInMagazine <= 0) {
      this.#startReloadIfNeeded(weaponState, weaponProfile);
    }
  }

  #createFireOrigin(
    playerRuntime: PlayerRuntime,
    weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
  ): PhysicsVector3Snapshot {
    return createPhysicsVector3Snapshot(
      playerRuntime.positionX,
      playerRuntime.positionY + weaponProfile.firingOriginHeightMeters,
      playerRuntime.positionZ
    );
  }

  #resolveIssuedAtAuthoritativeTimeMs(
    issuedAtAuthoritativeTimeMs: number,
    nowMs: number
  ): number {
    const rewindLowerBound = Math.max(0, nowMs - combatRewindWindowMs);

    return Math.min(
      nowMs,
      Math.max(rewindLowerBound, normalizeFiniteNonNegativeNumber(issuedAtAuthoritativeTimeMs))
    );
  }

  #resolveFireRangeMeters(
    weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
  ): number {
    const rangeMeters =
      weaponProfile.accuracy.projectileVelocityMetersPerSecond *
      (Number(weaponProfile.accuracy.projectileLifetimeMs) / 1_000);

    return Number.isFinite(rangeMeters) && rangeMeters > 0 ? rangeMeters : 512;
  }

  #spawnProjectileFireAction(input: {
    readonly actionSequence: number;
    readonly attackerPlayerId: MetaversePlayerId;
    readonly combatState: MutableMetaverseCombatPlayerRuntimeState;
    readonly direction: PhysicsVector3Snapshot;
    readonly issuedAtTimeMs: number;
    readonly nowMs: number;
    readonly origin: PhysicsVector3Snapshot;
    readonly weaponId: string;
    readonly weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;
  }): void {
    const projectileId = `${input.attackerPlayerId}:${input.actionSequence}`;
    const projectileRuntime: MutableMetaverseCombatProjectileRuntimeState = {
      direction: input.direction,
      expiresAtTimeMs:
        input.issuedAtTimeMs +
        Number(input.weaponProfile.accuracy.projectileLifetimeMs),
      ownerPlayerId: input.attackerPlayerId,
      positionX: input.origin.x,
      positionY: input.origin.y,
      positionZ: input.origin.z,
      projectileId,
      resolution: "active",
      resolvedAtTimeMs: null,
      resolvedHitZone: null,
      resolvedPlayerId: null,
      sourceActionSequence: input.actionSequence,
      spawnedAtTimeMs: input.issuedAtTimeMs,
      velocityMetersPerSecond:
        input.weaponProfile.accuracy.projectileVelocityMetersPerSecond,
      weaponId: input.weaponId
    };

    this.#publishFireWeaponActionReceipt(input.combatState, {
      actionSequence: input.actionSequence,
      nowMs: input.nowMs,
      sourceProjectileId: projectileId,
      weaponId: input.weaponId
    });

    const fastForwardSeconds = Math.max(
      0,
      (input.nowMs - input.issuedAtTimeMs) / 1_000
    );

    if (fastForwardSeconds > 0) {
      this.#advanceProjectile(projectileRuntime, fastForwardSeconds, input.nowMs);
    }

    if (projectileRuntime.resolution === "active") {
      this.#projectilesById.set(projectileId, projectileRuntime);
    }
  }

  #resolveHitscanFireAction(input: {
    readonly actionSequence: number;
    readonly attackerPlayerId: MetaversePlayerId;
    readonly direction: PhysicsVector3Snapshot;
    readonly issuedAtTimeMs: number;
    readonly nowMs: number;
    readonly origin: PhysicsVector3Snapshot;
    readonly weaponId: string;
  }): void {
    const weaponProfile = readMetaverseCombatWeaponProfile(input.weaponId);
    const maxDistanceMeters = this.#resolveFireRangeMeters(weaponProfile);
    const worldHit = this.#dependencies.physicsRuntime.castRay(
      input.origin,
      input.direction,
      maxDistanceMeters,
      (collider) => !this.#dependencies.playerTraversalColliderHandles.has(collider)
    );
    const segmentEnd =
      worldHit?.point ??
      createOffsetVector(input.origin, input.direction, maxDistanceMeters);
    let closestPlayerHit:
      | {
          readonly distanceMeters: number;
          readonly hitZone: "body" | "head";
          readonly targetPlayerId: MetaversePlayerId;
        }
      | null = null;

    for (const targetRuntime of this.#dependencies.playersById.values()) {
      if (targetRuntime.playerId === input.attackerPlayerId) {
        continue;
      }

      const targetCombatState =
        this.#playerCombatStateByPlayerId.get(targetRuntime.playerId) ?? null;

      if (
        targetCombatState === null ||
        !targetCombatState.alive ||
        targetCombatState.spawnProtectionRemainingMs > 0
      ) {
        continue;
      }

      const ownerRuntime =
        this.#dependencies.playersById.get(input.attackerPlayerId) ?? null;

      if (
        ownerRuntime !== null &&
        !this.#matchState.friendlyFireEnabled &&
        ownerRuntime.teamId === targetRuntime.teamId
      ) {
        continue;
      }

      const hurtVolumes =
        this.#readHistoricalHurtVolumes(targetRuntime.playerId, input.issuedAtTimeMs) ??
        this.#createCurrentPlayerHurtVolumes(targetRuntime);
      const hitResolution = resolveMetaverseCombatHitForSegment(
        input.origin,
        segmentEnd,
        hurtVolumes
      );

      if (hitResolution === null) {
        continue;
      }

      if (
        closestPlayerHit === null ||
        hitResolution.distanceMeters < closestPlayerHit.distanceMeters
      ) {
        closestPlayerHit = {
          distanceMeters: hitResolution.distanceMeters,
          hitZone: hitResolution.hitZone,
          targetPlayerId: targetRuntime.playerId
        };
      }
    }

    if (closestPlayerHit === null) {
      return;
    }

    this.#applyCombatHit(
      {
        ownerPlayerId: input.attackerPlayerId,
        sourceActionSequence: input.actionSequence,
        sourceProjectileId: null,
        weaponId: input.weaponId
      },
      closestPlayerHit.targetPlayerId,
      closestPlayerHit.hitZone,
      input.nowMs
    );
  }

  advanceCombatRuntimes(
    tickIntervalSeconds: number,
    nowMs: number
  ): void {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.syncCombatState(normalizedNowMs);

    for (const [playerId, combatState] of this.#playerCombatStateByPlayerId) {
      if (!this.#dependencies.playersById.has(playerId)) {
        continue;
      }

      this.#advancePlayerWeaponReloads(combatState, tickIntervalSeconds);
      this.#advanceSpawnProtection(combatState, tickIntervalSeconds);
      this.#advanceRespawnState(playerId, combatState, normalizedNowMs, tickIntervalSeconds);
    }

    for (const projectileRuntime of this.#projectilesById.values()) {
      this.#advanceProjectile(projectileRuntime, tickIntervalSeconds, normalizedNowMs);
    }

    this.#advanceKillFloorEliminations(normalizedNowMs);
    this.#pruneResolvedProjectiles(normalizedNowMs);
    this.#recordHurtVolumeHistory(normalizedNowMs);
  }

  syncCombatState(nowMs: number): void {
    this.#pruneMissingPlayerCombatState();

    for (const playerRuntime of this.#dependencies.playersById.values()) {
      this.#ensurePlayerCombatState(playerRuntime);
    }

    if (
      this.#matchState.phase === "waiting-for-players" &&
      this.#dependencies.playersById.size >= 2
    ) {
      this.#startMatch(nowMs);
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    if (
      this.#matchState.phase === "active" &&
      this.#matchState.startedAtTimeMs !== null
    ) {
      const elapsedMs = Math.max(0, nowMs - this.#matchState.startedAtTimeMs);

      this.#matchState.timeRemainingMs = Math.max(
        0,
        this.#matchState.timeLimitMs - elapsedMs
      );

      if (this.#matchState.timeRemainingMs <= 0) {
        this.#completeMatch(nowMs);
        this.#dependencies.incrementSnapshotSequence();
      }
    }
  }

  readCombatFeedSnapshots(): readonly ReturnType<
    typeof createMetaverseCombatFeedEventSnapshot
  >[] {
    return Object.freeze(
      this.#feedEvents.map((eventSnapshot) =>
        createMetaverseCombatFeedEventSnapshot(eventSnapshot)
      )
    );
  }

  readCombatMatchSnapshot(): MetaverseCombatMatchSnapshot {
    return createMetaverseCombatMatchSnapshot({
      assistDamageThreshold: this.#matchState.assistDamageThreshold,
      completedAtTimeMs: this.#matchState.completedAtTimeMs,
      friendlyFireEnabled: this.#matchState.friendlyFireEnabled,
      phase: this.#matchState.phase,
      respawnDelayMs: this.#matchState.respawnDelayMs,
      scoreLimit: this.#matchState.scoreLimit,
      teams: [
        {
          playerIds: this.#collectTeamRoster("red"),
          score: this.#matchState.teamScoresByTeamId.get("red") ?? 0,
          teamId: "red"
        },
        {
          playerIds: this.#collectTeamRoster("blue"),
          score: this.#matchState.teamScoresByTeamId.get("blue") ?? 0,
          teamId: "blue"
        }
      ],
      timeLimitMs: this.#matchState.timeLimitMs,
      timeRemainingMs: this.#matchState.timeRemainingMs,
      winnerTeamId: this.#matchState.winnerTeamId
    });
  }

  readPlayerCombatSnapshot(
    playerId: MetaversePlayerId
  ): MetaversePlayerCombatSnapshot | null {
    const combatState = this.#playerCombatStateByPlayerId.get(playerId) ?? null;

    if (combatState === null) {
      return null;
    }

    return createMetaversePlayerCombatSnapshot({
      activeWeapon: this.#createActiveWeaponSnapshotInput(combatState),
      alive: combatState.alive,
      assists: combatState.assists,
      damageLedger: [...combatState.damageLedgerByAttackerId.entries()].map(
        ([attackerPlayerId, totalDamage]) => ({
          attackerPlayerId,
          totalDamage
        })
      ),
      deaths: combatState.deaths,
      headshotKills: combatState.headshotKills,
      health: combatState.health,
      kills: combatState.kills,
      maxHealth: combatState.maxHealth,
      respawnRemainingMs: combatState.respawnRemainingMs,
      spawnProtectionRemainingMs: combatState.spawnProtectionRemainingMs,
      weaponStats: [...combatState.weaponsById.values()].map((weaponState) => ({
        shotsFired: weaponState.shotsFired,
        shotsHit: weaponState.shotsHit,
        weaponId: weaponState.weaponId
      }))
    });
  }

  isPlayerAlive(playerId: MetaversePlayerId): boolean {
    return this.#playerCombatStateByPlayerId.get(playerId)?.alive ?? true;
  }

  readPlayerCombatActionObserverSnapshot(playerId: MetaversePlayerId): {
    readonly highestProcessedPlayerActionSequence: number;
    readonly recentPlayerActionReceipts:
      readonly MetaversePlayerActionReceiptSnapshot[];
  } | null {
    const combatState = this.#playerCombatStateByPlayerId.get(playerId) ?? null;

    if (combatState === null) {
      return null;
    }

    return Object.freeze({
      highestProcessedPlayerActionSequence:
        combatState.highestProcessedPlayerActionSequence,
      recentPlayerActionReceipts: Object.freeze(
        combatState.playerActionReceiptSequenceOrder
          .map(
            (actionSequence) =>
              combatState.recentPlayerActionReceiptsBySequence.get(
                actionSequence
              ) ?? null
          )
          .filter(
            (
              receiptSnapshot
            ): receiptSnapshot is MetaversePlayerActionReceiptSnapshot =>
              receiptSnapshot !== null
          )
      )
    });
  }

  readProjectileSnapshots(): readonly MetaverseCombatProjectileSnapshot[] {
    return Object.freeze(
      [...this.#projectilesById.values()].map((projectileRuntime) =>
        createMetaverseCombatProjectileSnapshot(
          this.#createProjectileSnapshotInput(projectileRuntime)
        )
      )
    );
  }

  #advancePlayerWeaponReloads(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    tickIntervalSeconds: number
  ): void {
    const tickIntervalMs = tickIntervalSeconds * 1_000;

    for (const weaponState of combatState.weaponsById.values()) {
      if (weaponState.reloadRemainingMs <= 0) {
        continue;
      }

      weaponState.reloadRemainingMs = Math.max(
        0,
        weaponState.reloadRemainingMs - tickIntervalMs
      );

      if (weaponState.reloadRemainingMs > 0) {
        continue;
      }

      const weaponProfile = readMetaverseCombatWeaponProfile(weaponState.weaponId);
      const roundsMissing =
        weaponProfile.magazine.magazineCapacity - weaponState.ammoInMagazine;
      const roundsToLoad = Math.min(roundsMissing, weaponState.ammoInReserve);

      weaponState.ammoInMagazine += roundsToLoad;
      weaponState.ammoInReserve -= roundsToLoad;
    }
  }

  #advanceProjectile(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState,
    deltaSeconds: number,
    nowMs: number
  ): void {
    if (projectileRuntime.resolution !== "active") {
      return;
    }

    if (projectileRuntime.expiresAtTimeMs <= nowMs) {
      this.#resolveProjectile(projectileRuntime, "expired", null, null, nowMs);
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    const segmentStart = createProjectilePositionSnapshot(projectileRuntime);
    const segmentEnd = createOffsetVector(
      segmentStart,
      projectileRuntime.direction,
      projectileRuntime.velocityMetersPerSecond * deltaSeconds
    );
    const worldHit = this.#dependencies.physicsRuntime.castRay(
      segmentStart,
      projectileRuntime.direction,
      createDistanceBetweenPoints(segmentStart, segmentEnd),
      (collider) => !this.#dependencies.playerTraversalColliderHandles.has(collider)
    );
    let closestPlayerHit:
      | {
          readonly distanceMeters: number;
          readonly hitZone: "body" | "head";
          readonly point: PhysicsVector3Snapshot;
          readonly targetPlayerId: MetaversePlayerId;
        }
      | null = null;

    for (const targetRuntime of this.#dependencies.playersById.values()) {
      if (targetRuntime.playerId === projectileRuntime.ownerPlayerId) {
        continue;
      }

      const targetCombatState =
        this.#playerCombatStateByPlayerId.get(targetRuntime.playerId) ?? null;

      if (
        targetCombatState === null ||
        !targetCombatState.alive ||
        targetCombatState.spawnProtectionRemainingMs > 0
      ) {
        continue;
      }

      const ownerRuntime =
        this.#dependencies.playersById.get(projectileRuntime.ownerPlayerId) ?? null;

      if (
        ownerRuntime !== null &&
        !this.#matchState.friendlyFireEnabled &&
        ownerRuntime.teamId === targetRuntime.teamId
      ) {
        continue;
      }

      const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
        activeBodyPosition: createPlayerBodyPositionSnapshot(targetRuntime),
        ...(this.#dependencies.hurtVolumeConfig === undefined
          ? {}
          : {
              config: this.#dependencies.hurtVolumeConfig
            })
      });
      const hitResolution = resolveMetaverseCombatHitForSegment(
        segmentStart,
        segmentEnd,
        hurtVolumes
      );

      if (hitResolution === null) {
        continue;
      }

      if (
        closestPlayerHit === null ||
        hitResolution.distanceMeters < closestPlayerHit.distanceMeters
      ) {
        closestPlayerHit = {
          distanceMeters: hitResolution.distanceMeters,
          hitZone: hitResolution.hitZone,
          point: hitResolution.point,
          targetPlayerId: targetRuntime.playerId
        };
      }
    }

    if (
      worldHit !== null &&
      (closestPlayerHit === null ||
        worldHit.distanceMeters < closestPlayerHit.distanceMeters)
    ) {
      this.#resolveProjectile(
        projectileRuntime,
        "hit-world",
        null,
        null,
        nowMs
      );
      projectileRuntime.positionX = worldHit.point.x;
      projectileRuntime.positionY = worldHit.point.y;
      projectileRuntime.positionZ = worldHit.point.z;
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    if (closestPlayerHit !== null) {
      projectileRuntime.positionX = closestPlayerHit.point.x;
      projectileRuntime.positionY = closestPlayerHit.point.y;
      projectileRuntime.positionZ = closestPlayerHit.point.z;
      this.#applyPlayerHit(
        projectileRuntime,
        closestPlayerHit.targetPlayerId,
        closestPlayerHit.hitZone,
        nowMs
      );
      this.#dependencies.incrementSnapshotSequence();
      return;
    }

    projectileRuntime.positionX = segmentEnd.x;
    projectileRuntime.positionY = segmentEnd.y;
    projectileRuntime.positionZ = segmentEnd.z;
  }

  #advanceRespawnState(
    playerId: MetaversePlayerId,
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    nowMs: number,
    tickIntervalSeconds: number
  ): void {
    if (combatState.alive) {
      return;
    }

    combatState.respawnRemainingMs = Math.max(
      0,
      combatState.respawnRemainingMs - tickIntervalSeconds * 1_000
    );

    if (combatState.respawnRemainingMs > 0 || this.#matchState.phase !== "active") {
      return;
    }

    const playerRuntime = this.#dependencies.playersById.get(playerId);

    if (playerRuntime === undefined) {
      return;
    }

    this.#respawnPlayer(playerRuntime, combatState, nowMs);
  }

  #advanceSpawnProtection(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    tickIntervalSeconds: number
  ): void {
    if (combatState.spawnProtectionRemainingMs <= 0) {
      return;
    }

    combatState.spawnProtectionRemainingMs = Math.max(
      0,
      combatState.spawnProtectionRemainingMs - tickIntervalSeconds * 1_000
    );
  }

  #applyPlayerHit(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState,
    targetPlayerId: MetaversePlayerId,
    hitZone: "body" | "head",
    nowMs: number
  ): void {
    this.#applyCombatHit(
      {
        ownerPlayerId: projectileRuntime.ownerPlayerId,
        sourceActionSequence: projectileRuntime.sourceActionSequence,
        sourceProjectileId: projectileRuntime.projectileId,
        weaponId: projectileRuntime.weaponId
      },
      targetPlayerId,
      hitZone,
      nowMs
    );
    this.#resolveProjectile(
      projectileRuntime,
      "hit-player",
      targetPlayerId,
      hitZone,
      nowMs
    );

    if (
      (this.#matchState.teamScoresByTeamId.get("red") ?? 0) >=
        this.#matchState.scoreLimit ||
      (this.#matchState.teamScoresByTeamId.get("blue") ?? 0) >=
        this.#matchState.scoreLimit
    ) {
      this.#completeMatch(nowMs);
    }
  }

  #applyCombatHit(
    source: {
      readonly ownerPlayerId: MetaversePlayerId;
      readonly sourceActionSequence: number;
      readonly sourceProjectileId: string | null;
      readonly weaponId: string;
    },
    targetPlayerId: MetaversePlayerId,
    hitZone: "body" | "head",
    nowMs: number
  ): void {
    const targetCombatState =
      this.#playerCombatStateByPlayerId.get(targetPlayerId) ?? null;
    const ownerCombatState =
      this.#playerCombatStateByPlayerId.get(source.ownerPlayerId) ?? null;
    const targetRuntime = this.#dependencies.playersById.get(targetPlayerId) ?? null;

    if (
      targetCombatState === null ||
      ownerCombatState === null ||
      targetRuntime === null
    ) {
      return;
    }

    const weaponProfile = readMetaverseCombatWeaponProfile(source.weaponId);
    const damage =
      hitZone === "head" ? weaponProfile.damage.head : weaponProfile.damage.body;

    targetCombatState.health = Math.max(0, targetCombatState.health - damage);
    const ownerWeaponState =
      ownerCombatState.weaponsById.get(source.weaponId) ?? null;

    if (ownerWeaponState !== null) {
      ownerWeaponState.shotsHit += 1;
    }

    targetCombatState.damageLedgerByAttackerId.set(
      source.ownerPlayerId,
      (targetCombatState.damageLedgerByAttackerId.get(source.ownerPlayerId) ?? 0) +
        damage
    );

    if (targetCombatState.health > 0) {
      this.#feedEvents.push({
        attackerPlayerId: source.ownerPlayerId,
        damage,
        hitZone,
        sequence: ++this.#feedSequence,
        sourceActionSequence: source.sourceActionSequence,
        sourceProjectileId: source.sourceProjectileId,
        targetPlayerId,
        timeMs: nowMs,
        type: "damage",
        weaponId: source.weaponId
      });
      this.#trimFeedEvents();
      return;
    }

    this.#applyCombatElimination({
      attackerPlayerId: source.ownerPlayerId,
      headshot: hitZone === "head",
      killDelta: 1,
      sourceActionSequence: source.sourceActionSequence,
      sourceProjectileId: source.sourceProjectileId,
      targetPlayerId,
      teamScoreDelta: 1,
      timeMs: nowMs,
      weaponId: source.weaponId
    });
  }

  #applyCombatElimination(input: {
    readonly attackerPlayerId: MetaversePlayerId;
    readonly headshot: boolean;
    readonly killDelta: number;
    readonly sourceActionSequence: number;
    readonly sourceProjectileId: string | null;
    readonly targetPlayerId: MetaversePlayerId;
    readonly teamScoreDelta: number;
    readonly timeMs: number;
    readonly weaponId: string;
  }): void {
    const targetCombatState =
      this.#playerCombatStateByPlayerId.get(input.targetPlayerId) ?? null;
    const attackerCombatState =
      this.#playerCombatStateByPlayerId.get(input.attackerPlayerId) ?? null;
    const targetRuntime =
      this.#dependencies.playersById.get(input.targetPlayerId) ?? null;
    const attackerRuntime =
      this.#dependencies.playersById.get(input.attackerPlayerId) ?? null;

    if (
      targetCombatState === null ||
      attackerCombatState === null ||
      targetRuntime === null ||
      attackerRuntime === null
    ) {
      return;
    }

    targetCombatState.alive = false;
    targetCombatState.deaths += 1;
    targetCombatState.health = 0;
    targetCombatState.respawnRemainingMs = this.#matchState.respawnDelayMs;
    targetCombatState.spawnProtectionRemainingMs = 0;
    attackerCombatState.kills += input.killDelta;

    if (input.headshot && input.attackerPlayerId !== input.targetPlayerId) {
      attackerCombatState.headshotKills += 1;
    }

    this.#matchState.teamScoresByTeamId.set(
      attackerRuntime.teamId,
      (this.#matchState.teamScoresByTeamId.get(attackerRuntime.teamId) ?? 0) +
        input.teamScoreDelta
    );

    const assisterPlayerIds =
      input.killDelta <= 0
        ? Object.freeze([]) as readonly MetaversePlayerId[]
        : Object.freeze(
            [...targetCombatState.damageLedgerByAttackerId.entries()]
              .filter(
                ([attackerPlayerId, totalDamage]) =>
                  attackerPlayerId !== input.attackerPlayerId &&
                  totalDamage >= this.#matchState.assistDamageThreshold
              )
              .map(([attackerPlayerId]) => attackerPlayerId)
          );

    for (const assisterPlayerId of assisterPlayerIds) {
      const assisterCombatState =
        this.#playerCombatStateByPlayerId.get(assisterPlayerId) ?? null;

      if (assisterCombatState !== null) {
        assisterCombatState.assists += 1;
      }
    }

    this.#feedEvents.push({
      assisterPlayerIds,
      attackerPlayerId: input.attackerPlayerId,
      headshot: input.headshot,
      sequence: ++this.#feedSequence,
      sourceActionSequence: input.sourceActionSequence,
      sourceProjectileId: input.sourceProjectileId,
      targetPlayerId: input.targetPlayerId,
      targetTeamId: targetRuntime.teamId,
      timeMs: input.timeMs,
      type: "kill",
      weaponId: input.weaponId
    });
    this.#trimFeedEvents();
  }

  #resolveKillFloorAttackerPlayerId(
    targetPlayerId: MetaversePlayerId,
    targetCombatState: MutableMetaverseCombatPlayerRuntimeState
  ): MetaversePlayerId | null {
    let leadingAttacker: {
      readonly attackerPlayerId: MetaversePlayerId;
      readonly totalDamage: number;
    } | null = null;

    for (const [
      attackerPlayerId,
      totalDamage
    ] of targetCombatState.damageLedgerByAttackerId.entries()) {
      if (
        attackerPlayerId === targetPlayerId ||
        totalDamage <= 0 ||
        !this.#dependencies.playersById.has(attackerPlayerId) ||
        !this.#playerCombatStateByPlayerId.has(attackerPlayerId)
      ) {
        continue;
      }

      if (
        leadingAttacker === null ||
        totalDamage > leadingAttacker.totalDamage
      ) {
        leadingAttacker = {
          attackerPlayerId,
          totalDamage
        };
      }
    }

    return leadingAttacker?.attackerPlayerId ?? null;
  }

  #advanceKillFloorEliminations(nowMs: number): void {
    if (
      this.#matchState.phase !== "active" ||
      (this.#dependencies.killFloorVolumes?.length ?? 0) === 0
    ) {
      return;
    }

    for (const [playerId, combatState] of this.#playerCombatStateByPlayerId) {
      if (!combatState.alive) {
        continue;
      }

      const playerRuntime = this.#dependencies.playersById.get(playerId) ?? null;

      if (playerRuntime === null) {
        continue;
      }

      const activeKillFloor =
        this.#dependencies.killFloorVolumes?.find((volume) =>
          isPlayerPositionInsideKillFloorVolume(playerRuntime, volume)
        ) ?? null;

      if (activeKillFloor === null) {
        continue;
      }

      const creditedAttackerPlayerId = this.#resolveKillFloorAttackerPlayerId(
        playerId,
        combatState
      );

      this.#applyCombatElimination({
        attackerPlayerId: creditedAttackerPlayerId ?? playerId,
        headshot: false,
        killDelta: creditedAttackerPlayerId === null ? -1 : 1,
        sourceActionSequence: 0,
        sourceProjectileId: null,
        targetPlayerId: playerId,
        teamScoreDelta: creditedAttackerPlayerId === null ? -1 : 1,
        timeMs: nowMs,
        weaponId: killFloorCombatWeaponId
      });
      this.#dependencies.incrementSnapshotSequence();

      if (
        (this.#matchState.teamScoresByTeamId.get("red") ?? 0) >=
          this.#matchState.scoreLimit ||
        (this.#matchState.teamScoresByTeamId.get("blue") ?? 0) >=
          this.#matchState.scoreLimit
      ) {
        this.#completeMatch(nowMs);
        this.#dependencies.incrementSnapshotSequence();
        return;
      }
    }
  }

  #collectTeamRoster(
    teamId: MetaversePlayerTeamId
  ): readonly MetaversePlayerId[] {
    return Object.freeze(
      [...this.#dependencies.playersById.values()]
        .filter((playerRuntime) => playerRuntime.teamId === teamId)
        .map((playerRuntime) => playerRuntime.playerId)
    );
  }

  #completeMatch(nowMs: number): void {
    const redScore = this.#matchState.teamScoresByTeamId.get("red") ?? 0;
    const blueScore = this.#matchState.teamScoresByTeamId.get("blue") ?? 0;

    this.#matchState.completedAtTimeMs = nowMs;
    this.#matchState.phase = "completed";
    this.#matchState.timeRemainingMs = 0;
    this.#matchState.winnerTeamId =
      redScore === blueScore ? null : redScore > blueScore ? "red" : "blue";
  }

  #createActiveWeaponSnapshotInput(
    combatState: MutableMetaverseCombatPlayerRuntimeState
  ): MetaverseCombatPlayerWeaponSnapshotInput | null {
    const activeWeaponState =
      combatState.weaponsById.get(combatState.activeWeaponId) ?? null;

    if (activeWeaponState === null) {
      return null;
    }

    return {
      ammoInMagazine: activeWeaponState.ammoInMagazine,
      ammoInReserve: activeWeaponState.ammoInReserve,
      reloadRemainingMs: activeWeaponState.reloadRemainingMs,
      weaponId: activeWeaponState.weaponId
    };
  }

  #createProjectileSnapshotInput(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState
  ): MetaverseCombatProjectileSnapshotInput {
    return {
      direction: projectileRuntime.direction,
      expiresAtTimeMs: projectileRuntime.expiresAtTimeMs,
      ownerPlayerId: projectileRuntime.ownerPlayerId,
      position: createProjectilePositionSnapshot(projectileRuntime),
      projectileId: projectileRuntime.projectileId,
      resolution: projectileRuntime.resolution,
      resolvedAtTimeMs: projectileRuntime.resolvedAtTimeMs,
      resolvedHitZone: projectileRuntime.resolvedHitZone,
      resolvedPlayerId: projectileRuntime.resolvedPlayerId,
      sourceActionSequence: projectileRuntime.sourceActionSequence,
      spawnedAtTimeMs: projectileRuntime.spawnedAtTimeMs,
      velocityMetersPerSecond: projectileRuntime.velocityMetersPerSecond,
      weaponId: projectileRuntime.weaponId
    };
  }

  #ensurePlayerCombatState(
    playerRuntime: PlayerRuntime
  ): MutableMetaverseCombatPlayerRuntimeState {
    const existingCombatState =
      this.#playerCombatStateByPlayerId.get(playerRuntime.playerId) ?? null;

    if (existingCombatState !== null) {
      existingCombatState.activeWeaponId = this.#resolveActiveWeaponId(
        playerRuntime,
        existingCombatState.activeWeaponId
      );
      this.#ensureWeaponRuntimeState(
        existingCombatState,
        existingCombatState.activeWeaponId
      );

      return existingCombatState;
    }

    const nextCombatState: MutableMetaverseCombatPlayerRuntimeState = {
      activeWeaponId: this.#resolveActiveWeaponId(playerRuntime, null),
      alive: true,
      assists: 0,
      damageLedgerByAttackerId: new Map(),
      deaths: 0,
      headshotKills: 0,
      highestProcessedPlayerActionSequence: 0,
      health: 100,
      kills: 0,
      lastFireAtMs: Number.NEGATIVE_INFINITY,
      maxHealth: 100,
      playerActionReceiptSequenceOrder: [],
      recentPlayerActionReceiptsBySequence: new Map(),
      respawnRemainingMs: 0,
      spawnProtectionRemainingMs:
        this.#matchState.phase === "active" ? spawnProtectionDurationMs : 0,
      weaponsById: new Map()
    };

    this.#ensureWeaponRuntimeState(nextCombatState, nextCombatState.activeWeaponId);
    this.#playerCombatStateByPlayerId.set(playerRuntime.playerId, nextCombatState);

    return nextCombatState;
  }

  #ensureWeaponRuntimeState(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    weaponId: string
  ): MutableMetaverseCombatWeaponRuntimeState {
    const existingWeaponState = combatState.weaponsById.get(weaponId) ?? null;

    if (existingWeaponState !== null) {
      return existingWeaponState;
    }

    const weaponProfile = readMetaverseCombatWeaponProfile(weaponId);
    const nextWeaponState: MutableMetaverseCombatWeaponRuntimeState = {
      ammoInMagazine: weaponProfile.magazine.magazineCapacity,
      ammoInReserve: weaponProfile.magazine.reserveCapacity,
      reloadRemainingMs: 0,
      shotsFired: 0,
      shotsHit: 0,
      weaponId
    };

    combatState.weaponsById.set(weaponId, nextWeaponState);

    return nextWeaponState;
  }

  #pruneMissingPlayerCombatState(): void {
    for (const playerId of this.#playerCombatStateByPlayerId.keys()) {
      if (!this.#dependencies.playersById.has(playerId)) {
        this.#playerCombatStateByPlayerId.delete(playerId);
        this.#hurtVolumeHistoryByPlayerId.delete(playerId);
      }
    }
  }

  #pruneResolvedProjectiles(nowMs: number): void {
    for (const [projectileId, projectileRuntime] of this.#projectilesById) {
      if (
        projectileRuntime.resolution !== "active" &&
        (projectileRuntime.resolvedAtTimeMs ?? nowMs) +
          projectileRetentionAfterResolutionMs <=
          nowMs
      ) {
        this.#projectilesById.delete(projectileId);
      }
    }
  }

  #resolveActiveWeaponId(
    playerRuntime: PlayerRuntime,
    requestedWeaponId: string | null
  ): string {
    const candidateWeaponId =
      requestedWeaponId ??
      playerRuntime.weaponState?.weaponId ??
      defaultCombatWeaponId;

    return readMetaverseCombatWeaponProfile(candidateWeaponId).weaponId;
  }

  #resolveProjectile(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState,
    resolution: MetaverseCombatProjectileSnapshot["resolution"],
    resolvedPlayerId: MetaversePlayerId | null,
    resolvedHitZone: MetaverseCombatProjectileSnapshot["resolvedHitZone"],
    nowMs: number
  ): void {
    projectileRuntime.resolution = resolution;
    projectileRuntime.resolvedAtTimeMs = nowMs;
    projectileRuntime.resolvedHitZone = resolvedHitZone;
    projectileRuntime.resolvedPlayerId = resolvedPlayerId;
  }

  #respawnPlayer(
    playerRuntime: PlayerRuntime,
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    nowMs: number
  ): void {
    const respawnPose = this.#dependencies.resolveRespawnPose(
      playerRuntime.playerId,
      playerRuntime.teamId
    );

    this.#dependencies.clearDriverVehicleControl(playerRuntime.playerId);
    this.#dependencies.clearPlayerTraversalIntent(playerRuntime.playerId);
    this.#dependencies.clearPlayerVehicleOccupancy(playerRuntime.playerId);
    playerRuntime.linearVelocityX = 0;
    playerRuntime.linearVelocityY = 0;
    playerRuntime.linearVelocityZ = 0;
    playerRuntime.locomotionMode = "grounded";
    playerRuntime.mountedOccupancy = null;
    playerRuntime.positionX = respawnPose.position.x;
    playerRuntime.positionY = respawnPose.position.y;
    playerRuntime.positionZ = respawnPose.position.z;
    playerRuntime.stateSequence += 1;
    playerRuntime.unmountedTraversalState = createMetaverseUnmountedTraversalStateSnapshot(
      {
        locomotionMode: "grounded"
      }
    );
    playerRuntime.yawRadians = respawnPose.yawRadians;
    playerRuntime.lookPitchRadians = 0;
    playerRuntime.lookYawRadians = respawnPose.yawRadians;
    combatState.alive = true;
    combatState.health = combatState.maxHealth;
    combatState.respawnRemainingMs = 0;
    combatState.spawnProtectionRemainingMs = spawnProtectionDurationMs;
    combatState.damageLedgerByAttackerId.clear();

    for (const weaponState of combatState.weaponsById.values()) {
      const weaponProfile = readMetaverseCombatWeaponProfile(weaponState.weaponId);

      weaponState.ammoInMagazine = weaponProfile.magazine.magazineCapacity;
      weaponState.ammoInReserve = weaponProfile.magazine.reserveCapacity;
      weaponState.reloadRemainingMs = 0;
    }

    this.#dependencies.syncPlayerTraversalBodyRuntimes(playerRuntime, true);
    this.#dependencies.syncPlayerTraversalAuthorityState(playerRuntime);
    this.#dependencies.syncAuthoritativePlayerLookToCurrentFacing(playerRuntime);
    this.#feedEvents.push({
      playerId: playerRuntime.playerId,
      sequence: ++this.#feedSequence,
      teamId: playerRuntime.teamId,
      timeMs: nowMs,
      type: "spawn"
    });
    this.#trimFeedEvents();
  }

  #preparePlayerForMatchStart(
    combatState: MutableMetaverseCombatPlayerRuntimeState
  ): void {
    combatState.alive = true;
    combatState.health = combatState.maxHealth;
    combatState.respawnRemainingMs = 0;
    combatState.spawnProtectionRemainingMs = spawnProtectionDurationMs;
    combatState.damageLedgerByAttackerId.clear();

    for (const weaponState of combatState.weaponsById.values()) {
      const weaponProfile = readMetaverseCombatWeaponProfile(weaponState.weaponId);

      weaponState.ammoInMagazine = weaponProfile.magazine.magazineCapacity;
      weaponState.ammoInReserve = weaponProfile.magazine.reserveCapacity;
      weaponState.reloadRemainingMs = 0;
    }
  }

  #startMatch(nowMs: number): void {
    this.#matchState.completedAtTimeMs = null;
    this.#matchState.phase = "active";
    this.#matchState.startedAtTimeMs = nowMs;
    this.#matchState.teamScoresByTeamId.set("red", 0);
    this.#matchState.teamScoresByTeamId.set("blue", 0);
    this.#matchState.timeRemainingMs = this.#matchState.timeLimitMs;
    this.#matchState.winnerTeamId = null;
    this.#feedEvents.length = 0;
    this.#feedSequence = 0;
    this.#hurtVolumeHistoryByPlayerId.clear();
    this.#projectilesById.clear();

    for (const playerRuntime of this.#dependencies.playersById.values()) {
      const combatState = this.#ensurePlayerCombatState(playerRuntime);

      combatState.assists = 0;
      combatState.deaths = 0;
      combatState.headshotKills = 0;
      combatState.kills = 0;
      combatState.lastFireAtMs = Number.NEGATIVE_INFINITY;
      combatState.highestProcessedPlayerActionSequence = 0;
      combatState.playerActionReceiptSequenceOrder.length = 0;
      combatState.recentPlayerActionReceiptsBySequence.clear();
      combatState.damageLedgerByAttackerId.clear();
      this.#preparePlayerForMatchStart(combatState);
    }
  }

  #publishFireWeaponActionReceipt(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    input: {
      readonly actionSequence: number;
      readonly nowMs: number;
      readonly reason?:
        | MetaversePlayerActionFireWeaponRejectionReasonId
        | undefined;
      readonly sourceProjectileId?: string | null | undefined;
      readonly weaponId: string;
    }
  ): void {
    this.#storePlayerActionReceipt(
      combatState,
      createMetaversePlayerActionReceiptSnapshot({
        actionSequence: input.actionSequence,
        kind: "fire-weapon",
        processedAtTimeMs: input.nowMs,
        ...(input.reason === undefined
          ? {
              status: "accepted"
            }
          : {
              rejectionReason: input.reason,
              status: "rejected"
            }),
        ...(input.sourceProjectileId === undefined
          ? {}
          : {
              sourceProjectileId: input.sourceProjectileId
            }),
        weaponId: input.weaponId
      })
    );
  }

  #storePlayerActionReceipt(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    receiptSnapshot: MetaversePlayerActionReceiptSnapshot
  ): void {
    combatState.highestProcessedPlayerActionSequence = Math.max(
      combatState.highestProcessedPlayerActionSequence,
      receiptSnapshot.actionSequence
    );

    if (
      !combatState.recentPlayerActionReceiptsBySequence.has(
        receiptSnapshot.actionSequence
      )
    ) {
      combatState.playerActionReceiptSequenceOrder.push(
        receiptSnapshot.actionSequence
      );
    }

    combatState.recentPlayerActionReceiptsBySequence.set(
      receiptSnapshot.actionSequence,
      receiptSnapshot
    );

    while (
      combatState.playerActionReceiptSequenceOrder.length >
      combatPlayerActionDedupeCacheMaxEntries
    ) {
      const retiredSequence = combatState.playerActionReceiptSequenceOrder.shift();

      if (retiredSequence !== undefined) {
        combatState.recentPlayerActionReceiptsBySequence.delete(retiredSequence);
      }
    }

    this.#dependencies.incrementSnapshotSequence();
  }

  #readProcessedPlayerActionReceipt(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    actionSequence: number
  ): MetaversePlayerActionReceiptSnapshot | null {
    return combatState.recentPlayerActionReceiptsBySequence.get(actionSequence) ?? null;
  }

  #createCurrentPlayerHurtVolumes(
    playerRuntime: PlayerRuntime
  ): MetaversePlayerCombatHurtVolumesSnapshot {
    return createMetaversePlayerCombatHurtVolumes({
      activeBodyPosition: createPlayerBodyPositionSnapshot(playerRuntime),
      ...(this.#dependencies.hurtVolumeConfig === undefined
        ? {}
        : {
            config: this.#dependencies.hurtVolumeConfig
          })
    });
  }

  #recordHurtVolumeHistory(nowMs: number): void {
    if (this.#dependencies.authoritativeCombatRewindEnabled !== true) {
      return;
    }

    const minRetainedSimulationTimeMs = Math.max(
      0,
      nowMs - combatHurtVolumeHistoryWindowMs
    );

    for (const playerRuntime of this.#dependencies.playersById.values()) {
      const samples =
        this.#hurtVolumeHistoryByPlayerId.get(playerRuntime.playerId) ?? [];
      const nextSample: MetaversePlayerHurtVolumeHistorySample = {
        hurtVolumes: this.#createCurrentPlayerHurtVolumes(playerRuntime),
        playerId: playerRuntime.playerId,
        simulationTimeMs: nowMs
      };
      const latestSample = samples[samples.length - 1] ?? null;

      if (latestSample !== null && latestSample.simulationTimeMs === nowMs) {
        samples[samples.length - 1] = nextSample;
      } else {
        samples.push(nextSample);
      }

      while (
        samples.length > 0 &&
        samples[0]!.simulationTimeMs < minRetainedSimulationTimeMs
      ) {
        samples.shift();
      }

      this.#hurtVolumeHistoryByPlayerId.set(playerRuntime.playerId, samples);
    }
  }

  #readHistoricalHurtVolumes(
    playerId: MetaversePlayerId,
    issuedAtTimeMs: number
  ): MetaversePlayerCombatHurtVolumesSnapshot | null {
    const samples = this.#hurtVolumeHistoryByPlayerId.get(playerId) ?? null;

    if (samples === null || samples.length === 0) {
      return null;
    }

    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]!;

      if (sample.simulationTimeMs <= issuedAtTimeMs) {
        return sample.hurtVolumes;
      }
    }

    return samples[0]?.hurtVolumes ?? null;
  }

  #startReloadIfNeeded(
    weaponState: MutableMetaverseCombatWeaponRuntimeState,
    weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
  ): void {
    if (
      weaponState.reloadRemainingMs > 0 ||
      weaponState.ammoInReserve <= 0 ||
      weaponState.ammoInMagazine >= weaponProfile.magazine.magazineCapacity
    ) {
      return;
    }

    weaponState.reloadRemainingMs = Number(weaponProfile.magazine.reloadDurationMs);
  }

  #trimFeedEvents(): void {
    if (this.#feedEvents.length <= 32) {
      return;
    }

    this.#feedEvents.splice(0, this.#feedEvents.length - 32);
  }
}
