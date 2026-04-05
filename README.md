# ThumbShooter

ThumbShooter is a type-first monorepo for a browser FPS controlled by hand
tracking.

Current implemented milestone:

- login and local profile persistence
- webcam permission flow
- unsupported WebGPU gameplay route
- calibration shell placeholder
- gameplay shell with in-game menu, recalibration entry point, and music/SFX
  sliders

## Workspaces

- `client`: React + Vite + shadcn browser shell
- `server`: TypeScript headless service boundary
- `packages/shared`: cross-workspace contracts
- `docs`: dependency and setup notes
- `examples`: reference material only

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

To review the current client shell locally:

```bash
npm install
npm run dev:client
```

## Locked Runtime

- gameplay: Three.js `r183`, `three/webgpu`, `three/tsl`
- UI shell: React + shadcn (`radix-nova`)
- tracking: worker-first MediaPipe Hand Landmarker
- audio: Strudel BGM, Web Audio SFX
- fallback: explicit unsupported state, not silent renderer downgrade
- first calibration model: 2D affine
- first weapon: semiautomatic pistol

## Main Docs

- [AGENTS.md](./AGENTS.md)
- [spec.md](./spec.md)
- [docs/dependencies.md](./docs/dependencies.md)
- [progress.md](./progress.md)
