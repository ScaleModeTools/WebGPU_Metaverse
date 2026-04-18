import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { afterEach } from "node:test";
import { collectRepoVerificationErrors } from "../../../tools/internal/repo-verifier.mjs";

const temporaryRepos = [];

function createFixtureRepo(overrides = {}) {
  const repoRoot = mkdtempSync(join(tmpdir(), "webgpu-metaverse-verify-"));
  temporaryRepos.push(repoRoot);

  const files = {
    "AGENTS.md": "# private local guidance\n",
    "README.md": "# WebGPU Metaverse\n",
    "tools/build": "#!/usr/bin/env bash\n",
    "tools/test": "#!/usr/bin/env bash\n",
    "tools/bench": "#!/usr/bin/env bash\n",
    "tools/verify": "#!/usr/bin/env bash\n",
    "tools/runtime-owner-test-manifest.json": JSON.stringify(
      {
        owners: [
          {
            ownerPath: "client/src/audio/classes/browser-audio-session.ts",
            testPaths: ["tests/runtime/client/audio-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts",
            testPaths: ["tests/runtime/experiences/duck-hunt/webgpu-gameplay-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/navigation/guards/resolve-shell-navigation.ts",
            testPaths: ["tests/runtime/client/navigation-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/network/classes/local-profile-storage.ts",
            testPaths: ["tests/runtime/client/local-profile-storage.runtime.test.mjs"]
          }
        ]
      },
      null,
      2
    ),
    "package.json": JSON.stringify(
      {
        name: "webgpu-metaverse",
        private: true,
        type: "module",
        devDependencies: {
          "@types/node": "25.5.2",
          typescript: "6.0.2"
        }
      },
      null,
      2
    ),
    "client/package.json": JSON.stringify(
      {
        name: "@webgpu-metaverse/client",
        private: true,
        type: "module",
        dependencies: {
          "@fontsource-variable/geist": "5.2.8",
          "@mediapipe/tasks-vision": "0.10.33",
          "@strudel/web": "1.3.0",
          "@webgpu-metaverse/shared": "0.1.0",
          "radix-ui": "1.4.3",
          react: "19.2.4",
          "react-dom": "19.2.4",
          shadcn: "4.1.2",
          three: "0.183.0"
        },
        devDependencies: {
          "@tailwindcss/vite": "4.2.2",
          "@types/react": "19.2.14",
          "@types/react-dom": "19.2.3",
          "@types/three": "0.183.0",
          "@vitejs/plugin-react": "6.0.1",
          "@webgpu/types": "0.1.69",
          tailwindcss: "4.2.2",
          vite: "8.0.3"
        }
      },
      null,
      2
    ),
    "packages/shared/package.json": JSON.stringify(
      {
        name: "@webgpu-metaverse/shared",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "server/package.json": JSON.stringify(
      {
        name: "@webgpu-metaverse/server",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "client/src/app/metaverse-shell.tsx": `import { uiPlan } from "../ui/index.ts"; export const shell = uiPlan; `,
    "client/src/ui/index.ts": `import { buttonLabel } from "../components/ui/button.tsx"; export const uiPlan = buttonLabel; `,
    "client/src/components/ui/button.tsx": "export const buttonLabel = 'button';\n",
    "client/src/audio/classes/browser-audio-session.ts": `export async function bootAudio() { return import("@strudel/web/web.mjs"); } `,
    "client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts": `import { WebGPURenderer } from "three/webgpu"; import { color } from "three/tsl"; export function createRuntime() { return { WebGPURenderer, color }; } `,
    "client/src/tracking/workers/hand-tracking-worker.ts": `import { HandLandmarker } from "@mediapipe/tasks-vision"; export const workerTask = HandLandmarker; `,
    "client/src/network/classes/local-profile-storage.ts": "export const storage = 'profile';\n",
    "client/src/navigation/guards/resolve-shell-navigation.ts": `import { createRuntime } from "../game/runtime-entry.ts"; export const navigation = createRuntime; `,
    "client/src/navigation/game/runtime-entry.ts": "export const createRuntime = 'navigation-game';\n",
    "server/src/index.ts": "export const server = 'server';\n",
    "packages/shared/src/index.ts": "export const shared = 'shared';\n",
    "packages/shared/dist/index.js": "export const shared = 'shared';\n",
    "packages/shared/dist/index.d.ts": "export declare const shared: 'shared';\n",
    "tests/runtime/client/audio-runtime.test.mjs": "export const audioRuntimeTest = true;\n",
    "tests/runtime/client/navigation-runtime.test.mjs": "export const navigationRuntimeTest = true;\n",
    "tests/runtime/client/local-profile-storage.runtime.test.mjs": "export const profileRuntimeTest = true;\n",
    "tests/runtime/experiences/duck-hunt/webgpu-gameplay-runtime.test.mjs": "export const gameplayRuntimeTest = true;\n"
  };

  for (const [relativePath, contents] of Object.entries({ ...files, ...overrides })) {
    const absolutePath = join(repoRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }

  return repoRoot;
}

afterEach(() => {
  while (temporaryRepos.length > 0) {
    rmSync(temporaryRepos.pop(), { force: true, recursive: true });
  }
});

test("collectRepoVerificationErrors accepts a repo fixture that matches the current rules", () => {
  const repoRoot = createFixtureRepo();
  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });
  assert.deepEqual(errors, []);
});

test("collectRepoVerificationErrors reports illegal client domain imports", () => {
  const repoRoot = createFixtureRepo({
    "client/src/network/classes/local-profile-storage.ts": `import { createRuntime } from "../../experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts"; export const storage = createRuntime; `
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal client domain import in client/src/network/classes/local-profile-storage.ts: network must not depend on experiences."
      )
    )
  );
});

test("collectRepoVerificationErrors reports illegal runtime package ownership and banned gameplay APIs", () => {
  const repoRoot = createFixtureRepo({
    "client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts": `import { ShaderMaterial } from "three"; export const runtime = ShaderMaterial; `,
    "client/src/app/vision-screen.ts": `import { HandLandmarker } from "@mediapipe/tasks-vision"; export const view = HandLandmarker; `,
    "client/src/app/audio-screen.ts": `export async function bootAudio() { return import("@strudel/web"); } `,
    "client/src/app/physics-screen.ts": `export async function bootPhysics() { return import("@dimforge/rapier3d"); } `
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal gameplay import in client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts: gameplay code must import Three through three/webgpu or three/tsl only."
      )
    )
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal gameplay API in client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts: use three/tsl plus NodeMaterial patterns instead of legacy gameplay material hooks."
      )
    )
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal MediaPipe import in client/src/app/vision-screen.ts: @mediapipe/tasks-vision belongs in client/src/tracking/workers only."
      )
    )
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal Strudel import in client/src/app/audio-screen.ts: import the lightweight @strudel/web/web.mjs entrypoint instead of the package root."
      )
    )
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal Rapier import in client/src/app/physics-screen.ts: @dimforge/rapier3d belongs in client/src/physics only."
      )
    )
  );
});

test("collectRepoVerificationErrors reports missing runtime owner test manifest coverage", () => {
  const repoRoot = createFixtureRepo({
    "client/src/experiences/duck-hunt/classes/local-arena-simulation.ts": "export class LocalArenaSimulation {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/experiences/duck-hunt/classes/local-arena-simulation.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats authority folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "server/src/metaverse/authority/traversal/player-traversal-authority.ts":
      "export class PlayerTraversalAuthority {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for server/src/metaverse/authority/traversal/player-traversal-authority.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats hud folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "client/src/metaverse/hud/metaverse-runtime-hud-publisher.ts":
      "export class MetaverseRuntimeHudPublisher {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/metaverse/hud/metaverse-runtime-hud-publisher.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats boot folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "client/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts":
      "export class MetaverseRuntimeBootLifecycle {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/metaverse/boot/metaverse-runtime-boot-lifecycle.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats remote-world folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "client/src/metaverse/remote-world/metaverse-remote-world-presentation-state.ts":
      "export class MetaverseRemoteWorldPresentationState {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/metaverse/remote-world/metaverse-remote-world-presentation-state.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats simulation folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "client/src/metaverse/traversal/simulation/metaverse-fixed-step-traversal-simulation.ts":
      "export class MetaverseFixedStepTraversalSimulation {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/metaverse/traversal/simulation/metaverse-fixed-step-traversal-simulation.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors treats surface folders as runtime owner roots", () => {
  const repoRoot = createFixtureRepo({
    "client/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts":
      "export class MetaverseUnmountedSurfaceLocomotionState {}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/metaverse/traversal/surface/metaverse-unmounted-surface-locomotion-state.ts"
      )
    )
  );
});

test("collectRepoVerificationErrors reports missing runtime test files referenced by the manifest", () => {
  const repoRoot = createFixtureRepo({
    "tools/runtime-owner-test-manifest.json": JSON.stringify(
      {
        owners: [
          {
            ownerPath: "client/src/audio/classes/browser-audio-session.ts",
            testPaths: ["tests/runtime/client/missing-audio-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/experiences/duck-hunt/classes/webgpu-gameplay-runtime.ts",
            testPaths: ["tests/runtime/experiences/duck-hunt/webgpu-gameplay-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/navigation/guards/resolve-shell-navigation.ts",
            testPaths: ["tests/runtime/client/navigation-runtime.test.mjs"]
          },
          {
            ownerPath: "client/src/network/classes/local-profile-storage.ts",
            testPaths: ["tests/runtime/client/local-profile-storage.runtime.test.mjs"]
          }
        ]
      },
      null,
      2
    )
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Runtime owner test manifest references a missing runtime test file: tests/runtime/client/missing-audio-runtime.test.mjs."
      )
    )
  );
});

test("collectRepoVerificationErrors reports explicit any in typed source without flagging plain text", () => {
  const repoRoot = createFixtureRepo({
    "client/src/lib/unsafe-cast.ts": `export function unsafeRoundTrip(value: any): any { return value; } `,
    "client/src/lib/plain-text.ts": `export const note = "without any implicit widenings"; `
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Explicit any is forbidden in typed source: client/src/lib/unsafe-cast.ts at 1:40, 1:46."
      )
    )
  );

  assert.ok(!errors.some((error) => error.includes("client/src/lib/plain-text.ts")));
});

test("collectRepoVerificationErrors reports generated shared artifacts inside packages/shared/src", () => {
  const repoRoot = createFixtureRepo({
    "packages/shared/src/index.js": "export const shared = 'generated';\n",
    "packages/shared/src/index.js.map": "{}\n"
  });

  const errors = collectRepoVerificationErrors({ repoRoot, trackedFiles: [] });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Generated shared source artifact found in packages/shared/src/index.js; packages/shared/src must stay source-only."
      )
    )
  );
});
