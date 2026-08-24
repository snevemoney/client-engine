#!/usr/bin/env node
/**
 * Prepares test database: loads .env.test and runs prisma db push.
 * Run before npm test when schema changes.
 */
import { config } from "dotenv";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

config({ path: path.join(root, ".env.test"), override: true });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/client_engine_test";
}

execFileSync("npx", ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
