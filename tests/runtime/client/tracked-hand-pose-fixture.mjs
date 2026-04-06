function interpolateScalar(startValue, endValue, amount) {
  return startValue + (endValue - startValue) * amount;
}

function interpolatePoint(openPoint, pressedPoint, triggerCurl) {
  return {
    x: interpolateScalar(openPoint.x, pressedPoint.x, triggerCurl),
    y: interpolateScalar(openPoint.y, pressedPoint.y, triggerCurl),
    z: interpolateScalar(openPoint.z, pressedPoint.z, triggerCurl)
  };
}

export function createTrackedHandPose(
  indexTipX,
  indexTipY,
  triggerCurl = 0
) {
  const normalizedTriggerCurl = Math.min(1, Math.max(0, triggerCurl));
  const openPose = {
    thumbBase: { x: indexTipX - 0.105, y: indexTipY + 0.1, z: 0.024 },
    thumbKnuckle: { x: indexTipX - 0.145, y: indexTipY + 0.075, z: 0.018 },
    thumbJoint: { x: indexTipX - 0.175, y: indexTipY + 0.048, z: 0.012 },
    thumbTip: { x: indexTipX - 0.205, y: indexTipY + 0.02, z: 0.006 },
    indexBase: { x: indexTipX - 0.015, y: indexTipY + 0.11, z: 0.03 },
    indexKnuckle: { x: indexTipX - 0.01, y: indexTipY + 0.075, z: 0.018 },
    indexJoint: { x: indexTipX - 0.005, y: indexTipY + 0.038, z: 0.008 },
    indexTip: { x: indexTipX, y: indexTipY, z: 0 }
  };
  const pressedPose = {
    thumbBase: { x: indexTipX - 0.078, y: indexTipY + 0.097, z: 0.02 },
    thumbKnuckle: { x: indexTipX - 0.06, y: indexTipY + 0.075, z: 0.014 },
    thumbJoint: { x: indexTipX - 0.045, y: indexTipY + 0.048, z: 0.009 },
    thumbTip: { x: indexTipX - 0.03, y: indexTipY + 0.022, z: 0.003 },
    indexBase: openPose.indexBase,
    indexKnuckle: openPose.indexKnuckle,
    indexJoint: openPose.indexJoint,
    indexTip: openPose.indexTip
  };

  return {
    thumbBase: interpolatePoint(
      openPose.thumbBase,
      pressedPose.thumbBase,
      normalizedTriggerCurl
    ),
    thumbKnuckle: interpolatePoint(
      openPose.thumbKnuckle,
      pressedPose.thumbKnuckle,
      normalizedTriggerCurl
    ),
    thumbJoint: interpolatePoint(
      openPose.thumbJoint,
      pressedPose.thumbJoint,
      normalizedTriggerCurl
    ),
    thumbTip: interpolatePoint(
      openPose.thumbTip,
      pressedPose.thumbTip,
      normalizedTriggerCurl
    ),
    indexBase: interpolatePoint(
      openPose.indexBase,
      pressedPose.indexBase,
      normalizedTriggerCurl
    ),
    indexKnuckle: interpolatePoint(
      openPose.indexKnuckle,
      pressedPose.indexKnuckle,
      normalizedTriggerCurl
    ),
    indexJoint: interpolatePoint(
      openPose.indexJoint,
      pressedPose.indexJoint,
      normalizedTriggerCurl
    ),
    indexTip: interpolatePoint(
      openPose.indexTip,
      pressedPose.indexTip,
      normalizedTriggerCurl
    )
  };
}

export function createTrackedHandSnapshot(
  sequenceNumber,
  indexTipX,
  indexTipY,
  triggerCurl = 0
) {
  return {
    trackingState: "tracked",
    sequenceNumber,
    timestampMs: sequenceNumber * 10,
    pose: createTrackedHandPose(indexTipX, indexTipY, triggerCurl)
  };
}
