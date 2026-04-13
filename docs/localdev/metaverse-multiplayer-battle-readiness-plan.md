# Metaverse Multiplayer Battle Readiness Plan

Role: plan. Durable code-grounded implementation plan for the push phase that
replaces the current polling-based realtime path with a battle-ready
multiplayer foundation.

Status: proposed.

Scope: escalated durable-truth implementation plan for this push only. This
document does not amend repo-wide `AGENTS.md` law; where conflict appears,
`AGENTS.md` wins.

## Goal

Make the current engine ready for multiplayer FPS combat by fixing the audited
realtime faults in this exact order:

- correct authoritative tick and time semantics
- remove RTT-gated steady-state snapshot polling
- move remote humanoid, vehicle, and world presentation onto one authoritative
  world-snapshot path
- eliminate avoidable hot-path allocation and duplicate smoothing
- move high-rate client updates onto latest-wins transport lanes
- replace client-authored metaverse pose replication with server-authoritative
  player movement
- add the history and validation required for authoritative combat resolution

This plan is not a brainstorm. It is the tracked implementation order for the
next engine push.

This push assumes WebTransport and WebGPU remain the chosen foundations.
Neither one proves smooth multiplayer by itself. Smoothness here will be
decided by authoritative timing, buffer policy, transport health, prediction,
reconciliation, and hot-path render behavior under load.

## What This Push Must Deliver

- smooth 60 FPS client rendering fed by buffered authoritative snapshots rather
  than request timing
- one explicit server-owned realtime timeline for players, vehicles, and combat
- one explicit transport split:
  - HTTP for bootstrap and fallback
  - reliable WebTransport for long-lived subscriptions and reliable commands
  - datagrams for latest-wins state or input
- one explicit remote-presentation owner for metaverse world entities
- one shared realtime foundation usable by both the metaverse shell and Duck
  Hunt co-op
- one explicit stop-ship line: no multiplayer FPS battle experience ships on
  client-authored movement or present-time-only hit validation

## Non-Goals For This Push

- do not change the locked shell flow of profile/controller setup ->
  metaverse world -> in-world experience launch -> return to metaverse
- do not replace the locked `three/webgpu` + `three/tsl` + NodeMaterial render
  stack
- do not split the server into new workspaces, repos, or domain servers
- do not move transport sequencing, reconnect logic, or lane health policy into
  metaverse render/runtime owners
- do not generalize future battle systems beyond the shared authoritative
  foundation needed for metaverse traversal, Duck Hunt co-op, and FPS combat

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
- `client/src/experiences/AGENTS.md`
- `client/src/experiences/duck-hunt/AGENTS.md`
- `packages/AGENTS.md`
- `packages/shared/src/metaverse/AGENTS.md`
- `server/AGENTS.md`
- `server/src/metaverse/AGENTS.md`

Do not assume chat context not restated here.

This list is the minimum starting set. If implementation widens into another
touched subdomain, re-read the nearest `AGENTS.md` for that path before
editing.

## Current Audited Files

The current transport, authority, interpolation, and rendering path was
reviewed in these files:

- `client/src/network/classes/metaverse-world-client.ts`
- `client/src/network/classes/metaverse-presence-client.ts`
- `client/src/network/classes/coop-room-client.ts`
- `client/src/network/classes/authoritative-server-clock.ts`
- `client/src/network/adapters/reliable-webtransport-json-request-channel.ts`
- `client/src/network/adapters/latest-wins-webtransport-json-datagram-channel.ts`
- `client/src/network/adapters/webtransport-http-fallback.ts`
- `client/src/network/adapters/metaverse-world-webtransport-transport.ts`
- `client/src/network/adapters/metaverse-presence-webtransport-transport.ts`
- `client/src/network/adapters/coop-room-webtransport-transport.ts`
- `client/src/network/adapters/metaverse-realtime-world-driver-vehicle-control-webtransport-datagram-transport.ts`
- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/config/metaverse-presence-network.ts`
- `client/src/metaverse/config/metaverse-runtime.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts`
- `client/src/metaverse/render/webgpu-metaverse-scene.ts`
- `client/src/experiences/duck-hunt/network/duck-hunt-coop-network.ts`
- `client/src/experiences/duck-hunt/runtime/duck-hunt-coop-arena-simulation.ts`
- `packages/shared/src/metaverse/metaverse-realtime-world-contract.ts`
- `packages/shared/src/metaverse/metaverse-realtime-world-webtransport-contract.ts`
- `packages/shared/src/metaverse/metaverse-realtime-world-webtransport-datagram-contract.ts`
- `packages/shared/src/experiences/duck-hunt/duck-hunt-room-contract.ts`
- `server/src/index.ts`
- `server/src/adapters/localdev-webtransport-server.ts`
- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- `server/src/metaverse/adapters/metaverse-world-webtransport-adapter.ts`
- `server/src/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.ts`
- `server/src/experiences/duck-hunt/classes/coop-room-runtime.ts`

## Confirmed Current Problems

These are confirmed by the current code and must be treated as real defects,
not tuning opinions.

1. metaverse world snapshots are still arrival-driven on the client
   - `MetaverseWorldClient` polls snapshots on a timer
   - WebTransport only changes the request transport, not the steady-state
     snapshot model
2. snapshot timestamps are not authoritative simulation timestamps
   - `MetaverseAuthoritativeWorldRuntime.readWorldSnapshot()` stamps the
     current request time into the snapshot
   - `CoopRoomRuntime.advanceTo()` does the same for Duck Hunt room snapshots
3. remote metaverse humanoids still depend on reliable pose traffic
   - `MetaversePresenceClient` coalesces and serializes pose updates through
     one in-flight reliable request path
   - `WebGpuMetaverseRuntime` still falls back to presence-driven remote
     character presentation before world snapshots exist
4. the hot render path still allocates and scans too much
   - `MetaverseRemoteWorldRuntime.sampleRemoteWorld()` allocates new arrays and
     frozen objects every frame
   - it also repeatedly uses linear `.find()` lookups while sampling players
     and vehicles
5. vehicle presentation is smoothed in more than one owner
   - remote vehicle poses are time-sampled in `MetaverseRemoteWorldRuntime`
   - local mounted authority correction blends again in
     `MetaverseVehicleRuntime.syncAuthoritativePose()`
6. datagram fallback is sticky
   - one datagram failure permanently downgrades the lane to reliable fallback
     for the lifetime of the client
7. metaverse movement is still not battle-ready
   - the server accepts client-authored player pose through presence sync
   - there is no server-owned player movement timeline
   - there is no authoritative rewind/history path for FPS hit validation

## Push-Phase Decisions

This push locks the following implementation decisions.

1. authoritative realtime snapshots must carry both simulation time and
   emission time
   - simulation time is the time of the world state being rendered
   - emission time is the server wall-clock time used for client clock
     alignment
2. steady-state remote motion must come from server-pushed snapshots, not from
   client polling cadence
3. metaverse presence is not allowed to remain the steady-state motion channel
   for remote characters
4. one entity gets one smoothing owner
   - no duplicate low-pass filtering in runtime and scene for the same data
5. latest-wins state or input and reliable commands keep separate lanes and
   separate sequencing rules
6. the repo is not multiplayer FPS battle-ready until server-authoritative
   player movement and rewind-based hit validation are in place

## Push-Scoped Owner Boundaries

These boundaries apply to this push so rollout work does not leak across
domains or turn `WebGpuMetaverseRuntime` into a dumping ground.

- `client/src/network` owns stream/datagram transport, lane health,
  reconnect/fallback policy, sequencing, codecs, and transport status
- metaverse and Duck Hunt runtimes own snapshot consumption, interpolation,
  extrapolation, local prediction, reconciliation, and presentation shaping
- `MetaverseTraversalRuntime` remains the metaverse-local owner of locomotion
  and client-side movement prediction inputs
- `WebGpuMetaverseRuntime` may orchestrate runtime wiring, scene sync, and HUD
  publication, but it must not become the owner of reusable transport or
  locomotion policy
- server adapters remain transport-only bridges exposing shared contracts
- server runtimes own authoritative tick progression, player simulation,
  vehicle occupancy, history buffers, and combat validation

## Migration And Cutover Rules

- every phase that changes transport, authority, or snapshot shape must land
  behind explicit config-owned rollout switches until its exit check and tests
  pass
- preferred rollout switches for this push:
  - `metaverseWorldSnapshotStreamEnabled`
  - `duckHuntRoomSnapshotStreamEnabled`
  - `metaverseWorldDatagramInputEnabled`
  - `metaverseAuthoritativePlayerMovementEnabled`
  - `metaverseAuthoritativeCombatRewindEnabled`
- dual-path operation is allowed only as a migration bridge and must declare
  source-of-truth precedence in code and telemetry
- authoritative world snapshots outrank presence-driven motion whenever both
  paths are present
- HTTP bootstrap and HTTP fallback may remain during rollout, but they become
  rollback paths once persistent streaming is healthy
- every bridge phase must expose:
  - enable state for the new path
  - rollback state for the legacy path
  - explicit removal condition for the legacy path in the next phase
- one lane failure must not permanently degrade unrelated lanes for the rest of
  the session unless the runtime has explicitly entered fallback mode and
  surfaced that state in telemetry
- presence may remain for roster or session compatibility during migration, but
  once Phase 3 exits it must not silently resume as steady-state remote motion
  truth
- Phase 6 must stay independently switchable from Phase 5 so authoritative
  movement can stabilize before combat rewind becomes mandatory

## Provisional Measurement Matrix

These are starting evaluation targets for the push. Final tuned values lock in
Phase 7.

- compare authoritative tick candidates at `20 Hz` (current baseline), `30 Hz`,
  and `60 Hz`
- compare interpolation-delay candidates as whole-tick buffers of `2`, `3`,
  and `4` ticks
- compare max-extrapolation caps of `1` tick and `2` ticks before hold or decay
  policy applies
- reconnect from a dropped steady-state snapshot stream without browser reload;
  target the first healthy replacement snapshot inside `2 s`
- count large reconciliation events explicitly:
  - translation correction magnitude
  - yaw correction magnitude
  - correction frequency during sustained play
- treat steady-state reliable fallback on latest-wins lanes as exceptional; each
  fallback and recovery event must be visible in transport telemetry

## Runtime Constraints For This Push

These are push-scoped implementation constraints, not repo-wide law.

- authoritative progression advances on explicit tick boundaries, never on
  request timing
- interpolation targets authoritative simulation time, never packet arrival
  time
- clock offset estimation uses emitted server time, not inferred snapshot age
- players, vehicles, occupancy, and combat history must resolve from the same
  authoritative timeline
- HTTP may remain for bootstrap and fallback, but it must not remain the
  steady-state remote motion path when WebTransport is active
- the hot 60 FPS render path must not build new entity collections every frame
  when reusable owners can hold that state
- transport diagnostics must stay transport-owned in `client/src/network`
- metaverse render code must not infer transport state from env config
- do not add more realtime motion fields to the presence contract during this
  push; motion authority is moving into the world path

## Delivery Order

Phases must land in order. Do not parallelize phases that change the same
runtime truth surfaces.

### Phase 0 - Freeze The Measurement Surface

Purpose:

- stop guessing on cadence, interpolation delay, extrapolation budget, and
  buffer depth

Work:

- extend the metaverse developer telemetry to expose:
  - authoritative tick interval
  - snapshot stream update rate
  - snapshot buffer depth
  - latest snapshot simulation age
  - emitted-time clock offset estimate
  - extrapolation time used on the current frame
  - percentage of frames rendered from extrapolated data
  - stream reconnect count
  - datagram send failure count
  - reliable fallback state per lane
- add equivalent room-side telemetry for Duck Hunt co-op where the same timing
  questions matter
- add a repeatable runtime or bench harness that can compare the current 50 ms
  tick against candidate battle rates without changing public contracts twice
- keep all new budgets config-owned so final tuning is a config lock, not a
  contract rewrite
- count reconciliation corrections even if the baseline remains zero until the
  authoritative movement phase lands, so the telemetry surface is already
  stable before the authority migration

Likely owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/components/metaverse-developer-overlay.tsx`
- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/src/experiences/duck-hunt/runtime/duck-hunt-webgpu-gameplay-runtime.ts`
- `bench`

Tests:

- runtime tests for telemetry snapshot shaping
- bench or runtime harness for candidate tick-rate comparison

Exit check:

- the repo can capture a baseline for the current implementation without
  guessing why a frame is extrapolated or stale

### Phase 1 - Correct Authoritative Time Semantics

Purpose:

- make the snapshot timeline trustworthy before any transport rewrite

Work:

- extend metaverse world tick metadata in
  `packages/shared/src/metaverse/metaverse-realtime-world-contract.ts`
  to carry:
  - `currentTick`
  - `tickIntervalMs`
  - `simulationTimeMs`
  - `emittedAtServerTimeMs`
- extend Duck Hunt room tick metadata in
  `packages/shared/src/experiences/duck-hunt/duck-hunt-room-contract.ts`
  with the same split
- keep compatibility only as long as needed for migration; remove ambiguous
  single-field time semantics after all consumers switch
- stamp `simulationTimeMs` from authoritative tick ownership in:
  - `MetaverseAuthoritativeWorldRuntime`
  - `CoopRoomRuntime`
- stamp `emittedAtServerTimeMs` from actual server wall clock at snapshot
  emission time
- update `AuthoritativeServerClock` so offset estimation uses emitted time
- update metaverse and Duck Hunt client-side projection to target simulation
  time rather than request timing

Likely owners:

- `packages/shared/src/metaverse/metaverse-realtime-world-contract.ts`
- `packages/shared/src/experiences/duck-hunt/duck-hunt-room-contract.ts`
- `client/src/network/classes/authoritative-server-clock.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/experiences/duck-hunt/runtime/duck-hunt-coop-arena-simulation.ts`
- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- `server/src/experiences/duck-hunt/classes/coop-room-runtime.ts`

Tests:

- shared runtime and typecheck coverage for the new tick shape
- client clock tests for emitted-time alignment
- server runtime tests proving repeated reads between ticks keep the same
  `simulationTimeMs`

Exit check:

- identical simulation state read twice between ticks no longer looks like two
  different simulation times

### Phase 2 - Add Server-Pushed Snapshot Streams

Purpose:

- remove RTT-gated steady-state snapshot polling from the happy path

Work:

- add a dedicated metaverse world subscription stream contract in
  `packages/shared`
- implement a long-lived reliable WebTransport stream for world snapshots
  instead of opening one request stream per snapshot read
- use the current WebTransport server shape in
  `server/src/adapters/localdev-webtransport-server.ts` by having the client
  open a persistent bidirectional stream and send one subscription frame at
  session start
- keep HTTP snapshot bootstrap and HTTP fallback alive during rollout
- keep the current reliable request-response channel only for bootstrap and
  reliable commands until the steady-state stream is proven
- add an equivalent room snapshot stream for Duck Hunt after the metaverse
  world path is stable
- expose stream health in transport status snapshots; do not infer it from env
  state alone
- ship stream enablement behind `metaverseWorldSnapshotStreamEnabled` first and
  keep a fast rollback to HTTP/request-response snapshot reads until Phase 3
  exits cleanly

Likely owners:

- `packages/shared/src/metaverse`
- `packages/shared/src/experiences/duck-hunt`
- `client/src/network/adapters/reliable-webtransport-json-request-channel.ts`
- `client/src/network/adapters/metaverse-world-webtransport-transport.ts`
- `client/src/network/adapters/coop-room-webtransport-transport.ts`
- `client/src/network/classes/metaverse-world-client.ts`
- `client/src/network/classes/coop-room-client.ts`
- `server/src/adapters/localdev-webtransport-server.ts`
- `server/src/metaverse/adapters/metaverse-world-webtransport-adapter.ts`
- `server/src/experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-adapter.ts`

Tests:

- client runtime tests for stream connect, reconnect, fallback, and duplicate
  snapshot rejection
- server adapter tests for subscribe, push, disconnect, and cleanup

Exit check:

- when WebTransport is active, remote snapshots continue arriving without the
  client scheduling one poll per snapshot

### Phase 3 - Make The World Snapshot Path The Only Remote Presentation Source

Purpose:

- remove split remote-character truth and duplicate smoothing

Work:

- make `MetaverseRemoteWorldRuntime` the only owner of remote metaverse player
  and vehicle presentation once world streaming lands
- stop using `MetaversePresenceRuntime.remoteCharacterPresentations` as a
  steady-state render source in `WebGpuMetaverseRuntime`
- keep presence only for join, membership recovery, and HUD truth until the
  later movement migration finishes
- add explicit player turn-rate data to authoritative world snapshots so remote
  yaw can interpolate or extrapolate correctly during gaps
- replace repeated per-frame `.find()` scans with keyed lookup owners
- replace per-frame array and object rebuilding in
  `MetaverseRemoteWorldRuntime.sampleRemoteWorld()` with reusable state owners
  or ring-buffer-backed scratch structures
- remove duplicate vehicle smoothing so authoritative sampling and local
  reconciliation do not both low-pass the same remote truth

Likely owners:

- `packages/shared/src/metaverse/metaverse-realtime-world-contract.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/render/webgpu-metaverse-scene.ts`
- `client/src/metaverse/vehicles/classes/metaverse-vehicle-runtime.ts`

Tests:

- runtime tests proving remote characters still render correctly without the
  presence fallback path when world snapshots are active
- tests for sequence rejection and entity add/remove behavior
- bench or profiling checks for reduced per-frame allocation pressure

Exit check:

- remote humanoids and remote vehicles are rendered from one authoritative
  snapshot path, with one smoothing owner per entity

### Phase 4 - Move High-Rate Updates Onto Latest-Wins World Lanes

Purpose:

- remove RTT-serialized movement traffic from the realtime path

Work:

- add latest-wins metaverse world datagram contracts for high-rate local player
  updates
- bridge stage:
  - move local player world updates off `MetaversePresenceClient.syncPresence()`
    and into world-owned latest-wins transport
  - make the server world runtime, not the presence roster, the source that
    accepts high-rate movement-facing updates
- keep reliable join, leave, room/session actions, and other discrete commands
  on reliable transport
- keep driver vehicle control on datagrams, but replace permanent sticky
  degradation with a recoverable health policy
- mirror the same separation in Duck Hunt:
  - player presence and aim remain latest-wins
  - ready, start, kick, leave, and fire-shot remain reliable

Likely owners:

- `packages/shared/src/metaverse`
- `packages/shared/src/experiences/duck-hunt`
- `client/src/network/adapters/latest-wins-webtransport-json-datagram-channel.ts`
- `client/src/network/classes/metaverse-world-client.ts`
- `client/src/network/classes/metaverse-presence-client.ts`
- `client/src/network/classes/coop-room-client.ts`
- `client/src/metaverse/classes/metaverse-presence-runtime.ts`
- `server/src/metaverse/adapters/metaverse-realtime-world-webtransport-datagram-adapter.ts`
- `server/src/experiences/duck-hunt/adapters/duck-hunt-coop-room-webtransport-datagram-adapter.ts`

Tests:

- client datagram send and recovery tests
- server datagram acceptance and sequence-drop tests
- transport status tests proving fallback can recover instead of degrading for
  the entire session

Exit check:

- no steady-state humanoid or vehicle motion path is serialized behind one
  reliable in-flight request

### Phase 5 - Replace Client-Authored Metaverse Pose Replication With Server-Authoritative Movement

Purpose:

- cross the line from smooth replication into actual multiplayer FPS movement
  authority

Work:

- move metaverse player movement ownership into
  `MetaverseAuthoritativeWorldRuntime`
- stop accepting client-authored world-space player pose as authoritative truth
- introduce world input snapshots or commands that describe player intent
  instead of final position
- advance players and vehicles on the same authoritative tick owner
- emit player position, yaw, velocity, locomotion mode, and mounted occupancy
  from that server-owned simulation
- keep local client prediction and reconciliation on the client side
- keep presence as session or roster compatibility only, or retire it once the
  world path fully owns membership truth
- keep client prediction and authoritative movement enablement switchable so
  prediction tuning can be stabilized without reverting the whole transport
  foundation

Likely owners:

- `packages/shared/src/metaverse`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- `server/src/metaverse/adapters`

Tests:

- server runtime tests for player simulation and input sequencing
- client runtime tests for local prediction and reconciliation
- integration tests for occupancy coherence between players and vehicles

Exit check:

- the authoritative server, not the client, decides metaverse player movement

Stop-ship note:

- the repo is not battle-ready for FPS combat until this phase is complete

### Phase 6 - Add Combat History And Rewind Validation

Purpose:

- make combat authority correct under latency, not only movement authority

Work:

- add bounded authoritative history buffers keyed by tick or simulation time
  for combat-relevant player and world state
- make reliable fire commands carry:
  - client shot sequence
  - client-estimated fire tick or simulation time
  - weapon or firing context identifiers as required by the experience
- resolve shots against authoritative rewind history on the server
- keep local muzzle flash, recoil, and fire animation prediction client-side
  only
- add duplicate-shot suppression and explicit authoritative outcome acks
- reuse the same sequencing model across metaverse combat and Duck Hunt where
  possible
- keep combat rewind behind its own rollout switch so movement authority can
  remain on while combat validation tuning is still being hardened

Likely owners:

- `packages/shared/src/metaverse`
- `packages/shared/src/experiences/duck-hunt`
- `server/src/metaverse`
- `server/src/experiences/duck-hunt`
- `client/src/network`
- future battle experience runtimes under `client/src/experiences`

Tests:

- server runtime tests for rewind window validation
- command dedupe tests
- integration tests proving hit results are decided from authoritative history,
  not present-frame pose

Exit check:

- reliable combat outcomes are validated against historical authoritative state
  rather than only the server's present frame

Stop-ship note:

- no multiplayer FPS battle experience may ship before this phase lands

### Phase 7 - Retune Cadence, Buffers, And Reconciliation From Measured Data

Purpose:

- lock final battle budgets only after the transport and authority model is
  correct

Work:

- promote the following values to explicit config owners wherever they are
  still implicit or stale:
  - authoritative tick interval
  - interpolation delay
  - max extrapolation
  - snapshot buffer depth
  - local freshness budget
  - vehicle reconciliation thresholds
- compare the battle candidate tick rates using the Phase 0 measurement harness
- lock the final chosen values only after measured validation across metaverse
  traversal and Duck Hunt co-op
- update `docs/localdev/metaverse-smooth-motion-validation.md` with the final
  validated numbers once they are locked

Likely owners:

- `client/src/metaverse/config/metaverse-world-network.ts`
- `client/src/metaverse/config/metaverse-runtime.ts`
- `client/src/experiences/duck-hunt/network/duck-hunt-coop-network.ts`
- `server/src/metaverse/config/metaverse-authoritative-world-runtime.ts`
- `server/src/experiences/duck-hunt/config/coop-room-runtime.ts`
- `docs/localdev/metaverse-smooth-motion-validation.md`

Tests:

- bench or soak runs for each candidate rate
- runtime validation of final chosen budgets

Exit check:

- final cadence and buffer values are measured, justified, and visible in code

### Phase 8 - Final Verification And Handoff Gate

Purpose:

- turn this push from a code rewrite into a ship gate

Work:

- update runtime tests for:
  - contract shape
  - transport bootstrap, stream, fallback, and reconnect behavior
  - sequence rejection
  - clock alignment
  - interpolation and extrapolation correctness
  - local prediction and reconciliation
  - combat rewind validation
- add validation scenarios for:
  - HTTP bootstrap
  - WebTransport steady-state success
  - WebTransport fallback and recovery
  - sustained mounted movement
  - sustained remote humanoid motion
  - Duck Hunt co-op room streaming
- verify that each rollout switch still exposes a safe rollback path and that
  telemetry clearly shows which path is active
- run `./tools/verify`

Stop-ship conditions:

- any steady-state remote motion path still depends on per-snapshot client
  polling when WebTransport is active
- any authoritative snapshot still uses request arrival time as simulation time
- presence still drives steady-state remote humanoid rendering after the world
  path migration
- the hot 60 FPS path still rebuilds entity presentation collections every
  frame
- metaverse movement remains client-authored
- combat validation remains present-time only
- transport fallback state is not visible to the runtime telemetry surface

Exit check:

- `./tools/verify` passes and the repo has one coherent multiplayer foundation
  for metaverse traversal, Duck Hunt co-op, and future FPS battle experiences

## Definition Of Done

This push is done only when all of the following are true:

- metaverse world snapshots are authoritative-time-correct
- metaverse and Duck Hunt both have steady-state server-pushed snapshot paths
- remote humanoids, vehicles, and world objects are rendered from buffered
  authoritative snapshots instead of request timing
- high-rate client updates use latest-wins transport rather than reliable
  request serialization
- metaverse player movement is server-authoritative
- combat validation uses rewind history
- the 60 FPS render path no longer burns avoidable allocation budget on remote
  presentation churn

Anything short of that is an intermediate slice, not battle readiness.
