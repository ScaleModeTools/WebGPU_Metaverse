import {
  metaverseGroundedBodyTraversalCoreConfig,
  resolveMetaverseTraversalKinematicActionSnapshot,
  metaverseSwimSurfaceTraversalConfig,
  metaverseTraversalWorldRadius,
  metaverseVehicleSurfaceTraversalConfig,
  type MetaverseTraversalActiveActionSnapshot,
  type MetaverseSurfaceTraversalConfig,
  metaverseGroundedSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/traversal";
import {
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse/world";
import type {
  MetaversePlayerId,
  MetaversePresenceCommand,
  MetaversePresencePoseSnapshot,
  MetaversePresenceRosterEvent,
  MetaversePresenceRosterSnapshot
} from "@webgpu-metaverse/shared/metaverse/presence";
import type {
  MetaverseRealtimeWorldClientCommand,
  MetaverseRealtimeWorldEvent,
  MetaverseRealtimeWorldSnapshot,
  MetaverseVehicleId
} from "@webgpu-metaverse/shared/metaverse/realtime";

import {
  metaverseAuthoritativeWaterRegionSnapshots
} from "../config/metaverse-authoritative-world-surface.js";
import { metaverseAuthoritativeWorldRuntimeConfig } from "../config/metaverse-authoritative-world-runtime.js";
import {
  MetaverseAuthoritativeGroundedBodyRuntime,
  type MetaverseAuthoritativeGroundedBodyConfig
} from "./metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "./metaverse-authoritative-surface-drive-runtime.js";
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
  RapierColliderHandle
} from "../types/metaverse-authoritative-rapier.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";
import type { MetaverseAuthoritativeMountedOccupancyRuntimeState } from "../authority/mounted/metaverse-authoritative-mounted-occupancy-authority.js";

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

const metaverseAuthoritativeVehicleSurfaceDriveConfig = Object.freeze({
  ...metaverseVehicleSurfaceTraversalConfig,
  worldRadius: metaverseTraversalWorldRadius
} satisfies MetaverseAuthoritativeSurfaceTraversalConfig);

const metaverseAuthoritativeSwimTraversalConfig = Object.freeze({
  ...metaverseSwimSurfaceTraversalConfig,
  worldRadius: metaverseTraversalWorldRadius
} satisfies MetaverseAuthoritativeSurfaceTraversalConfig);

const metaverseAuthoritativeGroundedBodyConfig = Object.freeze({
  ...metaverseGroundedSurfacePolicyConfig
} satisfies MetaverseWorldSurfacePolicyConfig);
const metaverseAuthoritativeGroundedBodyRuntimeConfig = Object.freeze({
  ...metaverseGroundedBodyTraversalCoreConfig,
  spawnPosition: metaverseWorldGroundedSpawnPosition,
  worldRadius: metaverseTraversalWorldRadius
} satisfies MetaverseAuthoritativeGroundedBodyConfig);
const metaverseAuthoritativeCapsuleControllerOffsetMeters =
  metaverseGroundedBodyTraversalCoreConfig.controllerOffsetMeters;
const metaverseAuthoritativeGroundedJumpSupportVerticalSpeedTolerance = 0.5;

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

export class MetaverseAuthoritativeWorldRuntime {
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
  readonly #playerTraversalColliderHandles = new Set<RapierColliderHandle>();
  readonly #playersById = new Map<MetaversePlayerId, MetaversePlayerWorldRuntimeState>();
  readonly #surfaceState: MetaverseAuthoritativeWorldSurfaceState<
    MetaversePlayerWorldRuntimeState,
    MetaverseVehicleWorldRuntimeState
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
    MetaverseVehicleWorldRuntimeState
  >;
  readonly #tickState: MetaverseAuthoritativeWorldTickState;

  constructor(config: Partial<MetaverseAuthoritativeWorldRuntimeConfig> = {}) {
    this.#config = {
      playerInactivityTimeoutMs:
        config.playerInactivityTimeoutMs ??
        metaverseAuthoritativeWorldRuntimeConfig.playerInactivityTimeoutMs,
      tickIntervalMs:
        config.tickIntervalMs ??
        metaverseAuthoritativeWorldRuntimeConfig.tickIntervalMs
    };
    this.#playerLifecycleAuthority =
      new MetaverseAuthoritativePlayerLifecycleAuthority({
        driverVehicleControlsByPlayerId: this.#driverVehicleControlsByPlayerId,
        incrementSnapshotSequence: () => {
          this.#tickState.incrementSnapshotSequence();
        },
        playerInactivityTimeoutMs: Number(this.#config.playerInactivityTimeoutMs),
        playerTraversalColliderHandles: this.#playerTraversalColliderHandles,
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
        vehiclesById: this.#vehiclesById
      });
    this.#surfaceState = new MetaverseAuthoritativeWorldSurfaceState({
      groundedBodyConfig: metaverseAuthoritativeGroundedBodyConfig,
      physicsRuntime: this.#physicsRuntime,
      playerTraversalColliderHandles: this.#playerTraversalColliderHandles,
      syncPlayerTraversalBodyRuntimes: (playerRuntime, grounded) =>
        this.#playerStateSync.syncPlayerTraversalBodyRuntimes(
          playerRuntime,
          grounded
        ),
      vehicleDriveColliderHandles: this.#vehicleDriveColliderHandles
    });
    this.#vehicleRuntimeRegistry =
      new MetaverseAuthoritativeVehicleRuntimeRegistry({
        controllerOffsetMeters:
          metaverseAuthoritativeCapsuleControllerOffsetMeters,
        physicsRuntime: this.#physicsRuntime,
        syncVehicleDynamicSurfaceColliders: (vehicleRuntime) =>
          this.#surfaceState.syncVehicleDynamicSurfaceColliders(vehicleRuntime),
        vehicleDriveColliderHandles: this.#vehicleDriveColliderHandles,
        vehicleSurfaceWorldRadius:
          metaverseAuthoritativeVehicleSurfaceDriveConfig.worldRadius,
        vehiclesById: this.#vehiclesById
      });
    this.#playerStateSync = new MetaverseAuthoritativePlayerStateSync({
      addPlayerTraversalColliderHandle: (handle) => {
        this.#playerTraversalColliderHandles.add(handle);
      },
      createGroundedBodyRuntime: () =>
        new MetaverseAuthoritativeGroundedBodyRuntime(
          metaverseAuthoritativeGroundedBodyRuntimeConfig,
          this.#physicsRuntime
        ),
      createSwimBodyRuntime: () =>
        new MetaverseAuthoritativeSurfaceDriveRuntime(
          {
            controllerOffsetMeters:
              metaverseAuthoritativeCapsuleControllerOffsetMeters,
            shape: {
              halfHeightMeters:
                metaverseAuthoritativeGroundedBodyConfig.capsuleHalfHeightMeters,
              kind: "capsule",
              radiusMeters:
                metaverseAuthoritativeGroundedBodyConfig.capsuleRadiusMeters
            },
            spawnPosition: createPhysicsVector3Snapshot(
              metaverseWorldGroundedSpawnPosition.x,
              metaverseWorldGroundedSpawnPosition.y,
              metaverseWorldGroundedSpawnPosition.z
            ),
            spawnYawRadians: metaverseWorldInitialYawRadians,
            worldRadius: metaverseAuthoritativeSwimTraversalConfig.worldRadius
          },
          this.#physicsRuntime
      ),
      initialYawRadians: metaverseWorldInitialYawRadians,
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
          excludedOwnerEnvironmentAssetId,
          excludedColliders
        ) =>
          this.#surfaceState.createWaterborneTraversalColliderPredicate(
            excludedOwnerEnvironmentAssetId,
            excludedColliders
          ),
        groundedBodyConfig: metaverseAuthoritativeGroundedBodyConfig,
        groundedBodyRuntimeConfig: {
          controllerOffsetMeters:
            metaverseAuthoritativeGroundedBodyRuntimeConfig.controllerOffsetMeters,
          maxTurnSpeedRadiansPerSecond:
            metaverseAuthoritativeGroundedBodyRuntimeConfig.maxTurnSpeedRadiansPerSecond,
          snapToGroundDistanceMeters:
            metaverseAuthoritativeGroundedBodyRuntimeConfig.snapToGroundDistanceMeters,
          stepHeightMeters: metaverseAuthoritativeGroundedBodyConfig.stepHeightMeters
        },
        groundedJumpSupportVerticalSpeedTolerance:
          metaverseAuthoritativeGroundedJumpSupportVerticalSpeedTolerance,
        playerStateSync: this.#playerStateSync,
        playerTraversalIntentsByPlayerId: this.#playerTraversalIntentsByPlayerId,
        playersById: this.#playersById,
        resolveAuthoritativeSurfaceColliders: () =>
          this.#surfaceState.resolveAuthoritativeSurfaceColliders(),
        shouldConsiderTraversalCollider: (collider) =>
          this.#surfaceState.shouldConsiderTraversalCollider(collider),
        swimTraversalConfig: metaverseAuthoritativeSwimTraversalConfig,
        waterRegionSnapshots: metaverseAuthoritativeWaterRegionSnapshots
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
      syncMountedPlayerPoseFromVehicle: (playerRuntime, vehicleRuntime, nowMs) =>
        this.#playerStateSync.syncMountedPlayerPoseFromVehicle(
          playerRuntime,
          vehicleRuntime,
          nowMs
        ),
      syncVehicleDynamicSurfaceColliders: (vehicleRuntime) =>
        this.#surfaceState.syncVehicleDynamicSurfaceColliders(vehicleRuntime),
      vehicleSurfaceTraversalConfig:
        metaverseAuthoritativeVehicleSurfaceDriveConfig,
      vehiclesById: this.#vehiclesById
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

  #pruneInactivePlayers(nowMs: number): void {
    this.#playerLifecycleAuthority.pruneInactivePlayers(nowMs);
  }

}
