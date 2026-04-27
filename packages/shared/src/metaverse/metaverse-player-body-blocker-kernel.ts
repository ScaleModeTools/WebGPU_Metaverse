import type {
  MetaverseWorldSurfaceVector3Snapshot
} from "./metaverse-world-surface-query.js";
import {
  createMetaverseSurfaceTraversalVector3Snapshot as freezeVector3,
  toFiniteNumber
} from "./metaverse-surface-traversal-simulation.js";

export interface MetaverseTraversalPlayerBodyBlockerSnapshot {
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly playerId: string;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
}

export interface ConstrainMetaverseTraversalPlayerBodyBlockersInput {
  readonly blockers: readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters?: number | null;
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly maxIterations?: number | null;
  readonly nextPosition: MetaverseWorldSurfaceVector3Snapshot;
}

const playerBodyBlockerEpsilonMeters = 0.000001;
const playerBodyBlockerHeightOverlapToleranceMeters = 0.001;

function resolveCapsuleHeightRange(
  position: MetaverseWorldSurfaceVector3Snapshot,
  capsuleHalfHeightMeters: number,
  capsuleRadiusMeters: number
): {
  readonly maxHeightMeters: number;
  readonly minHeightMeters: number;
} {
  const standingOffsetMeters =
    Math.max(0, toFiniteNumber(capsuleHalfHeightMeters, 0)) +
    Math.max(0, toFiniteNumber(capsuleRadiusMeters, 0));

  return Object.freeze({
    maxHeightMeters: position.y + standingOffsetMeters * 2,
    minHeightMeters: position.y
  });
}

function doCapsuleHeightRangesOverlap(
  first: {
    readonly maxHeightMeters: number;
    readonly minHeightMeters: number;
  },
  second: {
    readonly maxHeightMeters: number;
    readonly minHeightMeters: number;
  }
): boolean {
  return (
    first.maxHeightMeters + playerBodyBlockerHeightOverlapToleranceMeters >=
      second.minHeightMeters &&
    second.maxHeightMeters + playerBodyBlockerHeightOverlapToleranceMeters >=
      first.minHeightMeters
  );
}

function resolveSweptCapsuleHeightRange(
  currentPosition: MetaverseWorldSurfaceVector3Snapshot,
  nextPosition: MetaverseWorldSurfaceVector3Snapshot,
  capsuleHalfHeightMeters: number,
  capsuleRadiusMeters: number
): {
  readonly maxHeightMeters: number;
  readonly minHeightMeters: number;
} {
  const currentHeightRange = resolveCapsuleHeightRange(
    currentPosition,
    capsuleHalfHeightMeters,
    capsuleRadiusMeters
  );
  const nextHeightRange = resolveCapsuleHeightRange(
    nextPosition,
    capsuleHalfHeightMeters,
    capsuleRadiusMeters
  );

  return Object.freeze({
    maxHeightMeters: Math.max(
      currentHeightRange.maxHeightMeters,
      nextHeightRange.maxHeightMeters
    ),
    minHeightMeters: Math.min(
      currentHeightRange.minHeightMeters,
      nextHeightRange.minHeightMeters
    )
  });
}

function resolveFallbackBlockerNormal(input: {
  readonly blockerPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly nextPosition: MetaverseWorldSurfaceVector3Snapshot;
}): {
  readonly x: number;
  readonly z: number;
} {
  const currentDeltaX = input.currentPosition.x - input.blockerPosition.x;
  const currentDeltaZ = input.currentPosition.z - input.blockerPosition.z;
  const currentDistance = Math.hypot(currentDeltaX, currentDeltaZ);

  if (currentDistance > playerBodyBlockerEpsilonMeters) {
    return Object.freeze({
      x: currentDeltaX / currentDistance,
      z: currentDeltaZ / currentDistance
    });
  }

  const desiredDeltaX = input.nextPosition.x - input.currentPosition.x;
  const desiredDeltaZ = input.nextPosition.z - input.currentPosition.z;
  const desiredDistance = Math.hypot(desiredDeltaX, desiredDeltaZ);

  if (desiredDistance > playerBodyBlockerEpsilonMeters) {
    return Object.freeze({
      x: -desiredDeltaX / desiredDistance,
      z: -desiredDeltaZ / desiredDistance
    });
  }

  return Object.freeze({
    x: 0,
    z: 1
  });
}

function resolvePlayerBodyBlockerClearanceMeters(input: {
  readonly blocker: MetaverseTraversalPlayerBodyBlockerSnapshot;
  readonly controllerOffsetMeters: number;
  readonly movingRadiusMeters: number;
}): number {
  return (
    input.movingRadiusMeters +
    Math.max(0, toFiniteNumber(input.blocker.capsuleRadiusMeters, 0)) +
    input.controllerOffsetMeters
  );
}

function resolveBlockerNormalAtPosition(input: {
  readonly blockerPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly nextPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
}): {
  readonly x: number;
  readonly z: number;
} {
  const deltaX = input.position.x - input.blockerPosition.x;
  const deltaZ = input.position.z - input.blockerPosition.z;
  const distanceMeters = Math.hypot(deltaX, deltaZ);

  if (distanceMeters > playerBodyBlockerEpsilonMeters) {
    return Object.freeze({
      x: deltaX / distanceMeters,
      z: deltaZ / distanceMeters
    });
  }

  return resolveFallbackBlockerNormal(input);
}

function resolveSweptPlayerBodyBlockerContact(input: {
  readonly blockers: readonly MetaverseTraversalPlayerBodyBlockerSnapshot[];
  readonly capsuleHalfHeightMeters: number;
  readonly capsuleRadiusMeters: number;
  readonly controllerOffsetMeters: number;
  readonly currentPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly movingRadiusMeters: number;
  readonly sweepEndPosition: MetaverseWorldSurfaceVector3Snapshot;
  readonly sweepStartPosition: MetaverseWorldSurfaceVector3Snapshot;
}): {
  readonly blocker: MetaverseTraversalPlayerBodyBlockerSnapshot;
  readonly clearanceMeters: number;
  readonly normal: {
    readonly x: number;
    readonly z: number;
  };
  readonly position: MetaverseWorldSurfaceVector3Snapshot;
  readonly time: number;
} | null {
  const sweepDeltaX =
    input.sweepEndPosition.x - input.sweepStartPosition.x;
  const sweepDeltaZ =
    input.sweepEndPosition.z - input.sweepStartPosition.z;
  const sweepDistanceSquared =
    sweepDeltaX * sweepDeltaX + sweepDeltaZ * sweepDeltaZ;

  if (sweepDistanceSquared <= playerBodyBlockerEpsilonMeters) {
    return null;
  }

  const movingHeightRange = resolveSweptCapsuleHeightRange(
    input.sweepStartPosition,
    input.sweepEndPosition,
    input.capsuleHalfHeightMeters,
    input.capsuleRadiusMeters
  );
  let selectedContact:
    | {
        readonly blocker: MetaverseTraversalPlayerBodyBlockerSnapshot;
        readonly clearanceMeters: number;
        readonly normal: {
          readonly x: number;
          readonly z: number;
        };
        readonly position: MetaverseWorldSurfaceVector3Snapshot;
        readonly time: number;
      }
    | null = null;

  for (const blocker of input.blockers) {
    const clearanceMeters = resolvePlayerBodyBlockerClearanceMeters({
      blocker,
      controllerOffsetMeters: input.controllerOffsetMeters,
      movingRadiusMeters: input.movingRadiusMeters
    });

    if (clearanceMeters <= playerBodyBlockerEpsilonMeters) {
      continue;
    }

    const blockerHeightRange = resolveCapsuleHeightRange(
      blocker.position,
      blocker.capsuleHalfHeightMeters,
      blocker.capsuleRadiusMeters
    );

    if (!doCapsuleHeightRangesOverlap(movingHeightRange, blockerHeightRange)) {
      continue;
    }

    const startDeltaX = input.sweepStartPosition.x - blocker.position.x;
    const startDeltaZ = input.sweepStartPosition.z - blocker.position.z;
    const startDistanceSquared =
      startDeltaX * startDeltaX + startDeltaZ * startDeltaZ;
    const clearanceSquared = clearanceMeters * clearanceMeters;
    const startClearanceDelta = startDistanceSquared - clearanceSquared;
    const sweepDot = startDeltaX * sweepDeltaX + startDeltaZ * sweepDeltaZ;
    let contactTime: number | null = null;

    if (startClearanceDelta <= playerBodyBlockerEpsilonMeters) {
      if (sweepDot < 0) {
        contactTime = 0;
      }
    } else if (sweepDot < 0) {
      const discriminant =
        sweepDot * sweepDot - sweepDistanceSquared * startClearanceDelta;

      if (discriminant >= 0) {
        const entryTime =
          (-sweepDot - Math.sqrt(discriminant)) / sweepDistanceSquared;

        if (
          entryTime >= -playerBodyBlockerEpsilonMeters &&
          entryTime <= 1 + playerBodyBlockerEpsilonMeters
        ) {
          contactTime = Math.min(1, Math.max(0, entryTime));
        }
      }
    }

    if (
      contactTime === null ||
      (selectedContact !== null && contactTime >= selectedContact.time)
    ) {
      continue;
    }

    const contactPosition = freezeVector3(
      input.sweepStartPosition.x + sweepDeltaX * contactTime,
      input.sweepEndPosition.y,
      input.sweepStartPosition.z + sweepDeltaZ * contactTime
    );
    const normal = resolveBlockerNormalAtPosition({
      blockerPosition: blocker.position,
      currentPosition: input.currentPosition,
      nextPosition: input.sweepEndPosition,
      position: contactPosition
    });

    selectedContact = Object.freeze({
      blocker,
      clearanceMeters,
      normal,
      position: freezeVector3(
        blocker.position.x + normal.x * clearanceMeters,
        input.sweepEndPosition.y,
        blocker.position.z + normal.z * clearanceMeters
      ),
      time: contactTime
    });
  }

  return selectedContact;
}

export function constrainMetaverseTraversalPlayerBodyBlockers(
  input: ConstrainMetaverseTraversalPlayerBodyBlockersInput
): MetaverseWorldSurfaceVector3Snapshot {
  const movingRadiusMeters = Math.max(
    0,
    toFiniteNumber(input.capsuleRadiusMeters, 0)
  );
  const controllerOffsetMeters = Math.max(
    0,
    toFiniteNumber(input.controllerOffsetMeters ?? 0, 0)
  );
  const maxIterations = Math.max(
    1,
    Math.floor(toFiniteNumber(input.maxIterations ?? input.blockers.length + 1, 1))
  );
  let sweepStartPosition = freezeVector3(
    input.currentPosition.x,
    input.currentPosition.y,
    input.currentPosition.z
  );
  let resolvedPosition = freezeVector3(
    input.nextPosition.x,
    input.nextPosition.y,
    input.nextPosition.z
  );

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const sweptContact = resolveSweptPlayerBodyBlockerContact({
      blockers: input.blockers,
      capsuleHalfHeightMeters: input.capsuleHalfHeightMeters,
      capsuleRadiusMeters: input.capsuleRadiusMeters,
      controllerOffsetMeters,
      currentPosition: input.currentPosition,
      movingRadiusMeters,
      sweepEndPosition: resolvedPosition,
      sweepStartPosition
    });

    if (sweptContact === null) {
      break;
    }

    const remainingMovementX = resolvedPosition.x - sweptContact.position.x;
    const remainingMovementZ = resolvedPosition.z - sweptContact.position.z;
    const inwardMovement =
      remainingMovementX * sweptContact.normal.x +
      remainingMovementZ * sweptContact.normal.z;
    const slideMovementX =
      inwardMovement < 0
        ? remainingMovementX - sweptContact.normal.x * inwardMovement
        : remainingMovementX;
    const slideMovementZ =
      inwardMovement < 0
        ? remainingMovementZ - sweptContact.normal.z * inwardMovement
        : remainingMovementZ;

    sweepStartPosition = sweptContact.position;
    resolvedPosition = freezeVector3(
      sweptContact.position.x + slideMovementX,
      resolvedPosition.y,
      sweptContact.position.z + slideMovementZ
    );
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let constrained = false;
    const movingHeightRange = resolveCapsuleHeightRange(
      resolvedPosition,
      input.capsuleHalfHeightMeters,
      input.capsuleRadiusMeters
    );

    for (const blocker of input.blockers) {
      const clearanceMeters = resolvePlayerBodyBlockerClearanceMeters({
        blocker,
        controllerOffsetMeters,
        movingRadiusMeters
      });

      if (clearanceMeters <= playerBodyBlockerEpsilonMeters) {
        continue;
      }

      const blockerHeightRange = resolveCapsuleHeightRange(
        blocker.position,
        blocker.capsuleHalfHeightMeters,
        blocker.capsuleRadiusMeters
      );

      if (!doCapsuleHeightRangesOverlap(movingHeightRange, blockerHeightRange)) {
        continue;
      }

      const deltaX = resolvedPosition.x - blocker.position.x;
      const deltaZ = resolvedPosition.z - blocker.position.z;
      const distanceMeters = Math.hypot(deltaX, deltaZ);

      if (
        distanceMeters + playerBodyBlockerEpsilonMeters >=
        clearanceMeters
      ) {
        continue;
      }

      const normal =
        distanceMeters > playerBodyBlockerEpsilonMeters
          ? Object.freeze({
              x: deltaX / distanceMeters,
              z: deltaZ / distanceMeters
            })
          : resolveFallbackBlockerNormal({
              blockerPosition: blocker.position,
              currentPosition: input.currentPosition,
              nextPosition: input.nextPosition
            });

      resolvedPosition = freezeVector3(
        blocker.position.x + normal.x * clearanceMeters,
        resolvedPosition.y,
        blocker.position.z + normal.z * clearanceMeters
      );
      constrained = true;
    }

    if (!constrained) {
      break;
    }
  }

  return resolvedPosition;
}
