import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface StatCardProps {
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
      <span className="type-detail-muted">{label}</span>
      <span className="type-detail font-medium text-right">{value}</span>
    </div>
  );
}

function StatCard({ description, label, value }: StatCardProps) {
  return (
    <Card className="border-border/70 bg-muted/30" size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="type-caption">{label}</CardTitle>
        {description !== undefined ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-3">
        <p className="type-label">{value}</p>
      </CardContent>
    </Card>
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
    <Card className="border-border/70 bg-card/90" size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="type-caption">{title}</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3 text-xs">
        <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-3">
          <p className="type-label">Debug line</p>
          <p className="type-body-muted mt-1">{debugLine}</p>
        </div>
        <div className="flex flex-col gap-2">
          {details.map((detail) => (
            <MetricRow key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
          <p className="type-label">Last error</p>
          <p className="type-body-muted mt-1">{errorLine}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetaverseDeveloperOverlay({
  hudSnapshot
}: {
  readonly hudSnapshot: MetaverseHudSnapshot;
}) {
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
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-auto absolute top-4 right-4 w-[min(18rem,calc(100%-2rem))]">
        <Card
          className="border-border/70 bg-card/90 shadow-lg backdrop-blur-md"
          size="sm"
        >
          <CardHeader className="border-b border-border/60">
            <CardTitle className="type-caption">Developer</CardTitle>
            <CardDescription>Metaverse runtime</CardDescription>
            <CardAction>
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
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-3 text-xs">
            {compactMetrics.map((metric) => (
              <MetricRow key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge>Boot {hudSnapshot.boot.phase.replaceAll("-", " ")}</Badge>
              <Badge variant="secondary">
                {formatReliableTransportSummary(hudSnapshot.transport.worldReliable)}
              </Badge>
              <Badge variant="outline">
                {formatDatagramTransportSummary(
                  hudSnapshot.transport.worldDriverDatagram
                )}
              </Badge>
            </div>
            <p className="type-body-muted">{formatTopLevelHandshakeDebugLine(hudSnapshot)}</p>
          </CardFooter>
        </Card>
      </div>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-h-[min(85vh,52rem)] gap-5 overflow-y-auto sm:max-w-5xl">
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
            <DialogTitle>Metaverse developer</DialogTitle>
            <DialogDescription>
              Inspect renderer cadence, authority boot, and WebTransport lanes
              without digging through the inline HUD.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <section className="grid gap-3 md:grid-cols-3">
              <StatCard
                description="Rendered frames since boot"
                label="Frame"
                value={`${formatCount(hudSnapshot.telemetry.renderedFrameCount)} · ${hudSnapshot.telemetry.frameRate.toFixed(1)} fps`}
              />
              <StatCard
                description="Current frame delta"
                label="Frame delta"
                value={`${hudSnapshot.telemetry.frameDeltaMs.toFixed(1)} ms`}
              />
              <StatCard
                description="Renderer device pixel ratio"
                label="DPR"
                value={hudSnapshot.telemetry.renderer.devicePixelRatio.toFixed(2)}
              />
              <StatCard
                description="WebGPU renderer draw calls"
                label="Draw calls"
                value={formatCount(hudSnapshot.telemetry.renderer.drawCallCount)}
              />
              <StatCard
                description="Submitted triangles"
                label="Triangles"
                value={formatCount(hudSnapshot.telemetry.renderer.triangleCount)}
              />
              <StatCard
                description="Remote roster visibility"
                label="Presence"
                value={`${hudSnapshot.presence.state} · ${hudSnapshot.presence.remotePlayerCount} remote`}
              />
            </section>

            <Separator />

            <section className="grid gap-3 md:grid-cols-2">
              <Card className="border-border/70 bg-card/90" size="sm">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="type-caption">Renderer boot</CardTitle>
                  <CardDescription>
                    Boot truth for the local WebGPU pipeline.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-3 text-xs">
                  {rendererBootDetails.map((detail) => (
                    <MetricRow
                      key={detail.label}
                      label={detail.label}
                      value={detail.value}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90" size="sm">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="type-caption">Authority boot</CardTitle>
                  <CardDescription>
                    Presence join and authoritative world readiness.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-3 text-xs">
                  {authorityBootDetails.map((detail) => (
                    <MetricRow
                      key={detail.label}
                      label={detail.label}
                      value={detail.value}
                    />
                  ))}
                </CardContent>
              </Card>
            </section>

            <Separator />

            <section className="grid gap-3 md:grid-cols-3">
              <StatCard
                description="Authoritative world cadence"
                label="Tick / poll"
                value={`Tick ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.authoritativeTickIntervalMs
                )} · Poll ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.worldPollIntervalMs
                )}`}
              />
              <StatCard
                description="Remote world presentation window"
                label="Interpolation / extrapolation"
                value={`Interpolation ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.remoteInterpolationDelayMs
                )} · Extrapolation ${formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.maxExtrapolationMs
                )}`}
              />
              <StatCard
                description="Freshness guard for local authority"
                label="Local freshness"
                value={formatOptionalMilliseconds(
                  hudSnapshot.telemetry.worldCadence.localAuthoritativeFreshnessMaxAgeMs
                )}
              />
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="type-label">Transport lanes</p>
                <p className="type-body-muted">
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
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
