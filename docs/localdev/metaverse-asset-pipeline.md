# Metaverse Asset Pipeline

Role: canonical current-state summary for local asset ownership.

Status: paused. The local asset pipeline is working for the current metaverse
proof slice, and shared-contract promotion is intentionally deferred.

## Source Of Truth

- canonical rig and socket rules:
  `docs/localdev/metaverse-canonical-rig.md`
- delivery and packaging rules:
  `docs/localdev/metaverse-asset-delivery-rules.md`
- current manifest and runtime shape:
  - `client/src/assets`
  - `client/src/metaverse`
  - `tests/runtime/client/metaverse-asset-pipeline.test.mjs`
  - `tests/runtime/client/metaverse-runtime.test.mjs`

## Current Shape

- asset families: character, animation clip, attachment, environment
- supported local humanoid skeleton ids:
  - `humanoid_v1`
  - `humanoid_v2`
- stable socket ids:
  - `hand_r_socket`
  - `hand_l_socket`
  - `head_socket`
  - `hip_socket`
  - `seat_socket`
- canonical animation vocabulary:
  - `idle`
  - `walk`
  - `aim`
  - `interact`
  - `seated`
- environment placement modes: `static`, `instanced`, `dynamic`
- environment traversal affordances: `support`, `blocker`, `mount`, `pushable`
- LOD tiers: `high`, `medium`, `low`

## Runtime Ownership

- `client/src/assets` owns local asset ids, manifest types, manifest entries,
  and loading metadata.
- `client/src/metaverse` owns the current proof-slice runtime consumer.
- `client/src/physics` owns collider/controller runtime behavior; asset
  manifests do not expose physics engine details.
- `client/src/experiences/<experienceId>` owns future experience-local asset
  policy when it is not reusable by the metaverse shell.
- `/tools` may own validators or conversion helpers; runtime code does not
  become the asset pipeline.

## Current Proofs

- the active full-body proof character is `mesh2motion-humanoid-v1` on
  `humanoid_v2`
- retained mannequin proof assets remain on `humanoid_v1`
- character loading, canonical animation vocabulary, socketed attachments, and
  seat mounting resolve through manifests
- static, instanced, dynamic mountable, and dynamic pushable environment assets
  all resolve through local manifest truth
- collision proxies are separate shipped assets; render meshes are not the
  collision path
- delivery paths stay under `/models/metaverse/...`

## Pause State

Do not promote local asset shapes into `@webgpu-metaverse/shared` until a real
boundary needs them. Promotion becomes earned only when at least one is true:

- the server must validate or persist asset, avatar, seat, or loadout identity
- storage needs the same stable readonly shape
- the metaverse shell and one or more experiences depend on the same
  cross-workspace contract
- another workspace needs the same asset identity without local duplication

Until then, keep asset truth local in `client/src/assets` and the metaverse
runtime.

## Deferred

- JSON-driven material generation or prompt schemas
- advanced animation graphs, blend graphs, and additive layers
- morph-target-heavy avatar customization
- cloth or compute-heavy deformation
- shared-contract promotion without an earned public boundary
