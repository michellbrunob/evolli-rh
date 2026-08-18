import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev-only conveniência: encaminha /v1 para a API local, preservando a
// topologia de mesma origem decidida na ADR 0009 (decisão 2) mesmo durante
// o desenvolvimento, sem habilitar CORS na API e sem decidir o proxy reverso
// de produção (responsabilidade futura de infraestrutura, DP-W-02).
const apiProxyTarget =
  process.env["VITE_API_PROXY_TARGET"] ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/v1": {
        target: apiProxyTarget,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
