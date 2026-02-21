/**
 * Completely reset auth: delete all users, create one admin.
 * Run: npm run reset-auth
 * Then log in with ADMIN_EMAIL / ADMIN_PASSWORD from .env (default: admin@evenslouis.ca / changeme)
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  await db.user.deleteMany({});
  const hashed = await hash(password, 12);
  await db.user.create({
    data: { email, password: hashed, name: "Admin" },
  });

  console.log("Auth reset. Single user:");
  console.log("  Email:", email);
  console.log("  Password: (value from ADMIN_PASSWORD or 'changeme')");
  console.log("  → Log in at /login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
