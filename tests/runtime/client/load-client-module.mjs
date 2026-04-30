import { resolve } from "node:path";

import { createServer } from "vite";

const repoRoot = process.cwd();
const clientRoot = resolve(repoRoot, "client");
const clientConfigPath = resolve(clientRoot, "vite.config.ts");

export async function createClientModuleLoader() {
  const server = await createServer({
    appType: "custom",
    configFile: clientConfigPath,
    logLevel: "error",
    optimizeDeps: {
      include: [],
      noDiscovery: true
    },
    root: clientRoot,
    server: {
      hmr: false,
      middlewareMode: true,
      ws: false
    }
  });

  return {
    async close() {
      await server.close();
    },
    async load(modulePath) {
      return server.ssrLoadModule(modulePath);
    }
  };
}
