export interface PhysicsVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MetaverseGroundedBodyIntentSnapshot {
  readonly boost: boolean;
  readonly moveAxis: number;
  readonly turnAxis: number;
}

export interface MetaverseGroundedBodySnapshot {
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly eyeHeightMeters: number;
  readonly grounded: boolean;
  readonly position: PhysicsVector3Snapshot;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyConfig {
  readonly baseSpeedUnitsPerSecond: number;
  readonly boostMultiplier: number;
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters: number;
  readonly eyeHeightMeters: number;
  readonly gravityUnitsPerSecond: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
  readonly spawnPosition: PhysicsVector3Snapshot;
  readonly worldRadius: number;
}

export interface RapierVectorLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RapierVectorConstructor {
  new (x: number, y: number, z: number): RapierVectorLike;
}

export interface RapierColliderDescHandle {
  setTranslation(x: number, y: number, z: number): RapierColliderDescHandle;
}

export interface RapierColliderDescFactory {
  ball(radius: number): RapierColliderDescHandle;
  capsule(halfHeight: number, radius: number): RapierColliderDescHandle;
  cuboid(
    halfExtentX: number,
    halfExtentY: number,
    halfExtentZ: number
  ): RapierColliderDescHandle;
}

export interface RapierColliderHandle {
  setTranslation(translation: RapierVectorLike): void;
  translation(): RapierVectorLike;
}

export interface RapierCharacterControllerHandle {
  computedGrounded(): boolean;
  computedMovement(): RapierVectorLike;
  computeColliderMovement(
    collider: RapierColliderHandle,
    desiredTranslationDelta: RapierVectorLike
  ): void;
  enableSnapToGround(distance: number): void;
  free?(): void;
  setApplyImpulsesToDynamicBodies(enabled: boolean): void;
  setCharacterMass(mass: number | null): void;
}

export interface RapierWorldHandle {
  createCharacterController(offset: number): RapierCharacterControllerHandle;
  createCollider(colliderDesc: RapierColliderDescHandle): RapierColliderHandle;
  removeCollider(collider: RapierColliderHandle, wakeUp: boolean): void;
}

export interface RapierApiHandle {
  readonly ColliderDesc: RapierColliderDescFactory;
  readonly Vector3: RapierVectorConstructor;
}

export interface RapierPhysicsAddon {
  readonly RAPIER: RapierApiHandle;
  readonly world: RapierWorldHandle;
}
