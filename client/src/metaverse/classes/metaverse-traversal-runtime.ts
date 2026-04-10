import {
  MetaverseGroundedBodyRuntime,
  type MetaverseGroundedBodySnapshot,
  type PhysicsVector3Snapshot
} from "@/physics";
import { defaultMetaverseLocomotionMode } from "../config/metaverse-locomotion-modes";
import {
  advanceMetaverseCameraSnapshot,
  advanceMetaversePitchRadians,
  createMetaverseCameraSnapshot,
  directionFromYawPitch
} from "../states/metaverse-flight";
import type { MetaversePlacedCuboidColliderSnapshot } from "../states/metaverse-environment-collision";
import type { MetaverseFlightInputSnapshot } from "../types/metaverse-control-mode";
import type { MetaverseLocomotionModeId } from "../types/metaverse-locomotion-mode";
import type {
  MetaverseCameraSnapshot,
  MetaverseCharacterPresentationSnapshot,
  MetaverseRuntimeConfig,
  MountedEnvironmentSnapshot
} from "../types/metaverse-runtime";

interface SurfaceLocomotionConfig {
  readonly accelerationCurveExponent: number;
  readonly accelerationUnitsPerSecondSquared: number;
  readonly baseSpeedUnitsPerSecond: number;
  readonly boostCurveExponent: number;
  readonly boostMultiplier: number;
  readonly decelerationUnitsPerSecondSquared: number;
  readonly dragCurveExponent: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
}

interface SurfaceLocomotionSnapshot {
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

interface MountedSkiffRuntimeState extends SurfaceLocomotionSnapshot {
  readonly environmentAssetId: string;
  readonly label: string;
  readonly waterborne: boolean;
}

interface DynamicEnvironmentPoseSnapshot {
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

interface MetaverseTraversalRuntimeDependencies {
  readonly groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly readDynamicEnvironmentPose: (
    environmentAssetId: string
  ) => DynamicEnvironmentPoseSnapshot | null;
  readonly setDynamicEnvironmentPose: (
    environmentAssetId: string,
    poseSnapshot: DynamicEnvironmentPoseSnapshot | null
  ) => void;
  readonly surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];
}

type AutomaticSurfaceLocomotionModeId = "grounded" | "swim";

const metaverseWalkAnimationSpeedThresholdUnitsPerSecond = 0.75;
const automaticSurfaceWaterlineThresholdMeters = 0.05;
const automaticSurfaceExitSupportProbeCount = 3;
const automaticSurfaceGroundedHoldProbeCount = 2;
const automaticSurfaceGroundedHoldPaddingFactor = 0.45;
const automaticSurfaceProbeForwardDistanceFactor = 0.88;
const automaticSurfaceProbeLateralDistanceFactor = 0.72;
const automaticSurfaceStepHeightLeewayMeters = 0.04;
const automaticSurfaceBlockingHeightToleranceMeters = 0.01;

interface AutomaticSurfaceSupportSnapshot {
  readonly centerStepBlocked: boolean;
  readonly centerStepSupportHeightMeters: number | null;
  readonly forwardStepBlocked: boolean;
  readonly forwardStepSupportHeightMeters: number | null;
  readonly highestStepSupportHeightMeters: number | null;
  readonly stepSupportedProbeCount: number;
}

interface AutomaticSurfaceProbeSupportSnapshot {
  readonly stepSupportHeightMeters: number | null;
  readonly supportHeightMeters: number | null;
}

interface AutomaticSurfaceLocomotionDecision {
  readonly locomotionMode: AutomaticSurfaceLocomotionModeId;
  readonly supportHeightMeters: number | null;
}

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function wrapRadians(rawValue: number): number {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  let nextValue = rawValue;

  while (nextValue > Math.PI) {
    nextValue -= Math.PI * 2;
  }

  while (nextValue <= -Math.PI) {
    nextValue += Math.PI * 2;
  }

  return nextValue;
}

function freezeVector3(
  x: number,
  y: number,
  z: number
): PhysicsVector3Snapshot {
  return Object.freeze({
    x: toFiniteNumber(x),
    y: toFiniteNumber(y),
    z: toFiniteNumber(z)
  });
}

function shapeSignedAxis(value: number, exponent: number): number {
  const sanitizedValue = clamp(value, -1, 1);
  const magnitude = Math.pow(
    clamp01(Math.abs(sanitizedValue)),
    Math.max(0.1, toFiniteNumber(exponent, 1))
  );

  return Math.sign(sanitizedValue) * magnitude;
}

function resolveBoostMultiplier(
  boost: boolean,
  moveAxis: number,
  boostMultiplier: number,
  boostCurveExponent: number
): number {
  if (!boost) {
    return 1;
  }

  const shapedBoostAmount = Math.pow(
    clamp01(Math.abs(clamp(moveAxis, -1, 1))),
    Math.max(0.1, toFiniteNumber(boostCurveExponent, 1))
  );

  return 1 + (boostMultiplier - 1) * shapedBoostAmount;
}

function resolveShapedDragScale(
  currentSpeedUnitsPerSecond: number,
  baseSpeedUnitsPerSecond: number,
  dragCurveExponent: number
): number {
  const normalizedSpeed = clamp01(
    Math.abs(currentSpeedUnitsPerSecond) / Math.max(0.001, baseSpeedUnitsPerSecond)
  );

  return Math.max(
    0.18,
    Math.pow(
      normalizedSpeed,
      Math.max(0.1, toFiniteNumber(dragCurveExponent, 1))
    )
  );
}

function resolvePlanarProbeOffset(
  forwardMeters: number,
  lateralMeters: number,
  yawRadians: number
): PhysicsVector3Snapshot {
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const rightX = Math.cos(yawRadians);
  const rightZ = Math.sin(yawRadians);

  return freezeVector3(
    forwardX * forwardMeters + rightX * lateralMeters,
    0,
    forwardZ * forwardMeters + rightZ * lateralMeters
  );
}

function hasBlockingSupport(
  probeSupport: AutomaticSurfaceProbeSupportSnapshot
): boolean {
  return (
    probeSupport.supportHeightMeters !== null &&
    (probeSupport.stepSupportHeightMeters === null ||
      probeSupport.supportHeightMeters >
        probeSupport.stepSupportHeightMeters +
          automaticSurfaceBlockingHeightToleranceMeters)
  );
}

function createCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  planarSpeedUnitsPerSecond: number,
  movingVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"] = "walk"
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    animationVocabulary:
      planarSpeedUnitsPerSecond >=
      metaverseWalkAnimationSpeedThresholdUnitsPerSecond
        ? movingVocabulary
        : "idle",
    position: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

function createFixedCharacterPresentationSnapshot(
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"]
): MetaverseCharacterPresentationSnapshot {
  return Object.freeze({
    animationVocabulary,
    position: Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

function createGroundedCharacterPresentationSnapshot(
  bodySnapshot: MetaverseGroundedBodySnapshot
): MetaverseCharacterPresentationSnapshot {
  return createCharacterPresentationSnapshot(
    bodySnapshot.position,
    bodySnapshot.yawRadians,
    bodySnapshot.grounded ? bodySnapshot.planarSpeedUnitsPerSecond : 0
  );
}

function createSurfaceCameraSnapshot(
  position: PhysicsVector3Snapshot,
  eyeHeightMeters: number,
  yawRadians: number,
  pitchRadians: number
): MetaverseCameraSnapshot {
  const lookDirection = directionFromYawPitch(yawRadians, pitchRadians);

  return Object.freeze({
    lookDirection,
    pitchRadians,
    position: Object.freeze({
      x: position.x,
      y: position.y + eyeHeightMeters,
      z: position.z
    }),
    yawRadians: wrapRadians(yawRadians)
  });
}

function createGroundedCameraSnapshot(
  bodySnapshot: MetaverseGroundedBodySnapshot,
  pitchRadians: number
): MetaverseCameraSnapshot {
  return createSurfaceCameraSnapshot(
    bodySnapshot.position,
    bodySnapshot.eyeHeightMeters,
    bodySnapshot.yawRadians,
    pitchRadians
  );
}

function createIdleGroundedBodyIntentSnapshot() {
  return Object.freeze({
    boost: false,
    moveAxis: 0,
    turnAxis: 0
  });
}

function advanceSurfaceLocomotionSnapshot(
  snapshot: SurfaceLocomotionSnapshot,
  forwardSpeedUnitsPerSecond: number,
  movementInput: Pick<MetaverseFlightInputSnapshot, "boost" | "moveAxis" | "yawAxis">,
  config: SurfaceLocomotionConfig,
  deltaSeconds: number,
  worldRadius: number,
  fixedHeightMeters: number,
  movementEnabled = true
): {
  readonly forwardSpeedUnitsPerSecond: number;
  readonly snapshot: SurfaceLocomotionSnapshot;
} {
  if (deltaSeconds <= 0) {
    return Object.freeze({
      forwardSpeedUnitsPerSecond,
      snapshot
    });
  }

  const yawRadians = wrapRadians(
    snapshot.yawRadians +
      clamp(movementInput.yawAxis, -1, 1) *
        config.maxTurnSpeedRadiansPerSecond *
        deltaSeconds
  );
  const moveAxis = movementEnabled ? clamp(movementInput.moveAxis, -1, 1) : 0;
  const targetSpeedUnitsPerSecond =
    config.baseSpeedUnitsPerSecond *
    shapeSignedAxis(moveAxis, config.accelerationCurveExponent) *
    resolveBoostMultiplier(
      movementInput.boost,
      moveAxis,
      config.boostMultiplier,
      config.boostCurveExponent
    );
  const nextForwardSpeedUnitsPerSecond =
    moveAxis === 0
      ? (() => {
          const speedDelta =
            config.decelerationUnitsPerSecondSquared *
            resolveShapedDragScale(
              forwardSpeedUnitsPerSecond,
              config.baseSpeedUnitsPerSecond,
              config.dragCurveExponent
            ) *
            deltaSeconds;

          if (Math.abs(targetSpeedUnitsPerSecond - forwardSpeedUnitsPerSecond) <= speedDelta) {
            return 0;
          }

          return (
            forwardSpeedUnitsPerSecond -
            Math.sign(forwardSpeedUnitsPerSecond) * speedDelta
          );
        })()
      : (() => {
          const speedDelta =
            config.accelerationUnitsPerSecondSquared *
            Math.max(
              0.2,
              Math.abs(
                shapeSignedAxis(moveAxis, config.accelerationCurveExponent)
              )
            ) *
            deltaSeconds;

          if (
            Math.abs(targetSpeedUnitsPerSecond - forwardSpeedUnitsPerSecond) <=
            speedDelta
          ) {
            return targetSpeedUnitsPerSecond;
          }

          return (
            forwardSpeedUnitsPerSecond +
            Math.sign(targetSpeedUnitsPerSecond - forwardSpeedUnitsPerSecond) *
              speedDelta
          );
        })();
  const forwardX = Math.sin(yawRadians);
  const forwardZ = -Math.cos(yawRadians);
  const unclampedPosition = freezeVector3(
    snapshot.position.x + forwardX * nextForwardSpeedUnitsPerSecond * deltaSeconds,
    fixedHeightMeters,
    snapshot.position.z + forwardZ * nextForwardSpeedUnitsPerSecond * deltaSeconds
  );
  const radialDistance = Math.hypot(
    unclampedPosition.x,
    unclampedPosition.z
  );
  const radiusScale =
    radialDistance <= worldRadius ? 1 : worldRadius / Math.max(1, radialDistance);
  const position = freezeVector3(
    unclampedPosition.x * radiusScale,
    fixedHeightMeters,
    unclampedPosition.z * radiusScale
  );
  const deltaX = position.x - snapshot.position.x;
  const deltaZ = position.z - snapshot.position.z;

  return Object.freeze({
    forwardSpeedUnitsPerSecond:
      deltaSeconds <= 0
        ? nextForwardSpeedUnitsPerSecond
        : (deltaX * forwardX + deltaZ * forwardZ) / deltaSeconds,
    snapshot: Object.freeze({
      planarSpeedUnitsPerSecond: Math.hypot(deltaX, deltaZ) / deltaSeconds,
      position,
      yawRadians
    })
  });
}

function rotateVectorByQuaternion(
  x: number,
  y: number,
  z: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number
): PhysicsVector3Snapshot {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  return freezeVector3(
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx)
  );
}

export class MetaverseTraversalRuntime {
  readonly #config: MetaverseRuntimeConfig;
  readonly #groundedBodyRuntime: MetaverseGroundedBodyRuntime;
  readonly #readDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["readDynamicEnvironmentPose"];
  readonly #setDynamicEnvironmentPose: MetaverseTraversalRuntimeDependencies["setDynamicEnvironmentPose"];
  readonly #surfaceColliderSnapshots: readonly MetaversePlacedCuboidColliderSnapshot[];

  #cameraSnapshot: MetaverseCameraSnapshot;
  #characterPresentationSnapshot: MetaverseCharacterPresentationSnapshot | null =
    null;
  #groundedPitchRadians: number;
  #locomotionMode = defaultMetaverseLocomotionMode;
  #mountedSkiffForwardSpeedUnitsPerSecond = 0;
  #mountedSkiffState: MountedSkiffRuntimeState | null = null;
  #swimForwardSpeedUnitsPerSecond = 0;
  #swimSnapshot: SurfaceLocomotionSnapshot;

  constructor(
    config: MetaverseRuntimeConfig,
    dependencies: MetaverseTraversalRuntimeDependencies
  ) {
    this.#config = config;
    this.#groundedBodyRuntime = dependencies.groundedBodyRuntime;
    this.#readDynamicEnvironmentPose = dependencies.readDynamicEnvironmentPose;
    this.#setDynamicEnvironmentPose = dependencies.setDynamicEnvironmentPose;
    this.#surfaceColliderSnapshots = dependencies.surfaceColliderSnapshots;
    this.#cameraSnapshot = createMetaverseCameraSnapshot(config.camera);
    this.#groundedPitchRadians = config.camera.initialPitchRadians;
    this.#swimSnapshot = this.#createSurfaceLocomotionSnapshot(
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

  reset(): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#cameraSnapshot = createMetaverseCameraSnapshot(this.#config.camera);
    this.#characterPresentationSnapshot = null;
    this.#groundedPitchRadians = this.#config.camera.initialPitchRadians;
    this.#locomotionMode = defaultMetaverseLocomotionMode;
    this.#mountedSkiffForwardSpeedUnitsPerSecond = 0;
    this.#mountedSkiffState = null;
    this.#swimForwardSpeedUnitsPerSecond = 0;
    this.#swimSnapshot = this.#createSurfaceLocomotionSnapshot(
      freezeVector3(
        this.#config.camera.spawnPosition.x,
        this.#config.ocean.height,
        this.#config.camera.spawnPosition.z
      ),
      this.#config.camera.initialYawRadians
    );
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
      this.#mountEnvironment(mountedEnvironment);
      this.#syncCharacterPresentationSnapshot();
      return;
    }

    if (this.#mountedSkiffState !== null) {
      this.#dismountSkiff(this.#mountedSkiffState);
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
      this.#mountedSkiffState !== null
        ? this.#resolveMountedSkiffCameraSnapshot(movementInput, deltaSeconds)
        : this.#locomotionMode === "grounded"
          ? this.#resolveGroundedCameraSnapshot(movementInput, deltaSeconds)
          : this.#locomotionMode === "swim"
            ? this.#resolveSwimCameraSnapshot(movementInput, deltaSeconds)
            : advanceMetaverseCameraSnapshot(
                this.#cameraSnapshot,
                movementInput,
                this.#config,
                deltaSeconds
              );
    this.#syncCharacterPresentationSnapshot();

    return this.#cameraSnapshot;
  }

  #createSurfaceLocomotionSnapshot(
    position: PhysicsVector3Snapshot,
    yawRadians: number
  ): SurfaceLocomotionSnapshot {
    return Object.freeze({
      planarSpeedUnitsPerSecond: 0,
      position: freezeVector3(position.x, position.y, position.z),
      yawRadians: wrapRadians(yawRadians)
    });
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
          this.#resolveSurfaceHeightMeters(position.x, position.z),
        position.z
      ),
      yawRadians
    );
    this.#groundedBodyRuntime.advance(
      createIdleGroundedBodyIntentSnapshot(),
      1 / 60
    );
    this.#setLocomotionMode("grounded");
    this.#cameraSnapshot = createGroundedCameraSnapshot(
      this.#groundedBodyRuntime.snapshot,
      this.#groundedPitchRadians
    );
  }

  #enterSwimLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number
  ): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#swimForwardSpeedUnitsPerSecond = 0;
    this.#swimSnapshot = this.#createSurfaceLocomotionSnapshot(
      freezeVector3(position.x, this.#config.ocean.height, position.z),
      yawRadians
    );
    this.#setLocomotionMode("swim");
    this.#cameraSnapshot = createSurfaceCameraSnapshot(
      this.#swimSnapshot.position,
      this.#config.swim.cameraEyeHeightMeters,
      this.#swimSnapshot.yawRadians,
      this.#groundedPitchRadians
    );
  }

  #resolveAutomaticSurfaceLocomotionMode(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    currentLocomotionMode: AutomaticSurfaceLocomotionModeId
  ): AutomaticSurfaceLocomotionDecision {
    const supportSnapshot = this.#sampleAutomaticSurfaceSupport(
      position,
      yawRadians,
      currentLocomotionMode === "grounded"
        ? this.#config.groundedBody.capsuleRadiusMeters *
            automaticSurfaceGroundedHoldPaddingFactor
        : 0
    );
    if (currentLocomotionMode === "grounded") {
      const shouldStayGrounded =
        supportSnapshot.centerStepSupportHeightMeters !== null ||
        supportSnapshot.stepSupportedProbeCount >=
          automaticSurfaceGroundedHoldProbeCount;

      return shouldStayGrounded
        ? {
            locomotionMode: "grounded",
            supportHeightMeters:
              supportSnapshot.centerStepSupportHeightMeters ??
              supportSnapshot.highestStepSupportHeightMeters
          }
        : {
            locomotionMode: "swim",
            supportHeightMeters: null
          };
    }

    const canExitWater =
      supportSnapshot.centerStepSupportHeightMeters !== null &&
      !supportSnapshot.centerStepBlocked &&
      supportSnapshot.forwardStepSupportHeightMeters !== null &&
      !supportSnapshot.forwardStepBlocked &&
      supportSnapshot.stepSupportedProbeCount >=
        automaticSurfaceExitSupportProbeCount;

    return canExitWater
      ? {
          locomotionMode: "grounded",
          supportHeightMeters:
            supportSnapshot.centerStepSupportHeightMeters ??
            supportSnapshot.highestStepSupportHeightMeters
        }
      : {
          locomotionMode: "swim",
          supportHeightMeters: null
        };
  }

  #syncAutomaticSurfaceLocomotion(
    position: PhysicsVector3Snapshot,
    yawRadians: number
  ): void {
    const locomotionDecision = this.#resolveAutomaticSurfaceLocomotionMode(
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

  #mountEnvironment(mountedEnvironment: MountedEnvironmentSnapshot): void {
    this.#groundedBodyRuntime.setAutostepEnabled(false);
    this.#setLocomotionMode("mounted");

    if (mountedEnvironment.environmentAssetId !== "metaverse-hub-skiff-v1") {
      this.#mountedSkiffState = null;
      this.#mountedSkiffForwardSpeedUnitsPerSecond = 0;
      return;
    }

    const dynamicEnvironmentPose = this.#readDynamicEnvironmentPose(
      mountedEnvironment.environmentAssetId
    );

    if (dynamicEnvironmentPose === null) {
      this.#mountedSkiffState = null;
      this.#mountedSkiffForwardSpeedUnitsPerSecond = 0;
      return;
    }

    const position = freezeVector3(
      dynamicEnvironmentPose.position.x,
      toFiniteNumber(
        dynamicEnvironmentPose.position.y,
        this.#config.skiff.waterlineHeightMeters
      ),
      dynamicEnvironmentPose.position.z
    );
    const yawRadians = wrapRadians(dynamicEnvironmentPose.yawRadians);

    this.#groundedPitchRadians = this.#cameraSnapshot.pitchRadians;
    this.#mountedSkiffForwardSpeedUnitsPerSecond = 0;
    this.#mountedSkiffState = Object.freeze({
      environmentAssetId: mountedEnvironment.environmentAssetId,
      label: mountedEnvironment.label,
      planarSpeedUnitsPerSecond: 0,
      position,
      waterborne: this.#isWaterbornePosition(
        position,
        this.#config.skiff.waterContactProbeRadiusMeters
      ),
      yawRadians
    });
    this.#setDynamicEnvironmentPose(
      mountedEnvironment.environmentAssetId,
      Object.freeze({
        position,
        yawRadians
      })
    );
    this.#cameraSnapshot = createSurfaceCameraSnapshot(
      position,
      this.#config.skiff.cameraEyeHeightMeters,
      yawRadians,
      this.#groundedPitchRadians
    );
  }

  #dismountSkiff(previousMountedSkiffState: MountedSkiffRuntimeState): void {
    this.#mountedSkiffState = null;
    this.#mountedSkiffForwardSpeedUnitsPerSecond = 0;
    this.#syncAutomaticSurfaceLocomotion(
      previousMountedSkiffState.position,
      previousMountedSkiffState.yawRadians
    );
  }

  #resolveSurfaceSupportHeightMeters(
    x: number,
    z: number,
    paddingMeters = 0
  ): number | null {
    let highestSurfaceY: number | null = null;

    for (const collider of this.#surfaceColliderSnapshots) {
      if (collider.traversalAffordance !== "support") {
        continue;
      }

      const localOffset = rotateVectorByQuaternion(
        x - collider.translation.x,
        0,
        z - collider.translation.z,
        -collider.rotation.x,
        -collider.rotation.y,
        -collider.rotation.z,
        collider.rotation.w
      );

      if (
        Math.abs(localOffset.x) > collider.halfExtents.x + paddingMeters ||
        Math.abs(localOffset.z) > collider.halfExtents.z + paddingMeters
      ) {
        continue;
      }

      const surfaceY = collider.translation.y + collider.halfExtents.y;

      if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
        highestSurfaceY = surfaceY;
      }
    }

    return highestSurfaceY;
  }

  #resolveSurfaceHeightMeters(x: number, z: number): number {
    return Math.max(
      this.#config.ocean.height,
      this.#resolveSurfaceSupportHeightMeters(x, z, this.#config.groundedBody.capsuleRadiusMeters) ??
        this.#config.ocean.height
    );
  }

  #shouldEnableGroundedAutostep(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    moveAxis: number
  ): boolean {
    const movementDirection = Math.sign(clamp(moveAxis, -1, 1));

    if (movementDirection === 0) {
      return false;
    }

    const currentSupportHeightMeters = position.y;
    const maxEligibleStepRiseMeters =
      this.#config.groundedBody.stepHeightMeters +
      automaticSurfaceStepHeightLeewayMeters;
    const probeForwardDistanceMeters =
      this.#config.groundedBody.capsuleRadiusMeters *
      automaticSurfaceProbeForwardDistanceFactor *
      movementDirection;
    const probeLateralDistanceMeters =
      this.#config.groundedBody.capsuleRadiusMeters *
      automaticSurfaceProbeLateralDistanceFactor;

    for (const probeOffset of [
      resolvePlanarProbeOffset(probeForwardDistanceMeters, 0, yawRadians),
      resolvePlanarProbeOffset(
        probeForwardDistanceMeters * 0.72,
        -probeLateralDistanceMeters,
        yawRadians
      ),
      resolvePlanarProbeOffset(
        probeForwardDistanceMeters * 0.72,
        probeLateralDistanceMeters,
        yawRadians
      )
    ]) {
      const supportHeightMeters = this.#resolveSurfaceSupportHeightMeters(
        position.x + probeOffset.x,
        position.z + probeOffset.z
      );

      if (supportHeightMeters === null) {
        continue;
      }

      const supportRiseMeters =
        supportHeightMeters - currentSupportHeightMeters;

      if (
        supportRiseMeters > automaticSurfaceBlockingHeightToleranceMeters &&
        supportRiseMeters <= maxEligibleStepRiseMeters
      ) {
        return true;
      }
    }

    return false;
  }

  #sampleAutomaticSurfaceSupport(
    position: PhysicsVector3Snapshot,
    yawRadians: number,
    paddingMeters: number
  ): AutomaticSurfaceSupportSnapshot {
    const probeForwardDistanceMeters =
      this.#config.groundedBody.capsuleRadiusMeters *
      automaticSurfaceProbeForwardDistanceFactor;
    const probeLateralDistanceMeters =
      this.#config.groundedBody.capsuleRadiusMeters *
      automaticSurfaceProbeLateralDistanceFactor;
    const centerProbeSupport = this.#resolveAutomaticSurfaceProbeSupport(
      position.x,
      position.z,
      paddingMeters
    );
    const forwardProbeOffset = resolvePlanarProbeOffset(
      probeForwardDistanceMeters,
      0,
      yawRadians
    );
    const forwardProbeSupport = this.#resolveAutomaticSurfaceProbeSupport(
      position.x + forwardProbeOffset.x,
      position.z + forwardProbeOffset.z,
      paddingMeters
    );
    const forwardLeftProbeOffset = resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      -probeLateralDistanceMeters,
      yawRadians
    );
    const forwardLeftProbeSupport =
      this.#resolveAutomaticSurfaceProbeSupport(
        position.x + forwardLeftProbeOffset.x,
        position.z + forwardLeftProbeOffset.z,
        paddingMeters
      );
    const forwardRightProbeOffset = resolvePlanarProbeOffset(
      probeForwardDistanceMeters * 0.72,
      probeLateralDistanceMeters,
      yawRadians
    );
    const forwardRightProbeSupport =
      this.#resolveAutomaticSurfaceProbeSupport(
        position.x + forwardRightProbeOffset.x,
        position.z + forwardRightProbeOffset.z,
        paddingMeters
      );
    const rearProbeOffset = resolvePlanarProbeOffset(
      -probeForwardDistanceMeters * 0.48,
      0,
      yawRadians
    );
    const rearProbeSupport = this.#resolveAutomaticSurfaceProbeSupport(
      position.x + rearProbeOffset.x,
      position.z + rearProbeOffset.z,
      paddingMeters
    );
    let highestStepSupportHeightMeters: number | null = null;
    let stepSupportedProbeCount = 0;

    for (const probeSupport of [
      centerProbeSupport,
      forwardProbeSupport,
      forwardLeftProbeSupport,
      forwardRightProbeSupport,
      rearProbeSupport
    ]) {
      if (probeSupport.stepSupportHeightMeters === null) {
        continue;
      }

      stepSupportedProbeCount += 1;
      if (
        highestStepSupportHeightMeters === null ||
        probeSupport.stepSupportHeightMeters > highestStepSupportHeightMeters
      ) {
        highestStepSupportHeightMeters = probeSupport.stepSupportHeightMeters;
      }
    }

    return {
      centerStepBlocked: hasBlockingSupport(centerProbeSupport),
      centerStepSupportHeightMeters:
        centerProbeSupport.stepSupportHeightMeters,
      forwardStepBlocked: hasBlockingSupport(forwardProbeSupport),
      forwardStepSupportHeightMeters:
        forwardProbeSupport.stepSupportHeightMeters,
      highestStepSupportHeightMeters,
      stepSupportedProbeCount
    };
  }

  #resolveAutomaticSurfaceProbeSupport(
    x: number,
    z: number,
    paddingMeters = 0
  ): AutomaticSurfaceProbeSupportSnapshot {
    let highestStepSupportHeightMeters: number | null = null;
    let highestSupportHeightMeters: number | null = null;
    const highestStepRiseAboveWaterMeters =
      this.#config.groundedBody.stepHeightMeters +
      automaticSurfaceStepHeightLeewayMeters;

    for (const collider of this.#surfaceColliderSnapshots) {
      if (collider.traversalAffordance !== "support") {
        continue;
      }

      const localOffset = rotateVectorByQuaternion(
        x - collider.translation.x,
        0,
        z - collider.translation.z,
        -collider.rotation.x,
        -collider.rotation.y,
        -collider.rotation.z,
        collider.rotation.w
      );

      if (
        Math.abs(localOffset.x) > collider.halfExtents.x + paddingMeters ||
        Math.abs(localOffset.z) > collider.halfExtents.z + paddingMeters
      ) {
        continue;
      }

      const surfaceY = collider.translation.y + collider.halfExtents.y;
      const riseAboveWaterMeters = surfaceY - this.#config.ocean.height;

      if (riseAboveWaterMeters <= automaticSurfaceWaterlineThresholdMeters) {
        continue;
      }

      if (
        highestSupportHeightMeters === null ||
        surfaceY > highestSupportHeightMeters
      ) {
        highestSupportHeightMeters = surfaceY;
      }

      if (
        riseAboveWaterMeters <= highestStepRiseAboveWaterMeters &&
        (highestStepSupportHeightMeters === null ||
          surfaceY > highestStepSupportHeightMeters)
      ) {
        highestStepSupportHeightMeters = surfaceY;
      }
    }

    return {
      stepSupportHeightMeters: highestStepSupportHeightMeters,
      supportHeightMeters: highestSupportHeightMeters
    };
  }

  #isWaterbornePosition(
    position: PhysicsVector3Snapshot,
    paddingMeters = 0
  ): boolean {
    const supportHeight = this.#resolveSurfaceSupportHeightMeters(
      position.x,
      position.z,
      paddingMeters
    );

    return (
      supportHeight === null ||
      supportHeight <= this.#config.ocean.height + 0.05
    );
  }

  #resolveGroundedCameraSnapshot(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const currentBodySnapshot = this.#groundedBodyRuntime.snapshot;
    const nextGroundedYawRadians = wrapRadians(
      currentBodySnapshot.yawRadians +
        clamp(movementInput.yawAxis, -1, 1) *
          this.#config.groundedBody.maxTurnSpeedRadiansPerSecond *
          deltaSeconds
    );

    this.#groundedBodyRuntime.setAutostepEnabled(
      this.#shouldEnableGroundedAutostep(
        currentBodySnapshot.position,
        nextGroundedYawRadians,
        movementInput.moveAxis
      )
    );
    this.#groundedPitchRadians = advanceMetaversePitchRadians(
      this.#groundedPitchRadians,
      movementInput.pitchAxis,
      this.#config.orientation,
      deltaSeconds
    );

    const bodySnapshot = this.#groundedBodyRuntime.advance(
      Object.freeze({
        boost: movementInput.boost,
        moveAxis: movementInput.moveAxis,
        turnAxis: movementInput.yawAxis
      }),
      deltaSeconds
    );

    const locomotionDecision = this.#resolveAutomaticSurfaceLocomotionMode(
      bodySnapshot.position,
      bodySnapshot.yawRadians,
      "grounded"
    );

    if (locomotionDecision.locomotionMode === "swim") {
      this.#enterSwimLocomotion(bodySnapshot.position, bodySnapshot.yawRadians);

      return this.#cameraSnapshot;
    }

    return createGroundedCameraSnapshot(bodySnapshot, this.#groundedPitchRadians);
  }

  #resolveSwimCameraSnapshot(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    this.#groundedPitchRadians = advanceMetaversePitchRadians(
      this.#groundedPitchRadians,
      movementInput.pitchAxis,
      this.#config.orientation,
      deltaSeconds
    );

    const nextSwimState = advanceSurfaceLocomotionSnapshot(
      this.#swimSnapshot,
      this.#swimForwardSpeedUnitsPerSecond,
      movementInput,
      this.#config.swim,
      deltaSeconds,
      this.#config.movement.worldRadius,
      this.#config.ocean.height
    );

    this.#swimForwardSpeedUnitsPerSecond =
      nextSwimState.forwardSpeedUnitsPerSecond;
    this.#swimSnapshot = nextSwimState.snapshot;

    const locomotionDecision = this.#resolveAutomaticSurfaceLocomotionMode(
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

    return createSurfaceCameraSnapshot(
      this.#swimSnapshot.position,
      this.#config.swim.cameraEyeHeightMeters,
      this.#swimSnapshot.yawRadians,
      this.#groundedPitchRadians
    );
  }

  #resolveMountedSkiffCameraSnapshot(
    movementInput: MetaverseFlightInputSnapshot,
    deltaSeconds: number
  ): MetaverseCameraSnapshot {
    const mountedSkiffState = this.#mountedSkiffState;

    if (mountedSkiffState === null) {
      return this.#cameraSnapshot;
    }

    this.#groundedPitchRadians = advanceMetaversePitchRadians(
      this.#groundedPitchRadians,
      movementInput.pitchAxis,
      this.#config.orientation,
      deltaSeconds
    );

    const skiffMovementInput = mountedSkiffState.waterborne
      ? movementInput
      : Object.freeze({
          boost: false,
          moveAxis: 0,
          pitchAxis: movementInput.pitchAxis,
          yawAxis: 0
        } satisfies MetaverseFlightInputSnapshot);
    const nextSkiffState = advanceSurfaceLocomotionSnapshot(
      mountedSkiffState,
      this.#mountedSkiffForwardSpeedUnitsPerSecond,
      skiffMovementInput,
      this.#config.skiff,
      deltaSeconds,
      this.#config.movement.worldRadius,
      mountedSkiffState.position.y
    );
    const skiffSnapshot = Object.freeze({
      ...nextSkiffState.snapshot,
      environmentAssetId: mountedSkiffState.environmentAssetId,
      label: mountedSkiffState.label,
      waterborne: this.#isWaterbornePosition(
        nextSkiffState.snapshot.position,
        this.#config.skiff.waterContactProbeRadiusMeters
      )
    } satisfies MountedSkiffRuntimeState);

    this.#mountedSkiffForwardSpeedUnitsPerSecond = skiffSnapshot.waterborne
      ? nextSkiffState.forwardSpeedUnitsPerSecond
      : 0;
    this.#mountedSkiffState = skiffSnapshot;
    this.#setDynamicEnvironmentPose(skiffSnapshot.environmentAssetId, {
      position: skiffSnapshot.position,
      yawRadians: skiffSnapshot.yawRadians
    });

    return createSurfaceCameraSnapshot(
      skiffSnapshot.position,
      this.#config.skiff.cameraEyeHeightMeters,
      skiffSnapshot.yawRadians,
      this.#groundedPitchRadians
    );
  }

  #syncCharacterPresentationSnapshot(): void {
    if (this.#mountedSkiffState !== null) {
      this.#characterPresentationSnapshot = createFixedCharacterPresentationSnapshot(
        this.#mountedSkiffState.position,
        this.#mountedSkiffState.yawRadians,
        "seated"
      );
      return;
    }

    if (this.#locomotionMode === "grounded") {
      this.#characterPresentationSnapshot = this.#groundedBodyRuntime.isInitialized
        ? createGroundedCharacterPresentationSnapshot(
            this.#groundedBodyRuntime.snapshot
          )
        : null;
      return;
    }

    if (this.#locomotionMode === "swim") {
      this.#characterPresentationSnapshot = createCharacterPresentationSnapshot(
        this.#swimSnapshot.position,
        this.#swimSnapshot.yawRadians,
        this.#swimSnapshot.planarSpeedUnitsPerSecond
      );
      return;
    }

    this.#characterPresentationSnapshot = null;
  }
}
