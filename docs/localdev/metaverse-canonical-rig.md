# Metaverse Canonical Rig

Status: local durable truth for pipeline step 6.

Promote this into `@webgpu-metaverse/shared` only when storage, server
validation, or cross-workspace consumers need the same public contract.

## Skeleton

- canonical skeleton id: `humanoid_v1`
- required deform and attachment chain:

```text
humanoid_root
└── hips
    ├── spine
    │   └── chest
    │       ├── neck
    │       │   └── head_socket
    │       ├── hand_l_socket
    │       └── hand_r_socket
    ├── hip_socket
    └── seat_socket
```

Rules:

- socket nodes are authored bones in the exported rig, not runtime-only helpers
- attachment consumers mount with identity local transforms under the socket
- socket ids stay stable even when the visible mesh or presentation mode changes

## Socket Semantics

- `hand_r_socket`: primary right-hand anchor for handheld tools and weapons
- `hand_l_socket`: left-hand support or off-hand handheld anchor
- `head_socket`: head-worn, camera-adjacent, or head-level debug anchor
- `hip_socket`: hip-mounted and holstered attachment anchor
- `seat_socket`: seat and mount anchor shared by vehicles and other mountables

## Animation Vocabulary

The first canonical vocabulary ids are:

- `idle`
- `walk`
- `aim`
- `interact`
- `seated`

Current canonical clip names match the vocabulary ids one-to-one. Runtime and
manifest code should resolve animation intent through the vocabulary id first,
then use the canonical clip name for authored asset lookup.

## Retargeting Acceptance Rules

A clip or character rig is accepted into `humanoid_v1` only when all of these
hold:

1. The exported rig preserves the required bone and socket names exactly.
2. `head_socket`, `hand_l_socket`, `hand_r_socket`, `hip_socket`, and
   `seat_socket` remain exported bone nodes with stable parentage.
3. The resulting asset can resolve at least one canonical vocabulary id through
   manifest data without runtime alias hacks.
4. Attachments still mount through socket hierarchy with identity local
   transforms.
5. Exported content stays meter-scale and remains compatible with the current
   metaverse character bounds validation.
6. A full-body render asset that reuses the current canonical animation pack
   preserves canonical local bone and socket transforms closely enough that the
   pack plays without runtime retargeting or corrective transform hacks.

## Current Local Proof Assets

- `metaverse-mannequin-v1`
- `metaverse-mannequin-arms-v1`

Both local character asset ids intentionally resolve through the same authored
mannequin rig delivery for now. That keeps the canonical socket and vocabulary
contract locked before distinct first-person art lands.
