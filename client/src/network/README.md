# Network README

Role: canonical. Current transport hookup for HTTP fallback, WebTransport
reliable streams, and WebTransport datagrams.

This file documents what the code actually does today so future AWS or bare
metal rollout work can reuse the same paths, env vars, and server owners
without rediscovering them from scratch.

## Current Transport Lanes

| Slice | Reliable path | Datagram path | Client env surface | Current client owners | Current server owners |
| --- | --- | --- | --- | --- | --- |
| Metaverse presence | `/metaverse/presence` | none | `VITE_METAVERSE_REALTIME_TRANSPORT`, `VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL`, `VITE_METAVERSE_PRESENCE_WEBTRANSPORT_SERVER_CERT_SHA256` | `createMetaversePresenceClient()`, `createMetaversePresenceWebTransportTransport()` | `MetaversePresenceWebTransportAdapter` |
| Metaverse authoritative world | `/metaverse/world` | `/metaverse/world` | `VITE_METAVERSE_REALTIME_TRANSPORT`, `VITE_METAVERSE_WORLD_WEBTRANSPORT_URL`, `VITE_METAVERSE_WORLD_WEBTRANSPORT_SERVER_CERT_SHA256` | `createMetaverseWorldClient()`, `createMetaverseWorldWebTransportTransport()`, `createMetaverseRealtimeWorldDriverVehicleControlWebTransportDatagramTransport()` | `MetaverseWorldWebTransportAdapter`, `MetaverseRealtimeWorldWebTransportDatagramAdapter` |
| Duck Hunt co-op | `/experiences/duck-hunt/coop/rooms` | `/experiences/duck-hunt/coop/rooms` | `VITE_DUCK_HUNT_COOP_TRANSPORT`, `VITE_DUCK_HUNT_COOP_WEBTRANSPORT_URL`, `VITE_DUCK_HUNT_COOP_WEBTRANSPORT_SERVER_CERT_SHA256` | `createDuckHuntCoopRoomClient()`, `createCoopRoomWebTransportTransport()`, `createDuckHuntCoopRoomPlayerPresenceWebTransportDatagramTransport()` | `DuckHuntCoopRoomWebTransportAdapter`, `DuckHuntCoopRoomWebTransportDatagramAdapter` |

Reliable metaverse traffic and datagram traffic are intentionally separate:

- presence and world snapshot or command traffic use reliable WebTransport
  streams with HTTP fallback
- world driver control and Duck Hunt player presence may use latest-wins
  WebTransport datagrams with reliable fallback

## Current Runtime Truth

### Browser side

The browser attempts WebTransport only when all of the following are true:

- the preference env is `webtransport-preferred`
- the matching `VITE_*_WEBTRANSPORT_URL` is non-empty
- the browser exposes the native `WebTransport` API

If any of those are false, the client stays on HTTP only.

If WebTransport is configured but fails at runtime:

- reliable traffic falls back to HTTP through
  `createWebTransportHttpFallbackInvoker()`
- datagram traffic falls back to the existing reliable command seam

### Server side

`server/src/index.ts` always boots the plain HTTP server.

The QUIC or HTTP/3 host is different:

- today it is booted only through `LocaldevWebTransportServer`
- that boot path is gated by
  `resolveLocaldevWebTransportServerConfigFromEnvironment(process.env)`
- the current boot env names are all `WEBGPU_METAVERSE_LOCALDEV_*`

That means the client is already capable of targeting a deployed WebTransport
host, but the repo does not yet expose a non-localdev production boot path for
the QUIC server. Before a real rollout, either:

1. promote `LocaldevWebTransportServer` into a normal runtime owner with
   deployment envs, or
2. replace it with another production HTTP/3 or WebTransport adapter that
   reuses the same shared contracts and route paths

Do not rewrite the shared message shapes or lane paths just because the host
environment changes.

## Localdev Hookup

`npm run dev` currently wires WebTransport like this:

1. `tools/dev-server` starts the HTTP server watch flow
2. it generates or rotates the short-lived ECDSA certificate used for browser
   certificate-hash authentication
3. it boots the local QUIC host on a separate port
4. it writes `.local-dev/webgpu-metaverse-dev-client.env`
5. `tools/dev-client` loads that generated env file before Vite starts

Current localdev defaults:

- client app: `http://localhost:5173`
- HTTP server: `http://127.0.0.1:3210`
- localdev WebTransport host: `https://127.0.0.1:3211`

WSL localdev has one extra rule:

- under WSL NAT, `tools/dev-server` now resolves the current WSL guest IPv4,
  binds the QUIC host on `0.0.0.0`, and generates certificate SANs that match
  that guest IP so a Windows browser can handshake successfully

The developer overlay now surfaces the active handshake target directly, so the
browser-side endpoint is inspectable without opening the generated env file.

## Deployment Env Contract

For a deployed client build, the important env contract is:

```dotenv
VITE_SERVER_ORIGIN=https://api.example.com

VITE_METAVERSE_REALTIME_TRANSPORT=webtransport-preferred
VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL=https://realtime.example.com:443/metaverse/presence
VITE_METAVERSE_WORLD_WEBTRANSPORT_URL=https://realtime.example.com:443/metaverse/world

VITE_DUCK_HUNT_COOP_TRANSPORT=webtransport-preferred
VITE_DUCK_HUNT_COOP_WEBTRANSPORT_URL=https://realtime.example.com:443/experiences/duck-hunt/coop/rooms
```

Important details:

- WebTransport URLs must use the `https` scheme
- keep the port explicit in the URL, even when it is `:443`
- `VITE_SERVER_ORIGIN` is the HTTP bootstrap or fallback origin, not the
  WebTransport origin
- the same WebTransport host may serve all three route paths if it can route
  them correctly

Certificate-hash envs are deployment-specific:

- for a publicly trusted certificate, omit the `*_SERVER_CERT_SHA256` envs and
  let the browser use normal Web PKI validation
- for self-signed, private, or ephemeral hosts, provide the
  `*_SERVER_CERT_SHA256` envs and make sure the certificate satisfies browser
  WebTransport custom-certificate rules

The browser factory already supports both modes. It only sends
`serverCertificateHashes` when a hash env is configured.

## Production Hookup Checklist

- Serve the browser app from a secure origin.
- Keep the HTTP API origin available for bootstrap and fallback.
- Stand up a real QUIC or HTTP/3 server for the existing WebTransport paths.
- Preserve the current shared route paths instead of inventing new ones.
- Present a publicly trusted certificate if possible.
- If you must use certificate hashes, rotate the certificate aggressively and
  update the hash envs alongside it.
- Open the required public port for QUIC traffic on the realtime host.
- Verify the in-app developer overlay reports the expected handshake target and
  active datagram lane before load testing gameplay.

## Expected Work To Become AWS Or Bare Metal Compatible

This is the concrete work still expected before the current localdev hookup is
ready to ship on AWS or a bare metal host:

- Promote the current QUIC host out of the localdev-only boot path. Today
  `server/src/index.ts` only starts WebTransport through
  `resolveLocaldevWebTransportServerConfigFromEnvironment(process.env)` and
  `LocaldevWebTransportServer`.
- Split localdev concerns from deployable runtime concerns. Short-lived cert
  generation, self-check files, and generated Vite env files should stay in the
  localdev wrapper; the deployable server owner should only need runtime host,
  port, certificate, key, and secret config.
- Externalize normal server runtime config. The plain HTTP server is still
  hardcoded to `127.0.0.1:3210`, so AWS and bare metal rollout need real envs
  for HTTP bind host or port and for the QUIC or HTTP/3 listener.
- Keep the current route contract unchanged. Production work should reuse the
  existing `/metaverse/presence`, `/metaverse/world`, and
  `/experiences/duck-hunt/coop/rooms` paths and the same adapter owners instead
  of inventing a second transport shape.
- Decide the edge topology early. The realtime host must either run directly on
  the machine or sit behind a QUIC-preserving edge; HTTP-only termination is
  not enough for WebTransport.
- Define certificate strategy per environment. Public production hosts should
  prefer normal Web PKI; private or self-signed deployments need a rotation
  process for the `*_SERVER_CERT_SHA256` envs already supported by the browser
  factory.
- Add production smoke checks and observability. At minimum, log handshake
  open or failure, confirm the datagram lane is active, expose a readiness
  signal for the realtime host, and verify HTTP fallback still works when
  WebTransport is unavailable.

## AWS And Bare Metal Notes

### AWS

AWS documentation currently says:

- Network Load Balancer listeners support `QUIC` and `TCP_QUIC`
- Application Load Balancer listeners support only `HTTP` and `HTTPS`

Inference from those docs: this repo's WebTransport endpoint should sit either
directly on an EC2 host or behind a Network Load Balancer path that preserves
QUIC, not behind an Application Load Balancer.

Practical deployment shape:

- use ALB or another HTTP edge only for the normal web app and HTTP API if you
  want those features
- keep the WebTransport host on a separate hostname or explicit port that
  reaches the QUIC-capable backend unchanged
- terminate or pass through certificates in a way that still leaves the
  backend speaking QUIC or HTTP/3, because the current server adapter owns the
  realtime protocol session itself

Re-check AWS docs before rollout. Their load-balancer protocol support can
change independently of this repo.

### Bare metal

Bare metal is simpler:

- expose the HTTP bootstrap or fallback server normally
- expose the QUIC-capable realtime host on a public `https://host:port` origin
- keep the certificate and key on the realtime host, or use a pass-through
  edge that does not strip QUIC
- route the three fixed paths above into the existing reliable or datagram
  adapter owners

## Code Owners To Reuse For Production

If production rollout work starts from current code, these are the seams worth
reusing instead of replacing:

- `client/src/network/adapters/native-webtransport-browser-factory.ts`
- `client/src/network/adapters/reliable-webtransport-json-request-channel.ts`
- `client/src/network/adapters/latest-wins-webtransport-json-datagram-channel.ts`
- `client/src/metaverse/config/metaverse-presence-network.ts`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/experiences/duck-hunt/network/duck-hunt-coop-network.ts`
- `server/src/adapters/localdev-webtransport-server.ts`
- `server/src/metaverse/adapters/metaverse-presence-webtransport-adapter.ts`
- `server/src/metaverse/adapters/metaverse-world-webtransport-adapter.ts`
- `server/src/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.ts`
- `server/src/experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-adapter.ts`
- `server/src/experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-datagram-adapter.ts`

Those files already define the transport-neutral domain behavior. Production
work should focus on booting them under a deployable QUIC host instead of
changing the contract shape.
