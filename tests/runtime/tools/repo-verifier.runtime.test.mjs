import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { afterEach } from "node:test";

import { collectRepoVerificationErrors } from "../../../tools/internal/repo-verifier.mjs";

const temporaryRepos = [];

function createFixtureRepo(overrides = {}) {
  const repoRoot = mkdtempSync(join(tmpdir(), "thumbshooter-verify-"));
  temporaryRepos.push(repoRoot);

  const files = {
    "AGENTS.md": "# private local guidance\n",
    "README.md": "# ThumbShooter\n",
    "spec.md": "# Spec\n",
    "progress.md": "# Progress\n",
    "docs/dependencies.md": `# Dependency Baseline

## Runtime

- \`react@19.2.4\`
- \`react-dom@19.2.4\`
- \`shadcn@4.1.2\`
- \`radix-ui@1.4.3\`
- \`tailwindcss@4.2.2\`
- \`@tailwindcss/vite@4.2.2\`
- \`three@0.183.0\`
- \`@mediapipe/tasks-vision@0.10.33\`
- \`@strudel/web@1.3.0\`
- \`@fontsource-variable/geist@5.2.8\`

## Tooling

- \`typescript@6.0.2\`
- \`@types/node@25.5.2\`
- \`@types/react@19.2.14\`
- \`@types/react-dom@19.2.3\`
- \`@types/three@0.183.0\`
- \`@vitejs/plugin-react@6.0.1\`
- \`vite@8.0.3\`
- \`@webgpu/types@0.1.69\`
`,
    "docs/bundle-budgets.json": JSON.stringify(
      {
        budgets: [
          {
            label: "fixture shell javascript",
            pattern: "client/dist/assets/index-*.js",
            maxBytes: 5000,
            maxGzipBytes: 2500
          },
          {
            label: "fixture shell styles",
            pattern: "client/dist/assets/index-*.css",
            maxBytes: 3000,
            maxGzipBytes: 1500
          }
        ]
      },
      null,
      2
    ),
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
            ownerPath: "client/src/game/classes/webgpu-gameplay-runtime.ts",
            testPaths: ["tests/runtime/client/webgpu-gameplay-runtime.test.mjs"]
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
        name: "thumbshooter",
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
        name: "@thumbshooter/client",
        private: true,
        type: "module",
        dependencies: {
          "@fontsource-variable/geist": "5.2.8",
          "@mediapipe/tasks-vision": "0.10.33",
          "@strudel/web": "1.3.0",
          "@thumbshooter/shared": "0.1.0",
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
        name: "@thumbshooter/shared",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "server/package.json": JSON.stringify(
      {
        name: "@thumbshooter/server",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "client/src/app/thumbshooter-shell.tsx": `import { uiPlan } from "../ui/index.ts";
export const shell = uiPlan;
`,
    "client/src/ui/index.ts": `import { buttonLabel } from "../components/ui/button.tsx";
export const uiPlan = buttonLabel;
`,
    "client/src/components/ui/button.tsx": "export const buttonLabel = 'button';\n",
    "client/src/audio/classes/browser-audio-session.ts": `export async function bootAudio() {
  return import("@strudel/web/web.mjs");
}
`,
    "client/src/game/classes/webgpu-gameplay-runtime.ts": `import { WebGPURenderer } from "three/webgpu";
import { color } from "three/tsl";

export function createRuntime() {
  return { WebGPURenderer, color };
}
`,
    "client/src/game/workers/hand-tracking-worker.ts": `import { HandLandmarker } from "@mediapipe/tasks-vision";
export const workerTask = HandLandmarker;
`,
    "client/src/network/classes/local-profile-storage.ts": "export const storage = 'profile';\n",
    "client/src/navigation/guards/resolve-shell-navigation.ts": `import { createRuntime } from "../game/runtime-entry.ts";
export const navigation = createRuntime;
`,
    "client/src/navigation/game/runtime-entry.ts": "export const createRuntime = 'navigation-game';\n",
    "server/src/index.ts": "export const server = 'server';\n",
    "packages/shared/src/index.ts": "export const shared = 'shared';\n",
    "packages/shared/dist/index.js": "export const shared = 'shared';\n",
    "packages/shared/dist/index.d.ts": "export declare const shared: 'shared';\n",
    "client/dist/assets/index-fixture.js": "console.log('fixture-shell');\n",
    "client/dist/assets/index-fixture.css": "body{background:#000;}\n",
    "tests/runtime/client/audio-runtime.test.mjs": "export const audioRuntimeTest = true;\n",
    "tests/runtime/client/navigation-runtime.test.mjs": "export const navigationRuntimeTest = true;\n",
    "tests/runtime/client/local-profile-storage.runtime.test.mjs": "export const profileRuntimeTest = true;\n",
    "tests/runtime/client/webgpu-gameplay-runtime.test.mjs": "export const gameplayRuntimeTest = true;\n"
  };

  for (const [relativePath, contents] of Object.entries({
    ...files,
    ...overrides
  })) {
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

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.deepEqual(errors, []);
});

test("collectRepoVerificationErrors reports illegal client domain imports", () => {
  const repoRoot = createFixtureRepo({
    "client/src/network/classes/local-profile-storage.ts": `import { createRuntime } from "../../game/classes/webgpu-gameplay-runtime.ts";
export const storage = createRuntime;
`
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal client domain import in client/src/network/classes/local-profile-storage.ts: network must not depend on game."
      )
    )
  );
});

test("collectRepoVerificationErrors reports illegal runtime package ownership and banned gameplay APIs", () => {
  const repoRoot = createFixtureRepo({
    "client/src/game/classes/webgpu-gameplay-runtime.ts": `import { ShaderMaterial } from "three";
export const runtime = ShaderMaterial;
`,
    "client/src/app/vision-screen.ts": `import { HandLandmarker } from "@mediapipe/tasks-vision";
export const view = HandLandmarker;
`,
    "client/src/app/audio-screen.ts": `export async function bootAudio() {
  return import("@strudel/web");
}
`
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal gameplay import in client/src/game/classes/webgpu-gameplay-runtime.ts: gameplay code must import Three through three/webgpu or three/tsl only."
      )
    )
  );
  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal gameplay API in client/src/game/classes/webgpu-gameplay-runtime.ts: use three/tsl plus NodeMaterial patterns instead of legacy gameplay material hooks."
      )
    )
  );
  assert.ok(
    errors.some((error) =>
      error.includes(
        "Illegal MediaPipe import in client/src/app/vision-screen.ts: @mediapipe/tasks-vision belongs in client/src/game/workers only."
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
});

test("collectRepoVerificationErrors reports dependency baseline mismatches", () => {
  const repoRoot = createFixtureRepo({
    "client/package.json": JSON.stringify(
      {
        name: "@thumbshooter/client",
        private: true,
        type: "module",
        dependencies: {
          "@fontsource-variable/geist": "5.2.8",
          "@mediapipe/tasks-vision": "0.10.33",
          "@strudel/web": "1.3.0",
          "@thumbshooter/shared": "0.1.0",
          "radix-ui": "1.4.3",
          react: "19.2.4",
          "react-dom": "19.2.4",
          shadcn: "4.1.2",
          three: "^0.183.0"
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
    )
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "client/package.json declares three@^0.183.0, but docs/dependencies.md requires 0.183.0."
      )
    )
  );
});

test("collectRepoVerificationErrors reports missing runtime owner test manifest coverage", () => {
  const repoRoot = createFixtureRepo({
    "client/src/game/classes/local-arena-simulation.ts": "export class LocalArenaSimulation {}\n"
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Missing runtime owner test manifest entry for client/src/game/classes/local-arena-simulation.ts"
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
            ownerPath: "client/src/game/classes/webgpu-gameplay-runtime.ts",
            testPaths: ["tests/runtime/client/webgpu-gameplay-runtime.test.mjs"]
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

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Runtime owner test manifest references a missing runtime test file: tests/runtime/client/missing-audio-runtime.test.mjs."
      )
    )
  );
});

test("collectRepoVerificationErrors reports bundle budget mismatches", () => {
  const repoRoot = createFixtureRepo({
    "docs/bundle-budgets.json": JSON.stringify(
      {
        budgets: [
          {
            label: "fixture shell javascript",
            pattern: "client/dist/assets/index-*.js",
            maxBytes: 10,
            maxGzipBytes: 10
          }
        ]
      },
      null,
      2
    )
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Bundle budget exceeded for fixture shell javascript: client/dist/assets/index-*.js produced"
      )
    )
  );
});

test("collectRepoVerificationErrors reports explicit any in typed source without flagging plain text", () => {
  const repoRoot = createFixtureRepo({
    "client/src/lib/unsafe-cast.ts": `export function unsafeRoundTrip(value: any): any {
  return value;
}
`,
    "client/src/lib/plain-text.ts": `export const note = "without any implicit widenings";
`
  });

  const errors = collectRepoVerificationErrors({
    repoRoot,
    trackedFiles: []
  });

  assert.ok(
    errors.some((error) =>
      error.includes(
        "Explicit any is forbidden in typed source: client/src/lib/unsafe-cast.ts at 1:40, 1:46."
      )
    )
  );
  assert.ok(
    !errors.some((error) => error.includes("client/src/lib/plain-text.ts"))
  );
});
