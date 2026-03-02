import path from "path";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env.test to isolate tests from the dev database
config({ path: ".env.test", override: true });

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/**"],
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globalSetup: ["./src/test/global-teardown.ts"],
    fileParallelism: false,
  },
});
