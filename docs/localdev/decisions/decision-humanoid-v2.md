# Decision: Humanoid V2

Role: decision record. Explains why the repo has both `humanoid_v1` and
`humanoid_v2`.

Status: accepted and implemented in Push 8.

## Decision

Add `humanoid_v2` as a second client-local humanoid skeleton contract instead
of mutating `humanoid_v1` or adding runtime retargeting.

`humanoid_v2` is the active full-body proof rig. `humanoid_v1` remains only for
retained mannequin proof assets until a later cleanup can remove it safely.

## Why

`humanoid_v1` was correct for the first mannequin proof, but it is too sparse
for Mesh2Motion-style full-body humanoids:

- v1 has a small mannequin-oriented deform chain
- v1 sockets are stable, but arms and legs are not normal full-body limb
  chains
- the Mesh2Motion humanoid source already used pelvis, spine, clavicle, arm,
  and leg bones
- forcing that source into v1 would require runtime rescue logic or an awkward
  offline rename into the wrong shape

The repo chose a richer local contract because the runtime needs stable local
truth, not third-party naming as public law.

## Constraints

- `SkeletonId` is intentionally `humanoid_v1 | humanoid_v2`
- socket ids stay shared:
  - `hand_r_socket`
  - `hand_l_socket`
  - `head_socket`
  - `hip_socket`
  - `seat_socket`
- sockets remain authored bones, not runtime-only helpers
- canonical animation vocabulary stays:
  - `idle`
  - `walk`
  - `aim`
  - `interact`
  - `seated`
- shipped v2 assets must already conform; runtime must not add retargeting,
  corrective offsets, alias maps, or character-specific loader hacks
- no shared-contract promotion until a real cross-workspace boundary needs it

## Implemented Shape

- active character id: `mesh2motion-humanoid-v1`
- active skeleton: `humanoid_v2`
- shipped render asset:
  `client/public/models/metaverse/characters/mesh2motion-humanoid.glb`
- shipped animation pack:
  `client/public/models/metaverse/characters/mesh2motion-humanoid-canonical-animations.glb`
- shipped collision proxy:
  `client/public/models/metaverse/characters/mesh2motion-humanoid-collision.glb`

The shipped render and animation-pack GLBs include required v2 core bones,
authored socket bones, canonical clip names, and no node `scale` transforms.

## Consequences

- manifests can describe v1 and v2 humanoids side by side
- the active metaverse full-body proof path no longer hardcodes v1
- attachments remain socket-driven and work across both humanoid generations
  only where `compatibleSkeletons` declares that explicitly
- the current mannequin assets stay available without blocking v2 work
- future non-humanoid families should be separate decisions, not additions to
  the humanoid contract

## Canonical References

- rig and socket truth:
  `docs/localdev/metaverse-canonical-rig.md`
- delivery rules:
  `docs/localdev/metaverse-asset-delivery-rules.md`
- active plan surface:
  `docs/localdev/metaverse-next-push-plan.md`
