# Metaverse Next Push Plan

Role: active plan. This file tracks what we are doing next, not why past
decisions were made.

Status: no active next push selected after Push 8.

## Current Baseline

- Push 8 is complete: the active full-body proof character is
  `mesh2motion-humanoid-v1` on `humanoid_v2`
- `humanoid_v1` remains available for retained mannequin proof assets
- character presentation still resolves through manifest-owned socket ids and
  canonical animation vocabulary
- Mesh2Motion remains an external authoring intermediate; the repo consumes
  only conditioned shipped artifacts
- asset truth remains client-local; no `@webgpu-metaverse/shared` promotion is
  earned yet

## Completed Pushes

1. presence contract correctness and remote presentation recovery
2. shoreline exit and stable swim or grounded routing
3. local traversal affordance metadata for support, blocker, mount, and
   pushable semantics
4. dynamic pushable body ownership and pose sync
5. metaverse-local autostep gating so tall support stays blocked
6. manifest-owned canonical character animation intake; no generated walk
   fallback
7. superseded Mesh2Motion render swap against the old v1 gate
8. `humanoid_v2` contract migration and active full-body v2 proof asset

## Durable References

- how character rigs and sockets work:
  `docs/localdev/metaverse-canonical-rig.md`
- how shipped assets are packaged:
  `docs/localdev/metaverse-asset-delivery-rules.md`
- current asset ownership and pause state:
  `docs/localdev/metaverse-asset-pipeline.md`
- why `humanoid_v2` exists:
  `docs/localdev/decisions/decision-humanoid-v2.md`
- why Mesh2Motion intake stays family-based:
  `docs/localdev/decisions/decision-mesh2motion-intake.md`

## Next Push Selection Rules

Choose one narrow slice. Do not turn the next push into repo-wide character
architecture.

A valid next push should:

- start from a current runtime need, not from available source assets alone
- preserve manifest-owned asset resolution
- keep hot-path gameplay and render behavior free of runtime retargeting,
  path rewrites, or asset-specific rescue logic
- avoid shared-contract promotion unless a real cross-workspace boundary needs
  the same public shape
- leave `humanoid_v1` retirement for a cleanup push only after no local proof
  consumer still needs it

## Candidate Next Slices

- v1 cleanup: retire retained mannequin-only paths after proving no remaining
  local consumer needs `humanoid_v1`
- humanoid presentation quality: improve authored v2 animations or add a small
  blend/presentation slice without changing the rig contract
- asset tooling: automate the current manual GLB checks only if repeated
  asset intake makes the tool valuable
- one non-humanoid family: choose exactly one family only after a concrete
  metaverse runtime consumer exists
- shared asset contract: promote only when server, storage, or another
  workspace needs the same readonly asset identity

## Explicitly Not Next By Default

- catch-all Mesh2Motion runtime abstraction
- broad creature taxonomy without a runtime consumer
- retargeting, IK, foot planting, or additive animation systems as a
  prerequisite for simple asset intake
- avatar customization, persistence, or public character catalogs without an
  earned product path
