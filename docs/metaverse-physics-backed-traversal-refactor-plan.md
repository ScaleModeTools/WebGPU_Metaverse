# Metaverse Physics Backed Traversal Refactor Plan

Status: active

Priority: high

Current implementation priority:

- finish Phase 3 so accepted jump is one impulse edge plus ordinary contact,
  and normal supported play does not accumulate `rejected-buffer-expired`
  jump actions
- finish Phase 7 so mounted and moving-support travel cannot inject body
  discontinuities above the physics-owned body seam
- finish Phase 8 so any remaining gross-position convergence episode under
  nominal RTT resolves to either the correct fixed-step sample or an explicit
  intentional discontinuity cause instead of widening reconciliation again
- run Phase 9 as a real deletion pass behind the remaining Phase 3 and 7
  seams so mounted carry, jump-gating shortcuts, and compatibility mirrors are
  removed instead of relabeled

Execution rules:

- keep each migration slice narrow and shippable
- do not run old kinematic truth and new physics-backed truth in parallel
  longer than one migration slice needs
- when a supported path moves to the new owner, delete the replaced path in
  the same implementation step when practical
- if one phase starts expanding into multiple locomotion lanes, split the
  remaining work and finish the current lane first

## Finish Checklist

Close the refactor in this order:

1. observer-side continuity
   - add a two-client runtime test where player A keeps moving while only
     yaw or aim updates advance
   - prove player B keeps receiving fresh remote root position updates across
     those orientation-only refreshes
2. grounded tap parity
   - add an end-to-end tap test through the real client and authoritative
     transport path
   - close any case where a brief directional tap advances materially farther
     on authority than it does locally
3. jump authority seam
   - finish ordinary supported jumping so normal play does not accumulate
     `rejected-buffer-expired`
   - add the stale rejection race where authority rejects jump seq `N` after
     the client already issued seq `N+1`, and prove only the stale jump
     collapses
4. intentional spawn discontinuity
   - route respawn or team-spawn through the same explicit discontinuity lane
     as initial spawn bootstrap
   - add a mid-session respawn test
5. mounted and moving-support continuity
   - finish deleting or fully owning the remaining mounted or support carry
     patches above the shared body seam
6. deletion pass
   - remove the transitional discontinuity hooks, jump gating, and remaining
     compatibility mirrors in the same slices that close their owning seams

The refactor is not done until:

- short directional taps stay in local and authoritative parity without a
  visible overshoot correction
- remotes continue moving while same-input-sequence yaw or aim refreshes are
  the only incoming updates
- ordinary supported jump and landing play no longer racks up normal-play
  `rejected-buffer-expired` resolutions
- respawn uses the same intentional discontinuity labeling path as initial
  spawn bootstrap
- targeted runtime suites pass and `./tools/verify` passes

## Near-Term Slices

Take the next implementation slices in this order:

1. add observer-side yaw-only remote movement coverage
2. add grounded tap-parity coverage
3. fix whichever of those fails first
4. finish the remaining Phase 3 jump authority seam
5. finish the remaining Phase 7 and 8 discontinuity wiring
6. run Phase 9 as deletion, not as relabeling

## Goal

- player motion truth comes from a physics-owned collider pose and velocity on
  both client and server
- the unmounted player has one canonical active body/capsule state: server
  authority validates it, client prediction advances the same state,
  reconciliation converges to it, and animation or camera read from it
- inputs resolve to acceleration, impulse, and damping targets instead of
  bespoke position edits
- jump validation is one accepted impulse event plus ordinary gravity and
  contact rules
- grounded, swim, and mounted remain coarse gameplay modes that select force,
  drag, support, and control-routing policy instead of becoming separate
  parallel movement engines
- animation, look, and camera derive from physical state and mode instead of
  defining gameplay truth
- reconciliation is reserved for true divergence, not supported contact or
  transition paths

## Current Baseline

- ack-aligned reconciliation is landed: authoritative local delivery is
  freshness-keyed, correction reads one active-body owner, and the HUD now
  distinguishes convergence episodes from settle steps while preserving
  episode-start context
- repeated ack buckets now match the correct fixed-step local sample by exact
  authoritative tick first and authoritative target time second, so identical
  acknowledged input and orientation buckets no longer collapse to an arbitrary
  newest local sample
- false disagreement from blocked-planar contact noise has been pushed down
  toward telemetry and debug territory
- Phase 8 is narrowed now: sample matching, bounded convergence, and
  episode-start telemetry are landed and covered, so the remaining
  reconciliation seam is proving the correct fixed-step sample versus a real
  intentional discontinuity instead of reopening pose-era correction design
- Phase 3 still has a visible authority-resolution seam because normal play
  can accumulate `rejected-buffer-expired` jump actions; ordinary supported
  jumping must reduce to accepted impulse plus ordinary contact before the
  phase closes
- intentional-discontinuity plumbing is partially landed already:
  reconciliation detail, HUD freeze-through, and developer reports can now
  carry explicit discontinuity causes, and mounted boarding/unboarding plus
  moving-support carry already feed those causes into traversal diagnostics
- Phase 7 still has a visible continuity seam because mounted boarding,
  unboarding, and moving-support carry can still adapt the body above the
  shared runtime owner; the remaining work is routing every supported authored
  translation through that lane or deleting the carry seam entirely
- presentation is standardizing around Mesh2Motion and `humanoid_v2`, but that
  work stays outside this traversal plan except where it derives from the same
  capsule truth

## Invariants

- authoritative truth: accepted inputs plus fixed-step physics plus shared
  gameplay profiles
- physical truth: collider pose, linear velocity, angular velocity, contacts,
  and impulses
- capsule truth: the active grounded or swim body kinematic snapshot is the
  authoritative unmounted player pose; top-level pose mirrors are compatibility
  views, not a second correction source
- causality truth: input drives forces, impulses, movement, and contacts;
  pose and presentation derive from that physical state and must never become
  the gameplay authority that drives movement back the other way
- diagnostic truth: contact, drive target, interaction, and jump-body fields
  explain why prediction diverged; they must not veto convergence when
  authoritative capsule position is grossly different
- mode truth: grounded, swim, and mounted select legal forces, damping,
  support interpretation, and control routing
- presentation truth: animation, look, HUD, and camera derive from physical
  state and acknowledged action edges
- validation truth: the server validates accepted action edges and resulting
  physical state envelopes, not animation-style subphases
- migration truth: client and server must share one deterministic movement
  kernel per migrated lane; do not run a physics-backed client against
  kinematic authoritative truth for the same supported path

## Ordered Phases

### Phase 0 — Target lock

Status: complete

Lock the target model before more local kinematic fixes pile up.

Rules:

- no new validation logic may depend on presentation-only `jump-up`,
  `jump-down`, or similar animation vocabulary
- no new reconciliation path may be introduced only to hide kinematic drift
- the migration target is physics-backed gameplay with coarse modes, not a
  totally uncontrolled rigid-body avatar

Exit:

- the repo has one explicit plan for the physics-backed traversal target
- future traversal fixes can be judged against the target model instead of
  expanding kinematic special cases

Progress:

- locked the migration rules so the repo does not keep both old kinematic
  truth and new physics-backed truth alive for the same supported path any
  longer than one narrow migration slice requires

### Phase 1 — Shared physics traversal profile contracts

Status: complete

Move gameplay-affecting body physics and locomotion force tuning behind shared
contracts.

Targets:

- body mass and collider sizing
- grounded acceleration and damping
- air steering limits
- jump impulse and gravity-affecting tuning
- swim drag, buoyancy, and steering tuning
- mounted or moving-support carry policy where gameplay depends on it

Exit:

- gameplay-affecting body physics tuning no longer lives in client-only or
  server-only constants
- exported bundles and authoritative bootstrap can select the same locomotion
  physics profile by stable id

Progress:

- shared gameplay profiles now expose one grounded jump-physics snapshot for
  `airborneMovementDampingFactor`, `gravityUnitsPerSecond`,
  `jumpGroundContactGraceSeconds`, and `jumpImpulseUnitsPerSecond`, so the
  first client and server jump owners stop reaching into the full grounded
  body config ad hoc as Phase 3 starts
- grounded body gameplay tuning is starting to converge on one shared contract
  too: `packages/shared` now owns the common grounded-body config snapshot,
  and the client plus server grounded-body runtimes now extend that shared
  gameplay-affecting config base instead of maintaining parallel local config
  shapes for the same body physics seam
- surface-drive body gameplay tuning now has the same shared contract shape:
  `packages/shared` owns the common surface-drive body config snapshot, and
  the client plus authoritative surface-drive runtimes now normalize swim-body
  and other surface-drive config through that shared base instead of
  maintaining duplicate local config owners
- mounted and moving-support gameplay policy is now converged on the same
  shared contract surface too: mounted occupancy identity, authored seat or
  entry policy, mounted look constraint policy, and mounted surface-drive
  routing all resolve through shared metaverse contracts instead of client-only
  or server-only policy forks

### Phase 2 — Physics-owned body state seam

Status: complete

Define the shared runtime seam around a physics-owned player body instead of a
kinematic reconstruction.

Targets:

- physics-owned body snapshot shape
- contact and support snapshot vocabulary
- water-contact snapshot vocabulary
- per-tick movement request and force-target vocabulary
- authoritative and predicted body-state adaptation boundaries

Exit:

- traversal consumes one physics-owned body state shape on both client and
  server
- presentation and telemetry read physical state from that owner instead of
  rebuilding parallel motion truth

Progress:

- grounded body snapshots on both client and server now carry one explicit
  physics-owned `linearVelocity` owner, the shared traversal kinematics now
  exposes the directional-speed-to-linear-velocity helper that backs that
  owner, and the main grounded readers in server player-state sync plus client
  presentation and telemetry now consume snapshot-owned physical velocity
  instead of reconstructing it from pose delta or side getters
- grounded body state now carries one shared `contact` owner too: controller
  support and blocker outcome, desired movement delta, and applied movement
  delta now freeze onto the client/server grounded body snapshot, the
  authoritative realtime player snapshot carries that same contact owner, and
  local HUD or developer telemetry reads grounded contact truth from that body
  owner instead of inferring barrier or support state later from pose drift
- authoritative player runtime state is shrinking toward that same body seam
  now: server player authority and mounted-occupancy owners no longer cache
  redundant unmounted `forwardSpeedUnitsPerSecond` or
  `strafeSpeedUnitsPerSecond` fields beside the physics-owned body pose and
  linear-velocity owners, so authoritative player state keeps less parallel
  kinematic reconstruction that the shared grounded body snapshot already owns
- the grounded body seam is narrower now too: client and server grounded-body
  runtime snapshots no longer mirror derived `jumpReady`,
  `planarSpeedUnitsPerSecond`, or `verticalSpeedUnitsPerSecond` scalars beside
  `jumpBody` and `linearVelocity`, and the shared unmounted traversal adapter
  now reads jump continuity from `jumpBody` directly instead of carrying a
  second mirrored jump-ready or vertical-speed view one layer above the
  physics-owned body state
- authoritative server state is carrying one last-grounded body owner now
  instead of split caches: player authority, unmounted simulation, world
  surface resync, and snapshot assembly now share one
  `lastGroundedBodySnapshot` owner for grounded contact, drive target, jump
  body, and grounded Y continuity rather than storing those as separate
  `lastGrounded...` fields across the server runtime
- authoritative realtime player snapshots and client telemetry now keep that
  same ownership shape too: realtime world contracts now publish one nested
  `groundedBody` owner, and local correction snapshots, local surface-routing
  telemetry, HUD freeze-through, and the developer report now consume that
  same nested grounded-body owner instead of flattening contact, drive,
  interaction, and jump-body truth back out into parallel compatibility fields
- the grounded-body seam now has one shared cross-workspace runtime contract
  too: `packages/shared` owns the common grounded-body owner and runtime
  snapshot vocabulary, the client and authoritative grounded-body runtimes now
  freeze from that same shared owner instead of assembling duplicate local
  runtime shapes, server player-state sync consumes the shared grounded-body
  snapshot directly, and authoritative realtime grounded-body snapshots now
  reuse the same shared owner creator at the boundary
- the same runtime-owner cleanup now reaches the swim surface-drive lane too:
  `packages/shared` owns the common surface-drive body runtime snapshot, the
  client and authoritative surface-drive runtimes now freeze swim-body state
  from that shared owner, server player-state sync now consumes the shared
  surface-drive runtime snapshot directly, and the duplicated local
  forward-speed or strafe-speed caches have been deleted from both runtimes in
  favor of the shared kinematic snapshot as the single owner
- swim-body runtime state now carries one body-owned drive target too: the
  shared surface-drive contract publishes swim drive intent through the same
  snapshot shape on client, server, realtime snapshots, HUD telemetry, and
  the developer report, so swim authority no longer drops back to raw
  velocity-only inspection when diagnosing or comparing active body state
- swim-body runtime state now carries one body-owned contact owner too: the
  shared surface-drive contract freezes applied versus desired movement plus
  blocker state on the swim body snapshot, client and authoritative swim
  runtimes preserve that owner through sync, and HUD plus developer reports
  can compare swim blocker truth directly instead of printing `n/a` around
  swim corrections
- authoritative realtime player state now carries that swim body owner too:
  shared realtime world contracts can freeze one nested `swimBody` snapshot,
  authoritative world snapshot assembly now publishes the authoritative
  surface-drive runtime snapshot through that field, and the local
  authoritative-player reconciliation seam now carries the shared swim-body
  owner instead of only loose `position`, `linearVelocity`, and `yawRadians`
  fields for swim authority
- client correction and telemetry seams now keep that same swim-body owner
  instead of rebuilding swim truth from partial fields: local-authority
  correction snapshots, local surface-routing telemetry, authoritative local
  HUD telemetry, and the HUD freeze-through now all carry nested `swimBody`
  state, and the last swim-only local velocity helper above the body seam has
  been deleted in favor of the shared swim-body owner
- authoritative realtime grounded state now carries the same runtime
  kinematics ownership shape too: shared realtime player contracts now freeze
  `groundedBody` as a full grounded-body runtime snapshot with
  `position`/`linearVelocity`/`yawRadians`, authoritative world snapshot
  assembly publishes that nested grounded-body runtime state directly, and the
  client ack-delivery, local-authority correction, HUD telemetry, and
  developer report now read one shared active-body kinematic seam across
  grounded and swim instead of branching between nested swim state and
  top-level player pose fields

### Phase 3 — Jump and airborne impulse model

Status: active

Reduce jump validation to one accepted impulse edge plus ordinary airborne
movement rules.

Rules:

- jump is an accepted impulse opposite gravity from a valid grounded state
- airborne travel comes from carried velocity, gravity, collision, and bounded
  air steering
- animation-specific jump phases stay presentation-only

Exit:

- barrier jumps and other supported airborne paths no longer require
  validation logic tied to presentation semantics
- the server expects the physical consequence of the accepted jump rather than
  bespoke jump phase labels
- ordinary supported jumping does not accumulate
  `rejected-buffer-expired` authority resolutions during normal play

Progress:

- one shared grounded jump-physics owner now resolves airborne damping, jump
  impulse plus gravity vertical speed, and post-step grace or snap-suppression
  continuity, and the grounded traversal simulation, grounded body kernel, and
  client/server grounded body runtimes now reuse that owner instead of
  reassembling those jump rules piecemeal
- grounded body runtimes now expose one shared jump-body snapshot, and the
  first client and server traversal-action readers consume that narrower jump
  body owner directly instead of re-deriving jump phase from the broader
  grounded body snapshot
- authoritative realtime player snapshots now carry the shared grounded
  jump-body snapshot, and snapshot-side traversal-action reconstruction reads
  that owner before falling back to older vertical-speed inference
- authoritative server runtime state no longer caches a second
  `lastGroundedBodyJumpReady` copy beside the shared grounded jump-body owner;
  snapshot assembly now derives that compatibility field straight from the
  shared jump-body snapshot
- client local surface-routing telemetry and HUD freeze-through now carry the
  shared grounded jump-body snapshot too, and the developer-facing local jump
  gate formatter reads that shared body owner instead of only the older
  duplicated `groundedBodyJumpReady` view
- the authoritative-local-player HUD and developer-report jump diagnostics now
  carry that same shared grounded jump-body owner too, so the client-side
  authoritative jump gate no longer depends on a separate
  `groundedBodyJumpReady` compatibility view
- the old duplicated jump debug compatibility view is shrinking now: local
  traversal telemetry, HUD freeze-through, and developer overlay formatting no
  longer mirror separate `groundedBodyGrounded`,
  `groundedBodyJumpReady`, or local jump `verticalSpeedUnitsPerSecond`
  fields beside the shared `groundedJumpBody`, and realtime jump debug no
  longer carries a separate `groundedBodyJumpReady` transport field
- local-authority reconciliation no longer keeps a jump-issued suppression lane
  just to preserve the older controller model: gross divergence is now judged
  against the active grounded-or-swim body kinematic owner, and airborne jump
  continuity no longer gets a dedicated correction exemption path
- remaining work: jump still keeps explicit gameplay gating above pure impulse
  and contact through shared jump-ready paths, and live HUD diagnostics can
  still show `rejected-buffer-expired` during normal play; Phase 3 does not
  close until accepted jump input yields body impulse and ordinary airborne
  contact rules without extra validation-era jump gating as a separate
  gameplay seam

### Phase 4 — Grounded `WASD + Shift` locomotion migration

Status: complete

Replace bespoke grounded controller stepping with acceleration and damping
targets applied to the physics-owned player body.

Rules:

- grounded movement should be driven by force or velocity targets, not direct
  gameplay position edits
- support detection must come from the same contact truth the server validates
- sprint remains a grounded locomotion tuning change on the same body, not a
  separate movement engine
- player and dynamic-body collision should resolve through the same body and
  contact model on both sides

Exit:

- supported grounded motion no longer needs local kinematic carry or contact
  patches to stay in parity
- grounded `WASD + Shift` travel, barrier contact, and mover contact behave
  the same on client and server given the same inputs and world truth

Progress:

- grounded body state now carries one shared drive-target owner too: resolved
  `boost`, `moveAxis`, `strafeAxis`, and target grounded speeds now freeze onto
  the shared grounded body snapshot from the low-level surface traversal owner,
  client and server grounded body runtimes plus authoritative realtime player
  snapshots carry that same drive target, and local HUD or developer telemetry
  now reads current and last-correction grounded drive truth from the body owner
  instead of inferring it later from raw control input and pose drift
- client unmounted surface locomotion is carrying less parallel state above
  that owner now too: automatic surface-routing telemetry no longer fans out
  into five separate scalar caches, and fixed-step traversal results no longer
  mirror `supportHeightMeters` beside the transition snapshot when grounded
  entry truth already lives in the shared transition owner
- authoritative grounded correction application now consumes nested grounded
  body runtime kinematics directly, so correction and HUD/reporting no longer
  mix top-level player pose with body-owned grounded movement truth

### Phase 5 — Dynamic actor and mover parity

Status: complete

Make other players and authoritative movable bodies part of the same
physics-backed contact truth instead of special traversal exceptions.

Exit:

- player-vs-player and player-vs-mover collision are authoritative on both
  sides
- supported contact with remote actors no longer depends on client-only
  blockers or local contact exclusions

Progress:

- grounded body `interaction` truth is now part of the same shared body owner
  as contact, drive target, and jump body: client and server grounded-body
  runtimes sync dynamic-body impulse policy through that body snapshot,
  authoritative last-grounded body continuity preserves it, authoritative
  realtime player snapshots now publish it, and client reconciliation, HUD,
  and developer diagnostics read mover-interaction truth from that shared
  owner instead of parallel runtime-local toggles or hidden contact-state
  bookkeeping
- player collision parity is now authoritative on both sides too: remote-player
  blocker policy lives in shared presence contracts, the client keeps other
  players as physics-only blockers instead of fake surface truth, and the
  server authoritative traversal path excludes only self while preserving solid
  player-vs-player contact

### Phase 6 — Swim and medium transition migration

Status: complete

Move water and medium transitions onto the same body velocity and contact truth
instead of bespoke locomotion handoff state.

Rules:

- entering or leaving swim keeps the same body and carries physical velocity
- mode changes adjust drag, buoyancy, and control rules instead of replacing
  the motion model
- waterline and support thresholds stay shared and authoritative

Exit:

- grounded-to-swim and swim-to-grounded travel no longer need explicit
  carryover patches to preserve supported velocity
- supported shoreline transitions stay in parity without routine correction

Progress:

- the swim lane now carries one shared body owner instead of a partial
  position-plus-yaw seam: the shared unmounted traversal kernel reads a shared
  surface-drive body runtime snapshot for `swimBody`, the client swim fallback
  and presentation path now use that same runtime snapshot owner, and the
  client plus authoritative swim runtimes no longer keep separate local
  planar-speed caches beside the shared kinematic swim body state
- the authoritative swim correction path now uses that owner end to end too:
  shared realtime player snapshots publish `swimBody`, local authoritative
  pose delivery keeps the shared swim-body snapshot intact, and client swim
  correction now syncs from that shared owner directly instead of
  reconstructing authoritative swim state from another loose
  `position`/`linearVelocity`/`yawRadians` adapter seam
- the authoritative swim debug and correction surfaces now use that same owner
  too: authoritative correction magnitudes and authoritative swim surface
  routing inside HUD telemetry now resolve from `swimBody.position` and
  `swimBody.yawRadians` instead of the older generic top-level pose fields, so
  swim diagnostics stay attached to the migrated swim-body seam rather than a
  compatibility view beside it
- authoritative local-player correction and delivery now read one active-body
  kinematic owner across both media: the shared realtime helper resolves the
  current grounded-or-swim runtime body from nested authoritative snapshot
  owners, ack delivery keys key off that shared active-body pose, and local
  correction plus HUD surface-routing no longer branch manually between swim
  body pose and top-level player pose for unmounted authority
- shoreline and water-entry or exit handoff truth now stays on body-owned
  velocity: supported swim entry and swim exit carry velocity through the same
  runtime body owners instead of bespoke carryover patches sitting above the
  locomotion state

### Phase 7 — Mounted and moving-support adaptation

Status: active

Keep mounted as a coarse gameplay mode layered over physics-backed motion.

Targets:

- moving-support carry truth
- boarding and unboarding handoff
- mounted driver control routing
- occupant collision and support interpretation

Exit:

- mounted and moving-support traversal adapt the same physics-owned body state
  instead of switching back to bespoke kinematic carry logic
- mounting no longer reintroduces a separate validation model for supported
  locomotion

Progress:

- mounted traversal, occupancy, environment, and presentation now sit on shared
  mounted occupancy and surface-drive policy owners, while mounted vehicle
  runtime and free-roam moving-support carry adapt the same grounded or vehicle
  body runtimes instead of introducing a separate validation vocabulary above
  those physics-owned owners
- free-roam moving-support carry is tighter now too: authoritative vehicle sync
  no longer teleports the grounded body, force-steps physics, and injects an
  idle grounded advance just to keep deck passengers attached; grounded
  free-roam occupants now sync through one grounded-body owner path, and
  airborne free-roam occupants no longer get support carry reapplied while
  they are off the deck
- mounted traversal now notes `mounted-boarding` and `mounted-unboarding`, and
  traversal runtime notes `moving-support-carry`, into local-authority
  reconciliation telemetry so supported authored translations begin to surface
  as explicit discontinuity causes instead of unexplained gross-position starts
- remaining work: Phase 7 remains open until mounted and moving-support travel
  either stay on continuous body-owner truth or surface an explicit intentional
  discontinuity cause rather than relying on hidden carry patches above the
  physics-owned body seam

### Phase 8 — Reconciliation simplification

Status: active

Eliminate gross-position episode starts that still happen after ack-aligned
matching. Phase 8 is no longer about generic pose-era reconciliation; it is
about proving that authoritative active-body state matches the correct
fixed-step local historical sample, and that any real body discontinuity is
intentional and labeled.

Delete:

- jump-phase-specific validation rules that only protect presentation labels
- transition-specific carry hacks that only preserve kinematic handoff state
- routine snap suppression added only because supported physical paths drifted
  under the older controller model
- broad pose-era or hash-era delivery identities that can hide repeated
  fixed-step samples inside one acknowledged input bucket

Exit:

- reconciliation compares acknowledged authoritative physical state against
  the correct fixed-step predicted physical state, including repeated ack
  buckets where input and orientation edges did not change
- supported gameplay paths do not need special-case correction masks
- supported grounded travel and normal jump or landing play stay under a
  strict convergence-episode budget under nominal RTT, not merely a tolerable
  settle-step count afterward
- intentional discontinuities such as spawn, boarding, unboarding,
  moving-support carry, or authored translations report explicit causes
  instead of surfacing as unexplained gross-position divergence

Progress:

- authoritative local delivery now uses active-body kinematics consistently
  for position, linear velocity, and yaw across grounded and swim authority
  paths
- delivery identity is freshness-only rather than a broad gameplay-state hash,
  so receipt of newer authoritative local state does not depend on unrelated
  body, contact, or gameplay debug fields
- local correction uses bounded planar, vertical, and yaw convergence instead
  of hard overwrite semantics; gross active-body divergence starts bounded
  convergence toward authoritative capsule truth, while contact, drive,
  interaction, jump-body, and mode differences remain telemetry and
  correction-reason data instead of vetoing convergence
- traversal now exposes episode-start telemetry: start reason, start
  magnitudes, historical-sample match state, authoritative age, authoritative
  tick, authoritative sequence, acknowledged input and orientation sequences,
  snapshot sequence, and explicit intentional-discontinuity cause
- mounted boarding, mounted unboarding, and moving-support carry now feed
  explicit intentional-discontinuity causes into reconciliation diagnostics,
  so those authored translations do not have to appear as unlabeled starts in
  the developer report
- live diagnostics can distinguish a new convergence episode from a settle
  tail, which makes supported-path drift debuggable instead of merely
  countable
- client unmounted reconciliation no longer rewrites predicted grounded
  traversal action state from authoritative jump acceptance before body
  correction, and the last public helper that existed mainly to support that
  action-era correction seam has been deleted so input-side sequence issuance
  stays local while authoritative correction stays body-first
- swim correction is tighter too: authoritative ack delivery keeps capsule
  kinematics and traversal authority as the delivery identity, while HUD
  telemetry and developer reports carry swim-body drive and blocker contact
  truth from the shared body owner, so remaining swim convergence can be
  judged against actual swim physics state instead of a loose
  position-plus-velocity seam

Remaining work:

- harden historical-sample identity so authoritative ack chooses the correct
  fixed-step local sample inside an ack bucket, not merely any sample sharing
  the same acknowledged input or orientation edges
- treat HUD starts above the current thresholds of 1.25 m planar, 1.5 m
  vertical, or 0.12 rad yaw as real episode starts even when historical sample
  matched, body divergence is absent, contact divergence is absent, and
  snapshot age is low
- investigate the narrowed live hypothesis: either historical-match identity
  is still too coarse inside repeated ack buckets, or one supported path still
  produces a true spatial discontinuity that preserves velocity and contact
  while translating the capsule
- finish routing all supported authored translations through explicit
  intentional-discontinuity causes; any remaining unlabeled gross-position
  starts on supported paths should be treated as bugs
- close Phase 8 only when supported grounded travel and normal jump or landing
  play stay under a strict convergence-episode budget, not merely when settle
  steps look smooth afterward

### Phase 9 — Deletion pass

Status: active

Remove remaining kinematic-first traversal owners once the physics-backed path
is proven.

Delete:

- duplicated kinematic locomotion math
- transition-specific carryover patches made obsolete by persistent body
  velocity
- validation logic that reasons about presentation-only traversal vocabulary
- temporary discontinuity hooks and compatibility mirrors once mounted,
  support-carry, and jump seams stay continuous on shared truth

Exit:

- gameplay traversal truth is physics-backed with coarse gameplay modes on top
- supported transitions stay continuous through shared body owners instead of
  relying on correction-time relabeling or local shortcut carry
- supported locomotion no longer relies on the old kinematic controller as the
  primary gameplay authority
- normal traversal does not depend on intentional-discontinuity labels as a
  product behavior escape hatch

Progress:

- the remaining compatibility cleanup targeted by this plan is now folded into
  the landed owners: jump debug duplication was deleted from realtime and HUD
  surfaces, authoritative correction no longer carries the older jump-specific
  suppression plumbing, and grounded plus swim authority delivery now read the
  nested body owners directly instead of reconstructing locomotion truth from
  top-level pose mirrors
- Phase 8 diagnostics are now in place only to expose the remaining shortcut
  seams; they are not the target state and should disappear with the shortcut
  path they currently identify
- remaining work: delete the remaining jump gating when Phase 3 lands, delete
  mounted and moving-support carry adaptation when Phase 7 lands on shared
  body continuity, and remove the transitional discontinuity hooks in the same
  slices instead of leaving them behind as permanent escape hatches

## Test Gates

- shared tests prove `profile + body state + input -> force or impulse output`
- parity tests prove one exported world and one shared locomotion profile
  produce the same contact outcomes on client and server
- integration tests cover barrier jumps, shoreline entry and exit, player
  contact, and moving-support travel without routine local correction
- reconciliation tests cover gross position-only capsule divergence so matching
  contact or drive flags cannot hide an authoritative position error
- reconciliation tests cover many fixed steps reusing the same acknowledged
  input and orientation values, and authoritative matching still selects the
  nearest correct local historical sample
- grounded-movement soak tests cover ordinary `WASD + Shift` travel under
  nominal snapshot age and require zero or near-zero convergence episodes, not
  just a tolerable number of settle steps
- jump soak tests cover ordinary supported jump and landing play without
  accumulating `rejected-buffer-expired` action resolutions
- moving-support and mount handoff tests require shared-body continuity under
  nominal RTT; any remaining discontinuity label is a transitional regression
  to delete, not accepted steady-state behavior
- HUD and developer-report tests cover explicit discontinuity labels for
  mounted boarding, mounted unboarding, and moving-support carry; spawn should
  use the same gate once runtime wiring lands
- presentation tests prove animation and camera derive from physical state
  instead of defining gameplay outcomes
- `./tools/verify` remains the stop-ship gate after implementation phases

## Order Rationale

- shared locomotion physics profiles come first so both sides can migrate
  against stable gameplay truth
- jump comes before grounded `WASD + Shift` migration because the accepted
  impulse model is the smallest clean slice of the physics-backed target and
  removes presentation-specific jump validation first
- grounded `WASD + Shift` migration follows immediately after jump so the main
  player locomotion lane moves onto the same persistent body model before swim
  and mounted work
- dynamic actor contact lands before reconciliation deletion so player and
  mover collisions are proven under the new model
- reconciliation simplification is already landed; the remaining work is
  deletion in the jump and mounted lanes rather than reopening correction
