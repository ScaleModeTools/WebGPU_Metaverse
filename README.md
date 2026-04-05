# ThumbShooter

ThumbShooter is a browser FPS prototype where the player aims with a webcam-
tracked hand pose and fires by dropping the thumb relative to the index finger.
The current shipped build is milestone 4 local combat progression with the
phase 5 audio prototype live on top of it.

## What Ships Now

- local username, profile, calibration, audio, and best-score persistence
- shared browser audio unlock plus live Strudel shell/gameplay loops
- explicit webcam permission flow plus worker-first MediaPipe Hand Landmarker
- nine-point affine aim calibration
- WebGPU arena gameplay with readable bird targets and semiautomatic thumb-drop
  firing
- local hit, kill, score, streak, and round-phase tracking
- completed / failed local rounds with restart-ready flow
- typed Web Audio cues for UI, calibration, and the semiautomatic pistol
- HUD and in-game menu support for score, streak, kills, recalibration, and
  music/SFX controls

Still intentionally deferred:

- server-authoritative gameplay
- multiplayer/network sync
- automatic weapons
- off-screen reload behavior

## Repo Map

- `client`: React + Vite shell, WebGPU gameplay runtime, worker tracking, HUD
- `server`: TypeScript service boundary for future authority/network slices
- `packages/shared`: cross-workspace contracts and invariant-bearing value
  objects
- `tests`: runtime and contract coverage
- `tools`: non-interactive build, test, bench, and verify entrypoints
- `docs`: dependency baseline and bundle-budget references
- `examples`: reference material only, never product code

## Main Runtime Owners

- `ThumbShooterShell`: top-level browser-shell composition
- `HandTrackingRuntime`: webcam boot, worker lifecycle, latest validated hand
  snapshots
- `LocalArenaSimulation`: calibrated aim, weapon loop, HUD snapshots, combat
  integration
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
npm run dev:client
npm run start:server
```

To review the current client locally:

```bash
npm install
npm run dev:client
```

## Fast Orientation

- `README.md` is the public blank-slate orientation surface.
- `docs/dependencies.md` is the public dependency baseline.
- local/private steering for autonomous contributors lives outside this public
  README and can be more detailed than what belongs here.

## Locked Runtime

- gameplay: Three.js `r183`, `three/webgpu`, `three/tsl`
- UI shell: React + shadcn (`radix-nova`)
- tracking: worker-first MediaPipe Hand Landmarker
- audio: Strudel BGM, Web Audio SFX
- fallback: explicit unsupported state, not silent renderer downgrade
- first calibration model: 2D affine
- first weapon: semiautomatic pistol
