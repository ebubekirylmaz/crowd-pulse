import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function snippetPlugin(): Plugin {
  const file = fileURLToPath(
    new URL("../../packages/snippet/dist/cp.js", import.meta.url),
  );
  return {
    name: "crowd-pulse-snippet",
    configureServer(server) {
      server.middlewares.use("/cp.js", (_request, response) => {
        response.setHeader("content-type", "application/javascript");
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "cp.js",
        source: readFileSync(file),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    snippetPlugin(),
    federation({
      name: "qa",
      filename: "remoteEntry.js",
      dts: false,
      exposes: { "./Routes": "./src/Routes.tsx" },
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
        "react-router-dom": { singleton: true, requiredVersion: "^7.0.0" },
      },
    }),
  ],
  server: { host: true, port: 5173, cors: true },
  preview: { host: true, port: 4173, cors: true },
  build: { target: "esnext" },
});
