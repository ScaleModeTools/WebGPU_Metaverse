import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import typescript from "typescript";

const requiredEntrypoints = [
  "tools/build",
  "tools/test",
  "tools/bench",
  "tools/verify"
];
const requiredLocalRepoFiles = [
  "AGENTS.md",
  "README.md",
  "tools/runtime-owner-test-manifest.json"
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
      "input",
      "metaverse",
      "experiences",
      "physics",
      "tracking",
      "network",
      "assets",
      "shared"
    ])
  ],
  [
    "input",
    new Set(["input", "shared"])
  ],
  [
    "ui",
    new Set([
      "ui",
      "lib",
      "components",
      "navigation",
      "audio",
      "tracking",
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
    new Set(["navigation", "network", "shared"])
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
    "metaverse",
    new Set([
      "metaverse",
      "experiences",
      "physics",
      "ui",
      "components",
      "navigation",
      "audio",
      "network",
      "shared"
    ])
  ],
  [
    "experiences",
    new Set([
      "experiences",
      "physics",
      "ui",
      "components",
      "navigation",
      "audio",
      "network",
      "tracking",
      "shared"
    ])
  ],
  [
    "tracking",
    new Set(["tracking", "shared"])
  ],
  [
    "physics",
    new Set(["physics", "shared"])
  ],
  [
    "lib",
    new Set(["lib", "shared"])
  ]
]);
const runtimeOwnerDirectoryNames = new Set([
  "authority",
  "classes",
  "adapters",
  "guards",
  "boot",
  "hud",
  "remote-world",
  "surface",
  "simulation"
]);
const runtimeOwnerTestManifestPath = "tools/runtime-owner-test-manifest.json";
const explicitAnyScanRoots = [
  "client",
  "server",
  "packages/shared",
  "tests",
  "tools"
];
const explicitAnyExcludedPathSegments = new Set(["dist", "node_modules"]);

function toRepoPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

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

function getTypeScriptScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return typescript.ScriptKind.TSX;
  }

  return typescript.ScriptKind.TS;
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
  if (specifier === "@webgpu-metaverse/shared") {
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

  const repoRelativeTargetPath = toRepoPath(relative(repoRoot, absoluteTargetPath));

  if (!repoRelativeTargetPath.startsWith("client/src/")) {
    return null;
  }

  return getClientDomain(repoRelativeTargetPath);
}

function getTrackedFiles(repoRoot) {
  const trackedFilesResult = spawnSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  const trackedFilesOutput =
    typeof trackedFilesResult.stdout === "string" ? trackedFilesResult.stdout : "";

  if (trackedFilesResult.status !== 0) {
    throw trackedFilesResult.error ??
      new Error(`git ls-files failed with exit code ${trackedFilesResult.status ?? "unknown"}.`);
  }

  return trackedFilesOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}





function readJsonFile(repoRoot, relativePath, description, errors) {
  try {
    return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8"));
  } catch {
    errors.push(`Unable to parse ${description} at ${relativePath}.`);
    return null;
  }
}

function parseRuntimeOwnerTestManifest(repoRoot, errors) {
  const parsedValue = readJsonFile(
    repoRoot,
    runtimeOwnerTestManifestPath,
    "runtime owner test manifest",
    errors
  );

  if (parsedValue === null) {
    return [];
  }

  if (!Array.isArray(parsedValue.owners)) {
    errors.push(
      "tools/runtime-owner-test-manifest.json must expose an owners array."
    );
    return [];
  }

  const manifestEntries = [];

  for (const rawEntry of parsedValue.owners) {
    if (
      rawEntry === null ||
      typeof rawEntry !== "object" ||
      typeof rawEntry.ownerPath !== "string" ||
      !Array.isArray(rawEntry.testPaths) ||
      rawEntry.testPaths.some((testPath) => typeof testPath !== "string")
    ) {
      errors.push(
        "tools/runtime-owner-test-manifest.json contains an invalid owner entry."
      );
      continue;
    }

    manifestEntries.push({
      ownerPath: rawEntry.ownerPath,
      testPaths: rawEntry.testPaths
    });
  }

  return manifestEntries;
}



function verifyProductImports(repoRoot, sourceFiles, errors) {
  for (const filePath of sourceFiles) {
    const contents = readFileSync(filePath, "utf8");
    const repoRelativePath = toRepoPath(relative(repoRoot, filePath));
    const baseName = filePath.split("/").at(-1);

    if (contents.includes("packages/shared/src")) {
      errors.push(
        `Cross-workspace source import found in ${repoRelativePath}; use @webgpu-metaverse/shared instead.`
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
    const repoRelativePath = toRepoPath(relative(repoRoot, filePath));

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
        `Stale generated shared artifact found: ${toRepoPath(relative(repoRoot, filePath))}`
      );
    }
  }
}

function verifySharedSourceArtifacts(repoRoot, errors) {
  const sharedSourceArtifacts = listFiles(join(repoRoot, "packages/shared/src")).filter(
    (filePath) =>
      filePath.endsWith(".js") ||
      filePath.endsWith(".js.map") ||
      filePath.endsWith(".d.ts") ||
      filePath.endsWith(".d.ts.map")
  );

  for (const filePath of sharedSourceArtifacts) {
    errors.push(
      `Generated shared source artifact found in ${toRepoPath(
        relative(repoRoot, filePath)
      )}; packages/shared/src must stay source-only.`
    );
  }
}

function verifyWorkspaceDependency(repoRoot, errors) {
  const clientPackage = readPackageJson(repoRoot, "client/package.json");

  if (clientPackage.dependencies?.["@webgpu-metaverse/shared"] !== "0.1.0") {
    errors.push(
      "client/package.json must declare @webgpu-metaverse/shared as a direct workspace dependency."
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
    const repoRelativePath = toRepoPath(relative(repoRoot, filePath));
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
    const repoRelativePath = toRepoPath(relative(repoRoot, filePath));
    const specifiers = readImportSpecifiers(readFileSync(filePath, "utf8"));
    const sourceDomain = getClientDomain(repoRelativePath);
    const declarationFile = isDeclarationFile(filePath);

    for (const specifier of specifiers) {
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
        !repoRelativePath.startsWith("client/src/metaverse/") &&
        !repoRelativePath.startsWith("client/src/physics/") &&
        !repoRelativePath.startsWith("client/src/experiences/") &&
        (specifier === "three" || specifier.startsWith("three/"))
      ) {
        errors.push(
          `Illegal runtime package in ${repoRelativePath}: Three.js packages belong in client/src/metaverse, client/src/physics, or client/src/experiences only.`
        );
      }

      if (
        repoRelativePath.startsWith("client/src/experiences/") &&
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
        !repoRelativePath.startsWith("client/src/tracking/workers/")
      ) {
        errors.push(
          `Illegal MediaPipe import in ${repoRelativePath}: @mediapipe/tasks-vision belongs in client/src/tracking/workers only.`
        );
      }

      if (
        (specifier === "@dimforge/rapier3d" ||
          specifier.startsWith("@dimforge/rapier3d/")) &&
        !repoRelativePath.startsWith("client/src/physics/")
      ) {
        errors.push(
          `Illegal Rapier import in ${repoRelativePath}: @dimforge/rapier3d belongs in client/src/physics only.`
        );
      }
    }

    if (
      repoRelativePath.startsWith("client/src/experiences/") &&
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


function listRuntimeOwnerCandidates(repoRoot) {
  const candidates = [];
  const runtimeSourceRoots = ["client/src", "server/src"];

  for (const sourceRoot of runtimeSourceRoots) {
    for (const filePath of listFiles(join(repoRoot, sourceRoot))) {
      if (!isTypedSourceFile(filePath) || isDeclarationFile(filePath)) {
        continue;
      }

      const repoRelativePath = toRepoPath(relative(repoRoot, filePath));
      const pathSegments = repoRelativePath.split("/");

      if (pathSegments.some((segment) => runtimeOwnerDirectoryNames.has(segment))) {
        candidates.push(repoRelativePath);
      }
    }
  }

  if (existsSync(join(repoRoot, "tools/internal/repo-verifier.mjs"))) {
    candidates.push("tools/internal/repo-verifier.mjs");
  }

  return [...new Set(candidates)].sort();
}

function verifyRuntimeOwnerTestParity(repoRoot, errors) {
  const manifestEntries = parseRuntimeOwnerTestManifest(repoRoot, errors);
  const manifestByOwner = new Map();

  for (const entry of manifestEntries) {
    if (manifestByOwner.has(entry.ownerPath)) {
      errors.push(
        `Duplicate runtime owner test manifest entry found for ${entry.ownerPath}.`
      );
      continue;
    }

    manifestByOwner.set(entry.ownerPath, entry);
  }

  const candidateOwners = listRuntimeOwnerCandidates(repoRoot);

  for (const candidateOwner of candidateOwners) {
    if (!manifestByOwner.has(candidateOwner)) {
      errors.push(
        `Missing runtime owner test manifest entry for ${candidateOwner}; add direct runtime coverage in tools/runtime-owner-test-manifest.json.`
      );
    }
  }

  for (const [ownerPath, entry] of manifestByOwner.entries()) {
    if (!existsSync(join(repoRoot, ownerPath))) {
      errors.push(
        `Runtime owner test manifest references a missing owner file: ${ownerPath}.`
      );
      continue;
    }

    if (entry.testPaths.length === 0) {
      errors.push(
        `Runtime owner test manifest entry for ${ownerPath} must list at least one runtime test file.`
      );
    }

    if (!candidateOwners.includes(ownerPath)) {
      errors.push(
        `Runtime owner test manifest entry for ${ownerPath} is stale or outside the supported owner directories.`
      );
    }

    for (const testPath of entry.testPaths) {
      if (!testPath.startsWith("tests/runtime/")) {
        errors.push(
          `Runtime owner test manifest entry for ${ownerPath} must point at tests/runtime/* files only.`
        );
        continue;
      }

      if (!existsSync(join(repoRoot, testPath))) {
        errors.push(
          `Runtime owner test manifest references a missing runtime test file: ${testPath}.`
        );
      }
    }
  }
}



function listExplicitAnyScanFiles(repoRoot) {
  const files = [];

  for (const rootPath of explicitAnyScanRoots) {
    for (const filePath of listFiles(join(repoRoot, rootPath))) {
      if (!isTypedSourceFile(filePath)) {
        continue;
      }

      const repoRelativePath = toRepoPath(relative(repoRoot, filePath));
      const pathSegments = repoRelativePath.split("/");

      if (
        pathSegments.some((segment) =>
          explicitAnyExcludedPathSegments.has(segment)
        )
      ) {
        continue;
      }

      files.push(filePath);
    }
  }

  return [...new Set(files)].sort();
}

function findExplicitAnyLocations(filePath, contents) {
  const sourceFile = typescript.createSourceFile(
    filePath,
    contents,
    typescript.ScriptTarget.Latest,
    true,
    getTypeScriptScriptKind(filePath)
  );
  const locations = [];

  function visit(node) {
    if (node.kind === typescript.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
      );

      locations.push(`${line + 1}:${character + 1}`);
    }

    typescript.forEachChild(node, visit);
  }

  visit(sourceFile);

  return locations;
}

function verifyNoExplicitAny(repoRoot, errors) {
  const typedFiles = listExplicitAnyScanFiles(repoRoot);

  for (const filePath of typedFiles) {
    const contents = readFileSync(filePath, "utf8");
    const explicitAnyLocations = findExplicitAnyLocations(filePath, contents);

    if (explicitAnyLocations.length === 0) {
      continue;
    }

    errors.push(
      `Explicit any is forbidden in typed source: ${toRepoPath(
        relative(repoRoot, filePath)
      )} at ${explicitAnyLocations.join(", ")}.`
    );
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

  for (const requiredLocalRepoFile of requiredLocalRepoFiles) {
    assertExists(repoRoot, requiredLocalRepoFile, errors);
  }

  verifyProductImports(repoRoot, sourceFiles, errors);
  verifyClientSourceExtensions(repoRoot, errors);
  verifySharedSourceArtifacts(repoRoot, errors);
  verifySharedDist(repoRoot, errors);
  verifyWorkspaceDependency(repoRoot, errors);
  verifyTrackedPrivacy(nextTrackedFiles, errors);
  verifyClientDomainImportBoundaries(repoRoot, sourceFiles, errors);
  verifyExternalPackageBoundaries(repoRoot, sourceFiles, errors);
  verifyRuntimeOwnerTestParity(repoRoot, errors);
  verifyNoExplicitAny(repoRoot, errors);

  return errors;
}
