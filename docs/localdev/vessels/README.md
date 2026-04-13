# Metaverse Vessel Build Guide

Role: plan.

Status: proposed implementation path grounded in current repo truth.

Purpose: audit the current skiff slice, document what the metaverse vessel
stack already supports, and define the implementation path for a larger
scuba-diver boat with side benches, a driver, and a walkable deck.

## Current Skiff Audit

The active proof vessel is `metaverse-hub-skiff-v1`.

### Asset and manifest truth

| Area | Current truth | Why it matters |
| --- | --- | --- |
| Asset id | `metaverse-hub-skiff-v1` in `client/src/assets/config/environment-prop-manifest.ts` | New vessels should be their own asset ids, not variants hidden behind the skiff id. |
| Render asset | `/models/metaverse/environment/metaverse-hub-skiff.gltf` | The current proof slice still uses embedded `.gltf`. New materially refreshed vessels should prefer the delivery rules in `docs/localdev/metaverse-asset-delivery-rules.md`. |
| Collision asset | `/models/metaverse/environment/metaverse-hub-skiff-collision.gltf` | Mountables already use a separate collision proxy. Keep that split for a larger boat. |
| Placement mode | `dynamic` with `traversalAffordance: "mount"` | A dive boat belongs on the same mountable path, not the static or pushable paths. |
| Hub placement | one placement at `(12.2, 0.12, -13.8)` with `rotationYRadians: Math.PI * 0.86` | Dynamic mountables are currently single-instance and single-placement in the hub proof. |
| Orientation | `forwardModelYawRadians: Math.PI * 0.5` | The render mesh can have its own authored forward; runtime compensates through orientation metadata. |
| Focus collider | one box collider centered at `(0, 1.05, 0)` sized `(5.2, 2.4, 2.8)` | Focus, board range, and mount selection do not come from the render mesh. |
| Physics colliders | six authored cuboid colliders split across hull blockers, deck support, helm support, and bench support | Walkable deck and blockers are box-based today, not triangle-mesh walking. |
| Authored nodes | `driver_seat`, `port_bench_seat`, `deck_entry` inside the render `.gltf` | Seats and entries are authored by stable node names, then resolved at runtime. |

### Occupancy truth

The current skiff exposes:

- one driver seat: `driver-seat`
- one passenger seat: `port-bench-seat`
- one boarding entry: `deck-entry`

The current seat and entry policies are already manifest-driven:

- driver seat:
  `cameraPolicyId: "vehicle-follow"`,
  `controlRoutingPolicyId: "vehicle-surface-drive"`,
  `lookLimitPolicyId: "driver-forward"`,
  `occupancyAnimationId: "seated"`
- passenger seat:
  `cameraPolicyId: "seat-follow"`,
  `controlRoutingPolicyId: "look-only"`,
  `lookLimitPolicyId: "passenger-bench"`,
  `occupancyAnimationId: "seated"`
- deck entry:
  `cameraPolicyId: "seat-follow"`,
  `controlRoutingPolicyId: "look-only"`,
  `lookLimitPolicyId: "passenger-bench"`,
  `occupancyAnimationId: "standing"`

### Runtime truth

What the current code already does:

- `MetaverseTraversalRuntime` can board an entry, occupy a seat, drive the
  active mount, and carry a free-roam boarded occupant with the moving vessel.
- `MetaverseVehicleRuntime` accepts multiple seat definitions and multiple
  entry definitions from the manifest.
- `webgpu-metaverse-scene.ts` resolves authored seat and entry nodes into
  runtime anchors and mounts characters to them only when the occupancy should
  be anchor-constrained.
- Entry occupancy with a non-driver role stays free-roam on the deck. That is
  the key mechanic that makes a walkable dive boat possible.
- The authoritative server already tracks vehicle seat occupancy per
  `vehicleId`, enforces one player per seat id, and publishes occupied seats in
  realtime world snapshots.

### Important limits in the current slice

- Dynamic mountables are still single-LOD in proof config.
- Dynamic mountables still assume exactly one placement in the current hub.
- Client traversal tuning is hardcoded under `config.skiff`, so all mountable
  boats would currently share one speed, turn rate, camera distance, waterline,
  and correction profile.
- The seat-selection HUD is not occupancy-aware and will happily show all
  direct-entry seats, which does not scale cleanly to a six-passenger boat.
- The server enforces seat exclusivity, but it does not validate seat ids
  against a vessel asset catalog yet. It trusts the seat ids reported through
  mounted occupancy.
- Visual bob and roll are render-only presentation. Physics, traversal, and
  authoritative vehicle pose use the simulation pose instead.

## What Is Already Available For Vessels

The current vessel contract is broader than the skiff content currently uses.

### Available manifest features

- multiple seats per mountable asset
- multiple boarding entries per mountable asset
- per-seat `seatRole`
- per-seat `cameraPolicyId`
- per-seat `controlRoutingPolicyId`
- per-seat `lookLimitPolicyId`
- per-seat `occupancyAnimationId`
- per-seat `directEntryEnabled`
- per-entry standing or seated occupancy behavior through policy ids
- explicit render/collision asset split
- explicit orientation metadata
- explicit hull/deck/support blocker colliders

### Available role and policy vocabularies

- seat roles:
  `driver`, `passenger`, `turret`
- control routing:
  `vehicle-surface-drive`, `look-only`, `turret-station`
- camera policies:
  `vehicle-follow`, `seat-follow`, `turret-follow`
- look limits:
  `driver-forward`, `passenger-bench`, `turret-arc`
- occupancy animations:
  `seated`, `standing`

### Available network and authority support

- player presence already carries mounted occupancy:
  `environmentAssetId`, `occupancyKind`, `seatId`, `entryId`, `occupantRole`
- realtime world snapshots already publish:
  vehicle pose, vehicle id, and occupied seats
- server authority already routes driver controls through the occupied driver
  seat and keeps passengers from steering

## Target Dive Boat Slice

The requested vessel is larger than the proof skiff and should be treated as a
new mountable asset, not as a skiff variant.

Recommended first target:

- asset id: `metaverse-hub-dive-boat-v1`
- shape: open deck dive boat with center aisle and side benches
- scale target:
  about `10m` to `12m` long and `3m` to `3.6m` beam
- passenger layout:
  three bench seats on port and three on starboard
- helm:
  one driver seat at the console
- boarding:
  at least two stern-side boarding entries so passengers can board without
  claiming a seat immediately
- deck:
  walkable center and stern deck area for moving around before sitting

Recommended seat and entry ids:

- `helm-seat`
- `port-bench-seat-a`
- `port-bench-seat-b`
- `port-bench-seat-c`
- `starboard-bench-seat-a`
- `starboard-bench-seat-b`
- `starboard-bench-seat-c`
- `stern-port-entry`
- `stern-starboard-entry`

Recommended policy mapping:

- helm seat:
  direct entry enabled, `vehicle-follow`, `vehicle-surface-drive`,
  `driver-forward`, `seated`
- bench seats:
  no direct entry, `seat-follow`, `look-only`, `passenger-bench`, `seated`
- stern boarding entries:
  `seat-follow`, `look-only`, `passenger-bench`, `standing`

That shape gives:

- fast access for a driver
- a clean board-first flow for passengers
- walkable deck occupancy without forcing every passenger into a seat
- room to grow into tank racks, gear props, ladders, or future dive-specific
  interaction points

## Implementation Plan

### Phase 1: Author the boat asset

Files to add:

- `client/public/models/metaverse/environment/metaverse-hub-dive-boat.glb`
  or `.gltf`
- `client/public/models/metaverse/environment/metaverse-hub-dive-boat-collision.glb`
  or `.gltf`

Authoring rules:

- keep meter scale and identity root scale
- keep the authored root upright and let manifest orientation handle any
  forward-yaw compensation
- export stable authored nodes for every seat and entry
- keep collision simpler than render geometry
- split deck support from blockers so the player can walk the deck but not clip
  through the console, gunwales, or bench backs

Minimum authored nodes:

- `helm_seat`
- `port_bench_seat_a`
- `port_bench_seat_b`
- `port_bench_seat_c`
- `starboard_bench_seat_a`
- `starboard_bench_seat_b`
- `starboard_bench_seat_c`
- `stern_port_entry`
- `stern_starboard_entry`

Recommended collider layout:

- one broad focus collider for mount interaction
- one or more hull blocker colliders along the outside shell
- one long center-deck support collider
- one stern-deck support collider
- one helm platform support collider
- blocker colliders for helm console and bench back volume

### Phase 2: Wire the asset into the manifest and proof config

Files to change:

- `client/src/assets/config/environment-prop-manifest.ts`
- `client/src/app/states/metaverse-asset-proof.ts`

Implementation steps:

1. Add `metaverseHubDiveBoatEnvironmentAssetId`.
2. Add the new dynamic mountable manifest entry with:
   - render asset path
   - collision path
   - focus collider
   - physics colliders
   - seat definitions
   - entry definitions
   - orientation metadata
3. Add a hub placement in `metaverse-asset-proof.ts`.
4. Keep the new vessel single-LOD for the first slice.

This phase alone is enough to get:

- focus and boarding
- seat anchor resolution
- deck entry resolution
- local walking on the boat
- local and remote mounted presentation

### Phase 3: Generalize the current skiff tuning into vessel profiles

Files to change:

- `client/src/metaverse/config/metaverse-runtime.ts`
- `client/src/metaverse/classes/metaverse-traversal-runtime.ts`
- possibly a new local config file such as
  `client/src/metaverse/config/metaverse-vessel-profiles.ts`

Why this is needed:

- the current runtime owns one `config.skiff` profile
- a dive boat wants different follow distance, camera height, turn rate,
  waterline, and water probe radius than the proof skiff

Recommended shape:

- keep asset authoring metadata in `client/src/assets`
- move vessel motion and camera tuning into a metaverse-local profile map keyed
  by `environmentAssetId`

Suggested profile fields:

- acceleration and deceleration
- base speed and boost multiplier
- turn rate
- drag curve
- authoritative correction thresholds
- camera follow distance
- camera height offset
- camera eye height
- water contact probe radius
- waterline height

Do not keep stretching `config.skiff` once the repo has more than one real
boat class.

### Phase 4: Improve boarding and seat UX for a multi-passenger boat

Files to change:

- `client/src/metaverse/components/metaverse-stage-screen.tsx`
- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- possibly `client/src/metaverse/classes/metaverse-remote-world-runtime.ts`

Recommended changes:

- show occupied versus available seats in the HUD
- group passenger seats by side instead of listing every seat as an undifferentiated button wall
- keep only the helm seat as direct entry from outside the boat
- require passengers to board the deck first, then move into a bench seat
- show driver/passenger labels so seat purpose is clear

Without this pass, a seven-seat dive boat will technically work but will feel
rough in the hub overlay.

### Phase 5: Harden authority and validation

Files to change:

- `server/src/metaverse/classes/metaverse-authoritative-world-runtime.ts`
- optional shared contract work under `packages/shared/src/metaverse`

Recommended hardening:

- validate claimed seat ids against an allowlist for the active vessel asset
- reject unknown seat ids instead of creating new authoritative seat buckets on
  demand
- keep driver-only control routing tied to the driver seat role

This is the first phase that starts to touch durable cross-workspace truth. It
should be done once the larger vessel is no longer just a local proof slice.

### Phase 6: Test and verify the boat slice

Recommended checks:

- asset proof test coverage for the new boat manifest entry
- runtime tests for:
  - board by stern entry
  - walk the carried deck while the boat moves
  - move from deck to bench seat
  - driver control routing only from `helm-seat`
  - seat exclusivity across multiple players
  - remote passenger mounting to the correct bench seat
- final `./tools/verify`

## Fastest Viable Delivery Path

If the goal is to get a large scuba boat in-world quickly, the smallest
correct implementation path is:

1. Author `metaverse-hub-dive-boat-v1`.
2. Add manifest entry, placement, seat nodes, and entry nodes.
3. Reuse the current skiff vehicle tuning temporarily.
4. Ship one helm seat, six bench seats, and two stern entries.
5. Verify local board, walk, seat, drive, and remote seat occupancy.

That will produce a usable first dive boat without widening the repo more than
necessary.

## Proper Production Follow-Up

After the first usable boat lands, the next durable improvements should be:

1. Replace `skiff`-named tuning with vessel profiles keyed by asset id.
2. Make the seat HUD occupancy-aware.
3. Add authoritative seat-id validation.
4. Add boat-specific camera tuning and slower, heavier motion.
5. Revisit dock fit and boarding distances for the larger hull.

## Summary

The repo already supports the core mechanics needed for a dive boat:
multi-seat mountables, deck boarding, walkable carried occupancy, driver-only
control routing, and authoritative seat occupancy. The main work is not
inventing a new vehicle system; it is authoring a larger boat asset and
generalizing the current skiff-tuned proof slice so that a second vessel class
can exist cleanly.
