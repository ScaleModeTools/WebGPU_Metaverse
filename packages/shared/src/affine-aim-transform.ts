import {
  createNormalizedViewportPoint,
  type CalibrationShotSample,
  type NormalizedViewportPoint,
  type NormalizedViewportPointInput
} from "./calibration-types.js";

export interface AffineAimTransformSnapshot {
  readonly xCoefficients: readonly [number, number, number];
  readonly yCoefficients: readonly [number, number, number];
}

export const affineAimTransformFitQualities = [
  "stable",
  "usable",
  "degraded"
] as const;

export type AffineAimTransformFitQuality =
  (typeof affineAimTransformFitQualities)[number];

export interface AffineAimTransformFitDiagnosticsSnapshot {
  readonly inlierSampleCount: number;
  readonly maxResidual: number;
  readonly meanResidual: number;
  readonly quality: AffineAimTransformFitQuality;
  readonly sampleCount: number;
}

interface AffineAimTransformResidualStats {
  readonly inlierSampleCount: number;
  readonly maxResidual: number;
  readonly meanResidual: number;
  readonly sampleCount: number;
}

interface AffineAimTransformCandidateScore
  extends AffineAimTransformResidualStats {
  readonly inlierSamples: readonly CalibrationShotSample[];
  readonly transformSnapshot: AffineAimTransformSnapshot;
}

const affineAimTransformFitConfig = Object.freeze({
  inlierResidualMax: 0.075,
  stableMaxResidualMax: 0.035,
  stableMeanResidualMax: 0.015,
  usableMaxResidualMax: 0.09,
  usableMeanResidualMax: 0.032
});

function normalizeCoefficient(rawValue: number): number {
  return Number.isFinite(rawValue) ? rawValue : 0;
}

function createCoefficientTriplet(
  coefficients: readonly number[]
): readonly [number, number, number] {
  return Object.freeze([
    normalizeCoefficient(coefficients[0] ?? 0),
    normalizeCoefficient(coefficients[1] ?? 0),
    normalizeCoefficient(coefficients[2] ?? 0)
  ]) as readonly [number, number, number];
}

function freezeAffineAimTransformSnapshot(
  snapshot: AffineAimTransformSnapshot
): AffineAimTransformSnapshot {
  return Object.freeze({
    xCoefficients: createCoefficientTriplet(snapshot.xCoefficients),
    yCoefficients: createCoefficientTriplet(snapshot.yCoefficients)
  });
}

function freezeFitDiagnosticsSnapshot(
  diagnostics: AffineAimTransformFitDiagnosticsSnapshot
): AffineAimTransformFitDiagnosticsSnapshot {
  return Object.freeze({
    inlierSampleCount: diagnostics.inlierSampleCount,
    maxResidual: diagnostics.maxResidual,
    meanResidual: diagnostics.meanResidual,
    quality: diagnostics.quality,
    sampleCount: diagnostics.sampleCount
  });
}

function projectWithSnapshot(
  snapshot: AffineAimTransformSnapshot,
  observedPoint: NormalizedViewportPoint | NormalizedViewportPointInput
): NormalizedViewportPointInput {
  return Object.freeze({
    x:
      observedPoint.x * snapshot.xCoefficients[0] +
      observedPoint.y * snapshot.xCoefficients[1] +
      snapshot.xCoefficients[2],
    y:
      observedPoint.x * snapshot.yCoefficients[0] +
      observedPoint.y * snapshot.yCoefficients[1] +
      snapshot.yCoefficients[2]
  });
}

function measureResidualDistance(
  snapshot: AffineAimTransformSnapshot,
  sample: CalibrationShotSample
): number {
  const projectedPoint = projectWithSnapshot(snapshot, sample.observedPose.indexTip);
  const deltaX = projectedPoint.x - sample.intendedTarget.x;
  const deltaY = projectedPoint.y - sample.intendedTarget.y;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function collectResidualStats(
  snapshot: AffineAimTransformSnapshot,
  samples: readonly CalibrationShotSample[]
): AffineAimTransformResidualStats {
  if (samples.length === 0) {
    return {
      inlierSampleCount: 0,
      maxResidual: 0,
      meanResidual: 0,
      sampleCount: 0
    };
  }

  let inlierSampleCount = 0;
  let maxResidual = 0;
  let totalResidual = 0;

  for (const sample of samples) {
    const residual = measureResidualDistance(snapshot, sample);

    if (residual <= affineAimTransformFitConfig.inlierResidualMax) {
      inlierSampleCount += 1;
    }

    maxResidual = Math.max(maxResidual, residual);
    totalResidual += residual;
  }

  return {
    inlierSampleCount,
    maxResidual,
    meanResidual: totalResidual / samples.length,
    sampleCount: samples.length
  };
}

function createFitDiagnosticsSnapshot(
  snapshot: AffineAimTransformSnapshot,
  samples: readonly CalibrationShotSample[]
): AffineAimTransformFitDiagnosticsSnapshot {
  const residualStats = collectResidualStats(snapshot, samples);
  const quality =
    residualStats.meanResidual <= affineAimTransformFitConfig.stableMeanResidualMax &&
    residualStats.maxResidual <= affineAimTransformFitConfig.stableMaxResidualMax
      ? "stable"
      : residualStats.meanResidual <=
            affineAimTransformFitConfig.usableMeanResidualMax &&
          residualStats.maxResidual <= affineAimTransformFitConfig.usableMaxResidualMax
        ? "usable"
        : "degraded";

  return freezeFitDiagnosticsSnapshot({
    ...residualStats,
    quality
  });
}

function solveLinear3x3(
  rows: readonly [number, number, number][],
  values: readonly [number, number, number]
): readonly [number, number, number] | null {
  const matrix: [number, number, number, number][] = [
    [rows[0]![0], rows[0]![1], rows[0]![2], values[0]],
    [rows[1]![0], rows[1]![1], rows[1]![2], values[1]],
    [rows[2]![0], rows[2]![1], rows[2]![2], values[2]]
  ];

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let selectedPivotIndex = pivotIndex;

    for (let scanIndex = pivotIndex + 1; scanIndex < 3; scanIndex += 1) {
      const scanRow = matrix[scanIndex]!;
      const selectedRow = matrix[selectedPivotIndex]!;

      if (
        Math.abs(scanRow[pivotIndex] ?? 0) >
        Math.abs(selectedRow[pivotIndex] ?? 0)
      ) {
        selectedPivotIndex = scanIndex;
      }
    }

    const selectedPivotRow = matrix[selectedPivotIndex]!;
    const pivotValue = selectedPivotRow[pivotIndex] ?? 0;

    if (Math.abs(pivotValue) < 1e-8) {
      return null;
    }

    if (selectedPivotIndex !== pivotIndex) {
      const nextRow = matrix[pivotIndex]!;

      matrix[pivotIndex] = matrix[selectedPivotIndex]!;
      matrix[selectedPivotIndex] = nextRow;
    }

    const pivotRow = matrix[pivotIndex]!;
    const normalizationFactor = pivotRow[pivotIndex] ?? 1;

    for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
      const currentValue = pivotRow[columnIndex] ?? 0;

      pivotRow[columnIndex] = currentValue / normalizationFactor;
    }

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue;
      }

      const row = matrix[rowIndex]!;
      const eliminationFactor = row[pivotIndex] ?? 0;

      for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
        const currentValue = row[columnIndex] ?? 0;
        const pivotRowValue = pivotRow[columnIndex] ?? 0;

        row[columnIndex] = currentValue - eliminationFactor * pivotRowValue;
      }
    }
  }

  return Object.freeze([
    normalizeCoefficient(matrix[0]![3] ?? 0),
    normalizeCoefficient(matrix[1]![3] ?? 0),
    normalizeCoefficient(matrix[2]![3] ?? 0)
  ]) as readonly [number, number, number];
}

function fitObservedAxis(
  samples: readonly CalibrationShotSample[],
  targetSelector: (sample: CalibrationShotSample) => number
): readonly [number, number, number] | null {
  let sumXx = 0;
  let sumXy = 0;
  let sumX = 0;
  let sumYy = 0;
  let sumY = 0;
  let sumTarget = 0;
  let sumTargetX = 0;
  let sumTargetY = 0;

  for (const sample of samples) {
    const observedPoint = sample.observedPose.indexTip;
    const targetValue = targetSelector(sample);

    sumXx += observedPoint.x * observedPoint.x;
    sumXy += observedPoint.x * observedPoint.y;
    sumX += observedPoint.x;
    sumYy += observedPoint.y * observedPoint.y;
    sumY += observedPoint.y;
    sumTarget += targetValue;
    sumTargetX += observedPoint.x * targetValue;
    sumTargetY += observedPoint.y * targetValue;
  }

  return solveLinear3x3(
    [
      [sumXx, sumXy, sumX],
      [sumXy, sumYy, sumY],
      [sumX, sumY, samples.length]
    ],
    [sumTargetX, sumTargetY, sumTarget]
  );
}

function fitSnapshot(
  samples: readonly CalibrationShotSample[]
): AffineAimTransformSnapshot | null {
  if (samples.length < 3) {
    return null;
  }

  const xCoefficients = fitObservedAxis(
    samples,
    (sample) => sample.intendedTarget.x
  );
  const yCoefficients = fitObservedAxis(
    samples,
    (sample) => sample.intendedTarget.y
  );

  if (xCoefficients === null || yCoefficients === null) {
    return null;
  }

  return freezeAffineAimTransformSnapshot({
    xCoefficients,
    yCoefficients
  });
}

function scoreCandidateTransform(
  transformSnapshot: AffineAimTransformSnapshot,
  samples: readonly CalibrationShotSample[]
): AffineAimTransformCandidateScore {
  const inlierSamples: CalibrationShotSample[] = [];
  let maxResidual = 0;
  let totalResidual = 0;

  for (const sample of samples) {
    const residual = measureResidualDistance(transformSnapshot, sample);

    if (residual <= affineAimTransformFitConfig.inlierResidualMax) {
      inlierSamples.push(sample);
    }

    maxResidual = Math.max(maxResidual, residual);
    totalResidual += residual;
  }

  return {
    inlierSampleCount: inlierSamples.length,
    inlierSamples: Object.freeze(inlierSamples),
    maxResidual,
    meanResidual: samples.length === 0 ? 0 : totalResidual / samples.length,
    sampleCount: samples.length,
    transformSnapshot
  };
}

function isCandidateBetter(
  currentBest: AffineAimTransformCandidateScore | null,
  candidate: AffineAimTransformCandidateScore
): boolean {
  if (currentBest === null) {
    return true;
  }

  if (candidate.inlierSampleCount !== currentBest.inlierSampleCount) {
    return candidate.inlierSampleCount > currentBest.inlierSampleCount;
  }

  if (candidate.meanResidual !== currentBest.meanResidual) {
    return candidate.meanResidual < currentBest.meanResidual;
  }

  return candidate.maxResidual < currentBest.maxResidual;
}

export class AffineAimTransform {
  readonly #snapshot: AffineAimTransformSnapshot;

  private constructor(snapshot: AffineAimTransformSnapshot) {
    this.#snapshot = freezeAffineAimTransformSnapshot(snapshot);
  }

  static fromSnapshot(snapshot: AffineAimTransformSnapshot): AffineAimTransform {
    return new AffineAimTransform(snapshot);
  }

  static fit(
    samples: readonly CalibrationShotSample[]
  ): AffineAimTransform | null {
    const baselineSnapshot = fitSnapshot(samples);

    if (baselineSnapshot === null) {
      return null;
    }

    let bestCandidate = scoreCandidateTransform(baselineSnapshot, samples);

    for (let firstIndex = 0; firstIndex < samples.length - 2; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < samples.length - 1;
        secondIndex += 1
      ) {
        for (
          let thirdIndex = secondIndex + 1;
          thirdIndex < samples.length;
          thirdIndex += 1
        ) {
          const candidateSnapshot = fitSnapshot([
            samples[firstIndex]!,
            samples[secondIndex]!,
            samples[thirdIndex]!
          ]);

          if (candidateSnapshot === null) {
            continue;
          }

          const candidateScore = scoreCandidateTransform(candidateSnapshot, samples);

          if (isCandidateBetter(bestCandidate, candidateScore)) {
            bestCandidate = candidateScore;
          }
        }
      }
    }

    const refitSnapshot =
      fitSnapshot(
        bestCandidate.inlierSamples.length >= 3
          ? bestCandidate.inlierSamples
          : samples
      ) ?? bestCandidate.transformSnapshot;

    return new AffineAimTransform(refitSnapshot);
  }

  static summarizeFit(
    samples: readonly CalibrationShotSample[],
    transform: AffineAimTransform | AffineAimTransformSnapshot
  ): AffineAimTransformFitDiagnosticsSnapshot | null {
    if (samples.length === 0) {
      return null;
    }

    return createFitDiagnosticsSnapshot(
      transform instanceof AffineAimTransform ? transform.snapshot : transform,
      samples
    );
  }

  get snapshot(): AffineAimTransformSnapshot {
    return this.#snapshot;
  }

  projectUnclamped(
    observedPoint: NormalizedViewportPoint | NormalizedViewportPointInput
  ): NormalizedViewportPointInput {
    return projectWithSnapshot(this.#snapshot, observedPoint);
  }

  apply(
    observedPoint: NormalizedViewportPoint | NormalizedViewportPointInput
  ): NormalizedViewportPoint {
    return createNormalizedViewportPoint(this.projectUnclamped(observedPoint));
  }
}
