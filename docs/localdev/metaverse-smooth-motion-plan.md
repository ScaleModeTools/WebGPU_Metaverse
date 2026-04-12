# Metaverse Smooth Motion Plan

Role: plan. Durable code-grounded plan for the next metaverse shell slice
focused on smooth hub motion, explicit transport visibility, and correct local
vehicle reconciliation.

Status: proposed.

## Goal

Fix the current motion-facing issues in the metaverse shell by:

- making `npm run dev` on `localhost:5173` able to exercise a real localdev
  WebTransport path when configured
- restoring a metaverse developer overlay with renderer and transport truth
- making startup boot and transport behavior visible instead of inferred
- removing delayed remote interpolation from the locally driven skiff path
- preserving authoritative vehicle correction without periodic forward snaps
- tightening metaverse world cadence so skiff motion is not driven from a
  vehicle-hostile tick budget

## Read This First

This document is intended to run from fresh context.

Code is the primary source of truth for this plan.

Before implementation:

1. re-read the required `AGENTS.md` surfaces for repo law and domain
   boundaries
2. inspect the current runtime code paths listed below
3. treat docs as planning memory only; the repo must back every claim in code

Required steering surfaces:

- `AGENTS.md`
- `client/AGENTS.md`
- `client/src/AGENTS.md`
- `client/src/network/AGENTS.md`
- `client/src/metaverse/AGENTS.md`
- `server/AGENTS.md`
- `server/src/metaverse/AGENTS.md`

Do not assume chat context not restated here.

## Current Audited Files

- `client/src/metaverse/components/metaverse-stage-screen.tsx`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `client/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/config/metaverse-presence-network.ts`
- `client/src/metaverse/config/metaverse-runtime.ts`
- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/vite.config.ts`
- `client/src/network/classes/metaverse-world-client.ts`
- `client/src/network/classes/metaverse-presence-client.ts`
- `client/src/network/adapters/webtransport-http-fallback.ts`
- `client/src/network/adapters/reliable-webtransport-json-request-channel.ts`
- `server/src/index.ts`
- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- `server/src/metaverse/config/metaverse-authoritative-world-runtime.ts`
- `tools/dev`
- `tools/dev-client`
- `tools/dev-server`
- `tests/runtime/client/metaverse-runtime.test.mjs`
- `tests/runtime/server/metaverse-authoritative-world-runtime.test.mjs`

## Repo Review Summary

- The metaverse shell currently has no developer telemetry owner.
  Evidence:
  - `MetaverseStageScreen` renders shell cards only
  - `MetaverseHudSnapshot` exposes lifecycle, focus, locomotion, and presence
    state, but no renderer or transport telemetry
- The current metaverse transport mode is not visible to users.
  Evidence:
  - `metaverse-presence-network.ts` and `metaverse-world-network.ts` default to
    HTTP unless `VITE_METAVERSE_REALTIME_TRANSPORT=webtransport-preferred`
  - `createWebTransportHttpFallbackInvoker()` silently and permanently falls
    back to HTTP after a WebTransport channel failure
  - no metaverse HUD or panel shows preferred transport, active transport, or
    fallback state
- `npm run dev` currently boots a Vite client plus an HTTP-only Node server,
  not a live localdev WebTransport host.
  Evidence:
  - `tools/dev` starts `dev:client` and `dev:server`
  - `client/vite.config.ts` proxies `/metaverse` and `/experiences` HTTP
    traffic to `http://127.0.0.1:3210`
  - `server/src/index.ts` uses `node:http` and exposes only HTTP request
    handling
- The current transport truth is lane-specific, not one global metaverse mode.
  Evidence:
  - presence has its own reliable transport selection
  - metaverse world snapshots and commands have their own reliable transport
    selection
  - metaverse driver vehicle control can separately degrade from WebTransport
    datagrams to reliable command transport
- The current localdev shell cannot distinguish default HTTP from attempted
  WebTransport fallback.
  Evidence:
  - the network config defaults to HTTP when the preference or URL env is
    absent
  - the fallback owner only flips after a WebTransport runtime failure
- The current metaverse world cadence is coarse for driven vehicle motion.
  Evidence:
  - `MetaverseWorldClient` defaults to `defaultPollIntervalMs: 150`
  - `MetaverseAuthoritativeWorldRuntime` ticks at `150ms`
  - `metaverseRemoteWorldSamplingConfig` uses `interpolationDelayMs: 225`
- The locally driven skiff currently consumes the wrong authority path.
  Evidence:
  - `WebGpuMetaverseRuntime.#syncFrame()` applies
    `remoteWorldRuntime.remoteVehiclePresentations` into traversal before local
    mounted advance
  - `remoteVehiclePresentations` come from
    `MetaverseRemoteWorldRuntime.sampleRemoteWorld()`, which is deliberately
    delayed and designed for remote interpolation
- Local vehicle correction currently destroys local motion continuity.
  Evidence:
  - `MetaverseVehicleRuntime.syncAuthoritativePose()` resets planar, forward,
    and strafe speeds to zero on every correction
  - the authoritative world snapshot already contains vehicle linear and
    angular velocity, but the local mounted reconciliation path does not use
    that velocity on correction

## Product Symptoms To Solve

1. the metaverse developer panel is missing, including renderer counts such as
   triangles
2. Start Metaverse feels initially laggy, but there is no visible signal for
   whether the delay comes from renderer warmup, world bootstrap, default HTTP,
   or WebTransport fallback
3. the locally driven skiff shows periodic forward correction as authority
   catches up with client motion

## Target Runtime Model

- localdev boot owns one explicit WebTransport-capable dev path beside the
  existing HTTP proxy path so `npm run dev` can exercise real WebTransport when
  configured
- metaverse runtime owns one explicit shell developer telemetry snapshot for:
  - frame rate
  - renderer label
  - draw calls
  - triangle count
  - device pixel ratio
  - WebGPU availability or active renderer state
- network clients own explicit per-lane transport status snapshots for:
  - configured preference
  - whether the WebTransport URL or config is present
  - whether the browser WebTransport API is available
  - currently active reliable transport
  - whether reliable fallback is active
  - whether the world driver datagram lane is available or has degraded to
    reliable fallback
  - last transport error when relevant
- metaverse HUD adapts that telemetry and transport truth into shell-facing UI
- remote player and remote vehicle presentation continues to derive from
  delayed authoritative snapshot sampling
- the locally owned mounted driver path consumes latest authoritative vehicle
  truth only when it is still fresh enough for reconciliation, and otherwise
  continues local prediction until fresher authority arrives
- the locally owned mounted driver path keeps local prediction driven by local
  control intent, while authoritative snapshots reconcile predicted vehicle
  state rather than replacing local input handling
- local driver vehicle correction uses explicit thresholded reconciliation:
  blend routine error, snap only on gross divergence or invalid ownership or
  occupancy context
- authoritative vehicle freshness and correction budgets are retuned together
  with metaverse world cadence so stale authority does not become a hidden
  local snap source
- the local driver path uses explicit config-owned starting values instead of
  qualitative-only feel goals; initial tuning targets should be visible and
  adjustable in code even if later slices retune them
- authoritative metaverse world cadence is tightened enough for vehicle motion
  to feel continuous
- metaverse developer overlay consumes existing runtime telemetry and transport
  truth surfaces rather than inventing its own diagnostic state

## Runtime Laws For This Slice

- metaverse developer UI must read actual runtime telemetry, not guessed values
- the shell must not infer active transport from env config alone; it must show
  actual active mode, fallback state, and whether WebTransport was even
  configured to boot
- `npm run dev` localdev must not claim WebTransport support without a real
  localdev WebTransport host and reachable WebTransport URLs
- the shell must distinguish:
  - default HTTP because WebTransport preference or URLs were never configured
  - WebTransport preferred but unavailable because the browser API is missing
  - WebTransport preferred but unavailable because the localdev host is absent
  - WebTransport attempted and then degraded to HTTP fallback
- metaverse presence, metaverse world reliable transport, and metaverse world
  driver datagram transport must keep separate status surfaces; do not collapse
  them into one ambiguous transport badge
- remote interpolation may remain delayed and snapshot-targeted
- the locally owned mounted driver vehicle must not consume delayed remote
  vehicle presentation as its correction source
- the local driver reconciliation path must evaluate authoritative vehicle
  freshness against estimated server time before applying correction; stale
  snapshots must not become hard correction targets
- local driver correction must use explicit thresholded reconciliation:
  - blend position or yaw error when it is within the routine correction budget
  - snap only when error exceeds a gross-divergence threshold or when the
    authoritative vehicle or occupancy context changes
- local prediction must remain driven by current local control intent, not by
  echoed authoritative control state or delayed server snapshots
- authoritative correction may update local driver reconciliation state, but it
  must not zero useful velocity state on every correction if authoritative
  velocity already exists
- initial local driver reconciliation and cadence tuning values must live in
  explicit config owners, not as hidden literals spread across runtime code
- remote rendering must continue to derive from authoritative snapshots only
- transport diagnostics must stay transport-owned in `client/src/network`, not
  in metaverse JSX

## Step 1 — Boot Localdev WebTransport Properly

Status: completed.

Work:

- add a real localdev WebTransport-capable host to the `npm run dev` path
  instead of relying only on the current HTTP server and Vite proxy
- use explicit first-slice localdev defaults so implementation and validation
  do not hide behind qualitative wording:
  - localdev WebTransport host: `127.0.0.1`
  - localdev WebTransport port: `3211`
  - localdev ready file: `.local-dev/webgpu-metaverse-dev-server.ready`
  - localdev client env file:
    `.local-dev/webgpu-metaverse-dev-client.env`
- keep `server/src/index.ts` thin by composing existing headless metaverse and
  Duck Hunt WebTransport session adapters into that live host rather than
  moving domain logic into the transport bootstrap
- add explicit localdev env wiring for:
  - metaverse presence WebTransport URL
  - metaverse world WebTransport URL
  - any local certificate or certificate-hash requirements the chosen host
    needs
- keep HTTP bootstrap, Vite HTTP proxying, and HTTP fallback alive for the same
  localdev session
- make the localdev boot path deterministic enough that `localhost:5173` can
  exercise real WebTransport intentionally rather than only reporting HTTP

Likely owners:

- `tools/dev-server`
- `server/src/index.ts`
- `server/src/metaverse/adapters`
- `server/src/experiences/duck-hunt/adapters`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/config/metaverse-presence-network.ts`

Exit check:

- from `npm run dev` on `localhost:5173`, WebTransport-preferred localdev can
  establish a real WebTransport path when configured, instead of silently
  staying on HTTP because no host exists

## Step 2 — Surface Boot And Transport Truth

Status: completed.

Work:

- add explicit transport status snapshots for metaverse presence and metaverse
  world clients
- surface:
  - transport preference
  - whether WebTransport URL or config is present
  - whether browser WebTransport API is present
  - active reliable transport
  - reliable fallback active or not
  - world driver datagram lane active, unavailable, or degraded to reliable
  - last transport-level error when relevant
- add boot-phase telemetry for:
  - renderer init
  - scene prewarm
  - presence joined
  - authoritative world connected
- if localdev is simply using HTTP by default, make that explicit in runtime
  truth instead of treating it like an unknown
- if WebTransport was preferred but did not boot, expose whether that came from
  missing env, missing browser API, missing localdev host, or runtime fallback
- keep this step truth-first and testable without depending on the overlay UI
  being restored in the same slice

Likely owners:

- `client/src/network`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`

Exit check:

- Start Metaverse can report whether each metaverse transport lane is using
  HTTP or WebTransport, whether that lane fell back, and whether WebTransport
  was never configured versus attempted and degraded
- startup lag can be attributed to a concrete boot phase instead of guesswork

## Step 3 — Restore Metaverse Developer Overlay

Status: completed.

Work:

- add a metaverse-local developer overlay back to `MetaverseStageScreen`
- expose metaverse runtime telemetry through `MetaverseHudSnapshot`
- consume the transport and boot-phase truth added in Step 2 instead of
  re-deriving transport state inside JSX
- include at minimum:
  - frame rate
  - renderer label
  - draw calls
  - triangles
  - device pixel ratio
  - active WebGPU state
  - transport and boot-phase diagnostics from Step 2
- keep this metaverse-local for now; do not widen the Duck Hunt gameplay debug
  menu controller unless a real cross-shell control need appears

Likely owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/src/metaverse/components/metaverse-stage-screen.tsx`

Exit check:

- the metaverse shell again shows live renderer telemetry, including triangles,
  and it displays the runtime transport truth from Step 2 without inventing
  duplicate state

## Step 4 — Split Local Driver Reconciliation From Remote Interpolation

Status: completed.

Work:

- keep delayed authoritative sampling for remote players and remote vehicles
- add a separate latest-authoritative vehicle reconciliation path for the local
  mounted driver
- stop applying delayed `remoteVehiclePresentations` to the locally owned
  mounted vehicle
- ensure the local driver vehicle uses the newest authoritative vehicle truth
  available from the world snapshot path
- add an explicit freshness guard for local driver reconciliation so stale
  authoritative snapshots do not become hard correction targets
- if the newest available authoritative vehicle snapshot is outside the local
  freshness budget, keep local prediction running from local input and wait for
  fresher authority rather than snapping back to stale truth
- keep local prediction driven by local control intent, not by echoed
  authoritative control state
- add explicit config-owned starting targets for the first slice, for example:
  - local authoritative freshness max age: `120ms`
  - local stale-authority hold behavior: continue local prediction until a
    fresher snapshot arrives instead of snapping to the stale snapshot

Likely owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `client/src/metaverse/config`

Exit check:

- the local skiff is no longer corrected from the delayed remote interpolation
  path
- stale authoritative vehicle snapshots no longer cause local backward snaps or
  similar reconciliation jitter

## Step 5 — Preserve Motion Continuity During Vehicle Correction

Status: completed.

Work:

- stop zeroing local mounted vehicle speed state on every authoritative pose
  sync
- use authoritative vehicle velocity during correction when available
- add an explicit thresholded correction policy that keeps local motion
  continuous while still respecting server truth
- blend position and yaw correction over time for routine in-range divergence
- snap only when divergence exceeds a gross-correction threshold or when
  authoritative vehicle identity or occupancy context changes
- keep authoritative snapshots as the final owner of vehicle position and yaw
- add explicit config-owned starting thresholds for the first slice, for
  example:
  - routine position blend threshold: `0.9m`
  - routine yaw blend threshold: `0.18rad`
  - gross snap distance threshold: `3.5m`
  - gross snap yaw threshold: `0.75rad`
- treat those as initial localdev tuning values, not permanent law, and retune
  them only through the owning config surface

Likely owners:

- `client/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `client/src/metaverse/config`
- `packages/shared/src/metaverse`
  only if the local correction path truly needs more explicit shared fields than
  already exist

Exit check:

- local skiff correction no longer produces periodic forward boost from repeated
  underprediction
- routine local vehicle correction is blended rather than hard-snapped

## Step 6 — Tighten Metaverse World Cadence For Motion

Status: completed.

Work:

- lower metaverse authoritative world tick interval from the current `150ms`
  to the first-slice config-owned target of `50ms`
- lower metaverse world polling interval to match the tighter authoritative
  cadence at `50ms`
- retune the first-slice motion budgets around that cadence:
  - remote interpolation delay: `100ms`
  - max extrapolation budget: `90ms`
  - local authoritative freshness max age: `90ms`
- publish those cadence values through runtime telemetry so localdev can verify
  the actual motion budget instead of guessing from feel alone
- keep HTTP bootstrap and fallback alive, but make the cost of HTTP polling
  explicit in telemetry

Likely owners:

- `server/src/metaverse/config/metaverse-authoritative-world-runtime.ts`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`

Exit check:

- metaverse vehicle and remote shell motion no longer run on a visibly coarse
  `150ms` cadence
- runtime telemetry exposes the live cadence budget being used for world tick,
  poll, interpolation, extrapolation, and local authoritative freshness

## Step 7 — Tighten Tests And Localdev Validation

Status: completed.

Work:

- add runtime tests for:
  - localdev transport status reporting for:
    - default HTTP
    - WebTransport preferred but unconfigured
    - WebTransport preferred with runtime fallback
    - separate world reliable and world datagram lane truth
  - metaverse developer telemetry publication
  - transport status and fallback visibility
  - startup boot-phase progression
  - local driver vehicle reconciliation using latest authority instead of
    delayed remote interpolation
  - stale authoritative snapshot guarding for the local driver reconciliation
    path
  - thresholded local correction behavior:
    - blend for routine in-range divergence
    - snap only for gross divergence or invalid authority context
  - local driver prediction staying input-driven rather than following echoed
    authoritative control state
  - vehicle correction continuity when authoritative velocity is present
  - metaverse world cadence retuning without stale snapshot regressions
- add a tracked localdev validation matrix for:
  - Start Metaverse on default HTTP config
  - Start Metaverse on WebTransport-preferred config with the localdev
    WebTransport host intentionally unavailable
  - Start Metaverse on WebTransport-preferred config
  - sustained skiff driving while watching telemetry
- keep the validation matrix in tracked localdev docs so localhost checks stay
  repeatable after this slice instead of living in chat memory

Exit check:

- smooth-motion behavior is covered by tests and visible localdev telemetry
- localhost validation steps for the current transport and motion matrix live in
  tracked localdev docs

## Recommended Rollout Order

1. add the real localdev WebTransport boot path first so localhost diagnosis is
   possible
2. surface boot and transport truth before changing motion behavior or UI
   presentation
3. restore the metaverse developer overlay so the now-correct truth becomes
   visible in-shell
4. split local driver reconciliation from remote interpolation next
5. preserve correction velocity continuity before retuning cadence
6. tighten metaverse world cadence after the ownership path is correct
7. close with tests and localdev validation

## Completion Bar

Do not consider this slice complete until all of these are true:

- the metaverse developer overlay is back and shows live renderer telemetry
- the shell explicitly reports per-lane transport truth for:
  - metaverse presence reliable transport
  - metaverse world reliable transport
  - metaverse world driver datagram transport
- those transport surfaces distinguish:
  - default HTTP because WebTransport was never configured
  - WebTransport preferred but unavailable
  - WebTransport attempted and then degraded to fallback
- startup lag can be attributed to visible boot and transport states
- the locally driven skiff no longer consumes delayed remote interpolation as
  its correction source
- the locally driven skiff does not reconcile to stale authoritative vehicle
  snapshots as if they were fresh truth
- local skiff reconciliation no longer produces periodic forward snapping from
  avoidable underprediction
- routine local vehicle correction is blended and only gross divergence snaps
- metaverse world cadence is tighter than the current 150ms vehicle path
- remote players and vehicles still interpolate from authoritative snapshots
  rather than direct client messages
