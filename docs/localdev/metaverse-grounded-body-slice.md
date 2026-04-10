# Metaverse Grounded Body Slice

Status: completed for the first metaverse-only grounded body slice.

This document defines the first grounded-body implementation slice after the
metaverse asset pipeline pause. It is intentionally local, step-based, and
small. Duck Hunt reuse is a follow-up goal, not part of this first execution.

## Goal

Add one grounded player-body path to the metaverse runtime that:

- uses `three/addons/physics/RapierPhysics.js` as the current physics entrypoint
- keeps physics engine details out of asset manifests
- keeps the current fly path intact as a separate locomotion mode
- reuses the existing mannequin asset as the visible body proof
- uses the current ocean height as a fixed ground plane for now

## Current Decisions

- rendering remains on `three/webgpu`
- example pages stay reference-only; do not import WebGL renderer code,
  `OrbitControls`, or page-level helper structure
- initial physics ownership is client-local and reusable, so it earns
  `client/src/physics`
- input mode and locomotion mode are separate concerns:
  - input mode stays `keyboard` or `mouse`
  - locomotion mode becomes `fly` or `grounded`
- body truth becomes authoritative for grounded movement; camera and mannequin
  presentation derive from body state
- Duck Hunt is not changed in this slice

## Local References

- official addon doc:
  - `https://threejs.org/docs/pages/RapierPhysics.html`
- local upstream checkout:
  - `examples/rapier.js`
- current metaverse motion owner:
  - `client/src/metaverse/states/metaverse-flight.ts`
- current shared mannequin asset:
  - `client/src/assets/config/character-model-manifest.ts`

## Progress

### Step 0 — Add Local Rapier Reference

Status: completed.

- upstream `rapier.js` is checked out at `examples/rapier.js`
- use this as a local source reference and fallback if the addon import path
  ever needs tighter repo control
- do not import product code from this checkout

### Step 1 — Add Physics Domain Steering Surface

Status: completed.

- add `client/src/physics/AGENTS.md`
- lock that physics stays runtime-only, React-free, and manifest-agnostic
- keep `RapierPhysics` and `RapierHelper` ownership centralized there

### Step 2 — Add Shared Physics Runtime Skeleton

Status: completed.

Create the minimum shared client-local physics owner:

- `client/src/physics/types/metaverse-grounded-body.ts`
- `client/src/physics/classes/rapier-physics-runtime.ts`
- `client/src/physics/index.ts`

Implementation target:

- bootstrap `RapierPhysics()` once for the owning runtime
- expose the addon handle, world access, and optional debug-helper access
- keep Rapier-specific imports inside `client/src/physics`

Do not do in this step:

- no Duck Hunt adapter
- no asset-manifest changes
- no mesh-derived world collision

Exit check:

- completed: the metaverse runtime now requests physics ownership through
  `client/src/physics` without importing Rapier directly

### Step 3 — Add Grounded Body Types And Controller Owner

Status: completed.

Add a reusable grounded-body owner under `client/src/physics`:

- one capsule character collider
- one character controller
- one typed body snapshot for:
  - world position
  - yaw
  - grounded state
  - eye height
  - capsule dimensions

Suggested files:

- `client/src/physics/types/metaverse-grounded-body.ts`
- `client/src/physics/classes/metaverse-grounded-body-runtime.ts`

Rules:

- body truth lives here
- camera truth does not directly drive grounded translation
- no physics engine configuration leaks into `client/src/assets`

Exit check:

- completed: a grounded body now advances from intent input and produces a
  stable readonly snapshot under `client/src/physics`

### Step 4 — Add Metaverse Ground Plane And Body Sync

Status: completed.

Integrate the grounded body only into the metaverse runtime:

- fixed ground plane at `metaverseRuntimeConfig.ocean.height`
- grounded body translation drives the camera position
- grounded body translation also drives the mannequin anchor
- preserve the current fly path as a separate locomotion mode

Target files:

- `client/src/metaverse/types/metaverse-runtime.ts`
- `client/src/metaverse/config/metaverse-runtime.ts`
- `client/src/metaverse/states/metaverse-flight.ts`
- `client/src/metaverse/classes/webgpu-metaverse-runtime.ts`
- `client/src/metaverse/render/webgpu-metaverse-scene.ts`

Required repo-fit decision:

- add locomotion mode as metaverse runtime state, not as a new character asset
  family

Exit check:

- completed: the metaverse now runs in either `fly` or `grounded` mode without
  regressing the current fly path

### Step 5 — Reuse The Existing Mannequin As Body Presentation

Status: completed.

Use the existing mannequin asset as the first grounded-body visual proof:

- continue resolving it from `client/src/assets`
- keep socket and animation wiring intact
- do not add a second mannequin manifest just for physics

Presentation rule:

- body motion updates the character anchor
- the grounded-body slice does not yet require full third-person camera work
- if first-person visibility needs a temporary rule, keep it local to the
  metaverse runtime and do not rewrite the asset standard

Exit check:

- completed: grounded body motion now visibly moves the current mannequin proof
  asset

### Step 6 — Keep Debug Visualization Explicit

Status: completed.

If collider visualization is needed:

- use `RapierHelper` only behind a local debug flag
- do not couple gameplay or motion logic to debug-helper presence

Target ownership:

- debug wiring belongs in the metaverse runtime adapter, not in asset manifests

Exit check:

- completed: physics debug can be toggled through metaverse runtime
  dependencies without changing runtime truth

### Step 7 — Add Narrow Runtime Coverage

Status: completed.

Add tests only for the grounded-body slice:

- body snapshot and controller progression
- metaverse grounded/fly mode separation
- camera and anchor sync from body state
- fixed ground-plane behavior at ocean height

Likely files:

- `tests/runtime/client/metaverse-runtime.test.mjs`
- `tests/runtime/client/metaverse-grounded-body-runtime.test.mjs`

Exit check:

- completed: grounded-body motion is covered by runtime tests and passes
  `./tools/verify`

### Step 8 — Stop After Metaverse-Only Success

Status: completed.

This slice ends once the metaverse proves one grounded body.

Explicitly deferred:

- Duck Hunt gameplay movement integration
- experience-shared physics contracts
- vehicle controller work
- terrain heightfields
- networked body replication
- shared-contract promotion into `@webgpu-metaverse/shared`

Completion gate:

- one local metaverse runtime supports grounded movement with a capsule body
- current fly mode still works
- mannequin presentation follows the grounded body
- no asset manifest encodes Rapier-specific state
- no Duck Hunt files are touched unless a real blocker forces it

Result:

- this metaverse-only slice is complete; Duck Hunt reuse and deeper collider
  work remain explicitly deferred

## Next Slice After Completion

Only after this slice passes should the repo consider:

1. reusing the grounded body snapshot shape in Duck Hunt
2. adding explicit simple colliders for hub props beyond the ground plane
3. deciding whether the addon's CDN loading behavior must be replaced with a
   repo-owned local load path
