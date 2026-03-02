/**
 * Vitest global teardown — runs once after all test suites complete.
 * Truncates all tables in the test database to prevent data leaks.
 */
import { PrismaClient } from "@prisma/client";

export async function teardown() {
  const db = new PrismaClient();

  try {
    // Truncate all tables (CASCADE handles FK dependencies)
    await db.$executeRawUnsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);
  } finally {
    await db.$disconnect();
  }
}
