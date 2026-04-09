import type { NormalizedViewportPoint } from "@thumbshooter/shared";
import { useEffect, useRef } from "react";

import type {
  GameplayReticleVisualState,
  GameplayRuntimeConfig
} from "../../game";

interface GameplayReticleOverlayProps {
  readonly reticleConfig: GameplayRuntimeConfig["reticle"];
  readonly reticleSource: {
    readonly reticleAimPoint: NormalizedViewportPoint | null;
    readonly reticleVisualState: GameplayReticleVisualState;
    subscribeReticleUpdates(
      listener: (
        aimPoint: NormalizedViewportPoint | null,
        visualState: GameplayReticleVisualState
      ) => void
    ): () => void;
  };
}

function formatRgbColor(color: readonly [number, number, number]): string {
  return `rgb(${color.map((channel) => Math.round(channel * 255)).join(" ")})`;
}

function syncReticleSize(
  svgElement: SVGSVGElement | null,
  overlayHeight: number,
  reticleSpanWorldUnits: number
): void {
  if (svgElement === null) {
    return;
  }

  const reticleSizePx = reticleSpanWorldUnits * overlayHeight * 0.5;
  const sizePxText = `${reticleSizePx}px`;

  svgElement.style.height = sizePxText;
  svgElement.style.width = sizePxText;
}

export function GameplayReticleOverlay({
  reticleConfig,
  reticleSource
}: GameplayReticleOverlayProps) {
  const reticleSpanWorldUnits = Math.max(
    reticleConfig.haloOuterRadius * 2,
    reticleConfig.horizontalBarSize.width,
    reticleConfig.verticalBarSize.height
  );
  const halfReticleSpanWorldUnits = reticleSpanWorldUnits * 0.5;
  const haloRadius =
    reticleConfig.haloInnerRadius +
    (reticleConfig.haloOuterRadius - reticleConfig.haloInnerRadius) * 0.5;
  const ringRadius =
    reticleConfig.innerRadius +
    (reticleConfig.outerRadius - reticleConfig.innerRadius) * 0.5;
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const haloRef = useRef<SVGCircleElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const horizontalBarRef = useRef<SVGRectElement | null>(null);
  const verticalBarRef = useRef<SVGRectElement | null>(null);
  const overlaySizeRef = useRef({ height: 1, width: 1 });
  const visualStateRef = useRef<GameplayReticleVisualState>("hidden");
  const aimPointRef = useRef<NormalizedViewportPoint | null>(null);

  useEffect(() => {
    const positionElement = positionRef.current;
    const styleElement = styleRef.current;
    const haloElement = haloRef.current;
    const ringElement = ringRef.current;
    const horizontalBarElement = horizontalBarRef.current;
    const verticalBarElement = verticalBarRef.current;

    if (
      positionElement === null ||
      styleElement === null ||
      haloElement === null ||
      ringElement === null ||
      horizontalBarElement === null ||
      verticalBarElement === null
    ) {
      return;
    }

    const syncReticlePresentation = (
      aimPoint: NormalizedViewportPoint | null,
      visualState: GameplayReticleVisualState
    ) => {
      const previousVisualState = visualStateRef.current;

      aimPointRef.current = aimPoint;
      visualStateRef.current = visualState;

      if (aimPoint === null || visualState === "hidden") {
        positionElement.style.visibility = "hidden";
        return;
      }

      positionElement.style.visibility = "visible";
      positionElement.style.transform =
        `translate3d(${overlaySizeRef.current.width * aimPoint.x}px, ` +
        `${overlaySizeRef.current.height * aimPoint.y}px, 0) translate(-50%, -50%)`;

      const style = reticleConfig.stateStyles[visualState];

      if (previousVisualState !== visualState) {
        styleElement.style.color = formatRgbColor(style.strokeColor);
        styleElement.style.transform = `scale(${style.scale})`;
        haloElement.style.opacity = `${style.haloOpacity}`;
        ringElement.style.opacity = `${style.strokeOpacity}`;
        horizontalBarElement.style.opacity = `${style.strokeOpacity * 0.84}`;
        verticalBarElement.style.opacity = `${style.strokeOpacity * 0.84}`;
      }
    };

    const syncOverlaySize = (width: number, height: number) => {
      overlaySizeRef.current = {
        height: Math.max(1, height),
        width: Math.max(1, width)
      };
      syncReticleSize(
        svgRef.current,
        overlaySizeRef.current.height,
        reticleSpanWorldUnits
      );
      syncReticlePresentation(aimPointRef.current, visualStateRef.current);
    };

    const overlayElement = overlayRef.current;

    if (overlayElement !== null) {
      const overlayRect = overlayElement.getBoundingClientRect();

      syncOverlaySize(overlayRect.width, overlayRect.height);
    } else {
      syncReticleSize(
        svgRef.current,
        overlaySizeRef.current.height,
        reticleSpanWorldUnits
      );
    }

    syncReticlePresentation(
      reticleSource.reticleAimPoint,
      reticleSource.reticleVisualState
    );

    if (typeof globalThis.ResizeObserver !== "function") {
      return reticleSource.subscribeReticleUpdates(syncReticlePresentation);
    }

    const resizeObserver = new globalThis.ResizeObserver((entries) => {
      const overlayEntry = entries[0];

      if (overlayEntry === undefined) {
        return;
      }

      syncOverlaySize(
        overlayEntry.contentRect.width,
        overlayEntry.contentRect.height
      );
    });
    const unsubscribe = reticleSource.subscribeReticleUpdates(
      syncReticlePresentation
    );

    if (overlayElement !== null) {
      resizeObserver.observe(overlayElement);
    }

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
    };
  }, [reticleConfig, reticleSource, reticleSpanWorldUnits]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20" ref={overlayRef}>
      <div
        className="absolute"
        ref={positionRef}
        style={{
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          visibility: "hidden",
          willChange: "transform"
        }}
      >
        <div className="animate-gameplay-reticle-drift">
          <div
            ref={styleRef}
            style={{
              transformOrigin: "center center",
              willChange: "transform"
            }}
          >
            <svg
              aria-hidden="true"
              ref={svgRef}
              style={{
                display: "block",
                overflow: "visible"
              }}
              viewBox={`${-halfReticleSpanWorldUnits} ${-halfReticleSpanWorldUnits} ${reticleSpanWorldUnits} ${reticleSpanWorldUnits}`}
            >
              <circle
                cx="0"
                cy="0"
                fill="none"
                r={haloRadius}
                ref={haloRef}
                stroke="currentColor"
                strokeWidth={reticleConfig.haloOuterRadius - reticleConfig.haloInnerRadius}
              />
              <circle
                cx="0"
                cy="0"
                fill="none"
                r={ringRadius}
                ref={ringRef}
                stroke="currentColor"
                strokeWidth={reticleConfig.outerRadius - reticleConfig.innerRadius}
              />
              <rect
                fill="currentColor"
                height={reticleConfig.horizontalBarSize.height}
                ref={horizontalBarRef}
                rx={reticleConfig.horizontalBarSize.height * 0.5}
                width={reticleConfig.horizontalBarSize.width}
                x={-reticleConfig.horizontalBarSize.width * 0.5}
                y={-reticleConfig.horizontalBarSize.height * 0.5}
              />
              <rect
                fill="currentColor"
                height={reticleConfig.verticalBarSize.height}
                ref={verticalBarRef}
                rx={reticleConfig.verticalBarSize.width * 0.5}
                width={reticleConfig.verticalBarSize.width}
                x={-reticleConfig.verticalBarSize.width * 0.5}
                y={-reticleConfig.verticalBarSize.height * 0.5}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
