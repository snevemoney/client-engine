-- Optional case-page PROBLEM / RESULT (was hardcoded em-dash)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "problem" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "result" TEXT;
