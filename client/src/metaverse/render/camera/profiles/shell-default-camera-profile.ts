export interface MetaverseCameraProfileSnapshot {
  readonly followDistanceUnits: number;
  readonly fovDegrees: number;
  readonly id: string;
  readonly label: string;
  readonly lookPitchLimitDegrees: number;
}

export const shellDefaultCameraProfile = Object.freeze({
  followDistanceUnits: 4.8,
  fovDegrees: 62,
  id: "shell-default-camera",
  label: "Shell Default Camera",
  lookPitchLimitDegrees: 62
} satisfies MetaverseCameraProfileSnapshot);
