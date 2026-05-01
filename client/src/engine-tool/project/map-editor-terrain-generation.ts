import {
  metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians,
  type MetaverseMapBundleSemanticMaterialId
} from "@webgpu-metaverse/shared/metaverse/world";

import type {
  MapEditorTerrainPatchDraftSnapshot
} from "./map-editor-project-semantic-drafts";

export interface MapEditorTerrainMaterialBandSnapshot {
  readonly edgeFadeMeters: number;
  readonly materialId: MetaverseMapBundleSemanticMaterialId;
  readonly maxHeightMeters: number;
  readonly minHeightMeters: number;
}

export interface MapEditorTerrainGenerationConfigSnapshot {
  readonly frequency: number;
  readonly groundElevationMeters: number;
  readonly materialBands:
    readonly MapEditorTerrainMaterialBandSnapshot[];
  readonly maxElevationMeters: number;
  readonly maxSlopeDegrees: number;
  readonly minElevationMeters: number;
  readonly octaves: number;
  readonly seed: number;
  readonly warpFrequency: number;
  readonly warpStrengthMeters: number;
}

const defaultMapEditorTerrainGenerationMaxSlopeDegrees =
  Math.round(
    (metaverseWorldSurfaceDefaultMaxWalkableSlopeAngleRadians * 180) /
      Math.PI *
      10
  ) / 10;

export const defaultMapEditorTerrainGenerationConfig =
  Object.freeze<MapEditorTerrainGenerationConfigSnapshot>({
    frequency: 0.08,
    groundElevationMeters: 0,
    materialBands: Object.freeze([
      Object.freeze({
        edgeFadeMeters: 0.8,
        materialId: "terrain-sand",
        maxHeightMeters: 0.2,
        minHeightMeters: Number.NEGATIVE_INFINITY
      }),
      Object.freeze({
        edgeFadeMeters: 1,
        materialId: "terrain-dirt",
        maxHeightMeters: 1.8,
        minHeightMeters: -0.4
      }),
      Object.freeze({
        edgeFadeMeters: 1.2,
        materialId: "terrain-grass",
        maxHeightMeters: 4.2,
        minHeightMeters: -0.1
      }),
      Object.freeze({
        edgeFadeMeters: 1.4,
        materialId: "terrain-cliff",
        maxHeightMeters: Number.POSITIVE_INFINITY,
        minHeightMeters: Number.NEGATIVE_INFINITY
      }),
      Object.freeze({
        edgeFadeMeters: 1.4,
        materialId: "terrain-rock",
        maxHeightMeters: 7.2,
        minHeightMeters: 2.6
      }),
      Object.freeze({
        edgeFadeMeters: 1.6,
        materialId: "terrain-snow",
        maxHeightMeters: Number.POSITIVE_INFINITY,
        minHeightMeters: 6
      })
    ]),
    maxElevationMeters: 8,
    maxSlopeDegrees: defaultMapEditorTerrainGenerationMaxSlopeDegrees,
    minElevationMeters: -8,
    octaves: 5,
    seed: 1337,
    warpFrequency: 0.22,
    warpStrengthMeters: 8
  });

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function roundHeightMeters(heightMeters: number): number {
  return Math.round(heightMeters * 100) / 100;
}

function hashGridNoise(x: number, z: number, seed: number): number {
  const value =
    Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;

  return (value - Math.floor(value)) * 2 - 1;
}

function sampleValueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xBlend = fade(x - x0);
  const zBlend = fade(z - z0);
  const top =
    hashGridNoise(x0, z0, seed) * (1 - xBlend) +
    hashGridNoise(x0 + 1, z0, seed) * xBlend;
  const bottom =
    hashGridNoise(x0, z0 + 1, seed) * (1 - xBlend) +
    hashGridNoise(x0 + 1, z0 + 1, seed) * xBlend;

  return top * (1 - zBlend) + bottom * zBlend;
}

function sampleFractalNoise(
  x: number,
  z: number,
  seed: number,
  octaves: number
): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let maxAmplitude = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += sampleValueNoise(x * frequency, z * frequency, seed + octave * 101) *
      amplitude;
    maxAmplitude += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return maxAmplitude <= 0 ? 0 : total / maxAmplitude;
}

function resolveBandWeight(
  heightMeters: number,
  band: MapEditorTerrainMaterialBandSnapshot
): number {
  const fadeMeters = Math.max(0.001, band.edgeFadeMeters);
  const minFade =
    band.minHeightMeters === Number.NEGATIVE_INFINITY
      ? 1
      : clamp((heightMeters - band.minHeightMeters) / fadeMeters, 0, 1);
  const maxFade =
    band.maxHeightMeters === Number.POSITIVE_INFINITY
      ? 1
      : clamp((band.maxHeightMeters - heightMeters) / fadeMeters, 0, 1);

  return minFade * maxFade;
}

function resolveSlopeWeight(
  heights: readonly number[],
  sampleCountX: number,
  sampleCountZ: number,
  sampleX: number,
  sampleZ: number
): number {
  const center = heights[sampleZ * sampleCountX + sampleX] ?? 0;
  const left = heights[sampleZ * sampleCountX + Math.max(0, sampleX - 1)] ?? center;
  const right =
    heights[sampleZ * sampleCountX + Math.min(sampleCountX - 1, sampleX + 1)] ??
    center;
  const top = heights[Math.max(0, sampleZ - 1) * sampleCountX + sampleX] ?? center;
  const bottom =
    heights[Math.min(sampleCountZ - 1, sampleZ + 1) * sampleCountX + sampleX] ??
    center;

  return clamp((Math.abs(right - left) + Math.abs(bottom - top)) * 0.25, 0, 1);
}

function createGeneratedMaterialLayers(
  draft: MapEditorTerrainPatchDraftSnapshot,
  config: MapEditorTerrainGenerationConfigSnapshot,
  heights: readonly number[]
): MapEditorTerrainPatchDraftSnapshot["materialLayers"] {
  const materialIds = Object.freeze(
    [...new Set(config.materialBands.map((band) => band.materialId))]
  );
  const weightsByMaterialId = new Map<MetaverseMapBundleSemanticMaterialId, number[]>(
    materialIds.map((materialId) => [
      materialId,
      Array.from({ length: heights.length }, () => 0)
    ])
  );

  for (let sampleZ = 0; sampleZ < draft.sampleCountZ; sampleZ += 1) {
    for (let sampleX = 0; sampleX < draft.sampleCountX; sampleX += 1) {
      const sampleIndex = sampleZ * draft.sampleCountX + sampleX;
      const heightMeters = heights[sampleIndex] ?? 0;
      const slopeWeight = resolveSlopeWeight(
        heights,
        draft.sampleCountX,
        draft.sampleCountZ,
        sampleX,
        sampleZ
      );
      let totalWeight = 0;

      for (const band of config.materialBands) {
        const materialWeights = weightsByMaterialId.get(band.materialId);

        if (materialWeights === undefined) {
          continue;
        }

        const slopeBoost =
          band.materialId === "terrain-rock" ||
          band.materialId === "terrain-cliff"
            ? slopeWeight
            : 0;
        const baseBandWeight =
          band.materialId === "terrain-cliff"
            ? 0
            : resolveBandWeight(heightMeters, band);
        const bandWeight = Math.max(
          materialWeights[sampleIndex] ?? 0,
          baseBandWeight + slopeBoost
        );

        materialWeights[sampleIndex] = bandWeight;
        totalWeight += bandWeight;
      }

      if (totalWeight <= 0) {
        const fallbackWeights = weightsByMaterialId.get("terrain-grass");

        if (fallbackWeights !== undefined) {
          fallbackWeights[sampleIndex] = 1;
        }
      }
    }
  }

  return Object.freeze(
    [...weightsByMaterialId.entries()].map(([materialId, weightSamples]) =>
      Object.freeze({
        layerId: `${draft.terrainPatchId}:${materialId}`,
        materialId,
        weightSamples: Object.freeze(
          weightSamples.map((weight) => Math.round(clamp(weight, 0, 1) * 1000) / 1000)
        )
      })
    )
  );
}

function resolveRoundedTerrainWorldHeightMeters(
  normalizedHeight: number,
  minElevationMeters: number,
  groundElevationMeters: number,
  maxElevationMeters: number
): number {
  const elevationRangeMeters = maxElevationMeters - minElevationMeters;

  if (elevationRangeMeters <= 0.001) {
    return minElevationMeters;
  }

  const clampedGroundElevationMeters = clamp(
    groundElevationMeters,
    minElevationMeters,
    maxElevationMeters
  );
  const groundAlpha =
    (clampedGroundElevationMeters - minElevationMeters) /
    elevationRangeMeters;
  const lowerAlpha = Math.max(0, groundAlpha);
  const upperAlpha = Math.max(0, 1 - groundAlpha);
  const plateauHalfWidth = Math.min(
    0.16,
    Math.max(0, lowerAlpha * 0.68),
    Math.max(0, upperAlpha * 0.68)
  );

  if (normalizedHeight < groundAlpha - plateauHalfWidth) {
    const lowerT = clamp(
      (groundAlpha - plateauHalfWidth - normalizedHeight) /
        Math.max(0.001, lowerAlpha - plateauHalfWidth),
      0,
      1
    );

    return (
      clampedGroundElevationMeters -
      (clampedGroundElevationMeters - minElevationMeters) * fade(lowerT)
    );
  }

  if (normalizedHeight > groundAlpha + plateauHalfWidth) {
    const upperT = clamp(
      (normalizedHeight - groundAlpha - plateauHalfWidth) /
        Math.max(0.001, upperAlpha - plateauHalfWidth),
      0,
      1
    );

    return (
      clampedGroundElevationMeters +
      (maxElevationMeters - clampedGroundElevationMeters) * fade(upperT)
    );
  }

  const plateauT =
    plateauHalfWidth <= 0
      ? 0
      : (normalizedHeight - groundAlpha) / plateauHalfWidth;

  return clampedGroundElevationMeters + plateauT * elevationRangeMeters * 0.015;
}

function limitTerrainSlopeHeightSamples(
  heightSamples: readonly number[],
  sampleCountX: number,
  sampleCountZ: number,
  sampleSpacingMeters: number,
  maxSlopeDegrees: number
): readonly number[] {
  const normalizedMaxSlopeDegrees = clamp(maxSlopeDegrees, 1, 89);
  const maxAdjacentRiseMeters =
    Math.tan(normalizedMaxSlopeDegrees * (Math.PI / 180)) *
    Math.max(0.001, sampleSpacingMeters);
  const nextHeightSamples = [...heightSamples];
  const maxPassCount = Math.max(sampleCountX, sampleCountZ) * 2;

  for (let passIndex = 0; passIndex < maxPassCount; passIndex += 1) {
    let didChange = false;

    for (let sampleZ = 0; sampleZ < sampleCountZ; sampleZ += 1) {
      for (let sampleX = 0; sampleX < sampleCountX; sampleX += 1) {
        const sampleIndex = sampleZ * sampleCountX + sampleX;
        const neighborIndices = [
          sampleX + 1 < sampleCountX ? sampleIndex + 1 : -1,
          sampleZ + 1 < sampleCountZ ? sampleIndex + sampleCountX : -1
        ];

        for (const neighborIndex of neighborIndices) {
          if (neighborIndex < 0) {
            continue;
          }

          const currentHeight = nextHeightSamples[sampleIndex] ?? 0;
          const neighborHeight = nextHeightSamples[neighborIndex] ?? 0;

          if (currentHeight > neighborHeight + maxAdjacentRiseMeters) {
            nextHeightSamples[sampleIndex] = roundHeightMeters(
              neighborHeight + maxAdjacentRiseMeters
            );
            didChange = true;
          } else if (neighborHeight > currentHeight + maxAdjacentRiseMeters) {
            nextHeightSamples[neighborIndex] = roundHeightMeters(
              currentHeight + maxAdjacentRiseMeters
            );
            didChange = true;
          }
        }
      }
    }

    if (!didChange) {
      break;
    }
  }

  return Object.freeze(nextHeightSamples.map(roundHeightMeters));
}

export function bakeMapEditorProceduralTerrainPatch(
  draft: MapEditorTerrainPatchDraftSnapshot,
  config: MapEditorTerrainGenerationConfigSnapshot
): MapEditorTerrainPatchDraftSnapshot {
  const octaves = Math.max(1, Math.min(8, Math.round(config.octaves)));
  const frequency = Math.max(0.001, config.frequency);
  const groundElevationMeters = config.groundElevationMeters;
  const warpFrequency = Math.max(0.001, config.warpFrequency);
  const minElevationMeters = Math.min(
    config.minElevationMeters,
    config.maxElevationMeters
  );
  const maxElevationMeters = Math.max(
    config.minElevationMeters,
    config.maxElevationMeters
  );
  const maxSlopeDegrees = clamp(config.maxSlopeDegrees, 1, 89);
  const warpStrengthMeters = Math.max(0, config.warpStrengthMeters);
  const halfX = (draft.sampleCountX - 1) * 0.5;
  const halfZ = (draft.sampleCountZ - 1) * 0.5;
  const heights = Array.from(
    { length: draft.sampleCountX * draft.sampleCountZ },
    (_entry, sampleIndex) => {
      const sampleX = sampleIndex % draft.sampleCountX;
      const sampleZ = Math.floor(sampleIndex / draft.sampleCountX);
      const worldX =
        draft.origin.x + (sampleX - halfX) * draft.sampleSpacingMeters;
      const worldZ =
        draft.origin.z + (sampleZ - halfZ) * draft.sampleSpacingMeters;
      const warpX =
        sampleFractalNoise(worldX * warpFrequency, worldZ * warpFrequency, config.seed + 17, 2) *
        warpStrengthMeters;
      const warpZ =
        sampleFractalNoise(worldX * warpFrequency, worldZ * warpFrequency, config.seed + 53, 2) *
        warpStrengthMeters;
      const terrainNoise = sampleFractalNoise(
        (worldX + warpX) * frequency,
        (worldZ + warpZ) * frequency,
        config.seed,
        octaves
      );
      const shapedNoise =
        Math.sign(terrainNoise) * Math.pow(Math.abs(terrainNoise), 1.45);
      const normalizedHeight = (shapedNoise + 1) * 0.5;
      const worldHeightMeters = resolveRoundedTerrainWorldHeightMeters(
        normalizedHeight,
        minElevationMeters,
        groundElevationMeters,
        maxElevationMeters
      );
      const localHeightMeters = worldHeightMeters - groundElevationMeters;

      return roundHeightMeters(localHeightMeters);
    }
  );
  const slopeLimitedHeights = limitTerrainSlopeHeightSamples(
    heights,
    draft.sampleCountX,
    draft.sampleCountZ,
    draft.sampleSpacingMeters,
    maxSlopeDegrees
  );

  return Object.freeze({
    ...draft,
    heightSamples: slopeLimitedHeights,
    materialLayers: createGeneratedMaterialLayers(
      draft,
      config,
      slopeLimitedHeights
    ),
    origin: Object.freeze({
      ...draft.origin,
      y: groundElevationMeters
    }),
    waterLevelMeters: null
  });
}
