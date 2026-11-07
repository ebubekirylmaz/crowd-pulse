import { defineConfig, loadEnv, type Plugin } from "vite";
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

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function resourceHintsPlugin(origins: string[], preload: string): Plugin {
  return {
    name: "crowd-pulse-resource-hints",
    transformIndexHtml() {
      const unique = [...new Set(origins.filter(Boolean))];
      return [
        ...unique.map((origin) => ({
          tag: "link",
          attrs: { rel: "preconnect", href: origin, crossorigin: "" },
          injectTo: "head-prepend" as const,
        })),
        {
          tag: "link",
          attrs: { rel: "modulepreload", href: preload, crossorigin: "" },
          injectTo: "head-prepend" as const,
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const qaEntry = env.REMOTE_QA_URL || "http://localhost:5173/remoteEntry.js";
  const analyticsEntry =
    env.REMOTE_ANALYTICS_URL || "http://localhost:5174/remoteEntry.js";

  return {
    plugins: [
      react(),
      tailwindcss(),
      snippetPlugin(),
      resourceHintsPlugin(
        [originOf(qaEntry), originOf(env.VITE_API_URL ?? "")].filter(
          (origin): origin is string => Boolean(origin),
        ),
        qaEntry,
      ),
      federation({
        name: "shell",
        dts: false,
        remotes: {
          qa: { type: "module", name: "qa", entry: qaEntry },
          analytics: {
            type: "module",
            name: "analytics",
            entry: analyticsEntry,
          },
        },
        shared: {
          react: { singleton: true, requiredVersion: "^19.0.0" },
          "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
          "react-router-dom": { singleton: true, requiredVersion: "^7.0.0" },
        },
      }),
    ],
    server: { host: true, port: 5175, strictPort: true },
    preview: { host: true, port: 4175, strictPort: true },
    build: { target: "esnext" },
  };
});
