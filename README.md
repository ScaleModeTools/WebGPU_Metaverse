# WebGPU Metaverse

WebGPU Metaverse is a metaverse-first browser game repo. It ships one React
WebGPU shell, one Node server gateway, and one shared contract package. The
first integrated experience is `duck-hunt`, which supports local
single-player and server-authoritative co-op.

## Current Status

- the multiplayer battle readiness push is implemented: authoritative tick and
  time semantics, server-pushed snapshot streams, latest-wins realtime input
  lanes, server-authoritative metaverse movement validation, and Duck Hunt
  combat rewind validation are all live behind the repo stop-ship gate
- metaverse shell flow is live: profile setup -> metaverse hub -> experience
  launch -> return to hub without a full reload
- the first admin-only engine tool is live under `client/src/engine-tool`: a
  full-screen map editor with a Three.js viewport, authored draft state, and
  shadcn-driven library/inspector panels
- map preview no longer depends on live editor object graphs: `Run` validates,
  exports, and launches through runtime-facing bundle loaders, and authored
  launch variations can now describe combinations such as map + experience +
  gameplay variation + weapon layout + vehicle layout
- the current metaverse world starts from the staging-ground/playground slice:
  the shared floor, barriers, authored water bay, and canonical grounded spawn
  are the active world owners across client, server, render, and collision
- unmounted authoritative body truth now rides one traversal lane: movement,
  facing, locomotion mode, and action intent stay together instead of being
  split across traversal plus a second unmounted look lane
- local-player authority now validates in the background instead of replaying
  routine server corrections; the client stays visually smooth unless
  gameplay-invalid or grossly divergent state forces a snap
- metaverse runtime frames stay render-owned: network callbacks publish state,
  but they do not advance traversal or render work outside the animation frame
- metaverse vehicle-seat foundation is live: manifest-driven seats and
  boarding entries, seat-role camera and control policy, solid dynamic skiff
  collision, and explicit attachment grip alignment
- Duck Hunt is the first fully integrated experience under
  `src/experiences/duck-hunt`
- WebGPU stays behind an explicit capability gate
- hand tracking stays worker-first and optional; mouse-first flows remain
  available where camera setup is unnecessary
- shared and server metaverse presence now replicate mounted occupancy so
  remote avatars can occupy the correct vehicle seat or boarding state
- localhost development now supports WebTransport-preferred metaverse boot with
  HTTP bootstrap and fallback still intact
- metaverse and Duck Hunt realtime networking now use persistent authoritative
  snapshot streams plus separate reliable and latest-wins datagram lanes
- shared browser services such as `audio`, `network`, `tracking`, and `ui`
  stay top-level reusable domains

## What Works Today

- profile, audio, calibration, and input-mode persistence
- metaverse staging-ground runtime with typed keyboard and mouse control modes
- manifest-driven mountable vehicle runtime with authored seats and boarding
  entries
- driver and passenger seat-role policies for camera, input routing, and
  occupant animation
- dynamic skiff hull, deck, and seat-support collision in local physics
- remote metaverse presence that keeps mounted occupants attached to the
  correct vehicle seat
- authoritative metaverse world and Duck Hunt room progression on independent
  server tick owners
- WebTransport-preferred metaverse presence, world snapshot streaming, and
  Duck Hunt room snapshot streaming with HTTP bootstrap and fallback
- latest-wins WebTransport datagrams for metaverse driver vehicle control and
  traversal intent plus Duck Hunt player presence, with recoverable reliable
  fallback when datagrams are unavailable
- server-authoritative metaverse traversal with shared input ack semantics and
  local-player validation that no longer depends on replay smoothing
- shared metaverse world authoring that owns spawn, support, water regions,
  and active surface layout for both client and server
- Duck Hunt co-op buffered room projection and authoritative combat rewind
  validation
- explicit forward/up grip alignment for handheld socket attachments
- Duck Hunt launch flow from the shell into gameplay and back out again
- Duck Hunt mouse input and camera thumb-trigger input
- nine-point affine aim calibration for tracked input
- worker-first MediaPipe Hand Landmarker integration
- WebGPU gameplay runtime using `three/webgpu` and `three/tsl`
- local single-player Duck Hunt
- server-ticked co-op Duck Hunt rooms
- shared shell and gameplay audio with Strudel BGM plus Web Audio SFX
- runtime, typecheck, and bench gates through the repo entrypoints
- admin-only map editing with saved tool drafts and authored launch-variation
  preview selection

## What We Are Building Now

The current refactor focus is a real authored content pipeline rather than more
runtime-side assembly.

In practice that means:

- build maps through an admin-only editor under `client/src/engine-tool`
- store tool-only draft state separately from shipped runtime artifacts
- export shared authored map bundles and launch variations that both client and
  server can consume
- launch preview content through the same runtime-facing loaders the shipped
  shell uses, not through hidden editor-only code paths

The gameplay trust model is broader than "the editor prevents cheating."

What actually matters is:

- gameplay-affecting truth lives in shared contracts and small shared kernels
  where client prediction and server authority must agree
- the server remains authoritative for live gameplay outcomes
- the editor is only an authoring surface; it must not bypass validation,
  export, or runtime bootstrap seams

The long-term target is content authoring that can express combinations such as
`Team Slayer on Gladiation` where the map, mode or session variation, weapon
layout, and vehicle layout are authored selections instead of ad hoc runtime
assembly.

## Control Surfaces

### Metaverse
- `keyboard + mouse`: `W/S` forward and backward, `A/D` strafe, move mouse to
  look, `Space` jump, `Shift` boost, left click primary action, right click
  secondary action

### Duck Hunt

- `mouse`: direct cursor aim and click-to-fire
- `camera-thumb-trigger`: aim with the tracked thumb-gun pose and fire by
  dropping the thumb relative to the index finger

## Repo Shape

```text
client/src
  app/                      # shell composition only
  engine-tool/              # admin-only map editor and run/save workflows
  metaverse/                # world runtime, traversal, render, vehicles, HUD
  experiences/duck-hunt/    # Duck Hunt-owned client code
  tracking/                 # shared hand/cursor tracking owners
  audio/                    # shared browser audio services
  navigation/               # shell flow legality and routing
  network/                  # shared transport and persistence adapters
  ui/                       # shared UI primitives and overlays

server/src
  metaverse/                # world authority, presence, and session runtime
  experiences/duck-hunt/    # Duck Hunt authority, rooms, ticks
  index.ts                  # gateway composition root

packages/shared/src
  metaverse/                # shared world/traversal/session contracts
  experiences/duck-hunt/    # Duck Hunt snapshots, commands, events

tests
  runtime/                  # runtime behavior coverage
  typecheck/                # public contract type coverage
```

For new work, metaverse-wide shell code belongs in `metaverse` domains and
experience-local code belongs in `experiences/<experienceId>`. Top-level
service domains such as `audio`, `network`, `tracking`, and `ui` are for
cross-experience reuse, not Duck Hunt-specific policy.

Within the metaverse client domain, reusable vehicle and seat ownership lives
under `client/src/metaverse/vehicles` instead of being smeared across scene
and traversal hotspots.

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

This starts the client and the server together. In localdev it also boots the
localhost WebTransport host when the transport preference is enabled and the
local certificate flow is available.

From the normal shell/dev flow, use the in-app `Open Tool` action to enter the
admin-only editor. The editor is lazy-loaded and should not add normal runtime
cost unless you open it.

### Prefer WebTransport In Localdev

Use these env vars to prefer WebTransport for the metaverse shell and Duck Hunt
co-op:

```bash
VITE_METAVERSE_REALTIME_TRANSPORT=webtransport-preferred \
VITE_DUCK_HUNT_COOP_TRANSPORT=webtransport-preferred \
npm run dev
```

When `npm run dev` boots the localdev WebTransport host successfully, it
generates the localhost WebTransport URLs and certificate hashes automatically.
You do not need to hand-write those values for the standard localhost flow.

### Run Separately

```bash
npm run dev:client
npm run dev:server
```

Default local ports:

- client dev server: `http://localhost:5173`
- client preview: `http://localhost:4173`
- server: `http://127.0.0.1:3210`
- localdev WebTransport host: `https://127.0.0.1:3211`

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
- The localdev WebTransport host is separate from the HTTP server and runs on
  `https://127.0.0.1:3211` when enabled by `npm run dev`.
- Reliable snapshot subscriptions, reliable commands, and latest-wins datagram
  traffic are distinct lanes:
  - metaverse world snapshots and Duck Hunt room snapshots can use persistent
    reliable WebTransport subscriptions
  - presence and discrete world or room commands use reliable transport
  - metaverse traversal intent, metaverse driver vehicle control, and Duck
    Hunt player presence can use WebTransport datagrams
- If WebTransport is unavailable in localdev, reliable traffic falls back to
  HTTP and datagram traffic falls back to the existing reliable command path.
- Reliable and datagram gameplay lanes bind to the server-owned session
  identity instead of trusting raw payload player ids.
- Shared metaverse world changes affect both browser-side source imports and
  the server's built `packages/shared/dist` output in localdev. Rebuild shared
  or use the managed watch flow before diagnosing client/server drift.
- Metaverse presence traffic lives under `/metaverse/presence` and now carries
  mounted occupancy as well as pose.
- Duck Hunt co-op traffic lives under `/experiences/duck-hunt/coop/rooms`.
- If needed, the client can target a different server origin through
  `VITE_SERVER_ORIGIN`.
- For the current localhost validation matrix, see
  `docs/localdev/metaverse-smooth-motion-validation.md`.
- For the implemented multiplayer push record, see
  `docs/localdev/metaverse-multiplayer-battle-readiness-plan.md`.

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
