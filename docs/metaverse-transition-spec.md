# Metaverse Transition Spec

Status: active escalated work
Last updated: 2026-04-09

## Goal

The ThumbShooter repo becomes WebGPU Metaverse, a metaverse shell that can
launch multiple playable experiences. The repo stays one monorepo with one
`client`, one `server`, and one `packages/shared` contract surface. New games
are added as named experiences inside those workspaces instead of becoming
separate repos by default.

## Durable Decisions

- Keep one browser shell and one server gateway. Do not fork a new repo or
  workspace per game by default.
- Keep `ThumbShooter` as the repo/package/storage namespace. Use `WebGPU
  Metaverse` or `metaverse-shell` for cross-experience product naming, `Duck
  Hunt` for the first experience, and control-specific names such as
  `camera-thumb-trigger` for input modes.
- Add metaverse shell and world code under named `metaverse` domains.
- Add playable game code under `experiences/<experienceId>` domains in
  `client`, `server`, `packages/shared`, and `tests`.
- Use kebab-case experience ids in code and contracts. The first integrated
  experience id is `duck-hunt`; the player-facing label is `Duck Hunt!`.
- Launch flow is: login/profile -> optional camera/controller setup ->
  metaverse world -> portal launch modal -> active experience -> exit back to
  metaverse.
- The initial metaverse world is a WebGPU ocean fly-cam hub using WASD plus
  mouse look. Experience information appears when the player approaches the
  corresponding portal.
- Exiting an experience should preserve profile, audio unlock, and controller
  runtime state when practical. Do not force a full page reload between the
  metaverse and an experience.
- Shared-world slices default to server-owned ticks. Single-player experiences
  may keep client-owned ticks when no shared authority is needed.
- Gateway routes stay namespaced by domain: shared hub traffic lives under
  `/metaverse/*`, while authoritative experience traffic lives under
  `/experiences/<experienceId>/*`.

## Target Workspace Layout

```text
client/src
  app/                      # browser-shell composition only
  metaverse/                # hub world, portal state, shell UI/state
  experiences/
    duck-hunt/
      audio/
      components/
      config/
      network/
      runtime/
      types/
  tracking/                 # thumb/controller tracking shared by shell/games
  audio/                    # shared audio services
  navigation/               # flow legality and experience routing
  network/                  # shared transport adapters and gateway clients
  ui/                       # shared UI primitives and shell overlays

server/src
  metaverse/
    classes/
    config/
    types/
  experiences/
    duck-hunt/
      adapters/
      classes/
      config/
      types/
  index.ts                  # gateway composition only

packages/shared/src
  metaverse/
    experience-catalog.ts
    metaverse-session-contract.ts
    portal-launch-contract.ts
  experiences/
    duck-hunt/
      duck-hunt-room-contract.ts
  ...existing cross-experience primitives

tests/runtime
  metaverse/
  experiences/duck-hunt/

tests/typecheck
  metaverse/
  experiences/duck-hunt/
```

## Ownership Rules

- `client/src/app` mounts the current stage, but it does not own portal rules,
  room rules, or combat rules.
- `client/src/metaverse` owns the main world scene, portal interaction, and the
  experience launch host.
- `client/src/experiences/<experienceId>` owns that experience's UI, runtime,
  render path, and experience-local client networking.
- Shared top-level client domains such as `audio`, `network`, `tracking`, and
  `ui` own reusable cross-experience services. Experience-local content or
  policy for those concerns stays under the owning
  `client/src/experiences/<experienceId>` domain.
- `client/src/tracking` owns reusable thumb/controller capture and worker
  boundaries shared by metaverse setup and experiences.
- `server/src/metaverse` owns metaverse session truth and any authoritative
  world or portal behavior that multiple experiences depend on.
- `server/src/experiences/<experienceId>` owns authoritative session, room, and
  tick logic for that experience.
- `packages/shared/src/metaverse` owns cross-workspace experience ids, portal
  launch contracts, and shared metaverse session shapes.
- `packages/shared/src/experiences/<experienceId>` owns snapshots, commands,
  and events for that specific experience.

## Current Code Mapping

- `client/src/app/components/main-menu-stage-screen.tsx` now serves the
  pre-metaverse setup surface. Duck Hunt room, mode, and start UI now live in
  the Duck Hunt launch surface under `client/src/experiences/duck-hunt`.
- `client/src/game/**/*` is still Duck Hunt-heavy today. Arena, weapon, bird,
  coop, and Duck Hunt render/runtime code continue moving under
  `client/src/experiences/duck-hunt` as follow-up cleanup.
- `client/src/game/classes/hand-tracking-runtime.ts` and related worker code
  should migrate to `client/src/tracking` once the metaverse shell and Duck
  Hunt both depend on them directly.
- `server/src/classes/coop-room-directory.ts` and
  `server/src/classes/coop-room-runtime.ts` now exist as compatibility
  re-exports over the authoritative Duck Hunt runtime in
  `server/src/experiences/duck-hunt`.
- `packages/shared/src/coop-room-contract.ts` now exists as a compatibility
  re-export over
  `packages/shared/src/experiences/duck-hunt/duck-hunt-room-contract.ts`.
- `server/src/index.ts` now exposes namespaced gateway routes, with
  `/metaverse/session` for hub-session authority and
  `/experiences/duck-hunt/coop/rooms*` for Duck Hunt co-op authority.
- Duck Hunt-specific audio content should move under
  `client/src/experiences/duck-hunt/audio`, leaving `client/src/audio` as the
  shared browser audio engine and session layer.
- Generic names such as `GameplaySessionMode` should stay generic only if the
  concept truly spans multiple experiences. Otherwise, rename by experience.

## Migration Order

1. Add metaverse and experience namespaces in `client`, `server`,
   `packages/shared`, and `tests` without changing product behavior yet.
2. Re-home Duck Hunt contracts and runtime modules into `duck-hunt` domains
   while keeping imports and behavior stable.
3. Split the current setup menu into two layers: pre-metaverse setup and
   in-metaverse Duck Hunt launch.
4. Introduce the metaverse world stage and portal-triggered Duck Hunt launch.
5. Add experience return flow that lands the player back in the metaverse
   instead of the old single-game main menu.

## Deferred On Purpose

- persistent avatars or world characters
- avatar selection and cosmetic systems
- separate deployable workspaces or repos per experience
- non-Duck-Hunt experiences before the shared launch/return structure is live
