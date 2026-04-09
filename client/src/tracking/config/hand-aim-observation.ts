import type { HandAimObservationConfig } from "../types/hand-aim-observation";

export const handAimObservationConfig = {
  aimAnchor: {
    indexKnuckleWeight: 0.1,
    indexJointWeight: 0.25,
    indexTipWeight: 0.65
  },
  indexDirection: {
    fullChainWeight: 0.15,
    midSegmentWeight: 0.3,
    tipSegmentWeight: 0.55
  },
  thumbReference: {
    thumbBaseWeight: 0.7,
    thumbKnuckleWeight: 0.3
  },
  forwardProjectionDistanceMultiplier: 0.75,
  thumbSideOffsetDistanceMultiplier: 0.18
} as const satisfies HandAimObservationConfig;
