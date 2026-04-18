import { useState, type CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type { MetaverseHudSnapshot } from "../types/metaverse-runtime";
import {
  StatPanel,
  TransportDetailCard,
  type MetricRowProps
} from "./developer-overlay/metaverse-developer-overlay-cards";
import {
  createDeveloperReport,
  formatBooleanLabel,
  formatCorrectionStatusValue,
  formatCount,
  formatDatagramHandshakeDebugLine,
  formatDatagramTransportSummary,
  formatDecisionReason,
  formatDegreesFromRadians,
  formatIssuedJumpActionValue,
  formatMeters,
  formatOptionalMilliseconds,
  formatOptionalRateHz,
  formatReliableHandshakeDebugLine,
  formatReliableTransportSummary,
  formatSnapshotStreamDebugLine,
  formatSnapshotStreamLiveness,
  formatSnapshotStreamPath,
  formatSnapshotStreamSummary,
  formatTopLevelHandshakeDebugLine,
  formatTransportError,
  formatTransportStatus,
  formatTraversalAuthorityValue,
  metaversePresenceWebTransportTarget,
  metaverseWorldWebTransportTarget
} from "./developer-overlay/metaverse-developer-overlay-formatting";

interface MetaverseDeveloperOverlayProps {
  readonly className?: string;
  readonly hudScaleStyle?: CSSProperties;
  readonly hudSnapshot: MetaverseHudSnapshot;
}

export function MetaverseDeveloperOverlay({
  className,
  hudScaleStyle,
  hudSnapshot
}: MetaverseDeveloperOverlayProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const compactMetrics = [
    {
      label: "FPS",
      value: hudSnapshot.telemetry.frameRate.toFixed(1)
    },
    {
      label: "Renderer",
      value: hudSnapshot.telemetry.renderer.label
    },
    {
      label: "Draw calls",
      value: formatCount(hudSnapshot.telemetry.renderer.drawCallCount)
    },
    {
      label: "Triangles",
      value: formatCount(hudSnapshot.telemetry.renderer.triangleCount)
    },
    {
      label: "DPR",
      value: hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)
    },
    {
      label: "Presence",
      value: `${hudSnapshot.presence.state} · ${hudSnapshot.presence.remotePlayerCount} remote`
    }
  ] as const;
  const presenceTransportDetails: readonly MetricRowProps[] = [
    {
      label: "Status",
      value: formatTransportStatus(hudSnapshot.transport.presenceReliable)
    },
    {
      label: "Browser API",
      value: formatBooleanLabel(
        hudSnapshot.transport.presenceReliable.browserWebTransportAvailable
      )
    },
    {
      label: "Configured",
      value: formatBooleanLabel(
        hudSnapshot.transport.presenceReliable.webTransportConfigured
      )
    },
    {
      label: "Fallback",
      value: formatBooleanLabel(hudSnapshot.transport.presenceReliable.fallbackActive)
    }
  ];
  const worldTransportDetails: readonly MetricRowProps[] = [
    {
      label: "Status",
      value: formatTransportStatus(hudSnapshot.transport.worldReliable)
    },
    {
      label: "Browser API",
      value: formatBooleanLabel(
        hudSnapshot.transport.worldReliable.browserWebTransportAvailable
      )
    },
    {
      label: "Configured",
      value: formatBooleanLabel(
        hudSnapshot.transport.worldReliable.webTransportConfigured
      )
    },
    {
      label: "Fallback",
      value: formatBooleanLabel(hudSnapshot.transport.worldReliable.fallbackActive)
    }
  ];
  const worldSnapshotStreamDetails: readonly MetricRowProps[] = [
    {
      label: "Path",
      value: formatSnapshotStreamPath(hudSnapshot.transport.worldSnapshotStream.path)
    },
    {
      label: "Liveness",
      value: formatSnapshotStreamLiveness(
        hudSnapshot.transport.worldSnapshotStream.liveness
      )
    },
    {
      label: "Available",
      value: formatBooleanLabel(hudSnapshot.transport.worldSnapshotStream.available)
    },
    {
      label: "Reconnects",
      value: formatCount(hudSnapshot.transport.worldSnapshotStream.reconnectCount)
    }
  ];
  const datagramTransportDetails: readonly MetricRowProps[] = [
    {
      label: "Status",
      value: formatTransportStatus(hudSnapshot.transport.worldDriverDatagram)
    },
    {
      label: "Browser API",
      value: formatBooleanLabel(
        hudSnapshot.transport.worldDriverDatagram.browserWebTransportAvailable
      )
    },
    {
      label: "Configured",
      value: formatBooleanLabel(
        hudSnapshot.transport.worldDriverDatagram.webTransportConfigured
      )
    },
    {
      label: "State",
      value: hudSnapshot.transport.worldDriverDatagram.state.replaceAll("-", " ")
    },
    {
      label: "Send failures",
      value: formatCount(
        hudSnapshot.telemetry.worldSnapshot.datagramSendFailureCount
      )
    }
  ];

  async function handleCopyReport(): Promise<void> {
    if (navigator.clipboard?.writeText === undefined) {
      setCopyStatus("Clipboard export is unavailable in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(createDeveloperReport(hudSnapshot));
      setCopyStatus("Copied enhanced debug report.");
    } catch {
      setCopyStatus("Copy failed. Open Debug details and copy manually.");
    }
  }

  return (
    <div
      className={["pointer-events-auto min-w-0 w-full", className]
        .filter(Boolean)
        .join(" ")}
      style={hudScaleStyle}
    >
      <div className="surface-shell-overlay rounded-[calc(1.4rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))] shadow-[0_16px_48px_rgb(15_23_42/_0.32)]">
        <div className="flex flex-wrap gap-2">
          <Badge>Developer</Badge>
          <Badge variant="secondary">
            Boot {hudSnapshot.boot.phase.replaceAll("-", " ")}
          </Badge>
          <Badge variant="outline">
            {formatReliableTransportSummary(hudSnapshot.transport.worldReliable)}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {compactMetrics.map((metric) => (
            <div
              className="surface-shell-inset type-shell-detail rounded-[calc(0.8rem*var(--game-ui-scale))] px-[calc(0.85rem*var(--game-ui-scale))] py-[calc(0.65rem*var(--game-ui-scale))]"
              key={metric.label}
            >
              {metric.label} {metric.value}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <p className="type-shell-body max-w-[18rem]">
            {formatTopLevelHandshakeDebugLine(hudSnapshot)}
          </p>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={() => {
                  void handleCopyReport();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy report
              </Button>
              <Button
                onClick={() => {
                  setDialogOpen(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Debug details
              </Button>
            </div>
            {copyStatus === null ? null : (
              <p className="type-shell-caption max-w-[18rem] text-right">
                {copyStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent
          className="surface-shell-overlay gap-5 p-[calc(1.25rem*var(--game-ui-scale))] text-[color:var(--shell-foreground)] ring-[color:var(--shell-border)] shadow-[0_28px_90px_rgb(15_23_42/_0.32)] sm:max-w-[min(72rem,calc(100vw-2rem))]"
          style={hudScaleStyle}
        >
          <DialogHeader className="gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge>Metaverse Dev</Badge>
              <Badge variant="secondary">
                {hudSnapshot.telemetry.renderer.label}{" "}
                {hudSnapshot.telemetry.renderer.active ? "active" : "idle"}
              </Badge>
              <Badge variant="outline">
                Boot {hudSnapshot.boot.phase.replaceAll("-", " ")}
              </Badge>
              <Badge variant="outline">
                Lifecycle {hudSnapshot.lifecycle.replaceAll("-", " ")}
              </Badge>
            </div>
            <DialogTitle className="type-shell-heading">
              Metaverse developer
            </DialogTitle>
            <DialogDescription className="type-shell-body">
              Inspect renderer cadence, authority boot, and WebTransport lanes
              without digging through the inline HUD.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <section className="grid gap-3 md:grid-cols-3">
              <StatPanel
                description="Rendered frames since boot"
                label="Frame"
                value={`${formatCount(hudSnapshot.telemetry.renderedFrameCount)} · ${hudSnapshot.telemetry.frameRate.toFixed(1)} fps`}
              />
              <StatPanel
                description="Current frame delta"
                label="Frame delta"
                value={`${hudSnapshot.telemetry.frameDeltaMs.toFixed(1)} ms`}
              />
              <StatPanel
                description="Renderer device pixel ratio"
                label="DPR"
                value={hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)}
              />
              <StatPanel
                description="WebGPU renderer draw calls"
                label="Draw calls"
                value={formatCount(hudSnapshot.telemetry.renderer.drawCallCount)}
              />
              <StatPanel
                description="Submitted triangles"
                label="Triangles"
                value={formatCount(hudSnapshot.telemetry.renderer.triangleCount)}
              />
              <StatPanel
                description="Remote roster visibility"
                label="Presence"
                value={`${hudSnapshot.presence.state} · ${hudSnapshot.presence.remotePlayerCount} remote`}
              />
            </section>

            <Separator className="bg-[color:var(--shell-border)]" />

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatPanel
                description="Authoritative cadence and current polling loop"
                label="Tick / poll"
                value={`${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs
                )} · ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.worldPollIntervalMs
                )}`}
              />
              <StatPanel
                description="Active authoritative snapshot lane"
                label="Snapshot path"
                value={`${formatSnapshotStreamPath(
                  hudSnapshot.transport.worldSnapshotStream.path
                )} · ${formatSnapshotStreamLiveness(
                  hudSnapshot.transport.worldSnapshotStream.liveness
                )} · ${formatCount(
                  hudSnapshot.telemetry.worldSnapshot.bufferDepth
                )} buffered`}
              />
              <StatPanel
                description="Latest authoritative simulation age and clock estimate"
                label="Age / offset"
                value={`Age ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldSnapshot.latestSimulationAgeMs
                )} · Offset ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldSnapshot.clockOffsetEstimateMs
                )}`}
              />
              <StatPanel
                description="Recent correction activity"
                label="Reconciliation"
                value={`recent ${formatCount(
                  hudSnapshot.telemetry.worldSnapshot.localReconciliation
                    .recentCorrectionCountPast5Seconds
                )}/5s · last ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldSnapshot.localReconciliation
                    .lastCorrectionAgeMs
                )} · pose ${formatCount(
                  hudSnapshot.telemetry.worldSnapshot.localReconciliation
                    .localAuthorityPoseCorrectionCount
                )}`}
              />
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatPanel
                description="Client locomotion-routing mode hold and the latest automatic routing reason"
                label="Local locomotion routing"
                value={`${hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local.locomotionMode} · ${formatDecisionReason(
                  hudSnapshot.telemetry.worldSnapshot.surfaceRouting.local
                    .decisionReason
                )}`}
              />
              <StatPanel
                description="Latest fresh authoritative local-player locomotion and processed-input acknowledgement"
                label="Authority / ack"
                value={
                  hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                    .authoritativeLocalPlayer.locomotionMode === null
                    ? "n/a"
                    : `${hudSnapshot.telemetry.worldSnapshot.surfaceRouting.authoritativeLocalPlayer.locomotionMode} · ack ${formatCount(
                        hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                          .authoritativeLocalPlayer.lastProcessedInputSequence ??
                          0
                      )}`
                }
              />
              <StatPanel
                description="Issued jump state against authoritative traversal phase"
                label="Jump / traversal"
                value={`${formatIssuedJumpActionValue(
                  hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                    .issuedTraversalIntent?.actionIntent.kind === "jump"
                    ? hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                        .issuedTraversalIntent.actionIntent.sequence
                    : null,
                  hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                    .authoritativeLocalPlayer.traversalAuthority
                )} · ${formatTraversalAuthorityValue(
                  hudSnapshot.telemetry.worldSnapshot.surfaceRouting
                    .authoritativeLocalPlayer.traversalAuthority
                )}`}
              />
              <StatPanel
                description="Current correction status instead of raw stale authority deltas"
                label="Correction"
                value={formatCorrectionStatusValue(hudSnapshot)}
              />
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <StatPanel
                description="Final rendered camera offset from the traversal/presentation camera used to drive the frame"
                label="Render offset"
                value={`${formatMeters(
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedOffset.planarMagnitudeMeters
                )} planar · ${formatMeters(
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedOffset.verticalMagnitudeMeters
                )} vertical · ${formatDegreesFromRadians(
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedOffset.lookAngleRadians
                )} look`}
              />
              <StatPanel
                description="Large rendered-camera discontinuities detected from changes in that offset over the last five seconds"
                label="Camera snap"
                value={`${formatCount(
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedSnap.totalCount
                )} total · ${formatCount(
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedSnap.recentCountPast5Seconds
                )} recent/5s · last ${
                  hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                    .renderedSnap.lastAgeMs === null
                    ? "n/a"
                    : `${Math.round(
                        hudSnapshot.telemetry.worldSnapshot.cameraPresentation
                          .renderedSnap.lastAgeMs
                      )} ms`
                }`}
              />
            </section>

            <Separator className="bg-[color:var(--shell-border)]" />

            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="type-shell-banner">Transport lanes</p>
                <p className="type-shell-body">
                  Includes explicit endpoint debug lines so successful
                  WebTransport handshakes are visible without reading the raw
                  environment file.
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-4">
                <TransportDetailCard
                  debugLine={formatReliableHandshakeDebugLine(
                    hudSnapshot.transport.presenceReliable,
                    metaversePresenceWebTransportTarget
                  )}
                  details={presenceTransportDetails}
                  errorLine={formatTransportError(
                    hudSnapshot.transport.presenceReliable.lastTransportError
                  )}
                  summary={formatReliableTransportSummary(
                    hudSnapshot.transport.presenceReliable
                  )}
                  title="Presence reliable"
                />
                <TransportDetailCard
                  debugLine={formatReliableHandshakeDebugLine(
                    hudSnapshot.transport.worldReliable,
                    metaverseWorldWebTransportTarget
                  )}
                  details={worldTransportDetails}
                  errorLine={formatTransportError(
                    hudSnapshot.transport.worldReliable.lastTransportError
                  )}
                  summary={formatReliableTransportSummary(
                    hudSnapshot.transport.worldReliable
                  )}
                  title="World reliable"
                />
                <TransportDetailCard
                  debugLine={formatSnapshotStreamDebugLine(
                    hudSnapshot.transport.worldSnapshotStream,
                    metaverseWorldWebTransportTarget
                  )}
                  details={worldSnapshotStreamDetails}
                  errorLine={formatTransportError(
                    hudSnapshot.transport.worldSnapshotStream.lastTransportError
                  )}
                  summary={formatSnapshotStreamSummary(
                    hudSnapshot.transport.worldSnapshotStream
                  )}
                  title="World snapshot stream"
                />
                <TransportDetailCard
                  debugLine={formatDatagramHandshakeDebugLine(
                    hudSnapshot.transport.worldDriverDatagram,
                    metaverseWorldWebTransportTarget
                  )}
                  details={datagramTransportDetails}
                  errorLine={formatTransportError(
                    hudSnapshot.transport.worldDriverDatagram.lastTransportError
                  )}
                  summary={formatDatagramTransportSummary(
                    hudSnapshot.transport.worldDriverDatagram
                  )}
                  title="World latest-wins datagram"
                />
              </div>
            </section>

            <div className="surface-shell-inset flex justify-end rounded-[calc(1rem*var(--game-ui-scale))] p-[calc(0.9rem*var(--game-ui-scale))]">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
