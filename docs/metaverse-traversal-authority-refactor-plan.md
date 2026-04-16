# Metaverse Traversal Authority Refactor Plan

Step 1 - Introduce shared traversal authority snapshot
Status: completed

Add an explicit shared traversal authority snapshot to the realtime world
contract in `packages/shared`. The first slice carries action kind, phase,
sequence, consumed/rejected sequence bookkeeping, and phase tick metadata for
the current jump model without changing runtime behavior yet.

Step 2 - Make server authority publish traversal action truth
Status: completed

Move authoritative jump/traversal phase ownership behind the shared traversal
authority snapshot in `server/src/metaverse`. The server becomes the source of
truth for action phase transitions instead of only emitting pose plus a few jump
booleans/sequences.

Step 3 - Move client prediction onto the shared traversal phase model
Status: completed

Update `client/src/metaverse/classes/metaverse-traversal-runtime.ts` to predict
against the same explicit traversal action/phase contract rather than inferring
jump state from authoritative pose heuristics.

Step 4 - Restrict reconciliation to rejected actions and hard errors
Status: in progress

Once prediction and authority share the same traversal phase model, simplify
local reconciliation so it only corrects rejected actions, invalid locomotion
state, or gross divergence.

Step 5 - Keep presentation client-owned over predicted traversal state
Status: pending

Drive camera, animation, and body presentation from predicted local traversal
phase instead of letting authoritative pose micro-corrections shape the jump
arc or landing feel.

Step 6 - Extend the same action framework to grounded dash and future actions
Status: pending

After jump is stable on the shared traversal authority model, add new action
types such as grounded dash using the same action kind/phase/rejection surface
instead of new special-case sync paths.
