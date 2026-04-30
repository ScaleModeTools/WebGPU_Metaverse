import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";

import {
  Http3Server,
  WebTransport as NodeWebTransport,
  quicheLoaded
} from "@fails-components/webtransport";
import type {
  DuckHuntCoopRoomWebTransportClientDatagram,
  DuckHuntCoopRoomWebTransportClientMessage,
  DuckHuntCoopRoomWebTransportServerMessage,
  MetaversePresenceWebTransportClientMessage,
  MetaversePresenceWebTransportServerMessage,
  MetaverseRealtimeWorldWebTransportClientDatagram,
  MetaverseRealtimeWorldWebTransportClientMessage,
  MetaverseRealtimeWorldWebTransportServerMessage
} from "@webgpu-metaverse/shared";
import {
  createDuckHuntCoopRoomWebTransportCommandRequest,
  createDuckHuntCoopRoomWebTransportErrorMessage,
  createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram,
  createDuckHuntCoopRoomWebTransportSnapshotRequest,
  createDuckHuntCoopRoomWebTransportSnapshotSubscribeRequest,
  createMetaversePresenceWebTransportCommandRequest,
  createMetaversePresenceWebTransportErrorMessage,
  createMetaversePresenceWebTransportRosterRequest,
  createMetaverseRealtimeWorldWebTransportCommandRequest,
  createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram,
  createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram,
  createMetaverseRealtimeWorldWebTransportErrorMessage,
  createMetaverseRealtimeWorldWebTransportSnapshotRequest,
  createMetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest,
  metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType,
  parseMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram
} from "@webgpu-metaverse/shared";

import type { DuckHuntCoopRoomWebTransportDatagramAdapter } from "../experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-datagram-adapter.js";
import type {
  DuckHuntCoopRoomWebTransportAdapter,
  DuckHuntCoopRoomWebTransportSession
} from "../experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-adapter.js";
import type {
  MetaverseRealtimeWorldWebTransportDatagramAdapter,
  MetaverseRealtimeWorldWebTransportDatagramSession
} from "../metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.js";
import type {
  MetaversePresenceWebTransportAdapter,
  MetaversePresenceWebTransportSession
} from "../metaverse/adapters/metaverse-presence-webtransport-adapter.js";
import type {
  MetaverseWorldWebTransportAdapter,
  MetaverseWorldWebTransportSession
} from "../metaverse/adapters/metaverse-world-webtransport-adapter.js";

export const localdevMetaversePresenceWebTransportPath =
  "/metaverse/presence" as const;
export const localdevMetaverseWorldWebTransportPath =
  "/metaverse/world" as const;
export const localdevDuckHuntCoopRoomWebTransportPath =
  "/experiences/duck-hunt/coop/rooms" as const;
export const localdevWebTransportBootStatusEnvName =
  "VITE_LOCALDEV_WEBTRANSPORT_BOOT_STATUS" as const;
export const localdevWebTransportBootErrorEnvName =
  "VITE_LOCALDEV_WEBTRANSPORT_BOOT_ERROR" as const;
export const localdevWebTransportSelfCheckFailedStatus =
  "self-check-failed" as const;

interface LocaldevHttp3ServerAddress {
  readonly family: string;
  readonly host: string;
  readonly port: number;
}

interface LocaldevHttp3ServerSessionRequest {
  readonly header: Record<string, unknown>;
}

interface LocaldevHttp3ServerSessionRequestResult {
  readonly path: string;
  readonly status: number;
}

interface LocaldevHttp3ServerSessionLike {
  readonly closed: Promise<unknown>;
  readonly datagrams: {
    readonly readable: ReadableStream<Uint8Array>;
  };
  readonly incomingBidirectionalStreams: ReadableStream<{
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
  }>;
  readonly ready: Promise<unknown>;
}

interface LocaldevHttp3ServerLike {
  readonly ready: Promise<unknown>;
  address(): LocaldevHttp3ServerAddress | null;
  sessionStream(path: string): ReadableStream<LocaldevHttp3ServerSessionLike>;
  setRequestCallback?(
    callback: (
      request: LocaldevHttp3ServerSessionRequest
    ) =>
      | LocaldevHttp3ServerSessionRequestResult
      | Promise<LocaldevHttp3ServerSessionRequestResult>
  ): void;
  startServer(): void;
  stopServer(): void;
}

interface LocaldevWebTransportServerConfig {
  readonly certificatePem: string;
  readonly host: string;
  readonly port: number;
  readonly privateKeyPem: string;
  readonly secret: string;
}

export interface ResolvedLocaldevWebTransportServerConfig {
  readonly certificateSha256Hex: string;
  readonly clientEnvFilePath: string | null;
  readonly clientHost: string;
  readonly serverConfig: LocaldevWebTransportServerConfig;
  readonly selfCheckHost: string;
}

interface LocaldevWebTransportServerDependencies {
  readonly createHttp3Server?: (
    config: LocaldevWebTransportServerConfig
  ) => LocaldevHttp3ServerLike;
  readonly logError?: (message: string, error?: unknown) => void;
  readonly readWallClockMs?: () => number;
  readonly textDecoder?: TextDecoder;
  readonly textEncoder?: TextEncoder;
}

interface LocaldevWebTransportClientLike {
  readonly closed?: Promise<unknown>;
  readonly ready?: Promise<unknown>;
  close(closeInfo?: {
    readonly closeCode?: number;
    readonly reason?: string;
  }): void;
}

interface LocaldevWebTransportClientConstructorOptions {
  serverCertificateHashes?: {
    algorithm: "sha-256";
    value: Uint8Array;
  }[];
}

interface LocaldevWebTransportHandshakeProbeDependencies {
  readonly createWebTransportClient?: (
    url: string,
    options?: LocaldevWebTransportClientConstructorOptions
  ) => LocaldevWebTransportClientLike;
  readonly quicheLoadedPromise?: Promise<unknown>;
  readonly setTimeout?: typeof globalThis.setTimeout;
  readonly clearTimeout?: typeof globalThis.clearTimeout;
}

interface ReliableRoute<
  Message,
  Response,
  Session extends {
    handleClientStream?(
      message: Message,
      context: {
        readonly closed: Promise<void>;
        writeResponse(response: Response): Promise<void>;
      },
      nowMs: number
    ): Promise<boolean>;
    receiveClientMessage(message: Message, nowMs: number): Response;
    dispose(): void;
  }
> {
  readonly createErrorResponse: (message: string) => Response;
  readonly openSession: () => Session;
  readonly parseClientMessage: (payload: unknown) => Message;
  readonly path: string;
}

interface DatagramRoute<
  Datagram,
  Session extends {
    receiveClientDatagram(datagram: Datagram, nowMs: number): void;
    dispose(): void;
  }
> {
  readonly openSession: () => Session;
  readonly parseClientDatagram: (payload: unknown) => Datagram;
  readonly path: string;
}

function createDefaultHttp3Server(
  config: LocaldevWebTransportServerConfig
): LocaldevHttp3ServerLike {
  return new Http3Server({
    cert: config.certificatePem,
    host: config.host,
    port: config.port,
    privKey: config.privateKeyPem,
    secret: config.secret
  }) as unknown as LocaldevHttp3ServerLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`Expected non-empty string field: ${fieldName}`);
  }

  return trimmedValue;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function isExpectedWebTransportSessionCloseError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== "WebTransportError") {
    return false;
  }

  if (error.message === "Session closed") {
    return true;
  }

  const gracefulCloseMatch = /^Session closed \(on process \d+\) with code (\d+) and reason(?: .*)?$/.exec(
    error.message
  );

  return gracefulCloseMatch?.[1] === "0";
}

function resolveOptionalPathHeader(
  header: Record<string, unknown>
): string | null {
  const rawPath = header[":path"];

  if (typeof rawPath !== "string") {
    return null;
  }

  const trimmedPath = rawPath.trim();

  return trimmedPath.length === 0 ? null : trimmedPath;
}

function decodeSha256Hex(rawValue: string): Uint8Array {
  const normalizedValue = validateSha256Hex(rawValue);
  return Buffer.from(normalizedValue, "hex");
}

function sanitizeSingleLineEnvValue(rawValue: string): string {
  return rawValue.replaceAll(/\s+/gu, " ").trim();
}

function decodeJsonFrame(rawValue: Uint8Array, decoder: TextDecoder): unknown {
  const rawFrame = decoder.decode(rawValue).trim();

  if (rawFrame.length === 0) {
    throw new Error("WebTransport frame was empty.");
  }

  return JSON.parse(rawFrame);
}

function parseMetaversePresenceClientMessage(
  payload: unknown
): MetaversePresenceWebTransportClientMessage {
  if (!isRecord(payload)) {
    throw new Error("Metaverse presence WebTransport request must be an object.");
  }

  const messageType = readNonEmptyStringField(payload.type, "type");

  switch (messageType) {
    case "presence-roster-request":
      return createMetaversePresenceWebTransportRosterRequest({
        observerPlayerId: readNonEmptyStringField(
          payload.observerPlayerId,
          "observerPlayerId"
        ) as Parameters<
          typeof createMetaversePresenceWebTransportRosterRequest
        >[0]["observerPlayerId"],
        roomId: readNonEmptyStringField(
          payload.roomId,
          "roomId"
        ) as Parameters<
          typeof createMetaversePresenceWebTransportRosterRequest
        >[0]["roomId"]
      });
    case "presence-command-request":
      if (!isRecord(payload.command)) {
        throw new Error("Metaverse presence WebTransport command must be an object.");
      }

      return createMetaversePresenceWebTransportCommandRequest({
        command: payload.command as unknown as Parameters<
          typeof createMetaversePresenceWebTransportCommandRequest
        >[0]["command"],
        roomId: readNonEmptyStringField(
          payload.roomId,
          "roomId"
        ) as Parameters<
          typeof createMetaversePresenceWebTransportCommandRequest
        >[0]["roomId"]
      });
    default:
      throw new Error(
        `Unsupported metaverse presence WebTransport message type: ${messageType}`
      );
  }
}

function parseMetaverseWorldClientMessage(
  payload: unknown
): MetaverseRealtimeWorldWebTransportClientMessage {
  if (!isRecord(payload)) {
    throw new Error("Metaverse world WebTransport request must be an object.");
  }

  const messageType = readNonEmptyStringField(payload.type, "type");

  switch (messageType) {
    case "world-snapshot-request":
      return createMetaverseRealtimeWorldWebTransportSnapshotRequest({
        observerPlayerId: readNonEmptyStringField(
          payload.observerPlayerId,
          "observerPlayerId"
        ) as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportSnapshotRequest
        >[0]["observerPlayerId"],
        roomId: readNonEmptyStringField(
          payload.roomId,
          "roomId"
        ) as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportSnapshotRequest
        >[0]["roomId"]
      });
    case "world-snapshot-subscribe":
      return createMetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest({
        observerPlayerId: readNonEmptyStringField(
          payload.observerPlayerId,
          "observerPlayerId"
        ) as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest
        >[0]["observerPlayerId"],
        roomId: readNonEmptyStringField(
          payload.roomId,
          "roomId"
        ) as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportSnapshotSubscribeRequest
        >[0]["roomId"]
      });
    case "world-command-request":
      if (!isRecord(payload.command)) {
        throw new Error("Metaverse world WebTransport command must be an object.");
      }

      return createMetaverseRealtimeWorldWebTransportCommandRequest({
        command: payload.command as unknown as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportCommandRequest
        >[0]["command"],
        roomId: readNonEmptyStringField(
          payload.roomId,
          "roomId"
        ) as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportCommandRequest
        >[0]["roomId"]
      });
    default:
      throw new Error(
        `Unsupported metaverse world WebTransport request type: ${messageType}`
      );
  }
}

function parseMetaverseWorldClientDatagram(
  payload: unknown
): MetaverseRealtimeWorldWebTransportClientDatagram {
  if (!isRecord(payload)) {
    throw new Error("Metaverse world WebTransport datagram must be an object.");
  }

  if (
    payload.t ===
    metaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagramType
  ) {
    return parseMetaverseRealtimeWorldWebTransportCompactPlayerTraversalIntentDatagram(
      payload
    );
  }

  const datagramType = readNonEmptyStringField(payload.type, "type");

  if (!isRecord(payload.command)) {
    throw new Error("Metaverse world WebTransport datagram command must be an object.");
  }

  switch (datagramType) {
    case "world-driver-vehicle-control-datagram":
      return createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram({
        command: payload.command as unknown as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram
        >[0]["command"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportDriverVehicleControlDatagram
        >[0]["roomId"]
      });
    case "world-player-look-intent-datagram":
      return createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram({
        command: payload.command as unknown as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram
        >[0]["command"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerLookIntentDatagram
        >[0]["roomId"]
      });
    case "world-player-traversal-intent-datagram":
      return createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram({
        command: payload.command as unknown as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram
        >[0]["command"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerTraversalIntentDatagram
        >[0]["roomId"]
      });
    case "world-player-weapon-state-datagram":
      return createMetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram({
        command: payload.command as unknown as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram
        >[0]["command"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createMetaverseRealtimeWorldWebTransportPlayerWeaponStateDatagram
        >[0]["roomId"]
      });
    default:
      throw new Error(
        `Unsupported metaverse world WebTransport datagram type: ${datagramType}`
      );
  }
}

function parseDuckHuntCoopRoomClientMessage(
  payload: unknown
): DuckHuntCoopRoomWebTransportClientMessage {
  if (!isRecord(payload)) {
    throw new Error("Duck Hunt co-op WebTransport request must be an object.");
  }

  const messageType = readNonEmptyStringField(payload.type, "type");

  switch (messageType) {
    case "coop-room-snapshot-request":
      return createDuckHuntCoopRoomWebTransportSnapshotRequest({
        observerPlayerId: readNonEmptyStringField(
          payload.observerPlayerId,
          "observerPlayerId"
        ) as Parameters<
          typeof createDuckHuntCoopRoomWebTransportSnapshotRequest
        >[0]["observerPlayerId"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createDuckHuntCoopRoomWebTransportSnapshotRequest
        >[0]["roomId"]
      });
    case "coop-room-snapshot-subscribe":
      return createDuckHuntCoopRoomWebTransportSnapshotSubscribeRequest({
        observerPlayerId: readNonEmptyStringField(
          payload.observerPlayerId,
          "observerPlayerId"
        ) as Parameters<
          typeof createDuckHuntCoopRoomWebTransportSnapshotSubscribeRequest
        >[0]["observerPlayerId"],
        roomId: readNonEmptyStringField(payload.roomId, "roomId") as Parameters<
          typeof createDuckHuntCoopRoomWebTransportSnapshotSubscribeRequest
        >[0]["roomId"]
      });
    case "coop-room-command-request":
      if (!isRecord(payload.command)) {
        throw new Error("Duck Hunt co-op WebTransport command must be an object.");
      }

      return createDuckHuntCoopRoomWebTransportCommandRequest({
        command: payload.command as unknown as Parameters<
          typeof createDuckHuntCoopRoomWebTransportCommandRequest
        >[0]["command"]
      });
    default:
      throw new Error(
        `Unsupported Duck Hunt co-op WebTransport request type: ${messageType}`
      );
  }
}

function parseDuckHuntCoopRoomClientDatagram(
  payload: unknown
): DuckHuntCoopRoomWebTransportClientDatagram {
  if (!isRecord(payload)) {
    throw new Error("Duck Hunt co-op WebTransport datagram must be an object.");
  }

  const datagramType = readNonEmptyStringField(payload.type, "type");

  if (datagramType !== "coop-room-player-presence-datagram") {
    throw new Error(
      `Unsupported Duck Hunt co-op WebTransport datagram type: ${datagramType}`
    );
  }

  if (!isRecord(payload.command)) {
    throw new Error("Duck Hunt co-op WebTransport datagram command must be an object.");
  }

  return createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram({
    command: payload.command as unknown as Parameters<
      typeof createDuckHuntCoopRoomWebTransportPlayerPresenceDatagram
    >[0]["command"]
  });
}

function resolveOptionalNonEmptyEnvValue(rawValue: string | undefined): string | null {
  const trimmedValue = rawValue?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? null
    : trimmedValue;
}

function resolveRequiredEnvValue(
  env: NodeJS.ProcessEnv,
  envName: string
): string {
  const resolvedValue = resolveOptionalNonEmptyEnvValue(env[envName]);

  if (resolvedValue === null) {
    throw new Error(`Missing required localdev WebTransport env: ${envName}`);
  }

  return resolvedValue;
}

function resolvePortEnvValue(env: NodeJS.ProcessEnv, envName: string): number {
  const rawValue = resolveRequiredEnvValue(env, envName);
  const port = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid localdev WebTransport port: ${envName}`);
  }

  return port;
}

function validateSha256Hex(rawValue: string): string {
  const normalizedValue = rawValue.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/u.test(normalizedValue)) {
    throw new Error(
      "Localdev WebTransport certificate hash must be a 64-character SHA-256 hex string."
    );
  }

  return normalizedValue;
}

export function resolveLocaldevWebTransportServerConfigFromEnvironment(
  env: NodeJS.ProcessEnv,
  readTextFile: (path: string) => string = (path) =>
    readFileSync(path, "utf8")
): ResolvedLocaldevWebTransportServerConfig | null {
  if (resolveOptionalNonEmptyEnvValue(env.WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_ENABLED) !== "1") {
    return null;
  }

  const certificateFilePath = resolveRequiredEnvValue(
    env,
    "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_FILE"
  );
  const privateKeyFilePath = resolveRequiredEnvValue(
    env,
    "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_KEY_FILE"
  );

  return Object.freeze({
    certificateSha256Hex: validateSha256Hex(
      resolveRequiredEnvValue(
        env,
        "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CERT_SHA256"
      )
    ),
    clientHost:
      resolveOptionalNonEmptyEnvValue(
        env.WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_CLIENT_HOST
      ) ??
      resolveRequiredEnvValue(env, "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_HOST"),
    clientEnvFilePath: resolveOptionalNonEmptyEnvValue(
      env.WEBGPU_METAVERSE_LOCALDEV_CLIENT_ENV_FILE
    ),
    serverConfig: Object.freeze({
      certificatePem: readTextFile(certificateFilePath),
      host: resolveRequiredEnvValue(
        env,
        "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_HOST"
      ),
      port: resolvePortEnvValue(
        env,
        "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_PORT"
      ),
      privateKeyPem: readTextFile(privateKeyFilePath),
      secret: resolveRequiredEnvValue(
        env,
        "WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_SECRET"
      )
    }),
    selfCheckHost:
      resolveOptionalNonEmptyEnvValue(
        env.WEBGPU_METAVERSE_LOCALDEV_WEBTRANSPORT_SELF_CHECK_HOST
      ) ??
      "127.0.0.1"
  });
}

export function createLocaldevWebTransportClientEnvFileContents(config: {
  readonly certificateSha256Hex: string;
  readonly host: string;
  readonly port: number;
}): string {
  const origin = `https://${config.host}:${config.port}`;
  const hash = validateSha256Hex(config.certificateSha256Hex);

  return [
    `VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL=${origin}${localdevMetaversePresenceWebTransportPath}`,
    `VITE_METAVERSE_PRESENCE_WEBTRANSPORT_SERVER_CERT_SHA256=${hash}`,
    `VITE_METAVERSE_WORLD_WEBTRANSPORT_URL=${origin}${localdevMetaverseWorldWebTransportPath}`,
    `VITE_METAVERSE_WORLD_WEBTRANSPORT_SERVER_CERT_SHA256=${hash}`,
    `VITE_DUCK_HUNT_COOP_WEBTRANSPORT_URL=${origin}${localdevDuckHuntCoopRoomWebTransportPath}`,
    `VITE_DUCK_HUNT_COOP_WEBTRANSPORT_SERVER_CERT_SHA256=${hash}`,
    ""
  ].join("\n");
}

export function createLocaldevWebTransportClientFailureEnvFileContents(config: {
  readonly errorMessage: string;
}): string {
  const sanitizedErrorMessage = sanitizeSingleLineEnvValue(config.errorMessage);

  return [
    `${localdevWebTransportBootStatusEnvName}=${localdevWebTransportSelfCheckFailedStatus}`,
    `${localdevWebTransportBootErrorEnvName}=${sanitizedErrorMessage}`,
    ""
  ].join("\n");
}

export async function verifyLocaldevWebTransportServerHandshake(
  config: {
    readonly certificateSha256Hex: string;
    readonly host: string;
    readonly path?: string;
    readonly port: number;
    readonly timeoutMs?: number;
  },
  dependencies: LocaldevWebTransportHandshakeProbeDependencies = {}
): Promise<void> {
  const createWebTransportClient =
    dependencies.createWebTransportClient ??
    ((url: string, options?: LocaldevWebTransportClientConstructorOptions) =>
      new NodeWebTransport(url, options));
  const timeoutMs = config.timeoutMs ?? 1_500;
  const clearTimeoutImpl =
    dependencies.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
  const targetPath = config.path ?? localdevMetaverseWorldWebTransportPath;
  const targetUrl = `https://${config.host}:${config.port}${targetPath}`;
  let timeoutPromiseClear = () => {};
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = (dependencies.setTimeout ?? globalThis.setTimeout.bind(globalThis))(
      () => {
        reject(
          new Error(
            `Timed out waiting for the localdev WebTransport handshake to open within ${timeoutMs}ms.`
          )
        );
      },
      timeoutMs
    );

    timeoutPromiseClear = () => {
      clearTimeoutImpl(timeoutId);
    };
  });
  let transport: LocaldevWebTransportClientLike | null = null;

  await (dependencies.quicheLoadedPromise ?? quicheLoaded);

  try {
    transport = createWebTransportClient(targetUrl, {
      serverCertificateHashes: [
        Object.freeze({
          algorithm: "sha-256" as const,
          value: decodeSha256Hex(config.certificateSha256Hex)
        })
      ]
    });

    await Promise.race([
      transport.ready ?? Promise.resolve(),
      timeoutPromise
    ]);
  } catch (error) {
    throw new Error(
      `Localdev WebTransport self-check failed for ${targetUrl}: ${resolveErrorMessage(
        error,
        "Opening handshake failed."
      )}`
    );
  } finally {
    timeoutPromiseClear();

    try {
      transport?.close({
        closeCode: 0,
        reason: "localdev-webtransport-self-check-complete"
      });
    } catch {}

    await transport?.closed?.catch(() => undefined);
  }
}

export class LocaldevWebTransportServer {
  readonly #config: LocaldevWebTransportServerConfig;
  readonly #createHttp3Server: (
    config: LocaldevWebTransportServerConfig
  ) => LocaldevHttp3ServerLike;
  readonly #decoder: TextDecoder;
  readonly #duckHuntReliableRoute: ReliableRoute<
    DuckHuntCoopRoomWebTransportClientMessage,
    DuckHuntCoopRoomWebTransportServerMessage,
    DuckHuntCoopRoomWebTransportSession
  >;
  readonly #duckHuntDatagramRoute: DatagramRoute<
    DuckHuntCoopRoomWebTransportClientDatagram,
    ReturnType<DuckHuntCoopRoomWebTransportDatagramAdapter["openSession"]>
  >;
  readonly #encoder: TextEncoder;
  readonly #logError: (message: string, error?: unknown) => void;
  readonly #metaversePresenceReliableRoute: ReliableRoute<
    MetaversePresenceWebTransportClientMessage,
    MetaversePresenceWebTransportServerMessage,
    MetaversePresenceWebTransportSession
  >;
  readonly #metaverseWorldReliableRoute: ReliableRoute<
    MetaverseRealtimeWorldWebTransportClientMessage,
    MetaverseRealtimeWorldWebTransportServerMessage,
    MetaverseWorldWebTransportSession
  >;
  readonly #metaverseWorldDatagramRoute: DatagramRoute<
    MetaverseRealtimeWorldWebTransportClientDatagram,
    MetaverseRealtimeWorldWebTransportDatagramSession
  >;
  readonly #readWallClockMs: () => number;

  #http3Server: LocaldevHttp3ServerLike | null = null;
  #startPromise: Promise<LocaldevHttp3ServerAddress> | null = null;

  constructor(
    config: LocaldevWebTransportServerConfig,
    adapters: {
      readonly duckHuntDatagramAdapter: DuckHuntCoopRoomWebTransportDatagramAdapter;
      readonly duckHuntReliableAdapter: DuckHuntCoopRoomWebTransportAdapter;
      readonly metaversePresenceReliableAdapter: MetaversePresenceWebTransportAdapter;
      readonly metaverseWorldDatagramAdapter: MetaverseRealtimeWorldWebTransportDatagramAdapter;
      readonly metaverseWorldReliableAdapter: MetaverseWorldWebTransportAdapter;
    },
    dependencies: LocaldevWebTransportServerDependencies = {}
  ) {
    this.#config = config;
    this.#createHttp3Server =
      dependencies.createHttp3Server ?? createDefaultHttp3Server;
    this.#decoder = dependencies.textDecoder ?? new TextDecoder();
    this.#duckHuntReliableRoute = Object.freeze({
      createErrorResponse: (message: string) =>
        createDuckHuntCoopRoomWebTransportErrorMessage({
          message
        }),
      openSession: () => adapters.duckHuntReliableAdapter.openSession(),
      parseClientMessage: parseDuckHuntCoopRoomClientMessage,
      path: localdevDuckHuntCoopRoomWebTransportPath
    });
    this.#duckHuntDatagramRoute = Object.freeze({
      openSession: () => adapters.duckHuntDatagramAdapter.openSession(),
      parseClientDatagram: parseDuckHuntCoopRoomClientDatagram,
      path: localdevDuckHuntCoopRoomWebTransportPath
    });
    this.#encoder = dependencies.textEncoder ?? new TextEncoder();
    this.#logError =
      dependencies.logError ??
      ((message, error) => {
        if (error === undefined) {
          console.error(message);
          return;
        }

        console.error(message, error);
      });
    this.#metaversePresenceReliableRoute = Object.freeze({
      createErrorResponse: (message: string) =>
        createMetaversePresenceWebTransportErrorMessage({
          message
        }),
      openSession: () => adapters.metaversePresenceReliableAdapter.openSession(),
      parseClientMessage: parseMetaversePresenceClientMessage,
      path: localdevMetaversePresenceWebTransportPath
    });
    this.#metaverseWorldReliableRoute = Object.freeze({
      createErrorResponse: (message: string) =>
        createMetaverseRealtimeWorldWebTransportErrorMessage({
          message
        }),
      openSession: () => adapters.metaverseWorldReliableAdapter.openSession(),
      parseClientMessage: parseMetaverseWorldClientMessage,
      path: localdevMetaverseWorldWebTransportPath
    });
    this.#metaverseWorldDatagramRoute = Object.freeze({
      openSession: () => adapters.metaverseWorldDatagramAdapter.openSession(),
      parseClientDatagram: parseMetaverseWorldClientDatagram,
      path: localdevMetaverseWorldWebTransportPath
    });
    this.#readWallClockMs = dependencies.readWallClockMs ?? Date.now;
  }

  start(): Promise<LocaldevHttp3ServerAddress> {
    if (this.#startPromise !== null) {
      return this.#startPromise;
    }

    const startPromise = this.#startInternal();
    this.#startPromise = startPromise;

    return startPromise;
  }

  stop(): void {
    this.#http3Server?.stopServer();
  }

  async #startInternal(): Promise<LocaldevHttp3ServerAddress> {
    const http3Server = this.#createHttp3Server(this.#config);

    this.#http3Server = http3Server;
    http3Server.setRequestCallback?.(async (request) =>
      this.#resolveSessionRequest(request)
    );

    const metaversePresenceSessionStream = http3Server.sessionStream(
      this.#metaversePresenceReliableRoute.path
    );
    const metaverseWorldSessionStream = http3Server.sessionStream(
      this.#metaverseWorldReliableRoute.path
    );
    const duckHuntSessionStream = http3Server.sessionStream(
      this.#duckHuntReliableRoute.path
    );

    void this.#acceptSessions(
      metaversePresenceSessionStream,
      this.#metaversePresenceReliableRoute,
      null
    );
    void this.#acceptSessions(
      metaverseWorldSessionStream,
      this.#metaverseWorldReliableRoute,
      this.#metaverseWorldDatagramRoute
    );
    void this.#acceptSessions(
      duckHuntSessionStream,
      this.#duckHuntReliableRoute,
      this.#duckHuntDatagramRoute
    );

    http3Server.startServer();
    await http3Server.ready;

    const address = http3Server.address();

    if (address === null) {
      throw new Error(
        "Localdev WebTransport server started without reporting a listening address."
      );
    }

    return address;
  }

  async #resolveSessionRequest(
    request: LocaldevHttp3ServerSessionRequest
  ): Promise<LocaldevHttp3ServerSessionRequestResult> {
    const resolvedPath = resolveOptionalPathHeader(request.header);

    if (resolvedPath === null) {
      return {
        path: "/",
        status: 400
      };
    }

    return {
      path: resolvedPath,
      status: this.#isKnownSessionPath(resolvedPath) ? 200 : 404
    };
  }

  #isKnownSessionPath(path: string): boolean {
    return (
      path === this.#metaversePresenceReliableRoute.path ||
      path === this.#metaverseWorldReliableRoute.path ||
      path === this.#duckHuntReliableRoute.path
    );
  }

  async #acceptSessions<
    ReliableMessage,
    ReliableResponse,
    ReliableSession extends {
      receiveClientMessage(
        message: ReliableMessage,
        nowMs: number
      ): ReliableResponse;
      dispose(): void;
    },
    DatagramMessage,
    DatagramSession extends {
      receiveClientDatagram(datagram: DatagramMessage, nowMs: number): void;
      dispose(): void;
    }
  >(
    sessionStream: ReadableStream<LocaldevHttp3ServerSessionLike>,
    reliableRoute: ReliableRoute<
      ReliableMessage,
      ReliableResponse,
      ReliableSession
    >,
    datagramRoute: DatagramRoute<DatagramMessage, DatagramSession> | null
  ): Promise<void> {
    const sessionReader = sessionStream.getReader();

    try {
      while (true) {
        const { done, value: session } = await sessionReader.read();

        if (done) {
          return;
        }

        void this.#serveSession(session, reliableRoute, datagramRoute);
      }
    } finally {
      sessionReader.releaseLock();
    }
  }

  async #serveSession<
    ReliableMessage,
    ReliableResponse,
    ReliableSession extends {
      receiveClientMessage(
        message: ReliableMessage,
        nowMs: number
      ): ReliableResponse;
      dispose(): void;
    },
    DatagramMessage,
    DatagramSession extends {
      receiveClientDatagram(datagram: DatagramMessage, nowMs: number): void;
      dispose(): void;
    }
  >(
    session: LocaldevHttp3ServerSessionLike,
    reliableRoute: ReliableRoute<
      ReliableMessage,
      ReliableResponse,
      ReliableSession
    >,
    datagramRoute: DatagramRoute<DatagramMessage, DatagramSession> | null
  ): Promise<void> {
    const reliableSession = reliableRoute.openSession();
    const datagramSession = datagramRoute?.openSession() ?? null;

    try {
      await session.ready;

      void this.#pumpReliableStreams(session, reliableRoute, reliableSession);

      if (datagramRoute !== null && datagramSession !== null) {
        void this.#pumpDatagrams(session, datagramRoute, datagramSession);
      }

      await session.closed.catch(() => undefined);
    } finally {
      reliableSession.dispose();
      datagramSession?.dispose();
    }
  }

  async #pumpReliableStreams<
    ReliableMessage,
    ReliableResponse,
    ReliableSession extends {
      receiveClientMessage(
        message: ReliableMessage,
        nowMs: number
      ): ReliableResponse;
      dispose(): void;
    }
  >(
    session: LocaldevHttp3ServerSessionLike,
    reliableRoute: ReliableRoute<
      ReliableMessage,
      ReliableResponse,
      ReliableSession
    >,
    reliableSession: ReliableSession
  ): Promise<void> {
    const streamReader = session.incomingBidirectionalStreams.getReader();

    try {
      while (true) {
        const { done, value: stream } = await streamReader.read();

        if (done) {
          return;
        }

        void this.#serveReliableStream(stream, reliableRoute, reliableSession);
      }
    } catch (error) {
      if (isExpectedWebTransportSessionCloseError(error)) {
        return;
      }

      this.#logError(
        `Localdev WebTransport reliable stream pump failed for ${reliableRoute.path}.`,
        error
      );
    } finally {
      streamReader.releaseLock();
    }
  }

  async #serveReliableStream<
    ReliableMessage,
    ReliableResponse,
    ReliableSession extends {
      handleClientStream?(
        message: ReliableMessage,
        context: {
          readonly closed: Promise<void>;
          writeResponse(response: ReliableResponse): Promise<void>;
        },
        nowMs: number
      ): Promise<boolean>;
      receiveClientMessage(
        message: ReliableMessage,
        nowMs: number
      ): ReliableResponse;
      dispose(): void;
    }
  >(
    stream: {
      readonly readable: ReadableStream<Uint8Array>;
      readonly writable: WritableStream<Uint8Array>;
    },
    reliableRoute: ReliableRoute<
      ReliableMessage,
      ReliableResponse,
      ReliableSession
    >,
    reliableSession: ReliableSession
  ): Promise<void> {
    const reader = stream.readable.getReader();
    const writer = stream.writable.getWriter();
    let bufferedText = "";

    try {
      while (true) {
        const newlineIndex = bufferedText.indexOf("\n");

        if (newlineIndex >= 0) {
          const rawFrame = bufferedText.slice(0, newlineIndex);
          bufferedText = bufferedText.slice(newlineIndex + 1);

          if (rawFrame.trim().length === 0) {
            continue;
          }

          const parsedResult = this.#parseReliableMessage(rawFrame, reliableRoute);

          if (parsedResult.ok) {
            const nowMs = this.#readWallClockMs();
            const streamHandled =
              (await reliableSession.handleClientStream?.(
                parsedResult.message,
                {
                  closed: reader.closed.catch(() => undefined),
                  writeResponse: async (response) => {
                    await writer.write(
                      this.#encoder.encode(`${JSON.stringify(response)}\n`)
                    );
                  }
                },
                nowMs
              )) ?? false;

            if (streamHandled) {
              return;
            }

            const response = reliableSession.receiveClientMessage(
              parsedResult.message,
              nowMs
            );

            await writer.write(
              this.#encoder.encode(`${JSON.stringify(response)}\n`)
            );
            continue;
          }

          await writer.write(
            this.#encoder.encode(
              `${JSON.stringify(
                reliableRoute.createErrorResponse(parsedResult.message)
              )}\n`
            )
          );
          continue;
        }

        const { done, value } = await reader.read();

        if (done) {
          return;
        }

        bufferedText += this.#decoder.decode(value, {
          stream: true
        });
      }
    } catch (error) {
      if (isExpectedWebTransportSessionCloseError(error)) {
        return;
      }

      this.#logError(
        `Localdev WebTransport reliable request handling failed for ${reliableRoute.path}.`,
        error
      );
    } finally {
      try {
        await writer.close();
      } catch {}

      reader.releaseLock();
      writer.releaseLock();
    }
  }

  #parseReliableMessage<
    ReliableMessage,
    ReliableResponse,
    ReliableSession extends {
      handleClientStream?(
        message: ReliableMessage,
        context: {
          readonly closed: Promise<void>;
          writeResponse(response: ReliableResponse): Promise<void>;
        },
        nowMs: number
      ): Promise<boolean>;
      receiveClientMessage(
        message: ReliableMessage,
        nowMs: number
      ): ReliableResponse;
      dispose(): void;
    }
  >(
    rawFrame: string,
    reliableRoute: ReliableRoute<
      ReliableMessage,
      ReliableResponse,
      ReliableSession
    >
  ):
    | {
        readonly message: ReliableMessage;
        readonly ok: true;
      }
    | {
        readonly message: string;
        readonly ok: false;
      } {
    try {
      const parsedPayload = JSON.parse(rawFrame);
      return {
        message: reliableRoute.parseClientMessage(parsedPayload),
        ok: true
      };
    } catch (error) {
      return {
        message: resolveErrorMessage(
          error,
          "WebTransport request handling failed before the domain adapter accepted the message."
        ),
        ok: false
      };
    }
  }

  async #pumpDatagrams<
    DatagramMessage,
    DatagramSession extends {
      receiveClientDatagram(datagram: DatagramMessage, nowMs: number): void;
      dispose(): void;
    }
  >(
    session: LocaldevHttp3ServerSessionLike,
    datagramRoute: DatagramRoute<DatagramMessage, DatagramSession>,
    datagramSession: DatagramSession
  ): Promise<void> {
    const datagramReader = session.datagrams.readable.getReader();

    try {
      while (true) {
        const { done, value } = await datagramReader.read();

        if (done) {
          return;
        }

        const payload = decodeJsonFrame(value, this.#decoder);
        const datagram = datagramRoute.parseClientDatagram(payload);
        datagramSession.receiveClientDatagram(datagram, this.#readWallClockMs());
      }
    } catch (error) {
      if (isExpectedWebTransportSessionCloseError(error)) {
        return;
      }

      this.#logError(
        `Localdev WebTransport datagram handling failed for ${datagramRoute.path}.`,
        error
      );
    } finally {
      datagramReader.releaseLock();
    }
  }
}
