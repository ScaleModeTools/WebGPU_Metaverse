import { RapierPhysicsRuntime } from "./rapier-physics-runtime";
import type {
  MetaverseGroundedBodyConfig,
  MetaverseGroundedBodyIntentSnapshot,
  MetaverseGroundedBodySnapshot,
  PhysicsVector3Snapshot,
  RapierCharacterControllerHandle,
  RapierColliderHandle
} from "../types/metaverse-grounded-body";

function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
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

function sanitizeConfig(
  config: MetaverseGroundedBodyConfig
): MetaverseGroundedBodyConfig {
  return Object.freeze({
    baseSpeedUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.baseSpeedUnitsPerSecond, 6)
    ),
    boostMultiplier: Math.max(1, toFiniteNumber(config.boostMultiplier, 1.65)),
    capsuleHalfHeightMeters: Math.max(
      0.05,
      toFiniteNumber(config.capsuleHalfHeightMeters, 0.48)
    ),
    capsuleRadiusMeters: Math.max(
      0.05,
      toFiniteNumber(config.capsuleRadiusMeters, 0.34)
    ),
    controllerOffsetMeters: Math.max(
      0.001,
      toFiniteNumber(config.controllerOffsetMeters, 0.01)
    ),
    eyeHeightMeters: Math.max(0.4, toFiniteNumber(config.eyeHeightMeters, 1.62)),
    gravityUnitsPerSecond: Math.max(
      0,
      toFiniteNumber(config.gravityUnitsPerSecond, 18)
    ),
    maxTurnSpeedRadiansPerSecond: Math.max(
      0,
      toFiniteNumber(config.maxTurnSpeedRadiansPerSecond, 1.9)
    ),
    snapToGroundDistanceMeters: Math.max(
      0,
      toFiniteNumber(config.snapToGroundDistanceMeters, 0.22)
    ),
    spawnPosition: freezeVector3(
      config.spawnPosition.x,
      config.spawnPosition.y,
      config.spawnPosition.z
    ),
    worldRadius: Math.max(1, toFiniteNumber(config.worldRadius, 110))
  });
}

function freezeGroundedBodySnapshot(
  config: MetaverseGroundedBodyConfig,
  position: PhysicsVector3Snapshot,
  yawRadians: number,
  grounded: boolean
): MetaverseGroundedBodySnapshot {
  return Object.freeze({
    capsuleHalfHeightMeters: config.capsuleHalfHeightMeters,
    capsuleRadiusMeters: config.capsuleRadiusMeters,
    eyeHeightMeters: config.eyeHeightMeters,
    grounded,
    position,
    yawRadians: wrapRadians(yawRadians)
  });
}

export class MetaverseGroundedBodyRuntime {
  readonly #config: MetaverseGroundedBodyConfig;
  readonly #physicsRuntime: RapierPhysicsRuntime;

  #characterController: RapierCharacterControllerHandle | null = null;
  #collider: RapierColliderHandle | null = null;
  #snapshot: MetaverseGroundedBodySnapshot;

  constructor(
    config: MetaverseGroundedBodyConfig,
    physicsRuntime: RapierPhysicsRuntime
  ) {
    this.#config = sanitizeConfig(config);
    this.#physicsRuntime = physicsRuntime;
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#config.spawnPosition,
      0,
      false
    );
  }

  get isInitialized(): boolean {
    return this.#characterController !== null && this.#collider !== null;
  }

  get snapshot(): MetaverseGroundedBodySnapshot {
    return this.#snapshot;
  }

  async init(initialYawRadians = 0): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.#physicsRuntime.init();

    const controller = this.#physicsRuntime.createCharacterController(
      this.#config.controllerOffsetMeters
    );

    controller.setApplyImpulsesToDynamicBodies(false);
    controller.setCharacterMass(1);
    controller.enableSnapToGround(this.#config.snapToGroundDistanceMeters);

    const collider = this.#physicsRuntime.createCapsuleCollider(
      this.#config.capsuleHalfHeightMeters,
      this.#config.capsuleRadiusMeters,
      this.#rootToColliderCenter(this.#config.spawnPosition)
    );

    this.#characterController = controller;
    this.#collider = collider;
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#config.spawnPosition,
      initialYawRadians,
      false
    );
  }

  advance(
    intentSnapshot: MetaverseGroundedBodyIntentSnapshot,
    deltaSeconds: number
  ): MetaverseGroundedBodySnapshot {
    const collider = this.#requireCollider();
    const controller = this.#requireCharacterController();

    if (deltaSeconds <= 0) {
      return this.#snapshot;
    }

    const yawRadians = wrapRadians(
      this.#snapshot.yawRadians +
        clamp(intentSnapshot.turnAxis, -1, 1) *
          this.#config.maxTurnSpeedRadiansPerSecond *
          deltaSeconds
    );
    const speed =
      this.#config.baseSpeedUnitsPerSecond *
      (intentSnapshot.boost ? this.#config.boostMultiplier : 1);
    const moveAxis = clamp(intentSnapshot.moveAxis, -1, 1);
    const desiredMovement = this.#physicsRuntime.createVector3(
      Math.sin(yawRadians) * moveAxis * speed * deltaSeconds,
      -this.#config.gravityUnitsPerSecond * deltaSeconds,
      -Math.cos(yawRadians) * moveAxis * speed * deltaSeconds
    );

    controller.computeColliderMovement(collider, desiredMovement);

    const currentTranslation = collider.translation();
    const computedMovement = controller.computedMovement();
    const unclampedRootPosition = freezeVector3(
      currentTranslation.x + computedMovement.x,
      currentTranslation.y + computedMovement.y - this.#standingOffsetMeters,
      currentTranslation.z + computedMovement.z
    );
    const radialDistance = Math.hypot(
      unclampedRootPosition.x,
      unclampedRootPosition.z
    );
    const radiusScale =
      radialDistance <= this.#config.worldRadius
        ? 1
        : this.#config.worldRadius / Math.max(1, radialDistance);
    const clampedRootPosition = freezeVector3(
      unclampedRootPosition.x * radiusScale,
      unclampedRootPosition.y,
      unclampedRootPosition.z * radiusScale
    );

    collider.setTranslation(this.#rootToColliderCenter(clampedRootPosition));

    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      clampedRootPosition,
      yawRadians,
      controller.computedGrounded()
    );

    return this.#snapshot;
  }

  dispose(): void {
    if (this.#collider !== null) {
      this.#physicsRuntime.removeCollider(this.#collider);
      this.#collider = null;
    }

    this.#characterController?.free?.();
    this.#characterController = null;
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      this.#config.spawnPosition,
      this.#snapshot.yawRadians,
      false
    );
  }

  teleport(position: PhysicsVector3Snapshot, yawRadians: number): void {
    const collider = this.#requireCollider();
    const sanitizedPosition = freezeVector3(position.x, position.y, position.z);

    collider.setTranslation(this.#rootToColliderCenter(sanitizedPosition));
    this.#snapshot = freezeGroundedBodySnapshot(
      this.#config,
      sanitizedPosition,
      yawRadians,
      false
    );
  }

  get #standingOffsetMeters(): number {
    return (
      this.#config.capsuleHalfHeightMeters + this.#config.capsuleRadiusMeters
    );
  }

  #requireCharacterController(): RapierCharacterControllerHandle {
    if (this.#characterController === null) {
      throw new Error("Metaverse grounded body runtime must be initialized before use.");
    }

    return this.#characterController;
  }

  #requireCollider(): RapierColliderHandle {
    if (this.#collider === null) {
      throw new Error("Metaverse grounded body runtime must be initialized before use.");
    }

    return this.#collider;
  }

  #rootToColliderCenter(
    rootPosition: PhysicsVector3Snapshot
  ): PhysicsVector3Snapshot {
    return freezeVector3(
      rootPosition.x,
      rootPosition.y + this.#standingOffsetMeters,
      rootPosition.z
    );
  }
}
