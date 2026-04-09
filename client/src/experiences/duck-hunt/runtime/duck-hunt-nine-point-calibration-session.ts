import {
  AffineAimTransform,
  createCalibrationShotSample,
  createHandTriggerMetricSnapshot,
  type CalibrationShotSample
} from "@thumbshooter/shared";

import {
  duckHuntCalibrationCaptureConfig,
  duckHuntGameFoundationConfig
} from "../config";
import {
  evaluateHandTriggerGesture,
  summarizeHandTriggerCalibration
} from "../../../game/types/hand-trigger-gesture";
import type {
  CalibrationCaptureConfig,
  NinePointCalibrationAdvanceResult,
  NinePointCalibrationSnapshot
} from "../../../game/types/calibration-session";
import { handAimObservationConfig } from "../../../game/config/hand-aim-observation";
import { readObservedAimPoint } from "../../../game/types/hand-aim-observation";
import type { LatestHandTrackingSnapshot } from "../../../game/types/hand-tracking";

function createSnapshotKey(snapshot: NinePointCalibrationSnapshot): string {
  return [
    snapshot.captureState,
    snapshot.currentAnchorId ?? "none",
    snapshot.capturedSampleCount,
    snapshot.failureReason ?? "none"
  ].join(":");
}

function resumeCalibrationSamples(
  storedSamples: readonly CalibrationShotSample[]
): readonly CalibrationShotSample[] {
  const resumedSamples: CalibrationShotSample[] = [];
  const anchors = duckHuntGameFoundationConfig.calibration.anchors;

  for (const [index, sample] of storedSamples.entries()) {
    if (sample.anchorId !== anchors[index]?.id) {
      break;
    }

    resumedSamples.push(sample);
  }

  return Object.freeze(resumedSamples);
}

export class DuckHuntNinePointCalibrationSession {
  readonly #captureConfig: CalibrationCaptureConfig;
  readonly #storedSamples: CalibrationShotSample[];

  #captureState: NinePointCalibrationSnapshot["captureState"];
  #failureReason: string | null = null;
  #latestReadyTriggerMetrics: CalibrationShotSample["readyTriggerMetrics"] = null;
  #triggerHeld = false;

  constructor(
    storedSamples: readonly CalibrationShotSample[] = [],
    captureConfig: CalibrationCaptureConfig = duckHuntCalibrationCaptureConfig
  ) {
    this.#captureConfig = captureConfig;
    this.#storedSamples = [...resumeCalibrationSamples(storedSamples)];
    this.#captureState =
      this.#storedSamples.length >= duckHuntGameFoundationConfig.calibration.anchors.length
        ? "complete"
        : "waiting-for-hand";
  }

  get snapshot(): NinePointCalibrationSnapshot {
    const currentAnchor =
      duckHuntGameFoundationConfig.calibration.anchors[this.#storedSamples.length] ??
      null;

    return Object.freeze({
      captureState: this.#captureState,
      currentAnchorId: currentAnchor?.id ?? null,
      currentAnchorLabel: currentAnchor?.label ?? null,
      capturedSampleCount: this.#storedSamples.length,
      failureReason: this.#failureReason,
      totalAnchorCount: duckHuntGameFoundationConfig.calibration.anchors.length
    });
  }

  ingestTrackingSnapshot(
    trackingSnapshot: LatestHandTrackingSnapshot
  ): NinePointCalibrationAdvanceResult {
    const previousSnapshotKey = createSnapshotKey(this.snapshot);

    if (this.#captureState === "complete" || this.#captureState === "failed") {
      return {
        didChange: false,
        capturedSample: null,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    if (trackingSnapshot.trackingState !== "tracked") {
      this.#triggerHeld = false;
      this.#latestReadyTriggerMetrics = null;
      this.#captureState = "waiting-for-hand";

      return {
        didChange: previousSnapshotKey !== createSnapshotKey(this.snapshot),
        capturedSample: null,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    const triggerGesture = evaluateHandTriggerGesture(
      trackingSnapshot.pose,
      this.#triggerHeld,
      this.#captureConfig.triggerGesture
    );
    const nextTriggerHeld = triggerGesture.triggerPressed;

    if (!nextTriggerHeld) {
      this.#triggerHeld = false;
      this.#captureState = triggerGesture.triggerReady
        ? "ready-to-capture"
        : "release-trigger";
      if (triggerGesture.triggerReady) {
        this.#latestReadyTriggerMetrics = createHandTriggerMetricSnapshot({
          axisAngleDegrees: triggerGesture.axisAngleDegrees,
          engagementRatio: triggerGesture.engagementRatio
        });
      }

      return {
        didChange: previousSnapshotKey !== createSnapshotKey(this.snapshot),
        capturedSample: null,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    if (this.#triggerHeld) {
      this.#captureState = "release-trigger";

      return {
        didChange: previousSnapshotKey !== createSnapshotKey(this.snapshot),
        capturedSample: null,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    this.#triggerHeld = true;

    const currentAnchor =
      duckHuntGameFoundationConfig.calibration.anchors[this.#storedSamples.length];

    if (currentAnchor === undefined) {
      this.#captureState = "failed";
      this.#failureReason = "Calibration capture advanced past the supported anchor count.";

      return {
        didChange: previousSnapshotKey !== createSnapshotKey(this.snapshot),
        capturedSample: null,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    const capturedSample = createCalibrationShotSample({
      anchorId: currentAnchor.id,
      intendedTarget: currentAnchor.normalizedTarget,
      observedPose: {
        thumbTip: trackingSnapshot.pose.thumbTip,
        indexTip: trackingSnapshot.pose.indexTip,
        aimPoint: readObservedAimPoint(
          trackingSnapshot.pose,
          handAimObservationConfig
        )
      },
      pressedTriggerMetrics: {
        axisAngleDegrees: triggerGesture.axisAngleDegrees,
        engagementRatio: triggerGesture.engagementRatio
      },
      readyTriggerMetrics: this.#latestReadyTriggerMetrics
    });

    this.#storedSamples.push(capturedSample);
    this.#latestReadyTriggerMetrics = null;
    this.#captureState = "release-trigger";

    if (
      this.#storedSamples.length <
      duckHuntGameFoundationConfig.calibration.anchors.length
    ) {
      return {
        didChange: true,
        capturedSample,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    const fittedCalibration = AffineAimTransform.fit(this.#storedSamples);

    if (fittedCalibration === null) {
      this.#captureState = "failed";
      this.#failureReason =
        "The affine calibration fit could not be solved from the captured samples.";

      return {
        didChange: true,
        capturedSample,
        fittedCalibration: null,
        triggerCalibration: null
      };
    }

    this.#captureState = "complete";
    this.#failureReason = null;

    return {
      didChange: true,
      capturedSample,
      fittedCalibration: fittedCalibration.snapshot,
      triggerCalibration: summarizeHandTriggerCalibration(this.#storedSamples)
    };
  }
}
