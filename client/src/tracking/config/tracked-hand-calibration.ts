import {
  createDegrees,
  createNormalizedViewportPoint
} from "@webgpu-metaverse/shared";

import type { TrackedHandCalibrationConfig } from "../types/tracked-hand-calibration";

export const trackedHandCalibrationConfig = {
  transformModel: "affine-2d",
  anchors: [
    {
      id: "center",
      label: "Center",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.5 })
    },
    {
      id: "top-left",
      label: "Top Left",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.1 })
    },
    {
      id: "top-right",
      label: "Top Right",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.1 })
    },
    {
      id: "bottom-left",
      label: "Bottom Left",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.9 })
    },
    {
      id: "bottom-right",
      label: "Bottom Right",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.9 })
    },
    {
      id: "top-center",
      label: "Top Center",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.1 })
    },
    {
      id: "mid-right",
      label: "Mid Right",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.9, y: 0.5 })
    },
    {
      id: "mid-left",
      label: "Mid Left",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.1, y: 0.5 })
    },
    {
      id: "bottom-center",
      label: "Bottom Center",
      normalizedTarget: createNormalizedViewportPoint({ x: 0.5, y: 0.9 })
    }
  ],
  triggerGesture: {
    pressAxisAngleDegrees: createDegrees(68),
    pressEngagementRatio: 0.72,
    releaseAxisAngleDegrees: createDegrees(72),
    releaseEngagementRatio: 0.95,
    calibration: {
      pressAxisWindowFraction: 0.4,
      pressEngagementWindowFraction: 0.4,
      releaseAxisWindowFraction: 0.82,
      releaseEngagementWindowFraction: 0.82
    }
  }
} as const satisfies TrackedHandCalibrationConfig;

export const cameraThumbTriggerGestureConfig =
  trackedHandCalibrationConfig.triggerGesture;
