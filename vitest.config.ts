import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      JWT_SECRET: "test-secret-at-least-32-characters-for-vitest-only",
      MERCADOPAGO_WEBHOOK_SECRET: "test-webhook-secret",
      MERCADOPAGO_ACCESS_TOKEN: "TEST-access-token",
      ENCRYPTION_KEY: "a".repeat(64), // 64 hex chars = 32 bytes dummy key
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
