import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const productSourceRoots = [
  "client/src",
  "server/src",
  "packages/shared/src"
];
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

function listFiles(rootPath) {
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

function assertExists(relativePath, errors) {
  try {
    statSync(join(repoRoot, relativePath));
  } catch {
    errors.push(`Missing required path: ${relativePath}`);
  }
}

function isTypedSourceFile(filePath) {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function verifyProductImports(errors) {
  const sourceFiles = productSourceRoots
    .flatMap((rootPath) =>
      listFiles(join(repoRoot, rootPath)).filter(isTypedSourceFile)
    );

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

function verifyClientSourceExtensions(errors) {
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

function verifySharedDist(errors) {
  const sharedSourceBaseNames = new Set(
    listFiles(join(repoRoot, "packages/shared/src"))
      .filter((filePath) => filePath.endsWith(".ts"))
      .map((filePath) => filePath.split("/").at(-1)?.replace(/\.ts$/, ""))
      .filter(Boolean)
  );

  const distFiles = listFiles(join(repoRoot, "packages/shared/dist")).filter(
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

function verifyWorkspaceDependency(errors) {
  const clientPackage = JSON.parse(
    readFileSync(join(repoRoot, "client/package.json"), "utf8")
  );

  if (clientPackage.dependencies?.["@thumbshooter/shared"] !== "0.1.0") {
    errors.push(
      "client/package.json must declare @thumbshooter/shared as a direct workspace dependency."
    );
  }
}

function verifyTrackedPrivacy(errors) {
  let trackedFilesOutput = "";

  try {
    trackedFilesOutput = execFileSync("git", ["ls-files"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
  } catch {
    errors.push("Unable to inspect tracked files with git ls-files.");
    return;
  }

  const trackedFiles = trackedFilesOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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

function verifyDomainImportBoundaries(errors) {
  const domainPolicies = [
    {
      scopePrefix: "client/src/game/",
      rules: [
        {
          description: "game domain must stay React-free",
          pattern: /from\s+["']react(?:\/|["'])|from\s+["']react-dom(?:\/|["'])/
        },
        {
          description: "game domain must not import client shell components",
          pattern:
            /from\s+["'](?:@\/components(?:\/|["'])|@\/ui(?:\/|["'])|\.\.\/components(?:\/|["'])|\.\.\/ui(?:\/|["']))/
        },
        {
          description: "game domain must not depend on lucide/react shell icons",
          pattern: /from\s+["']lucide-react["']/
        }
      ]
    },
    {
      scopePrefix: "client/src/audio/",
      rules: [
        {
          description: "audio domain must stay React-free",
          pattern: /from\s+["']react(?:\/|["'])|from\s+["']react-dom(?:\/|["'])/
        },
        {
          description: "audio domain must stay UI-free",
          pattern:
            /from\s+["'](?:@\/components(?:\/|["'])|@\/ui(?:\/|["'])|\.\.\/components(?:\/|["'])|\.\.\/ui(?:\/|["']))/
        },
        {
          description: "audio domain must stay renderer-free",
          pattern:
            /from\s+["'](?:three|three\/webgpu|three\/tsl)["']|from\s+["']lucide-react["']/
        }
      ]
    },
    {
      scopePrefix: "client/src/network/",
      rules: [
        {
          description: "network domain must stay React-free",
          pattern: /from\s+["']react(?:\/|["'])|from\s+["']react-dom(?:\/|["'])/
        },
        {
          description: "network domain must stay UI-free",
          pattern:
            /from\s+["'](?:@\/components(?:\/|["'])|@\/ui(?:\/|["'])|\.\.\/components(?:\/|["'])|\.\.\/ui(?:\/|["']))/
        },
        {
          description: "network domain must stay renderer/audio-tracking-package free",
          pattern:
            /from\s+["'](?:three|three\/webgpu|three\/tsl|@mediapipe\/tasks-vision|@strudel\/web|lucide-react)["']/
        }
      ]
    },
    {
      scopePrefix: "client/src/components/ui/",
      rules: [
        {
          description: "shared UI primitives must not import game/audio/network domains",
          pattern:
            /from\s+["'](?:@\/game(?:\/|["'])|@\/audio(?:\/|["'])|@\/network(?:\/|["'])|\.\.\/\.\.\/game(?:\/|["'])|\.\.\/\.\.\/audio(?:\/|["'])|\.\.\/\.\.\/network(?:\/|["']))/
        }
      ]
    },
    {
      scopePrefix: "client/src/components/",
      rules: [
        {
          description: "shared components must not import gameplay or network domains",
          pattern:
            /from\s+["'](?:@\/game(?:\/|["'])|@\/network(?:\/|["'])|@\/audio(?:\/|["'])|\.\.\/game(?:\/|["'])|\.\.\/network(?:\/|["'])|\.\.\/audio(?:\/|["']))/
        }
      ]
    },
    {
      scopePrefix: "server/src/",
      rules: [
        {
          description: "server must remain browser-runtime free",
          pattern:
            /from\s+["'](?:react|react-dom|three|three\/webgpu|three\/tsl|@mediapipe\/tasks-vision|@strudel\/web|lucide-react)["']/
        }
      ]
    }
  ];

  const sourceFiles = productSourceRoots
    .flatMap((rootPath) =>
      listFiles(join(repoRoot, rootPath)).filter(isTypedSourceFile)
    );

  for (const filePath of sourceFiles) {
    const repoRelativePath = relative(repoRoot, filePath);
    const contents = readFileSync(filePath, "utf8");

    for (const policy of domainPolicies) {
      if (!repoRelativePath.startsWith(policy.scopePrefix)) {
        continue;
      }

      for (const rule of policy.rules) {
        if (rule.pattern.test(contents)) {
          errors.push(
            `Illegal domain import in ${repoRelativePath}: ${rule.description}.`
          );
        }
      }
    }

    if (
      repoRelativePath.startsWith("client/src/") &&
      !repoRelativePath.startsWith("client/src/audio/") &&
      /from\s+["']@strudel\/web["']/.test(contents)
    ) {
      errors.push(
        `Illegal domain import in ${repoRelativePath}: @strudel/web belongs in client/src/audio only.`
      );
    }

    if (
      repoRelativePath.startsWith("client/src/") &&
      !repoRelativePath.startsWith("client/src/game/") &&
      /from\s+["'](?:three|three\/webgpu|three\/tsl)["']/.test(contents)
    ) {
      errors.push(
        `Illegal domain import in ${repoRelativePath}: Three.js packages belong in client/src/game only.`
      );
    }
  }
}

const errors = [];

for (const requiredEntrypoint of requiredEntrypoints) {
  assertExists(requiredEntrypoint, errors);
}

for (const requiredRepoFile of requiredRepoFiles) {
  assertExists(requiredRepoFile, errors);
}

verifyProductImports(errors);
verifyClientSourceExtensions(errors);
verifySharedDist(errors);
verifyWorkspaceDependency(errors);
verifyTrackedPrivacy(errors);
verifyDomainImportBoundaries(errors);

if (errors.length > 0) {
  console.error("ThumbShooter verify failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exitCode = 1;
} else {
  console.log("ThumbShooter verify passed.");
}
