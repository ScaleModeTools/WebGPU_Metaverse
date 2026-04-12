export const realtimeTransportPreferences = [
  "http",
  "webtransport-preferred"
] as const;

export const realtimeWebTransportStatuses = [
  "disabled",
  "not-requested",
  "unconfigured",
  "browser-api-missing",
  "localdev-self-check-failed",
  "localdev-host-unavailable",
  "runtime-fallback",
  "active"
] as const;

export const realtimeReliableTransportKinds = [
  "http",
  "webtransport"
] as const;

export const realtimeDatagramTransportStates = [
  "disabled",
  "unavailable",
  "active",
  "degraded-to-reliable"
] as const;

export const realtimeDatagramTransportKinds = [
  "webtransport-datagram",
  "reliable-command-fallback"
] as const;

export type RealtimeTransportPreference =
  (typeof realtimeTransportPreferences)[number];
export type RealtimeWebTransportStatus =
  (typeof realtimeWebTransportStatuses)[number];
export type RealtimeReliableTransportKind =
  (typeof realtimeReliableTransportKinds)[number];
export type RealtimeDatagramTransportState =
  (typeof realtimeDatagramTransportStates)[number];
export type RealtimeDatagramTransportKind =
  (typeof realtimeDatagramTransportKinds)[number];

export interface RealtimeReliableTransportStatusSnapshot {
  readonly activeTransport: RealtimeReliableTransportKind | null;
  readonly browserWebTransportAvailable: boolean;
  readonly enabled: boolean;
  readonly fallbackActive: boolean;
  readonly lastTransportError: string | null;
  readonly preference: RealtimeTransportPreference;
  readonly webTransportConfigured: boolean;
  readonly webTransportStatus: RealtimeWebTransportStatus;
}

export interface RealtimeDatagramTransportStatusSnapshot {
  readonly activeTransport: RealtimeDatagramTransportKind | null;
  readonly browserWebTransportAvailable: boolean;
  readonly enabled: boolean;
  readonly lastTransportError: string | null;
  readonly preference: RealtimeTransportPreference;
  readonly state: RealtimeDatagramTransportState;
  readonly webTransportConfigured: boolean;
  readonly webTransportStatus: RealtimeWebTransportStatus;
}

export function createRealtimeReliableTransportStatusSnapshot(
  snapshot: RealtimeReliableTransportStatusSnapshot
): RealtimeReliableTransportStatusSnapshot {
  return Object.freeze({
    activeTransport: snapshot.activeTransport,
    browserWebTransportAvailable: snapshot.browserWebTransportAvailable,
    enabled: snapshot.enabled,
    fallbackActive: snapshot.fallbackActive,
    lastTransportError: snapshot.lastTransportError,
    preference: snapshot.preference,
    webTransportConfigured: snapshot.webTransportConfigured,
    webTransportStatus: snapshot.webTransportStatus
  });
}

export function createRealtimeDatagramTransportStatusSnapshot(
  snapshot: RealtimeDatagramTransportStatusSnapshot
): RealtimeDatagramTransportStatusSnapshot {
  return Object.freeze({
    activeTransport: snapshot.activeTransport,
    browserWebTransportAvailable: snapshot.browserWebTransportAvailable,
    enabled: snapshot.enabled,
    lastTransportError: snapshot.lastTransportError,
    preference: snapshot.preference,
    state: snapshot.state,
    webTransportConfigured: snapshot.webTransportConfigured,
    webTransportStatus: snapshot.webTransportStatus
  });
}

export function createDisabledRealtimeReliableTransportStatusSnapshot(
  preference: RealtimeTransportPreference = "http"
): RealtimeReliableTransportStatusSnapshot {
  return createRealtimeReliableTransportStatusSnapshot({
    activeTransport: null,
    browserWebTransportAvailable: false,
    enabled: false,
    fallbackActive: false,
    lastTransportError: null,
    preference,
    webTransportConfigured: false,
    webTransportStatus: "disabled"
  });
}

export function createDisabledRealtimeDatagramTransportStatusSnapshot(
  preference: RealtimeTransportPreference = "http"
): RealtimeDatagramTransportStatusSnapshot {
  return createRealtimeDatagramTransportStatusSnapshot({
    activeTransport: null,
    browserWebTransportAvailable: false,
    enabled: false,
    lastTransportError: null,
    preference,
    state: "disabled",
    webTransportConfigured: false,
    webTransportStatus: "disabled"
  });
}
