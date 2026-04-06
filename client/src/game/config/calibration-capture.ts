import { firstPlayableWeaponDefinition } from "./weapon-manifest";
import type { CalibrationCaptureConfig } from "../types/calibration-session";

export const calibrationCaptureConfig = {
  triggerGesture: firstPlayableWeaponDefinition.triggerGesture
} as const satisfies CalibrationCaptureConfig;
