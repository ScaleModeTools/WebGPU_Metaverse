export interface PhysicsVector3Snapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PhysicsQuaternionSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface MetaverseGroundedBodyIntentSnapshot {
  readonly boost: boolean;
  readonly jump: boolean;
  readonly moveAxis: number;
  readonly strafeAxis: number;
  readonly turnAxis: number;
}

export interface MetaverseGroundedBodySnapshot {
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly eyeHeightMeters: number;
  readonly grounded: boolean;
  readonly jumpReady: boolean;
  readonly planarSpeedUnitsPerSecond: number;
  readonly position: PhysicsVector3Snapshot;
  readonly verticalSpeedUnitsPerSecond: number;
  readonly yawRadians: number;
}

export interface MetaverseGroundedBodyConfig {
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
  readonly eyeHeightMeters: number;
  readonly gravityUnitsPerSecond: number;
  readonly jumpImpulseUnitsPerSecond: number;
  readonly maxSlopeClimbAngleRadians: number;
  readonly minSlopeSlideAngleRadians: number;
  readonly maxTurnSpeedRadiansPerSecond: number;
  readonly snapToGroundDistanceMeters: number;
  readonly stepHeightMeters: number;
  readonly stepWidthMeters: number;
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

export interface RapierRigidBodyDescHandle {
  lockRotations(): RapierRigidBodyDescHandle;
  setAdditionalMass(mass: number): RapierRigidBodyDescHandle;
  setAngularDamping(damping: number): RapierRigidBodyDescHandle;
  setGravityScale(scale: number): RapierRigidBodyDescHandle;
  setLinearDamping(damping: number): RapierRigidBodyDescHandle;
  setRotation(rotation: PhysicsQuaternionSnapshot): RapierRigidBodyDescHandle;
  setTranslation(
    x: number,
    y: number,
    z: number
  ): RapierRigidBodyDescHandle;
}

export interface RapierRigidBodyDescFactory {
  dynamic(): RapierRigidBodyDescHandle;
}

export interface RapierColliderDescHandle {
  setRotation(rotation: PhysicsQuaternionSnapshot): RapierColliderDescHandle;
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
  trimesh(
    vertices: Float32Array,
    indices: Uint32Array
  ): RapierColliderDescHandle;
}

export interface RapierColliderHandle {
  setRotation(rotation: PhysicsQuaternionSnapshot): void;
  setTranslation(translation: RapierVectorLike): void;
  translation(): RapierVectorLike;
}

export type RapierQueryFilterPredicate = (
  collider: RapierColliderHandle
) => boolean;

export interface RapierRigidBodyHandle {
  linvel(): RapierVectorLike;
  setLinvel(velocity: RapierVectorLike, wakeUp: boolean): void;
  setTranslation(translation: RapierVectorLike, wakeUp: boolean): void;
  translation(): RapierVectorLike;
}

export interface RapierCharacterControllerHandle {
  computedGrounded(): boolean;
  computedMovement(): RapierVectorLike;
  computeColliderMovement(
    collider: RapierColliderHandle,
    desiredTranslationDelta: RapierVectorLike,
    filterFlags?: number,
    filterGroups?: number,
    filterPredicate?: RapierQueryFilterPredicate
  ): void;
  disableAutostep?(): void;
  enableAutostep(
    maxHeight: number,
    minWidth: number,
    includeDynamicBodies: boolean
  ): void;
  enableSnapToGround(distance: number): void;
  free?(): void;
  setUp?(up: RapierVectorLike): void;
  setMaxSlopeClimbAngle?(angle: number): void;
  setMinSlopeSlideAngle?(angle: number): void;
  setApplyImpulsesToDynamicBodies(enabled: boolean): void;
  setCharacterMass(mass: number | null): void;
}

export interface RapierWorldHandle {
  createCharacterController(offset: number): RapierCharacterControllerHandle;
  createCollider(
    colliderDesc: RapierColliderDescHandle,
    parentBody?: RapierRigidBodyHandle
  ): RapierColliderHandle;
  createRigidBody(bodyDesc: RapierRigidBodyDescHandle): RapierRigidBodyHandle;
  removeCollider(collider: RapierColliderHandle, wakeUp: boolean): void;
  removeRigidBody(body: RapierRigidBodyHandle): void;
  step(): void;
  timestep: number;
}

export interface RapierWorldConstructor {
  new (gravity: RapierVectorLike): RapierWorldHandle;
}

export interface RapierApiHandle {
  readonly ColliderDesc: RapierColliderDescFactory;
  readonly RigidBodyDesc: RapierRigidBodyDescFactory;
  readonly Vector3: RapierVectorConstructor;
  readonly World: RapierWorldConstructor;
}

export interface RapierPhysicsAddon {
  readonly RAPIER: RapierApiHandle;
  readonly world: RapierWorldHandle;
}
