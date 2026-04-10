# Metaverse Asset Pipeline

Status: steps 1-10 complete. The pipeline is paused pending real consumers.

This document now tracks current local truth and resume conditions. Historical
draft interfaces, example maps, and bootstrap sequencing were compressed out
once the implementation landed.

## Scope

- local execution summary for metaverse asset work
- current durable local truth lives in:
  - `docs/localdev/metaverse-canonical-rig.md`
  - `docs/localdev/metaverse-asset-delivery-rules.md`
- code is the source of truth for current manifest and runtime shapes:
  - `client/src/assets`
  - `client/src/metaverse`
  - `tests/runtime/client/metaverse-asset-pipeline.test.mjs`
  - `tests/runtime/client/metaverse-runtime.test.mjs`

## Repo Fit

- `client/src/assets` owns local asset ids, manifest types, manifest entries,
  and loading metadata
- `client/src/metaverse` owns the current proof-slice runtime consumer
- `client/src/experiences/<experienceId>` owns future experience-local
  consumers
- `packages/shared` stays out until a real server, storage, or multi-workspace
  boundary needs the same public readonly shape
- `/tools` may later own conversion helpers or validators; runtime code does
  not become the asset pipeline

## Locked Local Truth

- asset families: character, animation clip, attachment, environment
- canonical skeleton id: `humanoid_v1`
- canonical socket ids:
  - `hand_r_socket`
  - `hand_l_socket`
  - `head_socket`
  - `hip_socket`
  - `seat_socket`
- canonical first vocabulary ids:
  - `idle`
  - `walk`
  - `aim`
  - `interact`
  - `seated`
- environment placements: `static`, `instanced`, `dynamic`
- local environment traversal affordance ids:
  - `support`
  - `blocker`
  - `mount`
  - `pushable`
- first LOD tier ids: `high`, `medium`, `low`
- simple colliders only by default; render meshes are not the collision path
- runtime attachment and seat alignment use socket hierarchy, not ad hoc
  offsets
- shipped delivery target is `GLB + KTX2 + Meshopt`, with the current
  proof-slice embedded `.gltf` exception limited by the delivery-rules doc
- optional work stays optional:
  - JSON-driven material generation
  - advanced animation graphs
  - cloth
  - compute deformation

## Completed Steps

1. Step 1 complete: local asset primitives landed under
   `client/src/assets/types`.
2. Step 2 complete: typed manifest families landed for character, animation
   clip, attachment, and environment assets.
3. Step 3 complete: first local manifests and root exports landed under
   `client/src/assets/config` and `client/src/assets/index.ts`.
4. Step 4 complete: the metaverse runtime loads one character proof slice
   through `GLTFLoader` and drives idle playback through `AnimationMixer`.
5. Step 5 complete: attachment proof wiring mounts a manifest-driven asset
   through `hand_r_socket`.
6. Step 6 complete: canonical rig, socket semantics, and first animation
   vocabulary are locked in `docs/localdev/metaverse-canonical-rig.md`.
7. Step 7 complete: environment manifests, first LOD runtime, and static versus
   instanced placement support landed.
8. Step 8 complete: one dynamic mountable environment asset proves
   `seat_socket` mount and dismount flow.
9. Step 9 complete: delivery rules are locked in
   `docs/localdev/metaverse-asset-delivery-rules.md`.
10. Step 10 complete: performance hardening landed in the metaverse runtime
    with `compileAsync` prewarm, static-scene freezing, stable bundle groups,
    portal material hot-path cleanup, and LOD hysteresis.

## Current Exit State

- current proof assets validate against manifest, naming, socket, scale, and
  delivery-path rules
- the metaverse runtime now proves:
  - character loading and animation
  - socketed attachments
  - static, instanced, and dynamic environment assets
  - mount and dismount via `seat_socket`
  - local dynamic pushable environment assets driven by physics-owned pose sync
  - distance-based LOD switching
  - startup and stable-scene performance hardening
- current gate coverage lives in:
  - `tests/runtime/client/metaverse-asset-pipeline.test.mjs`
  - `tests/runtime/client/metaverse-runtime.test.mjs`
- current environment asset truth now also carries local traversal affordance
  metadata through the metaverse proof slice; this remains client-local and is
  not a shared contract
- dynamic environment proof assets now separate local `mount` versus
  `pushable` behavior; only mount assets expose seat metadata and motion
  presentation, while pushables stay physics-owned and non-mountable
- `./tools/verify` remains the stop-ship gate

## Pause State

Step 11 is intentionally not started. The pipeline is paused here because there
is no current real consumer that earns shared asset contracts.

Do not promote local asset shapes into `@webgpu-metaverse/shared` just because
step 11 is next. Resume only when at least one of these becomes true:

- the server must validate or persist asset, avatar, seat, or loadout identity
- storage needs a stable readonly public shape for the same data
- the metaverse shell and one or more experiences depend on the same
  cross-workspace contract
- another workspace needs the same asset identity without local duplication

If none of those are true, keep asset truth local in `client/src/assets` and
the current metaverse runtime.

## Deferred Work

Step 12 stays optional and paused. The following remain explicitly out of scope
until a current product need appears:

- JSON-driven material generation or prompt schemas
- advanced animation state machines or blend graphs
- morph-target-heavy customization
- cloth or compute-heavy deformation
- broader shared-contract promotion beyond an earned step-11 slice

When this pipeline resumes, the first acceptable next slice is a small earned
step-11 contract, such as metaverse-visible equipped asset ids or persisted
avatar selection, with matching runtime and typecheck coverage.
