# Metaverse Cinematic Entry Plan

Status: active localdev implementation plan

## Scope

This slice stays inside the metaverse runtime and scene owners:

- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/render/webgpu-metaverse-scene.ts`

Out of scope for this plan:

- shell navigation changes
- new `shellStage` values
- retained hidden runtimes across gameplay
- handshake transport changes
- physics boot parallelization

## Goal

Improve metaverse entry and return presentation so the user sees a deliberate
world shot before live traversal is exposed, while keeping risk local to the
metaverse domain.

## Phase 1

### Outcomes

- Render a scenic first frame immediately after renderer init.
- Add a metaverse-local cinematic camera path.
- Hide the local avatar during the cinematic.
- Keep player input disabled until handoff.
- Avoid surfacing portal or mount interaction UI until live control starts.

### Implementation

1. Add a small boot cinematic config surface under `client/src/metaverse/config`.
2. Add a pure shot resolver under `client/src/metaverse/states`.
3. Delay `MetaverseFlightInputRuntime.install()` until live handoff.
4. Render an immediate scenic frame after renderer init and before full scene
   boot completes.
5. Keep a short cinematic override active after boot/prewarm while presence and
   world startup continue normally.
6. Use only existing points of interest:
   - portal for the first guaranteed shot
   - dock, skiff, or crates once environment content is available
7. Gate handoff on scene readiness plus a minimum dwell time, not handshake.

### Acceptance

- First visible metaverse frame is a world shot, not the live avatar.
- Pointer lock and movement cannot begin during the cinematic.
- Portal launch UI and mount UI stay inactive until handoff.
- Entering and returning to the metaverse still use the existing shell flow.

## Phase 2

### Outcomes

- Split scene boot priority so scenic environment content becomes available
  before character and attachment content.
- Keep the change local to the metaverse scene/runtime boot path.

### Implementation

1. Split the scene boot path into scenic environment content and deferred
   character or attachment content.
2. Let runtime render from scenic content as soon as it is ready.
3. Prewarm scenic content first, then prewarm again after deferred content is
   ready if necessary.
4. Keep physics and handshake sequencing unchanged.

### Acceptance

- Scenic environment content appears before the local avatar slice is ready.
- Runtime still reaches the existing live boot phases without changing shell
  flow or transport behavior.

## Localdev Validation

Use `client/.env.local` to tune dwell duration during iteration. Initial local
defaults should bias toward visibility over speed so the cinematic is easy to
evaluate.

Validation order:

1. `./tools/build`
2. manual metaverse entry
3. manual gameplay return to metaverse
4. `./tools/verify`

## Completion Rule

This plan is complete when phase 1 and phase 2 are both implemented locally,
build and verify pass, and any remaining follow-up work is explicitly called
out rather than implicitly deferred.
