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

type ReliableTransportSnapshot = MetaverseHudSnapshot["transport"]["presenceReliable"];
type DatagramTransportSnapshot =
  MetaverseHudSnapshot["transport"]["worldDriverDatagram"];
type SnapshotStreamTransportSnapshot =
  MetaverseHudSnapshot["transport"]["worldSnapshotStream"];

const metaversePresenceWebTransportTarget = resolveConfiguredWebTransportTarget(
  import.meta.env?.VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL
);
const metaverseWorldWebTransportTarget = resolveConfiguredWebTransportTarget(
  import.meta.env?.VITE_METAVERSE_WORLD_WEBTRANSPORT_URL
);

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

interface MetaverseDeveloperOverlayProps {
  readonly className?: string;
  readonly hudScaleStyle?: CSSProperties;
  readonly hudSnapshot: MetaverseHudSnapshot;
}

interface StatPanelProps {
  readonly description?: string;
  readonly label: string;
  readonly value: string;
}

interface TransportDetailCardProps {
  readonly debugLine: string;
  readonly details: readonly MetricRowProps[];
  readonly errorLine: string;
  readonly summary: string;
  readonly title: string;
}

function formatBooleanLabel(value: boolean | null): string {
  if (value === null) {
    return "n/a";
  }

  return value ? "yes" : "no";
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatCorrectionSource(
  source: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["localReconciliation"]["lastCorrectionSource"]
): string {
  switch (source) {
    case "mounted-vehicle-authority":
      return "mounted";
    case "local-authority-snap":
      return "pose";
    default:
      return "none";
  }
}

function formatCorrectionStatusValue(hudSnapshot: MetaverseHudSnapshot): string {
  const authoritativeCorrection =
    hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeCorrection;

  if (!authoritativeCorrection.applied) {
    return `active no · mode mismatch ${formatBooleanLabel(
      authoritativeCorrection.locomotionMismatch
    )}`;
  }

  return `active yes · src ${formatCorrectionSource(
    hudSnapshot.telemetry.worldSnapshot.localReconciliation.lastCorrectionSource
  )} · ${formatOptionalMeters(
    authoritativeCorrection.planarMagnitudeMeters
  )} planar · ${formatOptionalMeters(
    authoritativeCorrection.verticalMagnitudeMeters
  )} vertical`;
}

function formatPoseCorrectionReason(
  reason: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionReason"]
): string {
  switch (reason) {
    case "ground-state-mismatch":
      return "ground mismatch";
    case "gross-position-divergence":
      return "gross divergence";
    case "jump-rejected":
      return "jump rejected";
    default:
      return "none";
  }
}

function formatJumpResolutionState(
  state: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["authoritativeLocalPlayer"]["jumpDebug"]["resolvedJumpActionState"]
): string {
  switch (state) {
    case "accepted":
      return "accepted";
    case "rejected-buffer-expired":
      return "rejected buffer expired";
    default:
      return "none";
  }
}

function formatTraversalActionRejectionReason(
  reason: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["authoritativeLocalPlayer"]["traversalAuthority"]["lastRejectedActionReason"]
): string {
  switch (reason) {
    case "buffer-expired":
      return "buffer expired";
    default:
      return "none";
  }
}

function formatTraversalAuthorityValue(
  traversalAuthority:
    | MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["authoritativeLocalPlayer"]["traversalAuthority"]
    | MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["local"]["traversalAuthority"]
): string {
  if (
    traversalAuthority.currentActionKind === null ||
    traversalAuthority.currentActionPhase === null
  ) {
    return "n/a";
  }

  return `${traversalAuthority.currentActionKind} · ${traversalAuthority.currentActionPhase} · seq ${formatOptionalSequence(
    traversalAuthority.currentActionSequence
  )} · consumed ${formatOptionalSequence(
    traversalAuthority.lastConsumedActionSequence
  )} · rejected ${formatOptionalSequence(
    traversalAuthority.lastRejectedActionSequence
  )} (${formatTraversalActionRejectionReason(
    traversalAuthority.lastRejectedActionReason
  )})`;
}

function formatOptionalSequence(value: number | null): string {
  if (value === null || value <= 0) {
    return "none";
  }

  return formatCount(value);
}

function formatJumpPendingValue(
  pendingJumpActionSequence: number | null,
  pendingJumpBufferAgeMs: number | null
): string {
  if (pendingJumpActionSequence === null || pendingJumpActionSequence <= 0) {
    return "none";
  }

  return `seq ${formatCount(pendingJumpActionSequence)} · age ${formatOptionalMilliseconds(
    pendingJumpBufferAgeMs
  )}`;
}

function formatJumpResolutionValue(
  resolvedJumpActionSequence: number | null,
  resolvedJumpActionState: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["authoritativeLocalPlayer"]["jumpDebug"]["resolvedJumpActionState"]
): string {
  if (resolvedJumpActionSequence === null || resolvedJumpActionSequence <= 0) {
    return formatJumpResolutionState(resolvedJumpActionState);
  }

  return `seq ${formatCount(resolvedJumpActionSequence)} · ${formatJumpResolutionState(
    resolvedJumpActionState
  )}`;
}

function formatIssuedJumpActionValue(
  issuedJumpActionSequence: number | null,
  traversalAuthority: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["authoritativeLocalPlayer"]["traversalAuthority"]
): string {
  if (issuedJumpActionSequence === null || issuedJumpActionSequence <= 0) {
    return "inactive";
  }

  return `issued ${formatCount(issuedJumpActionSequence)} · current ${formatOptionalSequence(
    traversalAuthority.currentActionSequence
  )} · consumed ${formatOptionalSequence(
    traversalAuthority.lastConsumedActionSequence
  )} · rejected ${formatOptionalSequence(
    traversalAuthority.lastRejectedActionSequence
  )} (${formatTraversalActionRejectionReason(
    traversalAuthority.lastRejectedActionReason
  )})`;
}

function formatTransportStatus(snapshot: {
  readonly activeTransport: string | null;
  readonly webTransportStatus: string;
}): string {
  const activeTransportLabel =
    snapshot.activeTransport === null
      ? "inactive"
      : snapshot.activeTransport.replaceAll("-", " ");

  return `${snapshot.webTransportStatus.replaceAll("-", " ")} · ${activeTransportLabel}`;
}

function formatReliableTransportSummary(snapshot: ReliableTransportSnapshot): string {
  if (!snapshot.enabled) {
    return "Reliable lane disabled";
  }

  if (snapshot.fallbackActive) {
    if (snapshot.webTransportStatus === "localdev-host-unavailable") {
      return "HTTP fallback: localdev WebTransport host unavailable";
    }

    return "HTTP fallback: WebTransport failed";
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return "HTTP only: WebTransport not requested";
    case "unconfigured":
      return "HTTP only: WebTransport URL missing";
    case "localdev-self-check-failed":
      return "HTTP only: localdev WebTransport self-check failed";
    case "browser-api-missing":
      return "HTTP only: browser WebTransport API missing";
    case "active":
      return snapshot.activeTransport === "webtransport"
        ? "WebTransport active"
        : "Reliable lane connecting";
    default:
      return formatTransportStatus(snapshot);
  }
}

function formatDatagramTransportSummary(snapshot: DatagramTransportSnapshot): string {
  if (!snapshot.enabled) {
    return "Datagram lane disabled";
  }

  if (snapshot.state === "degraded-to-reliable") {
    return "Reliable fallback: datagram send failed";
  }

  if (snapshot.state === "active") {
    return snapshot.activeTransport === "webtransport-datagram"
      ? "WebTransport datagrams active"
      : "Datagram lane active";
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return "Datagrams off: WebTransport not requested";
    case "unconfigured":
      return "Datagrams off: WebTransport URL missing";
    case "localdev-self-check-failed":
      return "Datagrams off: localdev WebTransport self-check failed";
    case "browser-api-missing":
      return "Datagrams off: browser WebTransport API missing";
    default:
      return "Datagrams unavailable";
  }
}

function formatTransportError(lastTransportError: string | null): string {
  if (lastTransportError === null) {
    return "No transport error recorded.";
  }

  return lastTransportError;
}

function formatOptionalMilliseconds(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(0)} ms`;
}

function formatOptionalVelocityUnitsPerSecond(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(2)} u/s`;
}

function formatOptionalRateHz(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(1)} Hz`;
}

function formatMeters(value: number): string {
  return `${value.toFixed(2)} m`;
}

function formatOptionalMeters(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return formatMeters(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDecisionReason(
  reason: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["local"]["decisionReason"]
): string {
  return reason.replaceAll("-", " ");
}

function formatPoseCorrectionDetailValue(
  detail: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["localReconciliation"]["lastLocalAuthorityPoseCorrectionDetail"]
): string {
  return `${formatOptionalMeters(detail.planarMagnitudeMeters)} planar · ${formatOptionalMeters(
    detail.verticalMagnitudeMeters
  )} vertical · local grounded ${formatBooleanLabel(
    detail.localGrounded
  )} · authority grounded ${formatBooleanLabel(detail.authoritativeGrounded)}`;
}

function formatLocalJumpGateValue(
  jumpDebug: MetaverseHudSnapshot["telemetry"]["worldSnapshot"]["shoreline"]["local"]["jumpDebug"]
): string {
  return `grounded ${formatBooleanLabel(
    jumpDebug.groundedBodyGrounded
  )} · ready ${formatBooleanLabel(
    jumpDebug.groundedBodyJumpReady
  )} · surface ${formatBooleanLabel(
    jumpDebug.surfaceJumpSupported
  )} · supported ${formatBooleanLabel(
    jumpDebug.supported
  )} · vy ${formatOptionalVelocityUnitsPerSecond(
    jumpDebug.verticalSpeedUnitsPerSecond
  )}`;
}

function formatDegreesFromRadians(value: number): string {
  return `${((value * 180) / Math.PI).toFixed(1)}°`;
}

function formatSnapshotStreamPath(path: SnapshotStreamTransportSnapshot["path"]): string {
  return path.replaceAll("-", " ");
}

function formatSnapshotStreamLiveness(
  liveness: SnapshotStreamTransportSnapshot["liveness"]
): string {
  return liveness.replaceAll("-", " ");
}

function resolveConfiguredWebTransportTarget(rawUrl: string | undefined): string | null {
  const trimmedValue = rawUrl?.trim();

  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return `${parsedUrl.host}${parsedUrl.pathname}`;
  } catch {
    return trimmedValue;
  }
}

function formatReliableHandshakeDebugLine(
  snapshot: ReliableTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.enabled) {
    return "Reliable lane disabled.";
  }

  if (target === null) {
    return snapshot.webTransportConfigured
      ? "WebTransport is configured, but the endpoint could not be parsed."
      : "No WebTransport endpoint configured for this lane.";
  }

  if (
    snapshot.activeTransport === "webtransport" &&
    snapshot.webTransportStatus === "active"
  ) {
    return `Handshake established to ${target}.`;
  }

  if (snapshot.fallbackActive) {
    return `WebTransport targeted ${target} before falling back to HTTP.`;
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return `WebTransport is not requested. HTTP remains active while ${target} stays configured.`;
    case "unconfigured":
      return "No WebTransport endpoint configured for this lane.";
    case "browser-api-missing":
      return `The browser cannot open WebTransport to ${target} because the API is unavailable.`;
    case "localdev-self-check-failed":
      return `Localdev startup failed before the browser could attempt ${target}.`;
    case "localdev-host-unavailable":
      return `Configured endpoint ${target} was unreachable from the browser.`;
    case "runtime-fallback":
      return `WebTransport attempted ${target}, then runtime failover switched this lane to HTTP.`;
    case "active":
      return `WebTransport is targeting ${target}.`;
    default:
      return `Configured WebTransport endpoint ${target}.`;
  }
}

function formatDatagramHandshakeDebugLine(
  snapshot: DatagramTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.enabled) {
    return "Datagram lane disabled.";
  }

  if (target === null) {
    return snapshot.webTransportConfigured
      ? "WebTransport datagrams are configured, but the endpoint could not be parsed."
      : "No WebTransport endpoint configured for datagrams.";
  }

  if (
    snapshot.activeTransport === "webtransport-datagram" &&
    snapshot.state === "active"
  ) {
    return `Datagrams live on ${target}.`;
  }

  if (snapshot.state === "degraded-to-reliable") {
    return `Datagrams targeted ${target} before degrading to reliable commands.`;
  }

  switch (snapshot.webTransportStatus) {
    case "not-requested":
      return `Datagrams stay off because WebTransport is not requested, even though ${target} is configured.`;
    case "unconfigured":
      return "No WebTransport endpoint configured for datagrams.";
    case "browser-api-missing":
      return `The browser cannot open WebTransport datagrams to ${target} because the API is unavailable.`;
    case "localdev-self-check-failed":
      return `Localdev startup failed before the browser could attempt datagrams on ${target}.`;
    case "runtime-fallback":
      return `Datagrams attempted ${target}, then runtime failover moved this lane to reliable commands.`;
    case "active":
      return `Datagrams are targeting ${target}.`;
    default:
      return `Configured datagram endpoint ${target}.`;
  }
}

function formatSnapshotStreamSummary(
  snapshot: SnapshotStreamTransportSnapshot
): string {
  if (!snapshot.available) {
    return "Polling only: snapshot stream unavailable";
  }

  if (snapshot.path === "fallback-polling") {
    return snapshot.liveness === "reconnecting"
      ? "Polling fallback: snapshot stream reconnecting"
      : "Polling fallback: snapshot stream failed";
  }

  if (
    snapshot.path === "reliable-snapshot-stream" &&
    snapshot.liveness === "subscribed"
  ) {
    return "Snapshot stream active";
  }

  if (snapshot.liveness === "reconnecting") {
    return "Snapshot stream reconnecting";
  }

  return `Snapshot path: ${formatSnapshotStreamPath(snapshot.path)}`;
}

function formatSnapshotStreamDebugLine(
  snapshot: SnapshotStreamTransportSnapshot,
  target: string | null
): string {
  if (!snapshot.available) {
    return "World snapshot updates are arriving through HTTP polling only.";
  }

  if (target === null) {
    return `Snapshot stream lane is ${formatSnapshotStreamLiveness(snapshot.liveness)}.`;
  }

  if (
    snapshot.path === "reliable-snapshot-stream" &&
    snapshot.liveness === "subscribed"
  ) {
    return `Snapshot stream subscribed on ${target}.`;
  }

  if (snapshot.path === "fallback-polling") {
    return snapshot.liveness === "reconnecting"
      ? `Snapshot stream is reconnecting to ${target} while HTTP polling stays active.`
      : `Snapshot stream targeted ${target} before falling back to HTTP polling.`;
  }

  if (snapshot.liveness === "reconnecting") {
    return `Snapshot stream is reconnecting to ${target}.`;
  }

  return `Snapshot stream is targeting ${target}.`;
}

function formatTopLevelHandshakeDebugLine(hudSnapshot: MetaverseHudSnapshot): string {
  if (
    hudSnapshot.transport.worldReliable.activeTransport === "webtransport" &&
    hudSnapshot.transport.worldReliable.webTransportStatus === "active" &&
    metaverseWorldWebTransportTarget !== null
  ) {
    const datagramsActive =
      hudSnapshot.transport.worldDriverDatagram.activeTransport ===
        "webtransport-datagram" &&
      hudSnapshot.transport.worldDriverDatagram.state === "active";

    return datagramsActive
      ? `World handshake established to ${metaverseWorldWebTransportTarget}. Datagrams live.`
      : `World handshake established to ${metaverseWorldWebTransportTarget}.`;
  }

  if (
    hudSnapshot.transport.worldSnapshotStream.path ===
      "reliable-snapshot-stream" &&
    hudSnapshot.transport.worldSnapshotStream.liveness === "subscribed" &&
    metaverseWorldWebTransportTarget !== null
  ) {
    return `World snapshot stream live on ${metaverseWorldWebTransportTarget}.`;
  }

  if (
    hudSnapshot.transport.presenceReliable.activeTransport === "webtransport" &&
    hudSnapshot.transport.presenceReliable.webTransportStatus === "active" &&
    metaversePresenceWebTransportTarget !== null
  ) {
    return `Presence handshake established to ${metaversePresenceWebTransportTarget}.`;
  }

  if (metaverseWorldWebTransportTarget !== null) {
    return `Configured WebTransport target ${metaverseWorldWebTransportTarget}.`;
  }

  if (metaversePresenceWebTransportTarget !== null) {
    return `Configured WebTransport target ${metaversePresenceWebTransportTarget}.`;
  }

  return "No WebTransport endpoints configured.";
}

function createDeveloperReport(hudSnapshot: MetaverseHudSnapshot): string {
  const sections = [
    {
      heading: "Metaverse developer report",
      lines: [
        `Lifecycle: ${hudSnapshot.lifecycle}`,
        `Boot phase: ${hudSnapshot.boot.phase.replaceAll("-", " ")}`,
        `Presence: ${hudSnapshot.presence.state} · ${hudSnapshot.presence.remotePlayerCount} remote`,
        `Handshake: ${formatTopLevelHandshakeDebugLine(hudSnapshot)}`
      ]
    },
    {
      heading: "Renderer",
      lines: [
        `Frame: ${formatCount(hudSnapshot.telemetry.renderedFrameCount)} · ${hudSnapshot.telemetry.frameRate.toFixed(1)} fps`,
        `DPR: ${hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)}`,
        `Draw calls: ${formatCount(hudSnapshot.telemetry.renderer.drawCallCount)}`,
        `Triangles: ${formatCount(hudSnapshot.telemetry.renderer.triangleCount)}`
      ]
    },
    {
      heading: "Authority",
      lines: [
        `Tick / poll: ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs)} · ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldCadence.worldPollIntervalMs)}`,
        `Snapshot path: ${formatSnapshotStreamPath(hudSnapshot.transport.worldSnapshotStream.path)} · ${formatSnapshotStreamLiveness(hudSnapshot.transport.worldSnapshotStream.liveness)} · ${formatCount(hudSnapshot.telemetry.worldSnapshot.bufferDepth)} buffered · ${formatOptionalRateHz(hudSnapshot.telemetry.worldSnapshot.latestSnapshotUpdateRateHz)}`,
        `Age / offset: ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldSnapshot.latestSimulationAgeMs)} · ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldSnapshot.clockOffsetEstimateMs)}`,
        `Reconciliation: ${formatCount(hudSnapshot.telemetry.worldSnapshot.localReconciliation.totalCorrectionCount)} total · ${formatCount(hudSnapshot.telemetry.worldSnapshot.localReconciliation.recentCorrectionCountPast5Seconds)} recent/5s · last ${formatOptionalMilliseconds(hudSnapshot.telemetry.worldSnapshot.localReconciliation.lastCorrectionAgeMs)} · pose ${formatCount(hudSnapshot.telemetry.worldSnapshot.localReconciliation.localAuthorityPoseCorrectionCount)}`
      ]
    },
    {
      heading: "Traversal",
      lines: [
        `Local shoreline: ${hudSnapshot.telemetry.worldSnapshot.shoreline.local.locomotionMode} · ${formatDecisionReason(hudSnapshot.telemetry.worldSnapshot.shoreline.local.decisionReason)}`,
        `Authority / ack: ${hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer.locomotionMode === null ? "n/a" : `${hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer.locomotionMode} · ack ${formatCount(hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer.lastProcessedInputSequence ?? 0)}`}`,
        `Jump / traversal: ${formatIssuedJumpActionValue(
          hudSnapshot.telemetry.worldSnapshot.shoreline.issuedTraversalIntent
            ?.actionIntent.kind === "jump"
            ? hudSnapshot.telemetry.worldSnapshot.shoreline
                .issuedTraversalIntent.actionIntent.sequence
            : null,
          hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer
            .traversalAuthority
        )} · ${formatTraversalAuthorityValue(
          hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer
            .traversalAuthority
        )}`,
        `Correction: ${formatCorrectionStatusValue(hudSnapshot)}`,
        `Render offset: ${formatMeters(hudSnapshot.telemetry.worldSnapshot.cameraPresentation.renderedOffset.planarMagnitudeMeters)} planar · ${formatMeters(hudSnapshot.telemetry.worldSnapshot.cameraPresentation.renderedOffset.verticalMagnitudeMeters)} vertical · ${formatDegreesFromRadians(hudSnapshot.telemetry.worldSnapshot.cameraPresentation.renderedOffset.lookAngleRadians)} look`
      ]
    },
    {
      heading: "Transport",
      lines: [
        `Presence reliable: ${formatReliableTransportSummary(hudSnapshot.transport.presenceReliable)}`,
        `World reliable: ${formatReliableTransportSummary(hudSnapshot.transport.worldReliable)}`,
        `World snapshot stream: ${formatSnapshotStreamSummary(hudSnapshot.transport.worldSnapshotStream)}`,
        `World latest-wins datagram: ${formatDatagramTransportSummary(hudSnapshot.transport.worldDriverDatagram)}`,
        `World debug: ${formatReliableHandshakeDebugLine(hudSnapshot.transport.worldReliable, metaverseWorldWebTransportTarget)}`
      ]
    }
  ];

  return sections
    .map((section) => [section.heading, ...section.lines].join("\n"))
    .join("\n\n");
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="type-shell-caption">{label}</span>
      <span className="type-shell-body text-right text-[color:var(--shell-foreground)]">
        {value}
      </span>
    </div>
  );
}

function StatPanel({ description, label, value }: StatPanelProps) {
  return (
    <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
      <p className="type-shell-banner">{label}</p>
      {description !== undefined ? (
        <p className="type-shell-detail mt-2">{description}</p>
      ) : null}
      <p className="type-shell-heading mt-3">{value}</p>
    </div>
  );
}

function TransportDetailCard({
  debugLine,
  details,
  errorLine,
  summary,
  title
}: TransportDetailCardProps) {
  return (
    <div className="surface-shell-panel rounded-[calc(1.25rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
      <div className="flex flex-col gap-1">
        <p className="type-shell-banner">{title}</p>
        <p className="type-shell-body">{summary}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] px-[calc(1rem*var(--game-ui-scale))] py-[calc(0.9rem*var(--game-ui-scale))]">
          <p className="type-shell-caption">Debug line</p>
          <p className="type-shell-body mt-2">{debugLine}</p>
        </div>

        <div className="flex flex-col gap-2">
          {details.map((detail) => (
            <MetricRow key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>

        <div className="surface-shell-inset rounded-[calc(1rem*var(--game-ui-scale))] px-[calc(1rem*var(--game-ui-scale))] py-[calc(0.9rem*var(--game-ui-scale))]">
          <p className="type-shell-caption">Last error</p>
          <p className="type-shell-body mt-2">{errorLine}</p>
        </div>
      </div>
    </div>
  );
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
  const presenceTransportDetails = [
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
  ] as const;
  const worldTransportDetails = [
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
  ] as const;
  const worldSnapshotStreamDetails = [
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
  ] as const;
  const datagramTransportDetails = [
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
  ] as const;

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
                description="Client shoreline mode hold and the latest automatic routing reason"
                label="Local shoreline"
                value={`${hudSnapshot.telemetry.worldSnapshot.shoreline.local.locomotionMode} · ${formatDecisionReason(
                  hudSnapshot.telemetry.worldSnapshot.shoreline.local
                    .decisionReason
                )}`}
              />
              <StatPanel
                description="Latest fresh authoritative local-player locomotion and processed-input acknowledgement"
                label="Authority / ack"
                value={
                  hudSnapshot.telemetry.worldSnapshot.shoreline
                    .authoritativeLocalPlayer.locomotionMode === null
                    ? "n/a"
                    : `${hudSnapshot.telemetry.worldSnapshot.shoreline.authoritativeLocalPlayer.locomotionMode} · ack ${formatCount(
                        hudSnapshot.telemetry.worldSnapshot.shoreline
                          .authoritativeLocalPlayer.lastProcessedInputSequence ??
                          0
                      )}`
                }
              />
              <StatPanel
                description="Issued jump state against authoritative traversal phase"
                label="Jump / traversal"
                value={`${formatIssuedJumpActionValue(
                  hudSnapshot.telemetry.worldSnapshot.shoreline
                    .issuedTraversalIntent?.actionIntent.kind === "jump"
                    ? hudSnapshot.telemetry.worldSnapshot.shoreline
                        .issuedTraversalIntent.actionIntent.sequence
                    : null,
                  hudSnapshot.telemetry.worldSnapshot.shoreline
                    .authoritativeLocalPlayer.traversalAuthority
                )} · ${formatTraversalAuthorityValue(
                  hudSnapshot.telemetry.worldSnapshot.shoreline
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
