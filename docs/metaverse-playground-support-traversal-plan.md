# Metaverse Playground Support Traversal Plan

Status: active

Goal:

- make shell traversal more playful without adding mantle or vault
- treat playground map props as authored `support` surfaces when players should
  be able to land on them
- keep shared authoring as the gameplay truth that the engine tool, exported
  bundles, and runtime all consume

Current slice:

1. raise the shared shell jump to roughly `3m` of root rise so grounded play
   can reach more authored props
2. change the playground range barriers from `blocker` to `support` at the
   shared authoring seam and at the duplicated engine-tool manifest seam
3. keep the current barrier visuals and box collision aligned instead of
   faking traversal through animation-driven collider changes
4. update contract and proof coverage so the shipped map now asserts support
   traversal for these barriers

Authoring rules:

- use `support` for playground props players should be able to land on, stand
  on, or chain jumps across
- reserve `blocker` for true containment geometry and other deliberate hard
  stops
- if a prop still feels unreachable after the higher jump, fix authored
  height or scale in content rather than reintroducing collider-height hacks
