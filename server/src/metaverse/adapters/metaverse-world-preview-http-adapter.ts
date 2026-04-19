import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import { registerAuthoritativeMetaverseMapBundlePreview } from "../world/map-bundles/load-authoritative-metaverse-map-bundle.js";
import { MetaverseAuthoritativeWorldRuntimeHost } from "../classes/metaverse-authoritative-world-runtime-host.js";

function writeCorsHeaders(
  response: ServerResponse<IncomingMessage>
): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-max-age", "86400");
}

function writeJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown
): void {
  writeCorsHeaders(response);
  response.writeHead(statusCode, {
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecordField(
  value: unknown,
  fieldName: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected object field: ${fieldName}`);
  }

  return value;
}

function readOptionalStringField(
  value: unknown,
  fieldName: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected string field: ${fieldName}`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error(`Expected non-empty string field: ${fieldName}`);
  }

  return normalizedValue;
}

function readJsonBody(
  request: IncomingMessage
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function isMetaverseWorldPreviewBundlePath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 3 &&
    segments[0] === "metaverse" &&
    segments[1] === "world" &&
    segments[2] === "preview-bundles"
  );
}

export class MetaverseWorldPreviewHttpAdapter {
  readonly #runtimeHost: MetaverseAuthoritativeWorldRuntimeHost;

  constructor(runtimeHost: MetaverseAuthoritativeWorldRuntimeHost) {
    this.#runtimeHost = runtimeHost;
  }

  async handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL
  ): Promise<boolean> {
    if (!isMetaverseWorldPreviewBundlePath(requestUrl.pathname)) {
      return false;
    }

    if (request.method !== "POST") {
      writeJson(response, 405, {
        error: "Method not allowed."
      });
      return true;
    }

    try {
      const requestBody = readRecordField(
        await readJsonBody(request),
        "request"
      );
      const previewEntry = registerAuthoritativeMetaverseMapBundlePreview(
        requestBody.bundle,
        readOptionalStringField(
          requestBody.sourceBundleId,
          "request.sourceBundleId"
        )
      );

      this.#runtimeHost.activateBundle(previewEntry.bundleId);
      this.#runtimeHost.advanceToTime(Date.now());

      writeJson(response, 200, {
        bundleId: previewEntry.bundleId,
        label: previewEntry.bundle.label,
        sourceBundleId: previewEntry.sourceBundleId,
        status: "registered"
      });
    } catch (error) {
      writeJson(response, 400, {
        error:
          error instanceof Error
            ? error.message
            : "Metaverse world preview registration failed."
      });
    }

    return true;
  }
}
