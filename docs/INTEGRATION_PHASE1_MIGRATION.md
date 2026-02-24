# Integration Phase 1 — Migration & Implementation Notes

## What Changed

### Schema
- **IntegrationConnection**: Added `displayName` (String?), `helpText` (String?).
- Existing columns preserved: `providerLabel`, `notes`, `mode`, `category`, `prodOnly`, `configJson`.

### Provider Registry
- **`src/lib/integrations/providerRegistry.ts`**: Single source of truth for providers.
- Canonical keys match existing DB (`meta`, `rss`, `crm`, `x`, etc.) for compatibility.
- **Aliases** (spec keys → canonical): `meta_ads`→`meta`, `rss_news`→`rss`, `internal_crm`/`crm_internal`→`crm`, `x_twitter`→`x`. PATCH/test/disconnect accept either form.
- New providers: `hubspot`, `pipedrive`, `calcom`.
- Per-provider: `provider`, `displayName`, `category`, `prodOnly`, `defaultMode`, `helpText`, `supportsLive`, `supportsMock`, `supportsManual`.

### Runtime Utilities
- **`src/lib/integrations/runtime.ts`**: `isProductionEnv()`, `resolveRequestedMode()`, `canRunLiveIntegration()`.
- Used by PATCH and test endpoints to enforce prodOnly and mode capabilities.

### Config Validation
- **`src/lib/integrations/configValidators.ts`**: `validateAdditionalQueryParams()` — flat string:string only.
- `configJson.additionalQueryParams` validated on PATCH.

### API
- **GET /api/integrations**: Uses registry; returns virtual rows for providers missing in DB. Includes `displayName`, `helpText`.
- **PATCH /api/integrations/[provider]**: Validates mode against provider capabilities; rejects LIVE for prodOnly in non-production; validates `additionalQueryParams`.
- **POST /api/integrations/[provider]/test**: Respects mode — OFF=skipped, MOCK=mock success, MANUAL=manual response, LIVE=real test.

### Providers Module
- **`src/lib/integrations/providers.ts`**: Now derives `INTEGRATION_PROVIDERS` from `PROVIDER_REGISTRY` for backward compat.

---

## Migration Notes

### Applied via `prisma db push`
The schema changes (displayName, helpText) were applied via `npx prisma db push`.

### Backfill
Run the seed script after schema sync:

```bash
node prisma/seed-integrations.mjs
```

This backfills:
- `displayName` from `providerLabel` or registry
- `helpText` from registry for known providers
- `mode` for existing rows: `live` if status=connected, `off` if disabled, else `manual`
- New providers: hubspot, pipedrive, calcom

### Manual SQL (if using migrations)
If you use `prisma migrate` instead of `db push`, apply:

```sql
-- Add displayName and helpText
ALTER TABLE "IntegrationConnection" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "IntegrationConnection" ADD COLUMN IF NOT EXISTS "helpText" TEXT;

-- Backfill displayName from providerLabel
UPDATE "IntegrationConnection" SET "displayName" = COALESCE("providerLabel", "provider") WHERE "displayName" IS NULL;
```

Then run `node prisma/seed-integrations.mjs` for full backfill.

---

## Follow-up UI Work

- Settings IntegrationsSection already uses `providerLabel` and `helpText` — no changes needed for backward compat.
- Optional: surface `displayName` explicitly where `providerLabel` is used.
- Optional: show `additionalQueryParams` editor for RSS in config modal (storage/API already support it).
