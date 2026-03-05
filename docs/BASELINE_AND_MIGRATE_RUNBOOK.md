# Baseline and Migrate Runbook (P3005 Fix)

When production has tables but Prisma's `_prisma_migrations` table is empty, you get P3005. Baseline the existing migrations, then apply any new ones.

## Step 1: SSH to server

```bash
ssh root@evenslouis.ca
cd /root/client-engine
```

## Step 2: Baseline migrations already in production

Run for **each** migration that was applied before this deploy (typically all 12 existing migrations):

```bash
docker compose run --rm worker npx prisma migrate resolve --applied 20260222_score_engine_foundation
docker compose run --rm worker npx prisma migrate resolve --applied 20260222_youtube_ingest_pipeline
docker compose run --rm worker npx prisma migrate resolve --applied 20260226_next_action_execution_delivery
docker compose run --rm worker npx prisma migrate resolve --applied 20260227_next_action_preference_personalization
docker compose run --rm worker npx prisma migrate resolve --applied 20260228_next_action_template_key
docker compose run --rm worker npx prisma migrate resolve --applied 20260229_copilot_sessions
docker compose run --rm worker npx prisma migrate resolve --applied 20260301_add_founder_os_models
docker compose run --rm worker npx prisma migrate resolve --applied 20260302_add_operator_memory
docker compose run --rm worker npx prisma migrate resolve --applied 20260303_add_operator_attribution
docker compose run --rm worker npx prisma migrate resolve --applied 20260304_growth_engine_v1
docker compose run --rm worker npx prisma migrate resolve --applied 20260305_growth_execution_layer
docker compose run --rm worker npx prisma migrate resolve --applied 20260306_website_builder_integration
```

**If your production DB was set up with `db push` and never had migrations:** Skip migrations that would fail (e.g. if a table already exists). Resolve only the ones whose objects already exist. Then run `prisma migrate deploy` — it will apply the new Sprint 5–9 migration.

## Step 3: Apply new migrations

```bash
docker compose run --rm worker npx prisma migrate deploy
```

This applies `20260307_add_sprint_5_9_schema` (payment, proof, campaigns, cadence, outcome).

## Step 4: Restart app (if needed)

```bash
docker compose restart app worker
```

## Step 5: Smoke test

- Login
- Sidebar (6 groups)
- Create lead
- Deploys page filters
- `/proof/nonexistent-slug` → 404 (not 500)
- `/campaigns/nonexistent-slug` → 404 (not 500)
