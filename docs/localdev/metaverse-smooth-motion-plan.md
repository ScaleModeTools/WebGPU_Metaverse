# Metaverse Smooth Motion Plan

Role: plan. Durable code-grounded plan for the next metaverse shell slice
focused on smooth hub motion, explicit transport visibility, and correct local
vehicle reconciliation.

Status: proposed.

## Goal

Fix the current motion-facing issues in the metaverse shell by:

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
- `client/src/network/classes/metaverse-world-client.ts`
- `client/src/network/classes/metaverse-presence-client.ts`
- `client/src/network/adapters/webtransport-http-fallback.ts`
- `client/src/network/adapters/reliable-webtransport-json-request-channel.ts`
- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- `server/src/metaverse/config/metaverse-authoritative-world-runtime.ts`
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
   whether the delay comes from renderer warmup, world bootstrap, or transport
   fallback
3. the locally driven skiff shows periodic forward correction as authority
   catches up with client motion

## Target Runtime Model

- metaverse runtime owns one explicit shell developer telemetry snapshot for:
  - frame rate
  - renderer label
  - draw calls
  - triangle count
  - device pixel ratio
  - WebGPU availability or active renderer state
- network clients own explicit transport status snapshots for:
  - configured preference
  - currently active transport
  - whether fallback is active
  - last transport error when relevant
- metaverse HUD adapts that telemetry and transport truth into shell-facing UI
- remote player and remote vehicle presentation continues to derive from
  delayed authoritative snapshot sampling
- the locally owned mounted driver path consumes latest authoritative vehicle
  truth and local prediction or reconciliation, not delayed remote
  interpolation
- authoritative metaverse world cadence is tightened enough for vehicle motion
  to feel continuous

## Runtime Laws For This Slice

- metaverse developer UI must read actual runtime telemetry, not guessed values
- the shell must not infer active transport from env config alone; it must show
  actual active mode and fallback state
- remote interpolation may remain delayed and snapshot-targeted
- the locally owned mounted driver vehicle must not consume delayed remote
  vehicle presentation as its correction source
- authoritative correction may update local driver reconciliation state, but it
  must not zero useful velocity state on every correction if authoritative
  velocity already exists
- remote rendering must continue to derive from authoritative snapshots only
- transport diagnostics must stay transport-owned in `client/src/network`, not
  in metaverse JSX

## Step 1 — Restore Metaverse Developer Overlay

Status: pending.

Work:

- add a metaverse-local developer overlay back to `MetaverseStageScreen`
- expose metaverse runtime telemetry through `MetaverseHudSnapshot`
- include at minimum:
  - frame rate
  - renderer label
  - draw calls
  - triangles
  - device pixel ratio
  - active WebGPU state
- keep this metaverse-local for now; do not widen the Duck Hunt gameplay debug
  menu controller unless a real cross-shell control need appears

Likely owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/src/metaverse/components/metaverse-stage-screen.tsx`

Exit check:

- the metaverse shell again shows live renderer telemetry, including triangles

## Step 2 — Surface Boot And Transport Truth

Status: pending.

Work:

- add explicit transport status snapshots for metaverse presence and metaverse
  world clients
- surface:
  - transport preference
  - active transport
  - fallback active or not
  - last transport-level error when relevant
- add boot-phase telemetry for:
  - renderer init
  - scene prewarm
  - presence joined
  - authoritative world connected
- if localdev is simply using HTTP by default, make that explicit in the
  overlay instead of treating it like an unknown

Likely owners:

- `client/src/network`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/components/metaverse-stage-screen.tsx`

Exit check:

- Start Metaverse shows whether it is using HTTP or WebTransport and whether a
  fallback occurred
- startup lag can be attributed to a concrete boot phase instead of guesswork

## Step 3 — Split Local Driver Reconciliation From Remote Interpolation

Status: pending.

Work:

- keep delayed authoritative sampling for remote players and remote vehicles
- add a separate latest-authoritative vehicle reconciliation path for the local
  mounted driver
- stop applying delayed `remoteVehiclePresentations` to the locally owned
  mounted vehicle
- ensure the local driver vehicle uses the newest authoritative vehicle truth
  available from the world snapshot path

Likely owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`

Exit check:

- the local skiff is no longer corrected from the delayed remote interpolation
  path

## Step 4 — Preserve Motion Continuity During Vehicle Correction

Status: pending.

Work:

- stop zeroing local mounted vehicle speed state on every authoritative pose
  sync
- use authoritative vehicle velocity during correction when available
- add correction policy that keeps local motion continuous while still
  respecting server truth
- keep authoritative snapshots as the final owner of vehicle position and yaw

Likely owners:

- `client/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `packages/shared/src/metaverse`
  only if the local correction path truly needs more explicit shared fields than
  already exist

Exit check:

- local skiff correction no longer produces periodic forward boost from repeated
  underprediction

## Step 5 — Tighten Metaverse World Cadence For Motion

Status: pending.

Work:

- lower metaverse authoritative world tick interval from the current `150ms`
  toward a vehicle-appropriate cadence
- lower metaverse world polling interval to match the tighter authoritative
  cadence
- retune interpolation delay and extrapolation budget after the new cadence is
  in place
- keep HTTP bootstrap and fallback alive, but make the cost of HTTP polling
  explicit in telemetry

Likely owners:

- `server/src/metaverse/config/metaverse-authoritative-world-runtime.ts`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`

Exit check:

- metaverse vehicle and remote shell motion no longer run on a visibly coarse
  150ms cadence

## Step 6 — Tighten Tests And Localdev Validation

Status: pending.

Work:

- add runtime tests for:
  - metaverse developer telemetry publication
  - transport status and fallback visibility
  - startup boot-phase progression
  - local driver vehicle reconciliation using latest authority instead of
    delayed remote interpolation
  - vehicle correction continuity when authoritative velocity is present
  - metaverse world cadence retuning without stale snapshot regressions
- validate in localdev with:
  - Start Metaverse on default HTTP config
  - Start Metaverse on WebTransport-preferred config
  - sustained skiff driving while watching telemetry

Exit check:

- smooth-motion behavior is covered by tests and visible localdev telemetry

## Recommended Rollout Order

1. restore the metaverse developer overlay first so the next fixes are visible
2. surface boot and transport truth before changing motion behavior
3. split local driver reconciliation from remote interpolation next
4. preserve correction velocity continuity before retuning cadence
5. tighten metaverse world cadence after the ownership path is correct
6. close with tests and localdev validation

## Completion Bar

Do not consider this slice complete until all of these are true:

- the metaverse developer overlay is back and shows live renderer telemetry
- the shell explicitly reports whether it is using HTTP or WebTransport
- startup lag can be attributed to visible boot and transport states
- the locally driven skiff no longer consumes delayed remote interpolation as
  its correction source
- local skiff reconciliation no longer produces periodic forward snapping from
  avoidable underprediction
- metaverse world cadence is tighter than the current 150ms vehicle path
- remote players and vehicles still interpolate from authoritative snapshots
  rather than direct client messages
