import type { NormalizedViewportPointInput } from "@webgpu-metaverse/shared";

import type { HandTrackingPoseSnapshot } from "./hand-tracking";

export interface HandAimObservationConfig {
  readonly aimAnchor: {
    readonly indexKnuckleWeight: number;
    readonly indexJointWeight: number;
    readonly indexTipWeight: number;
  };
  readonly indexDirection: {
    readonly fullChainWeight: number;
    readonly midSegmentWeight: number;
    readonly tipSegmentWeight: number;
  };
  readonly thumbReference: {
    readonly thumbBaseWeight: number;
    readonly thumbKnuckleWeight: number;
  };
  readonly forwardProjectionDistanceMultiplier: number;
  readonly thumbSideOffsetDistanceMultiplier: number;
}

interface HandPoint2 {
  readonly x: number;
  readonly y: number;
}

function addVectors(pointA: HandPoint2, pointB: HandPoint2): HandPoint2 {
  return {
    x: pointA.x + pointB.x,
    y: pointA.y + pointB.y
  };
}

function scaleVector(point: HandPoint2, scalar: number): HandPoint2 {
  return {
    x: point.x * scalar,
    y: point.y * scalar
  };
}

function subtractPoints(endPoint: HandPoint2, startPoint: HandPoint2): HandPoint2 {
  return {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y
  };
}

function readVectorLength(vector: HandPoint2): number {
  return Math.hypot(vector.x, vector.y);
}

function normalizeVector(vector: HandPoint2): HandPoint2 | null {
  const length = readVectorLength(vector);

  if (length <= 1e-6) {
    return null;
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function readDotProduct(vectorA: HandPoint2, vectorB: HandPoint2): number {
  return vectorA.x * vectorB.x + vectorA.y * vectorB.y;
}

function readWeightedPoint(
  entries: readonly {
    readonly point: HandPoint2;
    readonly weight: number;
  }[]
): HandPoint2 {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const entry of entries) {
    totalWeight += entry.weight;
    weightedX += entry.point.x * entry.weight;
    weightedY += entry.point.y * entry.weight;
  }

  if (totalWeight <= 0) {
    return entries[entries.length - 1]?.point ?? { x: 0, y: 0 };
  }

  return {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight
  };
}

function projectVectorOntoAxis(
  vector: HandPoint2,
  axis: HandPoint2
): HandPoint2 {
  return scaleVector(axis, readDotProduct(vector, axis));
}

function readIndexDirectionVector(
  pose: HandTrackingPoseSnapshot,
  config: HandAimObservationConfig
): HandPoint2 {
  const tipSegment = subtractPoints(pose.indexTip, pose.indexJoint);
  const midSegment = subtractPoints(pose.indexJoint, pose.indexKnuckle);
  const fullChain = subtractPoints(pose.indexTip, pose.indexBase);
  const blendedDirection = addVectors(
    addVectors(
      scaleVector(tipSegment, config.indexDirection.tipSegmentWeight),
      scaleVector(midSegment, config.indexDirection.midSegmentWeight)
    ),
    scaleVector(fullChain, config.indexDirection.fullChainWeight)
  );

  return (
    normalizeVector(blendedDirection) ??
    normalizeVector(subtractPoints(pose.indexTip, pose.indexKnuckle)) ??
    { x: 0, y: -1 }
  );
}

function readIndexReferenceLength(pose: HandTrackingPoseSnapshot): number {
  const midSegmentLength = readVectorLength(
    subtractPoints(pose.indexJoint, pose.indexKnuckle)
  );
  const tipSegmentLength = readVectorLength(
    subtractPoints(pose.indexTip, pose.indexJoint)
  );
  const referenceLength = (midSegmentLength + tipSegmentLength) / 2;

  return Math.max(referenceLength, 0.0001);
}

export function readObservedAimPoint(
  pose: HandTrackingPoseSnapshot,
  config: HandAimObservationConfig
): NormalizedViewportPointInput {
  const aimAnchor = readWeightedPoint([
    {
      point: pose.indexKnuckle,
      weight: config.aimAnchor.indexKnuckleWeight
    },
    {
      point: pose.indexJoint,
      weight: config.aimAnchor.indexJointWeight
    },
    {
      point: pose.indexTip,
      weight: config.aimAnchor.indexTipWeight
    }
  ]);
  const indexDirection = readIndexDirectionVector(pose, config);
  const thumbReference = readWeightedPoint([
    {
      point: pose.thumbBase,
      weight: config.thumbReference.thumbBaseWeight
    },
    {
      point: pose.thumbKnuckle,
      weight: config.thumbReference.thumbKnuckleWeight
    }
  ]);
  const thumbSideVector = subtractPoints(thumbReference, aimAnchor);
  const thumbSideDirection =
    normalizeVector(
      subtractPoints(
        thumbSideVector,
        projectVectorOntoAxis(thumbSideVector, indexDirection)
      )
    ) ?? {
      x: -indexDirection.y,
      y: indexDirection.x
    };
  const referenceLength = readIndexReferenceLength(pose);
  const projectedAimPoint = addVectors(
    aimAnchor,
    addVectors(
      scaleVector(
        indexDirection,
        referenceLength * config.forwardProjectionDistanceMultiplier
      ),
      scaleVector(
        thumbSideDirection,
        referenceLength * config.thumbSideOffsetDistanceMultiplier
      )
    )
  );

  return {
    x: projectedAimPoint.x,
    y: projectedAimPoint.y
  };
}
