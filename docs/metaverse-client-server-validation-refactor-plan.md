# Metaverse Client Server Validation Refactor Plan

Status: active

## Goal

- engine-tool authoring produces the runtime artifact both client and server
  use
- client renders the same world and gameplay profile truth the server
  validates
- the same normalized intent, gameplay profile, and starting state yield the
  same gameplay output on both sides
- supported gameplay paths do not rely on local invention or routine snap
  correction

## Current Baseline

- `Validate + Run` already exports the current draft and boots an exact preview
  artifact on both client and server
- shared world artifacts already carry authoritative collision and dynamic-body
  truth in several runtime paths
- the largest remaining drift is in gameplay profile ownership, normalized
  input interpretation, and duplicated movement rules

## Invariants

- world truth: exported world/session artifacts only
- physical truth: real colliders and dynamic bodies; semantic volumes only for
  extra gameplay meaning
- input truth: raw device bindings may stay client-local, but normalized
  gameplay intent is the shared/server seam
- movement truth: shared kernels plus shared gameplay profiles; local physics
  and traversal owners adapt them
- test truth: parity is proven from shared parse through client load and server
  bootstrap

## Ordered Phases

### Phase 0 — Baseline lock

Status: done

Keep the current preview/export path stable while the rest of the refactor
lands.

Exit:

- every run path still boots the exact exported artifact for that run
- editor reopen/edit flows still point back to the source bundle, not the
  preview artifact id

### Phase 1 — Shared gameplay profile contracts

Status: done

Add shared owners for gameplay-affecting profile data. Start with the profile
ids and typed snapshots that select:

- normalized input interpretation
- grounded/swim/mounted traversal tuning
- gameplay-relevant body physics tuning

Exit:

- validated movement and action tuning no longer live only in client or
  server-local constants
- map/session contracts can reference gameplay profiles by stable id

Progress:

- added shared gameplay profile contracts and registry in `packages/shared`
- map bundles now carry a required shared `gameplayProfileId`
- shared bundle parsing validates gameplay profile ids instead of accepting
  unknown runtime tuning

### Phase 2 — Engine-tool profile authoring and export

Status: done

Expose gameplay profile selection in the engine tool and export it with the
same authored world/session artifact the runtime already boots.

Exit:

- `Validate + Run` artifacts carry gameplay profile selection
- export validation rejects missing or incompatible profile ids
- tool preview no longer depends on editor-only gameplay toggles

Progress:

- engine-tool projects now round-trip `gameplayProfileId`
- authoring UI exposes gameplay profile selection from the shared registry
- preview export writes the selected gameplay profile into the runtime bundle

### Phase 3 — Client runtime profile consumption

Status: done

Replace hard-coded client movement/physics selections with the exported shared
profile resolution path.

Targets:

- metaverse runtime config
- traversal setup
- environment and vehicle physics setup

Exit:

- client prediction consumes bundle/session-selected shared profiles
- camera, HUD, and presentation polish remain client-local

Progress:

- client map bundle loading resolves the shared gameplay profile
- metaverse runtime config now derives validated movement tuning from the
  selected profile instead of fixed imports
- client-only camera, correction, and presentation fields remain local

### Phase 4 — Server authoritative profile consumption

Status: done

Replace server-local movement and physics constants with the same shared
profiles used by client prediction.

Exit:

- authoritative traversal and gameplay validation consume the same selected
  profile ids as the client
- server-local fallback tuning is removed from supported gameplay paths

Progress:

- authoritative world bundle bootstrap now resolves the shared gameplay
  profile
- server traversal, surface policy, and vehicle/swim configs now derive from
  the selected gameplay profile instead of fixed imports

### Phase 5 — Normalized input seam

Status: done

Make normalized gameplay intent the only cross-network gameplay input shape.

Rules:

- raw keyboard, mouse, and gamepad bindings stay client-local
- transport carries normalized intent plus ordering/context, not device trivia
- gameplay-affecting input interpretation settings live in shared profiles

Exit:

- server validation depends on normalized intent only
- local remaps no longer change authoritative gameplay outputs

Progress:

- shared realtime contracts now expose one gameplay-level traversal-intent
  builder instead of repeating jump/body/facing interpretation in client
  transport owners
- the client frame loop now resolves one unmounted traversal-intent request
  per frame and feeds that same request into local prediction preview and
  network sync instead of letting each path reinterpret raw input separately
- mounted vehicle traversal already derives one normalized driver-control
  request inside the mounted runtime and reuses that same result for local
  vehicle prediction and outbound driver-control sync
- both supported traversal lanes now cross the network on normalized gameplay
  intent instead of device-local input trivia

### Phase 6 — Deterministic movement kernel convergence

Status: complete

Move gameplay-relevant step math and action resolution out of duplicated
client/server config paths into shared kernels parameterized by gameplay
profiles.

Order:

1. grounded locomotion
2. jump and airborne resolution
3. swim or other medium-driven traversal
4. mounted or vehicle travel

Exit:

- the same state, intent, and profile yield the same movement/action outputs
  in shared tests
- client and server runtimes adapt shared outputs instead of forking rules

Progress:

- grounded-body stepping now resolves Rapier controller results through one
  shared kernel path instead of duplicating the controller-result-to-step-state
  reconstruction in separate client and server runtimes
- client fixed-step traversal and server authoritative unmounted traversal now
  share one callback-driven unmounted body-step path for
  `prepare -> body advance -> outcome resolve` instead of sequencing those
  stages independently in each runtime
- grounded/swim mode transition semantics after a shared unmounted step now
  resolve through one shared transition snapshot, so client and server no
  longer duplicate the rules for entering swim, exiting to grounded, snapping
  Y to support or waterline, and zeroing vertical velocity on valid medium
  changes
- authoritative player pose ingestion and traversal body sync now derive
  angular velocity, linear velocity, and forward/strafe speeds through one
  shared traversal kinematics helper instead of reconstructing those values in
  separate server owners
- client and server surface-drive runtimes now reuse that same shared
  directional-speed and pose-kinematics math for authoritative sync and
  applied movement snapshots
- mounted vehicle control routing now resolves through one shared
  surface-drive control kernel, and shared gameplay profiles now own vehicle
  water-contact probe truth instead of leaving that validation seam in
  client-local runtime config
- authoritative vehicle advance now reapplies the same waterborne mounted
  drive gate from shared world truth before moving the vehicle, so supported
  boat motion no longer depends on trusting a client-local idle override
- client and server surface-drive body runtimes now resolve their post-step
  pose, angular velocity, linear velocity, and directional-speed state from
  one shared traversal kinematic-state helper instead of rebuilding those
  mounted movement results in parallel after controller movement resolves
- authoritative vehicle drive state now consumes that shared returned
  kinematic snapshot directly instead of re-deriving mounted vehicle speeds
  and angular velocity in a second server-only pass
- authoritative player-runtime sync now applies grounded, swim, and mounted
  kinematic state through the same shared traversal kinematic-state builders,
  so player pose validation no longer mixes manual field copies with older
  low-level directional-speed reconstruction after shared movement results are
  known
- mounted seat and entry routing policy now lives in shared mount/world
  authoring, client mounted control routing now consumes that shared policy
  vocabulary, and server mounted occupancy plus driver-control validation now
  reject unauthored or non-routable mount seats instead of materializing
  server-local seat truth from client requests
- client and server surface-drive body runtimes now share one callback-driven
  surface-drive step kernel for `motion -> controller delta -> world/blocker
  clamp -> kinematic snapshot`, so mounted movement no longer duplicates that
  post-intent body-step sequencing on either side
- mounted occupancy authority mismatch detection and acknowledged local-player
  delivery keys now resolve through one shared mounted-occupancy identity
  helper, so client reconciliation and authoritative mount validation no
  longer invent separate seat/entry identity strings above the shared
  runtime contracts
- authored mounted seat and entry policy now resolves through one shared
  occupancy-policy snapshot helper, so the client vehicle runtime and server
  authoritative mounted-occupancy validation no longer materialize camera,
  control-routing, look-limit, animation, and occupant-role truth from
  separate local builders
- client traversal and scene mount interaction now project mounted
  environment snapshots through one client owner layered directly on the
  shared mounted-occupancy policy, so seat targets, direct-seat availability,
  and mounted presentation state no longer rebuild that mounted snapshot
  shape in parallel local builders
- mounted client presentation now resolves anchor-follow eligibility,
  seated-vs-standing animation vocabulary, and mounted look limits through
  one client occupancy-presentation owner, so traversal camera and traversal
  character presentation no longer reinterpret those mounted policy fields
  separately above the shared mounted snapshot
- render-side mounted character anchoring and attachment holstering now
  consume that same resolved mounted occupancy-presentation snapshot once per
  frame from the local character presentation owner, so render mount
  application no longer re-resolves mounted anchor and holster policy in
  separate downstream owners after traversal already resolved mounted
  presentation truth
- mounted traversal now resolves one occupancy-presentation snapshot inside
  the mounted vehicle owner and reuses it for free-roam gating, mounted
  camera pitch/yaw look rules, anchor-camera selection, and character
  presentation, so traversal camera and character projection no longer
  reinterpret mounted occupancy policy in parallel after the mounted movement
  result is already known
- scene presentation now resolves one render-local mounted presentation
  snapshot per frame and feeds that same snapshot into local character sync
  and scene interaction sync, so the render entrypoint no longer fans raw
  mounted environment policy into separate downstream presentation owners
- render mount selection resolution now lives behind one scene-local mounted
  selection snapshot helper reused by mounted anchor projection and mounted
  character seat application, so render no longer resolves the same
  `environmentAssetId + seatId/entryId` target in separate owners from the
  same mounted environment reference
- scene interaction snapshots now expose only scene-derived focused mountable
  state, so render no longer echoes traversal-owned mounted occupancy back
  through scene sync before the frame loop and mounted interaction runtime
  consume traversal as the single mounted-state owner
- the client frame loop now resolves one mounted interaction snapshot above
  traversal and scene results, and mounted command routing plus the HUD reuse
  that same snapshot for boarding entries, seat-target environment selection,
  and mounted seat switching instead of re-deriving those actions from raw
  `focusedMountable + mountedEnvironment` pairs in separate shell owners
- shell HUD and frame-loop surfaces no longer mirror top-level focused
  mountable or mounted environment fields, so shell/runtime consumers now
  treat the mounted interaction snapshot itself as the single mounted
  interaction owner instead of carrying compatibility duplicates beside it
- the shell HUD now resolves one mounted-access snapshot above mounted
  interaction and the stage screen consumes that prepared HUD copy directly,
  so the React shell no longer interprets raw mounted interaction into panel
  headings, detail text, and action presentation inline
- shared map bundles now preserve mounted seat and entry authoring through
  export and parse, and authoritative bundle bootstrap carries that authored
  mount policy into server validation instead of dropping back to bundle-local
  omissions
- the next convergence target is the remaining runtime-local adaptation above
  those shared movement outcomes, mainly any final shell-facing adapter that
  still wraps converged mounted interaction or HUD state instead of consuming
  the prepared mounted snapshots directly

### Phase 7 — World semantics cleanup

Status: complete

Remove remaining fake physical stand-ins once the real shared world truth is in
place.

Rules:

- mesh or terrain collision is the physical truth when authored
- semantic volumes remain only for extra meaning such as water, trigger,
  damage, climb, or one-way behavior
- support or grounding should come from the same physical world the server
  validates, not a separate approximation layer

Exit:

- no supported gameplay path depends on fake blocker/support volumes for
  ordinary solid meshes

Progress:

- the shipped staging-ground map bundle now carries physical environment
  collider truth for authored assets, and authoritative vehicle bootstrap now
  consumes that exported collider instead of rebuilding drive shape from
  semantic blocker surface-collider stand-ins
- exported map bundles now also carry authored dynamic-body and
  traversal-affordance truth, so client environment proof loading and server
  authoritative bootstrap no longer rehydrate those gameplay-affecting world
  semantics from shared surface authoring behind the bundle boundary
- collision-mesh-backed dock and boat assets now export no authored
  surface-collider stand-ins at all, so exported runtime truth no longer
  carries redundant support or blocker cuboids where client and server
  already derive support and physical collision from the authored mesh or
  physical collider
- engine-tool `Validate + Run` bundle export now follows that same rule for
  collision-mesh-backed assets, so supported preview/runtime paths no longer
  depend on fake solid support/blocker volumes for ordinary solid meshes

### Phase 8 — Dynamic collision parity

Status: active

Bring actors, vehicles, and other authoritative movable bodies into the same
client/server collision truth model.

Progress:

- client remote-player blocker collision now resolves from fresh
  authoritative world snapshots instead of remote presentation state, and the
  client traversal physics filters no longer ignore those remote grounded
  blockers, so supported remote players stay solid on the client according to
  authoritative locomotion and mounted-occupancy state rather than shell-side
  animation inference
- client remote vehicle render and collision pose now resolve through separate
  runtime owners, so scene presentation can keep smoothed remote vehicle
  motion while vehicle collision and support surfaces follow fresh
  authoritative vehicle snapshots directly instead of inheriting that
  presentation smoothing as collision truth
- client remote environment-body render and collision pose now resolve through
  separate runtime owners, so sampled movable-body presentation can stay
  smooth while dynamic-body collision follows fresh authoritative environment
  body snapshots directly instead of letting physics-body presentation
  overwrite that scene pose in the same frame
- mounted traversal runtime now boots mountable vehicle occupancy from the
  collision-owned dynamic environment pose reader instead of the scene
  presentation pose owner, so boarding and mounted bootstrap paths inherit the
  same authoritative moving-support truth that client collision already uses
  rather than a smoothed render pose
- client locomotion transition settle paths now reuse the shared authoritative
  traversal tick cadence instead of local `1/60` fallback physics steps, so
  swim-to-grounded and related supported transition paths no longer inject an
  extra client-only dynamic-body contact seam that can surface as unnecessary
  local pose reconciliation around movable-body collisions
- local authority pose correction now measures hard-snap drift from planar and
  vertical separation once instead of double-counting the vertical term
  against the full 3D distance, so supported high-speed shoreline and
  water-entry drift no longer trips premature gross-divergence correction just
  because authoritative Y drift is present alongside ordinary planar lag

Exit:

- players, vehicles, and other solid authoritative bodies stay collidable on
  both sides
- identity and occupancy come from authored/resource owners, not ad hoc local
  inference

### Phase 9 — Session and mode overlay truth

Status: pending

Let sessions and modes choose authored maps, resource layouts, and gameplay
profiles without introducing one-off runtime rule paths.

Exit:

- launch variations and session overlays remain shared, typed, and
  server-validatable
- different authored rule sets no longer require bespoke client/server glue

### Phase 10 — Deletion pass

Status: pending

Remove transitional compatibility paths after the shared truth path is proven.

Delete:

- duplicated movement constants
- preview-only gameplay toggles
- validator-only world approximations
- routine snap or replay behavior that exists only to hide supported-path drift

Exit:

- supported gameplay paths no longer rely on local invention

## Test Gates

- shared tests prove `state + intent + profile -> output`
- parity tests prove one exported artifact is parsed, loaded, and bootstrapped
  across shared, client, and server
- `Validate + Run` tests prove the current export is the artifact both sides
  boot
- fixtures prefer arrays and stable ids over object-specific names
- `./tools/verify` remains the stop-ship gate after implementation phases

## Order Rationale

- shared profile contracts come before tool UI so the tool exports stable truth
- tool export comes before runtime consumption so preview and shipped launch use
  the same path
- client and server consumption come before deleting compatibility code
- dynamic actor collision comes after world and movement truth are stable
