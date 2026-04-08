import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import type { PlayerProfile } from "@thumbshooter/shared";

import {
  calibrationCaptureOmittedLandmarkIds,
  calibrationOverlayLandmarkIds,
  createCalibrationPoseCapture,
  createCalibrationPoseCaptureExport,
  type CalibrationPoseCaptureSnapshot
} from "../types/calibration-pose-capture";
import { HandTrackingRuntime } from "../../game/classes/hand-tracking-runtime";
import { NinePointCalibrationSession } from "../../game/classes/nine-point-calibration-session";
import { handAimObservationConfig } from "../../game/config/hand-aim-observation";
import { gameFoundationConfig } from "../../game/config/game-foundation";
import { readObservedAimPoint } from "../../game/types/hand-aim-observation";
import type {
  HandTrackingPoseSnapshot,
  TrackedHandTrackingSnapshot
} from "../../game/types/hand-tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ImmersiveStageFrame } from "./immersive-stage-frame";

const calibrationPreviewMirrored = true;
const calibrationPreviewFitMode = "cover";

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

function formatOverlayPolyline(
  pose: HandTrackingPoseSnapshot,
  pointIds: readonly (keyof HandTrackingPoseSnapshot)[],
  videoWidthPx: number,
  videoHeightPx: number
): string {
  return pointIds
    .map((pointId) => {
      return `${pose[pointId].x * videoWidthPx},${pose[pointId].y * videoHeightPx}`;
    })
    .join(" ");
}

function setOverlayPoint(
  node: SVGCircleElement | null | undefined,
  point: {
    readonly x: number;
    readonly y: number;
  },
  videoWidthPx: number,
  videoHeightPx: number
): void {
  if (node == null) {
    return;
  }

  node.setAttribute("cx", String(point.x * videoWidthPx));
  node.setAttribute("cy", String(point.y * videoHeightPx));
}

function resolveCalibrationOverlayPreserveAspectRatio(
  fitMode: "contain" | "cover"
): "xMidYMid meet" | "xMidYMid slice" {
  return fitMode === "cover" ? "xMidYMid slice" : "xMidYMid meet";
}

function downloadCalibrationPoseCaptureExport(content: string): void {
  const fileBlob = new Blob([content], { type: "application/json" });
  const objectUrl = URL.createObjectURL(fileBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = `calibration-pose-captures-${Date.now()}.json`;
  downloadLink.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
  const [poseCaptureLabel, setPoseCaptureLabel] = useState("custom");
  const [poseCaptureSamples, setPoseCaptureSamples] = useState<
    readonly CalibrationPoseCaptureSnapshot[]
  >([]);
  const [poseCaptureStatus, setPoseCaptureStatus] = useState(
    "Tracking-ready samples export here."
  );
  const previewViewportRef = useRef<HTMLElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const handOverlayRef = useRef<SVGSVGElement | null>(null);
  const latestTrackedSnapshotRef = useRef<TrackedHandTrackingSnapshot | null>(null);
  const profileRef = useRef(profile);
  const captureGuidance = resolveCaptureGuidance({
    captureState: captureSnapshot.captureState,
    trackingState
  });
  const poseCaptureExportJson = useMemo(
    () =>
      JSON.stringify(
        createCalibrationPoseCaptureExport(poseCaptureSamples),
        null,
        2
      ),
    [poseCaptureSamples]
  );

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

  function appendPoseCaptureSample(label: string): void {
    const trackedSnapshot = latestTrackedSnapshotRef.current;

    if (trackedSnapshot === null) {
      setPoseCaptureStatus("Wait for a tracked hand before capturing JSON.");
      return;
    }

    const nextSample = createCalibrationPoseCapture(label, trackedSnapshot);

    setPoseCaptureSamples((currentSamples) => [...currentSamples, nextSample]);
    setPoseCaptureStatus(`Captured "${nextSample.label}".`);
  }

  async function copyPoseCaptureExport(): Promise<void> {
    if (poseCaptureSamples.length === 0) {
      setPoseCaptureStatus("Capture at least one sample before copying JSON.");
      return;
    }

    if (navigator.clipboard?.writeText === undefined) {
      setPoseCaptureStatus("Clipboard export is unavailable in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(poseCaptureExportJson);
      setPoseCaptureStatus("Copied pose capture JSON.");
    } catch {
      setPoseCaptureStatus("Copy failed. Use download instead.");
    }
  }

  function downloadPoseCaptureExport(): void {
    if (poseCaptureSamples.length === 0) {
      setPoseCaptureStatus("Capture at least one sample before downloading JSON.");
      return;
    }

    downloadCalibrationPoseCaptureExport(poseCaptureExportJson);
    setPoseCaptureStatus("Downloaded pose capture JSON.");
  }

  function clearPoseCaptureExport(): void {
    setPoseCaptureSamples([]);
    setPoseCaptureStatus("Cleared captured pose samples.");
  }

  useEffect(() => {
    let animationFrameHandle = 0;
    const handOverlay = handOverlayRef.current;
    const indexOverlay = handOverlay?.querySelector<SVGPolylineElement>(
      '[data-skeleton="index"]'
    );
    const thumbOverlay = handOverlay?.querySelector<SVGPolylineElement>(
      '[data-skeleton="thumb"]'
    );
    const overlayPoints = new Map<
      (typeof calibrationOverlayLandmarkIds.capture)[number],
      SVGCircleElement | null
    >(
      calibrationOverlayLandmarkIds.capture.map((pointId) => [
        pointId,
        handOverlay?.querySelector<SVGCircleElement>(`[data-point="${pointId}"]`) ??
          null
      ])
    );
    const observedAimPoint = handOverlay?.querySelector<SVGCircleElement>(
      '[data-point="observedAimPoint"]'
    );

    const updateLoop = () => {
      const runtimeSnapshot = handTrackingRuntime.snapshot;
      const latestPose = handTrackingRuntime.latestPose;
      const cameraStream = handTrackingRuntime.cameraStream;
      const previewVideo = previewVideoRef.current;
      const previewVideoWidthPx = previewVideo?.videoWidth ?? 0;
      const previewVideoHeightPx = previewVideo?.videoHeight ?? 0;
      const hasPreviewVideoDimensions =
        previewVideoWidthPx > 0 && previewVideoHeightPx > 0;
      latestTrackedSnapshotRef.current =
        latestPose.trackingState === "tracked" ? latestPose : null;

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

      if (previewVideo !== null && previewVideo.srcObject !== cameraStream) {
        previewVideo.srcObject = cameraStream;
      }

      if (previewVideo !== null) {
        previewVideo.style.opacity = cameraStream === null ? "0" : "1";
      }

      if (handOverlay !== null) {
        if (hasPreviewVideoDimensions) {
          handOverlay.setAttribute(
            "viewBox",
            `0 0 ${previewVideoWidthPx} ${previewVideoHeightPx}`
          );
        }

        if (latestPose.trackingState === "tracked" && hasPreviewVideoDimensions) {
          handOverlay.style.opacity = "1";
          indexOverlay?.setAttribute(
            "points",
            formatOverlayPolyline(
              latestPose.pose,
              calibrationOverlayLandmarkIds.index,
              previewVideoWidthPx,
              previewVideoHeightPx
            )
          );
          thumbOverlay?.setAttribute(
            "points",
            formatOverlayPolyline(
              latestPose.pose,
              calibrationOverlayLandmarkIds.thumb,
              previewVideoWidthPx,
              previewVideoHeightPx
            )
          );
          for (const pointId of calibrationOverlayLandmarkIds.capture) {
            setOverlayPoint(
              overlayPoints.get(pointId),
              latestPose.pose[pointId],
              previewVideoWidthPx,
              previewVideoHeightPx
            );
          }
          setOverlayPoint(
            observedAimPoint,
            readObservedAimPoint(latestPose.pose, handAimObservationConfig),
            previewVideoWidthPx,
            previewVideoHeightPx
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
      <section className="relative min-h-0 flex-1 overflow-hidden" ref={previewViewportRef}>
        <div
          className="absolute inset-0"
          style={{ transform: calibrationPreviewMirrored ? "scaleX(-1)" : undefined }}
        >
          <video
            autoPlay
            className="absolute inset-0 h-full w-full"
            muted
            playsInline
            ref={previewVideoRef}
            style={{
              objectFit: calibrationPreviewFitMode,
              objectPosition: "center",
              opacity: 0
            }}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgb(2 6 23 / 0.38)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ transform: calibrationPreviewMirrored ? "scaleX(-1)" : undefined }}
        >
          <svg
            className="absolute inset-0 h-full w-full opacity-0 transition-opacity"
            height="100%"
            preserveAspectRatio={resolveCalibrationOverlayPreserveAspectRatio(
              calibrationPreviewFitMode
            )}
            ref={handOverlayRef}
            viewBox="0 0 1 1"
            width="100%"
          >
            <polyline
              className="fill-none stroke-sky-300/80"
              data-skeleton="index"
              strokeWidth="4.2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              className="fill-none stroke-amber-300/85"
              data-skeleton="thumb"
              strokeWidth="3.6"
              vectorEffect="non-scaling-stroke"
            />
            {calibrationOverlayLandmarkIds.capture.map((pointId) => (
              <circle
                className="fill-white/90"
                data-point={pointId}
                key={pointId}
                r="8.5"
              />
            ))}
            <circle
              className="fill-transparent stroke-sky-300/90"
              data-point="observedAimPoint"
              r="10.5"
              strokeWidth="3.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="absolute left-3 top-3 z-10 max-w-xs rounded-[1.25rem] border border-white/10 bg-slate-950/78 p-4 backdrop-blur-md sm:left-4 sm:top-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Optional calibration</Badge>
            <Badge variant="secondary">
              {`${captureSnapshot.capturedSampleCount}/${captureSnapshot.totalAnchorCount}`}
            </Badge>
            <Badge variant="outline">{runtimeLifecycle}</Badge>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">
            Thumb-shooter calibration
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Only needed for camera mode. Capture all nine targets to align hand
            aim with gameplay.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-200">{captureGuidance}</p>
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

        <div className="absolute bottom-3 left-3 z-10 w-[min(28rem,calc(100%-1.5rem))] rounded-[1.25rem] border border-white/10 bg-slate-950/78 p-4 backdrop-blur-md sm:bottom-4 sm:left-4 sm:w-[28rem]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Pose capture</Badge>
            <Badge variant="secondary">{`${poseCaptureSamples.length} samples`}</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            The hand overlay now follows the thumb, index, and trigger contact
            points. The blue ring is the projected aim point, so it
            intentionally sits in front of the finger instead of on the hand.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            This preview is mirrored and cover-fitted to the stage, and the
            overlay now shares the same intrinsic media box and browser fit
            rules as the webcam feed. Wrist landmark 0 was never part of this
            runtime. The trigger capture landmarks now include index base and
            middle PIP contact points, while{" "}
            {calibrationCaptureOmittedLandmarkIds.join(" and ")} stay out of the
            export.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={trackingState !== "tracked"}
              onClick={() => appendPoseCaptureSample("aim")}
              size="sm"
              type="button"
            >
              Capture aim
            </Button>
            <Button
              disabled={trackingState !== "tracked"}
              onClick={() => appendPoseCaptureSample("shoot")}
              size="sm"
              type="button"
              variant="secondary"
            >
              Capture shoot
            </Button>
            <Button
              disabled={trackingState !== "tracked"}
              onClick={() => appendPoseCaptureSample("prep-next-fire")}
              size="sm"
              type="button"
              variant="outline"
            >
              Capture prep
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              onChange={(event) => setPoseCaptureLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  appendPoseCaptureSample(poseCaptureLabel);
                }
              }}
              placeholder="custom pose label"
              value={poseCaptureLabel}
            />
            <Button
              disabled={trackingState !== "tracked"}
              onClick={() => appendPoseCaptureSample(poseCaptureLabel)}
              size="sm"
              type="button"
              variant="outline"
            >
              Capture label
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={poseCaptureSamples.length === 0}
              onClick={() => {
                void copyPoseCaptureExport();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Copy JSON
            </Button>
            <Button
              disabled={poseCaptureSamples.length === 0}
              onClick={downloadPoseCaptureExport}
              size="sm"
              type="button"
              variant="outline"
            >
              Download JSON
            </Button>
            <Button
              disabled={poseCaptureSamples.length === 0}
              onClick={clearPoseCaptureExport}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">{poseCaptureStatus}</p>

          <pre className="mt-3 max-h-56 overflow-auto rounded-[1rem] border border-white/10 bg-slate-900/82 p-3 text-[11px] leading-5 text-slate-200">
            {poseCaptureExportJson}
          </pre>
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

      </section>
    </ImmersiveStageFrame>
  );
}
