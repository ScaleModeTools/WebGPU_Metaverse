# WebGPU Metaverse

WebGPU Metaverse is a metaverse-first browser game repo. It ships one React
WebGPU shell, one Node server gateway, and one shared contract package. The
first integrated experience is `duck-hunt`, which supports local
single-player and server-authoritative co-op.

## Current Status

- metaverse shell flow is live: profile setup -> metaverse hub -> experience
  launch -> return to hub without a full reload
- Duck Hunt is the first fully integrated experience under
  `src/experiences/duck-hunt`
- WebGPU stays behind an explicit capability gate
- hand tracking stays worker-first and optional; mouse-first flows remain
  available where camera setup is unnecessary
- shared browser services such as `audio`, `network`, `tracking`, and `ui`
  stay top-level reusable domains

## What Works Today

- profile, audio, calibration, and input-mode persistence
- metaverse hub runtime with typed keyboard and mouse control modes
- Duck Hunt launch flow from the shell into gameplay and back out again
- Duck Hunt mouse input and camera thumb-trigger input
- nine-point affine aim calibration for tracked input
- worker-first MediaPipe Hand Landmarker integration
- WebGPU gameplay runtime using `three/webgpu` and `three/tsl`
- local single-player Duck Hunt
- server-ticked co-op Duck Hunt rooms
- shared shell and gameplay audio with Strudel BGM plus Web Audio SFX
- runtime, typecheck, and bench gates through the repo entrypoints

## Control Surfaces

### Metaverse Hub

- `keyboard`: `W/S` move, `A/D` pan, `Q/E` tilt, `Shift` boost
- `mouse`: left click forward, right click backward, edge-based pan/tilt,
  Mouse Button 4 boost

### Duck Hunt

- `mouse`: direct cursor aim and click-to-fire
- `camera-thumb-trigger`: aim with the tracked thumb-gun pose and fire by
  dropping the thumb relative to the index finger

## Repo Shape

```text
client/src
  app/                      # shell composition only
  metaverse/                # hub runtime, state, components, render
  experiences/duck-hunt/    # Duck Hunt-owned client code
  tracking/                 # shared hand/cursor tracking owners
  audio/                    # shared browser audio services
  navigation/               # shell flow legality and routing
  network/                  # shared transport and persistence adapters
  ui/                       # shared UI primitives and overlays

server/src
  metaverse/                # hub authority and session runtime
  experiences/duck-hunt/    # Duck Hunt authority, rooms, ticks
  index.ts                  # gateway composition root

packages/shared/src
  metaverse/                # experience ids, launch/session contracts
  experiences/duck-hunt/    # Duck Hunt snapshots, commands, events

tests
  runtime/                  # runtime behavior coverage
  typecheck/                # public contract type coverage
```

For new work, metaverse-wide shell code belongs in `metaverse` domains and
experience-local code belongs in `experiences/<experienceId>`. Top-level
service domains such as `audio`, `network`, `tracking`, and `ui` are for
cross-experience reuse, not Duck Hunt-specific policy.

## Workspace Packages

- root package: `webgpu-metaverse`
- client workspace: `@webgpu-metaverse/client`
- server workspace: `@webgpu-metaverse/server`
- shared contract workspace: `@webgpu-metaverse/shared`

## Getting Started

### Requirements

- Node `>=24.13.0`
- npm `>=11.6.2`

### Install

```bash
npm install
```

### Run Everything

```bash
npm run dev
```

This starts the client and the server together.

### Run Separately

```bash
npm run dev:client
npm run dev:server
```

Default local ports:

- client dev server: `http://localhost:5173`
- client preview: `http://localhost:4173`
- server: `http://127.0.0.1:3210`

### Build And Verify

```bash
./tools/build
./tools/test
./tools/bench
./tools/verify
```

`./tools/verify` is the stop-ship gate.

## Runtime Notes

- Use `http://localhost:5173/` when testing on the same machine. Plain HTTP LAN
  origins do not satisfy the WebGPU secure-context requirement that
  `localhost` does.
- The client proxies `/metaverse/*` and `/experiences/*` requests to the local
  server during development.
- Duck Hunt co-op traffic lives under `/experiences/duck-hunt/coop/rooms`.
- If needed, the client can target a different server origin through
  `VITE_SERVER_ORIGIN`.

## Contributor Orientation

- Root repo law lives in `AGENTS.md`.
- `packages/shared` is the only cross-workspace contract surface.
- Metaverse shell code lives in `client/src/metaverse` and experience-local
  code lives in `client/src/experiences/<experienceId>`.

## Locked Tech

- React 19 + Vite client shell
- shadcn (`radix-nova`) UI stack
- Node TypeScript server
- `three/webgpu` + `three/tsl` gameplay rendering
- MediaPipe hand tracking behind a worker boundary
- Strudel background music
- raw Web Audio API sound effects
- 2D affine calibration as the first tracked-input transform
