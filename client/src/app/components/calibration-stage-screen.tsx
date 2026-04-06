import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { PlayerProfile } from "@thumbshooter/shared";

import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { NinePointCalibrationSession } from "../../game/classes/nine-point-calibration-session";
import { handAimObservationConfig } from "../../game/config/hand-aim-observation";
import { gameFoundationConfig } from "../../game/config/game-foundation";
import { readObservedAimPoint } from "../../game/types/hand-aim-observation";
import type { HandTrackingPoseSnapshot } from "../../game/types/hand-tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ImmersiveStageFrame } from "./immersive-stage-frame";

interface CalibrationStageScreenProps {
  readonly handTrackingRuntime: HandTrackingRuntime;
  readonly onCalibrationProgress: (
    nextProfile: PlayerProfile,
    progress: "captured" | "completed"
  ) => void;
  readonly profile: PlayerProfile;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function resolveCaptureGuidance(input: {
  readonly captureState: string;
  readonly trackingState: string;
}): string {
  if (input.trackingState === "unavailable") {
    return "Keep the camera on.";
  }

  if (input.trackingState === "no-hand") {
    return "Move one hand into view.";
  }

  if (input.captureState === "ready-to-capture") {
    return "Hold on target, then drop your thumb.";
  }

  if (input.captureState === "release-trigger") {
    return "Release your thumb.";
  }

  if (input.captureState === "complete") {
    return "All nine samples are locked.";
  }

  return "Point at the target and settle.";
}

const indexDebugPointIds = [
  "indexBase",
  "indexKnuckle",
  "indexJoint",
  "indexTip"
] as const satisfies readonly (keyof HandTrackingPoseSnapshot)[];
const thumbDebugPointIds = [
  "thumbBase",
  "thumbKnuckle",
  "thumbJoint",
  "thumbTip"
] as const satisfies readonly (keyof HandTrackingPoseSnapshot)[];
const handDebugPointIds = [
  "thumbBase",
  "thumbKnuckle",
  "thumbJoint",
  "thumbTip",
  "indexBase",
  "indexKnuckle",
  "indexJoint",
  "indexTip"
] as const satisfies readonly (keyof HandTrackingPoseSnapshot)[];

function formatOverlayPolyline(
  pose: HandTrackingPoseSnapshot,
  pointIds: readonly (keyof HandTrackingPoseSnapshot)[]
): string {
  return pointIds
    .map((pointId) => `${pose[pointId].x * 100},${pose[pointId].y * 100}`)
    .join(" ");
}

function setOverlayPoint(
  node: SVGCircleElement | null | undefined,
  point: {
    readonly x: number;
    readonly y: number;
  }
): void {
  if (node == null) {
    return;
  }

  node.setAttribute("cx", String(point.x * 100));
  node.setAttribute("cy", String(point.y * 100));
}

export function CalibrationStageScreen({
  handTrackingRuntime,
  onCalibrationProgress,
  profile
}: CalibrationStageScreenProps) {
  const [session] = useState(
    () => new NinePointCalibrationSession(profile.snapshot.calibrationSamples)
  );
  const [captureSnapshot, setCaptureSnapshot] = useState(() => session.snapshot);
  const [runtimeLifecycle, setRuntimeLifecycle] = useState(
    handTrackingRuntime.snapshot.lifecycle
  );
  const [trackingState, setTrackingState] = useState(
    handTrackingRuntime.latestPose.trackingState
  );
  const [runtimeFailureReason, setRuntimeFailureReason] = useState<string | null>(
    handTrackingRuntime.snapshot.failureReason
  );
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const handOverlayRef = useRef<SVGSVGElement | null>(null);
  const profileRef = useRef(profile);
  const captureGuidance = resolveCaptureGuidance({
    captureState: captureSnapshot.captureState,
    trackingState
  });

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const handleCalibrationProgressEvent = useEffectEvent(
    (nextProfile: PlayerProfile, progress: "captured" | "completed") => {
      onCalibrationProgress(nextProfile, progress);
    }
  );

  const handleRetryRuntime = useEffectEvent(() => {
    handTrackingRuntime.dispose();
    setRuntimeLifecycle("idle");
    setTrackingState("unavailable");
    setRuntimeFailureReason(null);
    void handTrackingRuntime.ensureStarted().catch(() => {});
  });

  useEffect(() => {
    void handTrackingRuntime.ensureStarted().catch(() => {});
  }, [handTrackingRuntime]);

  useEffect(() => {
    let animationFrameHandle = 0;
    const handOverlay = handOverlayRef.current;
    const indexOverlay = handOverlay?.querySelector<SVGPolylineElement>(
      '[data-skeleton="index"]'
    );
    const thumbOverlay = handOverlay?.querySelector<SVGPolylineElement>(
      '[data-skeleton="thumb"]'
    );
    const thumbBasePoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="thumbBase"]'
    );
    const thumbKnucklePoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="thumbKnuckle"]'
    );
    const thumbJointPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="thumbJoint"]'
    );
    const thumbTipPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="thumbTip"]'
    );
    const indexBasePoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="indexBase"]'
    );
    const indexKnucklePoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="indexKnuckle"]'
    );
    const indexJointPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="indexJoint"]'
    );
    const indexTipPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="indexTip"]'
    );
    const observedAimPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="observedAimPoint"]'
    );

    const updateLoop = () => {
      const runtimeSnapshot = handTrackingRuntime.snapshot;
      const latestPose = handTrackingRuntime.latestPose;
      const cameraStream = handTrackingRuntime.cameraStream;

      setRuntimeLifecycle((currentValue) =>
        currentValue === runtimeSnapshot.lifecycle
          ? currentValue
          : runtimeSnapshot.lifecycle
      );
      setRuntimeFailureReason((currentValue) =>
        currentValue === runtimeSnapshot.failureReason
          ? currentValue
          : runtimeSnapshot.failureReason
      );
      setTrackingState((currentValue) =>
        currentValue === latestPose.trackingState
          ? currentValue
          : latestPose.trackingState
      );

      if (
        previewVideoRef.current !== null &&
        previewVideoRef.current.srcObject !== cameraStream
      ) {
        previewVideoRef.current.srcObject = cameraStream;
      }

      if (previewVideoRef.current !== null) {
        previewVideoRef.current.style.opacity = cameraStream === null ? "0" : "1";
      }

      if (handOverlay !== null) {
        if (latestPose.trackingState === "tracked") {
          handOverlay.style.opacity = "1";
          indexOverlay?.setAttribute(
            "points",
            formatOverlayPolyline(latestPose.pose, indexDebugPointIds)
          );
          thumbOverlay?.setAttribute(
            "points",
            formatOverlayPolyline(latestPose.pose, thumbDebugPointIds)
          );
          setOverlayPoint(thumbBasePoint, latestPose.pose.thumbBase);
          setOverlayPoint(thumbKnucklePoint, latestPose.pose.thumbKnuckle);
          setOverlayPoint(thumbJointPoint, latestPose.pose.thumbJoint);
          setOverlayPoint(thumbTipPoint, latestPose.pose.thumbTip);
          setOverlayPoint(indexBasePoint, latestPose.pose.indexBase);
          setOverlayPoint(indexKnucklePoint, latestPose.pose.indexKnuckle);
          setOverlayPoint(indexJointPoint, latestPose.pose.indexJoint);
          setOverlayPoint(indexTipPoint, latestPose.pose.indexTip);
          setOverlayPoint(
            observedAimPoint,
            readObservedAimPoint(latestPose.pose, handAimObservationConfig)
          );
        } else {
          handOverlay.style.opacity = "0";
        }
      }

      const nextProgress = session.ingestTrackingSnapshot(latestPose);

      if (nextProgress.capturedSample !== null) {
        let nextProfile = profileRef.current.withCalibrationShot(
          nextProgress.capturedSample
        );
        let progress: "captured" | "completed" = "captured";

        if (nextProgress.fittedCalibration !== null) {
          nextProfile = nextProfile.withAimCalibration(
            nextProgress.fittedCalibration
          );
          nextProfile = nextProfile.withTriggerCalibration(
            nextProgress.triggerCalibration
          );
          progress = "completed";
        }

        profileRef.current = nextProfile;
        handleCalibrationProgressEvent(nextProfile, progress);
      }

      if (nextProgress.didChange) {
        setCaptureSnapshot(session.snapshot);
      }

      animationFrameHandle = window.requestAnimationFrame(updateLoop);
    };

    animationFrameHandle = window.requestAnimationFrame(updateLoop);

    return () => {
      window.cancelAnimationFrame(animationFrameHandle);

      if (previewVideoRef.current !== null) {
        previewVideoRef.current.srcObject = null;
      }
    };
  }, [handleCalibrationProgressEvent, handTrackingRuntime, session]);

  return (
    <ImmersiveStageFrame className="bg-slate-950">
      <section className="relative min-h-0 flex-1 overflow-hidden">
        <video
          autoPlay
          className="absolute inset-0 h-full w-full"
          muted
          playsInline
          ref={previewVideoRef}
          style={{ objectFit: "fill", opacity: 0 }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgb(2 6 23 / 0.38)" }}
        />

        <div className="absolute left-3 top-3 z-10 max-w-xs rounded-[1.25rem] border border-white/10 bg-slate-950/78 p-4 backdrop-blur-md sm:left-4 sm:top-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Stage 3</Badge>
            <Badge variant="secondary">
              {`${captureSnapshot.capturedSampleCount}/${captureSnapshot.totalAnchorCount}`}
            </Badge>
            <Badge variant="outline">{runtimeLifecycle}</Badge>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">
            Nine-point calibration
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{captureGuidance}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.28em] text-slate-400">
            {`Hand ${trackingState}`}
          </p>

          {runtimeFailureReason !== null ? (
            <div className="mt-4 flex flex-col gap-3 rounded-[1rem] border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Tracking failed</p>
              <p className="text-sm leading-6 text-destructive">
                {runtimeFailureReason}
              </p>
              <Button onClick={handleRetryRuntime} type="button" variant="outline">
                Retry tracking
              </Button>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap justify-end gap-2 sm:inset-x-4 sm:top-4">
          <Badge variant="secondary">
            {captureSnapshot.currentAnchorLabel ?? "complete"}
          </Badge>
          <Badge variant="outline">{captureSnapshot.captureState}</Badge>
          <Badge variant="outline">
            {gameFoundationConfig.calibration.transformModel}
          </Badge>
        </div>

        {gameFoundationConfig.calibration.anchors.map((anchor, anchorIndex) => {
          const isCaptured = anchorIndex < captureSnapshot.capturedSampleCount;
          const isCurrent = captureSnapshot.currentAnchorId === anchor.id;

          return (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              key={anchor.id}
              style={{
                left: toPercent(anchor.normalizedTarget.x),
                top: toPercent(anchor.normalizedTarget.y)
              }}
            >
              <div
                className={[
                  "flex size-12 items-center justify-center rounded-full border text-xs font-semibold transition sm:size-14 sm:text-sm",
                  isCaptured
                    ? "border-emerald-300/80 bg-emerald-300/18 text-emerald-100"
                    : isCurrent
                      ? "border-sky-300 bg-sky-300/16 text-sky-100"
                      : "border-white/28 bg-white/6 text-white/72"
                ].join(" ")}
              >
                {anchorIndex + 1}
              </div>
            </div>
          );
        })}

        <svg
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity"
          preserveAspectRatio="none"
          ref={handOverlayRef}
          viewBox="0 0 100 100"
        >
          <polyline
            className="fill-none stroke-sky-300/80"
            data-skeleton="index"
            strokeWidth="0.42"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            className="fill-none stroke-amber-300/85"
            data-skeleton="thumb"
            strokeWidth="0.36"
            vectorEffect="non-scaling-stroke"
          />
          {handDebugPointIds.map((pointId) => (
            <circle
              className="fill-white/90"
              data-point={pointId}
              key={pointId}
              r="0.9"
            />
          ))}
          <circle
            className="fill-sky-300/90"
            data-point="observedAimPoint"
            r="1.05"
          />
        </svg>
      </section>
    </ImmersiveStageFrame>
  );
}
