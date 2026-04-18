# Metaverse Shell And Engine Foundation Plan

Status: active rewrite

## Intent

This plan is rewritten around one concrete end state:

- game content should be built through an engine/sculpting tool
- the runtime should consume stable authored outputs rather than live editor
  state or hand-built app assembly
- the shell and experiences should stay stable while content creation becomes
  much more aggressive

The previous plan correctly identified many runtime hotspots, but it spread
effort across too many cleanup fronts at once. The new plan narrows the
critical path around durable authored and runtime truth.

The question is no longer "how do we perfectly refactor the shell?"

The question is:

- what must become stable first so an engine tool can generate content without
  turning the repo into a moving target

## New End State

The end state for this repo is:

- `WebGPU Metaverse` remains the repo and platform identity
- `metaverse` remains the shell domain: staging-ground, traversal, launch,
  return flow, shell UI, shell runtime orchestration
- experiences remain under `experiences/<experienceId>`
- maps, modes, playlists, sessions, traversal affordances, and resources
  become authored content domains instead of ad hoc runtime assembly
- an engine/sculpting tool authors typed game content and exports stable
  bundles
- client and server both consume those same authored bundles
- users can author or customize the same major gameplay and presentation
  surfaces we can safely customize ourselves, including inputs, physics
  tuning, traversal capabilities, and HUD behavior/layout, through stable
  contracts instead of source edits
- runtime code does not depend on tool document mutation state
- gameplay rules that must agree across client and server live in tiny shared
  deterministic kernels
- traversal is modeled as a generic capability, affordance, action, and
  validation pipeline rather than a pile of world-specific state heuristics
- content teams can "go wild" inside authored data and tool workflows without
  breaking runtime ownership seams or transport contracts

## Core Thesis

The engine tool is not the foundation.

The foundation is:

1. stable authored contracts
2. stable shared traversal and action validation kernels where prediction and
   authority must agree
3. stable runtime loaders/adapters for those contracts
4. stable server session bootstrap from those contracts
5. stable extension surfaces for user-authored inputs, physics, HUD, and other
   safe customization points

After those exist, the engine tool becomes safe to build.

Before those exist, the tool will just encode current runtime accidents in a
second system.

## Non-Goals

This plan does not optimize for:

- maximum cleanup of every large runtime file before authoring contracts exist
- making the current 2D authoring path more permanent
- broad folder theater without a real boundary behind it
- building the engine tool against unstable shell/runtime internals
- preserving legacy proof assembly paths once stable authored owners exist
- introducing new world-specific traversal carveouts just to smooth over
  current disagreement

## Repo Truth To Preserve

These truths stay in force while this plan executes:

- `metaverse` is the shell, not the owner of experience-local gameplay
- the shell remains the launch host and return target
- `duck-hunt` remains the first integrated experience
- WebGPU shell/runtime rendering stays on `three/webgpu` and `three/tsl`
- mounted occupancy is not the long-term primary locomotion mode
- cross-workspace contracts live in `packages/shared`
- product runtime must never depend on live editor mutation state
- normal local gameplay should not require pose corrections caused by
  client/server traversal disagreement

## Canonical Language

Use these terms consistently:

- `shell`: cross-experience runtime host
- `metaverse`: shell domain and current staging-ground launch surface
- `experience`: a game family such as Duck Hunt
- `map`: an authored playable space
- `map bundle`: the authored package for one map
- `mode`: a rules overlay over a map or session setup
- `playlist`: authored selection over maps and modes
- `session`: live authoritative match instance
- `spawn node`: authored player/team/resource spawn anchor
- `resource spawn`: authored lifecycle owner for vehicles, weapons, powerups,
  objectives, or future session resources
- `mode overlay`: authored rule/config layer applied on top of a map bundle
- `environment affordance`: authored world data that affects traversal,
  movement, interaction, or authority validation
- `traversal capability`: a movement class the runtime understands, such as
  grounded, swim, flight, mounted travel, teleport, or future authored modes
- `traversal state`: the currently effective validated movement state for a
  player
- `traversal action`: an action layered on top of traversal, such as jump or a
  future equivalent
- `traversal resolver`: the shared kernel that turns authored affordances plus
  player intent into the effective traversal state the client and server must
  both honor
- `engine tool`: the dedicated authoring surface that creates or edits stable
  authored outputs

Prefer durable language:

- use `traversal capability`, `movement state`, `environment affordance`,
  `transition`, and `authority validation` for shared traversal concepts
- avoid `shoreline`, `water-entry`, `water-exit`, or other world-specific
  names in shared contracts unless the concept is truly authored world content
- use `action` terminology where the framework should support more than jump
- describe systems by what they validate or resolve, not by the first current
  map slice that exposed the bug

## Product / Runtime / Tool Split

This repo needs three explicit layers.

### Product runtime

Owns:

- shell orchestration
- scene/render sync
- local prediction
- authority sync
- HUD and UX
- session boot from authored inputs
- movement runtime implementation that consumes already-resolved traversal
  truth

Must not own:

- live authoring document mutation
- editor interaction state
- editor save formats as a runtime dependency
- permanent gameplay truth that should live in shared traversal or session
  contracts

### Shared authored and validation layer

Owns:

- map bundle shapes
- mode overlay shapes
- spawn/resource authored ids and snapshots
- traversal capability and affordance contracts
- traversal action contracts
- stable serialization boundaries
- tiny deterministic gameplay kernels where both sides must agree
- the shared traversal resolver and authority-facing validation semantics

Must not own:

- browser-only editor code
- renderer glue
- server-only service code

### Engine/sculpting tool

Owns:

- editing authored maps, resources, spawns, affordances, and extras
- editing user-authorable input, physics, traversal, HUD, and
  gameplay/presentation profiles once those contracts exist
- producing valid authored outputs
- validating authored ids and structure before export
- tool-only workflows such as sculpting, placement, inspection, and preview

Must not own:

- product runtime boot
- authoritative session truth at runtime
- transport logic
- shell UI policy

## Developer / User Authoring Symmetry

The long-term target is not "developers can do it in code, users can do a
small subset in tools."

The long-term target is:

- if we can safely tune a product surface, users should eventually be able to
  tune that same class of surface through stable authoring contracts
- the difference between developer and user power should usually be validation,
  permissions, and UX depth, not hidden runtime-only code paths
- if a surface is expected to stay user-authorable, it should not remain
  permanently trapped behind source edits

This rule applies especially to:

- input mappings and control profiles
- gameplay-facing physics tuning
- traversal capabilities, movement constraints, and authored affordance data
- HUD layout, widgets, visibility, and presentation behavior
- authored gameplay/session configuration that is meant to be content-driven

This does not mean every internal implementation seam becomes public.

It means the repo should deliberately separate:

- safe authoring surfaces that users can own
- internal transport, security, and engine internals that should remain
  private

## Gameplay-Affecting Versus Client-Local Customization

User customization is allowed to be broad, but its ownership must stay clear.

### Gameplay-affecting customization

If the customization changes gameplay outcomes, client prediction, server
authority, hit logic, traversal resolution, or other shared truth, it must
flow through shared or authority-reproducible contracts.

Examples:

- traversal capability availability or transition rules
- physics values that change movement, collision, teleport, or gravity
  outcomes
- input routing that changes gameplay actions or timing semantics
- mode rules that alter spawn/resource/session outcomes

### Client-local customization

If the customization changes presentation or local UX without changing
authoritative outcomes, it can stay client-owned.

Examples:

- HUD layout and visual composition
- optional HUD widgets and telemetry displays
- local input bindings, sensitivities, and control presets that still resolve
  into the same stable action semantics
- cosmetic camera or presentation preferences that do not alter gameplay truth

Do not blur these two categories just because the same tool may eventually edit
both.

## Traversal Foundation Rule

Traversal is part of the foundation, not an afterthought.

The repo needs one generic movement pipeline that supports current and future
behavior without special world-specific fixups:

1. authored environment affordances describe what the world allows or blocks
2. player intent requests movement and actions through stable semantics
3. a shared traversal resolver validates that intent against authored
   affordances and authority rules
4. client and server movement runtimes both consume the effective traversal
   state produced by that resolver
5. corrections remain only for real invalid divergence, not ordinary movement
   state changes

This model must cover grounded play, swimming, flying, teleport, gravity
changes, mounted travel, and future authored systems without hardcoding a new
runtime carveout for each one.

## What Must Exist Before Engine Tool Alpha

These are the real prerequisites.

### 1. Stable authored map bundle contracts

At minimum, one shared map bundle contract must exist that can express:

- environment content
- player spawn nodes
- team spawn nodes when needed
- resource spawns
- portals or launch anchors when needed
- map extras that are safe to load on both client and server
- traversal affordances and movement-relevant authored references needed by
  both client and server

The bundle must be JSON-serializable and stable enough that a tool can target
it directly.

### 2. Stable mode overlay contracts

Modes must be able to layer over maps without redefining the map ad hoc in
runtime code.

At minimum, a mode overlay should be able to influence:

- spawn policy
- resource policy
- session rule toggles
- available traversal capabilities or movement-facing rule toggles when needed
- mode-specific authored anchors or references

### 3. Stable traversal contracts and shared resolver ownership

Before the engine tool grows real power, the repo needs explicit shared
ownership for:

- traversal capability ids and state contracts
- traversal action semantics
- authored environment affordances that affect traversal validation
- the traversal resolver used by both client and server

The runtime should not still be inferring core movement truth through
world-specific heuristics when the tool begins targeting authored outputs.

### 4. Stable extension contracts for user-authored systems

Before the engine tool grows real power, the repo also needs explicit contract
ownership for user-authorable:

- gameplay-affecting input profiles and action semantics
- gameplay-affecting physics profiles or bounded tuning surfaces
- client-local HUD definitions or layout/widget profiles

These do not all need full tool UX on day one, but the ownership answer must
be explicit before the tool starts depending on unstable code paths.

### 5. Runtime-owned bundle loaders

The runtime must have one obvious owner for consuming authored bundles.

The shell must stop importing raw proof assembly from `app` state as its long
term composition root.

### 6. Authoritative spawn/resource ownership

Vehicle existence, player spawn selection, and future pickups/objectives must
stop being side effects of occupancy, camera defaults, or raw
`environmentAssetId` shortcuts.

The server must be able to bootstrap authoritative session state from authored
spawn/resource inputs.

### 7. One proven vertical slice with clean traversal agreement

Before engine tool alpha, one complete path must work end to end:

- authored bundle exists
- client loads it
- server loads it
- session/resource boot uses it
- shell or experience launches from it
- ordinary movement state changes do not trigger pose corrections caused by
  client/server traversal disagreement

One vertical slice is enough. The tool does not need multiple polished game
families first.

## Minimum Viable Authored Contract

The first stable authored contract should be intentionally small.

It must also leave explicit extension seams for later user-authored input,
physics, traversal, and HUD customization instead of forcing those to grow out
of private runtime code paths.

### Shared map bundle shape

The first stable map bundle should cover:

- `mapId`
- `label`
- environment asset placements
- environment proof or world-authoring references needed to build runtime proof
- player spawn nodes
- optional team spawn nodes
- resource spawns
- optional portal anchors
- traversal affordance placements, volumes, references, or config needed by
  both client and server
- optional map extras

### Shared resource spawn shape

The first stable resource spawn should cover:

- `spawnId`
- `resourceKind`
- authored transform
- authored asset or content reference
- respawn or cooldown policy when needed
- optional mode tags

### Shared mode overlay shape

The first stable mode overlay should cover:

- `modeId`
- `map compatibility`
- spawn policy knobs
- resource policy knobs
- traversal capability toggles or rule knobs when needed
- rule toggles that affect gameplay bootstrap

### Shared traversal contract shape

The first stable traversal contract should cover:

- capability ids and effective state ids
- authored affordance ids or categories
- movement and action semantics that client and server both understand
- rule fields needed to validate normal state transitions generically

### Stable extension seams to reserve immediately

Even if the first vertical slice does not implement all of these, the contract
model should reserve clear ownership for:

- input profiles that map device-specific controls onto stable action semantics
- gameplay-affecting physics profiles or bounded tuning sets that client and
  server can both reproduce
- traversal capability and affordance data that future tools can author
  without touching runtime source
- HUD profiles that map stable runtime snapshots and intents onto client-owned
  widget/layout definitions

Do not try to solve every future game genre in the first pass.

## Target Ownership Shape

This is the target shape that supports the engine tool end state.

```text
client/src
  metaverse/
    boot/
    hud/
    render/
    traversal/
    world/
      map-bundles/
      resources/
      spawns/
  experiences/<experienceId>/
    authoring/
      engine-tool/
    maps/
    modes/
    playlists/
    runtime/
    network/
    components/

server/src
  metaverse/
    authority/
    world/
      map-bundles/
      resources/
      spawns/
  experiences/<experienceId>/
    maps/
    modes/
    sessions/
    matchmaking/

packages/shared/src
  metaverse/
    traversal/
    world/
    realtime/
    presence/
    session/
    portal/
  experiences/<experienceId>/
    maps/
    modes/
    sessions/
    simulation/
```

Notes:

- `authoring/engine-tool/` is an explicit tooling owner, not product runtime
- the exact tool UI can move later, but the boundary must stay explicit
- product runtime should consume exported outputs, not tool-local document
  internals

## Current Reality

The repo has already made real progress in these areas:

- shell versus experience language is mostly locked
- shared metaverse concern roots now exist
- client metaverse type families are split behind staged entrypoints
- render, traversal, remote-world, and server authority owners are narrower
  than they were
- several god-file hotspots have been decomposed into collaborator owners

That work is useful and should be preserved.

But the critical path is still blocked by four unresolved problems:

### The shell still boots from app-owned proof assembly

The runtime still depends on app-side proof composition patterns that were
supposed to become temporary.

### Spawn and resource ownership is still under-modeled

The repo still carries too much "one grounded spawn" and
`environmentAssetId`-driven identity thinking for the intended future.

### Shared traversal truth is still under-modeled

The repo still allows too much movement truth to emerge from state-specific or
medium-specific runtime heuristics instead of one shared traversal resolver.

### Experiences do not yet prove the authored map/mode/session shape

The first integrated experience still leans on runtime-centric composition
instead of authored map and mode owners.

## Rewritten Execution Sequence

This replaces the old broad sequence with a narrower one.

### Step 1 - Freeze the authored boundary in shared

Create the first stable shared authored contracts for:

- map bundles
- resource spawns
- player and team spawns
- mode overlays
- traversal capability/state/action contracts
- authored traversal affordances
- reserved extension ownership for gameplay-affecting input profiles, physics
  profiles, and client-local HUD profiles

Stop condition:

- both client and server can type against the same authored map bundle surface
- ids and serialization shape are stable enough for tooling to target
- traversal capabilities and authored affordances have explicit shared
  ownership
- there is an explicit ownership answer for where user-authored inputs,
  gameplay-affecting physics tuning, and HUD definitions live

### Step 2 - Replace medium-specific traversal routing with a shared resolver

Move traversal agreement into one shared resolver that:

- consumes authored affordances plus player intent
- validates effective traversal state and action semantics
- can represent grounded, swim, flight, teleport, gravity changes, mounted
  travel, and future authored movement without bespoke world-specific naming

Stop condition:

- client and server both consume the same traversal-state resolution logic
- normal movement state changes no longer require pose corrections
- remaining corrections are reserved for real invalid divergence rather than
  ordinary validated gameplay

### Step 3 - Move shell loading behind a metaverse-owned bundle loader

Create one shell-owned loader entrypoint under:

- `client/src/metaverse/world/map-bundles/`

or, if proof must remain separate briefly:

- `client/src/metaverse/proof/`

Then migrate shell boot off direct `app` proof assembly.

Stop condition:

- `app` no longer acts as the long-term shell map/proof composition root
- the shell loads one authored bundle through one metaverse-owned entrypoint

### Step 4 - Introduce authoritative spawn and resource bootstrap

Promote session bootstrap to explicit authored owners for:

- player spawns
- team spawns
- resource spawns
- vehicle lifecycle policy

Stop condition:

- the server can build authoritative map/session resource state from authored
  inputs
- mounting or occupancy no longer invents vehicle identity/lifetime

### Step 5 - Prove one shell vertical slice from authored data

Pick the current staging-ground and convert it to one authored bundle path.

The goal is not more shell features.

The goal is:

- authored bundle in shared
- shared traversal resolver in use on both client and server
- metaverse loader on client
- authoritative world boot on server
- shell traversal/render consuming the same authored world inputs

Stop condition:

- the staging-ground loads end to end from the authored bundle path
- ordinary shell traversal runs without corrections caused by client/server
  disagreement over validated movement state

### Step 6 - Prove one experience vertical slice from the same model

Use `duck-hunt` as the first proof that the authored model is not
shell-specific.

Add only the smallest seams needed:

- `maps/`
- `modes/`
- `sessions/` where the server actually earns it

Stop condition:

- one Duck Hunt map/mode launch path uses authored bundle + mode overlay inputs
- the same traversal and authority model survives outside the shell slice

### Step 7 - Build engine tool alpha against the stable contracts

Only after Steps 1 through 6 are done:

- build the engine/sculpting tool
- point it at the stable authored contracts
- keep it under an explicit tooling owner

Tool alpha scope should be narrow:

- open one authored bundle
- edit placements
- edit spawn/resource nodes
- edit authored traversal affordance data
- validate ids and references
- export valid authored output

Tool alpha does not need full user-authorable input, physics, traversal, and
HUD editing on day one, but it must not hardcode a future that prevents those
surfaces from being added cleanly.

Stop condition:

- changing authored content no longer requires product runtime surgery

### Step 8 - Expand tool power, delete legacy assembly paths

Once the tool is operating on stable authored contracts:

- remove legacy app-owned proof assembly
- remove temporary compatibility shims when safe
- expand tool capabilities without changing runtime composition roots
- add user-authorable input profiles, physics tuning surfaces, traversal
  profiles, HUD profiles, and broader gameplay/presentation customization on
  top of the stable contract model

## Priority Order

If work has to be cut aggressively, do it in this order:

1. shared authored contracts
2. shared traversal resolver and validation model
3. shell bundle loader migration
4. authoritative spawn/resource bootstrap
5. one shell vertical slice
6. one experience vertical slice
7. engine tool alpha
8. broader cleanup and compatibility deletion

This is the essential path.

Everything else is secondary.

## What Can Wait

These are useful, but not on the critical path for the new end state:

- perfect cleanup of every remaining orchestrator class
- broad barrel cleanup beyond the touched authoring/runtime seams
- large renaming campaigns after the main vocabulary fixes already landed
- sophisticated multi-experience playlist or matchmaking structure before map
  bundles and session bootstrap exist
- feature-rich tooling UI before stable export contracts exist
- reconciliation cosmetics before traversal disagreement has been eliminated at
  the source

## Immediate Repo Changes This Plan Implies

The next concrete implementation packets should be:

### Packet A - shared authored contracts

Add first stable shared owners for:

- `packages/shared/src/metaverse/world/` authored shell map inputs
- `packages/shared/src/metaverse/traversal/` shared capability, affordance,
  and resolver contracts
- `packages/shared/src/experiences/<experienceId>/maps/`
- `packages/shared/src/experiences/<experienceId>/modes/`

### Packet B - shared traversal resolver ownership

Move client and server traversal agreement behind one shared resolver and stop
letting world-specific movement state heuristics decide core authority truth.

### Packet C - shell runtime loader migration

Add:

- `client/src/metaverse/world/map-bundles/`

Then move shell-stage loading behind that owner and reduce
`client/src/app/states/metaverse-asset-proof.ts` to a temporary adapter or
delete it if the new loader fully replaces it.

### Packet D - server authoritative bootstrap

Add or promote:

- `server/src/metaverse/world/map-bundles/`
- `server/src/metaverse/world/resources/`
- `server/src/metaverse/world/spawns/`

Then move authoritative world boot toward authored inputs instead of
single-spawn and implicit vehicle identity shortcuts.

### Packet E - first authored staging-ground bundle

Create the first authored shell bundle and make client and server consume it
through the same shared traversal and authored-world model.

### Packet F - first authored Duck Hunt map/mode slice

Create the first experience-owned authored map and mode overlay path.

## Decision Rules During Execution

Use these rules while implementing this plan:

- if a change helps the engine tool but deepens runtime dependence on live
  authoring state, reject it
- if a change adds tool flexibility by making bundle contracts looser and less
  stable, reject it
- if a user-facing customization changes gameplay outcomes, it must flow
  through shared or authority-reproducible contracts
- if a user-facing customization is client-local, keep it out of authority
  surfaces and let it stay client-owned
- if a change makes the shell less coupled to app-owned proof assembly, prefer
  it
- if a change makes client and server consume the same authored truth, prefer
  it
- if a change makes client and server resolve traversal truth through the same
  shared kernel, prefer it
- if a capability is meant to be user-authorable later, do not leave it hidden
  behind a permanent developer-only code path
- if a change adds more runtime cleanup without moving authored contracts,
  traversal agreement, or loaders forward, deprioritize it
- if a change fixes disagreement by adding more world-specific transition
  carveouts instead of improving shared traversal validation, reject it
- if a change makes the tool depend on unstable runtime internals, reject it

## Success Criteria

This plan is successful when all of the following are true:

- the shell loads authored content through a metaverse-owned bundle/proof
  boundary rather than app-owned proof assembly
- client and server both consume the same authored map bundle inputs
- spawn and resource lifecycles come from authored ownership rather than
  implicit side effects
- client and server both consume the same shared traversal resolver for normal
  movement state validation
- ordinary validated gameplay no longer produces pose corrections caused by
  traversal disagreement
- user-facing input, physics, traversal, and HUD customization live behind
  explicit contract surfaces instead of source-edit-only paths
- one experience proves the same content model outside the shell
- the engine tool can create or edit content without requiring runtime
  architecture surgery
- runtime code does not depend on editor-specific mutation state

## Failure Modes To Avoid

This plan has failed if:

- the engine tool ships before stable authored contracts exist
- the shell still depends on app-owned proof assembly as its composition root
- client and server still reconstruct map/resource truth differently
- client and server still resolve traversal truth through different runtime
  heuristics
- vehicle/resource lifetime still depends on occupancy or raw asset ids
- meaningful user customization of inputs, physics, traversal, or HUD still
  requires source edits or hidden developer-only hooks
- the tool writes one format while runtime really depends on a different hidden
  assembly path
- the first experience still cannot prove authored maps and modes outside the
  shell
- ordinary movement state changes still need corrections because the source
  model is not shared

## Summary

The repo does not need a bigger refactor plan.

It needs a narrower one.

The new critical path is:

1. authored contracts
2. shared traversal resolver
3. authored loaders
4. authoritative authored bootstrap
5. one shell proof
6. one experience proof
7. engine tool

That is the foundation that lets content creation speed up without making the
runtime collapse under it.
