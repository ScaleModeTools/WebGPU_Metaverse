import type {
  MetaverseGroundedBodySnapshot,
  PhysicsVector3Snapshot
} from "@/physics";

import type { MetaverseLocomotionModeId } from "../../types/metaverse-locomotion-mode";
import type {
  MetaverseCharacterPresentationSnapshot
} from "../../types/presentation";
import type { MetaverseRuntimeConfig } from "../../types/runtime-config";
import type {
  MetaverseMountedOccupancyPresentationStateSnapshot
} from "../../states/mounted-occupancy";
import { createSurfaceLocomotionSnapshot, freezeVector3 } from "../policies/surface-locomotion";
import {
  projectGroundedTraversalPresentationPosition,
  projectTraversalPresentationPosition
} from "./presentation-projection";
import { MetaverseMovementAnimationPolicyRuntime } from "./metaverse-movement-animation-policy";
import { createTraversalCharacterPresentationSnapshot } from "./character-presentation";
import type {
  SurfaceLocomotionSnapshot,
  TraversalMountedVehicleSnapshot
} from "../types/traversal";

interface MetaverseTraversalCharacterPresentationStateInput {
  readonly deltaSeconds: number;
  readonly groundedBodySnapshot: MetaverseGroundedBodySnapshot | null;
  readonly groundedLinearVelocitySnapshot: PhysicsVector3Snapshot | null;
  readonly groundedPredictionSeconds: number;
  readonly groundedSpawnPosition: PhysicsVector3Snapshot;
  readonly latestMovementInputMagnitude: number;
  readonly locomotionMode: MetaverseLocomotionModeId;
  readonly mountedOccupancyPresentationState:
    | MetaverseMountedOccupancyPresentationStateSnapshot
    | null;
  readonly mountedVehicleSnapshot: TraversalMountedVehicleSnapshot | null;
  readonly presentationYawRadians: number | null;
  readonly readGroundedSupportHeightMeters: (
    position: Pick<PhysicsVector3Snapshot, "x" | "z">
  ) => number | null;
  readonly swimPredictionSeconds: number;
  readonly swimSnapshot: SurfaceLocomotionSnapshot | null;
  readonly waterSurfaceHeightMeters: number;
}

export class MetaverseTraversalCharacterPresentationState {
  readonly #config: MetaverseRuntimeConfig;
  readonly #movementAnimationRuntime = new MetaverseMovementAnimationPolicyRuntime();

  #snapshot: MetaverseCharacterPresentationSnapshot | null = null;

  constructor(config: MetaverseRuntimeConfig) {
    this.#config = config;
  }

  get snapshot(): MetaverseCharacterPresentationSnapshot | null {
    return this.#snapshot;
  }

  clear(): void {
    this.#snapshot = null;
    this.#movementAnimationRuntime.reset();
  }

  resetAnimation(
    animationVocabulary: MetaverseCharacterPresentationSnapshot["animationVocabulary"] = "idle"
  ): void {
    this.#movementAnimationRuntime.reset(animationVocabulary);
  }

  sync({
    deltaSeconds,
    groundedBodySnapshot,
    groundedLinearVelocitySnapshot,
    groundedPredictionSeconds,
    groundedSpawnPosition,
    latestMovementInputMagnitude,
    locomotionMode,
    mountedOccupancyPresentationState,
    mountedVehicleSnapshot,
    presentationYawRadians,
    readGroundedSupportHeightMeters,
    swimPredictionSeconds,
    swimSnapshot,
    waterSurfaceHeightMeters
  }: MetaverseTraversalCharacterPresentationStateInput): void {
    const resolvedSwimSnapshot =
      swimSnapshot ??
      createSurfaceLocomotionSnapshot(
        freezeVector3(
          groundedSpawnPosition.x,
          waterSurfaceHeightMeters,
          groundedSpawnPosition.z
        ),
        this.#config.camera.initialYawRadians
      );

    this.#snapshot = createTraversalCharacterPresentationSnapshot({
      animationVocabulary: this.#resolveAnimationVocabulary(
        locomotionMode,
        groundedBodySnapshot,
        swimSnapshot,
        latestMovementInputMagnitude,
        deltaSeconds
      ),
      config: this.#config,
      groundedBodySnapshot,
      groundedPresentationPosition:
        groundedBodySnapshot === null
          ? null
          : this.resolveGroundedPresentationPosition(
              groundedBodySnapshot,
              groundedLinearVelocitySnapshot,
              groundedPredictionSeconds,
              readGroundedSupportHeightMeters
            ),
      locomotionMode,
      mountedOccupancyPresentationState,
      mountedVehicleSnapshot,
      presentationYawRadians,
      swimPresentationPosition:
        locomotionMode === "swim"
          ? this.resolveSwimPresentationPosition(
              resolvedSwimSnapshot,
              swimPredictionSeconds
            )
          : resolvedSwimSnapshot.position,
      swimSnapshot: resolvedSwimSnapshot
    });
  }

  #resolveAnimationVocabulary(
    locomotionMode: MetaverseLocomotionModeId,
    groundedBodySnapshot: MetaverseGroundedBodySnapshot | null,
    swimSnapshot: SurfaceLocomotionSnapshot | null,
    latestMovementInputMagnitude: number,
    deltaSeconds: number
  ): MetaverseCharacterPresentationSnapshot["animationVocabulary"] {
    if (locomotionMode === "grounded") {
      if (groundedBodySnapshot === null) {
        this.#movementAnimationRuntime.reset("idle");
        return this.#movementAnimationRuntime.animationVocabulary;
      }

      return this.#movementAnimationRuntime.advance(
        {
          grounded: groundedBodySnapshot.grounded,
          inputMagnitude: latestMovementInputMagnitude,
          locomotionMode: "grounded",
          planarSpeedUnitsPerSecond:
            groundedBodySnapshot.planarSpeedUnitsPerSecond,
          verticalSpeedUnitsPerSecond:
            groundedBodySnapshot.verticalSpeedUnitsPerSecond
        },
        deltaSeconds
      );
    }

    if (locomotionMode === "swim") {
      if (swimSnapshot === null) {
        this.#movementAnimationRuntime.reset("idle");
        return this.#movementAnimationRuntime.animationVocabulary;
      }

      return this.#movementAnimationRuntime.advance(
        {
          grounded: false,
          inputMagnitude: latestMovementInputMagnitude,
          locomotionMode: "swim",
          planarSpeedUnitsPerSecond: swimSnapshot.planarSpeedUnitsPerSecond,
          verticalSpeedUnitsPerSecond: 0
        },
        deltaSeconds
      );
    }

    this.#movementAnimationRuntime.reset("idle");
    return this.#movementAnimationRuntime.animationVocabulary;
  }

  resolveGroundedPresentationPosition(
    groundedBodySnapshot: MetaverseGroundedBodySnapshot,
    groundedLinearVelocitySnapshot: PhysicsVector3Snapshot | null,
    groundedPredictionSeconds: number,
    readGroundedSupportHeightMeters: (
      position: Pick<PhysicsVector3Snapshot, "x" | "z">
    ) => number | null
  ): PhysicsVector3Snapshot {
    if (groundedLinearVelocitySnapshot === null) {
      return groundedBodySnapshot.position;
    }

    const planarProjectedPosition = projectTraversalPresentationPosition(
      groundedBodySnapshot.position,
      freezeVector3(
        groundedLinearVelocitySnapshot.x,
        0,
        groundedLinearVelocitySnapshot.z
      ),
      groundedPredictionSeconds
    );
    const supportHeightMeters = groundedBodySnapshot.grounded
      ? groundedBodySnapshot.position.y
      : readGroundedSupportHeightMeters(planarProjectedPosition);

    return projectGroundedTraversalPresentationPosition(
      groundedBodySnapshot.position,
      groundedLinearVelocitySnapshot,
      groundedPredictionSeconds,
      groundedBodySnapshot.grounded,
      this.#config.groundedBody.gravityUnitsPerSecond,
      supportHeightMeters
    );
  }

  resolveSwimPresentationPosition(
    swimSnapshot: SurfaceLocomotionSnapshot,
    swimPredictionSeconds: number
  ): PhysicsVector3Snapshot {
    const swimMotionSnapshot = swimSnapshot as SurfaceLocomotionSnapshot & {
      readonly linearVelocity?: PhysicsVector3Snapshot;
    };
    const linearVelocity =
      swimMotionSnapshot.linearVelocity ?? freezeVector3(0, 0, 0);

    return projectTraversalPresentationPosition(
      swimSnapshot.position,
      linearVelocity,
      swimPredictionSeconds
    );
  }
}
