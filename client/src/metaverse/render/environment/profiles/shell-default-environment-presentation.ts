export interface MetaverseEnvironmentPresentationProfileSnapshot {
  readonly environment: {
    readonly domeRadius: number;
    readonly fogColor: readonly [number, number, number];
    readonly fogDensity: number;
    readonly horizonColor: readonly [number, number, number];
    readonly sunColor: readonly [number, number, number];
    readonly sunDirection: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly zenithColor: readonly [number, number, number];
  };
  readonly id: string;
  readonly label: string;
  readonly ocean: {
    readonly emissiveColor: readonly [number, number, number];
    readonly farColor: readonly [number, number, number];
    readonly height: number;
    readonly nearColor: readonly [number, number, number];
    readonly planeDepth: number;
    readonly planeWidth: number;
    readonly roughness: number;
    readonly segmentCount: number;
    readonly waveAmplitude: number;
    readonly waveFrequencies: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
    readonly waveSpeeds: {
      readonly primary: number;
      readonly ripple: number;
      readonly secondary: number;
    };
  };
}

export function createMetaverseEnvironmentPresentationRgbTuple(
  red: number,
  green: number,
  blue: number
): readonly [number, number, number] {
  return Object.freeze([red, green, blue]);
}

export function createMetaverseEnvironmentPresentationVector3(
  x: number,
  y: number,
  z: number
): Readonly<{
  x: number;
  y: number;
  z: number;
}> {
  return Object.freeze({ x, y, z });
}

export const shellDefaultEnvironmentPresentationProfile = Object.freeze({
  environment: Object.freeze({
    domeRadius: 360,
    fogColor: createMetaverseEnvironmentPresentationRgbTuple(0.63, 0.76, 0.88),
    fogDensity: 0.0023,
    horizonColor: createMetaverseEnvironmentPresentationRgbTuple(
      0.74,
      0.87,
      0.97
    ),
    sunColor: createMetaverseEnvironmentPresentationRgbTuple(1, 0.91, 0.74),
    sunDirection: createMetaverseEnvironmentPresentationVector3(
      -0.38,
      0.79,
      -0.48
    ),
    zenithColor: createMetaverseEnvironmentPresentationRgbTuple(0.08, 0.2, 0.38)
  }),
  id: "shell-default-environment-presentation",
  label: "Shell Default Environment",
  ocean: Object.freeze({
    emissiveColor: createMetaverseEnvironmentPresentationRgbTuple(
      0.08,
      0.28,
      0.37
    ),
    farColor: createMetaverseEnvironmentPresentationRgbTuple(0.05, 0.22, 0.34),
    height: 0,
    nearColor: createMetaverseEnvironmentPresentationRgbTuple(0.12, 0.45, 0.58),
    planeDepth: 72,
    planeWidth: 72,
    roughness: 0.16,
    segmentCount: 96,
    waveAmplitude: 0.32,
    waveFrequencies: Object.freeze({
      primary: 0.11,
      ripple: 0.38,
      secondary: 0.18
    }),
    waveSpeeds: Object.freeze({
      primary: 0.62,
      ripple: 1.28,
      secondary: 0.87
    })
  })
} satisfies MetaverseEnvironmentPresentationProfileSnapshot);
