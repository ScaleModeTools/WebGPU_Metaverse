import { duckHuntFirstPlayableWeaponDefinition } from "./duck-hunt-weapon-manifest";
import type { CalibrationCaptureConfig } from "../../../game/types/calibration-session";

export const duckHuntCalibrationCaptureConfig = {
  triggerGesture: duckHuntFirstPlayableWeaponDefinition.triggerGesture
} as const satisfies CalibrationCaptureConfig;
