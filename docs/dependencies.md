# Dependency Baseline

## Runtime

- `react@19.2.4`
- `react-dom@19.2.4`
- `shadcn@4.1.2`
- `radix-ui@1.4.3`
- `tailwindcss@4.2.2`
- `@tailwindcss/vite@4.2.2`
- `three@0.183.0`
- `@mediapipe/tasks-vision@0.10.33`
- `@strudel/web@1.3.0`
- `@fontsource-variable/geist@5.2.8`

## Tooling

- `typescript@6.0.2`
- `@types/node@25.5.2`
- `@types/react@19.2.14`
- `@types/react-dom@19.2.3`
- `@vitejs/plugin-react@6.0.1`
- `vite@8.0.3`
- `@webgpu/types@0.1.69`

## Rules

- gameplay imports are `three/webgpu` + `three/tsl`
- shadcn stays available through `client/components.json` and
  `npx shadcn@latest add ...`
- MediaPipe scope stays Hand Landmarker only, lazy-loaded and worker-first
- audio stays split: Strudel for BGM, raw Web Audio for SFX
- pin runtime deps exactly unless the spec says otherwise
- prefer built-in platform APIs before adding new libraries

## References

- `https://www.npmjs.com/package/three/v/0.183.0`
- `https://threejs.org/docs/llms-full.txt`
- `https://threejs.org/examples/webgpu_compute_birds.html`
- `https://github.com/google-ai-edge/mediapipe/releases/tag/v0.10.33`
- `https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.33`
- `https://ui.shadcn.com/docs/installation/vite`
- `https://ui.shadcn.com/docs/installation/manual`
- `https://www.npmjs.com/package/@strudel/web/v/1.3.0`
- `https://ai.google.dev/edge/api/mediapipe/js/tasks-vision.handlandmarker`
