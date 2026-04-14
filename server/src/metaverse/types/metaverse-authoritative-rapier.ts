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
}

export interface RapierColliderHandle {
  setRotation(rotation: PhysicsQuaternionSnapshot): void;
  setTranslation(translation: RapierVectorLike): void;
  translation(): RapierVectorLike;
}

export type RapierQueryFilterPredicate = (
  collider: RapierColliderHandle
) => boolean;

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
  setCharacterMass(mass: number | null): void;
}

export interface RapierWorldHandle {
  createCharacterController(offset: number): RapierCharacterControllerHandle;
  createCollider(colliderDesc: RapierColliderDescHandle): RapierColliderHandle;
  removeCollider(collider: RapierColliderHandle, wakeUp: boolean): void;
  step(): void;
  timestep: number;
}

export interface RapierWorldConstructor {
  new (gravity: RapierVectorLike): RapierWorldHandle;
}

export interface RapierApiHandle {
  readonly ColliderDesc: RapierColliderDescFactory;
  readonly Vector3: RapierVectorConstructor;
  readonly World: RapierWorldConstructor;
  init(): Promise<void>;
}
