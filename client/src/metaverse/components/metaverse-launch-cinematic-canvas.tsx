import { useEffect, useRef, useState } from "react";

import { MetaverseLaunchCinematicRuntime } from "../render/launch/metaverse-launch-cinematic-runtime";
import type { WebGpuMetaverseCapabilitySnapshot } from "../types/webgpu-capability";

interface MetaverseLaunchCinematicCanvasProps {
  readonly capabilityStatus: WebGpuMetaverseCapabilitySnapshot["status"];
  readonly className?: string;
  readonly launchPending: boolean;
}

export function MetaverseLaunchCinematicCanvas({
  capabilityStatus,
  className,
  launchPending
}: MetaverseLaunchCinematicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<MetaverseLaunchCinematicRuntime | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null || capabilityStatus !== "supported") {
      return;
    }

    const runtime = new MetaverseLaunchCinematicRuntime();
    let cancelled = false;

    runtimeRef.current = runtime;
    setRuntimeFailed(false);
    setRuntimeReady(false);
    void runtime
      .start(canvas)
      .then(() => {
        if (!cancelled) {
          setRuntimeReady(true);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setRuntimeFailed(true);
        globalThis.console?.warn(
          error instanceof Error
            ? error.message
            : "Metaverse launch cinematic failed to initialize."
        );
      });

    const resizeObserver = new ResizeObserver(() => {
      runtime.syncViewport(canvas);
    });

    resizeObserver.observe(canvas);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      runtime.dispose();

      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
    };
  }, [capabilityStatus]);

  useEffect(() => {
    runtimeRef.current?.setLaunchPending(launchPending);
  }, [launchPending]);

  const rootClassName = [
    "pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_66%_42%,rgb(245_164_92_/_0.58),transparent_28%),linear-gradient(180deg,rgb(56_96_144),rgb(238_149_83)_48%,rgb(30_58_26)_100%)] transition-[filter,opacity,transform] duration-700 ease-out",
    launchPending
      ? "scale-100 opacity-100 blur-0"
      : "scale-100 opacity-100 blur-0",
    className
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ");
  const canvasClassName = [
    "h-full w-full transition-opacity duration-700",
    capabilityStatus === "supported" && runtimeReady && !runtimeFailed
      ? "opacity-100"
      : "opacity-0"
  ].join(" ");

  return (
    <div
      aria-hidden="true"
      className={rootClassName}
    >
      <canvas
        className={canvasClassName}
        ref={canvasRef}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_63%_45%,transparent_0%,rgb(0_0_0_/_0.06)_42%,rgb(0_0_0_/_0.48)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0_/_0.58),rgb(0_0_0_/_0.2)_34%,transparent_58%),linear-gradient(0deg,rgb(0_0_0_/_0.5),transparent_42%)]" />
    </div>
  );
}
