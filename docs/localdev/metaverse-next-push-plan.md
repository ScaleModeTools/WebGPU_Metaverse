# Metaverse Next Push Plan

Status: in progress. Push 1 is the active slice.

This note captures the current repo-local findings and the next implementation
sequence after the current metaverse hub playtest issues.

## Findings

- metaverse presence is failing because the shared command contract sends a
  nested `pose` object, while the server HTTP adapter currently parses
  flattened top-level `position`, `stateSequence`, and `yawRadians` fields
  instead of `body.pose`
- metaverse presence idle polling currently does not refresh the server
  inactivity clock, so an otherwise healthy idle client can be pruned from the
  roster and start receiving `Unknown metaverse player` errors during poll
- after that prune path, the current client stays in presence error state and
  does not automatically rejoin, so later movement does not restore roster
  membership by itself
- remote player rendering depends on presence roster updates, so the presence
  parser mismatch explains both the HUD error and the missing remote players
- automatic locomotion routing currently decides only between "support surface"
  and "water" from a local support-height heuristic; it does not yet model
  shoreline exit quality, ledge coverage, blocker semantics, or pushable
  dynamic bodies
- current hub crate and dock collision are static support/blocker proxies, not
  pushable rigid bodies; the grounded body controller also disables impulses to
  dynamic bodies in the current slice
- seat alignment is already using `seat_socket` hierarchy correctly, so the
  current seat problem is not a missing butt-offset system

## Push Sequence

### Push 1 — Restore Presence Contract Correctness

Status: active.

- fix the server metaverse presence HTTP adapter to parse the shared nested
  `pose` payload shape
- treat metaverse roster polling by a known observer as presence activity so
  idle multi-window testing does not immediately prune the player
- auto-rejoin on the `Unknown metaverse player` recovery path instead of
  remaining permanently stuck outside the roster
- update runtime tests so the server adapter test uses the real shared command
  constructors instead of a flattened mock payload
- harden the client runtime test to assert that serialized presence join and
  sync requests keep `position`, `yawRadians`, and `stateSequence` inside
  `pose`

Exit check:

- the metaverse HUD no longer reports the position-field parser error during
  normal presence join/sync
- remote player roster updates can flow through the live client/server
  contract again

### Push 2 — Shoreline Exit And Stable Swim/Grounded Routing

Status: pending.

- keep traversal policy in `client/src/metaverse`
- replace the current binary water/support heuristic with a richer local
  shoreline query:
  - support height
  - rise above water
  - horizontal support coverage
  - forward support probe
- add hysteresis so the avatar does not thrash between swim and grounded while
  partially exiting the water

### Push 3 — Local Traversal Affordance Metadata

Status: pending.

- keep asset truth local in `client/src/assets` and metaverse-local consumers
- add local environment affordance semantics for:
  - `support`
  - `blocker`
  - `mount`
  - future `pushable`
- do not promote these shapes into `@webgpu-metaverse/shared` unless another
  workspace earns the same contract

### Push 4 — Dynamic Pushables

Status: pending.

- add reusable dynamic rigid-body ownership in `client/src/physics`
- enable character-controller impulse interaction only for the earned pushable
  slice
- keep existing static crate support/blocker assets separate from future
  pushable assets instead of making one authored asset serve conflicting
  semantics

### Push 5 — Climb And Jump Follow-Up

Status: pending.

- do not fake climb behavior through oversized autostep
- until a real climb or jump slice exists, objects above step height should
  stay blocked or future-climbable rather than pretending to be step-on
  surfaces

## Asset Pipeline Note

- `docs/localdev/metaverse-asset-pipeline.md` remains correct that the current
  shared-contract promotion step is paused; none of the above work earns
  `@webgpu-metaverse/shared` asset-shape promotion yet
- Mesh2Motion is acceptable as an external authoring intermediate for rigging
  and animation work, but shipped repo assets still need to satisfy the local
  canonical rig, delivery, and naming rules after export
