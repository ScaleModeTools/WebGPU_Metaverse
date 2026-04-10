# Metaverse Asset Delivery Rules

Role: canonical. Describes how shipped metaverse asset files are packaged and
validated.

Status: local durable truth.

Promote these checks into `/tools` only when automated conversion or validation
actually lands. Until then, the rules live here and narrow runtime tests keep
the current proof slice aligned with the documented packaging assumptions.

## Scope

- applies to shipped asset files referenced from `client/src/assets/config/*`
- applies to files delivered under `client/public/models/metaverse`
- does not move local asset metadata into `@webgpu-metaverse/shared`

## Locked Naming

- stable manifest ids stay versioned, for example `metaverse-hub-crate-v1`
- shipped filenames stay lowercase kebab-case and unversioned
- shipped render assets live under family folders:
  - `characters`
  - `attachments`
  - `environment`
- LOD variants append `-high`, `-medium`, or `-low`
- collision proxies append `-collision`
- a mountable environment asset keeps the same stem between its render and
  collision files

## Current Proof Slice Allowance

Most current metaverse proof render assets are still shipped as embedded
`.gltf` documents. That legacy allowance remains limited to the existing proof
slice while conversion helpers are not yet in repo. New authored character
animation-pack work should ship as `.glb` and move refreshed assets toward the
locked path below instead of widening the old `.gltf` exception.

Proof-slice allowance rules:

- the manifest still resolves one shipped artifact per path
- buffers and images stay embedded as `data:` URIs
- no manifest points at raw DCC source files or authoring-workspace paths
- when a proof asset is materially refreshed, migrate it toward the locked
  `GLB + KTX2 + Meshopt` path below instead of adding more legacy `.gltf`

## GLB Export Checklist

1. Author outside product `src/` trees. Product code consumes only the shipped
   artifact.
2. Apply transforms before export. Imported roots must not need corrective
   runtime scaling.
3. Keep meter scale and identity node scale in shipped output.
4. Keep imported roots upright in the repo's current three.js/glTF orientation
   so runtime does not rotate them to compensate.
5. Preserve stable asset-family stems between manifest ids and shipped
   filenames.
6. Characters targeting `humanoid_v1` preserve `humanoid_root`, `hips`,
   `spine`, `chest`, `neck`, and every canonical socket id from
   `metaverse-canonical-rig.md`.
7. Characters targeting `humanoid_v2` preserve `root`, `pelvis`, the required
   spine, neck, head, arm, and leg chains, and every canonical socket id from
   `metaverse-canonical-rig.md`.
8. Mountable dynamic environment assets export `seat_socket`.
9. Collision proxies ship as separate files and stay simpler than the render
   mesh.
10. Multi-tier assets keep one file per tier and use `-high`, `-medium`, or
   `-low` suffixes that match the manifest `tier`.

## KTX2 Conversion Checklist

- skip only when the asset has no textures
- convert shipped color, normal, and packed utility textures to `KTX2`
- textured shipped assets reference `KHR_texture_basisu` payloads instead of
  raw PNG or JPEG paths
- reduce duplicate materials before conversion; compression does not fix
  unnecessary material splits
- verify alpha and normal-map parity after conversion

## Meshopt Compression Checklist

- run Meshopt on shipped render geometry after export
- keep collision proxies simple; do not preserve decorative render detail in
  collision assets
- verify the shipped asset still loads through the repo `GLTFLoader` path after
  compression
- re-check LOD tier filenames after compression so manifest paths stay stable

## Validation Rules

- every manifest path stays under `/models/metaverse/...`
- manifests may reference only shipped `.glb` or `.gltf` artifacts, never
  `.blend`, `.fbx`, `.obj`, `.png`, or authoring-workspace paths
- current proof-slice `.gltf` assets embed their payloads and use no node
  `scale` transforms
- characters keep canonical socket names exactly; runtime does not alias socket
  names
- dynamic mountables keep `seat_socket`
- filenames stay lowercase kebab-case and unversioned
- runtime consumers may choose LOD tiers, but they do not rewrite asset naming
  or invent fallback file ids

## Repeatable Path

1. Author or update the source asset outside product `src/`.
2. Normalize transforms, naming, sockets, collision split, and LOD stems.
3. Export render and collision artifacts.
4. Convert textures to `KTX2` when present.
5. Apply Meshopt compression to render geometry.
6. Place the shipped artifacts under
   `client/public/models/metaverse/<family>/`.
7. Update the owning manifest entry in `client/src/assets/config`.
8. Run `tests/runtime/client/metaverse-asset-pipeline.test.mjs` and
   `./tools/verify`.
