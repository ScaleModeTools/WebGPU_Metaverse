# Metaverse Next Push Plan

Status: in progress. Push 1, Push 2, Push 3, Push 4, Push 5, and Push 6 are
complete. Push 7 is the active slice.

This note now tracks only the current next push. Completed pushes stay
compressed here unless they still shape the next implementation.

## Current Local Truth

- the metaverse proof consumer now routes through one explicit local active
  full-body character selection seam instead of hardcoding a mannequin id
- the active proof character already resolves a shipped canonical animation
  pack for `idle`, `walk`, `aim`, `interact`, and `seated`, and the generated
  local walk fallback is removed
- the runtime now expects canonical `humanoid_v1` rig, socket, and vocabulary
  truth from manifests; it does not compensate for missing or renamed authored
  data
- asset-pipeline coverage now locks the active full-body render asset against
  the current canonical animation pack for canonical parentage and local
  transform compatibility, so the eventual Mesh2Motion swap must fit the
  existing rig truth instead of widening runtime behavior
- the active full-body render asset is still the mannequin, so the next earned
  step is one Mesh2Motion-derived full-body render swap through the existing
  manifest seam, not a broader character-pipeline expansion
- Mesh2Motion is acceptable as an external authoring intermediate, but the
  repo still consumes only shipped local artifacts that satisfy the canonical
  rig, delivery, and naming rules after export
- shared-contract promotion remains paused; this character-delivery work is
  still client-local

## Completed Pushes

1. completed: presence contract correctness and remote presentation recovery
2. completed: shoreline exit and stable swim or grounded routing
3. completed: local traversal affordance metadata for support, blocker, mount,
   and pushable semantics
4. completed: dynamic pushable body ownership and pose sync
5. completed: metaverse-local autostep gating so tall support stays blocked
6. completed: manifest-owned canonical character animation intake proof; the
   active full-body path now resolves a shipped `.glb` canonical pack and no
   longer falls back to generated walk

## Push Sequence

### Push 7 — Mesh2Motion Full-Body Render Swap

Status: pending.

Scope:

- replace the active mannequin full-body render asset with one
  Mesh2Motion-derived full-body character through the existing manifest seam
- reuse the current canonical animation pack and the current runtime consumer
  without adding retargeting, corrective offsets, or loader compatibility hacks
- keep code changes limited to shipped asset delivery, manifest selection,
  proof selection, validation, and any local docs or tests that the new asset
  earns

Must stay local:

- Mesh2Motion remains an external offline authoring intermediate only; the
  repo does not gain Mesh2Motion project files, runtime metadata, importer
  tooling, or automation
- character asset ids, render-model paths, collision proxy paths, proof
  selection, rig/socket truth, and validation stay inside:
  - `client/src/assets`
  - `client/src/app/states`
  - `client/src/metaverse`
  - `tests/runtime/client`
  - `docs/localdev`
- compatibility truth remains the current local `humanoid_v1` rig, sockets,
  presentation modes, and canonical clip ids, not a new public contract

Must not be promoted yet:

- no `@webgpu-metaverse/shared` character, rig, or animation contract
- no generic retargeting system, pose-correction layer, or DCC interchange
  schema
- no modular mesh-kit system, first-person art split, or JSON-driven material
  generation pipeline
- no avatar customization, persistence, networking, or cross-workspace public
  character catalog

Concrete repo surfaces:

- shipped artifacts under `client/public/models/metaverse/characters`
- `client/src/assets/config/character-model-manifest.ts`
- `client/src/assets/config/animation-clip-manifest.ts`
- `client/src/app/states/metaverse-asset-proof.ts`
- `tests/runtime/client/metaverse-asset-pipeline.test.mjs`
- `tests/runtime/client/metaverse-runtime.test.mjs`
- `docs/localdev/metaverse-next-push-plan.md`
- `docs/localdev/metaverse-asset-delivery-rules.md` only if the new shipped
  character earns a durable clarification

Hard constraints for Mesh2Motion import/export compatibility:

- preserve the locked `humanoid_v1` chain and exact socket bone names:
  - `humanoid_root`
  - `hips`
  - `spine`
  - `chest`
  - `neck`
  - `hand_r_socket`
  - `hand_l_socket`
  - `head_socket`
  - `hip_socket`
  - `seat_socket`
- socket ids remain exported authored bones with stable parentage, not stripped
  helpers
- the new full-body render asset must remain compatible with the current
  canonical animation pack; matching names alone is not enough
- exported bind pose, rest pose, local bone orientation, and upright root
  orientation must stay close enough to the current mannequin rig that
  `idle`, `walk`, `aim`, `interact`, and `seated` play without visible twist,
  hip drift, socket drift, or attachment breakage
- shipped roots stay upright, meter-scale, and free of node `scale`
  transforms
- runtime must not add retargeting, corrective transforms, alias maps, or
  character-specific special cases to make the asset fit
- `hand_r_socket` attachment mounting and `seat_socket` mount alignment remain
  identity-transform consumers
- shipped filenames stay lowercase kebab-case and unversioned under
  `/models/metaverse/characters/...`
- the shipped render asset and collision proxy stay separate files; collision
  remains simple and does not reuse the render mesh
- this character refresh moves toward locked `GLB + KTX2 + Meshopt`; do not
  add a new proof-only embedded `.gltf` full-body character
- if Mesh2Motion authoring needs Blender cleanup, that stays outside the repo;
  only the shipped local artifact enters the repo

Push 7 phases:

1. completed: lock the active full-body render asset against the current
   canonical animation pack with asset-pipeline validation for canonical
   parentage and local bone/socket transform compatibility
2. pending: ship one Mesh2Motion-derived full-body render asset and collision
   proxy through the existing local manifest seam
3. pending: flip `metaverseActiveFullBodyCharacterAssetId` to the new shipped
   asset only after the current canonical pack reuses cleanly without runtime
   hacks

Exit check:

- one shipped Mesh2Motion-derived full-body character is selected by
  `metaverseActiveFullBodyCharacterAssetId`
- the new character reuses the existing canonical animation clip ids and the
  current proof config resolves it through the same manifest-owned seam
- runtime boot, `walk`, `aim`, `interact`, `seated`, `hand_r_socket`
  attachment mounting, and `seat_socket` mount alignment all work on the new
  asset without runtime compatibility hacks
- asset-pipeline coverage proves canonical bones and sockets remain present,
  delivery naming rules still hold, and no new authoring-workspace paths enter
  manifests
- runtime coverage proves the active character loads through the same manifest
  seam and does not rely on fallback animation generation, path rewrites, or
  character-specific loader behavior
- if the new render asset cannot reuse the current canonical pack cleanly,
  stop and treat that as a later authored-animation refresh push rather than
  widening this slice
- `./tools/verify` passes

Wait until later pushes:

- shipping a second authored animation pack tuned specifically to the new mesh
  if the current pack proves insufficient
- blend graphs, additive aim layers, upper-body layering, turn-in-place, or
  runtime IK
- modular mesh kits, separate first-person arms art, or body-mode-specific
  character assets
- JSON-driven material generation, prompt schemas, or broader visual expansion
- avatar customization, persistence, networking, or shared-contract promotion

## Asset Pipeline Note

- `docs/localdev/metaverse-asset-pipeline.md` remains correct that the current
  shared-contract promotion step is paused; none of the above work earns
  `@webgpu-metaverse/shared` asset-shape promotion yet
- Mesh2Motion is acceptable as an external authoring intermediate for rigging
  and animation work, but shipped repo assets still need to satisfy the local
  canonical rig, delivery, and naming rules after export
