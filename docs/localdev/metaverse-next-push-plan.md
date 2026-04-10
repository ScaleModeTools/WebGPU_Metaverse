# Metaverse Next Push Plan

Status: in progress. Push 1, Push 2, Push 3, Push 4, and Push 5 are complete.

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

Status: completed.

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
- smooth remote metaverse character presentation locally in the scene runtime
  so roster updates no longer hard-snap every observed player pose

Exit check:

- the metaverse HUD no longer reports the position-field parser error during
  normal presence join/sync
- remote player roster updates can flow through the live client/server
  contract again
- remote player presentation now eases toward newer roster poses locally while
  preserving snap-on-spawn and snap-on-large-teleport behavior

### Push 2 — Shoreline Exit And Stable Swim/Grounded Routing

Status: completed.

- keep traversal policy in `client/src/metaverse`
- replace the current binary water/support heuristic with a richer local
  shoreline query:
  - support height
  - rise above water
  - horizontal support coverage
  - forward support probe
- add hysteresis so the avatar does not thrash between swim and grounded while
  partially exiting the water
- distinguish low step-on support from taller overlapping blocker support so
  a nearby blocker no longer cancels a valid dock exit unless it actually
  covers the center or forward shoreline footprint
- keep Push 2 as one full traversal push, but execute it in phases instead of
  shrinking it into a smaller permanent scope

Push 2 phases:

1. completed: smarter automatic swim/grounded routing with real step-height
   exit gating and grounded hold hysteresis
2. completed: distinguish provisional step-on support from obvious non-step
   support so tall waterborne blockers stop hijacking swim exit
3. completed: traversal coverage now proves dock exit, stable support hold,
   shoreline blocker delay, side-blocker tolerance, and rejection of non-step
   waterborne support under the current local hub heuristic

### Push 3 — Local Traversal Affordance Metadata

Status: completed.

- keep asset truth local in `client/src/assets` and metaverse-local consumers
- add local environment affordance semantics for:
  - `support`
  - `blocker`
  - `mount`
  - future `pushable`
- do not promote these shapes into `@webgpu-metaverse/shared` unless another
  workspace earns the same contract
- propagate current asset affordance truth through metaverse proof config and
  placed collider snapshots so traversal can distinguish support from blocker
  without inventing shared-contract law
- keep the current dynamic metaverse proof mount-only until Push 4 earns real
  pushable ownership

### Push 4 — Dynamic Pushables

Status: completed.

- add reusable dynamic rigid-body ownership in `client/src/physics`
- enable character-controller impulse interaction only for the earned pushable
  slice
- keep existing static crate support/blocker assets separate from future
  pushable assets instead of making one authored asset serve conflicting
  semantics
- landed as a local dynamic pushable slice:
  - `MetaverseDynamicCuboidBodyRuntime` now owns reusable dynamic cuboid body
    boot and pose snapshots inside `client/src/physics`
  - the grounded body controller only enables impulses to dynamic bodies when
    pushables are actually booted in the metaverse runtime
  - the hub now carries a separate dynamic pushable crate asset instead of
    reusing the existing static blocker crate
  - metaverse scene sync now distinguishes dynamic `mount` assets from dynamic
    `pushable` assets, so pushables use exact physics-driven pose overrides
    instead of skiff-style bob and seat logic
  - runtime coverage now pins:
    - dynamic cuboid body snapshots
    - controller impulse toggling
    - pushable scene pose sync without mount focus
    - metaverse boot spawning pushable rigid bodies locally

### Push 5 — Climb And Jump Follow-Up

Status: completed.

- do not fake climb behavior through oversized autostep
- until a real climb or jump slice exists, objects above step height should
  stay blocked or future-climbable rather than pretending to be step-on
  surfaces
- landed as a metaverse-local autostep gate:
  - reusable grounded-body physics keeps default autostep support, but now
    exposes an explicit enable or disable control
  - `MetaverseTraversalRuntime` only enables grounded autostep when local
    support probes see an authored low step rise in the active movement
    direction
  - traversal coverage now pins both outcomes:
    - low authored support remains walkable while grounded
    - taller above-step support stays blocked instead of faking climb

## Asset Pipeline Note

- `docs/localdev/metaverse-asset-pipeline.md` remains correct that the current
  shared-contract promotion step is paused; none of the above work earns
  `@webgpu-metaverse/shared` asset-shape promotion yet
- Mesh2Motion is acceptable as an external authoring intermediate for rigging
  and animation work, but shipped repo assets still need to satisfy the local
  canonical rig, delivery, and naming rules after export
