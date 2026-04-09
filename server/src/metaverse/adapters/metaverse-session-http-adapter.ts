import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import { MetaverseSessionRuntime } from "../classes/metaverse-session-runtime.js";

function writeCorsHeaders(
  response: ServerResponse<IncomingMessage>
): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
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

function isMetaverseSessionPath(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  return (
    segments.length === 2 &&
    segments[0] === "metaverse" &&
    segments[1] === "session"
  );
}

export class MetaverseSessionHttpAdapter {
  readonly #metaverseSessionRuntime: MetaverseSessionRuntime;

  constructor(metaverseSessionRuntime: MetaverseSessionRuntime) {
    this.#metaverseSessionRuntime = metaverseSessionRuntime;
  }

  handleRequest(
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
    requestUrl: URL
  ): boolean {
    if (
      request.method !== "GET" ||
      !isMetaverseSessionPath(requestUrl.pathname)
    ) {
      return false;
    }

    writeJson(response, 200, this.#metaverseSessionRuntime.readSessionSnapshot());
    return true;
  }
}
