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

function formatBooleanLabel(value: boolean): string {
  return value ? "yes" : "no";
}

function formatCount(value: number): string {
  return value.toLocaleString();
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
  const rendererBootDetails = [
    {
      label: "WebGPU ready",
      value: formatBooleanLabel(hudSnapshot.telemetry.renderer.active)
    },
    {
      label: "Renderer init",
      value: formatBooleanLabel(hudSnapshot.boot.rendererInitialized)
    },
    {
      label: "Scene prewarm",
      value: formatBooleanLabel(hudSnapshot.boot.scenePrewarmed)
    }
  ] as const;
  const authorityBootDetails = [
    {
      label: "Presence joined",
      value: formatBooleanLabel(hudSnapshot.boot.presenceJoined)
    },
    {
      label: "World connected",
      value: formatBooleanLabel(hudSnapshot.boot.authoritativeWorldConnected)
    },
    {
      label: "Lifecycle",
      value: hudSnapshot.lifecycle
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
    }
  ] as const;

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

            <section className="grid gap-3 md:grid-cols-2">
              <div className="surface-shell-panel rounded-[calc(1.25rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
                <div className="flex flex-col gap-1">
                  <p className="type-shell-banner">Renderer boot</p>
                  <p className="type-shell-body">
                    Boot truth for the local WebGPU pipeline.
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {rendererBootDetails.map((detail) => (
                    <MetricRow
                      key={detail.label}
                      label={detail.label}
                      value={detail.value}
                    />
                  ))}
                </div>
              </div>

              <div className="surface-shell-panel rounded-[calc(1.25rem*var(--game-ui-scale))] p-[calc(1rem*var(--game-ui-scale))]">
                <div className="flex flex-col gap-1">
                  <p className="type-shell-banner">Authority boot</p>
                  <p className="type-shell-body">
                    Presence join and authoritative world readiness.
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {authorityBootDetails.map((detail) => (
                    <MetricRow
                      key={detail.label}
                      label={detail.label}
                      value={detail.value}
                    />
                  ))}
                </div>
              </div>
            </section>

            <Separator className="bg-[color:var(--shell-border)]" />

            <section className="grid gap-3 md:grid-cols-3">
              <StatPanel
                description="Authoritative world cadence"
                label="Tick / poll"
                value={`Tick ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs
                )} · Poll ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.worldPollIntervalMs
                )}`}
              />
              <StatPanel
                description="Remote world presentation window"
                label="Interpolation / extrapolation"
                value={`Interpolation ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.remoteInterpolationDelayMs
                )} · Extrapolation ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.maxExtrapolationMs
                )}`}
              />
              <StatPanel
                description="Freshness guard for local authority"
                label="Local freshness"
                value={formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.localAuthoritativeFreshnessMaxAgeMs
                )}
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

              <div className="grid gap-3 xl:grid-cols-3">
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
                  title="World driver datagram"
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
