import {
  createMetaverseCombatEventSnapshot,
  createMetaversePlayerActionReceiptSnapshot,
  createMetaverseCombatFeedEventSnapshot,
  createMetaverseCombatMatchSnapshot,
  createMetaverseCombatProjectileSnapshot,
  createMetaverseCombatAimSnapshot,
  createMetaversePlayerCombatHurtVolumes,
  createMetaversePlayerCombatSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  createMetaverseWeaponInstanceId,
  readMetaverseCombatWeaponProfile,
  resolveMetaverseCombatClosestHurtVolumePoint,
  resolveMetaverseCombatHitForSegment,
  resolveMetaverseCombatSemanticWeaponTipFrame,
  tryReadMetaverseCombatWeaponProfile,
  type MetaverseCombatAimSnapshot,
  type MetaverseCombatEventSnapshot,
  type MetaverseCombatEventSnapshotInput,
  type MetaverseCombatFeedEventSnapshotInput,
  type MetaverseCombatHitZoneId,
  type MetaverseCombatHurtRegionId,
  type MetaverseCombatImpactSurfaceSnapshotInput,
  type MetaverseCombatMatchSnapshot,
  type MetaverseCombatPlayerWeaponSnapshotInput,
  type MetaverseCombatProjectileSnapshot,
  type MetaverseCombatProjectileSnapshotInput,
  type MetaverseCombatProjectileResolutionId,
  type MetaverseCombatShotResolutionFinalReasonId,
  type MetaverseCombatWeaponPresentationDeliveryModelId,
  type MetaverseFireWeaponPlayerActionSnapshot,
  type MetaverseInteractWeaponResourcePlayerActionSnapshot,
  type MetaverseIssuePlayerActionCommand,
  type MetaverseMatchModeId,
  type MetaversePlayerActionFireWeaponRejectionReasonId,
  type MetaversePlayerActionInteractWeaponResourceRejectionReasonId,
  type MetaversePlayerActionSwitchWeaponSlotRejectionReasonId,
  type MetaversePlayerActionReceiptSnapshot,
  type MetaversePlayerCombatHurtVolumeConfig,
  type MetaversePlayerCombatHurtVolumesSnapshot,
  type MetaversePlayerCombatSnapshot,
  type MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot
} from "@webgpu-metaverse/shared";
import type {
  MetaversePlayerId,
  MetaversePlayerTeamId
} from "@webgpu-metaverse/shared/metaverse/presence";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot,
  type MetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import type {
  MetaverseMapBundleResourceSpawnSnapshot,
  MetaverseMapBundleSemanticGameplayVolumeSnapshot
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle
} from "../../types/metaverse-authoritative-rapier.js";
import type { MetaverseAuthoritativeRapierPhysicsRuntime } from "../../classes/metaverse-authoritative-rapier-physics-runtime.js";

type MetaverseCombatShotResolutionRewindSourceId =
  | "current"
  | "history"
  | "none";

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
  lastFireAtMs: number;
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
  maxHealth: number;
  readonly playerId: MetaversePlayerId;
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
  readonly aimTargetWorld: PhysicsVector3Snapshot;
  readonly cameraRayForwardWorld: PhysicsVector3Snapshot;
  readonly cameraRayOriginWorld: PhysicsVector3Snapshot;
  readonly direction: PhysicsVector3Snapshot;
  expiresAtTimeMs: number;
  readonly ownerPlayerId: MetaversePlayerId;
  readonly presentationDeliveryModel: MetaverseCombatWeaponPresentationDeliveryModelId;
  positionX: number;
  positionY: number;
  positionZ: number;
  readonly projectileId: string;
  resolution: MetaverseCombatProjectileResolutionId;
  resolvedAtTimeMs: number | null;
  resolvedHitZone: MetaverseCombatHitZoneId | null;
  resolvedPlayerId: MetaversePlayerId | null;
  readonly sourceActionSequence: number;
  readonly semanticMuzzleWorld: PhysicsVector3Snapshot;
  spawnedAtTimeMs: number;
  readonly velocityMetersPerSecond: number;
  readonly weaponId: string;
}

interface MetaverseCombatRaycastHitSnapshot {
  readonly collider: RapierColliderHandle;
  readonly distanceMeters: number;
  readonly normal: PhysicsVector3Snapshot | null;
  readonly point: PhysicsVector3Snapshot;
}

interface MetaverseCombatResolvedPlayerHit {
  readonly distanceMeters: number;
  readonly hitZone: "body" | "head";
  readonly point: PhysicsVector3Snapshot;
  readonly regionId: MetaverseCombatHurtRegionId;
  readonly rewindSource: MetaverseCombatShotResolutionRewindSourceId;
  readonly targetPlayerId: MetaversePlayerId;
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
  readonly matchMode?: MetaverseMatchModeId | null;
  readonly physicsRuntime: MetaverseAuthoritativeRapierPhysicsRuntime;
  readonly playerTraversalColliderHandles: ReadonlySet<RapierColliderHandle>;
  readonly playersById: ReadonlyMap<MetaversePlayerId, PlayerRuntime>;
  readonly readCurrentTick?: () => number;
  readonly readWorldImpactSurface?: (
    collider: RapierColliderHandle
  ) => MetaverseCombatImpactSurfaceSnapshotInput | null;
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
const combatEventJournalMaxEntries = 64;
const combatPlayerActionDedupeCacheMaxEntries = 16;
const combatRewindWindowMs = 200;
const combatHurtVolumeHistoryWindowMs = 200;
const combatRayOriginMaxDistanceFromFiringReferenceMeters = 3;
const combatSplashLineOfSightOriginBiasMeters = 0.08;
const combatDroppedWeaponPickupRadiusMeters = 1.4;
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

function createImpactNormalFromIncomingDirection(
  direction: PhysicsVector3Snapshot
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(-direction.x, -direction.y, -direction.z);
}

function createFinitePhysicsVector3Snapshot(
  vector: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">
): PhysicsVector3Snapshot | null {
  if (
    !Number.isFinite(vector.x) ||
    !Number.isFinite(vector.y) ||
    !Number.isFinite(vector.z)
  ) {
    return null;
  }

  return createPhysicsVector3Snapshot(vector.x, vector.y, vector.z);
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

function createCrossProductVector(
  left: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  right: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x
  );
}

function resolveWeaponTriggerShotCount(
  weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
): number {
  return weaponProfile.fireMode === "burst"
    ? Math.max(1, weaponProfile.burst?.roundsPerBurst ?? 3)
    : 1;
}

function resolveWeaponTriggerProjectileCount(
  weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
): number {
  return Math.max(1, Math.trunc(weaponProfile.damage.pelletsPerShot));
}

function resolveWeaponHitscanProjectileDirection(
  direction: PhysicsVector3Snapshot,
  weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>,
  projectileIndex: number,
  projectileCount: number
): PhysicsVector3Snapshot {
  if (
    projectileIndex <= 0 ||
    projectileCount <= 1 ||
    weaponProfile.accuracy.spreadDegrees <= 0
  ) {
    return direction;
  }

  const spreadRadians =
    (weaponProfile.accuracy.spreadDegrees * Math.PI) / 180;
  const spreadSampleCount = Math.max(1, projectileCount - 1);
  const spreadSampleIndex = projectileIndex - 1;
  const referenceUp =
    Math.abs(direction.y) > 0.96
      ? createPhysicsVector3Snapshot(1, 0, 0)
      : createPhysicsVector3Snapshot(0, 1, 0);
  const right = normalizeDirection(
    createCrossProductVector(referenceUp, direction)
  );

  if (right === null) {
    return direction;
  }

  const up = normalizeDirection(createCrossProductVector(direction, right));

  if (up === null) {
    return direction;
  }

  const goldenAngleRadians = Math.PI * (3 - Math.sqrt(5));
  const radius =
    Math.sqrt((spreadSampleIndex + 0.5) / spreadSampleCount) *
    Math.tan(spreadRadians);
  const angle = spreadSampleIndex * goldenAngleRadians;
  const horizontalOffset = Math.cos(angle) * radius;
  const verticalOffset = Math.sin(angle) * radius;

  return (
    normalizeDirection({
      x: direction.x + right.x * horizontalOffset + up.x * verticalOffset,
      y: direction.y + right.y * horizontalOffset + up.y * verticalOffset,
      z: direction.z + right.z * horizontalOffset + up.z * verticalOffset
    }) ?? direction
  );
}

function resolveWeaponBurstRoundIntervalMs(
  weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
): number {
  return weaponProfile.fireMode === "burst"
    ? Math.max(0, Number(weaponProfile.burst?.roundIntervalMs ?? 90))
    : 0;
}

function resolveWeaponTriggerCooldownMs(
  weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>
): number {
  if (weaponProfile.roundsPerMinute <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (weaponProfile.fireMode !== "burst") {
    return 60_000 / weaponProfile.roundsPerMinute;
  }

  return Math.max(
    60_000 / weaponProfile.roundsPerMinute,
    resolveWeaponBurstRoundIntervalMs(weaponProfile) *
      resolveWeaponTriggerShotCount(weaponProfile)
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
  readonly #combatEvents: MetaverseCombatEventSnapshotInput[] = [];
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
  readonly #matchMode: MetaverseMatchModeId | null;

  #combatEventSequence = 0;
  #feedSequence = 0;

  constructor(
    dependencies: MetaverseAuthoritativeCombatAuthorityDependencies<PlayerRuntime>
  ) {
    this.#dependencies = dependencies;
    this.#matchMode =
      dependencies.matchMode === undefined
        ? "team-deathmatch"
        : dependencies.matchMode;
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
      case "interact-weapon-resource":
        this.acceptInteractWeaponResourceAction({
          action: command.action,
          nowMs: normalizedNowMs,
          playerRuntime,
          resourceSpawn: null
        });
        break;
      case "jump":
        break;
      case "switch-active-weapon-slot":
        this.#acceptSwitchActiveWeaponSlotAction(
          command.playerId,
          command.action,
          normalizedNowMs,
          playerRuntime
        );
        break;
      default: {
        const exhaustiveAction: never = command.action;

        throw new Error(
          `Unsupported metaverse player action kind: ${exhaustiveAction}`
        );
      }
    }
  }

  acceptInteractWeaponResourceAction(input: {
    readonly action: MetaverseInteractWeaponResourcePlayerActionSnapshot;
    readonly nowMs: number;
    readonly playerRuntime: PlayerRuntime;
    readonly resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot | null;
  }): {
    readonly accepted: boolean;
    readonly consumeResourceSpawn?: boolean;
    readonly droppedResourceSpawn?: MetaverseMapBundleResourceSpawnSnapshot | null;
  } {
    const combatState = this.#ensurePlayerCombatState(input.playerRuntime);
    const duplicateReceipt = this.#readProcessedPlayerActionReceipt(
      combatState,
      input.action.actionSequence
    );

    if (duplicateReceipt !== null) {
      return { accepted: false };
    }

    const oldestRetainedReceiptSequence =
      combatState.playerActionReceiptSequenceOrder[0] ?? null;

    if (
      oldestRetainedReceiptSequence !== null &&
      input.action.actionSequence < oldestRetainedReceiptSequence &&
      input.action.actionSequence <=
        combatState.highestProcessedPlayerActionSequence
    ) {
      return { accepted: false };
    }

    if (this.#matchState.phase !== "active") {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "match-inactive",
        weaponState: input.playerRuntime.weaponState
      });
      return { accepted: false };
    }

    if (!combatState.alive || input.playerRuntime.mountedOccupancy !== null) {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: combatState.alive ? "mounted" : "player-dead",
        weaponState: input.playerRuntime.weaponState
      });
      return { accepted: false };
    }

    const weaponState = input.playerRuntime.weaponState;
    const activeSlot =
      weaponState === null
        ? null
        : weaponState.slots.find(
            (slot) => slot.slotId === weaponState.activeSlotId && slot.equipped
          ) ?? null;

    if (weaponState === null || activeSlot === null) {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "no-active-weapon",
        weaponState
      });
      return { accepted: false };
    }

    if (
      input.action.requestedActiveSlotId !== null &&
      input.action.requestedActiveSlotId !== activeSlot.slotId
    ) {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "stale-weapon-state",
        weaponState
      });
      return { accepted: false };
    }

    if (
      input.action.intendedWeaponInstanceId !== null &&
      input.action.intendedWeaponInstanceId !== activeSlot.weaponInstanceId
    ) {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "stale-weapon-state",
        weaponState
      });
      return { accepted: false };
    }

    if (input.resourceSpawn === null) {
      const equippedSlots = weaponState.slots.filter((slot) => slot.equipped);

      if (equippedSlots.length <= 1) {
        this.#publishInteractWeaponResourceActionReceipt(combatState, {
          action: input.action,
          nowMs: input.nowMs,
          reason: "last-weapon",
          weaponState
        });
        return { accepted: false };
      }

      const nextActiveSlot =
        equippedSlots.find((slot) => slot.slotId !== activeSlot.slotId) ?? null;

      if (nextActiveSlot === null) {
        this.#publishInteractWeaponResourceActionReceipt(combatState, {
          action: input.action,
          nowMs: input.nowMs,
          reason: "no-active-weapon",
          weaponState
        });
        return { accepted: false };
      }

      const nextWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
        activeSlotId: nextActiveSlot.slotId,
        aimMode: "hip-fire",
        slots: weaponState.slots.map((slot) =>
          slot.slotId === activeSlot.slotId
            ? {
                ...slot,
                equipped: false
              }
            : slot
        ),
        weaponId: nextActiveSlot.weaponId
      });
      const droppedResourceSpawn = this.#createDroppedWeaponResourceSpawn(
        input.playerRuntime,
        input.action,
        activeSlot,
        combatState
      );

      input.playerRuntime.weaponState = nextWeaponState;
      combatState.activeWeaponId = nextActiveSlot.weaponId;
      this.#ensureWeaponRuntimeState(combatState, nextActiveSlot.weaponId);
      this.#dependencies.incrementSnapshotSequence();
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        droppedWeaponId: activeSlot.weaponId,
        nowMs: input.nowMs,
        weaponState: nextWeaponState
      });

      return {
        accepted: true,
        droppedResourceSpawn
      };
    }

    if (input.resourceSpawn.resourceKind !== "weapon-pickup") {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "no-resource",
        weaponState
      });
      return { accepted: false };
    }

    const pickedUpWeaponProfile = tryReadMetaverseCombatWeaponProfile(
      input.resourceSpawn.weaponId
    );

    if (pickedUpWeaponProfile === null) {
      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        reason: "unknown-weapon",
        weaponState
      });
      return { accepted: false };
    }

    const alreadyEquippedSlot =
      weaponState.slots.find(
        (slot) => slot.equipped && slot.weaponId === input.resourceSpawn?.weaponId
      ) ?? null;

    if (alreadyEquippedSlot !== null) {
      if (
        !this.grantWeaponResourcePickup(
          input.playerRuntime,
          input.resourceSpawn,
          input.nowMs
        )
      ) {
        this.#publishInteractWeaponResourceActionReceipt(combatState, {
          action: input.action,
          nowMs: input.nowMs,
          reason: "ammo-full",
          weaponState
        });
        return { accepted: false };
      }

      this.#publishInteractWeaponResourceActionReceipt(combatState, {
        action: input.action,
        nowMs: input.nowMs,
        pickedUpWeaponId: input.resourceSpawn.weaponId,
        weaponState
      });

      return {
        accepted: true,
        consumeResourceSpawn: true
      };
    }

    const unequippedSlot =
      weaponState.slots.find((slot) => !slot.equipped) ?? null;
    const targetSlot = unequippedSlot ?? activeSlot;
    const nextWeaponSlot = {
      attachmentId: input.resourceSpawn.assetId ?? input.resourceSpawn.weaponId,
      equipped: true,
      slotId: targetSlot.slotId,
      weaponId: input.resourceSpawn.weaponId,
      weaponInstanceId: createMetaverseWeaponInstanceId(
        input.playerRuntime.playerId,
        targetSlot.slotId,
        input.resourceSpawn.weaponId
      )
    };
    const droppedResourceSpawn =
      unequippedSlot === null
        ? this.#createDroppedWeaponResourceSpawn(
            input.playerRuntime,
            input.action,
            activeSlot,
            combatState
          )
        : null;
    const nextWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
      activeSlotId: targetSlot.slotId,
      aimMode: "hip-fire",
      slots: weaponState.slots.map((slot) =>
        slot.slotId === targetSlot.slotId ? nextWeaponSlot : slot
      ),
      weaponId: input.resourceSpawn.weaponId
    });

    input.playerRuntime.weaponState = nextWeaponState;
    combatState.activeWeaponId = input.resourceSpawn.weaponId;
    this.#ensureWeaponRuntimeState(combatState, input.resourceSpawn.weaponId);
    this.#dependencies.incrementSnapshotSequence();
    this.#publishInteractWeaponResourceActionReceipt(combatState, {
      action: input.action,
      droppedWeaponId: droppedResourceSpawn?.weaponId ?? null,
      nowMs: input.nowMs,
      pickedUpWeaponId: input.resourceSpawn.weaponId,
      weaponState: nextWeaponState
    });

    return {
      accepted: true,
      consumeResourceSpawn: true,
      droppedResourceSpawn
    };
  }

  #acceptSwitchActiveWeaponSlotAction(
    _playerId: MetaversePlayerId,
    action: MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot,
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

    const weaponState = playerRuntime.weaponState;
    const requestedSlot =
      weaponState?.slots.find(
        (slot) => slot.slotId === action.requestedActiveSlotId
      ) ?? null;

    if (weaponState === null || requestedSlot === null) {
      this.#publishSwitchActiveWeaponSlotActionReceipt(combatState, {
        action,
        nowMs,
        reason: "unknown-slot",
        weaponState
      });
      return;
    }

    if (!requestedSlot.equipped) {
      this.#publishSwitchActiveWeaponSlotActionReceipt(combatState, {
        action,
        nowMs,
        reason: "unequipped-slot",
        weaponState
      });
      return;
    }

    if (
      action.intendedWeaponInstanceId !== null &&
      requestedSlot.weaponInstanceId !== action.intendedWeaponInstanceId
    ) {
      this.#publishSwitchActiveWeaponSlotActionReceipt(combatState, {
        action,
        nowMs,
        reason: "stale-weapon-state",
        weaponState
      });
      return;
    }

    const nextWeaponState = createMetaverseRealtimePlayerWeaponStateSnapshot({
      activeSlotId: requestedSlot.slotId,
      aimMode: "hip-fire",
      slots: weaponState.slots,
      weaponId: requestedSlot.weaponId
    });
    const weaponStateChanged =
      weaponState.activeSlotId !== nextWeaponState.activeSlotId ||
      weaponState.aimMode !== nextWeaponState.aimMode ||
      weaponState.weaponId !== nextWeaponState.weaponId;

    playerRuntime.weaponState = nextWeaponState;
    combatState.activeWeaponId = requestedSlot.weaponId;
    this.#ensureWeaponRuntimeState(combatState, requestedSlot.weaponId);

    if (weaponStateChanged) {
      this.#dependencies.incrementSnapshotSequence();
    }

    this.#publishSwitchActiveWeaponSlotActionReceipt(combatState, {
      action,
      nowMs,
      weaponState: nextWeaponState
    });
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

    const activeWeaponId = this.#resolveActiveWeaponId(playerRuntime);
    const requestedWeaponKnown = this.#isWeaponEquipped(
      playerRuntime,
      action.weaponId
    );

    if (action.weaponId !== activeWeaponId) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: requestedWeaponKnown ? "inactive-weapon" : "unknown-weapon",
        weaponId: action.weaponId
      });
      return;
    }

    const weaponId = activeWeaponId;
    const weaponProfile = tryReadMetaverseCombatWeaponProfile(weaponId);

    if (weaponProfile === null) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: requestedWeaponKnown ? "no-combat-profile" : "unknown-weapon",
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

    const millisecondsPerShot = resolveWeaponTriggerCooldownMs(weaponProfile);

    if (nowMs - weaponState.lastFireAtMs + 0.0001 < millisecondsPerShot) {
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

    const firingReferenceOrigin = this.#createFireOrigin(
      playerRuntime,
      weaponProfile
    );
    const aimSnapshot = createMetaverseCombatAimSnapshot(action.aimSnapshot);
    const fireRay = this.#resolveFireRay(aimSnapshot, firingReferenceOrigin);

    if (fireRay.rejectionReason !== null) {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        reason: fireRay.rejectionReason,
        weaponId
      });
      return;
    }

    const triggerShotCount = Math.min(
      resolveWeaponTriggerShotCount(weaponProfile),
      weaponState.ammoInMagazine
    );
    const triggerShotIntervalMs = resolveWeaponBurstRoundIntervalMs(weaponProfile);
    const projectilesPerTriggerShot =
      weaponProfile.deliveryModel === "hitscan"
        ? resolveWeaponTriggerProjectileCount(weaponProfile)
        : 1;

    weaponState.ammoInMagazine -= triggerShotCount;
    weaponState.lastFireAtMs = nowMs;
    weaponState.shotsFired += triggerShotCount * projectilesPerTriggerShot;
    combatState.activeWeaponId = weaponId;

    const issuedAtTimeMs = this.#resolveIssuedAtAuthoritativeTimeMs(
      Number(action.issuedAtAuthoritativeTimeMs),
      nowMs
    );
    const semanticMuzzleWorld = this.#createSemanticWeaponTipOrigin({
      playerRuntime,
      semanticAimForward: fireRay.direction,
      weaponProfile
    });
    if (weaponProfile.deliveryModel === "hitscan") {
      this.#publishFireWeaponActionReceipt(combatState, {
        actionSequence: action.actionSequence,
        nowMs,
        sourceProjectileId: null,
        weaponId
      });

      for (let shotIndex = 0; shotIndex < triggerShotCount; shotIndex += 1) {
        const projectileBaseIndex = shotIndex * projectilesPerTriggerShot;
        const combatEventBase = this.#createCombatEventBase({
          actionSequence: action.actionSequence,
          playerRuntime,
          shotIndex: projectileBaseIndex,
          weaponId,
          weaponProfile
        });
        const shotIssuedAtTimeMs = Math.min(
          nowMs,
          issuedAtTimeMs + shotIndex * triggerShotIntervalMs
        );

        for (
          let projectileIndex = 0;
          projectileIndex < projectilesPerTriggerShot;
          projectileIndex += 1
        ) {
          const projectileEventBase =
            projectileIndex === 0
              ? combatEventBase
              : this.#createCombatEventBase({
                  actionSequence: action.actionSequence,
                  playerRuntime,
                  shotIndex: projectileBaseIndex + projectileIndex,
                  weaponId,
                  weaponProfile
                });

          this.#resolveHitscanFireAction({
            actionSequence: action.actionSequence,
            attackerPlayerId: playerId,
            direction: resolveWeaponHitscanProjectileDirection(
              fireRay.direction,
              weaponProfile,
              projectileIndex,
              projectilesPerTriggerShot
            ),
            firingReferenceOrigin,
            combatState,
            issuedAtTimeMs: shotIssuedAtTimeMs,
            nowMs,
            origin: fireRay.origin,
            semanticMuzzleWorld,
            shotId: projectileEventBase.shotId,
            weaponId
          });
        }
      }
    } else {
      const combatEventBase = this.#createCombatEventBase({
        actionSequence: action.actionSequence,
        playerRuntime,
        weaponId,
        weaponProfile
      });

      const projectileLaunch = this.#resolveProjectileLaunch({
        attackerPlayerId: playerId,
        cameraRayDirection: fireRay.direction,
        cameraRayOrigin: fireRay.origin,
        firingReferenceOrigin: semanticMuzzleWorld,
        issuedAtTimeMs,
        weaponProfile
      });

      this.#spawnProjectileFireAction({
        actionSequence: action.actionSequence,
        attackerPlayerId: playerId,
        aimTargetWorld: projectileLaunch.aimTargetWorld,
        cameraRayForwardWorld: fireRay.direction,
        cameraRayOriginWorld: fireRay.origin,
        combatState,
        direction: projectileLaunch.direction,
        eventBase: combatEventBase,
        issuedAtTimeMs,
        nowMs,
        origin: semanticMuzzleWorld,
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
    const yawRadians = Number.isFinite(playerRuntime.yawRadians)
      ? playerRuntime.yawRadians
      : 0;
    const forwardX = Math.sin(yawRadians);
    const forwardZ = -Math.cos(yawRadians);
    const rightX = Math.cos(yawRadians);
    const rightZ = Math.sin(yawRadians);
    const originOffset = weaponProfile.firingOriginOffset;

    return createPhysicsVector3Snapshot(
      playerRuntime.positionX +
        rightX * originOffset.rightMeters +
        forwardX * originOffset.forwardMeters,
      playerRuntime.positionY + originOffset.upMeters,
      playerRuntime.positionZ +
        rightZ * originOffset.rightMeters +
        forwardZ * originOffset.forwardMeters
    );
  }

  #createSemanticWeaponTipOrigin(input: {
    readonly playerRuntime: PlayerRuntime;
    readonly semanticAimForward: PhysicsVector3Snapshot;
    readonly weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;
  }): PhysicsVector3Snapshot {
    const frame = resolveMetaverseCombatSemanticWeaponTipFrame({
      actorBodyPosition: createPhysicsVector3Snapshot(
        input.playerRuntime.positionX,
        input.playerRuntime.positionY,
        input.playerRuntime.positionZ
      ),
      actorBodyYawRadians: input.playerRuntime.yawRadians,
      aimYawInfluence: 1,
      authoredMuzzleFromGrip:
        input.weaponProfile.projectilePresentation.authoredMuzzleFromGrip,
      firingOriginOffset: input.weaponProfile.firingOriginOffset,
      objectLocalMuzzleFrame:
        input.weaponProfile.projectilePresentation.objectLocalMuzzleFrame,
      objectLocalPrimaryGripFrame:
        input.weaponProfile.projectilePresentation.objectLocalPrimaryGripFrame,
      primaryGripAnchorOffset:
        input.weaponProfile.projectilePresentation.primaryGripAnchorOffset,
      semanticAimForward: input.semanticAimForward,
      semanticLaunchOriginOffset:
        input.weaponProfile.projectilePresentation.semanticLaunchOriginOffset
    });
    const origin = frame.originWorld;

    return createPhysicsVector3Snapshot(origin.x, origin.y, origin.z);
  }

  #resolveFireRay(
    aimSnapshot: MetaverseCombatAimSnapshot,
    firingReferenceOrigin: PhysicsVector3Snapshot
  ):
    | {
        readonly direction: PhysicsVector3Snapshot;
        readonly origin: PhysicsVector3Snapshot;
        readonly rejectionReason: null;
      }
    | {
        readonly rejectionReason: Extract<
          MetaversePlayerActionFireWeaponRejectionReasonId,
          "invalid-direction" | "invalid-origin"
        >;
      } {
    const hasRayOrigin = aimSnapshot.rayOriginWorld !== null;
    const hasRayForward = aimSnapshot.rayForwardWorld !== null;

    if (!hasRayOrigin) {
      return {
        rejectionReason: "invalid-origin"
      };
    }

    if (!hasRayForward) {
      return {
        rejectionReason: "invalid-direction"
      };
    }

    const origin = createFinitePhysicsVector3Snapshot(aimSnapshot.rayOriginWorld);

    if (origin === null) {
      return {
        rejectionReason: "invalid-origin"
      };
    }

    if (
      createDistanceBetweenPoints(origin, firingReferenceOrigin) >
      combatRayOriginMaxDistanceFromFiringReferenceMeters
    ) {
      return {
        rejectionReason: "invalid-origin"
      };
    }

    const direction = normalizeDirection(aimSnapshot.rayForwardWorld);

    if (direction === null) {
      return {
        rejectionReason: "invalid-direction"
      };
    }

    return {
      direction,
      origin,
      rejectionReason: null
    };
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

  #resolveProjectileLaunch(input: {
    readonly attackerPlayerId: MetaversePlayerId;
    readonly cameraRayDirection: PhysicsVector3Snapshot;
    readonly cameraRayOrigin: PhysicsVector3Snapshot;
    readonly firingReferenceOrigin: PhysicsVector3Snapshot;
    readonly issuedAtTimeMs: number;
    readonly weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;
  }): {
    readonly aimTargetWorld: PhysicsVector3Snapshot;
    readonly direction: PhysicsVector3Snapshot;
  } {
    const maxDistanceMeters = this.#resolveFireRangeMeters(input.weaponProfile);
    const worldHit = this.#dependencies.physicsRuntime.castRay(
      input.cameraRayOrigin,
      input.cameraRayDirection,
      maxDistanceMeters,
      (collider) => !this.#dependencies.playerTraversalColliderHandles.has(collider)
    );
    const cameraRayEnd = createOffsetVector(
      input.cameraRayOrigin,
      input.cameraRayDirection,
      maxDistanceMeters
    );
    const closestPlayerHit = this.#readClosestDamageablePlayerHitForSegment({
      attackerPlayerId: input.attackerPlayerId,
      issuedAtTimeMs: input.issuedAtTimeMs,
      segmentEnd: cameraRayEnd,
      segmentStart: input.cameraRayOrigin
    });
    const aimTarget =
      worldHit !== null &&
      (closestPlayerHit === null ||
        worldHit.distanceMeters < closestPlayerHit.distanceMeters)
        ? worldHit.point
        : closestPlayerHit === null
          ? cameraRayEnd
          : closestPlayerHit.point;
    const convergedDirection = normalizeDirection({
      x: aimTarget.x - input.firingReferenceOrigin.x,
      y: aimTarget.y - input.firingReferenceOrigin.y,
      z: aimTarget.z - input.firingReferenceOrigin.z
    });
    const launchForward = convergedDirection ?? input.cameraRayDirection;

    return {
      aimTargetWorld: aimTarget,
      direction: launchForward
    };
  }

  #readClosestDamageablePlayerHitForSegment(input: {
    readonly attackerPlayerId: MetaversePlayerId;
    readonly issuedAtTimeMs: number;
    readonly segmentEnd: PhysicsVector3Snapshot;
    readonly segmentStart: PhysicsVector3Snapshot;
  }): MetaverseCombatResolvedPlayerHit | null {
    let closestPlayerHit: MetaverseCombatResolvedPlayerHit | null = null;

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

      const hurtVolumesResult = this.#readPlayerHurtVolumesForFire(
        targetRuntime,
        input.issuedAtTimeMs
      );
      const hitResolution = resolveMetaverseCombatHitForSegment(
        input.segmentStart,
        input.segmentEnd,
        hurtVolumesResult.hurtVolumes
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
          regionId: hitResolution.regionId,
          rewindSource: hurtVolumesResult.rewindSource,
          targetPlayerId: targetRuntime.playerId
        };
      }
    }

    return closestPlayerHit;
  }

  #spawnProjectileFireAction(input: {
    readonly actionSequence: number;
    readonly attackerPlayerId: MetaversePlayerId;
    readonly aimTargetWorld: PhysicsVector3Snapshot;
    readonly cameraRayForwardWorld: PhysicsVector3Snapshot;
    readonly cameraRayOriginWorld: PhysicsVector3Snapshot;
    readonly combatState: MutableMetaverseCombatPlayerRuntimeState;
    readonly direction: PhysicsVector3Snapshot;
    readonly eventBase: Pick<
      MetaverseCombatEventSnapshotInput,
      | "actionSequence"
      | "activeSlotId"
      | "playerId"
      | "presentationDeliveryModel"
      | "weaponId"
      | "weaponInstanceId"
    > & {
      readonly shotId: string;
    };
    readonly issuedAtTimeMs: number;
    readonly nowMs: number;
    readonly origin: PhysicsVector3Snapshot;
    readonly weaponId: string;
    readonly weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;
  }): void {
    const projectileId = input.eventBase.shotId;
    const projectileRuntime: MutableMetaverseCombatProjectileRuntimeState = {
      aimTargetWorld: input.aimTargetWorld,
      cameraRayForwardWorld: input.cameraRayForwardWorld,
      cameraRayOriginWorld: input.cameraRayOriginWorld,
      direction: input.direction,
      expiresAtTimeMs:
        input.issuedAtTimeMs +
        Number(input.weaponProfile.accuracy.projectileLifetimeMs),
      ownerPlayerId: input.attackerPlayerId,
      presentationDeliveryModel: input.weaponProfile.presentationDeliveryModel,
      positionX: input.origin.x,
      positionY: input.origin.y,
      positionZ: input.origin.z,
      projectileId,
      resolution: "active",
      resolvedAtTimeMs: null,
      resolvedHitZone: null,
      resolvedPlayerId: null,
      sourceActionSequence: input.actionSequence,
      semanticMuzzleWorld: input.origin,
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

    this.#storeCombatEvent({
      ...input.eventBase,
      aimTargetWorld: input.aimTargetWorld,
      cameraRayForwardWorld: input.cameraRayForwardWorld,
      cameraRayOriginWorld: input.cameraRayOriginWorld,
      eventKind: "projectile-spawned",
      launchDirectionWorld: input.direction,
      projectileId,
      semanticMuzzleWorld: input.origin,
      timeMs: input.issuedAtTimeMs
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
    readonly combatState: MutableMetaverseCombatPlayerRuntimeState;
    readonly direction: PhysicsVector3Snapshot;
    readonly firingReferenceOrigin: PhysicsVector3Snapshot;
    readonly issuedAtTimeMs: number;
    readonly nowMs: number;
    readonly origin: PhysicsVector3Snapshot;
    readonly semanticMuzzleWorld: PhysicsVector3Snapshot;
    readonly shotId: string;
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
    const segmentEnd = createOffsetVector(
      input.origin,
      input.direction,
      maxDistanceMeters
    );
    let closestPlayerHit: MetaverseCombatResolvedPlayerHit | null = null;

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

      const hurtVolumesResult = this.#readPlayerHurtVolumesForFire(
        targetRuntime,
        input.issuedAtTimeMs
      );
      const hitResolution = resolveMetaverseCombatHitForSegment(
        input.origin,
        segmentEnd,
        hurtVolumesResult.hurtVolumes
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
          regionId: hitResolution.regionId,
          rewindSource: hurtVolumesResult.rewindSource,
          targetPlayerId: targetRuntime.playerId
        };
      }
    }

    const shotResolutionBase = {
      actionSequence: input.actionSequence,
      rayForwardWorld: input.direction,
      rayOriginWorld: input.origin,
      timeMs: input.issuedAtTimeMs,
      weaponId: input.weaponId
    };

    if (
      worldHit !== null &&
      (closestPlayerHit === null ||
        worldHit.distanceMeters < closestPlayerHit.distanceMeters)
    ) {
      this.#storeHitscanShotResolution({
        combatState: input.combatState,
        hitKind: "world",
        hitNormalWorld: worldHit.normal,
        hitPointWorld: worldHit.point,
        hitSurface: this.#readWorldImpactSurface(worldHit.collider),
        regionId: null,
        semanticMuzzleWorld: input.semanticMuzzleWorld,
        shotId: input.shotId,
        targetPlayerId: null,
        finalReason:
          closestPlayerHit === null ? "hit-world" : "hit-world-before-player",
        ...shotResolutionBase
      });
      return;
    }

    if (closestPlayerHit === null) {
      this.#storeHitscanShotResolution({
        combatState: input.combatState,
        hitKind: "miss",
        hitNormalWorld: null,
        hitPointWorld: null,
        hitSurface: null,
        regionId: null,
        semanticMuzzleWorld: input.semanticMuzzleWorld,
        shotId: input.shotId,
        targetPlayerId: null,
        finalReason: "miss-no-hurtbox",
        ...shotResolutionBase
      });
      return;
    }

    const lineOfSightBlocker = this.#readLineOfSightBlocker(
      input.firingReferenceOrigin,
      closestPlayerHit.point
    );

    if (lineOfSightBlocker !== null) {
      this.#storeHitscanShotResolution({
        combatState: input.combatState,
        hitKind: "world",
        hitNormalWorld: lineOfSightBlocker.normal,
        hitPointWorld: lineOfSightBlocker.point,
        hitSurface: this.#readWorldImpactSurface(lineOfSightBlocker.collider),
        regionId: null,
        semanticMuzzleWorld: input.semanticMuzzleWorld,
        shotId: input.shotId,
        targetPlayerId: null,
        finalReason: "blocked-by-firing-reference-los",
        ...shotResolutionBase
      });
      return;
    }

    this.#storeHitscanShotResolution({
      combatState: input.combatState,
      hitKind: "player",
      hitNormalWorld: createImpactNormalFromIncomingDirection(input.direction),
      hitPointWorld: closestPlayerHit.point,
      hitSurface: null,
      regionId: closestPlayerHit.regionId,
      semanticMuzzleWorld: input.semanticMuzzleWorld,
      shotId: input.shotId,
      targetPlayerId: closestPlayerHit.targetPlayerId,
      finalReason: "hit-player",
      ...shotResolutionBase
    });
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

  #readLineOfSightBlocker(
    origin: PhysicsVector3Snapshot,
    target: PhysicsVector3Snapshot
  ): MetaverseCombatRaycastHitSnapshot | null {
    const distanceMeters = createDistanceBetweenPoints(origin, target);

    if (distanceMeters <= 0.000001) {
      return null;
    }

    const direction = normalizeDirection({
      x: target.x - origin.x,
      y: target.y - origin.y,
      z: target.z - origin.z
    });

    if (direction === null) {
      return null;
    }

    const worldHit = this.#dependencies.physicsRuntime.castRay(
      origin,
      direction,
      distanceMeters,
      (collider) => !this.#dependencies.playerTraversalColliderHandles.has(collider)
    );

    return worldHit !== null && worldHit.distanceMeters + 0.0001 < distanceMeters
      ? worldHit
      : null;
  }

  #readWorldImpactSurface(
    collider: RapierColliderHandle
  ): MetaverseCombatImpactSurfaceSnapshotInput | null {
    return this.#dependencies.readWorldImpactSurface?.(collider) ?? null;
  }

  #readSplashLineOfSightBlocker(
    explosionPoint: PhysicsVector3Snapshot,
    damagePoint: PhysicsVector3Snapshot
  ): MetaverseCombatRaycastHitSnapshot | null {
    const distanceMeters = createDistanceBetweenPoints(
      explosionPoint,
      damagePoint
    );

    if (distanceMeters <= combatSplashLineOfSightOriginBiasMeters) {
      return null;
    }

    const direction = normalizeDirection({
      x: damagePoint.x - explosionPoint.x,
      y: damagePoint.y - explosionPoint.y,
      z: damagePoint.z - explosionPoint.z
    });

    if (direction === null) {
      return null;
    }

    return this.#readLineOfSightBlocker(
      createPhysicsVector3Snapshot(
        explosionPoint.x + direction.x * combatSplashLineOfSightOriginBiasMeters,
        explosionPoint.y + direction.y * combatSplashLineOfSightOriginBiasMeters,
        explosionPoint.z + direction.z * combatSplashLineOfSightOriginBiasMeters
      ),
      damagePoint
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
      this.#matchMode === "team-deathmatch" &&
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

  readCombatEventSnapshots(): readonly MetaverseCombatEventSnapshot[] {
    return Object.freeze(
      this.#combatEvents.map((eventSnapshot) =>
        createMetaverseCombatEventSnapshot(eventSnapshot)
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
      weaponInventory: this.#createWeaponInventorySnapshotInput(
        combatState,
        this.#dependencies.playersById.get(playerId)?.weaponState ?? null
      ),
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

  grantWeaponResourcePickup(
    playerRuntime: PlayerRuntime,
    resourceSpawn: MetaverseMapBundleResourceSpawnSnapshot,
    nowMs: number
  ): boolean {
    if (resourceSpawn.resourceKind !== "weapon-pickup") {
      return false;
    }

    const weaponStateSnapshot = playerRuntime.weaponState;
    const equippedWeaponSlot =
      weaponStateSnapshot?.slots.find(
        (slot) => slot.equipped && slot.weaponId === resourceSpawn.weaponId
      ) ?? null;

    if (equippedWeaponSlot === null) {
      return false;
    }

    const weaponProfile = tryReadMetaverseCombatWeaponProfile(
      resourceSpawn.weaponId
    );

    if (weaponProfile === null) {
      return false;
    }

    const combatState = this.#ensurePlayerCombatState(playerRuntime);

    if (!combatState.alive) {
      return false;
    }

    const weaponState = this.#ensureWeaponRuntimeState(
      combatState,
      resourceSpawn.weaponId
    );
    const reserveMissing =
      weaponProfile.magazine.reserveCapacity - weaponState.ammoInReserve;

    if (reserveMissing <= 0) {
      return false;
    }

    const grantedRounds = Math.min(
      reserveMissing,
      Math.max(0, Math.trunc(resourceSpawn.ammoGrantRounds))
    );

    if (grantedRounds <= 0) {
      return false;
    }

    weaponState.ammoInReserve += grantedRounds;

    if (weaponState.ammoInMagazine <= 0 && weaponState.reloadRemainingMs <= 0) {
      this.#startReloadIfNeeded(weaponState, weaponProfile);
    }

    this.syncCombatState(nowMs);

    return true;
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
        activeBodyYawRadians: targetRuntime.yawRadians,
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
      projectileRuntime.positionX = worldHit.point.x;
      projectileRuntime.positionY = worldHit.point.y;
      projectileRuntime.positionZ = worldHit.point.z;
      this.#resolveProjectile(
        projectileRuntime,
        "hit-world",
        null,
        null,
        nowMs,
        worldHit.normal,
        this.#readWorldImpactSurface(worldHit.collider)
      );
      this.#applyProjectileSplashDamage(
        projectileRuntime,
        worldHit.point,
        nowMs,
        null
      );
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
      this.#applyProjectileSplashDamage(
        projectileRuntime,
        closestPlayerHit.point,
        nowMs,
        closestPlayerHit.targetPlayerId
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

  #applyProjectileSplashDamage(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState,
    explosionPoint: PhysicsVector3Snapshot,
    nowMs: number,
    directHitPlayerId: MetaversePlayerId | null
  ): void {
    const weaponProfile = readMetaverseCombatWeaponProfile(
      projectileRuntime.weaponId
    );
    const areaDamage = weaponProfile.areaDamage;

    if (
      areaDamage === null ||
      areaDamage.outerRadiusMeters <= 0 ||
      areaDamage.maxDamage <= 0
    ) {
      return;
    }

    const ownerRuntime =
      this.#dependencies.playersById.get(projectileRuntime.ownerPlayerId) ??
      null;

    for (const targetRuntime of this.#dependencies.playersById.values()) {
      if (targetRuntime.playerId === directHitPlayerId) {
        continue;
      }

      if (
        targetRuntime.playerId === projectileRuntime.ownerPlayerId &&
        !areaDamage.affectsOwner
      ) {
        continue;
      }

      if (
        ownerRuntime !== null &&
        targetRuntime.playerId !== projectileRuntime.ownerPlayerId &&
        !this.#matchState.friendlyFireEnabled &&
        !areaDamage.affectsTeammates &&
        ownerRuntime.teamId === targetRuntime.teamId
      ) {
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

      const hurtVolumes = createMetaversePlayerCombatHurtVolumes({
        activeBodyPosition: createPlayerBodyPositionSnapshot(targetRuntime),
        activeBodyYawRadians: targetRuntime.yawRadians,
        ...(this.#dependencies.hurtVolumeConfig === undefined
          ? {}
          : {
              config: this.#dependencies.hurtVolumeConfig
            })
      });
      const closestDamagePoint = resolveMetaverseCombatClosestHurtVolumePoint(
        explosionPoint,
        hurtVolumes
      );

      if (closestDamagePoint === null) {
        continue;
      }

      const damagePoint = closestDamagePoint.point;
      const distanceMeters = closestDamagePoint.distanceMeters;

      if (distanceMeters > areaDamage.outerRadiusMeters) {
        continue;
      }

      if (
        areaDamage.lineOfSightRequired &&
        distanceMeters > 0.000001 &&
        this.#readSplashLineOfSightBlocker(explosionPoint, damagePoint) !== null
      ) {
        continue;
      }

      const falloffAlpha =
        distanceMeters <= areaDamage.innerRadiusMeters
          ? 0
          : Math.min(
              1,
              (distanceMeters - areaDamage.innerRadiusMeters) /
                Math.max(
                  0.000001,
                  areaDamage.outerRadiusMeters - areaDamage.innerRadiusMeters
                )
            );
      const damage = Math.round(
        areaDamage.maxDamage +
          (areaDamage.minDamage - areaDamage.maxDamage) * falloffAlpha
      );

      if (damage <= 0) {
        continue;
      }

      this.#applyCombatHit(
        {
          ownerPlayerId: projectileRuntime.ownerPlayerId,
          sourceActionSequence: projectileRuntime.sourceActionSequence,
          sourceProjectileId: projectileRuntime.projectileId,
          weaponId: projectileRuntime.weaponId
        },
        targetRuntime.playerId,
        "body",
        nowMs,
        damage
      );
    }

    if (
      (this.#matchState.teamScoresByTeamId.get("red") ?? 0) >=
        this.#matchState.scoreLimit ||
      (this.#matchState.teamScoresByTeamId.get("blue") ?? 0) >=
        this.#matchState.scoreLimit
    ) {
      this.#completeMatch(nowMs);
    }
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
      nowMs,
      createImpactNormalFromIncomingDirection(projectileRuntime.direction),
      null
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
    nowMs: number,
    damageOverride?: number
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
      damageOverride === undefined
        ? hitZone === "head"
          ? weaponProfile.damage.head
          : weaponProfile.damage.body
        : Math.max(0, damageOverride);

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

  #createWeaponInventorySnapshotInput(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null
  ): readonly MetaverseCombatPlayerWeaponSnapshotInput[] {
    const equippedWeaponIds =
      weaponState === null
        ? null
        : new Set(
            weaponState.slots
              .filter((slot) => slot.equipped)
              .map((slot) => slot.weaponId)
          );

    return Object.freeze(
      [...combatState.weaponsById.values()]
        .filter(
          (weaponRuntime) =>
            equippedWeaponIds === null || equippedWeaponIds.has(weaponRuntime.weaponId)
        )
        .map((weaponRuntime) => ({
          ammoInMagazine: weaponRuntime.ammoInMagazine,
          ammoInReserve: weaponRuntime.ammoInReserve,
          reloadRemainingMs: weaponRuntime.reloadRemainingMs,
          weaponId: weaponRuntime.weaponId
        }))
    );
  }

  #createProjectileSnapshotInput(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState
  ): MetaverseCombatProjectileSnapshotInput {
    return {
      direction: projectileRuntime.direction,
      ownerPlayerId: projectileRuntime.ownerPlayerId,
      position: createProjectilePositionSnapshot(projectileRuntime),
      projectileId: projectileRuntime.projectileId,
      resolution: projectileRuntime.resolution,
      resolvedAtTimeMs: projectileRuntime.resolvedAtTimeMs,
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
        playerRuntime
      );

      if (
        tryReadMetaverseCombatWeaponProfile(existingCombatState.activeWeaponId) !==
        null
      ) {
        this.#ensureWeaponRuntimeState(
          existingCombatState,
          existingCombatState.activeWeaponId
        );
      }
      this.#syncEquippedWeaponRuntimeStates(existingCombatState, playerRuntime);

      return existingCombatState;
    }

    const nextCombatState: MutableMetaverseCombatPlayerRuntimeState = {
      activeWeaponId: this.#resolveActiveWeaponId(playerRuntime),
      alive: true,
      assists: 0,
      damageLedgerByAttackerId: new Map(),
      deaths: 0,
      headshotKills: 0,
      highestProcessedPlayerActionSequence: 0,
      health: 100,
      kills: 0,
      maxHealth: 100,
      playerId: playerRuntime.playerId,
      playerActionReceiptSequenceOrder: [],
      recentPlayerActionReceiptsBySequence: new Map(),
      respawnRemainingMs: 0,
      spawnProtectionRemainingMs:
        this.#matchState.phase === "active" ? spawnProtectionDurationMs : 0,
      weaponsById: new Map()
    };

    if (
      tryReadMetaverseCombatWeaponProfile(nextCombatState.activeWeaponId) !== null
    ) {
      this.#ensureWeaponRuntimeState(nextCombatState, nextCombatState.activeWeaponId);
    }
    this.#syncEquippedWeaponRuntimeStates(nextCombatState, playerRuntime);
    this.#playerCombatStateByPlayerId.set(playerRuntime.playerId, nextCombatState);

    return nextCombatState;
  }

  #syncEquippedWeaponRuntimeStates(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    playerRuntime: PlayerRuntime
  ): void {
    const weaponState = playerRuntime.weaponState;

    if (weaponState === null) {
      return;
    }

    for (const slot of weaponState.slots) {
      if (
        !slot.equipped ||
        tryReadMetaverseCombatWeaponProfile(slot.weaponId) === null
      ) {
        continue;
      }

      this.#ensureWeaponRuntimeState(combatState, slot.weaponId);
    }
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
      lastFireAtMs: Number.NEGATIVE_INFINITY,
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

  #isWeaponEquipped(playerRuntime: PlayerRuntime, weaponId: string): boolean {
    const weaponState = playerRuntime.weaponState;

    if (weaponState === null) {
      return weaponId === defaultCombatWeaponId;
    }

    return weaponState.slots.some(
      (slot) => slot.equipped && slot.weaponId === weaponId
    );
  }

  #resolveActiveWeaponId(playerRuntime: PlayerRuntime): string {
    return playerRuntime.weaponState?.weaponId ?? defaultCombatWeaponId;
  }

  #resolveActiveWeaponSlot(playerRuntime: PlayerRuntime):
    | {
        readonly activeSlotId: MetaverseCombatEventSnapshotInput["activeSlotId"];
        readonly weaponInstanceId: string | null;
      }
    | null {
    const weaponState = playerRuntime.weaponState;

    if (weaponState === null) {
      return {
        activeSlotId: null,
        weaponInstanceId: null
      };
    }

    const activeSlotId = weaponState.activeSlotId;
    const activeSlot =
      activeSlotId === null
        ? null
        : weaponState.slots.find((slot) => slot.slotId === activeSlotId) ??
          null;

    return {
      activeSlotId,
      weaponInstanceId: activeSlot?.weaponInstanceId ?? null
    };
  }

  #resolveProjectile(
    projectileRuntime: MutableMetaverseCombatProjectileRuntimeState,
    resolution: MetaverseCombatProjectileResolutionId,
    resolvedPlayerId: MetaversePlayerId | null,
    resolvedHitZone: MetaverseCombatHitZoneId | null,
    nowMs: number,
    impactNormalWorld: PhysicsVector3Snapshot | null = null,
    impactSurface: MetaverseCombatImpactSurfaceSnapshotInput | null = null
  ): void {
    if (projectileRuntime.resolution !== "active") {
      return;
    }

    projectileRuntime.resolution = resolution;
    projectileRuntime.resolvedAtTimeMs = nowMs;
    projectileRuntime.resolvedHitZone = resolvedHitZone;
    projectileRuntime.resolvedPlayerId = resolvedPlayerId;

    const ownerRuntime =
      this.#dependencies.playersById.get(projectileRuntime.ownerPlayerId) ??
      null;
    const activeWeaponSlot =
      ownerRuntime === null ? null : this.#resolveActiveWeaponSlot(ownerRuntime);
    const impactPointWorld = createProjectilePositionSnapshot(projectileRuntime);

    this.#storeCombatEvent({
      actionSequence: projectileRuntime.sourceActionSequence,
      activeSlotId: activeWeaponSlot?.activeSlotId ?? null,
      aimTargetWorld: projectileRuntime.aimTargetWorld,
      cameraRayForwardWorld: projectileRuntime.cameraRayForwardWorld,
      cameraRayOriginWorld: projectileRuntime.cameraRayOriginWorld,
      eventKind: "projectile-resolved",
      launchDirectionWorld: projectileRuntime.direction,
      playerId: projectileRuntime.ownerPlayerId,
      presentationDeliveryModel: projectileRuntime.presentationDeliveryModel,
      projectile: {
        hitZone: resolvedHitZone,
        impactNormalWorld,
        impactPointWorld,
        impactSurface,
        resolutionKind: resolution,
        targetPlayerId: resolvedPlayerId
      },
      projectileId: projectileRuntime.projectileId,
      semanticMuzzleWorld: projectileRuntime.semanticMuzzleWorld,
      shotId: projectileRuntime.projectileId,
      timeMs: nowMs,
      weaponId: projectileRuntime.weaponId,
      weaponInstanceId: activeWeaponSlot?.weaponInstanceId ?? null
    });
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
      weaponState.lastFireAtMs = Number.NEGATIVE_INFINITY;
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

  #startMatch(nowMs: number): void {
    this.#matchState.completedAtTimeMs = null;
    this.#matchState.phase = "active";
    this.#matchState.startedAtTimeMs = nowMs;
    this.#matchState.teamScoresByTeamId.set("red", 0);
    this.#matchState.teamScoresByTeamId.set("blue", 0);
    this.#matchState.timeRemainingMs = this.#matchState.timeLimitMs;
    this.#matchState.winnerTeamId = null;
    this.#combatEvents.length = 0;
    this.#combatEventSequence = 0;
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
      combatState.highestProcessedPlayerActionSequence = 0;
      combatState.playerActionReceiptSequenceOrder.length = 0;
      combatState.recentPlayerActionReceiptsBySequence.clear();
      combatState.damageLedgerByAttackerId.clear();
      this.#respawnPlayer(playerRuntime, combatState, nowMs);
    }
  }

  #storeCombatEvent(
    input: Omit<MetaverseCombatEventSnapshotInput, "eventSequence">
  ): void {
    this.#combatEvents.push({
      ...input,
      eventSequence: ++this.#combatEventSequence
    });

    while (this.#combatEvents.length > combatEventJournalMaxEntries) {
      this.#combatEvents.shift();
    }

    this.#dependencies.incrementSnapshotSequence();
  }

  #createCombatShotId(
    playerId: MetaversePlayerId,
    actionSequence: number,
    shotIndex = 0
  ): string {
    const baseShotId = `${playerId}:${actionSequence}`;

    return shotIndex <= 0 ? baseShotId : `${baseShotId}:${shotIndex + 1}`;
  }

  #createCombatEventBase(input: {
    readonly actionSequence: number;
    readonly playerRuntime: PlayerRuntime;
    readonly shotIndex?: number;
    readonly weaponId: string;
    readonly weaponProfile: ReturnType<typeof readMetaverseCombatWeaponProfile>;
  }): Pick<
    MetaverseCombatEventSnapshotInput,
    | "actionSequence"
    | "activeSlotId"
    | "playerId"
    | "presentationDeliveryModel"
    | "weaponId"
    | "weaponInstanceId"
  > & {
    readonly shotId: string;
  } {
    const activeWeaponSlot = this.#resolveActiveWeaponSlot(input.playerRuntime);

    return {
      actionSequence: input.actionSequence,
      activeSlotId: activeWeaponSlot?.activeSlotId ?? null,
      playerId: input.playerRuntime.playerId,
      presentationDeliveryModel: input.weaponProfile.presentationDeliveryModel,
      shotId: this.#createCombatShotId(
        input.playerRuntime.playerId,
        input.actionSequence,
        input.shotIndex
      ),
      weaponId: input.weaponId,
      weaponInstanceId: activeWeaponSlot?.weaponInstanceId ?? null
    };
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

  #publishSwitchActiveWeaponSlotActionReceipt(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    input: {
      readonly action: MetaverseSwitchActiveWeaponSlotPlayerActionSnapshot;
      readonly nowMs: number;
      readonly reason?:
        | MetaversePlayerActionSwitchWeaponSlotRejectionReasonId
        | undefined;
      readonly weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
    }
  ): void {
    const activeSlotId = input.weaponState?.activeSlotId ?? null;
    const activeSlot =
      activeSlotId === null
        ? null
        : input.weaponState?.slots.find((slot) => slot.slotId === activeSlotId) ??
          null;

    this.#storePlayerActionReceipt(
      combatState,
      createMetaversePlayerActionReceiptSnapshot({
        actionSequence: input.action.actionSequence,
        activeSlotId,
        intendedWeaponInstanceId: input.action.intendedWeaponInstanceId,
        kind: "switch-active-weapon-slot",
        processedAtTimeMs: input.nowMs,
        ...(input.reason === undefined
          ? {
              status: "accepted"
            }
          : {
              rejectionReason: input.reason,
              status: "rejected"
            }),
        requestedActiveSlotId: input.action.requestedActiveSlotId,
        weaponId: activeSlot?.weaponId ?? input.weaponState?.weaponId ?? null,
        weaponInstanceId: activeSlot?.weaponInstanceId ?? null
      })
    );
  }

  #createDroppedWeaponResourceSpawn(
    playerRuntime: PlayerRuntime,
    action: MetaverseInteractWeaponResourcePlayerActionSnapshot,
    weaponSlot: MetaverseRealtimePlayerWeaponStateSnapshot["slots"][number],
    combatState: MutableMetaverseCombatPlayerRuntimeState
  ): MetaverseMapBundleResourceSpawnSnapshot {
    const weaponProfile =
      tryReadMetaverseCombatWeaponProfile(weaponSlot.weaponId) ??
      readMetaverseCombatWeaponProfile(defaultCombatWeaponId);
    const weaponRuntime =
      combatState.weaponsById.get(weaponSlot.weaponId) ?? null;
    const yawRadians = Number.isFinite(playerRuntime.yawRadians)
      ? playerRuntime.yawRadians
      : 0;

    return Object.freeze({
      ammoGrantRounds:
        weaponRuntime === null
          ? weaponProfile.magazine.reserveCapacity
          : Math.max(
              0,
              Math.trunc(
                weaponRuntime.ammoInMagazine + weaponRuntime.ammoInReserve
              )
            ),
      assetId: weaponSlot.attachmentId,
      label: `Dropped ${weaponSlot.weaponId}`,
      modeTags: Object.freeze([]),
      pickupRadiusMeters: combatDroppedWeaponPickupRadiusMeters,
      position: Object.freeze({
        x: playerRuntime.positionX + Math.sin(yawRadians) * 0.9,
        y: playerRuntime.positionY + 0.55,
        z: playerRuntime.positionZ - Math.cos(yawRadians) * 0.9
      }),
      resourceKind: "weapon-pickup",
      respawnCooldownMs: 0,
      spawnId:
        `dropped:${playerRuntime.playerId}:${action.actionSequence}:` +
        `${weaponSlot.slotId}:${weaponSlot.weaponId}`,
      weaponId: weaponSlot.weaponId,
      yawRadians
    });
  }

  #publishInteractWeaponResourceActionReceipt(
    combatState: MutableMetaverseCombatPlayerRuntimeState,
    input: {
      readonly action: MetaverseInteractWeaponResourcePlayerActionSnapshot;
      readonly droppedWeaponId?: string | null | undefined;
      readonly nowMs: number;
      readonly pickedUpWeaponId?: string | null | undefined;
      readonly reason?:
        | MetaversePlayerActionInteractWeaponResourceRejectionReasonId
        | undefined;
      readonly weaponState: MetaverseRealtimePlayerWeaponStateSnapshot | null;
    }
  ): void {
    const activeSlotId = input.weaponState?.activeSlotId ?? null;
    const activeSlot =
      activeSlotId === null
        ? null
        : input.weaponState?.slots.find((slot) => slot.slotId === activeSlotId) ??
          null;

    this.#storePlayerActionReceipt(
      combatState,
      createMetaversePlayerActionReceiptSnapshot({
        actionSequence: input.action.actionSequence,
        activeSlotId,
        droppedWeaponId: input.droppedWeaponId ?? null,
        intendedWeaponInstanceId: input.action.intendedWeaponInstanceId,
        kind: "interact-weapon-resource",
        pickedUpWeaponId: input.pickedUpWeaponId ?? null,
        processedAtTimeMs: input.nowMs,
        ...(input.reason === undefined
          ? {
              status: "accepted"
            }
          : {
              rejectionReason: input.reason,
              status: "rejected"
            }),
        requestedActiveSlotId: input.action.requestedActiveSlotId,
        weaponId: activeSlot?.weaponId ?? input.weaponState?.weaponId ?? null,
        weaponInstanceId: activeSlot?.weaponInstanceId ?? null
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

  #storeHitscanShotResolution(input: {
    readonly actionSequence: number;
    readonly combatState: MutableMetaverseCombatPlayerRuntimeState;
    readonly finalReason: MetaverseCombatShotResolutionFinalReasonId;
    readonly hitKind: "miss" | "player" | "world";
    readonly hitNormalWorld: PhysicsVector3Snapshot | null;
    readonly hitPointWorld: PhysicsVector3Snapshot | null;
    readonly hitSurface: MetaverseCombatImpactSurfaceSnapshotInput | null;
    readonly rayForwardWorld: PhysicsVector3Snapshot;
    readonly rayOriginWorld: PhysicsVector3Snapshot;
    readonly regionId: MetaverseCombatHurtRegionId | null;
    readonly semanticMuzzleWorld: PhysicsVector3Snapshot;
    readonly shotId: string;
    readonly targetPlayerId: MetaversePlayerId | null;
    readonly timeMs: number;
    readonly weaponId: string;
  }): void {
    const weaponProfile = readMetaverseCombatWeaponProfile(input.weaponId);
    const playerRuntime =
      this.#dependencies.playersById.get(input.combatState.playerId) ?? null;
    const activeWeaponSlot =
      playerRuntime === null ? null : this.#resolveActiveWeaponSlot(playerRuntime);
    const aimTargetWorld =
      input.hitPointWorld ??
      createOffsetVector(
        input.rayOriginWorld,
        input.rayForwardWorld,
        this.#resolveFireRangeMeters(weaponProfile)
      );

    this.#storeCombatEvent({
      actionSequence: input.actionSequence,
      activeSlotId: activeWeaponSlot?.activeSlotId ?? null,
      aimTargetWorld,
      cameraRayForwardWorld: input.rayForwardWorld,
      cameraRayOriginWorld: input.rayOriginWorld,
      eventKind: "hitscan-resolved",
      hitscan: {
        finalReason: input.finalReason,
        hitKind: input.hitKind,
        hitNormalWorld: input.hitNormalWorld,
        hitPointWorld: input.hitPointWorld,
        hitSurface: input.hitSurface,
        regionId: input.regionId,
        targetPlayerId: input.targetPlayerId
      },
      playerId: input.combatState.playerId,
      presentationDeliveryModel: weaponProfile.presentationDeliveryModel,
      semanticMuzzleWorld: input.semanticMuzzleWorld,
      shotId: input.shotId,
      timeMs: input.timeMs,
      weaponId: input.weaponId,
      weaponInstanceId: activeWeaponSlot?.weaponInstanceId ?? null
    });
  }

  #readPlayerHurtVolumesForFire(
    playerRuntime: PlayerRuntime,
    issuedAtTimeMs: number
  ): {
    readonly hurtVolumes: MetaversePlayerCombatHurtVolumesSnapshot;
    readonly rewindSource: MetaverseCombatShotResolutionRewindSourceId;
  } {
    const historicalHurtVolumes = this.#readHistoricalHurtVolumes(
      playerRuntime.playerId,
      issuedAtTimeMs
    );

    if (historicalHurtVolumes !== null) {
      return {
        hurtVolumes: historicalHurtVolumes,
        rewindSource: "history"
      };
    }

    return {
      hurtVolumes: this.#createCurrentPlayerHurtVolumes(playerRuntime),
      rewindSource: "current"
    };
  }

  #createCurrentPlayerHurtVolumes(
    playerRuntime: PlayerRuntime
  ): MetaversePlayerCombatHurtVolumesSnapshot {
    return createMetaversePlayerCombatHurtVolumes({
      activeBodyPosition: createPlayerBodyPositionSnapshot(playerRuntime),
      activeBodyYawRadians: playerRuntime.yawRadians,
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
