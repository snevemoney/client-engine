/**
 * E2E global setup: seed DB so admin user exists and login works.
 * Cleans fake/test leads so prod-fake-data-review passes.
 * Runs before webServer starts. Requires DATABASE_URL.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env") });

const FAKE_PATTERNS = [
  "E2E test lead",
  "Smoke Test",
  "E2E Trust-to-close",
  "Research Lead 001",
  "FLYWHEEL SIMULATION",
];

export default async function globalSetup() {
  execFileSync("node", ["prisma/seed.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@evenslouis.ca",
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "changeme",
    },
  });

  const db = new PrismaClient();
  try {
    const leads = await db.lead.findMany({
      where: {
        OR: FAKE_PATTERNS.map((p) => ({ title: { contains: p, mode: "insensitive" } })),
      },
      select: { id: true },
    });
    if (leads.length > 0) {
      await db.lead.deleteMany({ where: { id: { in: leads.map((l) => l.id) } } });
    }
    // Ensure at least one lead for lead-copilot and similar specs (title must not match FAKE_PATTERNS)
    const count = await db.lead.count();
    if (count === 0) {
      await db.lead.create({
        data: {
          title: "Demo Lead",
          source: "e2e-seed",
          status: "NEW",
          techStack: [],
          tags: [],
        },
      });
    }
  } finally {
    await db.$disconnect();
  }
}
