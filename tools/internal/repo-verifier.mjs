import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const requiredEntrypoints = [
  "tools/build",
  "tools/test",
  "tools/bench",
  "tools/verify"
];
const requiredRepoFiles = [
  "AGENTS.md",
  "README.md",
  "spec.md",
  "progress.md",
  "docs/dependencies.md"
];
const productSourceRoots = [
  "client/src",
  "server/src",
  "packages/shared/src"
];
const forbiddenGenericSourceBasenames = new Set([
  "brand.ts",
  "brand.tsx",
  "common.ts",
  "common.tsx",
  "helpers.ts",
  "helpers.tsx",
  "misc.ts",
  "misc.tsx",
  "utils.ts",
  "utils.tsx"
]);
const clientDomainPolicies = new Map([
  [
    "app",
    new Set([
      "app",
      "lib",
      "components",
      "ui",
      "navigation",
      "audio",
      "game",
      "network",
      "assets",
      "shared"
    ])
  ],
  [
    "ui",
    new Set([
      "ui",
      "lib",
      "components",
      "navigation",
      "audio",
      "game",
      "assets",
      "shared"
    ])
  ],
  [
    "components",
    new Set(["components", "lib", "shared"])
  ],
  [
    "navigation",
    new Set(["navigation", "game", "network", "shared"])
  ],
  [
    "audio",
    new Set(["audio", "shared"])
  ],
  [
    "network",
    new Set(["network", "shared"])
  ],
  [
    "assets",
    new Set(["assets", "shared"])
  ],
  [
    "game",
    new Set(["game", "shared"])
  ],
  [
    "lib",
    new Set(["lib", "shared"])
  ]
]);
const runtimeDependencyManifestPaths = ["package.json", "client/package.json"];

function listFiles(rootPath) {
  if (!existsSync(rootPath)) {
    return [];
  }

  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function readImportSpecifiers(contents) {
  const specifiers = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/gm,
    /(?:import|export)\s*["']([^"']+)["']/gm,
    /import\(\s*["']([^"']+)["']\s*\)/gm
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(contents);

    while (match !== null) {
      specifiers.add(match[1]);
      match = pattern.exec(contents);
    }
  }

  return [...specifiers];
}

function readPackageJson(repoRoot, relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
}

function isTypedSourceFile(filePath) {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function isDeclarationFile(filePath) {
  return filePath.endsWith(".d.ts");
}

function assertExists(repoRoot, relativePath, errors) {
  try {
    statSync(join(repoRoot, relativePath));
  } catch {
    errors.push(`Missing required path: ${relativePath}`);
  }
}

function getClientDomain(repoRelativePath) {
  if (!repoRelativePath.startsWith("client/src/")) {
    return null;
  }

  const [, , domain] = repoRelativePath.split("/");

  return domain ?? null;
}

function resolveClientImportDomain(repoRoot, sourceFilePath, specifier) {
  if (specifier === "@thumbshooter/shared") {
    return "shared";
  }

  let absoluteTargetPath = null;

  if (specifier.startsWith("@/")) {
    absoluteTargetPath = join(repoRoot, "client/src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    absoluteTargetPath = resolve(dirname(sourceFilePath), specifier);
  } else {
    return null;
  }

  const repoRelativeTargetPath = relative(repoRoot, absoluteTargetPath);

  if (!repoRelativeTargetPath.startsWith("client/src/")) {
    return null;
  }

  return getClientDomain(repoRelativeTargetPath);
}

function getTrackedFiles(repoRoot) {
  const trackedFilesOutput = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return trackedFilesOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseDependencyBaseline(repoRoot) {
  const baselineLines = readFileSync(
    join(repoRoot, "docs/dependencies.md"),
    "utf8"
  ).split("\n");
  const dependencyMap = new Map();

  for (const rawLine of baselineLines) {
    const line = rawLine.trim();
    const match = /^- `(.+)@([^@`]+)`$/.exec(line);

    if (match === null) {
      continue;
    }

    dependencyMap.set(match[1], match[2]);
  }

  return dependencyMap;
}

function verifyProductImports(repoRoot, sourceFiles, errors) {
  for (const filePath of sourceFiles) {
    const contents = readFileSync(filePath, "utf8");
    const repoRelativePath = relative(repoRoot, filePath);
    const baseName = filePath.split("/").at(-1);

    if (contents.includes("packages/shared/src")) {
      errors.push(
        `Cross-workspace source import found in ${repoRelativePath}; use @thumbshooter/shared instead.`
      );
    }

    if (baseName !== undefined && forbiddenGenericSourceBasenames.has(baseName)) {
      errors.push(
        `Ambiguous source file name found in ${repoRelativePath}; rename it to describe its exact concern.`
      );
    }

    const forbiddenImportPatterns = [
      /from\s+["'][^"']*(?:^|\/)(tests|bench)(?:\/|["'])/m,
      /import\s*\(\s*["'][^"']*(?:^|\/)(tests|bench)(?:\/|["'])\s*\)/m,
      /from\s+["'][^"']*\/dist\//m
    ];

    for (const pattern of forbiddenImportPatterns) {
      if (pattern.test(contents)) {
        errors.push(
          `Forbidden source dependency found in ${repoRelativePath}; product source must not import tests, bench, or built dist output.`
        );
        break;
      }
    }
  }
}

function verifyClientSourceExtensions(repoRoot, errors) {
  const clientSourceFiles = listFiles(join(repoRoot, "client/src"));

  for (const filePath of clientSourceFiles) {
    const repoRelativePath = relative(repoRoot, filePath);

    if (filePath.endsWith(".jsx")) {
      errors.push(
        `Unsupported JSX source file found in ${repoRelativePath}; use .tsx or .ts instead.`
      );
    }
  }
}

function verifySharedDist(repoRoot, errors) {
  const sharedDistRoot = join(repoRoot, "packages/shared/dist");

  if (!existsSync(sharedDistRoot)) {
    errors.push("Missing generated shared dist output in packages/shared/dist.");
    return;
  }

  const sharedSourceBaseNames = new Set(
    listFiles(join(repoRoot, "packages/shared/src"))
      .filter((filePath) => filePath.endsWith(".ts"))
      .map((filePath) => filePath.split("/").at(-1)?.replace(/\.ts$/, ""))
      .filter(Boolean)
  );
  const distFiles = listFiles(sharedDistRoot).filter(
    (filePath) => filePath.endsWith(".js") || filePath.endsWith(".d.ts")
  );

  for (const filePath of distFiles) {
    const baseName = filePath
      .split("/")
      .at(-1)
      ?.replace(/\.d\.ts$/, "")
      .replace(/\.js$/, "");

    if (baseName === undefined) {
      continue;
    }

    if (!sharedSourceBaseNames.has(baseName)) {
      errors.push(
        `Stale generated shared artifact found: ${relative(repoRoot, filePath)}`
      );
    }
  }
}

function verifyWorkspaceDependency(repoRoot, errors) {
  const clientPackage = readPackageJson(repoRoot, "client/package.json");

  if (clientPackage.dependencies?.["@thumbshooter/shared"] !== "0.1.0") {
    errors.push(
      "client/package.json must declare @thumbshooter/shared as a direct workspace dependency."
    );
  }
}

function verifyTrackedPrivacy(trackedFiles, errors) {
  const forbiddenTrackedPatterns = [
    {
      pattern: /(?:^|\/)AGENTS\.md$/,
      description: "private agent guidance must stay untracked"
    },
    {
      pattern: /^spec\.md$/,
      description: "private build spec must stay untracked"
    },
    {
      pattern: /^progress\.md$/,
      description: "private progress tracking must stay untracked"
    },
    {
      pattern: /^\.local-dev\//,
      description: "local-only helpers must stay untracked"
    },
    {
      pattern: /^\.agents\/skills\//,
      description: "local skill installs must stay untracked"
    },
    {
      pattern: /^skills-lock\.json$/,
      description: "local skill lockfiles must stay untracked"
    },
    {
      pattern: /^\.env(?:\..+)?$/,
      description: "environment files must stay untracked"
    },
    {
      pattern: /^(?:\.private|private)\//,
      description: "private-only folders must stay untracked"
    },
    {
      pattern: /\.(?:pem|key|crt|p12)$/i,
      description: "key or certificate files must stay untracked"
    }
  ];

  for (const trackedFile of trackedFiles) {
    if (trackedFile === ".env.example") {
      continue;
    }

    for (const rule of forbiddenTrackedPatterns) {
      if (rule.pattern.test(trackedFile)) {
        errors.push(
          `Tracked privacy leak found in ${trackedFile}; ${rule.description}.`
        );
      }
    }
  }
}

function verifyClientDomainImportBoundaries(repoRoot, sourceFiles, errors) {
  for (const filePath of sourceFiles) {
    const repoRelativePath = relative(repoRoot, filePath);
    const sourceDomain = getClientDomain(repoRelativePath);

    if (sourceDomain === null || !clientDomainPolicies.has(sourceDomain)) {
      continue;
    }

    const allowedDomains = clientDomainPolicies.get(sourceDomain);
    const specifiers = readImportSpecifiers(readFileSync(filePath, "utf8"));

    for (const specifier of specifiers) {
      const targetDomain = resolveClientImportDomain(repoRoot, filePath, specifier);

      if (targetDomain === null || allowedDomains?.has(targetDomain)) {
        continue;
      }

      errors.push(
        `Illegal client domain import in ${repoRelativePath}: ${sourceDomain} must not depend on ${targetDomain}.`
      );
    }
  }
}

function verifyExternalPackageBoundaries(repoRoot, sourceFiles, errors) {
  for (const filePath of sourceFiles) {
    const repoRelativePath = relative(repoRoot, filePath);
    const specifiers = readImportSpecifiers(readFileSync(filePath, "utf8"));
    const sourceDomain = getClientDomain(repoRelativePath);
    const declarationFile = isDeclarationFile(filePath);

    for (const specifier of specifiers) {
      if (
        repoRelativePath.startsWith("client/src/game/") &&
        (specifier === "react" ||
          specifier.startsWith("react/") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/") ||
          specifier === "lucide-react")
      ) {
        errors.push(
          `Illegal external package in ${repoRelativePath}: game domain must stay React/UI-icon free.`
        );
      }

      if (
        repoRelativePath.startsWith("client/src/audio/") &&
        (specifier === "react" ||
          specifier.startsWith("react/") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/") ||
          specifier === "lucide-react" ||
          specifier === "three" ||
          specifier.startsWith("three/"))
      ) {
        errors.push(
          `Illegal external package in ${repoRelativePath}: audio domain must stay React-free and renderer-free.`
        );
      }

      if (
        repoRelativePath.startsWith("client/src/network/") &&
        (specifier === "react" ||
          specifier.startsWith("react/") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/") ||
          specifier === "lucide-react" ||
          specifier === "three" ||
          specifier.startsWith("three/") ||
          specifier === "@mediapipe/tasks-vision" ||
          specifier.startsWith("@mediapipe/tasks-vision/") ||
          specifier === "@strudel/web" ||
          specifier.startsWith("@strudel/web/"))
      ) {
        errors.push(
          `Illegal external package in ${repoRelativePath}: network domain must stay UI-free and runtime-package free.`
        );
      }

      if (
        repoRelativePath.startsWith("server/src/") &&
        (specifier === "react" ||
          specifier.startsWith("react/") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/") ||
          specifier === "three" ||
          specifier.startsWith("three/") ||
          specifier === "@mediapipe/tasks-vision" ||
          specifier.startsWith("@mediapipe/tasks-vision/") ||
          specifier === "@strudel/web" ||
          specifier.startsWith("@strudel/web/") ||
          specifier === "lucide-react")
      ) {
        errors.push(
          `Illegal external package in ${repoRelativePath}: server must remain browser-runtime free.`
        );
      }

      if (
        repoRelativePath.startsWith("client/src/") &&
        !repoRelativePath.startsWith("client/src/game/") &&
        (specifier === "three" || specifier.startsWith("three/"))
      ) {
        errors.push(
          `Illegal runtime package in ${repoRelativePath}: Three.js packages belong in client/src/game only.`
        );
      }

      if (
        repoRelativePath.startsWith("client/src/game/") &&
        !declarationFile &&
        (specifier === "three" ||
          (specifier.startsWith("three/") &&
            specifier !== "three/webgpu" &&
            specifier !== "three/tsl"))
      ) {
        errors.push(
          `Illegal gameplay import in ${repoRelativePath}: gameplay code must import Three through three/webgpu or three/tsl only.`
        );
      }

      if (specifier === "@strudel/web") {
        errors.push(
          `Illegal Strudel import in ${repoRelativePath}: import the lightweight @strudel/web/web.mjs entrypoint instead of the package root.`
        );
      }

      if (
        specifier.startsWith("@strudel/web/") &&
        specifier !== "@strudel/web/web.mjs"
      ) {
        errors.push(
          `Illegal Strudel import in ${repoRelativePath}: unsupported @strudel/web entrypoint ${specifier}.`
        );
      }

      if (
        specifier === "@strudel/web/web.mjs" &&
        !repoRelativePath.startsWith("client/src/audio/")
      ) {
        errors.push(
          `Illegal Strudel import in ${repoRelativePath}: @strudel/web/web.mjs belongs in client/src/audio only.`
        );
      }

      if (
        (specifier === "@mediapipe/tasks-vision" ||
          specifier.startsWith("@mediapipe/tasks-vision/")) &&
        !repoRelativePath.startsWith("client/src/game/workers/")
      ) {
        errors.push(
          `Illegal MediaPipe import in ${repoRelativePath}: @mediapipe/tasks-vision belongs in client/src/game/workers only.`
        );
      }
    }

    if (
      sourceDomain === "game" &&
      !declarationFile &&
      /\b(?:ShaderMaterial|RawShaderMaterial|EffectComposer)\b|\bonBeforeCompile\b/.test(
        readFileSync(filePath, "utf8")
      )
    ) {
      errors.push(
        `Illegal gameplay API in ${repoRelativePath}: use three/tsl plus NodeMaterial patterns instead of legacy gameplay material hooks.`
      );
    }
  }
}

function verifyDependencyBaseline(repoRoot, errors) {
  const dependencyBaseline = parseDependencyBaseline(repoRoot);

  for (const manifestPath of runtimeDependencyManifestPaths) {
    const packageJson = readPackageJson(repoRoot, manifestPath);
    const dependencyGroups = [
      packageJson.dependencies ?? {},
      packageJson.devDependencies ?? {}
    ];

    for (const [dependencyName, expectedVersion] of dependencyBaseline.entries()) {
      for (const dependencyGroup of dependencyGroups) {
        const declaredVersion = dependencyGroup[dependencyName];

        if (declaredVersion === undefined) {
          continue;
        }

        if (declaredVersion !== expectedVersion) {
          errors.push(
            `${manifestPath} declares ${dependencyName}@${declaredVersion}, but docs/dependencies.md requires ${expectedVersion}.`
          );
        }
      }
    }
  }
}

export function collectRepoVerificationErrors({
  repoRoot = process.cwd(),
  trackedFiles = null
} = {}) {
  const errors = [];
  const sourceFiles = productSourceRoots.flatMap((rootPath) =>
    listFiles(join(repoRoot, rootPath)).filter(isTypedSourceFile)
  );
  const nextTrackedFiles =
    trackedFiles ?? (() => {
      try {
        return getTrackedFiles(repoRoot);
      } catch {
        errors.push("Unable to inspect tracked files with git ls-files.");
        return [];
      }
    })();

  for (const requiredEntrypoint of requiredEntrypoints) {
    assertExists(repoRoot, requiredEntrypoint, errors);
  }

  for (const requiredRepoFile of requiredRepoFiles) {
    assertExists(repoRoot, requiredRepoFile, errors);
  }

  verifyProductImports(repoRoot, sourceFiles, errors);
  verifyClientSourceExtensions(repoRoot, errors);
  verifySharedDist(repoRoot, errors);
  verifyWorkspaceDependency(repoRoot, errors);
  verifyTrackedPrivacy(nextTrackedFiles, errors);
  verifyClientDomainImportBoundaries(repoRoot, sourceFiles, errors);
  verifyExternalPackageBoundaries(repoRoot, sourceFiles, errors);
  verifyDependencyBaseline(repoRoot, errors);

  return errors;
}
