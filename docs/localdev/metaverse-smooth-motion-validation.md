# Metaverse Smooth Motion Localdev Validation

Role: canonical. Repeatable localhost validation for the current metaverse
smooth-motion slice.

## Scope

Use this when validating the current metaverse shell on `localhost:5173` after
transport, overlay, or vehicle-motion changes.

This document covers:

- default HTTP boot
- WebTransport-preferred boot with the localdev WebTransport host unavailable
- WebTransport-preferred boot with the localdev WebTransport host available
- sustained skiff driving while watching live cadence and transport telemetry

## Preconditions

- run from the repo root
- use the tracked localdev shell flow through Start Metaverse
- use the metaverse developer overlay now rendered in-shell
- when the repo is running inside WSL and the browser is Windows-hosted,
  localdev WebTransport requires WSL mirrored networking instead of NAT
  - the tracked repo helper now writes `%UserProfile%\\.wslconfig` with
    `[wsl2] networkingMode=mirrored`
  - after that file changes, run `wsl --shutdown` from Windows before starting
    `npm run dev` again

## Scenario 1 — Default HTTP

Command:

```bash
VITE_METAVERSE_REALTIME_TRANSPORT=http \
VITE_DUCK_HUNT_COOP_TRANSPORT=http \
npm run dev
```

Expected overlay truth:

- `Presence Reliable` shows `not requested · http`
- `World Reliable` shows `not requested · http`
- `World Driver Datagram` shows `not requested · inactive`
- `World Cadence` shows:
  - `Tick n/a` until authoritative world connection completes
  - `Poll 50 ms`
  - `Interpolation 100 ms`
  - `Extrapolation 90 ms`
  - `Local freshness 90 ms`

Behavior checks:

- Start Metaverse reaches `Boot ready`
- initial shell motion is attributable from the boot cards instead of guesswork
- skiff motion is usable on HTTP, but the overlay makes the polling cost visible

## Scenario 2 — WebTransport Preferred, Host Unavailable

Start a plain HTTP server in one terminal:

```bash
npm run start:server
```

Start the client in another terminal with explicit localhost WebTransport URLs
but without the localdev WebTransport host:

```bash
VITE_METAVERSE_REALTIME_TRANSPORT=webtransport-preferred \
VITE_METAVERSE_WORLD_WEBTRANSPORT_URL=https://127.0.0.1:3211/metaverse/world \
VITE_METAVERSE_PRESENCE_WEBTRANSPORT_URL=https://127.0.0.1:3211/metaverse/presence \
npm run dev:client
```

Expected overlay truth:

- `Presence Reliable` degrades to `localdev host unavailable · http`
- `World Reliable` degrades to `localdev host unavailable · http`
- `World Driver Datagram` stays `active · webtransport datagram` until the
  first driver-control send, then degrades to
  `runtime fallback · reliable command fallback`

Behavior checks:

- Start Metaverse still boots through HTTP fallback
- the overlay distinguishes host absence from default HTTP
- first mounted driver input flips only the datagram lane into degraded state

## Scenario 3 — WebTransport Preferred, Host Available

If the repo is running inside WSL and you open `http://localhost:5173` from a
Windows browser, make sure mirrored WSL networking is active first. NAT mode
is not sufficient for QUIC/WebTransport localdev on this path.

Command:

```bash
VITE_METAVERSE_REALTIME_TRANSPORT=webtransport-preferred \
VITE_DUCK_HUNT_COOP_TRANSPORT=webtransport-preferred \
npm run dev
```

Expected overlay truth:

- `Presence Reliable` reaches `active · webtransport`
- `World Reliable` reaches `active · webtransport`
- `World Driver Datagram` reaches `active · webtransport datagram`
- `World Cadence` shows:
  - `Tick 50 ms` once the authoritative world is connected
  - `Poll 50 ms`
  - `Interpolation 100 ms`
  - `Extrapolation 90 ms`
  - `Local freshness 90 ms`

Behavior checks:

- Start Metaverse reaches `Boot ready`
- the initial boot path no longer hides which transport lanes succeeded
- per-lane transport truth matches the expected WebTransport-preferred mode

## Scenario 4 — Sustained Skiff Drive

Use Scenario 3 when possible. If WebTransport is unavailable on the current
machine, run this on Scenario 1 as a comparison pass and note the difference in
overlay truth.

Checks while driving:

- the local skiff does not correct from delayed remote vehicle presentation
- routine correction feels blended instead of periodic forward snapping
- gross correction only occurs after a real divergence event, seat change, or
  authority context change
- the overlay keeps reporting:
  - `Tick 50 ms`
  - `Poll 50 ms`
  - `Interpolation 100 ms`
  - `Extrapolation 90 ms`
  - `Local freshness 90 ms`

## Capture

When a regression is found, capture:

- the scenario command used
- the overlay transport and cadence values
- whether the failure appeared before or after `Boot ready`
- whether the issue happened on foot, swim, or mounted skiff motion
