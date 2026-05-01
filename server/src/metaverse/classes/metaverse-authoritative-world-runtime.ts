import {
  resolveMetaverseGroundedJumpBodyTraversalActionSnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseTraversalPlayerBodyBlockerSnapshot,
  type MetaverseSurfaceTraversalConfig,
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  resolveMetaverseMapPlayerSpawnSupportPosition,
  resolveMetaverseMapPlayerSpawnNode,
  type MetaversePlayerTeamId,
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  createMetaversePresencePoseSnapshot,
  shouldTreatMetaverseMountedOccupancyAsTraversalMounted,
  shouldTreatMetaversePlayerPoseAsTraversalBlocker,
  type MetaversePlayerId,
  type MetaversePresenceCommand,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimePlayerWeaponStateSnapshot,
  MetaverseRealtimeWorldClientCommand,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  createMetaverseRealtimePlayerWeaponStateSnapshot
} from "@webgpu-metaverse/shared/metaverse/realtime";
import {
  createMetaverseWeaponInstanceId,
  readMetaverseWeaponLayout,
  type MetaverseWeaponLayoutSnapshot,
  type MetaverseWeaponSlotId
} from "@webgpu-metaverse/shared/metaverse";

import { metaverseAuthoritativeWorldRuntimeConfig } from "../config/metaverse-authoritative-world-runtime.js";
import {
  MetaverseAuthoritativeGroundedBodyRuntime,
  type MetaverseAuthoritativeGroundedBodyConfig
} from "./metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "./metaverse-authoritative-surface-drive-runtime.js";
import {
  MetaverseAuthoritativeDynamicCuboidBodyRuntime,
  type MetaverseAuthoritativeDynamicCuboidBodyConfig
} from "./metaverse-authoritative-dynamic-cuboid-body-runtime.js";
import {
  MetaverseAuthoritativePlayerStateSync,
  type MetaverseAuthoritativePlayerStateSyncRuntimeState
} from "../authority/players/metaverse-authoritative-player-state-sync.js";
import { MetaverseAuthoritativePlayerWeaponStateAuthority } from "../authority/players/metaverse-authoritative-player-weapon-state-authority.js";
import { MetaverseAuthoritativePlayerLifecycleAuthority } from "../authority/players/metaverse-authoritative-player-lifecycle-authority.js";
import { MetaverseAuthoritativeMountedOccupancyAuthority } from "../authority/mounted/metaverse-authoritative-mounted-occupancy-authority.js";
import { MetaverseAuthoritativePlayerPoseAuthority } from "../authority/players/metaverse-authoritative-player-pose-authority.js";
import {
  MetaverseAuthoritativePlayerTraversalAuthority,
  type MetaverseAuthoritativePlayerTraversalIntentRuntimeState
} from "../authority/traversal/metaverse-authoritative-player-traversal-authority.js";
import { MetaverseAuthoritativeCombatAuthority } from "../authority/combat/metaverse-authoritative-combat-authority.js";
import { MetaverseAuthoritativeResourceSpawnAuthority } from "../authority/resources/metaverse-authoritative-resource-spawn-authority.js";
import { MetaverseAuthoritativeUnmountedPlayerSimulation } from "../authority/traversal/metaverse-authoritative-unmounted-player-simulation.js";
import { MetaverseAuthoritativeWorldSurfaceState } from "../authority/traversal/metaverse-authoritative-world-surface-state.js";
import { MetaverseAuthoritativeWorldTickState } from "../authority/world/metaverse-authoritative-world-tick-state.js";
import { MetaverseAuthoritativeWorldReadState } from "../authority/world/metaverse-authoritative-world-read-state.js";
import { MetaverseAuthoritativeVehicleDriveAuthority } from "../authority/vehicles/metaverse-authoritative-vehicle-drive-authority.js";
import {
  MetaverseAuthoritativeVehicleRuntimeRegistry,
  type MetaverseAuthoritativeVehicleRuntimeRegistryRuntimeState,
  type MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState
} from "../authority/vehicles/metaverse-authoritative-vehicle-runtime-registry.js";
import { MetaverseAuthoritativeWorldCommandIntake } from "../authority/commands/metaverse-authoritative-world-command-intake.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-authoritative-rapier.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeMountedOccupancyRuntimeState } from "../authority/mounted/metaverse-authoritative-mounted-occupancy-authority.js";
import { createMetaverseAuthoritativeWorldBundleInputs } from "../world/map-bundles/metaverse-authoritative-world-bundle-inputs.js";
import { resolveDefaultAuthoritativeMetaverseMapBundleId } from "../world/map-bundles/load-authoritative-metaverse-map-bundle.js";
import type { MetaverseAuthoritativeWorldRuntimeOwner } from "../types/metaverse-authoritative-world-runtime-owner.js";

interface MetaversePlayerWorldRuntimeState
  extends MetaverseAuthoritativePlayerStateSyncRuntimeState<
    MetaverseAuthoritativeGroundedBodyRuntime,
    MetaverseAuthoritativeSurfaceDriveRuntime,
    MetaverseMountedOccupancyRuntimeState
  > {}

interface MutableMetaversePlayerTeamRuntimeState {
  teamId: MetaversePlayerTeamId;
}

type MetaverseMountedOccupancyRuntimeState =
  MetaverseAuthoritativeMountedOccupancyRuntimeState;
type MetaverseVehicleSeatRuntimeState =
  MetaverseAuthoritativeVehicleRuntimeRegistrySeatRuntimeState;
type MetaverseVehicleWorldRuntimeState =
  MetaverseAuthoritativeVehicleRuntimeRegistryRuntimeState<MetaverseVehicleSeatRuntimeState>;

interface MetaverseEnvironmentBodyWorldRuntimeState {
  readonly bodyRuntime: MetaverseAuthoritativeDynamicCuboidBodyRuntime;
  readonly environmentAssetId: string;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  yawRadians: number;
}

interface MetaverseDriverVehicleControlRuntimeState {
  readonly environmentAssetId: string;
  boost: boolean;
  controlSequence: number;
  moveAxis: number;
  strafeAxis: number;
  yawAxis: number;
}

interface MetaverseAuthoritativeSurfaceTraversalConfig
  extends MetaverseSurfaceTraversalConfig {
  readonly worldRadius: number;
}

function createMetaverseAuthoritativeGroundedBodyRuntimeConfig(
  gameplayProfile: {
    readonly groundedBodyTraversal: {
      readonly accelerationCurveExponent: number;
      readonly accelerationUnitsPerSecondSquared: number;
      readonly baseSpeedUnitsPerSecond: number;
      readonly boostCurveExponent: number;
      readonly boostMultiplier: number;
      readonly capsuleHalfHeightMeters: number;
      readonly capsuleRadiusMeters: number;
      readonly controllerOffsetMeters: number;
      readonly decelerationUnitsPerSecondSquared: number;
      readonly dragCurveExponent: number;
      readonly maxSlopeClimbAngleRadians: number;
      readonly maxTurnSpeedRadiansPerSecond: number;
      readonly minSlopeSlideAngleRadians: number;
      readonly snapToGroundDistanceMeters: number;
      readonly stepHeightMeters: number;
      readonly stepWidthMeters: number;
    };
    readonly groundedJumpPhysics: {
      readonly airborneMovementDampingFactor: number;
      readonly gravityUnitsPerSecond: number;
      readonly jumpGroundContactGraceSeconds: number;
      readonly jumpImpulseUnitsPerSecond: number;
    };
    readonly worldRadius: number;
  },
  spawnPosition: PhysicsVector3Snapshot
): MetaverseAuthoritativeGroundedBodyConfig {
  return Object.freeze({
    ...gameplayProfile.groundedBodyTraversal,
    airborneMovementDampingFactor:
      gameplayProfile.groundedJumpPhysics.airborneMovementDampingFactor,
    gravityUnitsPerSecond:
      gameplayProfile.groundedJumpPhysics.gravityUnitsPerSecond,
    jumpGroundContactGraceSeconds:
      gameplayProfile.groundedJumpPhysics.jumpGroundContactGraceSeconds,
    jumpImpulseUnitsPerSecond:
      gameplayProfile.groundedJumpPhysics.jumpImpulseUnitsPerSecond,
    spawnPosition,
    worldRadius: gameplayProfile.worldRadius
  } satisfies MetaverseAuthoritativeGroundedBodyConfig);
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

function resolveNextMatchShuffleSeed(
  nowMs: number,
  playerIds: readonly MetaversePlayerId[]
): number {
  let seed = Math.max(1, Math.trunc(nowMs)) >>> 0;

  for (const playerId of playerIds) {
    for (let index = 0; index < playerId.length; index += 1) {
      seed = Math.imul(seed ^ playerId.charCodeAt(index), 2654435761) >>> 0;
    }
  }

  return seed === 0 ? 1 : seed;
}

function advanceNextMatchShuffleSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function writePlayerTeamId(
  playerRuntime: MetaversePlayerWorldRuntimeState,
  teamId: MetaversePlayerTeamId
): void {
  (playerRuntime as MutableMetaversePlayerTeamRuntimeState).teamId = teamId;
}

function resolvePlayerActiveTraversalAction(
  playerRuntime: MetaversePlayerWorldRuntimeState
): MetaverseTraversalActiveActionSnapshot {
  const groundedBodySnapshot = playerRuntime.groundedBodyRuntime.snapshot;

  if (
    shouldTreatMetaverseMountedOccupancyAsTraversalMounted(
      playerRuntime.mountedOccupancy
    ) ||
    playerRuntime.locomotionMode !== "grounded"
  ) {
    return Object.freeze({
      kind: "none",
      phase: "idle"
    });
  }

  return resolveMetaverseGroundedJumpBodyTraversalActionSnapshot(
    groundedBodySnapshot.jumpBody
  );
}

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

function positionsApproximatelyMatch(
  leftPosition: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  rightPosition: Pick<PhysicsVector3Snapshot, "x" | "y" | "z">,
  toleranceMeters = 0.0001
): boolean {
  return (
    Math.abs(leftPosition.x - rightPosition.x) <= toleranceMeters &&
    Math.abs(leftPosition.y - rightPosition.y) <= toleranceMeters &&
    Math.abs(leftPosition.z - rightPosition.z) <= toleranceMeters
  );
}

function readWrappedYawDeltaRadians(
  leftYawRadians: number,
  rightYawRadians: number
): number {
  return Math.atan2(
    Math.sin(leftYawRadians - rightYawRadians),
    Math.cos(leftYawRadians - rightYawRadians)
  );
}

function createEnvironmentBodyWorldRuntimeState(
  bodyRuntime: MetaverseAuthoritativeDynamicCuboidBodyRuntime,
  environmentAssetId: string
): MetaverseEnvironmentBodyWorldRuntimeState {
  const snapshot = bodyRuntime.syncSnapshot();

  return {
    bodyRuntime,
    environmentAssetId,
    linearVelocityX: snapshot.linearVelocity.x,
    linearVelocityY: snapshot.linearVelocity.y,
    linearVelocityZ: snapshot.linearVelocity.z,
    positionX: snapshot.position.x,
    positionY: snapshot.position.y,
    positionZ: snapshot.position.z,
    yawRadians: snapshot.yawRadians
  };
}

function createPlayerWeaponStateFromLayout(
  weaponLayout: MetaverseWeaponLayoutSnapshot | null,
  playerId: MetaversePlayerId,
  requestedActiveSlotId: MetaverseWeaponSlotId | null =
    weaponLayout?.activeSlotId ?? null,
  aimMode: "ads" | "hip-fire" = "hip-fire"
): MetaverseRealtimePlayerWeaponStateSnapshot | null {
  if (weaponLayout === null) {
    return null;
  }

  const equippedSlots = weaponLayout.slots.filter((slot) => slot.equipped);

  if (equippedSlots.length === 0) {
    return null;
  }

  const fallbackSlot = equippedSlots[0];

  if (fallbackSlot === undefined) {
    return null;
  }

  const activeSlot =
    (requestedActiveSlotId === null
      ? null
      : equippedSlots.find((slot) => slot.slotId === requestedActiveSlotId)) ??
    equippedSlots.find((slot) => slot.slotId === weaponLayout.activeSlotId) ??
    fallbackSlot;

  return createMetaverseRealtimePlayerWeaponStateSnapshot({
    activeSlotId: activeSlot.slotId,
    aimMode,
    slots: equippedSlots.map((slot) => ({
      attachmentId: slot.attachmentId,
      equipped: slot.equipped,
      slotId: slot.slotId,
      weaponId: slot.weaponId,
      weaponInstanceId: createMetaverseWeaponInstanceId(
        playerId,
        slot.slotId,
        slot.weaponId
      )
    })),
    weaponId: activeSlot.weaponId
  });
}

export class MetaverseAuthoritativeWorldRuntime
  implements MetaverseAuthoritativeWorldRuntimeOwner {
  readonly #config: MetaverseAuthoritativeWorldRuntimeConfig;
  readonly #driverVehicleControlsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseDriverVehicleControlRuntimeState
  >();
  readonly #physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();
  readonly #playerTraversalIntentsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseAuthoritativePlayerTraversalIntentRuntimeState
  >();
  readonly #playerTraversalColliderOwnerByHandle = new Map<
    RapierColliderHandle,
    MetaversePlayerId
  >();
  readonly #playerTraversalColliderHandles = new Set<RapierColliderHandle>();
  readonly #playersById = new Map<MetaversePlayerId, MetaversePlayerWorldRuntimeState>();
  readonly #environmentBodiesByEnvironmentAssetId = new Map<
    string,
    MetaverseEnvironmentBodyWorldRuntimeState
  >();
  readonly #surfaceState: MetaverseAuthoritativeWorldSurfaceState<
    MetaversePlayerWorldRuntimeState,
    MetaverseVehicleWorldRuntimeState | MetaverseEnvironmentBodyWorldRuntimeState
  >;
  readonly #vehicleDriveColliderHandles = new Set<RapierColliderHandle>();
  readonly #vehiclesById = new Map<MetaverseVehicleId, MetaverseVehicleWorldRuntimeState>();
  readonly #vehicleRuntimeRegistry: MetaverseAuthoritativeVehicleRuntimeRegistry<
    MetaversePlayerWorldRuntimeState,
    MetaverseMountedOccupancyRuntimeState,
    MetaverseVehicleSeatRuntimeState,
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #playerStateSync: MetaverseAuthoritativePlayerStateSync<
    MetaversePlayerWorldRuntimeState,
    MetaverseAuthoritativeGroundedBodyRuntime,
    MetaverseAuthoritativeSurfaceDriveRuntime,
    MetaverseMountedOccupancyRuntimeState,
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #mountedOccupancyAuthority: MetaverseAuthoritativeMountedOccupancyAuthority<
    MetaversePlayerWorldRuntimeState,
    MetaverseMountedOccupancyRuntimeState,
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #playerLifecycleAuthority:
    MetaverseAuthoritativePlayerLifecycleAuthority<
      MetaversePlayerWorldRuntimeState,
      MetaverseVehicleWorldRuntimeState
    >;
  readonly #playerPoseAuthority: MetaverseAuthoritativePlayerPoseAuthority<
    MetaversePlayerWorldRuntimeState,
    MetaverseMountedOccupancyRuntimeState,
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #playerTraversalAuthority: MetaverseAuthoritativePlayerTraversalAuthority<
    MetaversePlayerWorldRuntimeState
  >;
  readonly #playerWeaponStateAuthority:
    MetaverseAuthoritativePlayerWeaponStateAuthority<MetaversePlayerWorldRuntimeState>;
  readonly #combatAuthority:
    MetaverseAuthoritativeCombatAuthority<MetaversePlayerWorldRuntimeState>;
  readonly #resourceSpawnAuthority:
    MetaverseAuthoritativeResourceSpawnAuthority<MetaversePlayerWorldRuntimeState>;
  readonly #unmountedPlayerSimulation:
    MetaverseAuthoritativeUnmountedPlayerSimulation<
      MetaversePlayerWorldRuntimeState,
      MetaverseMountedOccupancyRuntimeState,
      MetaverseVehicleWorldRuntimeState
    >;
  readonly #vehicleDriveAuthority: MetaverseAuthoritativeVehicleDriveAuthority<
    MetaversePlayerWorldRuntimeState,
    MetaverseMountedOccupancyRuntimeState,
    MetaverseVehicleWorldRuntimeState,
    MetaverseDriverVehicleControlRuntimeState
  >;
  readonly #commandIntake: MetaverseAuthoritativeWorldCommandIntake;
  readonly #readState: MetaverseAuthoritativeWorldReadState<
    MetaversePlayerWorldRuntimeState,
    MetaverseEnvironmentBodyWorldRuntimeState,
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #tickState: MetaverseAuthoritativeWorldTickState;

  constructor(
    config: Partial<MetaverseAuthoritativeWorldRuntimeConfig> = {},
    bundleId = resolveDefaultAuthoritativeMetaverseMapBundleId(),
    launchVariationId: string | null = null
  ) {
    const bundleInputs = createMetaverseAuthoritativeWorldBundleInputs(bundleId);
    const launchVariation =
      (launchVariationId === null
        ? bundleInputs.bundle.launchVariations[0] ?? null
        : bundleInputs.bundle.launchVariations.find(
            (variation) => variation.variationId === launchVariationId
          ) ?? null);
    const weaponLayout = readMetaverseWeaponLayout(
      launchVariation?.weaponLayoutId ?? null
    );
    const groundedBodyConfig = Object.freeze({
      ...bundleInputs.gameplayProfile.groundedSurfacePolicy
    } satisfies MetaverseWorldSurfacePolicyConfig);
    const vehicleSurfaceDriveConfig = Object.freeze({
      ...bundleInputs.gameplayProfile.vehicleTraversal,
      worldRadius: bundleInputs.gameplayProfile.worldRadius
    } satisfies MetaverseAuthoritativeSurfaceTraversalConfig);
    const swimTraversalConfig = Object.freeze({
      ...bundleInputs.gameplayProfile.swimTraversal,
      worldRadius: bundleInputs.gameplayProfile.worldRadius
    } satisfies MetaverseAuthoritativeSurfaceTraversalConfig);
    const groundedBodyRuntimeConfig =
      createMetaverseAuthoritativeGroundedBodyRuntimeConfig(
        bundleInputs.gameplayProfile,
        bundleInputs.defaultSpawn.position
      );

    this.#config = {
      authoritativeCombatRewindEnabled:
        config.authoritativeCombatRewindEnabled ??
        metaverseAuthoritativeWorldRuntimeConfig.authoritativeCombatRewindEnabled,
      playerInactivityTimeoutMs:
        config.playerInactivityTimeoutMs ??
        metaverseAuthoritativeWorldRuntimeConfig.playerInactivityTimeoutMs,
      tickIntervalMs:
        config.tickIntervalMs ??
        metaverseAuthoritativeWorldRuntimeConfig.tickIntervalMs
    };
    this.#bootEnvironmentBodies(bundleInputs.environmentBodySeedSnapshots);
    this.#playerLifecycleAuthority =
      new MetaverseAuthoritativePlayerLifecycleAuthority({
        driverVehicleControlsByPlayerId: this.#driverVehicleControlsByPlayerId,
        incrementSnapshotSequence: () => {
          this.#tickState.incrementSnapshotSequence();
        },
        playerInactivityTimeoutMs: Number(this.#config.playerInactivityTimeoutMs),
        removePlayerTraversalColliderHandle: (handle) => {
          this.#playerTraversalColliderHandles.delete(handle);
          this.#playerTraversalColliderOwnerByHandle.delete(handle);
        },
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
        vehiclesById: this.#vehiclesById
      });
    this.#surfaceState = new MetaverseAuthoritativeWorldSurfaceState({
      dynamicCollisionMeshSeedSnapshots:
        bundleInputs.dynamicCollisionMeshSeedSnapshots,
      dynamicSurfaceSeedSnapshots: bundleInputs.dynamicSurfaceSeedSnapshots,
      groundedBodyConfig,
      physicsRuntime: this.#physicsRuntime,
      playerTraversalColliderHandles: this.#playerTraversalColliderHandles,
      resolveDynamicSurfaceColliders:
        bundleInputs.resolveDynamicSurfaceColliders,
      staticCollisionMeshSeedSnapshots:
        bundleInputs.staticCollisionMeshSeedSnapshots,
      staticSurfaceColliders: bundleInputs.staticSurfaceColliders,
      syncUnmountedPlayerToGroundedSupport: (
        playerRuntime,
        supportHeightMeters
      ) =>
        this.#playerStateSync.syncUnmountedPlayerToGroundedSupport(
          playerRuntime,
          supportHeightMeters,
          0
        ),
      syncUnmountedPlayerToSwimWaterline: (
        playerRuntime,
        waterlineHeightMeters
      ) =>
        this.#playerStateSync.syncUnmountedPlayerToSwimWaterline(
          playerRuntime,
          waterlineHeightMeters,
          0
        ),
      vehicleDriveColliderHandles: this.#vehicleDriveColliderHandles,
      waterRegionSnapshots: bundleInputs.waterRegionSnapshots
    });
    this.#vehicleRuntimeRegistry =
      new MetaverseAuthoritativeVehicleRuntimeRegistry({
        controllerOffsetMeters:
          groundedBodyRuntimeConfig.controllerOffsetMeters,
        physicsRuntime: this.#physicsRuntime,
        readSurfaceAsset: bundleInputs.readSurfaceAsset,
        syncVehicleDynamicSurfaceColliders: (vehicleRuntime) =>
          this.#surfaceState.syncDynamicSurfaceColliders(vehicleRuntime),
        vehicleDriveColliderHandles: this.#vehicleDriveColliderHandles,
        vehicleSurfaceWorldRadius: vehicleSurfaceDriveConfig.worldRadius,
        vehiclesById: this.#vehiclesById
      });
    this.#playerStateSync = new MetaverseAuthoritativePlayerStateSync({
      addPlayerTraversalColliderHandle: (playerId, handle) => {
        this.#playerTraversalColliderHandles.add(handle);
        this.#playerTraversalColliderOwnerByHandle.set(handle, playerId);
      },
      createGroundedBodyRuntime: () => {
        const groundedBodyRuntime = new MetaverseAuthoritativeGroundedBodyRuntime(
          groundedBodyRuntimeConfig,
          this.#physicsRuntime
        );

        groundedBodyRuntime.syncInteractionSnapshot({
          applyImpulsesToDynamicBodies:
            this.#environmentBodiesByEnvironmentAssetId.size > 0
        });

        return groundedBodyRuntime;
      },
      createInitialPlayerWeaponState: (playerId) =>
        createPlayerWeaponStateFromLayout(weaponLayout, playerId),
      createSwimBodyRuntime: () =>
        new MetaverseAuthoritativeSurfaceDriveRuntime(
          {
            controllerOffsetMeters:
              groundedBodyRuntimeConfig.controllerOffsetMeters,
            shape: {
              halfHeightMeters:
                groundedBodyConfig.capsuleHalfHeightMeters,
              kind: "capsule",
              radiusMeters:
                groundedBodyConfig.capsuleRadiusMeters
            },
            spawnPosition: createPhysicsVector3Snapshot(
              bundleInputs.defaultSpawn.position.x,
              bundleInputs.defaultSpawn.position.y,
              bundleInputs.defaultSpawn.position.z
            ),
            spawnYawRadians: bundleInputs.defaultSpawn.yawRadians,
            worldRadius: swimTraversalConfig.worldRadius
          },
          this.#physicsRuntime
      ),
      initialYawRadians: bundleInputs.defaultSpawn.yawRadians,
      readCurrentTick: () => this.#tickState.currentTick,
      resolvePlayerActiveTraversalAction: (playerRuntime) =>
        resolvePlayerActiveTraversalAction(playerRuntime)
    });
    this.#mountedOccupancyAuthority =
      new MetaverseAuthoritativeMountedOccupancyAuthority({
        clearDriverVehicleControl: (playerId) =>
          this.#playerLifecycleAuthority.clearDriverVehicleControl(playerId),
        clearPlayerTraversalIntent: (playerId) =>
          this.#playerLifecycleAuthority.clearPlayerTraversalIntent(playerId),
        clearPlayerVehicleOccupancy: (playerId) =>
          this.#playerLifecycleAuthority.clearPlayerVehicleOccupancy(playerId),
        ensureVehicleRuntime: (environmentAssetId, vehicleId) =>
          this.#vehicleRuntimeRegistry.ensureVehicleRuntime(
            environmentAssetId,
            vehicleId
          ),
        incrementSnapshotSequence: () => {
          this.#tickState.incrementSnapshotSequence();
        },
        playersById: this.#playersById,
        readMountedEntryAuthoring: (environmentAssetId, entryId) =>
          this.#vehicleRuntimeRegistry.readMountedEntryAuthoring(
            environmentAssetId,
            entryId
          ),
        readMountedSeatAuthoring: (environmentAssetId, seatId) =>
          this.#vehicleRuntimeRegistry.readMountedSeatAuthoring(
            environmentAssetId,
            seatId
          ),
        resolveAuthoritativeSurfaceColliders: () =>
          this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
        resolveVehicleId: (environmentAssetId) =>
          this.#vehicleRuntimeRegistry.resolveVehicleId(environmentAssetId),
        syncAuthoritativePlayerLookToCurrentFacing: (playerRuntime) =>
          this.#playerStateSync.syncAuthoritativePlayerLookToCurrentFacing(
            playerRuntime
          ),
        syncMountedPlayerPoseFromVehicle: (playerRuntime, vehicleRuntime, nowMs) =>
          this.#playerStateSync.syncMountedPlayerPoseFromVehicle(
            playerRuntime,
            vehicleRuntime,
            nowMs
          ),
        syncPlayerTraversalAuthorityState: (playerRuntime) =>
          this.#playerStateSync.syncPlayerTraversalAuthorityState(playerRuntime),
        syncUnmountedPlayerToAuthoritativeSurface: (
          playerRuntime,
          authoritativeSurfaceColliders,
          excludedOwnerEnvironmentAssetId
        ) =>
          this.#surfaceState.syncUnmountedPlayerToAuthoritativeSurface(
            playerRuntime,
            authoritativeSurfaceColliders,
            excludedOwnerEnvironmentAssetId
          ),
        syncVehicleOccupancyAndInitialPoseFromPlayer: (
          playerRuntime,
          mountedOccupancy,
          nowMs
        ) =>
          this.#vehicleRuntimeRegistry.syncVehicleOccupancyAndInitialPoseFromPlayer(
            playerRuntime,
            mountedOccupancy,
            nowMs
          )
      });
    this.#playerPoseAuthority = new MetaverseAuthoritativePlayerPoseAuthority({
      clearDriverVehicleControl: (playerId) =>
        this.#playerLifecycleAuthority.clearDriverVehicleControl(playerId),
      clearPlayerTraversalIntent: (playerId) =>
        this.#playerLifecycleAuthority.clearPlayerTraversalIntent(playerId),
      clearPlayerVehicleOccupancy: (playerId) =>
        this.#playerLifecycleAuthority.clearPlayerVehicleOccupancy(playerId),
      createPlayerRuntimeState: (
        playerId,
        characterId,
        teamId,
        username,
        nowMs
      ) =>
        this.#playerStateSync.createPlayerRuntimeState(
          playerId,
          characterId,
          teamId,
          username,
          nowMs
        ),
      incrementSnapshotSequence: () => {
        this.#tickState.incrementSnapshotSequence();
      },
      mountedOccupancyAuthority: this.#mountedOccupancyAuthority,
      playersById: this.#playersById,
      resolveAcceptedTeamId: (_playerId, requestedTeamId) =>
        this.#resolveAcceptedPlayerTeamId(requestedTeamId),
      resolveAuthoritativeSurfaceColliders: () =>
        this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
      resolveJoinPose: (playerId, teamId, nextPose) =>
        this.#resolveJoinPoseFromSpawnSelection(
          playerId,
          teamId,
          nextPose,
          bundleInputs
        ),
      resolveConstrainedPlayerLookIntent: (
        playerRuntime,
        pitchRadians,
        yawRadians
      ) =>
        this.#playerStateSync.resolveConstrainedPlayerLookIntent(
          playerRuntime,
          pitchRadians,
          yawRadians
        ),
      syncImplicitPlayerLookFromBodyYaw: (playerRuntime) =>
        this.#playerStateSync.syncImplicitPlayerLookFromBodyYaw(playerRuntime),
      syncMountedPlayerPoseFromVehicle: (
        playerRuntime,
        vehicleRuntime,
        nowMs,
        previousFacingYawRadians
      ) =>
        this.#playerStateSync.syncMountedPlayerPoseFromVehicle(
          playerRuntime,
          vehicleRuntime,
          nowMs,
          previousFacingYawRadians
        ),
      syncPlayerTraversalAuthorityState: (playerRuntime) =>
        this.#playerStateSync.syncPlayerTraversalAuthorityState(playerRuntime),
      syncPlayerTraversalBodyRuntimes: (playerRuntime) =>
        this.#playerStateSync.syncPlayerTraversalBodyRuntimes(playerRuntime),
      syncUnmountedPlayerToAuthoritativeSurface: (
        playerRuntime,
        authoritativeSurfaceColliders,
        excludedOwnerEnvironmentAssetId
      ) =>
        this.#surfaceState.syncUnmountedPlayerToAuthoritativeSurface(
          playerRuntime,
          authoritativeSurfaceColliders,
          excludedOwnerEnvironmentAssetId
        ),
      syncVehicleOccupancyAndInitialPoseFromPlayer: (
        playerRuntime,
        mountedOccupancy,
        nowMs
      ) =>
        this.#vehicleRuntimeRegistry.syncVehicleOccupancyAndInitialPoseFromPlayer(
          playerRuntime,
          mountedOccupancy,
          nowMs
        )
    });
    this.#playerTraversalAuthority =
      new MetaverseAuthoritativePlayerTraversalAuthority({
        incrementSnapshotSequence: () => {
          this.#tickState.incrementSnapshotSequence();
        },
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
        readLastAdvancedAtMs: () => this.#tickState.lastAdvancedAtMs,
        readTickIntervalMs: () => Number(this.#config.tickIntervalMs),
        resolveConstrainedPlayerLookIntent: (
          playerRuntime,
          pitchRadians,
          yawRadians
        ) =>
          this.#playerStateSync.resolveConstrainedPlayerLookIntent(
            playerRuntime,
            pitchRadians,
            yawRadians
          ),
        syncPlayerTraversalAuthorityState: (playerRuntime) =>
          this.#playerStateSync.syncPlayerTraversalAuthorityState(playerRuntime)
      });
    this.#playerWeaponStateAuthority =
      new MetaverseAuthoritativePlayerWeaponStateAuthority({
        incrementSnapshotSequence: () => {
          this.#tickState.incrementSnapshotSequence();
        },
        playersById: this.#playersById,
        resolveCanonicalWeaponState: (playerRuntime, command) => {
          if (weaponLayout === null) {
            return command.weaponState;
          }

          if (playerRuntime.weaponState !== null) {
            const requestedActiveSlotId = playerRuntime.weaponState.activeSlotId;
            const activeSlot =
              playerRuntime.weaponState.slots.find(
                (slot) => slot.equipped && slot.slotId === requestedActiveSlotId
              ) ??
              playerRuntime.weaponState.slots.find(
                (slot) =>
                  slot.equipped &&
                  slot.slotId === playerRuntime.weaponState?.activeSlotId
              ) ??
              playerRuntime.weaponState.slots.find((slot) => slot.equipped) ??
              null;

            if (activeSlot === null) {
              return null;
            }

            return createMetaverseRealtimePlayerWeaponStateSnapshot({
              activeSlotId: activeSlot.slotId,
              aimMode:
                command.weaponState?.aimMode ??
                playerRuntime.weaponState.aimMode ??
                "hip-fire",
              slots: playerRuntime.weaponState.slots,
              weaponId: activeSlot.weaponId
            });
          }

          const requestedActiveSlotId =
            command.requestedActiveSlotId ??
            command.weaponState?.activeSlotId ??
            weaponLayout.activeSlotId ??
            null;

          return createPlayerWeaponStateFromLayout(
            weaponLayout,
            playerRuntime.playerId,
            requestedActiveSlotId,
            command.weaponState?.aimMode ?? "hip-fire"
          );
        }
      });
    this.#combatAuthority = new MetaverseAuthoritativeCombatAuthority({
      authoritativeCombatRewindEnabled:
        this.#config.authoritativeCombatRewindEnabled,
      clearDriverVehicleControl: (playerId) =>
        this.#playerLifecycleAuthority.clearDriverVehicleControl(playerId),
      clearPlayerTraversalIntent: (playerId) =>
        this.#playerLifecycleAuthority.clearPlayerTraversalIntent(playerId),
      clearPlayerVehicleOccupancy: (playerId) =>
        this.#playerLifecycleAuthority.clearPlayerVehicleOccupancy(playerId),
      incrementSnapshotSequence: () => {
        this.#tickState.incrementSnapshotSequence();
      },
      killFloorVolumes: Object.freeze(
        bundleInputs.bundle.semanticWorld.gameplayVolumes.filter(
          (volume) => volume.volumeKind === "kill-floor"
        )
      ),
      matchMode: launchVariation?.matchMode ?? null,
      physicsRuntime: this.#physicsRuntime,
      playerTraversalColliderHandles: this.#playerTraversalColliderHandles,
      playersById: this.#playersById,
      readCurrentTick: () => this.#tickState.currentTick,
      readWorldImpactSurface: (collider) =>
        this.#surfaceState.readCombatImpactSurface(collider),
      readTickIntervalMs: () => Number(this.#config.tickIntervalMs),
      resolveRespawnPose: (playerId, teamId) =>
        this.#resolveRespawnPose(playerId, teamId, bundleInputs),
      syncAuthoritativePlayerLookToCurrentFacing: (playerRuntime) =>
        this.#playerStateSync.syncAuthoritativePlayerLookToCurrentFacing(
          playerRuntime
        ),
      syncPlayerTraversalAuthorityState: (playerRuntime) =>
        this.#playerStateSync.syncPlayerTraversalAuthorityState(playerRuntime),
      syncPlayerTraversalBodyRuntimes: (playerRuntime, groundedOverride) =>
        this.#playerStateSync.syncPlayerTraversalBodyRuntimes(
          playerRuntime,
          groundedOverride
        )
    });
    this.#resourceSpawnAuthority = new MetaverseAuthoritativeResourceSpawnAuthority({
      grantWeaponResourcePickup: ({ nowMs, playerRuntime, resourceSpawn }) =>
        this.#combatAuthority.grantWeaponResourcePickup(
          playerRuntime,
          resourceSpawn,
          nowMs
        ),
      interactWeaponResource: ({ action, nowMs, playerRuntime, resourceSpawn }) =>
        this.#combatAuthority.acceptInteractWeaponResourceAction({
          action,
          nowMs,
          playerRuntime,
          resourceSpawn
        }),
      incrementSnapshotSequence: () => {
        this.#tickState.incrementSnapshotSequence();
      },
      matchMode: launchVariation?.matchMode ?? null,
      playersById: this.#playersById,
      resourceSpawns: bundleInputs.bundle.resourceSpawns
    });
    this.#unmountedPlayerSimulation =
      new MetaverseAuthoritativeUnmountedPlayerSimulation({
        createWaterborneTraversalColliderPredicate: (
          playerRuntime,
          excludedOwnerEnvironmentAssetId,
          excludedColliders
        ) =>
          this.#createPlayerWaterborneTraversalColliderPredicate(
            playerRuntime,
            excludedOwnerEnvironmentAssetId,
            excludedColliders
          ),
        groundedBodyConfig,
        groundedBodyRuntimeConfig,
        playerStateSync: this.#playerStateSync,
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
        resolveGroundedTraversalPlayerBlockers: (playerRuntime) =>
          this.#resolveGroundedTraversalPlayerBlockers(
            playerRuntime,
            groundedBodyConfig
          ),
        resolveAuthoritativeSurfaceColliders: () =>
          this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
        swimTraversalConfig,
        waterRegionSnapshots: bundleInputs.waterRegionSnapshots
      });
    this.#vehicleDriveAuthority = new MetaverseAuthoritativeVehicleDriveAuthority({
      createWaterborneTraversalColliderPredicate: (
        excludedOwnerEnvironmentAssetId
      ) =>
        this.#surfaceState.createWaterborneTraversalColliderPredicate(
          excludedOwnerEnvironmentAssetId
        ),
      driverVehicleControlsByPlayerId: this.#driverVehicleControlsByPlayerId,
      playersById: this.#playersById,
      resolveAuthoritativeSurfaceColliders: () =>
        this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
      surfacePolicyConfig: groundedBodyConfig,
      syncMountedPlayerPoseFromVehicle: (playerRuntime, vehicleRuntime, nowMs) =>
        this.#playerStateSync.syncMountedPlayerPoseFromVehicle(
          playerRuntime,
          vehicleRuntime,
          nowMs
        ),
      syncVehicleDynamicSurfaceColliders: (vehicleRuntime) =>
        this.#surfaceState.syncDynamicSurfaceColliders(vehicleRuntime),
      vehicleSurfaceTraversalConfig: vehicleSurfaceDriveConfig,
      vehiclesById: this.#vehiclesById,
      waterRegionSnapshots: bundleInputs.waterRegionSnapshots
    });
    this.#tickState = new MetaverseAuthoritativeWorldTickState({
      advanceCombatRuntimes: (tickIntervalSeconds, nowMs) =>
        this.#combatAuthority.advanceCombatRuntimes(
          tickIntervalSeconds,
          nowMs
        ),
      advanceResourceSpawns: (tickIntervalSeconds, nowMs) =>
        this.#resourceSpawnAuthority.advanceResourceSpawns(
          tickIntervalSeconds,
          nowMs
        ),
      physicsRuntime: this.#physicsRuntime,
      readTickIntervalMs: () => Number(this.#config.tickIntervalMs),
      syncMountedPlayerWorldStateFromVehicles: (nowMs) =>
        this.#vehicleDriveAuthority.syncMountedPlayerWorldStateFromVehicles(
          nowMs
        ),
      advanceUnmountedPlayerRuntimes: (tickIntervalSeconds, nowMs) =>
        this.#unmountedPlayerSimulation.advanceUnmountedPlayerRuntimes(
          tickIntervalSeconds,
          nowMs
        ),
      advanceVehicleRuntimes: (tickIntervalSeconds, nowMs) =>
        this.#vehicleDriveAuthority.advanceVehicleRuntimes(
          tickIntervalSeconds,
          nowMs
        )
    });
    this.#readState = new MetaverseAuthoritativeWorldReadState({
      environmentBodiesByEnvironmentAssetId:
        this.#environmentBodiesByEnvironmentAssetId,
      playersById: this.#playersById,
      readCombatEventSnapshots: () =>
        this.#combatAuthority.readCombatEventSnapshots(),
      readCombatFeedSnapshots: () => this.#combatAuthority.readCombatFeedSnapshots(),
      readCombatMatchSnapshot: () => this.#combatAuthority.readCombatMatchSnapshot(),
      readPlayerCombatActionObserverSnapshot: (playerId) =>
        this.#combatAuthority.readPlayerCombatActionObserverSnapshot(playerId),
      readPlayerCombatSnapshot: (playerId) =>
        this.#combatAuthority.readPlayerCombatSnapshot(playerId),
      readProjectileSnapshots: () => this.#combatAuthority.readProjectileSnapshots(),
      readResourceSpawnSnapshots: () =>
        this.#resourceSpawnAuthority.readResourceSpawnSnapshots(),
      readCurrentTick: () => this.#tickState.currentTick,
      readLastAdvancedAtMs: () => this.#tickState.lastAdvancedAtMs,
      readSnapshotSequence: () => this.#tickState.snapshotSequence,
      readTickIntervalMs: () => Number(this.#config.tickIntervalMs),
      syncGameplayState: (nowMs) => this.#combatAuthority.syncCombatState(nowMs),
      traversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
      vehiclesById: this.#vehiclesById
    });
    this.#commandIntake = new MetaverseAuthoritativeWorldCommandIntake({
      advanceToTime: (nowMs) => this.advanceToTime(nowMs),
      combatAuthority: this.#combatAuthority,
      mountedOccupancyAuthority: this.#mountedOccupancyAuthority,
      playerLifecycleAuthority: this.#playerLifecycleAuthority,
      playerPoseAuthority: this.#playerPoseAuthority,
      playerTraversalAuthority: this.#playerTraversalAuthority,
      playerWeaponStateAuthority: this.#playerWeaponStateAuthority,
      resourceAuthority: this.#resourceSpawnAuthority,
      readPresenceRosterEvent: (nowMs) => this.readPresenceRosterEvent(nowMs),
      readWorldEvent: (nowMs) => this.readWorldEvent(nowMs),
      vehicleDriveAuthority: this.#vehicleDriveAuthority
    });

    this.#physicsRuntime.stepSimulation(
      Number(this.#config.tickIntervalMs) / 1_000
    );
    this.#syncEnvironmentBodyWorldRuntimeStates();
  }

  get tickIntervalMs(): number {
    return Number(this.#config.tickIntervalMs);
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    return this.#readState.readPresenceRosterSnapshot(nowMs, observerPlayerId);
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return this.#readState.readPresenceRosterEvent(nowMs, observerPlayerId);
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    return this.#readState.readWorldSnapshot(nowMs, observerPlayerId);
  }

  advanceToTime(nowMs: number): void {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#tickState.advanceToTime(normalizedNowMs);
    this.#syncEnvironmentBodyWorldRuntimeStates();
    this.#pruneInactivePlayers(normalizedNowMs);
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    return this.#readState.readWorldEvent(nowMs, observerPlayerId);
  }

  acceptPresenceCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    return this.#commandIntake.acceptPresenceCommand(command, nowMs);
  }

  acceptWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    return this.#commandIntake.acceptWorldCommand(command, nowMs);
  }

  requestNextTeamDeathmatch(nowMs: number): boolean {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#combatAuthority.syncCombatState(normalizedNowMs);

    if (this.#combatAuthority.readCombatMatchSnapshot().phase !== "completed") {
      return false;
    }

    this.#shuffleTeamDeathmatchTeams(normalizedNowMs);

    return this.#combatAuthority.requestNextTeamDeathmatch(normalizedNowMs);
  }

  #shuffleTeamDeathmatchTeams(nowMs: number): void {
    const players = [...this.#playersById.values()].sort((leftPlayer, rightPlayer) =>
      leftPlayer.playerId.localeCompare(rightPlayer.playerId)
    );

    if (players.length < 2) {
      return;
    }

    const playerIds = players.map((playerRuntime) => playerRuntime.playerId);
    let seed = resolveNextMatchShuffleSeed(nowMs, playerIds);

    for (let index = players.length - 1; index > 0; index -= 1) {
      seed = advanceNextMatchShuffleSeed(seed);
      const swapIndex = seed % (index + 1);
      const playerRuntime = players[index];

      players[index] = players[swapIndex]!;
      players[swapIndex] = playerRuntime!;
    }

    for (let index = 0; index < players.length; index += 1) {
      const playerRuntime = players[index];

      if (playerRuntime === undefined) {
        continue;
      }

      writePlayerTeamId(playerRuntime, index % 2 === 0 ? "red" : "blue");
    }
  }

  #createOccupiedPlayerSpawnSnapshots(): readonly {
    readonly position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly teamId: MetaversePlayerTeamId;
  }[] {
    return Object.freeze(
      [...this.#playersById.values()].map((playerRuntime) =>
        Object.freeze({
          position: Object.freeze({
            x: playerRuntime.positionX,
            y: playerRuntime.positionY,
            z: playerRuntime.positionZ
          }),
          teamId: playerRuntime.teamId
        })
      )
    );
  }

  #resolveAcceptedPlayerTeamId(
    requestedTeamId: MetaversePlayerTeamId
  ): MetaversePlayerTeamId {
    return requestedTeamId;
  }

  #shouldResolveJoinSpawnPose(
    requestedPose: MetaversePresencePoseSnapshot,
    bundleInputs: ReturnType<typeof createMetaverseAuthoritativeWorldBundleInputs>
  ): boolean {
    const matchingSpawnNode =
      bundleInputs.bundle.playerSpawnNodes.find(
        (spawnNode) =>
          positionsApproximatelyMatch(requestedPose.position, spawnNode.position) &&
          Math.abs(
            readWrappedYawDeltaRadians(
              requestedPose.yawRadians,
              spawnNode.yawRadians
            )
          ) <= 0.0001
      ) ?? null;

    return (
      requestedPose.mountedOccupancy === null &&
      requestedPose.locomotionMode === "grounded" &&
      matchingSpawnNode !== null
    );
  }

  #resolveJoinPoseFromSpawnSelection(
    playerId: MetaversePlayerId,
    playerTeamId: MetaversePlayerTeamId,
    requestedPose: MetaversePresencePoseSnapshot,
    bundleInputs: ReturnType<typeof createMetaverseAuthoritativeWorldBundleInputs>
  ): MetaversePresencePoseSnapshot {
    if (!this.#shouldResolveJoinSpawnPose(requestedPose, bundleInputs)) {
      return requestedPose;
    }

    const selectedSpawnNode =
      resolveMetaverseMapPlayerSpawnNode({
        occupiedPlayerSnapshots: this.#createOccupiedPlayerSpawnSnapshots(),
        playerId,
        playerSpawnNodes: bundleInputs.bundle.playerSpawnNodes,
        playerSpawnSelection: bundleInputs.bundle.playerSpawnSelection,
        playerTeamId
      }) ?? null;

    if (selectedSpawnNode === null) {
      return requestedPose;
    }

    const spawnPosition = resolveMetaverseMapPlayerSpawnSupportPosition({
      compiledWorld: bundleInputs.bundle.compiledWorld,
      spawnPosition: selectedSpawnNode.position
    });

    return createMetaversePresencePoseSnapshot({
      animationVocabulary: requestedPose.animationVocabulary,
      look: {
        pitchRadians: requestedPose.look.pitchRadians,
        yawRadians:
          selectedSpawnNode.yawRadians +
          (requestedPose.look.yawRadians - requestedPose.yawRadians)
      },
      locomotionMode: requestedPose.locomotionMode,
      mountedOccupancy: requestedPose.mountedOccupancy,
      position: spawnPosition,
      stateSequence: requestedPose.stateSequence,
      yawRadians: selectedSpawnNode.yawRadians
    });
  }

  #resolveRespawnPose(
    playerId: MetaversePlayerId,
    playerTeamId: MetaversePlayerTeamId,
    bundleInputs: ReturnType<typeof createMetaverseAuthoritativeWorldBundleInputs>
  ): {
    readonly position: PhysicsVector3Snapshot;
    readonly yawRadians: number;
  } {
    const selectedSpawnNode =
      resolveMetaverseMapPlayerSpawnNode({
        occupiedPlayerSnapshots: this.#createOccupiedPlayerSpawnSnapshots(),
        playerId,
        playerSpawnNodes: bundleInputs.bundle.playerSpawnNodes,
        playerSpawnSelection: bundleInputs.bundle.playerSpawnSelection,
        playerTeamId
      }) ?? bundleInputs.defaultSpawn;
    const spawnPosition = resolveMetaverseMapPlayerSpawnSupportPosition({
      compiledWorld: bundleInputs.bundle.compiledWorld,
      spawnPosition: selectedSpawnNode.position
    });

    return Object.freeze({
      position: spawnPosition,
      yawRadians: selectedSpawnNode.yawRadians
    });
  }

  #resolveGroundedTraversalPlayerBlockers(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    groundedBodyConfig: MetaverseWorldSurfacePolicyConfig
  ): readonly MetaverseTraversalPlayerBodyBlockerSnapshot[] {
    const blockers: MetaverseTraversalPlayerBodyBlockerSnapshot[] = [];

    for (const ownerPlayerRuntime of this.#playersById.values()) {
      if (
        ownerPlayerRuntime.playerId === playerRuntime.playerId ||
        !this.#combatAuthority.isPlayerAlive(ownerPlayerRuntime.playerId) ||
        !shouldTreatMetaversePlayerPoseAsTraversalBlocker(
          ownerPlayerRuntime.locomotionMode,
          ownerPlayerRuntime.mountedOccupancy
        )
      ) {
        continue;
      }

      blockers.push(
        Object.freeze({
          capsuleHalfHeightMeters: groundedBodyConfig.capsuleHalfHeightMeters,
          capsuleRadiusMeters: groundedBodyConfig.capsuleRadiusMeters,
          playerId: ownerPlayerRuntime.playerId,
          position: ownerPlayerRuntime.groundedBodyRuntime.snapshot.position
        })
      );
    }

    return Object.freeze(blockers);
  }

  #createPlayerWaterborneTraversalColliderPredicate(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    excludedOwnerEnvironmentAssetId: string | null = null,
    excludedColliders: readonly RapierColliderHandle[] = Object.freeze([])
  ): RapierQueryFilterPredicate {
    const basePredicate = this.#surfaceState.createWaterborneTraversalColliderPredicate(
      excludedOwnerEnvironmentAssetId,
      [
        playerRuntime.groundedBodyRuntime.colliderHandle,
        playerRuntime.swimBodyRuntime.colliderHandle,
        ...excludedColliders
      ]
    );

    return (collider) => {
      if (!basePredicate(collider)) {
        return false;
      }

      const ownerPlayerId =
        this.#playerTraversalColliderOwnerByHandle.get(collider);

      if (ownerPlayerId === undefined) {
        return true;
      }

      const ownerPlayerRuntime = this.#playersById.get(ownerPlayerId);

      return (
        ownerPlayerRuntime !== undefined &&
        ownerPlayerRuntime.playerId !== playerRuntime.playerId &&
        this.#isPlayerActiveTraversalCollider(ownerPlayerRuntime, collider) &&
        this.#combatAuthority.isPlayerAlive(ownerPlayerRuntime.playerId) &&
        shouldTreatMetaversePlayerPoseAsTraversalBlocker(
          ownerPlayerRuntime.locomotionMode,
          ownerPlayerRuntime.mountedOccupancy
        )
      );
    };
  }

  #isPlayerActiveTraversalCollider(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    collider: RapierColliderHandle
  ): boolean {
    return playerRuntime.locomotionMode === "swim"
      ? collider === playerRuntime.swimBodyRuntime.colliderHandle
      : collider === playerRuntime.groundedBodyRuntime.colliderHandle;
  }

  #pruneInactivePlayers(nowMs: number): void {
    this.#playerLifecycleAuthority.pruneInactivePlayers(nowMs);
  }

  #bootEnvironmentBodies(
    environmentBodySeedSnapshots: readonly {
      readonly config: MetaverseAuthoritativeDynamicCuboidBodyConfig;
      readonly environmentAssetId: string;
    }[]
  ): void {
    for (const environmentBodySeedSnapshot of environmentBodySeedSnapshots) {
      const bodyRuntime = new MetaverseAuthoritativeDynamicCuboidBodyRuntime(
        environmentBodySeedSnapshot.config,
        this.#physicsRuntime
      );

      this.#environmentBodiesByEnvironmentAssetId.set(
        environmentBodySeedSnapshot.environmentAssetId,
        createEnvironmentBodyWorldRuntimeState(
          bodyRuntime,
          environmentBodySeedSnapshot.environmentAssetId
        )
      );
    }
  }

  #syncEnvironmentBodyWorldRuntimeStates(): void {
    for (const environmentBodyRuntime of this.#environmentBodiesByEnvironmentAssetId.values()) {
      const snapshot = environmentBodyRuntime.bodyRuntime.syncSnapshot();

      environmentBodyRuntime.linearVelocityX = snapshot.linearVelocity.x;
      environmentBodyRuntime.linearVelocityY = snapshot.linearVelocity.y;
      environmentBodyRuntime.linearVelocityZ = snapshot.linearVelocity.z;
      environmentBodyRuntime.positionX = snapshot.position.x;
      environmentBodyRuntime.positionY = snapshot.position.y;
      environmentBodyRuntime.positionZ = snapshot.position.z;
      environmentBodyRuntime.yawRadians = snapshot.yawRadians;
      this.#surfaceState.syncDynamicSurfaceColliders(environmentBodyRuntime);
    }
  }

}
