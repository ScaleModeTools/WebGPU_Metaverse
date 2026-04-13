# Metaverse Movement Enhancement Scorecard

Purpose: record the movement and collision enhancement push as explicit repo
truth for this implementation cycle.

Scoring rubric:
- `Impact`: player-facing improvement if the slice lands correctly
- `Effort`: implementation cost across code, tests, and verification
- `Risk`: likelihood of regressions or durable seam churn
- `Confidence`: current confidence in the implementation path
- scale: `1` low to `10` high

Step 1 — Vehicle Deck Traversal and Hull Blockers
Status: completed
Impact: 10/10
Effort: 8/10
Risk: 7/10
Confidence: 8/10
Score summary: highest-value slice; fixes skiff hull phasing and makes
free-roam vehicle decks behave like land.
Completed work:
- stop swim locomotion from phasing through vehicle hull blockers
- keep free-roam `deck-entry` traversal grounded against moving vehicle support
- validate dynamic vehicle support and blocker colliders against traversal tests
Implementation outcome:
- swim locomotion now constrains against blocker hulls instead of phasing
- free-roam deck occupants ride vehicle motion while staying grounded to deck support
- traversal tests lock grounded deck-entry and blocker-aware swim behavior

Step 2 — Vehicle Seat Collision as Authored Geometry
Status: completed
Impact: 8/10
Effort: 5/10
Risk: 4/10
Confidence: 8/10
Score summary: moderate implementation cost with clear asset-owned seams.
Completed work:
- author blocker colliders for skiff seat and helm volumes
- preserve deck support as walkable while making occupied seat spaces collide
- update asset proof and collision tests to lock the authored shape
Implementation outcome:
- skiff manifest now includes explicit helm and bench blocker volumes
- deck support remains walkable while seat space is collision-authored in assets
- asset proof and environment physics tests now expect the expanded skiff collider set

Step 3 — Remote Player Collision Blockers
Status: completed
Impact: 8/10
Effort: 7/10
Risk: 6/10
Confidence: 7/10
Score summary: requires runtime integration because player collision must exist
in the physics world before local traversal advances.
Completed work:
- synthesize blocker colliders for remote free-roam players
- rely on authored seat blockers for anchored mounted occupants
- sync remote blocker colliders through the metaverse runtime frame loop
Implementation outcome:
- remote standing and free-roam mounted players now publish blocker colliders
- swimmers and anchored seated occupants are excluded from walkable/blocker synthesis
- runtime frame ordering now syncs remote blockers before local traversal advances

Step 4 — Jump Reach Ledge Landing
Status: completed
Impact: 9/10
Effort: 7/10
Risk: 7/10
Confidence: 6/10
Score summary: valuable feel improvement with the highest locomotion-regression
risk in this push.
Completed work:
- extend grounded autostep policy so jump-reachable ledges become landable
- keep normal walking limited to step-height behavior
- lock the jump-landing path with traversal and grounded-body tests
Implementation outcome:
- grounded-body autostep now accepts a runtime-selected max rise envelope
- traversal requests the larger envelope only when jump carry can actually clear the rise
- tests now distinguish blocked tall walking from successful jump-assisted ledge landing

Step 5 — Prop Semantics Verification
Status: completed
Impact: 6/10
Effort: 4/10
Risk: 3/10
Confidence: 9/10
Score summary: lower-cost guardrail slice to keep static versus pushable prop
behavior explicit.
Completed work:
- keep static props as support or blocker collision
- keep pushables as shoveable dynamic blockers, not walkable land
- add or update tests that lock the intended prop semantics
Implementation outcome:
- static support and blocker semantics remain authored through environment colliders
- pushables remain dynamic shoveable blockers and are not promoted into support snapshots
- runtime verification continues to cover pushable presentation and dynamic-body collision ownership

Execution order:
1. Vehicle deck traversal and hull blockers
2. Vehicle seat collision as authored geometry
3. Remote player collision blockers
4. Jump reach ledge landing
5. Prop semantics verification

Verification target:
- narrow runtime tests after each step
- final gate: `./tools/verify`

Completion result:
- targeted runtime suites passed
- final gate passed: `./tools/verify`
