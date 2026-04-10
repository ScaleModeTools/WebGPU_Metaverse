# Metaverse Grounded Collision And Locomotion Slice

Status: completed for the static grounded collision and locomotion slice.

This document defines the next local grounded-body slice after the first
metaverse-only capsule proof.

## Goal

Add the next grounded-body slice to the metaverse runtime that:

- adds static hub prop blockers through local metaverse-to-physics adaptation
- supports walkable stepped geometry through simple collider groups first
- keeps static collision-proxy mesh support available for assets that outgrow
  simple shapes
- improves grounded movement feel with acceleration and deceleration
- bridges grounded speed truth into idle versus walk presentation
- keeps moving platforms, the skiff, and vehicles explicitly deferred

## Current Decisions

- physics ownership remains client-local under `client/src/physics`
- metaverse proof config remains the local source for static hub collision
- simple colliders remain the first choice:
  - boxes
  - grouped boxes
- collision proxies remain separate shipped assets and are never the render mesh
- static mesh-derived collision is allowed only from authored `-collision`
  assets when grouped simple colliders are not sufficient
- moving platforms and vehicles are not part of this slice

## Progress

### Step 1 — Add Static Hub Prop Blockers

Status: completed.

- add local proof metadata for static collision on the dock and crates
- adapt proof metadata into fixed Rapier colliders through `client/src/physics`
- support placement-aware translation, rotation, and scale for simple box
  colliders

Exit check:

- grounded movement is blocked by dock and crate colliders
- current fly locomotion remains unchanged

### Step 2 — Add Walkable Stepped Geometry Support

Status: completed.

- support grouped simple colliders for stepped walkable assets
- keep static collision-proxy mesh support available through authored
  `-collision` assets for future assets that outgrow simple shapes
- do not add moving-platform sync in this step

Exit check:

- the dock is walkable through static collision truth
- no render mesh is used directly as the collision source

### Step 3 — Tune Grounded Movement Feel

Status: completed.

- replace direct per-frame grounded translation with local acceleration and
  deceleration state
- keep collision resolution inside the Rapier character controller path
- expose movement speed truth for presentation

Exit check:

- grounded movement still resolves through the controller
- grounded movement now has tuned acceleration and deceleration behavior

### Step 4 — Bridge Idle And Walk Presentation

Status: completed.

- add walk vocabulary coverage to the local animation manifest
- resolve character animation through vocabulary instead of one hard-coded clip
- pass grounded presentation state through typed snapshots into the scene

Exit check:

- grounded presentation switches between idle and walk using runtime speed truth
- scene playback remains downstream of runtime state

### Step 5 — Keep Moving Platforms Deferred

Status: completed.

- do not add skiff collision ownership in this slice
- do not add vehicle controller ownership in this slice
- do not add dynamic-body mount sync beyond the current render-only proof

Exit check:

- static grounded collision and walk/idle ship without broadening into moving
  platform or vehicle ownership
