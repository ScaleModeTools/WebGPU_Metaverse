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
        {
          position: freezeVector3(
            groundedSpawnPosition.x,
            waterSurfaceHeightMeters,
            groundedSpawnPosition.z
          ),
          yawRadians: this.#config.camera.initialYawRadians
        }
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
          planarSpeedUnitsPerSecond: Math.hypot(
            groundedBodySnapshot.linearVelocity.x,
            groundedBodySnapshot.linearVelocity.z
          ),
          verticalSpeedUnitsPerSecond:
            groundedBodySnapshot.jumpBody.verticalSpeedUnitsPerSecond
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
    groundedPredictionSeconds: number,
    readGroundedSupportHeightMeters: (
      position: Pick<PhysicsVector3Snapshot, "x" | "z">
    ) => number | null
  ): PhysicsVector3Snapshot {
    const planarProjectedPosition = projectTraversalPresentationPosition(
      groundedBodySnapshot.position,
      freezeVector3(
        groundedBodySnapshot.linearVelocity.x,
        0,
        groundedBodySnapshot.linearVelocity.z
      ),
      groundedPredictionSeconds
    );
    const supportHeightMeters = groundedBodySnapshot.grounded
      ? groundedBodySnapshot.position.y
      : readGroundedSupportHeightMeters(planarProjectedPosition);

    return projectGroundedTraversalPresentationPosition(
      groundedBodySnapshot.position,
      groundedBodySnapshot.linearVelocity,
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
    return projectTraversalPresentationPosition(
      swimSnapshot.position,
      swimSnapshot.linearVelocity,
      swimPredictionSeconds
    );
  }
}
