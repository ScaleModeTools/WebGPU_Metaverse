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

export interface RapierVectorLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RapierVectorConstructor {
  new (x: number, y: number, z: number): RapierVectorLike;
}

export interface RapierCharacterCollisionHandle {
  readonly normal1: RapierVectorLike;
}

export interface RapierRayHandle {
  readonly dir: RapierVectorLike;
  readonly origin: RapierVectorLike;
}

export interface RapierRayConstructor {
  new (origin: RapierVectorLike, dir: RapierVectorLike): RapierRayHandle;
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
  capsule(halfHeight: number, radius: number): RapierColliderDescHandle;
  cuboid(
    halfExtentX: number,
    halfExtentY: number,
    halfExtentZ: number
  ): RapierColliderDescHandle;
  heightfield(
    rows: number,
    cols: number,
    heights: Float32Array,
    scale: RapierVectorLike
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

export interface RapierRigidBodyHandle {
  linvel(): RapierVectorLike;
  setLinvel(velocity: RapierVectorLike, wakeUp: boolean): void;
  setTranslation(translation: RapierVectorLike, wakeUp: boolean): void;
  translation(): RapierVectorLike;
}

export type RapierQueryFilterPredicate = (
  collider: RapierColliderHandle
) => boolean;

export interface RapierCharacterControllerHandle {
  computedGrounded(): boolean;
  computedMovement(): RapierVectorLike;
  computedCollision?(index: number): RapierCharacterCollisionHandle | null;
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
  numComputedCollisions?(): number;
  setUp?(up: RapierVectorLike): void;
  setMaxSlopeClimbAngle?(angle: number): void;
  setMinSlopeSlideAngle?(angle: number): void;
  setApplyImpulsesToDynamicBodies(enabled: boolean): void;
  setCharacterMass(mass: number | null): void;
}

export interface RapierRayColliderHitHandle {
  readonly collider: RapierColliderHandle;
  readonly normal?: RapierVectorLike;
  readonly timeOfImpact?: number;
  readonly toi?: number;
}

export interface RapierWorldHandle {
  castRay(
    ray: RapierRayHandle,
    maxToi: number,
    solid: boolean,
    filterFlags?: number,
    filterGroups?: number,
    excludeCollider?: RapierColliderHandle | null,
    excludeRigidBody?: RapierRigidBodyHandle | null,
    filterPredicate?: RapierQueryFilterPredicate
  ): RapierRayColliderHitHandle | null;
  castRayAndGetNormal(
    ray: RapierRayHandle,
    maxToi: number,
    solid: boolean,
    filterFlags?: number,
    filterGroups?: number,
    excludeCollider?: RapierColliderHandle | null,
    excludeRigidBody?: RapierRigidBodyHandle | null,
    filterPredicate?: RapierQueryFilterPredicate
  ): RapierRayColliderHitHandle | null;
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
  readonly Ray: RapierRayConstructor;
  readonly RigidBodyDesc: RapierRigidBodyDescFactory;
  readonly Vector3: RapierVectorConstructor;
  readonly World: RapierWorldConstructor;
  init(): Promise<void>;
}
