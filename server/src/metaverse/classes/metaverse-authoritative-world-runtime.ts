import {
  createMetaverseTraversalColliderMetadataSnapshot,
  clamp,
  clearMetaverseUnmountedTraversalPendingActions,
  createMetaverseTraversalAuthoritySnapshot,
  createMetaverseTraversalBodyControlSnapshot,
  createMetaverseTraversalFacingSnapshot,
  createMetaverseUnmountedTraversalStateSnapshot,
  prepareMetaverseUnmountedTraversalStep,
  queueMetaverseUnmountedTraversalAction,
  resolveMetaverseTraversalWaterlineHeightMeters,
  resolveMetaverseUnmountedTraversalStep,
  resolveMetaverseWorldAutomaticSurfaceLocomotion,
  resolveMetaverseWorldWaterSurfaceHeightMeters,
  wrapRadians,
  createMetaverseSyncDriverVehicleControlCommand,
  createMetaverseSyncPlayerLookIntentCommand,
  createMetaverseSyncMountedOccupancyCommand,
  createMetaverseSyncPlayerTraversalIntentCommand,
  createMetaversePresencePlayerSnapshot,
  createMetaversePresencePoseSnapshot,
  createMetaversePresenceRosterEvent,
  createMetaversePresenceRosterSnapshot,
  createMetaverseRealtimeWorldEvent,
  createMetaverseRealtimeWorldSnapshot,
  metaverseGroundedBodyTraversalCoreConfig,
  metaverseGroundedSurfacePolicyConfig,
  metaverseGroundedSurfaceTraversalConfig,
  metaverseSwimSurfaceTraversalConfig,
  metaverseTraversalWorldRadius,
  metaverseVehicleSurfaceTraversalConfig,
  metaverseWorldGroundedSpawnPosition,
  metaverseWorldInitialYawRadians,
  shouldConsiderMetaverseWaterborneTraversalCollider,
  createMetaverseVehicleId,
  doMetaversePlayerTraversalSequencedInputsMatch,
  metaverseUnmountedPlayerLookConstraintBounds,
  resolveMetaverseMountedOccupantRoleLookConstraintBounds,
  resolveMetaverseTraversalAuthoritySnapshotInput,
  type MetaverseRealtimeWorldClientCommand,
  type MetaverseJoinPresenceCommand,
  type MetaverseLeavePresenceCommand,
  type MetaversePlayerId,
  type MetaversePlayerTraversalActionIntentSnapshot,
  type MetaversePlayerTraversalBodyControlSnapshot,
  type MetaversePlayerTraversalFacingSnapshot,
  type MetaversePresenceCommand,
  type MetaversePresenceMountedOccupancySnapshot,
  type MetaversePresenceMountedOccupantRoleId,
  type MetaversePresencePlayerSnapshot,
  type MetaversePresencePoseSnapshot,
  type MetaversePresenceRosterEvent,
  type MetaversePresenceRosterSnapshot,
  type MetaversePlayerTraversalIntentLocomotionModeId,
  type MetaversePlayerTraversalIntentSnapshot,
  type MetaverseRealtimePlayerJumpAuthorityStateId,
  type MetaverseRealtimePlayerObservedTraversalSnapshot,
  type MetaverseRealtimeMountedOccupancySnapshotInput,
  type MetaverseTraversalAuthoritySnapshot,
  type MetaverseRealtimeWorldEvent,
  type MetaverseRealtimeWorldSnapshot,
  type MetaverseSurfaceTraversalConfig,
  type MetaverseSyncDriverVehicleControlCommand,
  type MetaverseSyncPlayerLookIntentCommand,
  type MetaverseSyncMountedOccupancyCommand,
  type MetaverseSyncPlayerTraversalIntentCommand,
  type MetaverseSyncPresenceCommand,
  type MetaverseUnmountedTraversalStateSnapshot,
  type MetaversePlayerLookConstraintBounds,
  type MetaverseWorldSurfacePolicyConfig
} from "@webgpu-metaverse/shared/metaverse";

import {
  metaverseAuthoritativeDynamicSurfaceSeedSnapshots,
  metaverseAuthoritativeStaticSurfaceColliders,
  metaverseAuthoritativeWaterRegionSnapshots,
  readMetaverseAuthoritativeSurfaceAsset,
  type MetaverseAuthoritativeSurfaceColliderSnapshot
} from "../config/metaverse-authoritative-world-surface.js";
import { metaverseAuthoritativeWorldRuntimeConfig } from "../config/metaverse-authoritative-world-runtime.js";
import { MetaverseAuthoritativeDynamicSurfaceColliderRuntime } from "./metaverse-authoritative-dynamic-surface-collider-runtime.js";
import {
  MetaverseAuthoritativeGroundedBodyRuntime,
  type MetaverseAuthoritativeGroundedBodyConfig,
  type MetaverseAuthoritativeGroundedBodySnapshot
} from "./metaverse-authoritative-grounded-body-runtime.js";
import { MetaverseAuthoritativeRapierPhysicsRuntime } from "./metaverse-authoritative-rapier-physics-runtime.js";
import { MetaverseAuthoritativeSurfaceDriveRuntime } from "./metaverse-authoritative-surface-drive-runtime.js";
import type {
  PhysicsVector3Snapshot,
  RapierColliderHandle,
  RapierQueryFilterPredicate
} from "../types/metaverse-authoritative-rapier.js";
import type { MetaverseAuthoritativeWorldRuntimeConfig } from "../types/metaverse-authoritative-world-runtime.js";

interface MetaversePlayerWorldRuntimeState {
  angularVelocityRadiansPerSecond: number;
  readonly characterId: string;
  forwardSpeedUnitsPerSecond: number;
  readonly groundedBodyRuntime: MetaverseAuthoritativeGroundedBodyRuntime;
  lastGroundedBodyJumpReady: boolean;
  lastGroundedJumpSupported: boolean;
  lastProcessedLookSequence: number;
  lastProcessedInputSequence: number;
  lastProcessedTraversalOrientationSequence: number;
  lastSurfaceJumpSupported: boolean;
  lastGroundedPositionY: number;
  readonly playerId: MetaversePlayerId;
  readonly username: MetaversePresencePlayerSnapshot["username"];
  presenceAnimationVocabulary: MetaversePresencePoseSnapshot["animationVocabulary"];
  lastPoseAtMs: number | null;
  lastSeenAtMs: number;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  lookPitchRadians: number;
  lookYawRadians: number;
  locomotionMode: MetaversePresencePoseSnapshot["locomotionMode"];
  mountedOccupancy: MetaverseMountedOccupancyRuntimeState | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  realtimeWorldAuthorityActive: boolean;
  stateSequence: number;
  strafeSpeedUnitsPerSecond: number;
  traversalAuthorityState: MetaverseTraversalAuthoritySnapshot;
  unmountedTraversalState: MetaverseUnmountedTraversalStateSnapshot;
  readonly swimBodyRuntime: MetaverseAuthoritativeSurfaceDriveRuntime;
  yawRadians: number;
}

interface MetaverseMountedOccupancyRuntimeState {
  readonly entryId: string | null;
  readonly environmentAssetId: string;
  readonly occupancyKind: MetaversePresenceMountedOccupancySnapshot["occupancyKind"];
  readonly occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string | null;
  readonly vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>;
}

interface MetaverseVehicleSeatRuntimeState {
  occupantPlayerId: MetaversePlayerId | null;
  occupantRole: MetaversePresenceMountedOccupantRoleId;
  readonly seatId: string;
}

interface MetaverseVehicleWorldRuntimeState {
  readonly driveRuntime: MetaverseAuthoritativeSurfaceDriveRuntime;
  readonly environmentAssetId: string;
  readonly seatsById: Map<string, MetaverseVehicleSeatRuntimeState>;
  readonly vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>;
  angularVelocityRadiansPerSecond: number;
  forwardSpeedUnitsPerSecond: number;
  lastPoseAtMs: number | null;
  linearVelocityX: number;
  linearVelocityY: number;
  linearVelocityZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  strafeSpeedUnitsPerSecond: number;
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

interface MetaversePlayerTraversalIntentRuntimeState {
  readonly actionIntent: MetaversePlayerTraversalActionIntentSnapshot;
  readonly bodyControl: MetaversePlayerTraversalBodyControlSnapshot;
  readonly facing: MetaversePlayerTraversalFacingSnapshot;
  inputSequence: number;
  locomotionMode: MetaversePlayerTraversalIntentLocomotionModeId;
  orientationSequence: number;
}

interface MetaverseAuthoritativeSurfaceTraversalConfig
  extends MetaverseSurfaceTraversalConfig {
  readonly worldRadius: number;
}

const metaverseAuthoritativeVehicleSurfaceDriveConfig = Object.freeze({
  ...metaverseVehicleSurfaceTraversalConfig,
  worldRadius: metaverseTraversalWorldRadius
} satisfies MetaverseAuthoritativeSurfaceTraversalConfig);

const metaverseAuthoritativeGroundedTraversalConfig = Object.freeze({
  ...metaverseGroundedSurfaceTraversalConfig,
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
const metaverseAuthoritativeGroundedSnapToleranceMeters = 0.0001;
const metaverseAuthoritativeGroundedJumpSupportVerticalSpeedTolerance = 0.5;
const authoritativeJumpIntentBufferSeconds = 0.2;

function sortPlayerIds(leftPlayerId: MetaversePlayerId, rightPlayerId: MetaversePlayerId): number {
  if (leftPlayerId < rightPlayerId) {
    return -1;
  }

  if (leftPlayerId > rightPlayerId) {
    return 1;
  }

  return 0;
}

function sortVehicleIds(
  leftVehicleId: MetaverseVehicleWorldRuntimeState["vehicleId"],
  rightVehicleId: MetaverseVehicleWorldRuntimeState["vehicleId"]
): number {
  if (leftVehicleId < rightVehicleId) {
    return -1;
  }

  if (leftVehicleId > rightVehicleId) {
    return 1;
  }

  return 0;
}

function normalizeNowMs(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(0, nowMs);
}

function playerTraversalIntentMatches(
  leftIntent: MetaversePlayerTraversalIntentRuntimeState,
  rightIntent: MetaversePlayerTraversalIntentSnapshot
): boolean {
  return (
    leftIntent.actionIntent.kind === rightIntent.actionIntent.kind &&
    leftIntent.actionIntent.pressed === rightIntent.actionIntent.pressed &&
    leftIntent.actionIntent.sequence === rightIntent.actionIntent.sequence &&
    leftIntent.bodyControl.boost === rightIntent.bodyControl.boost &&
    leftIntent.bodyControl.moveAxis === rightIntent.bodyControl.moveAxis &&
    leftIntent.bodyControl.strafeAxis === rightIntent.bodyControl.strafeAxis &&
    leftIntent.bodyControl.turnAxis === rightIntent.bodyControl.turnAxis &&
    leftIntent.facing.pitchRadians === rightIntent.facing.pitchRadians &&
    leftIntent.facing.yawRadians === rightIntent.facing.yawRadians &&
    leftIntent.inputSequence === rightIntent.inputSequence &&
    leftIntent.locomotionMode === rightIntent.locomotionMode &&
    leftIntent.orientationSequence === rightIntent.orientationSequence
  );
}

function isOlderPresenceUpdate(
  currentStateSequence: number,
  nextPose: MetaversePresencePoseSnapshot
): boolean {
  return nextPose.stateSequence < currentStateSequence;
}

function hasExplicitPresenceLook(nextPose: MetaversePresencePoseSnapshot): boolean {
  return (
    nextPose.look.pitchRadians !== 0 ||
    nextPose.look.yawRadians !== nextPose.yawRadians
  );
}

function computeSecondsBetween(
  previousTimeMs: number | null,
  nowMs: number
): number | null {
  if (previousTimeMs === null) {
    return null;
  }

  const deltaSeconds = (nowMs - previousTimeMs) / 1_000;

  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return null;
  }

  return deltaSeconds;
}

function normalizeAngularDeltaRadians(rawValue: number): number {
  return wrapRadians(rawValue);
}

function clampAxis(rawValue: number): number {
  return clamp(rawValue, -1, 1);
}

function resolveTraversalInputMagnitude(
  moveAxis: number,
  strafeAxis: number
): number {
  return Math.hypot(clampAxis(moveAxis), clampAxis(strafeAxis));
}

function isGroundedUnmountedPlayerRuntime(
  playerRuntime: MetaversePlayerWorldRuntimeState
): boolean {
  return (
    Math.abs(playerRuntime.positionY - playerRuntime.lastGroundedPositionY) <=
      metaverseAuthoritativeGroundedSnapToleranceMeters &&
    Math.abs(playerRuntime.linearVelocityY) <=
      metaverseAuthoritativeGroundedSnapToleranceMeters
  );
}

function resolvePlayerJumpAuthorityState(
  playerRuntime: MetaversePlayerWorldRuntimeState
): MetaverseRealtimePlayerJumpAuthorityStateId {
  if (
    playerRuntime.mountedOccupancy !== null ||
    playerRuntime.locomotionMode !== "grounded"
  ) {
    return "none";
  }

  const groundedBodySnapshot = playerRuntime.groundedBodyRuntime.snapshot;

  if (groundedBodySnapshot.grounded) {
    return "grounded";
  }

  return groundedBodySnapshot.verticalSpeedUnitsPerSecond > 0.05
    ? "rising"
    : "falling";
}

function resolveAuthoritativePlayerLookConstraintBounds(
  playerRuntime: MetaversePlayerWorldRuntimeState
): MetaversePlayerLookConstraintBounds {
  if (playerRuntime.mountedOccupancy === null) {
    return metaverseUnmountedPlayerLookConstraintBounds;
  }

  return resolveMetaverseMountedOccupantRoleLookConstraintBounds(
    playerRuntime.mountedOccupancy.occupantRole
  );
}

function createMountedOccupancyRuntimeState(
  mountedOccupancy: MetaversePresenceMountedOccupancySnapshot,
  vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>
): MetaverseMountedOccupancyRuntimeState {
  return Object.freeze({
    entryId: mountedOccupancy.entryId,
    environmentAssetId: mountedOccupancy.environmentAssetId,
    occupancyKind: mountedOccupancy.occupancyKind,
    occupantRole: mountedOccupancy.occupantRole,
    seatId: mountedOccupancy.seatId,
    vehicleId
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

function createPlayerLinearVelocitySnapshot(
  playerRuntime: Pick<
    MetaversePlayerWorldRuntimeState,
    "linearVelocityX" | "linearVelocityY" | "linearVelocityZ"
  >
): PhysicsVector3Snapshot {
  return createPhysicsVector3Snapshot(
    playerRuntime.linearVelocityX,
    playerRuntime.linearVelocityY,
    playerRuntime.linearVelocityZ
  );
}

function resolveVehicleDriveColliderShape(
  environmentAssetId: string
): {
  readonly halfExtents: PhysicsVector3Snapshot;
  readonly localCenter: PhysicsVector3Snapshot;
} {
  const surfaceAsset = readMetaverseAuthoritativeSurfaceAsset(environmentAssetId);
  const blockerCollider =
    surfaceAsset?.surfaceColliders.find(
      (surfaceCollider) => surfaceCollider.traversalAffordance === "blocker"
    ) ?? null;

  if (surfaceAsset === null || blockerCollider === null) {
    throw new Error(
      `Metaverse authoritative world requires blocker collider authoring for ${environmentAssetId}.`
    );
  }

  return Object.freeze({
    halfExtents: createPhysicsVector3Snapshot(
      Math.abs(blockerCollider.size.x) * 0.5,
      Math.abs(blockerCollider.size.y) * 0.5,
      Math.abs(blockerCollider.size.z) * 0.5
    ),
    localCenter: createPhysicsVector3Snapshot(
      blockerCollider.center.x,
      blockerCollider.center.y,
      blockerCollider.center.z
    )
  });
}

export class MetaverseAuthoritativeWorldRuntime {
  readonly #config: MetaverseAuthoritativeWorldRuntimeConfig;
  readonly #dynamicSurfaceColliderRuntimesByEnvironmentAssetId = new Map<
    string,
    MetaverseAuthoritativeDynamicSurfaceColliderRuntime
  >();
  readonly #driverVehicleControlsByPlayerId = new Map<
    MetaversePlayerId,
    MetaverseDriverVehicleControlRuntimeState
  >();
  readonly #physicsRuntime = new MetaverseAuthoritativeRapierPhysicsRuntime();
  readonly #playerTraversalIntentsByPlayerId = new Map<
    MetaversePlayerId,
    MetaversePlayerTraversalIntentRuntimeState
  >();
  readonly #playerTraversalColliderHandles = new Set<RapierColliderHandle>();
  readonly #playersById = new Map<MetaversePlayerId, MetaversePlayerWorldRuntimeState>();
  readonly #surfaceColliderMetadataByHandle = new Map<
    RapierColliderHandle,
    ReturnType<typeof createMetaverseTraversalColliderMetadataSnapshot>
  >();
  readonly #vehicleDriveColliderHandles = new Set<RapierColliderHandle>();
  readonly #vehicleIdsByEnvironmentAssetId = new Map<
    string,
    NonNullable<ReturnType<typeof createMetaverseVehicleId>>
  >();
  readonly #vehiclesById = new Map<
    NonNullable<ReturnType<typeof createMetaverseVehicleId>>,
    MetaverseVehicleWorldRuntimeState
  >();

  #currentTick = 0;
  #lastAdvancedAtMs: number | null = null;
  #nextVehicleOrdinal = 1;
  #snapshotSequence = 0;

  constructor(config: Partial<MetaverseAuthoritativeWorldRuntimeConfig> = {}) {
    this.#config = {
      playerInactivityTimeoutMs:
        config.playerInactivityTimeoutMs ??
        metaverseAuthoritativeWorldRuntimeConfig.playerInactivityTimeoutMs,
      tickIntervalMs:
        config.tickIntervalMs ??
        metaverseAuthoritativeWorldRuntimeConfig.tickIntervalMs
    };

    for (const staticSurfaceCollider of metaverseAuthoritativeStaticSurfaceColliders) {
      const collider = this.#physicsRuntime.createCuboidCollider(
        staticSurfaceCollider.halfExtents,
        staticSurfaceCollider.translation,
        staticSurfaceCollider.rotation
      );

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(staticSurfaceCollider)
      );
    }

    this.#bootDynamicSurfaceColliderRuntimes();

    this.#physicsRuntime.stepSimulation(
      Number(this.#config.tickIntervalMs) / 1_000
    );
  }

  #resolveAuthoritativeSurfaceColliders():
    readonly MetaverseAuthoritativeSurfaceColliderSnapshot[] {
    const surfaceColliders: MetaverseAuthoritativeSurfaceColliderSnapshot[] = [
      ...metaverseAuthoritativeStaticSurfaceColliders
    ];

    for (const colliderRuntime of this
      .#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.values()) {
      surfaceColliders.push(
        ...colliderRuntime.surfaceColliderSnapshots
      );
    }

    return surfaceColliders;
  }

  #shouldConsiderTraversalCollider = (
    collider: RapierColliderHandle
  ): boolean =>
    !this.#playerTraversalColliderHandles.has(collider) &&
    !this.#vehicleDriveColliderHandles.has(collider);

  #createWaterborneTraversalColliderPredicate(
    excludedOwnerEnvironmentAssetId: string | null = null,
    excludedColliders: readonly RapierColliderHandle[] = Object.freeze([])
  ): RapierQueryFilterPredicate {
    const excludedColliderSet = new Set<RapierColliderHandle>([
      ...this.#playerTraversalColliderHandles,
      ...this.#vehicleDriveColliderHandles,
      ...excludedColliders
    ]);

    return (collider) => {
      if (excludedColliderSet.has(collider)) {
        return false;
      }

      return shouldConsiderMetaverseWaterborneTraversalCollider(
        this.#surfaceColliderMetadataByHandle.get(collider) ?? null,
        excludedOwnerEnvironmentAssetId
      );
    };
  }

  #bootDynamicSurfaceColliderRuntimes(): void {
    for (const seedSnapshot of metaverseAuthoritativeDynamicSurfaceSeedSnapshots) {
      const colliderRuntime =
        new MetaverseAuthoritativeDynamicSurfaceColliderRuntime(
          seedSnapshot.environmentAssetId,
          this.#physicsRuntime
        );

      colliderRuntime.syncPose({
        position: seedSnapshot.position,
        yawRadians: seedSnapshot.yawRadians
      });
      this.#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.set(
        colliderRuntime.environmentAssetId,
        colliderRuntime
      );
      this.#syncDynamicSurfaceColliderMetadata(colliderRuntime);
    }
  }

  #syncDynamicSurfaceColliderMetadata(
    colliderRuntime: MetaverseAuthoritativeDynamicSurfaceColliderRuntime
  ): void {
    for (const [colliderIndex, collider] of colliderRuntime.colliders.entries()) {
      const colliderSnapshot =
        colliderRuntime.surfaceColliderSnapshots[colliderIndex] ?? null;

      if (colliderSnapshot === null) {
        this.#surfaceColliderMetadataByHandle.delete(collider);
        continue;
      }

      this.#surfaceColliderMetadataByHandle.set(
        collider,
        createMetaverseTraversalColliderMetadataSnapshot(colliderSnapshot)
      );
    }
  }

  #syncVehicleDynamicSurfaceColliders(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState
  ): void {
    const colliderRuntime =
      this.#dynamicSurfaceColliderRuntimesByEnvironmentAssetId.get(
        vehicleRuntime.environmentAssetId
      );

    if (colliderRuntime === undefined) {
      return;
    }

    colliderRuntime.syncPose({
      position: createPhysicsVector3Snapshot(
        vehicleRuntime.positionX,
        vehicleRuntime.positionY,
        vehicleRuntime.positionZ
      ),
      yawRadians: vehicleRuntime.yawRadians
    });
    this.#syncDynamicSurfaceColliderMetadata(colliderRuntime);
  }

  #syncUnmountedPlayerToAuthoritativeSurface(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    surfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[],
    excludedOwnerEnvironmentAssetId: string | null = null
  ): void {
    const filteredSurfaceColliders =
      excludedOwnerEnvironmentAssetId === null
        ? surfaceColliders
        : surfaceColliders.filter(
            (surfaceCollider) =>
              surfaceCollider.ownerEnvironmentAssetId !==
              excludedOwnerEnvironmentAssetId
          );
    const waterlineHeightMeters = resolveMetaverseTraversalWaterlineHeightMeters(
      metaverseAuthoritativeWaterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      }
    );
    const locomotionDecision = resolveMetaverseWorldAutomaticSurfaceLocomotion(
      metaverseAuthoritativeGroundedBodyConfig,
      filteredSurfaceColliders,
      metaverseAuthoritativeWaterRegionSnapshots,
      {
        x: playerRuntime.positionX,
        y: playerRuntime.positionY,
        z: playerRuntime.positionZ
      },
      playerRuntime.yawRadians,
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
      excludedOwnerEnvironmentAssetId
    ).decision;

    if (
      locomotionDecision.locomotionMode === "grounded" &&
      locomotionDecision.supportHeightMeters !== null
    ) {
      playerRuntime.positionY = locomotionDecision.supportHeightMeters;
      playerRuntime.lastGroundedPositionY =
        locomotionDecision.supportHeightMeters;
      playerRuntime.locomotionMode = "grounded";
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: "grounded"
        });
      this.#syncPlayerTraversalBodyRuntimes(playerRuntime, true);
      return;
    }

    playerRuntime.positionY = waterlineHeightMeters;
    playerRuntime.locomotionMode = "swim";
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        actionState: playerRuntime.unmountedTraversalState.actionState,
        locomotionMode: "swim"
      });
    this.#syncPlayerTraversalBodyRuntimes(playerRuntime, false);
  }

  get tickIntervalMs(): number {
    return Number(this.#config.tickIntervalMs);
  }

  readPresenceRosterSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterSnapshot {
    const worldSnapshot = this.readWorldSnapshot(nowMs, observerPlayerId);

    return createMetaversePresenceRosterSnapshot({
      players: worldSnapshot.players.map((playerSnapshot) =>
        createMetaversePresencePlayerSnapshot({
          characterId: playerSnapshot.characterId,
          playerId: playerSnapshot.playerId,
          pose: createMetaversePresencePoseSnapshot({
            animationVocabulary:
              this.#playersById.get(playerSnapshot.playerId)
                ?.presenceAnimationVocabulary ?? "idle",
            look: {
              pitchRadians: playerSnapshot.look.pitchRadians,
              yawRadians: playerSnapshot.look.yawRadians
            },
            locomotionMode: playerSnapshot.locomotionMode,
            mountedOccupancy:
              playerSnapshot.mountedOccupancy === null
                ? null
                : {
                    environmentAssetId:
                      playerSnapshot.mountedOccupancy.environmentAssetId,
                    entryId: playerSnapshot.mountedOccupancy.entryId,
                    occupancyKind: playerSnapshot.mountedOccupancy.occupancyKind,
                    occupantRole: playerSnapshot.mountedOccupancy.occupantRole,
                    seatId: playerSnapshot.mountedOccupancy.seatId
                  },
            position: playerSnapshot.position,
            stateSequence: playerSnapshot.stateSequence,
            yawRadians: playerSnapshot.yawRadians
          }),
          username: playerSnapshot.username
        })
      ),
      snapshotSequence: worldSnapshot.snapshotSequence,
      tickIntervalMs: Number(worldSnapshot.tick.tickIntervalMs)
    });
  }

  readPresenceRosterEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaversePresenceRosterEvent {
    return createMetaversePresenceRosterEvent(
      this.readPresenceRosterSnapshot(nowMs, observerPlayerId)
    );
  }

  #createObservedPlayerTraversalSnapshot(
    playerRuntime: MetaversePlayerWorldRuntimeState
  ): MetaverseRealtimePlayerObservedTraversalSnapshot {
    const traversalIntent =
      playerRuntime.mountedOccupancy === null
        ? this.#playerTraversalIntentsByPlayerId.get(playerRuntime.playerId)
        : undefined;

    return Object.freeze({
      bodyControl:
        traversalIntent?.bodyControl ??
        createMetaverseTraversalBodyControlSnapshot({
          boost: false,
          moveAxis: 0,
          strafeAxis: 0,
          turnAxis: 0
        }),
      facing:
        traversalIntent?.facing ??
        createMetaverseTraversalFacingSnapshot({
          pitchRadians: playerRuntime.lookPitchRadians,
          yawRadians: playerRuntime.lookYawRadians
        })
    });
  }

  readWorldSnapshot(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldSnapshot {
    const normalizedNowMs = normalizeNowMs(nowMs);

    if (
      observerPlayerId !== undefined &&
      !this.#playersById.has(observerPlayerId)
    ) {
      throw new Error(`Unknown metaverse player: ${observerPlayerId}`);
    }

    if (observerPlayerId !== undefined) {
      this.#recordObserverHeartbeat(observerPlayerId, normalizedNowMs);
    }

    const players = [...this.#playersById.values()]
      .sort((leftPlayer, rightPlayer) =>
        sortPlayerIds(leftPlayer.playerId, rightPlayer.playerId)
      )
      .map((playerRuntime) => ({
      angularVelocityRadiansPerSecond:
        playerRuntime.angularVelocityRadiansPerSecond,
      characterId: playerRuntime.characterId,
      jumpDebug: {
        groundedBodyJumpReady: playerRuntime.lastGroundedBodyJumpReady,
        pendingJumpActionSequence:
          playerRuntime.unmountedTraversalState.actionState.pendingActionKind === "jump"
            ? playerRuntime.unmountedTraversalState.actionState.pendingActionSequence
            : 0,
        pendingJumpBufferAgeMs:
          playerRuntime.unmountedTraversalState.actionState.pendingActionKind === "jump"
            ? Math.max(
                0,
                Math.round(
                  (authoritativeJumpIntentBufferSeconds -
                    playerRuntime.unmountedTraversalState.actionState
                      .pendingActionBufferSecondsRemaining) *
                    1_000
                )
              )
            : null,
        resolvedJumpActionSequence:
          playerRuntime.unmountedTraversalState.actionState.resolvedActionKind === "jump"
            ? playerRuntime.unmountedTraversalState.actionState.resolvedActionSequence
            : 0,
        resolvedJumpActionState:
          playerRuntime.unmountedTraversalState.actionState.resolvedActionKind === "jump"
            ? playerRuntime.unmountedTraversalState.actionState.resolvedActionState
            : "none",
        surfaceJumpSupported: playerRuntime.lastSurfaceJumpSupported,
        supported: playerRuntime.lastGroundedJumpSupported
      },
      jumpAuthorityState: resolvePlayerJumpAuthorityState(playerRuntime),
      lastProcessedInputSequence: playerRuntime.lastProcessedInputSequence,
      lastProcessedLookSequence: playerRuntime.lastProcessedLookSequence,
      lastProcessedTraversalOrientationSequence:
        playerRuntime.lastProcessedTraversalOrientationSequence,
      linearVelocity: {
        x: playerRuntime.linearVelocityX,
        y: playerRuntime.linearVelocityY,
        z: playerRuntime.linearVelocityZ
      },
      look: {
        pitchRadians: playerRuntime.lookPitchRadians,
        yawRadians: playerRuntime.lookYawRadians
      },
      locomotionMode: playerRuntime.locomotionMode,
      observedTraversal:
        this.#createObservedPlayerTraversalSnapshot(playerRuntime),
        ...(playerRuntime.mountedOccupancy === null
          ? {}
          : playerRuntime.mountedOccupancy.occupancyKind === "entry"
            ? {
                mountedOccupancy: {
                  entryId: playerRuntime.mountedOccupancy.entryId,
                  environmentAssetId:
                    playerRuntime.mountedOccupancy.environmentAssetId,
                  occupancyKind: playerRuntime.mountedOccupancy.occupancyKind,
                  occupantRole: playerRuntime.mountedOccupancy.occupantRole,
                  seatId: playerRuntime.mountedOccupancy.seatId,
                  vehicleId: playerRuntime.mountedOccupancy.vehicleId
                } satisfies MetaverseRealtimeMountedOccupancySnapshotInput
              }
            : {}),
        playerId: playerRuntime.playerId,
        position: {
          x: playerRuntime.positionX,
          y: playerRuntime.positionY,
          z: playerRuntime.positionZ
        },
        stateSequence: playerRuntime.stateSequence,
        traversalAuthority: playerRuntime.traversalAuthorityState,
        username: playerRuntime.username,
        yawRadians: playerRuntime.yawRadians
      }));
    const vehicles = [...this.#vehiclesById.values()]
      .sort((leftVehicle, rightVehicle) =>
        sortVehicleIds(leftVehicle.vehicleId, rightVehicle.vehicleId)
      )
      .map((vehicleRuntime) => ({
        angularVelocityRadiansPerSecond:
          vehicleRuntime.angularVelocityRadiansPerSecond,
        environmentAssetId: vehicleRuntime.environmentAssetId,
        linearVelocity: {
          x: vehicleRuntime.linearVelocityX,
          y: vehicleRuntime.linearVelocityY,
          z: vehicleRuntime.linearVelocityZ
        },
        position: {
          x: vehicleRuntime.positionX,
          y: vehicleRuntime.positionY,
          z: vehicleRuntime.positionZ
        },
        seats: [...vehicleRuntime.seatsById.values()]
          .sort((leftSeat, rightSeat) =>
            leftSeat.seatId.localeCompare(rightSeat.seatId)
          )
          .map((seatRuntime) => ({
            occupantPlayerId: seatRuntime.occupantPlayerId,
            occupantRole: seatRuntime.occupantRole,
            seatId: seatRuntime.seatId
          })),
        vehicleId: vehicleRuntime.vehicleId,
        yawRadians: vehicleRuntime.yawRadians
      }));

    return createMetaverseRealtimeWorldSnapshot({
      players,
      snapshotSequence: this.#snapshotSequence,
      tick: {
        currentTick: this.#currentTick,
        emittedAtServerTimeMs: normalizedNowMs,
        simulationTimeMs: this.#lastAdvancedAtMs ?? normalizedNowMs,
        tickIntervalMs: Number(this.#config.tickIntervalMs)
      },
      vehicles
    });
  }

  advanceToTime(nowMs: number): void {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.#advanceToTime(normalizedNowMs);
    this.#pruneInactivePlayers(normalizedNowMs);
  }

  readWorldEvent(
    nowMs: number,
    observerPlayerId?: MetaversePlayerId
  ): MetaverseRealtimeWorldEvent {
    return createMetaverseRealtimeWorldEvent({
      world: this.readWorldSnapshot(nowMs, observerPlayerId)
    });
  }

  acceptPresenceCommand(
    command: MetaversePresenceCommand,
    nowMs: number
  ): MetaversePresenceRosterEvent {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.advanceToTime(normalizedNowMs);

    switch (command.type) {
      case "join-presence":
        this.#acceptJoinCommand(command, normalizedNowMs);
        break;
      case "leave-presence":
        this.#acceptLeaveCommand(command);
        break;
      case "sync-presence":
        this.#acceptSyncCommand(command, normalizedNowMs);
        break;
      default: {
        const exhaustiveCommand: never = command;

        throw new Error(
          `Unsupported metaverse presence command type: ${exhaustiveCommand}`
        );
      }
    }

    return this.readPresenceRosterEvent(normalizedNowMs);
  }

  acceptWorldCommand(
    command: MetaverseRealtimeWorldClientCommand,
    nowMs: number
  ): MetaverseRealtimeWorldEvent {
    const normalizedNowMs = normalizeNowMs(nowMs);

    this.advanceToTime(normalizedNowMs);

    switch (command.type) {
      case "sync-driver-vehicle-control":
        this.#acceptSyncDriverVehicleControlCommand(command, normalizedNowMs);
        break;
      case "sync-mounted-occupancy":
        this.#acceptSyncMountedOccupancyCommand(command, normalizedNowMs);
        break;
      case "sync-player-look-intent":
        this.#acceptSyncPlayerLookIntentCommand(command, normalizedNowMs);
        break;
      case "sync-player-traversal-intent":
        this.#acceptSyncPlayerTraversalIntentCommand(command, normalizedNowMs);
        break;
      default: {
        const exhaustiveCommand: never = command;

        throw new Error(
          `Unsupported metaverse realtime world command type: ${exhaustiveCommand}`
        );
      }
    }

    return this.readWorldEvent(normalizedNowMs);
  }

  #acceptJoinCommand(
    command: MetaverseJoinPresenceCommand,
    nowMs: number
  ): void {
    const nextPose = createMetaversePresencePoseSnapshot(command.pose);
    const currentPlayer = this.#playersById.get(command.playerId);

    if (
      currentPlayer !== undefined &&
      isOlderPresenceUpdate(currentPlayer.stateSequence, nextPose)
    ) {
      currentPlayer.lastSeenAtMs = nowMs;
      return;
    }

    const playerRuntime =
      currentPlayer ??
      this.#createPlayerRuntimeState(
        command.playerId,
        command.characterId,
        command.username,
        nowMs
      );

    playerRuntime.lastSeenAtMs = nowMs;

    if (currentPlayer !== undefined && playerRuntime.realtimeWorldAuthorityActive) {
      return;
    }

    this.#applyPlayerPose(
      playerRuntime,
      nextPose,
      nowMs,
      hasExplicitPresenceLook(nextPose)
    );
    this.#playersById.set(command.playerId, playerRuntime);
    this.#snapshotSequence += 1;
  }

  #acceptLeaveCommand(command: MetaverseLeavePresenceCommand): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    this.#clearDriverVehicleControl(command.playerId);
    this.#clearPlayerTraversalIntent(command.playerId);
    this.#clearPlayerVehicleOccupancy(command.playerId);
    this.#disposePlayerTraversalRuntimes(playerRuntime);
    this.#playersById.delete(command.playerId);
    this.#snapshotSequence += 1;
  }

  #acceptSyncCommand(
    command: MetaverseSyncPresenceCommand,
    nowMs: number
  ): void {
    const nextPose = createMetaversePresencePoseSnapshot(command.pose);

    this.#acceptPlayerPoseCommand(
      command.playerId,
      nextPose,
      nowMs,
      hasExplicitPresenceLook(nextPose)
    );
  }

  #acceptSyncPlayerTraversalIntentCommand(
    command: MetaverseSyncPlayerTraversalIntentCommand,
    nowMs: number
  ): void {
    const normalizedCommand =
      createMetaverseSyncPlayerTraversalIntentCommand(command);
    const playerRuntime = this.#playersById.get(normalizedCommand.playerId);

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;

    if (playerRuntime.mountedOccupancy !== null) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const existingTraversalIntent =
      this.#playerTraversalIntentsByPlayerId.get(normalizedCommand.playerId);

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence < existingTraversalIntent.inputSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingTraversalIntent.inputSequence &&
      !doMetaversePlayerTraversalSequencedInputsMatch(
        existingTraversalIntent,
        normalizedCommand.intent
      )
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      normalizedCommand.intent.inputSequence ===
        existingTraversalIntent.inputSequence &&
      normalizedCommand.intent.orientationSequence <
        existingTraversalIntent.orientationSequence
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    const constrainedTraversalFacing = this.#resolveConstrainedPlayerLookIntent(
      playerRuntime,
      normalizedCommand.intent.facing.pitchRadians,
      normalizedCommand.intent.facing.yawRadians
    );
    const nextTraversalIntent: MetaversePlayerTraversalIntentRuntimeState = {
      actionIntent: normalizedCommand.intent.actionIntent,
      bodyControl: normalizedCommand.intent.bodyControl,
      facing: createMetaverseTraversalFacingSnapshot(
        constrainedTraversalFacing
      ),
      inputSequence: normalizedCommand.intent.inputSequence,
      locomotionMode: normalizedCommand.intent.locomotionMode,
      orientationSequence: normalizedCommand.intent.orientationSequence
    };

    if (
      existingTraversalIntent !== undefined &&
      nextTraversalIntent.inputSequence === existingTraversalIntent.inputSequence &&
      nextTraversalIntent.orientationSequence ===
        existingTraversalIntent.orientationSequence &&
      !playerTraversalIntentMatches(existingTraversalIntent, nextTraversalIntent)
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    if (
      existingTraversalIntent !== undefined &&
      playerTraversalIntentMatches(existingTraversalIntent, nextTraversalIntent)
    ) {
      playerRuntime.lastSeenAtMs = nowMs;
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      return;
    }

    this.#playerTraversalIntentsByPlayerId.set(
      normalizedCommand.playerId,
      nextTraversalIntent
    );
    playerRuntime.lookPitchRadians = constrainedTraversalFacing.pitchRadians;
    playerRuntime.lookYawRadians = constrainedTraversalFacing.yawRadians;

    if (
      existingTraversalIntent === undefined ||
      normalizedCommand.intent.inputSequence > existingTraversalIntent.inputSequence
    ) {
      playerRuntime.unmountedTraversalState =
        queueMetaverseUnmountedTraversalAction(
          playerRuntime.unmountedTraversalState,
          {
            actionIntent: normalizedCommand.intent.actionIntent,
            bufferSeconds: authoritativeJumpIntentBufferSeconds
          }
        );
    }

    playerRuntime.lastSeenAtMs = nowMs;
    this.#syncPlayerTraversalAuthorityState(playerRuntime);
  }

  #acceptSyncPlayerLookIntentCommand(
    command: MetaverseSyncPlayerLookIntentCommand,
    nowMs: number
  ): void {
    const normalizedCommand = createMetaverseSyncPlayerLookIntentCommand(command);
    const playerRuntime = this.#playersById.get(normalizedCommand.playerId);

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;
    playerRuntime.lastSeenAtMs = nowMs;

    if (playerRuntime.mountedOccupancy === null) {
      return;
    }

    if (
      normalizedCommand.lookSequence <= playerRuntime.lastProcessedLookSequence
    ) {
      return;
    }

    const constrainedLookIntent =
      this.#resolveConstrainedPlayerLookIntent(
        playerRuntime,
        normalizedCommand.lookIntent.pitchRadians,
        normalizedCommand.lookIntent.yawRadians
      );

    const lookChanged =
      playerRuntime.lookPitchRadians !== constrainedLookIntent.pitchRadians ||
      playerRuntime.lookYawRadians !== constrainedLookIntent.yawRadians;

    playerRuntime.lastProcessedLookSequence = normalizedCommand.lookSequence;
    playerRuntime.lookPitchRadians = constrainedLookIntent.pitchRadians;
    playerRuntime.lookYawRadians = constrainedLookIntent.yawRadians;

    if (lookChanged) {
      this.#snapshotSequence += 1;
    }
  }

  #acceptSyncMountedOccupancyCommand(
    command: MetaverseSyncMountedOccupancyCommand,
    nowMs: number
  ): void {
    const normalizedCommand = createMetaverseSyncMountedOccupancyCommand(command);
    const playerRuntime = this.#playersById.get(normalizedCommand.playerId);

    if (playerRuntime === undefined) {
      throw new Error(
        `Unknown metaverse player: ${normalizedCommand.playerId}`
      );
    }

    playerRuntime.realtimeWorldAuthorityActive = true;
    playerRuntime.lastSeenAtMs = nowMs;

    if (normalizedCommand.mountedOccupancy === null) {
      const authoritativeSurfaceColliders =
        this.#resolveAuthoritativeSurfaceColliders();
      const previousMountedEnvironmentAssetId =
        playerRuntime.mountedOccupancy?.environmentAssetId ?? null;

      this.#clearPlayerVehicleOccupancy(playerRuntime.playerId);
      this.#clearDriverVehicleControl(playerRuntime.playerId);
      this.#clearPlayerTraversalIntent(playerRuntime.playerId);
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.forwardSpeedUnitsPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.mountedOccupancy = null;
      playerRuntime.lastPoseAtMs = nowMs;
      playerRuntime.strafeSpeedUnitsPerSecond = 0;
      this.#syncUnmountedPlayerToAuthoritativeSurface(
        playerRuntime,
        authoritativeSurfaceColliders,
        previousMountedEnvironmentAssetId
      );
      this.#syncAuthoritativePlayerLookToCurrentFacing(playerRuntime);
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      this.#snapshotSequence += 1;
      return;
    }

    const requestedMountedOccupancy = this.#resolveMountedOccupancyRuntimeState(
      normalizedCommand.mountedOccupancy
    );
    const acceptedMountedOccupancy = this.#resolveAcceptedMountedOccupancy(
      playerRuntime.playerId,
      requestedMountedOccupancy,
      playerRuntime.mountedOccupancy
    );

    this.#clearPlayerVehicleOccupancy(playerRuntime.playerId);
    this.#clearPlayerTraversalIntent(playerRuntime.playerId);
    playerRuntime.mountedOccupancy = acceptedMountedOccupancy;
    playerRuntime.locomotionMode =
      acceptedMountedOccupancy === null ? "grounded" : "mounted";
    if (acceptedMountedOccupancy === null) {
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: "grounded"
        });
    }

    if (acceptedMountedOccupancy === null) {
      const authoritativeSurfaceColliders =
        this.#resolveAuthoritativeSurfaceColliders();
      const excludedMountedEnvironmentAssetId =
        requestedMountedOccupancy?.environmentAssetId ??
        playerRuntime.mountedOccupancy?.environmentAssetId ??
        null;

      this.#clearDriverVehicleControl(playerRuntime.playerId);
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.forwardSpeedUnitsPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.lastPoseAtMs = nowMs;
      playerRuntime.strafeSpeedUnitsPerSecond = 0;
      this.#syncUnmountedPlayerToAuthoritativeSurface(
        playerRuntime,
        authoritativeSurfaceColliders,
        excludedMountedEnvironmentAssetId
      );
      this.#syncAuthoritativePlayerLookToCurrentFacing(playerRuntime);
      this.#syncPlayerTraversalAuthorityState(playerRuntime);
      this.#snapshotSequence += 1;
      return;
    }

    if (acceptedMountedOccupancy.occupantRole !== "driver") {
      this.#clearDriverVehicleControl(playerRuntime.playerId);
    }

    const vehicleRuntime = this.#syncVehicleOccupancyAndInitialPoseFromPlayer(
      playerRuntime,
      acceptedMountedOccupancy,
      nowMs
    );

    this.#syncMountedPlayerPoseFromVehicle(playerRuntime, vehicleRuntime, nowMs);
    this.#syncPlayerTraversalAuthorityState(playerRuntime);
    this.#snapshotSequence += 1;
  }

  #acceptPlayerPoseCommand(
    playerId: MetaversePlayerId,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number,
    lookProvided: boolean = false
  ): void {
    const playerRuntime = this.#playersById.get(playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${playerId}`);
    }

    playerRuntime.lastSeenAtMs = nowMs;

    if (isOlderPresenceUpdate(playerRuntime.stateSequence, nextPose)) {
      return;
    }

    if (playerRuntime.realtimeWorldAuthorityActive) {
      return;
    }

    this.#applyPlayerPose(playerRuntime, nextPose, nowMs, lookProvided);
    this.#snapshotSequence += 1;
  }

  #acceptSyncDriverVehicleControlCommand(
    command: MetaverseSyncDriverVehicleControlCommand,
    nowMs: number
  ): void {
    const playerRuntime = this.#playersById.get(command.playerId);

    if (playerRuntime === undefined) {
      throw new Error(`Unknown metaverse player: ${command.playerId}`);
    }

    playerRuntime.realtimeWorldAuthorityActive = true;

    const normalizedCommand =
      createMetaverseSyncDriverVehicleControlCommand(command);
    const mountedOccupancy = playerRuntime.mountedOccupancy;

    if (
      mountedOccupancy === null ||
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.occupantRole !== "driver" ||
      mountedOccupancy.seatId === null ||
      mountedOccupancy.environmentAssetId !==
        normalizedCommand.controlIntent.environmentAssetId
    ) {
      return;
    }

    const vehicleRuntime = this.#vehiclesById.get(mountedOccupancy.vehicleId);
    const seatRuntime =
      vehicleRuntime?.seatsById.get(mountedOccupancy.seatId) ?? null;

    if (
      seatRuntime === null ||
      seatRuntime.occupantPlayerId !== command.playerId ||
      seatRuntime.occupantRole !== "driver"
    ) {
      return;
    }

    const existingControlState =
      this.#driverVehicleControlsByPlayerId.get(command.playerId);

    if (
      existingControlState !== undefined &&
      normalizedCommand.controlSequence <= existingControlState.controlSequence
    ) {
      return;
    }

    this.#driverVehicleControlsByPlayerId.set(command.playerId, {
      boost: normalizedCommand.controlIntent.boost,
      controlSequence: normalizedCommand.controlSequence,
      environmentAssetId: normalizedCommand.controlIntent.environmentAssetId,
      moveAxis: normalizedCommand.controlIntent.moveAxis,
      strafeAxis: normalizedCommand.controlIntent.strafeAxis,
      yawAxis: normalizedCommand.controlIntent.yawAxis
    });
    playerRuntime.lastSeenAtMs = nowMs;
  }

  #createPlayerRuntimeState(
    playerId: MetaversePlayerId,
    characterId: string,
    username: MetaversePresencePlayerSnapshot["username"],
    nowMs: number
  ): MetaversePlayerWorldRuntimeState {
    const groundedBodyRuntime = new MetaverseAuthoritativeGroundedBodyRuntime(
      metaverseAuthoritativeGroundedBodyRuntimeConfig,
      this.#physicsRuntime
    );
    const swimBodyRuntime = new MetaverseAuthoritativeSurfaceDriveRuntime(
      {
        controllerOffsetMeters: metaverseAuthoritativeCapsuleControllerOffsetMeters,
        shape: {
          halfHeightMeters: metaverseAuthoritativeGroundedBodyConfig.capsuleHalfHeightMeters,
          kind: "capsule",
          radiusMeters: metaverseAuthoritativeGroundedBodyConfig.capsuleRadiusMeters
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
    );

    this.#playerTraversalColliderHandles.add(groundedBodyRuntime.colliderHandle);
    this.#playerTraversalColliderHandles.add(swimBodyRuntime.colliderHandle);

    return {
      angularVelocityRadiansPerSecond: 0,
      characterId,
      forwardSpeedUnitsPerSecond: 0,
      groundedBodyRuntime,
      lastGroundedBodyJumpReady: false,
      lastGroundedJumpSupported: false,
      lastProcessedLookSequence: 0,
      lastProcessedInputSequence: 0,
      lastProcessedTraversalOrientationSequence: 0,
      lastSurfaceJumpSupported: false,
      lastGroundedPositionY: 0,
      lastPoseAtMs: null,
      lastSeenAtMs: nowMs,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      lookPitchRadians: 0,
      lookYawRadians: metaverseWorldInitialYawRadians,
      locomotionMode: "grounded",
      mountedOccupancy: null,
      playerId,
      presenceAnimationVocabulary: "idle",
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      realtimeWorldAuthorityActive: false,
      stateSequence: 0,
      strafeSpeedUnitsPerSecond: 0,
      traversalAuthorityState: createMetaverseTraversalAuthoritySnapshot(),
      unmountedTraversalState: createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode: "grounded"
      }),
      swimBodyRuntime,
      username,
      yawRadians: metaverseWorldInitialYawRadians
    };
  }

  #applyPlayerPose(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number,
    lookProvided: boolean = false
  ): void {
    const requestedMountedOccupancy = this.#resolveMountedOccupancyRuntimeState(
      nextPose.mountedOccupancy
    );
    const acceptedMountedOccupancy = this.#resolveAcceptedMountedOccupancy(
      playerRuntime.playerId,
      requestedMountedOccupancy,
      playerRuntime.mountedOccupancy
    );

    this.#clearPlayerVehicleOccupancy(playerRuntime.playerId);
    this.#clearPlayerTraversalIntent(playerRuntime.playerId);

    playerRuntime.presenceAnimationVocabulary = nextPose.animationVocabulary;
    playerRuntime.forwardSpeedUnitsPerSecond = 0;
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        locomotionMode:
          nextPose.locomotionMode === "swim" ? "swim" : "grounded"
      });
    playerRuntime.lastGroundedBodyJumpReady = false;
    playerRuntime.lastGroundedJumpSupported = false;
    playerRuntime.lastProcessedInputSequence = nextPose.stateSequence;
    playerRuntime.lastSurfaceJumpSupported = false;
    playerRuntime.lastGroundedPositionY = nextPose.position.y;
    playerRuntime.locomotionMode =
      acceptedMountedOccupancy === null && requestedMountedOccupancy !== null
        ? "grounded"
        : nextPose.locomotionMode;
    if (
      playerRuntime.locomotionMode === "grounded" ||
      playerRuntime.locomotionMode === "swim"
    ) {
      playerRuntime.unmountedTraversalState =
        createMetaverseUnmountedTraversalStateSnapshot({
          actionState: playerRuntime.unmountedTraversalState.actionState,
          locomotionMode: playerRuntime.locomotionMode
        });
    }
    playerRuntime.stateSequence = nextPose.stateSequence;
    playerRuntime.strafeSpeedUnitsPerSecond = 0;
    playerRuntime.mountedOccupancy = acceptedMountedOccupancy;
    playerRuntime.traversalAuthorityState =
      createMetaverseTraversalAuthoritySnapshot();

    if (playerRuntime.mountedOccupancy === null) {
      this.#clearDriverVehicleControl(playerRuntime.playerId);
      this.#applyPlayerWorldPoseFromPresence(playerRuntime, nextPose, nowMs);

      if (requestedMountedOccupancy !== null) {
        this.#syncUnmountedPlayerToAuthoritativeSurface(
          playerRuntime,
          this.#resolveAuthoritativeSurfaceColliders(),
          requestedMountedOccupancy.environmentAssetId
        );
      }

      this.#syncPlayerLookFromPresence(playerRuntime, nextPose, lookProvided);
      this.#syncPlayerTraversalAuthorityState(playerRuntime);

      return;
    }

    if (playerRuntime.mountedOccupancy.occupantRole !== "driver") {
      this.#clearDriverVehicleControl(playerRuntime.playerId);
    }

    const previousMountedFacingYawRadians = playerRuntime.yawRadians;

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;

    const vehicleRuntime = this.#syncVehicleOccupancyAndInitialPoseFromPlayer(
      playerRuntime,
      playerRuntime.mountedOccupancy,
      nowMs
    );

    this.#syncMountedPlayerPoseFromVehicle(
      playerRuntime,
      vehicleRuntime,
      nowMs,
      previousMountedFacingYawRadians
    );
    this.#syncPlayerLookFromPresence(playerRuntime, nextPose, lookProvided);
    this.#syncPlayerTraversalAuthorityState(playerRuntime);
  }

  #resolveMountedOccupancyRuntimeState(
    mountedOccupancy: MetaversePresenceMountedOccupancySnapshot | null
  ): MetaverseMountedOccupancyRuntimeState | null {
    if (mountedOccupancy === null) {
      return null;
    }

    return createMountedOccupancyRuntimeState(
      mountedOccupancy,
      this.#resolveVehicleId(mountedOccupancy.environmentAssetId)
    );
  }

  #resolveAcceptedMountedOccupancy(
    playerId: MetaversePlayerId,
    requestedMountedOccupancy: MetaverseMountedOccupancyRuntimeState | null,
    previousMountedOccupancy: MetaverseMountedOccupancyRuntimeState | null
  ): MetaverseMountedOccupancyRuntimeState | null {
    if (
      requestedMountedOccupancy !== null &&
      this.#canPlayerOccupyMountedSeat(playerId, requestedMountedOccupancy)
    ) {
      return requestedMountedOccupancy;
    }

    if (
      previousMountedOccupancy !== null &&
      this.#canPlayerOccupyMountedSeat(playerId, previousMountedOccupancy)
    ) {
      return previousMountedOccupancy;
    }

    return null;
  }

  #canPlayerOccupyMountedSeat(
    playerId: MetaversePlayerId,
    mountedOccupancy: MetaverseMountedOccupancyRuntimeState
  ): boolean {
    if (
      mountedOccupancy.occupancyKind !== "seat" ||
      mountedOccupancy.seatId === null
    ) {
      return true;
    }

    const vehicleRuntime = this.#ensureVehicleRuntime(
      mountedOccupancy.environmentAssetId,
      mountedOccupancy.vehicleId
    );
    const existingSeatRuntime = vehicleRuntime.seatsById.get(
      mountedOccupancy.seatId
    );

    return (
      existingSeatRuntime === undefined ||
      existingSeatRuntime.occupantPlayerId === null ||
      existingSeatRuntime.occupantPlayerId === playerId
    );
  }

  #applyPlayerWorldPoseFromPresence(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    nextPose: MetaversePresencePoseSnapshot,
    nowMs: number
  ): void {
    const deltaSeconds = computeSecondsBetween(playerRuntime.lastPoseAtMs, nowMs);
    const previousPositionX = playerRuntime.positionX;
    const previousPositionY = playerRuntime.positionY;
    const previousPositionZ = playerRuntime.positionZ;
    const previousYawRadians = playerRuntime.yawRadians;

    playerRuntime.positionX = nextPose.position.x;
    playerRuntime.positionY = nextPose.position.y;
    playerRuntime.positionZ = nextPose.position.z;
    playerRuntime.yawRadians = nextPose.yawRadians;
    if (playerRuntime.locomotionMode === "grounded") {
      playerRuntime.lastGroundedPositionY = nextPose.position.y;
    }

    if (deltaSeconds === null) {
      playerRuntime.angularVelocityRadiansPerSecond = 0;
      playerRuntime.forwardSpeedUnitsPerSecond = 0;
      playerRuntime.linearVelocityX = 0;
      playerRuntime.linearVelocityY = 0;
      playerRuntime.linearVelocityZ = 0;
      playerRuntime.strafeSpeedUnitsPerSecond = 0;
    } else {
      playerRuntime.angularVelocityRadiansPerSecond =
        normalizeAngularDeltaRadians(
          playerRuntime.yawRadians - previousYawRadians
        ) / deltaSeconds;
      playerRuntime.linearVelocityX =
        (playerRuntime.positionX - previousPositionX) / deltaSeconds;
      playerRuntime.linearVelocityY =
        (playerRuntime.positionY - previousPositionY) / deltaSeconds;
      playerRuntime.linearVelocityZ =
        (playerRuntime.positionZ - previousPositionZ) / deltaSeconds;
      const forwardX = Math.sin(playerRuntime.yawRadians);
      const forwardZ = -Math.cos(playerRuntime.yawRadians);
      const rightX = Math.cos(playerRuntime.yawRadians);
      const rightZ = Math.sin(playerRuntime.yawRadians);

      playerRuntime.forwardSpeedUnitsPerSecond =
        playerRuntime.linearVelocityX * forwardX +
        playerRuntime.linearVelocityZ * forwardZ;
      playerRuntime.strafeSpeedUnitsPerSecond =
        playerRuntime.linearVelocityX * rightX +
        playerRuntime.linearVelocityZ * rightZ;
    }

    playerRuntime.lastPoseAtMs = nowMs;
    this.#syncPlayerTraversalBodyRuntimes(playerRuntime);
  }

  #syncPlayerTraversalBodyRuntimes(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    groundedOverride?: boolean
  ): void {
    const grounded =
      playerRuntime.locomotionMode === "grounded" &&
      (groundedOverride ?? isGroundedUnmountedPlayerRuntime(playerRuntime));
    const position = createPhysicsVector3Snapshot(
      playerRuntime.positionX,
      playerRuntime.positionY,
      playerRuntime.positionZ
    );
    const linearVelocity = createPlayerLinearVelocitySnapshot(playerRuntime);

    playerRuntime.groundedBodyRuntime.syncAuthoritativeState({
      grounded,
      linearVelocity,
      position,
      yawRadians: playerRuntime.yawRadians
    });
    playerRuntime.swimBodyRuntime.syncAuthoritativeState({
      linearVelocity,
      position,
      yawRadians: playerRuntime.yawRadians
    });
  }

  #syncPlayerLookFromPresence(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    nextPose: MetaversePresencePoseSnapshot,
    lookProvided: boolean
  ): void {
    if (!lookProvided) {
      playerRuntime.lastProcessedLookSequence = 0;
      this.#syncImplicitPlayerLookFromBodyYaw(playerRuntime);
      return;
    }

    const constrainedLookIntent = this.#resolveConstrainedPlayerLookIntent(
      playerRuntime,
      nextPose.look.pitchRadians,
      nextPose.look.yawRadians
    );

    playerRuntime.lastProcessedLookSequence = Math.max(1, nextPose.stateSequence);
    playerRuntime.lookPitchRadians = constrainedLookIntent.pitchRadians;
    playerRuntime.lookYawRadians = constrainedLookIntent.yawRadians;
  }

  #syncVehicleOccupancyAndInitialPoseFromPlayer(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    mountedOccupancy: MetaverseMountedOccupancyRuntimeState,
    nowMs: number
  ): MetaverseVehicleWorldRuntimeState {
    const vehicleRuntime = this.#ensureVehicleRuntime(
      mountedOccupancy.environmentAssetId,
      mountedOccupancy.vehicleId
    );

    if (mountedOccupancy.occupancyKind === "seat" && mountedOccupancy.seatId !== null) {
      const seatRuntime = this.#ensureVehicleSeatRuntime(
        vehicleRuntime,
        mountedOccupancy.seatId,
        mountedOccupancy.occupantRole
      );

      seatRuntime.occupantPlayerId = playerRuntime.playerId;
      seatRuntime.occupantRole = mountedOccupancy.occupantRole;
    }

    if (vehicleRuntime.lastPoseAtMs === null) {
      vehicleRuntime.angularVelocityRadiansPerSecond = 0;
      vehicleRuntime.forwardSpeedUnitsPerSecond = 0;
      vehicleRuntime.linearVelocityX = 0;
      vehicleRuntime.linearVelocityY = 0;
      vehicleRuntime.linearVelocityZ = 0;
      vehicleRuntime.positionX = playerRuntime.positionX;
      vehicleRuntime.positionY = playerRuntime.positionY;
      vehicleRuntime.positionZ = playerRuntime.positionZ;
      vehicleRuntime.strafeSpeedUnitsPerSecond = 0;
      vehicleRuntime.yawRadians = playerRuntime.yawRadians;
      vehicleRuntime.lastPoseAtMs = nowMs;
    }

    this.#syncVehicleDriveRuntime(vehicleRuntime);
    this.#syncVehicleDynamicSurfaceColliders(vehicleRuntime);

    return vehicleRuntime;
  }

  #syncVehicleDriveRuntime(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState
  ): void {
    vehicleRuntime.driveRuntime.syncAuthoritativeState({
      linearVelocity: createPhysicsVector3Snapshot(
        vehicleRuntime.linearVelocityX,
        vehicleRuntime.linearVelocityY,
        vehicleRuntime.linearVelocityZ
      ),
      position: createPhysicsVector3Snapshot(
        vehicleRuntime.positionX,
        vehicleRuntime.positionY,
        vehicleRuntime.positionZ
      ),
      yawRadians: vehicleRuntime.yawRadians
    });
  }

  #syncMountedPlayerPoseFromVehicle(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    nowMs: number,
    previousFacingYawRadians: number = playerRuntime.yawRadians
  ): void {
    playerRuntime.positionX = vehicleRuntime.positionX;
    playerRuntime.positionY = vehicleRuntime.positionY;
    playerRuntime.positionZ = vehicleRuntime.positionZ;
    playerRuntime.yawRadians = vehicleRuntime.yawRadians;
    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      previousFacingYawRadians,
      vehicleRuntime.yawRadians
    );
    playerRuntime.angularVelocityRadiansPerSecond =
      vehicleRuntime.angularVelocityRadiansPerSecond;
    playerRuntime.forwardSpeedUnitsPerSecond =
      vehicleRuntime.forwardSpeedUnitsPerSecond;
    playerRuntime.linearVelocityX = vehicleRuntime.linearVelocityX;
    playerRuntime.linearVelocityY = vehicleRuntime.linearVelocityY;
    playerRuntime.linearVelocityZ = vehicleRuntime.linearVelocityZ;
    playerRuntime.strafeSpeedUnitsPerSecond =
      vehicleRuntime.strafeSpeedUnitsPerSecond;
    playerRuntime.lastPoseAtMs = nowMs;
    this.#syncPlayerTraversalBodyRuntimes(playerRuntime);
    this.#syncPlayerTraversalAuthorityState(playerRuntime);
  }

  #syncPlayerTraversalAuthorityState(
    playerRuntime: MetaversePlayerWorldRuntimeState
  ): void {
    playerRuntime.traversalAuthorityState =
      resolveMetaverseTraversalAuthoritySnapshotInput({
        currentTick: this.#currentTick,
        jumpAuthorityState: resolvePlayerJumpAuthorityState(playerRuntime),
        locomotionMode:
          playerRuntime.locomotionMode === "swim" ? "swim" : "grounded",
        mounted: playerRuntime.mountedOccupancy !== null,
        pendingActionKind:
          playerRuntime.unmountedTraversalState.actionState.pendingActionKind,
        pendingActionSequence:
          playerRuntime.unmountedTraversalState.actionState.pendingActionSequence,
        previousTraversalAuthority: playerRuntime.traversalAuthorityState,
        resolvedActionKind:
          playerRuntime.unmountedTraversalState.actionState.resolvedActionKind,
        resolvedActionSequence:
          playerRuntime.unmountedTraversalState.actionState.resolvedActionSequence,
        resolvedActionState:
          playerRuntime.unmountedTraversalState.actionState.resolvedActionState
      });
  }

  #applyGroundedBodySnapshotToPlayerRuntime(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    groundedBodySnapshot: MetaverseAuthoritativeGroundedBodySnapshot,
    deltaSeconds: number
  ): void {
    const previousYawRadians = playerRuntime.yawRadians;
    const nextPosition = groundedBodySnapshot.position;
    const deltaX = nextPosition.x - playerRuntime.positionX;
    const deltaY = nextPosition.y - playerRuntime.positionY;
    const deltaZ = nextPosition.z - playerRuntime.positionZ;
    const forwardX = Math.sin(groundedBodySnapshot.yawRadians);
    const forwardZ = -Math.cos(groundedBodySnapshot.yawRadians);
    const rightX = Math.cos(groundedBodySnapshot.yawRadians);
    const rightZ = Math.sin(groundedBodySnapshot.yawRadians);

    playerRuntime.positionX = nextPosition.x;
    playerRuntime.positionY = nextPosition.y;
    playerRuntime.positionZ = nextPosition.z;
    playerRuntime.yawRadians = groundedBodySnapshot.yawRadians;
    playerRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(
        groundedBodySnapshot.yawRadians - previousYawRadians
      ) / deltaSeconds;
    playerRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds : 0;
    playerRuntime.linearVelocityX = deltaSeconds > 0 ? deltaX / deltaSeconds : 0;
    playerRuntime.linearVelocityY = deltaSeconds > 0 ? deltaY / deltaSeconds : 0;
    playerRuntime.linearVelocityZ = deltaSeconds > 0 ? deltaZ / deltaSeconds : 0;
    playerRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
  }

  #applySurfaceDriveSnapshotToPlayerRuntime(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    surfaceDriveSnapshot: {
      readonly linearVelocity: PhysicsVector3Snapshot;
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    },
    deltaSeconds: number
  ): void {
    const previousYawRadians = playerRuntime.yawRadians;
    const nextPosition = surfaceDriveSnapshot.position;
    const deltaX = nextPosition.x - playerRuntime.positionX;
    const deltaY = nextPosition.y - playerRuntime.positionY;
    const deltaZ = nextPosition.z - playerRuntime.positionZ;
    const forwardX = Math.sin(surfaceDriveSnapshot.yawRadians);
    const forwardZ = -Math.cos(surfaceDriveSnapshot.yawRadians);
    const rightX = Math.cos(surfaceDriveSnapshot.yawRadians);
    const rightZ = Math.sin(surfaceDriveSnapshot.yawRadians);

    playerRuntime.positionX = nextPosition.x;
    playerRuntime.positionY = nextPosition.y;
    playerRuntime.positionZ = nextPosition.z;
    playerRuntime.yawRadians = surfaceDriveSnapshot.yawRadians;
    playerRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(
        surfaceDriveSnapshot.yawRadians - previousYawRadians
      ) / deltaSeconds;
    playerRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds : 0;
    playerRuntime.linearVelocityX = surfaceDriveSnapshot.linearVelocity.x;
    playerRuntime.linearVelocityY = surfaceDriveSnapshot.linearVelocity.y;
    playerRuntime.linearVelocityZ = surfaceDriveSnapshot.linearVelocity.z;
    playerRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
  }

  #syncImplicitPlayerLookFromBodyYaw(
    playerRuntime: MetaversePlayerWorldRuntimeState
  ): void {
    if (playerRuntime.lastProcessedLookSequence > 0) {
      return;
    }

    playerRuntime.lookPitchRadians = 0;
    playerRuntime.lookYawRadians = playerRuntime.yawRadians;
  }

  #syncUnmountedPlayerLookFromTraversalIntent(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    traversalIntent: Pick<MetaversePlayerTraversalIntentSnapshot, "facing">
  ): void {
    playerRuntime.lookPitchRadians = traversalIntent.facing.pitchRadians;
    playerRuntime.lookYawRadians = traversalIntent.facing.yawRadians;
  }

  #resolveConstrainedPlayerLookIntent(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    pitchRadians: number,
    yawRadians: number
  ): {
    readonly pitchRadians: number;
    readonly yawRadians: number;
  } {
    const bounds = resolveAuthoritativePlayerLookConstraintBounds(playerRuntime);
    const constrainedPitchRadians = clamp(
      pitchRadians,
      bounds.minPitchRadians,
      bounds.maxPitchRadians
    );

    if (bounds.maxYawOffsetRadians === null) {
      return {
        pitchRadians: constrainedPitchRadians,
        yawRadians: wrapRadians(yawRadians)
      };
    }

    const constrainedYawOffsetRadians = clamp(
      normalizeAngularDeltaRadians(yawRadians - playerRuntime.yawRadians),
      -bounds.maxYawOffsetRadians,
      bounds.maxYawOffsetRadians
    );

    return {
      pitchRadians: constrainedPitchRadians,
      yawRadians: wrapRadians(
        playerRuntime.yawRadians + constrainedYawOffsetRadians
      )
    };
  }

  #syncAuthoritativePlayerLookForFacingChange(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    previousFacingYawRadians: number,
    nextFacingYawRadians: number
  ): void {
    if (playerRuntime.lastProcessedLookSequence === 0) {
      this.#syncImplicitPlayerLookFromBodyYaw(playerRuntime);
      return;
    }

    const bounds = resolveAuthoritativePlayerLookConstraintBounds(playerRuntime);

    playerRuntime.lookPitchRadians = clamp(
      playerRuntime.lookPitchRadians,
      bounds.minPitchRadians,
      bounds.maxPitchRadians
    );

    if (bounds.maxYawOffsetRadians === null) {
      playerRuntime.lookYawRadians = wrapRadians(playerRuntime.lookYawRadians);
      return;
    }

    const constrainedYawOffsetRadians = clamp(
      normalizeAngularDeltaRadians(
        playerRuntime.lookYawRadians - previousFacingYawRadians
      ),
      -bounds.maxYawOffsetRadians,
      bounds.maxYawOffsetRadians
    );

    playerRuntime.lookYawRadians = wrapRadians(
      nextFacingYawRadians + constrainedYawOffsetRadians
    );
  }

  #syncAuthoritativePlayerLookToCurrentFacing(
    playerRuntime: MetaversePlayerWorldRuntimeState
  ): void {
    this.#syncAuthoritativePlayerLookForFacingChange(
      playerRuntime,
      playerRuntime.yawRadians,
      playerRuntime.yawRadians
    );
  }

  #ensureVehicleRuntime(
    environmentAssetId: string,
    vehicleId: NonNullable<ReturnType<typeof createMetaverseVehicleId>>
  ): MetaverseVehicleWorldRuntimeState {
    const existingVehicleRuntime = this.#vehiclesById.get(vehicleId);

    if (existingVehicleRuntime !== undefined) {
      return existingVehicleRuntime;
    }

    const driveColliderShape = resolveVehicleDriveColliderShape(
      environmentAssetId
    );

    const vehicleRuntime: MetaverseVehicleWorldRuntimeState = {
      angularVelocityRadiansPerSecond: 0,
      driveRuntime: new MetaverseAuthoritativeSurfaceDriveRuntime(
        {
          controllerOffsetMeters: metaverseAuthoritativeCapsuleControllerOffsetMeters,
          shape: {
            halfExtents: driveColliderShape.halfExtents,
            kind: "cuboid",
            localCenter: driveColliderShape.localCenter
          },
          spawnPosition: createPhysicsVector3Snapshot(0, 0, 0),
          spawnYawRadians: 0,
          worldRadius: metaverseAuthoritativeVehicleSurfaceDriveConfig.worldRadius
        },
        this.#physicsRuntime
      ),
      environmentAssetId,
      forwardSpeedUnitsPerSecond: 0,
      lastPoseAtMs: null,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      seatsById: new Map(),
      strafeSpeedUnitsPerSecond: 0,
      vehicleId,
      yawRadians: 0
    };

    this.#vehicleDriveColliderHandles.add(vehicleRuntime.driveRuntime.colliderHandle);

    this.#vehiclesById.set(vehicleId, vehicleRuntime);

    return vehicleRuntime;
  }

  #ensureVehicleSeatRuntime(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    seatId: string,
    occupantRole: MetaversePresenceMountedOccupantRoleId
  ): MetaverseVehicleSeatRuntimeState {
    const existingSeatRuntime = vehicleRuntime.seatsById.get(seatId);

    if (existingSeatRuntime !== undefined) {
      return existingSeatRuntime;
    }

    const seatRuntime: MetaverseVehicleSeatRuntimeState = {
      occupantPlayerId: null,
      occupantRole,
      seatId
    };

    vehicleRuntime.seatsById.set(seatId, seatRuntime);

    return seatRuntime;
  }

  #resolveVehicleId(
    environmentAssetId: string
  ): NonNullable<ReturnType<typeof createMetaverseVehicleId>> {
    const existingVehicleId =
      this.#vehicleIdsByEnvironmentAssetId.get(environmentAssetId);

    if (existingVehicleId !== undefined) {
      return existingVehicleId;
    }

    const preferredVehicleId =
      createMetaverseVehicleId(environmentAssetId) ??
      createMetaverseVehicleId(`metaverse-vehicle-${this.#nextVehicleOrdinal}`);

    if (preferredVehicleId === null) {
      throw new Error(
        `Metaverse authoritative world could not resolve a vehicle id for ${environmentAssetId}.`
      );
    }

    this.#nextVehicleOrdinal += 1;
    this.#vehicleIdsByEnvironmentAssetId.set(environmentAssetId, preferredVehicleId);

    return preferredVehicleId;
  }

  #clearPlayerVehicleOccupancy(playerId: MetaversePlayerId): void {
    for (const vehicleRuntime of this.#vehiclesById.values()) {
      for (const seatRuntime of vehicleRuntime.seatsById.values()) {
        if (seatRuntime.occupantPlayerId === playerId) {
          seatRuntime.occupantPlayerId = null;
        }
      }
    }
  }

  #clearDriverVehicleControl(playerId: MetaversePlayerId): void {
    this.#driverVehicleControlsByPlayerId.delete(playerId);
  }

  #clearPlayerTraversalIntent(playerId: MetaversePlayerId): void {
    this.#playerTraversalIntentsByPlayerId.delete(playerId);
    const playerRuntime = this.#playersById.get(playerId);

    if (playerRuntime === undefined) {
      return;
    }

    playerRuntime.unmountedTraversalState =
      clearMetaverseUnmountedTraversalPendingActions(
        playerRuntime.unmountedTraversalState
      );
  }

  #disposePlayerTraversalRuntimes(
    playerRuntime: MetaversePlayerWorldRuntimeState
  ): void {
    this.#playerTraversalColliderHandles.delete(
      playerRuntime.groundedBodyRuntime.colliderHandle
    );
    this.#playerTraversalColliderHandles.delete(
      playerRuntime.swimBodyRuntime.colliderHandle
    );
    playerRuntime.groundedBodyRuntime.dispose();
    playerRuntime.swimBodyRuntime.dispose();
  }

  #recordObserverHeartbeat(
    observerPlayerId: MetaversePlayerId,
    nowMs: number
  ): void {
    const observerRuntime = this.#playersById.get(observerPlayerId);

    if (observerRuntime === undefined) {
      return;
    }

    observerRuntime.lastSeenAtMs = nowMs;
  }

  #pruneInactivePlayers(nowMs: number): void {
    const timeoutMs = Number(this.#config.playerInactivityTimeoutMs);
    let prunedPlayer = false;

    for (const [playerId, playerRuntime] of this.#playersById) {
      if (nowMs - playerRuntime.lastSeenAtMs <= timeoutMs) {
        continue;
      }

      this.#clearDriverVehicleControl(playerId);
      this.#clearPlayerTraversalIntent(playerId);
      this.#clearPlayerVehicleOccupancy(playerId);
      this.#disposePlayerTraversalRuntimes(playerRuntime);
      this.#playersById.delete(playerId);
      prunedPlayer = true;
    }

    if (prunedPlayer) {
      this.#snapshotSequence += 1;
    }
  }

  #advanceToTime(nowMs: number): void {
    if (this.#lastAdvancedAtMs === null) {
      this.#lastAdvancedAtMs = nowMs;
      return;
    }

    const tickIntervalMs = Number(this.#config.tickIntervalMs);

    if (!Number.isFinite(tickIntervalMs) || tickIntervalMs <= 0) {
      return;
    }

    let advancedTick = false;
    const tickIntervalSeconds = tickIntervalMs / 1_000;

    while (this.#lastAdvancedAtMs + tickIntervalMs <= nowMs) {
      this.#lastAdvancedAtMs += tickIntervalMs;
      this.#physicsRuntime.stepSimulation(tickIntervalSeconds);
      this.#advanceVehicleRuntimes(tickIntervalSeconds, this.#lastAdvancedAtMs);
      this.#physicsRuntime.stepSimulation(tickIntervalSeconds);
      this.#advanceUnmountedPlayerRuntimes(
        tickIntervalSeconds,
        this.#lastAdvancedAtMs
      );
      this.#syncMountedPlayerWorldStateFromVehicles(this.#lastAdvancedAtMs);
      this.#currentTick += 1;
      advancedTick = true;
    }

    if (advancedTick) {
      this.#snapshotSequence += 1;
    }
  }

  #advanceVehicleRuntimes(deltaSeconds: number, nowMs: number): void {
    for (const vehicleRuntime of this.#vehiclesById.values()) {
      if (vehicleRuntime.lastPoseAtMs === null) {
        continue;
      }

      const driverControlState =
        this.#resolveDriverVehicleControlRuntimeState(vehicleRuntime);

      this.#advanceVehicleRuntime(vehicleRuntime, driverControlState, deltaSeconds);
      vehicleRuntime.lastPoseAtMs = nowMs;
    }
  }

  #advanceUnmountedPlayerRuntimes(deltaSeconds: number, nowMs: number): void {
    const authoritativeSurfaceColliders =
      this.#resolveAuthoritativeSurfaceColliders();

    for (const playerRuntime of this.#playersById.values()) {
      if (playerRuntime.mountedOccupancy !== null) {
        continue;
      }

      this.#advanceUnmountedPlayerRuntime(
        playerRuntime,
        deltaSeconds,
        nowMs,
        authoritativeSurfaceColliders
      );
    }
  }

  #advanceUnmountedPlayerRuntime(
    playerRuntime: MetaversePlayerWorldRuntimeState,
    deltaSeconds: number,
    nowMs: number,
    authoritativeSurfaceColliders: readonly MetaverseAuthoritativeSurfaceColliderSnapshot[]
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const traversalIntent =
      this.#playerTraversalIntentsByPlayerId.get(playerRuntime.playerId) ?? null;
    const locomotionMode =
      playerRuntime.locomotionMode === "swim" ? "swim" : "grounded";
    const moveAxis = clampAxis(traversalIntent?.bodyControl.moveAxis ?? 0);
    const strafeAxis = clampAxis(traversalIntent?.bodyControl.strafeAxis ?? 0);
    const preferredFacingYawRadians = traversalIntent?.facing.yawRadians ?? null;
    let groundedBodyJumpReady = false;
    let grounded = false;
    let surfaceJumpSupported = false;
    let groundedJumpSupported = false;
    let resolvedLocomotionMode: "grounded" | "swim" = locomotionMode;
    let jumpRequested = false;
    const preparedTraversalStep = prepareMetaverseUnmountedTraversalStep({
      bodyControl: Object.freeze({
        boost: traversalIntent?.bodyControl.boost === true,
        moveAxis,
        strafeAxis,
        turnAxis: traversalIntent?.bodyControl.turnAxis ?? 0
      }),
      deltaSeconds,
      groundedBodyConfig: Object.freeze({
        controllerOffsetMeters:
          metaverseAuthoritativeGroundedBodyRuntimeConfig.controllerOffsetMeters,
        maxTurnSpeedRadiansPerSecond:
          metaverseAuthoritativeGroundedBodyRuntimeConfig.maxTurnSpeedRadiansPerSecond,
        snapToGroundDistanceMeters:
          metaverseAuthoritativeGroundedBodyRuntimeConfig.snapToGroundDistanceMeters
      }),
      groundedBodySnapshot:
        locomotionMode === "grounded"
          ? playerRuntime.groundedBodyRuntime.snapshot
          : null,
      jumpSupportVerticalSpeedTolerance:
        metaverseAuthoritativeGroundedJumpSupportVerticalSpeedTolerance,
      preferredLookYawRadians: preferredFacingYawRadians,
      surfaceColliderSnapshots: authoritativeSurfaceColliders,
      surfacePolicyConfig: metaverseAuthoritativeGroundedBodyConfig,
      swimBodySnapshot:
        locomotionMode === "swim" ? playerRuntime.swimBodyRuntime.snapshot : null,
      traversalState: playerRuntime.unmountedTraversalState,
      waterRegionSnapshots: metaverseAuthoritativeWaterRegionSnapshots
    });
    playerRuntime.unmountedTraversalState = preparedTraversalStep.traversalState;

    if (preparedTraversalStep.locomotionMode === "swim") {
      const swimSnapshot = playerRuntime.swimBodyRuntime.advance(
        {
          boost: preparedTraversalStep.bodyControl.boost,
          moveAxis: preparedTraversalStep.bodyControl.moveAxis,
          strafeAxis: preparedTraversalStep.bodyControl.strafeAxis,
          yawAxis: preparedTraversalStep.bodyControl.turnAxis
        },
        metaverseAuthoritativeSwimTraversalConfig,
        deltaSeconds,
        preparedTraversalStep.waterlineHeightMeters,
        preferredFacingYawRadians,
        this.#createWaterborneTraversalColliderPredicate()
      );
      const swimTraversalOutcome = resolveMetaverseUnmountedTraversalStep({
        groundedBodySnapshot: null,
        preparedTraversalStep,
        surfaceColliderSnapshots: authoritativeSurfaceColliders,
        surfacePolicyConfig: metaverseAuthoritativeGroundedBodyConfig,
        swimBodySnapshot: swimSnapshot,
        waterRegionSnapshots: metaverseAuthoritativeWaterRegionSnapshots
      });
      playerRuntime.unmountedTraversalState = swimTraversalOutcome.traversalState;
      this.#applySurfaceDriveSnapshotToPlayerRuntime(
        playerRuntime,
        {
          linearVelocity: swimSnapshot.linearVelocity,
          position: createPhysicsVector3Snapshot(
            swimSnapshot.position.x,
            swimTraversalOutcome.waterlineHeightMeters,
            swimSnapshot.position.z
          ),
          yawRadians: swimSnapshot.yawRadians
        },
        deltaSeconds
      );

      if (swimTraversalOutcome.grounded) {
        playerRuntime.positionY =
          swimTraversalOutcome.supportHeightMeters ?? playerRuntime.positionY;
        playerRuntime.linearVelocityY = 0;
        grounded = true;
        resolvedLocomotionMode = "grounded";
      }
    } else {
      groundedBodyJumpReady = playerRuntime.groundedBodyRuntime.snapshot.jumpReady;
      surfaceJumpSupported = preparedTraversalStep.surfaceJumpSupported;
      groundedJumpSupported = preparedTraversalStep.groundedJumpSupported;
      jumpRequested = preparedTraversalStep.jumpRequested;

      playerRuntime.groundedBodyRuntime.setAutostepEnabled(
        preparedTraversalStep.autostepHeightMeters !== null,
        preparedTraversalStep.autostepHeightMeters ??
          metaverseAuthoritativeGroundedBodyConfig.stepHeightMeters
      );
      const groundedBodySnapshot = playerRuntime.groundedBodyRuntime.advance(
        preparedTraversalStep.bodyIntent,
        deltaSeconds,
        preferredFacingYawRadians,
        this.#shouldConsiderTraversalCollider
      );
      this.#applyGroundedBodySnapshotToPlayerRuntime(
        playerRuntime,
        groundedBodySnapshot,
        deltaSeconds
      );
      const groundedTraversalOutcome = resolveMetaverseUnmountedTraversalStep({
        groundedBodySnapshot,
        preparedTraversalStep,
        surfaceColliderSnapshots: authoritativeSurfaceColliders,
        surfacePolicyConfig: metaverseAuthoritativeGroundedBodyConfig,
        swimBodySnapshot: null,
        waterRegionSnapshots: metaverseAuthoritativeWaterRegionSnapshots
      });
      playerRuntime.unmountedTraversalState = groundedTraversalOutcome.traversalState;

      if (groundedTraversalOutcome.locomotionMode === "swim") {
        playerRuntime.positionY = groundedTraversalOutcome.waterlineHeightMeters;
        playerRuntime.linearVelocityY = 0;
        grounded = false;
        resolvedLocomotionMode = "swim";
      } else {
        resolvedLocomotionMode = "grounded";
        grounded = groundedTraversalOutcome.grounded;
      }
    }

    playerRuntime.lastGroundedBodyJumpReady = groundedBodyJumpReady;
    playerRuntime.lastSurfaceJumpSupported = surfaceJumpSupported;
    playerRuntime.lastGroundedJumpSupported = groundedJumpSupported;

    if (traversalIntent === null) {
      this.#syncImplicitPlayerLookFromBodyYaw(playerRuntime);
    } else {
      this.#syncUnmountedPlayerLookFromTraversalIntent(
        playerRuntime,
        traversalIntent
      );
    }
    playerRuntime.locomotionMode = resolvedLocomotionMode;
    playerRuntime.unmountedTraversalState =
      createMetaverseUnmountedTraversalStateSnapshot({
        actionState: playerRuntime.unmountedTraversalState.actionState,
        locomotionMode: resolvedLocomotionMode
      });
    playerRuntime.lastPoseAtMs = nowMs;

    if (resolvedLocomotionMode === "grounded" && grounded) {
      playerRuntime.lastGroundedPositionY = playerRuntime.positionY;
    }

    this.#syncPlayerTraversalBodyRuntimes(
      playerRuntime,
      resolvedLocomotionMode === "grounded" && grounded
    );

    if (
      traversalIntent !== null &&
      traversalIntent.inputSequence > playerRuntime.lastProcessedInputSequence
    ) {
      playerRuntime.lastProcessedInputSequence = traversalIntent.inputSequence;
      playerRuntime.stateSequence = traversalIntent.inputSequence;
    }

    if (
      traversalIntent !== null &&
      traversalIntent.orientationSequence >
        playerRuntime.lastProcessedTraversalOrientationSequence
    ) {
      playerRuntime.lastProcessedTraversalOrientationSequence =
        traversalIntent.orientationSequence;
    }

    this.#syncPlayerTraversalAuthorityState(playerRuntime);
  }

  #resolveDriverVehicleControlRuntimeState(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState
  ): MetaverseDriverVehicleControlRuntimeState | null {
    for (const seatRuntime of vehicleRuntime.seatsById.values()) {
      if (
        seatRuntime.occupantPlayerId === null ||
        seatRuntime.occupantRole !== "driver"
      ) {
        continue;
      }

      const playerRuntime = this.#playersById.get(seatRuntime.occupantPlayerId);

      if (
        playerRuntime === undefined ||
        playerRuntime.mountedOccupancy === null ||
        playerRuntime.mountedOccupancy.occupancyKind !== "seat" ||
        playerRuntime.mountedOccupancy.vehicleId !== vehicleRuntime.vehicleId
      ) {
        continue;
      }

      const driverControlState = this.#driverVehicleControlsByPlayerId.get(
        seatRuntime.occupantPlayerId
      );

      if (
        driverControlState === undefined ||
        driverControlState.environmentAssetId !== vehicleRuntime.environmentAssetId
      ) {
        return null;
      }

      return driverControlState;
    }

    return null;
  }

  #advanceVehicleRuntime(
    vehicleRuntime: MetaverseVehicleWorldRuntimeState,
    driverControlState: MetaverseDriverVehicleControlRuntimeState | null,
    deltaSeconds: number
  ): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    const nextVehicleState = vehicleRuntime.driveRuntime.advance(
      {
        boost: driverControlState?.boost === true,
        moveAxis: driverControlState?.moveAxis ?? 0,
        strafeAxis: driverControlState?.strafeAxis ?? 0,
        yawAxis: driverControlState?.yawAxis ?? 0
      },
      metaverseAuthoritativeVehicleSurfaceDriveConfig,
      deltaSeconds,
      vehicleRuntime.positionY,
      null,
      this.#createWaterborneTraversalColliderPredicate(
        vehicleRuntime.environmentAssetId
      )
    );
    const nextYawRadians = nextVehicleState.yawRadians;
    const nextPositionX = nextVehicleState.position.x;
    const nextPositionZ = nextVehicleState.position.z;
    const deltaX = nextPositionX - vehicleRuntime.positionX;
    const deltaZ = nextPositionZ - vehicleRuntime.positionZ;
    const previousYawRadians = vehicleRuntime.yawRadians;
    vehicleRuntime.positionX = nextPositionX;
    vehicleRuntime.positionY = nextVehicleState.position.y;
    vehicleRuntime.positionZ = nextPositionZ;
    vehicleRuntime.yawRadians = nextYawRadians;
    vehicleRuntime.linearVelocityX = nextVehicleState.linearVelocity.x;
    vehicleRuntime.linearVelocityY = nextVehicleState.linearVelocity.y;
    vehicleRuntime.linearVelocityZ = nextVehicleState.linearVelocity.z;
    vehicleRuntime.angularVelocityRadiansPerSecond =
      normalizeAngularDeltaRadians(nextYawRadians - previousYawRadians) /
      deltaSeconds;
    const forwardX = Math.sin(nextYawRadians);
    const forwardZ = -Math.cos(nextYawRadians);
    const rightX = Math.cos(nextYawRadians);
    const rightZ = Math.sin(nextYawRadians);
    vehicleRuntime.forwardSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds : 0;
    vehicleRuntime.strafeSpeedUnitsPerSecond =
      deltaSeconds > 0 ? (deltaX * rightX + deltaZ * rightZ) / deltaSeconds : 0;
    this.#syncVehicleDynamicSurfaceColliders(vehicleRuntime);
  }

  #syncMountedPlayerWorldStateFromVehicles(nowMs: number): void {
    for (const playerRuntime of this.#playersById.values()) {
      const mountedOccupancy = playerRuntime.mountedOccupancy;

      if (mountedOccupancy === null) {
        continue;
      }

      const vehicleRuntime = this.#vehiclesById.get(mountedOccupancy.vehicleId);

      if (vehicleRuntime === undefined) {
        continue;
      }

      this.#syncMountedPlayerPoseFromVehicle(playerRuntime, vehicleRuntime, nowMs);
    }
  }
}
