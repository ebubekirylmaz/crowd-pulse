import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "analytics",
      filename: "remoteEntry.js",
      dts: false,
      exposes: { "./Dashboard": "./src/Dashboard.tsx" },
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
        "react-router-dom": { singleton: true, requiredVersion: "^7.0.0" },
      },
    }),
  ],
  server: { host: true, port: 5174, strictPort: true, cors: true },
  preview: { host: true, port: 5174, strictPort: true, cors: true },
  build: { target: "esnext" },
});
