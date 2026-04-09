# ThumbShooter

ThumbShooter is the repo and package namespace for WebGPU Metaverse, a browser
shell that can launch multiple playable experiences. The first
integrated experience is Duck Hunt, where the player aims with a webcam-tracked
hand pose and fires by dropping the thumb relative to the index finger inside a
WebGPU-rendered ocean hunting arena.

## What Ships Now

- local username, profile, calibration, audio, and best-score persistence
- shared browser audio unlock plus live Strudel shell/gameplay loops
- explicit webcam permission flow plus worker-first MediaPipe Hand Landmarker
- nine-point affine aim calibration
- WebGPU ocean-arena gameplay with readable bird targets, a 3D scene
  foundation, and semiautomatic thumb-drop firing
- shared co-op room/session contracts, shared bird snapshots, and a
  server-owned co-op room tick runtime
- browser co-op room sync with join, ready-up, fire-shot, leave-room, and team
  HUD state
- clip-aware semiautomatic weapon behavior with off-screen reload
- local hit, kill, score, streak, and round-phase tracking
- completed / failed local rounds with restart-ready flow
- typed Web Audio cues for UI, calibration, semiautomatic pistol fire, and
  reload completion
- HUD and in-game menu support for score, streak, kills, clip/reload state,
  recalibration, and music/SFX controls

Still intentionally deferred:

- remote teammate visuals and shared gun presentation
- automatic weapons

## Metaverse Transition

The repo now treats the current shooter as the first named experience,
`duck-hunt`, rather than the permanent top-level game shape. The active
structure plan for the metaverse shell plus experience domains lives in
`docs/metaverse-transition-spec.md`.

## Repo Map

- `client`: React + Vite shell, metaverse composition, WebGPU experiences,
  worker tracking, HUD
- `server`: TypeScript metaverse gateway plus experience-authority slices
- `packages/shared`: cross-workspace metaverse and experience contracts plus
  invariant-bearing value objects
- `tests`: runtime and contract coverage
- `tools`: non-interactive build, test, bench, and verify entrypoints
- `examples`: reference material only, never product code

## Main Runtime Owners

- `MetaverseShell`: top-level browser-shell composition
- `HandTrackingRuntime`: webcam boot, worker lifecycle, latest validated hand
  snapshots
- `LocalArenaSimulation`: calibrated aim, weapon loop, HUD snapshots, combat
  integration
- `WeaponRuntime`: clip, cadence, reload timing, and weapon HUD state
- `LocalCombatSession`: local score, streak, timer, and active/completed/failed
  round phases
- `WebGpuGameplayRuntime`: renderer lifecycle, frame loop, and scene draw path

## Commands

```bash
npm install
./tools/build
./tools/test
./tools/bench
./tools/verify
npm run dev
npm run dev:client
npm run dev:server
npm run start:server
```

To review the current client locally:

```bash
npm install
npm run dev:client
```

For local co-op development:

```bash
npm install
npm run dev
```

Use `http://localhost:5173/` when you are testing on the same machine.
The Vite `Network` URL is useful for other devices, but plain HTTP LAN origins
do not satisfy the WebGPU secure-context requirement that `localhost` does.

## Fast Orientation

- `README.md` is the public blank-slate orientation surface.
- `docs/metaverse-transition-spec.md` is the active escalated structure plan
  for metaverse plus experience organization.
- local/private steering for autonomous contributors lives outside this public
  README and can be more detailed than what belongs here.

## Locked Runtime

- gameplay: Three.js `r183`, `three/webgpu`, `three/tsl`
- UI shell: React + shadcn (`radix-nova`)
- tracking: worker-first MediaPipe Hand Landmarker
- audio: Strudel BGM, Web Audio SFX
- fallback: explicit unsupported state, not silent renderer downgrade
- first calibration model: 2D affine
- first Duck Hunt weapon: semiautomatic pistol
