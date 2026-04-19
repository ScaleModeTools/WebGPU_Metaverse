import {
  createMetaverseEnvironmentPresentationRgbTuple,
  createMetaverseEnvironmentPresentationVector3,
  type MetaverseEnvironmentPresentationProfileSnapshot
} from "./shell-default-environment-presentation";

export const shellGoldenHourEnvironmentPresentationProfile = Object.freeze({
  environment: Object.freeze({
    domeRadius: 380,
    fogColor: createMetaverseEnvironmentPresentationRgbTuple(0.78, 0.6, 0.48),
    fogDensity: 0.0031,
    horizonColor: createMetaverseEnvironmentPresentationRgbTuple(
      0.94,
      0.67,
      0.47
    ),
    sunColor: createMetaverseEnvironmentPresentationRgbTuple(1, 0.78, 0.56),
    sunDirection: createMetaverseEnvironmentPresentationVector3(
      -0.24,
      0.42,
      -0.62
    ),
    zenithColor: createMetaverseEnvironmentPresentationRgbTuple(0.18, 0.19, 0.34)
  }),
  id: "shell-golden-hour-environment-presentation",
  label: "Shell Golden Hour Environment",
  ocean: Object.freeze({
    emissiveColor: createMetaverseEnvironmentPresentationRgbTuple(
      0.17,
      0.16,
      0.24
    ),
    farColor: createMetaverseEnvironmentPresentationRgbTuple(0.18, 0.21, 0.33),
    height: 0,
    nearColor: createMetaverseEnvironmentPresentationRgbTuple(0.34, 0.41, 0.58),
    planeDepth: 72,
    planeWidth: 72,
    roughness: 0.22,
    segmentCount: 96,
    waveAmplitude: 0.26,
    waveFrequencies: Object.freeze({
      primary: 0.09,
      ripple: 0.29,
      secondary: 0.14
    }),
    waveSpeeds: Object.freeze({
      primary: 0.43,
      ripple: 0.94,
      secondary: 0.63
    })
  })
} satisfies MetaverseEnvironmentPresentationProfileSnapshot);
