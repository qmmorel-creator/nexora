import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Nexora Futur (Ref #652, #653) : JSX compilé au build, dépendances empaquetées
// localement. Aucune transpilation dans le navigateur, aucun CDN de code.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
  server: { host: "127.0.0.1", port: 5173 },
});
