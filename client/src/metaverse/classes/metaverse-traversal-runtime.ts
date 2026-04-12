import {
  MetaverseGroundedBodyRuntime,
  type PhysicsVector3Snapshot
} from "@/physics";
import { defaultMetaverseLocomotionMode } from "../config/metaverse-locomotion-modes";
import {
  advanceMetaverseCameraSnapshot,
  createMetaverseCameraSnapshot
} from "../states/metaverse-flight";
import type { MetaverseFlightInputSnapshot } from "../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../types/metaverse-locomotion-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseEnvironmentAssetProofConfig,
  MetaverseRuntimeConfig,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";
import {
  advanceTraversalCameraPresentationPitchRadians,
  advanceTraversalMountedOccupancyLookYawRadians,
  clampTraversalMountedOccupancyPitchRadians,
  createTraversalGroundedCameraPresentationSnapshot,
  createTraversalMountedVehicleCameraPresentationSnapshot,
  createTraversalSwimCameraPresentationSnapshot
} from "../traversal/presentation/camera-presentation";
import { createTraversalCharacterPresentationSnapshot } from "../traversal/presentation/character-presentation";
import {
  advanceSurfaceLocomotionSnapshot,
  clamp,
  createSurfaceLocomotionSnapshot,
  freezeVector3,
  toFiniteNumber,
  wrapRadians
} from "../traversal/policies/surface-locomotion";
import {
  isWaterbornePosition,
  resolveAutomaticSurfaceLocomotionMode,
  resolveSurfaceHeightMeters,
  shouldEnableGroundedAutostep
} from "../traversal/policies/surface-routing";
import type {
  MetaverseTraversalRuntimeDependencies,
  RoutedDriverVehicleControlIntentSnapshot,
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../traversal/types/traversal";
import {
  MetaverseVehicleRuntime,
  type MountedVehicleControlIntent
} from "../vehicles";

function createIdleGroundedBodyIntentSnapshot() {
  return Object.freeze({
    boost: false,
    jump: false,
    moveAxis: 0,
    strafeAxis: 0,
    turnAxis: 0
  });
}

function resolveMountedEnvironmentDirectSeatTargets(
  mountableEnvironmentConfig: Pick<MetaverseEnvironmentAssetProofConfig, "seats">
): MountedEnvironmentSnapshot["directSeatTargets"] {
  return Object.freeze(
    (mountableEnvironmentConfig.seats ?? [])
      .filter((seat) => seat.directEntryEnabled)
      .map((seat) =>
        Object.freeze({
          label: seat.label,
          seatId: seat.seatId,
          seatRole: seat.seatRole
        })
      )
  );
}

export class MetaverseTraversalRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #readDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["readDynamicEnvironmentPose"];
  readonly #readMountedEnvironmentAnchorSnapshot: MetaverseTraversalRuntimeDependencies["readMountedEnvironmentAnchorSnapshot"];
  readonly #readMountableEnvironmentConfig: MetaverseTraversalRuntimeDependencies["readMountableEnvironmentConfig"];
  readonly #setDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["setDynamicEnvironmentPose"];
  readonly #surfaceColliderSnapshots: MetaverseTraversalRuntimeDependencies["surfaceColliderSnapshots"];

  #cameraSnapshot: MetaverseCameraSnapshot;
  #characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null =
    null;
  #locomotionMode = defaultMetaverseLocomotionMode;
  #mountedEnvironmentConfig: Pick<
    MetaverseEnvironmentAssetProofConfig,
    "entries" | "environmentAssetId" | "label" | "seats"
  > | null = null;
  #mountedOccupancyLookYawRadians = 0;
  #routedDriverVehicleControlIntentSnapshot: RoutedDriverVehicleControlIntentSnapshot | null =
    null;
  #mountedVehicleRuntime: MetaverseVehicleRuntime | null = null;
  #swimForwardSpeedUnitsPerSecond = 0;
  #swimStrafeSpeedUnitsPerSecond = 0;
  #swimSnapshot: SurfaceLocomotionSnapshot;
  #traversalCameraPitchRadians: number;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: MetaverseTraversalRuntimeDependencies
  ) {
    this.#config = config;
    this.#groundedBodyRuntime = dependencies.groundedBodyRuntime;
    this.#readDynamicEnvironmentPose = dependencies.readDynamicEnvironmentPose;
    this.#readMountedEnvironmentAnchorSnapshot =
      dependencies.readMountedEnvironmentAnchorSnapshot;
    this.#readMountableEnvironmentConfig =
      dependencies.readMountableEnvironmentConfig;
    this.#setDynamicEnvironmentPose = dependencies.setDynamicEnvironmentPose;
    this.#surfaceColliderSnapshots = dependencies.surfaceColliderSnapshots;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#traversalCameraPitchRadians = config.camera.initialPitchRadians;
    this.#swimSnapshot = createSurfaceLocomotionSnapshot(
      freezeVector3(
        config.camera.spawnPosition.x,
        config.ocean.height,
        config.camera.spawnPosition.z
      ),
      config.camera.initialYawRadians
    );
  }

  get cameraSnapshot(): MetaverseCameraSnapshot {
    return this.#cameraSnapshot;
  }

  get characterPresentationSnapshot():
    | MetaverseCharacterPresentationSnapshot
    | null {
    return this.#characterPresentationSnapshot;
  }

  get locomotionMode(): MetaverseLocomotionModeId {
    return this.#locomotionMode;
  }

  get mountedEnvironmentSnapshot(): MountedEnvironmentSnapshot | null {
    if (
      this.#mountedVehicleRuntime === null ||
      this.#mountedEnvironmentConfig === null
    ) {
      return null;
    }

    const mountedVehicleSnapshot = this.#mountedVehicleRuntime.snapshot;
    const occupancy = mountedVehicleSnapshot.occupancy;

    if (occupancy === null) {
      return null;
    }

    return Object.freeze({
      cameraPolicyId: occupancy.cameraPolicyId,
      controlRoutingPolicyId: occupancy.controlRoutingPolicyId,
      directSeatTargets: resolveMountedEnvironmentDirectSeatTargets(
        this.#mountedEnvironmentConfig
      ),
      entryId: occupancy.entryId,
      environmentAssetId: mountedVehicleSnapshot.environmentAssetId,
      label: mountedVehicleSnapshot.label,
      lookLimitPolicyId: occupancy.lookLimitPolicyId,
      occupancyAnimationId: occupancy.occupancyAnimationId,
      occupancyKind: occupancy.occupancyKind,
      occupantLabel: occupancy.occupantLabel,
      occupantRole: occupancy.occupantRole,
      seatId: occupancy.seatId
    });
  }

  get routedDriverVehicleControlIntentSnapshot():
    | RoutedDriverVehicleControlIntentSnapshot
    | null {
    return this.#routedDriverVehicleControlIntentSnapshot;
  }

  reset(): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#characterPresentationSnapshot = null;
    this.#locomotionMode = defaultMetaverseLocomotionMode;
    this.#clearMountedVehicleState();
    this.#mountedOccupancyLookYawRadians = 0;
    this.#routedDriverVehicleControlIntentSnapshot = null;
    this.#swimForwardSpeedUnitsPerSecond = 0;
    this.#swimStrafeSpeedUnitsPerSecond = 0;
    this.#swimSnapshot = createSurfaceLocomotionSnapshot(
      freezeVector3(
        this.#config.camera.spawnPosition.x,
        this.#config.ocean.height,
        this.#config.camera.spawnPosition.z
      ),
      this.#config.camera.initialYawRadians
    );
    this.#traversalCameraPitchRadians = this.#config.camera.initialPitchRadians;
  }

  boot(): void {
    this.#enterGroundedLocomotion(
      freezeVector3(
        this.#config.groundedBody.spawnPosition.x,
        this.#config.groundedBody.spawnPosition.y,
        this.#config.groundedBody.spawnPosition.z
      ),
      this.#cameraSnapshot.yawRadians
    );
    this.#syncAutomaticSurfaceLocomotion(
      this.#groundedBodyRuntime.snapshot.position,
      this.#groundedBodyRuntime.snapshot.yawRadians
    );
    this.#syncCharacterPresentationSnapshot();
  }

  syncMountedEnvironment(
    mountedEnvironment: MountedEnvironmentSnapshot | null
  ): void {
    if (mountedEnvironment !== null) {
      if (
        mountedEnvironment.occupancyKind === "seat" &&
        mountedEnvironment.seatId !== null
      ) {
        this.occupySeat(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.seatId
        );
      } else if (
        mountedEnvironment.occupancyKind === "entry" &&
        mountedEnvironment.entryId !== null
      ) {
        this.boardEnvironment(
          mountedEnvironment.environmentAssetId,
          mountedEnvironment.entryId
        );
      }
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    this.leaveMountedEnvironment();
  }

  boardEnvironment(
    environmentAssetId: string,
    requestedEntryId: string | null = null
  ): MountedEnvironmentSnapshot | null {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId);

    if (mountedVehicleRuntimeContext === null) {
      return this.mountedEnvironmentSnapshot;
    }

    const { mountableEnvironmentConfig, mountedVehicleRuntime } =
      mountedVehicleRuntimeContext;
    const occupiedRuntime =
      requestedEntryId !== null
        ? mountedVehicleRuntime.occupyEntry(requestedEntryId)
        : mountableEnvironmentConfig.entries?.[0] !== undefined
          ? mountedVehicleRuntime.occupyEntry(
              mountableEnvironmentConfig.entries[0].entryId
            )
          : (() => {
              const directSeat =
                mountableEnvironmentConfig.seats?.find(
                  (seat) => seat.directEntryEnabled
                ) ?? null;

              return directSeat === null
                ? null
                : mountedVehicleRuntime.occupySeat(directSeat.seatId);
            })();

    if (occupiedRuntime === null) {
      this.#syncCharacterPresentationSnapshot();
      return this.mountedEnvironmentSnapshot;
    }

    this.#resetMountedOccupancyLookState();
    this.#syncMountedVehiclePresentation();
    this.#syncCharacterPresentationSnapshot();

    return this.mountedEnvironmentSnapshot;
  }

  occupySeat(
    environmentAssetId: string,
    seatId: string
  ): MountedEnvironmentSnapshot | null {
    const mountedVehicleRuntimeContext =
      this.#ensureMountedVehicleRuntime(environmentAssetId);

    if (mountedVehicleRuntimeContext === null) {
      return this.mountedEnvironmentSnapshot;
    }

    const occupiedSeatRuntime =
      mountedVehicleRuntimeContext.mountedVehicleRuntime.occupySeat(seatId);

    if (occupiedSeatRuntime === null) {
      this.#syncCharacterPresentationSnapshot();
      return this.mountedEnvironmentSnapshot;
    }

    this.#resetMountedOccupancyLookState();
    this.#syncMountedVehiclePresentation();
    this.#syncCharacterPresentationSnapshot();

    return this.mountedEnvironmentSnapshot;
  }

  leaveMountedEnvironment(): void {
    if (this.#mountedVehicleRuntime !== null) {
      this.#dismountVehicle(this.#mountedVehicleRuntime.snapshot);
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    if (this.#locomotionMode === "mounted") {
      this.#syncAutomaticSurfaceLocomotion(
        freezeVector3(
          this.#cameraSnapshot.position.x,
          this.#config.ocean.height,
          this.#cameraSnapshot.position.z
        ),
        this.#cameraSnapshot.yawRadians
      );
    }

    this.#syncCharacterPresentationSnapshot();
  }

  advance(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    this.#cameraSnapshot =
      this.#mountedVehicleRuntime !== null
        ? this.#advanceMountedVehicleLocomotion(movementInput, deltaSeconds)
        : this.#locomotionMode === "grounded"
          ? this.#advanceGroundedLocomotion(movementInput, deltaSeconds)
          : this.#locomotionMode === "swim"
            ? this.#advanceSwimLocomotion(movementInput, deltaSeconds)
            : advanceMetaverseCameraSnapshot(
                this.#cameraSnapshot,
                movementInput,
                this.#config,
                deltaSeconds
              );
    this.#syncCharacterPresentationSnapshot();

    return this.#cameraSnapshot;
  }

  syncAuthoritativeVehiclePose(
    environmentAssetId: string,
    poseSnapshot: {
      readonly linearVelocity?: PhysicsVector3Snapshot | null;
      readonly position: PhysicsVector3Snapshot;
      readonly yawRadians: number;
    }
  ): void {
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;
    const mountedEnvironmentConfig = this.#mountedEnvironmentConfig;

    if (
      mountedVehicleRuntime !== null &&
      mountedEnvironmentConfig?.environmentAssetId === environmentAssetId
    ) {
      mountedVehicleRuntime.syncAuthoritativePose(poseSnapshot);
      this.#syncMountedVehiclePresentation();
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    this.#setDynamicEnvironmentPose(environmentAssetId, poseSnapshot);
  }

  #setLocomotionMode(locomotionMode: MetaverseLocomotionModeId): void {
    this.#locomotionMode = locomotionMode;
  }

  #enterGroundedLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    supportHeightMeters: number | null = null
  ): void {
    if (!this.#groundedBodyRuntime.isInitialized) {
      return;
    }

    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#groundedBodyRuntime.teleport(
      freezeVector3(
        position.x,
        supportHeightMeters ??
          resolveSurfaceHeightMeters(
            this.#config,
            this.#surfaceColliderSnapshots,
            position.x,
            position.z
          ),
        position.z
      ),
      yawRadians
    );
    this.#groundedBodyRuntime.advance(
      createIdleGroundedBodyIntentSnapshot(),
      1 / 60
    );
    this.#setLocomotionMode("grounded");
    this.#cameraSnapshot = createTraversalGroundedCameraPresentationSnapshot(
      this.#groundedBodyRuntime.snapshot,
      this.#traversalCameraPitchRadians,
      this.#config
    );
  }

  #enterSwimLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number
  ): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#swimForwardSpeedUnitsPerSecond = 0;
    this.#swimStrafeSpeedUnitsPerSecond = 0;
    this.#swimSnapshot = createSurfaceLocomotionSnapshot(
      freezeVector3(position.x, this.#config.ocean.height, position.z),
      yawRadians
    );
    this.#setLocomotionMode("swim");
    this.#cameraSnapshot = createTraversalSwimCameraPresentationSnapshot(
      this.#swimSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config
    );
  }

  #syncAutomaticSurfaceLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number
  ): void {
    const locomotionDecision = resolveAutomaticSurfaceLocomotionMode(
      this.#config,
      this.#surfaceColliderSnapshots,
      position,
      yawRadians,
      this.#locomotionMode === "grounded" ? "grounded" : "swim"
    );

    if (locomotionDecision.locomotionMode === "grounded") {
      this.#enterGroundedLocomotion(
        position,
        yawRadians,
        locomotionDecision.supportHeightMeters
      );
      return;
    }

    this.#enterSwimLocomotion(position, yawRadians);
  }

  #ensureMountedVehicleRuntime(
    environmentAssetId: string
  ): {
    readonly mountableEnvironmentConfig: Pick<
      MetaverseEnvironmentAssetProofConfig,
      "entries" | "environmentAssetId" | "label" | "seats"
    >;
    readonly mountedVehicleRuntime: MetaverseVehicleRuntime;
  } | null {
    if (
      this.#mountedVehicleRuntime !== null &&
      this.#mountedEnvironmentConfig !== null &&
      this.#mountedEnvironmentConfig.environmentAssetId === environmentAssetId
    ) {
      return {
        mountableEnvironmentConfig: this.#mountedEnvironmentConfig,
        mountedVehicleRuntime: this.#mountedVehicleRuntime
      };
    }

    const mountableEnvironmentConfig = this.#readMountableEnvironmentConfig(
      environmentAssetId
    );
    const dynamicEnvironmentPose =
      this.#readDynamicEnvironmentPose(environmentAssetId);

    if (
      dynamicEnvironmentPose === null ||
      mountableEnvironmentConfig === null ||
      mountableEnvironmentConfig.seats === null
    ) {
      return null;
    }

    this.#clearMountedVehicleState();
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#setLocomotionMode("mounted");
    this.#traversalCameraPitchRadians = this.#cameraSnapshot.pitchRadians;
    this.#mountedVehicleRuntime = new MetaverseVehicleRuntime({
      authoritativeCorrection: this.#config.skiff.authoritativeCorrection,
      entries: mountableEnvironmentConfig.entries,
      environmentAssetId: mountableEnvironmentConfig.environmentAssetId,
      label: mountableEnvironmentConfig.label,
      oceanHeightMeters: this.#config.ocean.height,
      poseSnapshot: dynamicEnvironmentPose,
      seats: mountableEnvironmentConfig.seats,
      surfaceColliderSnapshots: this.#surfaceColliderSnapshots,
      waterContactProbeRadiusMeters:
        this.#config.skiff.waterContactProbeRadiusMeters,
      waterlineHeightMeters: this.#config.skiff.waterlineHeightMeters
    });
    this.#mountedEnvironmentConfig = mountableEnvironmentConfig;

    return {
      mountableEnvironmentConfig,
      mountedVehicleRuntime: this.#mountedVehicleRuntime
    };
  }

  #dismountVehicle(
    previousMountedVehicleState: TraversalMountedVehicleSnapshot
  ): void {
    this.#clearMountedVehicleState();
    this.#syncAutomaticSurfaceLocomotion(
      previousMountedVehicleState.position,
      previousMountedVehicleState.yawRadians
    );
  }

  #clearMountedVehicleState(): void {
    this.#mountedVehicleRuntime?.clearOccupancy();
    this.#mountedEnvironmentConfig = null;
    this.#mountedOccupancyLookYawRadians = 0;
    this.#routedDriverVehicleControlIntentSnapshot = null;
    this.#mountedVehicleRuntime = null;
  }

  #resetMountedOccupancyLookState(): void {
    this.#mountedOccupancyLookYawRadians = 0;
  }

  #syncMountedVehiclePresentation(): void {
    const mountedVehicleSnapshot = this.#mountedVehicleRuntime?.snapshot;

    if (mountedVehicleSnapshot === undefined) {
      return;
    }

    this.#setDynamicEnvironmentPose(mountedVehicleSnapshot.environmentAssetId, {
      position: mountedVehicleSnapshot.position,
      yawRadians: mountedVehicleSnapshot.yawRadians
    });
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment);

    this.#cameraSnapshot = createTraversalMountedVehicleCameraPresentationSnapshot(
      mountedVehicleSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      mountedEnvironmentAnchorSnapshot,
      this.#mountedOccupancyLookYawRadians
    );
  }

  #advanceGroundedLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const currentBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const nextGroundedYawRadians = wrapRadians(
      currentBodySnapshot.yawRadians +
        clamp(toFiniteNumber(movementInput.yawAxis, 0), -1, 1) *
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond *
          deltaSeconds
    );

    this.#groundedBodyRuntime.setAutostepEnabled(
      shouldEnableGroundedAutostep(
        this.#config,
        this.#surfaceColliderSnapshots,
        currentBodySnapshot.position,
        nextGroundedYawRadians,
        movementInput.moveAxis,
        movementInput.strafeAxis
      )
    );
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#config,
        deltaSeconds
      );

    const bodySnapshot = this.#groundedBodyRuntime.advance(
      Object.freeze({
        boost: movementInput.boost,
        jump: movementInput.jump,
        moveAxis: movementInput.moveAxis,
        strafeAxis: movementInput.strafeAxis,
        turnAxis: toFiniteNumber(movementInput.yawAxis, 0)
      }),
      deltaSeconds
    );

    const locomotionDecision = resolveAutomaticSurfaceLocomotionMode(
      this.#config,
      this.#surfaceColliderSnapshots,
      bodySnapshot.position,
      bodySnapshot.yawRadians,
      "grounded"
    );

    if (locomotionDecision.locomotionMode === "swim") {
      this.#enterSwimLocomotion(bodySnapshot.position, bodySnapshot.yawRadians);

      return this.#cameraSnapshot;
    }

    return createTraversalGroundedCameraPresentationSnapshot(
      bodySnapshot,
      this.#traversalCameraPitchRadians,
      this.#config
    );
  }

  #advanceSwimLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    this.#traversalCameraPitchRadians =
      advanceTraversalCameraPresentationPitchRadians(
        this.#traversalCameraPitchRadians,
        movementInput,
        this.#config,
        deltaSeconds
      );

    const nextSwimState = advanceSurfaceLocomotionSnapshot(
      this.#swimSnapshot,
      {
        forwardSpeedUnitsPerSecond: this.#swimForwardSpeedUnitsPerSecond,
        strafeSpeedUnitsPerSecond: this.#swimStrafeSpeedUnitsPerSecond
      },
      movementInput,
      this.#config.swim,
      deltaSeconds,
      this.#config.movement.worldRadius,
      this.#config.ocean.height
    );

    this.#swimForwardSpeedUnitsPerSecond =
      nextSwimState.speedSnapshot.forwardSpeedUnitsPerSecond;
    this.#swimStrafeSpeedUnitsPerSecond =
      nextSwimState.speedSnapshot.strafeSpeedUnitsPerSecond;
    this.#swimSnapshot = nextSwimState.snapshot;

    const locomotionDecision = resolveAutomaticSurfaceLocomotionMode(
      this.#config,
      this.#surfaceColliderSnapshots,
      this.#swimSnapshot.position,
      this.#swimSnapshot.yawRadians,
      "swim"
    );

    if (locomotionDecision.locomotionMode === "grounded") {
      this.#enterGroundedLocomotion(
        this.#swimSnapshot.position,
        this.#swimSnapshot.yawRadians,
        locomotionDecision.supportHeightMeters
      );

      return this.#cameraSnapshot;
    }

    return createTraversalSwimCameraPresentationSnapshot(
      this.#swimSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config
    );
  }

  #advanceMountedVehicleLocomotion(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const mountedVehicleRuntime = this.#mountedVehicleRuntime;

    if (mountedVehicleRuntime === null) {
      return this.#cameraSnapshot;
    }

    const mountedVehicleState = mountedVehicleRuntime.snapshot;
    this.#traversalCameraPitchRadians =
      clampTraversalMountedOccupancyPitchRadians(
        advanceTraversalCameraPresentationPitchRadians(
          this.#traversalCameraPitchRadians,
          movementInput,
          this.#config,
          deltaSeconds
        ),
        mountedVehicleState,
        this.#config
      );
    this.#mountedOccupancyLookYawRadians =
      advanceTraversalMountedOccupancyLookYawRadians(
        this.#mountedOccupancyLookYawRadians,
        movementInput,
        mountedVehicleState,
        this.#config,
        deltaSeconds
      );
    const mountedVehicleLocomotionInput = this.#resolveMountedVehicleLocomotionInput(
      mountedVehicleState,
      movementInput
    );

    this.#routedDriverVehicleControlIntentSnapshot =
      this.#resolveRoutedDriverVehicleControlIntentSnapshot(
        mountedVehicleState,
        mountedVehicleLocomotionInput
      );

    const mountedVehicleSnapshot = mountedVehicleRuntime.advance(
      mountedVehicleLocomotionInput,
      this.#config.skiff,
      deltaSeconds,
      this.#config.movement.worldRadius
    );
    this.#setDynamicEnvironmentPose(mountedVehicleSnapshot.environmentAssetId, {
      position: mountedVehicleSnapshot.position,
      yawRadians: mountedVehicleSnapshot.yawRadians
    });
    const mountedEnvironment = this.mountedEnvironmentSnapshot;
    const mountedEnvironmentAnchorSnapshot =
      mountedEnvironment === null
        ? null
        : this.#readMountedEnvironmentAnchorSnapshot(mountedEnvironment);

    return createTraversalMountedVehicleCameraPresentationSnapshot(
      mountedVehicleSnapshot,
      this.#traversalCameraPitchRadians,
      this.#config,
      mountedEnvironmentAnchorSnapshot,
      this.#mountedOccupancyLookYawRadians
    );
  }

  #resolveMountedVehicleLocomotionInput(
    mountedVehicleState: TraversalMountedVehicleSnapshot,
    movementInput: MetaverseFlightInputSnapshot
  ): MountedVehicleControlIntent {
    const occupancy = mountedVehicleState.occupancy;

    if (
      occupancy === null ||
      occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
      occupancy.occupantRole !== "driver" ||
      !mountedVehicleState.waterborne
    ) {
      return Object.freeze({
        boost: false,
        moveAxis: 0,
        strafeAxis: 0,
        yawAxis: 0
      });
    }

    return Object.freeze({
      boost: movementInput.boost,
      moveAxis: movementInput.moveAxis,
      strafeAxis: movementInput.strafeAxis,
      yawAxis: movementInput.yawAxis
    });
  }

  #resolveRoutedDriverVehicleControlIntentSnapshot(
    mountedVehicleState: TraversalMountedVehicleSnapshot,
    controlIntent: MountedVehicleControlIntent
  ): RoutedDriverVehicleControlIntentSnapshot | null {
    const occupancy = mountedVehicleState.occupancy;

    if (
      occupancy === null ||
      occupancy.controlRoutingPolicyId !== "vehicle-surface-drive" ||
      occupancy.occupantRole !== "driver"
    ) {
      return null;
    }

    return Object.freeze({
      controlIntent,
      environmentAssetId: mountedVehicleState.environmentAssetId
    });
  }

  #syncCharacterPresentationSnapshot(): void {
    this.#characterPresentationSnapshot = createTraversalCharacterPresentationSnapshot({
      config: this.#config,
      groundedBodySnapshot: this.#groundedBodyRuntime.isInitialized
        ? this.#groundedBodyRuntime.snapshot
        : null,
      locomotionMode: this.#locomotionMode,
      mountedVehicleSnapshot:
        this.#mountedVehicleRuntime?.snapshot ?? null,
      swimSnapshot: this.#swimSnapshot
    });
  }
}
