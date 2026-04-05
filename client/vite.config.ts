import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              maxSize: 240 * 1024,
              name: "strudel",
              test: /node_modules[\\/](?:@strudel|superdough)[\\/]/
            }
          ]
        }
      }
    }
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@thumbshooter/shared": fileURLToPath(
        new URL("../packages/shared/src/index.ts", import.meta.url)
      )
    }
  },
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 4173
  }
});
