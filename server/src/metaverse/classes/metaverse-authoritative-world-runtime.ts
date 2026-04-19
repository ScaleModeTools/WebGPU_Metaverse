import {
  resolveMetaverseTraversalKinematicActionSnapshot,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseSurfaceTraversalConfig,
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";
import {
  shouldTreatMetaversePlayerPoseAsTraversalBlocker,
  type MetaversePlayerId,
  type MetaversePresenceCommand,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimeWorldClientCommand,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

import { metaverseAuthoritativeWorldRuntimeConfig } from "../config/metaverse-authoritative-world-runtime.js";
import {
  MetaverseAuthoritativeGroundedBodyRuntime,
  type MetaverseAuthoritativeGroundedBodyConfig
} from "./metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "./metaverse-authoritative-surface-drive-runtime.js";
import {
  MetaverseAuthoritativeDynamicCuboidBodyRuntime
} from "./metaverse-authoritative-dynamic-cuboid-body-runtime.js";
import {
  MetaverseAuthoritativePlayerStateSync,
  type MetaverseAuthoritativePlayerStateSyncRuntimeState
} from "../authority/players/metaverse-authoritative-player-state-sync.js";
import {
  createMetaverseAuthoritativeWorldEvent
} from "../authority/snapshots/metaverse-authoritative-world-snapshot-assembly.js";
import { MetaverseAuthoritativePlayerLifecycleAuthority } from "../authority/players/metaverse-authoritative-player-lifecycle-authority.js";
import { MetaverseAuthoritativeMountedOccupancyAuthority } from "../authority/mounted/metaverse-authoritative-mounted-occupancy-authority.js";
import { MetaverseAuthoritativePlayerPoseAuthority } from "../authority/players/metaverse-authoritative-player-pose-authority.js";
import {
  MetaverseAuthoritativePlayerTraversalAuthority,
  type MetaverseAuthoritativePlayerTraversalIntentRuntimeState
} from "../authority/traversal/metaverse-authoritative-player-traversal-authority.js";
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
      readonly airborneMovementDampingFactor: number;
      readonly baseSpeedUnitsPerSecond: number;
      readonly boostCurveExponent: number;
      readonly boostMultiplier: number;
      readonly capsuleHalfHeightMeters: number;
      readonly capsuleRadiusMeters: number;
      readonly controllerOffsetMeters: number;
      readonly decelerationUnitsPerSecondSquared: number;
      readonly dragCurveExponent: number;
      readonly gravityUnitsPerSecond: number;
      readonly jumpGroundContactGraceSeconds: number;
      readonly jumpImpulseUnitsPerSecond: number;
      readonly maxSlopeClimbAngleRadians: number;
      readonly maxTurnSpeedRadiansPerSecond: number;
      readonly minSlopeSlideAngleRadians: number;
      readonly snapToGroundDistanceMeters: number;
      readonly stepHeightMeters: number;
      readonly stepWidthMeters: number;
    };
    readonly worldRadius: number;
  },
  spawnPosition: PhysicsVector3Snapshot
): MetaverseAuthoritativeGroundedBodyConfig {
  return Object.freeze({
    ...gameplayProfile.groundedBodyTraversal,
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

function resolvePlayerActiveTraversalAction(
  playerRuntime: MetaversePlayerWorldRuntimeState
): MetaverseTraversalActiveActionSnapshot {
  const groundedBodySnapshot = playerRuntime.groundedBodyRuntime.snapshot;

  return resolveMetaverseTraversalKinematicActionSnapshot({
    grounded: groundedBodySnapshot.grounded,
    locomotionMode:
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
    mounted: playerRuntime.mountedOccupancy !== null,
    verticalSpeedUnitsPerSecond:
      groundedBodySnapshot.verticalSpeedUnitsPerSecond
  });
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
    bundleId = resolveDefaultAuthoritativeMetaverseMapBundleId()
  ) {
    const bundleInputs = createMetaverseAuthoritativeWorldBundleInputs(bundleId);
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
      syncPlayerTraversalBodyRuntimes: (playerRuntime, grounded) =>
        this.#playerStateSync.syncPlayerTraversalBodyRuntimes(
          playerRuntime,
          grounded
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

        groundedBodyRuntime.setApplyImpulsesToDynamicBodies(
          this.#environmentBodiesByEnvironmentAssetId.size > 0
        );

        return groundedBodyRuntime;
      },
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
      createPlayerRuntimeState: (playerId, characterId, username, nowMs) =>
        this.#playerStateSync.createPlayerRuntimeState(
          playerId,
          characterId,
          username,
          nowMs
        ),
      incrementSnapshotSequence: () => {
        this.#tickState.incrementSnapshotSequence();
      },
      mountedOccupancyAuthority: this.#mountedOccupancyAuthority,
      playersById: this.#playersById,
      resolveAuthoritativeSurfaceColliders: () =>
        this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
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
        createGroundedTraversalColliderPredicate: (
          playerRuntime,
          excludedColliders
        ) =>
          this.#createPlayerGroundedTraversalColliderPredicate(
            playerRuntime,
            excludedColliders
          ),
        groundedBodyConfig,
        groundedBodyRuntimeConfig: {
          controllerOffsetMeters:
            groundedBodyRuntimeConfig.controllerOffsetMeters,
          maxTurnSpeedRadiansPerSecond:
            groundedBodyRuntimeConfig.maxTurnSpeedRadiansPerSecond,
          snapToGroundDistanceMeters:
            groundedBodyRuntimeConfig.snapToGroundDistanceMeters,
          stepHeightMeters: groundedBodyConfig.stepHeightMeters
        },
        groundedJumpSupportVerticalSpeedTolerance:
          bundleInputs.gameplayProfile.groundedJumpSupportVerticalSpeedTolerance,
        playerStateSync: this.#playerStateSync,
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
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
      readCurrentTick: () => this.#tickState.currentTick,
      readLastAdvancedAtMs: () => this.#tickState.lastAdvancedAtMs,
      readSnapshotSequence: () => this.#tickState.snapshotSequence,
      readTickIntervalMs: () => Number(this.#config.tickIntervalMs),
      traversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
      vehiclesById: this.#vehiclesById
    });
    this.#commandIntake = new MetaverseAuthoritativeWorldCommandIntake({
      advanceToTime: (nowMs) => this.advanceToTime(nowMs),
      mountedOccupancyAuthority: this.#mountedOccupancyAuthority,
      playerLifecycleAuthority: this.#playerLifecycleAuthority,
      playerPoseAuthority: this.#playerPoseAuthority,
      playerTraversalAuthority: this.#playerTraversalAuthority,
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

  #createPlayerGroundedTraversalColliderPredicate(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    excludedColliders: readonly RapierColliderHandle[] = Object.freeze([])
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set<RapierColliderHandle>([
      playerRuntime.groundedBodyRuntime.colliderHandle,
      playerRuntime.swimBodyRuntime.colliderHandle,
      ...this.#vehicleDriveColliderHandles,
      ...excludedColliders
    ]);

    return (collider) => {
      if (excludedColliderSet.has(collider)) {
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
        shouldTreatMetaversePlayerPoseAsTraversalBlocker(
          ownerPlayerRuntime.locomotionMode,
          ownerPlayerRuntime.mountedOccupancy
        )
      );
    };
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
        shouldTreatMetaversePlayerPoseAsTraversalBlocker(
          ownerPlayerRuntime.locomotionMode,
          ownerPlayerRuntime.mountedOccupancy
        )
      );
    };
  }

  #pruneInactivePlayers(nowMs: number): void {
    this.#playerLifecycleAuthority.pruneInactivePlayers(nowMs);
  }

  #bootEnvironmentBodies(
    environmentBodySeedSnapshots: readonly {
      readonly colliderCenter: PhysicsVector3Snapshot;
      readonly dynamicBody: {
        readonly additionalMass: number;
        readonly angularDamping: number;
        readonly gravityScale: number;
        readonly linearDamping: number;
        readonly lockRotations: boolean;
      };
      readonly environmentAssetId: string;
      readonly halfExtents: PhysicsVector3Snapshot;
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }[]
  ): void {
    for (const environmentBodySeedSnapshot of environmentBodySeedSnapshots) {
      const bodyRuntime = new MetaverseAuthoritativeDynamicCuboidBodyRuntime(
        {
          additionalMass: environmentBodySeedSnapshot.dynamicBody.additionalMass,
          angularDamping:
            environmentBodySeedSnapshot.dynamicBody.angularDamping,
          colliderCenter: environmentBodySeedSnapshot.colliderCenter,
          gravityScale: environmentBodySeedSnapshot.dynamicBody.gravityScale,
          halfExtents: environmentBodySeedSnapshot.halfExtents,
          linearDamping:
            environmentBodySeedSnapshot.dynamicBody.linearDamping,
          lockRotations:
            environmentBodySeedSnapshot.dynamicBody.lockRotations,
          spawnPosition: environmentBodySeedSnapshot.position,
          spawnYawRadians: environmentBodySeedSnapshot.yawRadians
        },
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
