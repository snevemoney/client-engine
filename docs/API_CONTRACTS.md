# Tier-A API Contracts — Client Engine

Standard response shapes, error shapes, and header policies for all routes. Tier-A routes (revenue-critical, security-critical) must be tested against these contracts.

---

## Response Shapes

### Success (200)

**List endpoints** (GET collections):
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**Single resource** (GET by ID):
```json
{
  "id": "...",
  "createdAt": "ISO8601",
  ...fields
}
```

**Mutation** (POST/PATCH/DELETE):
```json
{
  "id": "...",
  ...created_or_updated_resource
}
```

**Summary/aggregate** (GET /summary):
```json
{
  ...domain_specific_aggregates,
  "degraded"?: true,
  "degradedReason"?: "Data temporarily unavailable"
}
```

### Degraded (200 with flag)

When a route cannot fetch all data but can return partial results:

```json
{
  "degraded": true,
  "degradedReason": "Short human-readable explanation",
  ...partial_data_with_null_defaults
}
```

**Platform rule:** Any route returning fallback data MUST set `degraded: true` and log an ops event. The UI MUST render a degraded banner when this flag is present.

---

## Error Shapes

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

Every route calls `requireAuth()`. If null, returns 401 immediately. Auth infrastructure errors log `auth.infrastructure_error` ops event.

### 400 Bad Request

```json
{ "error": "Human-readable validation message" }
```

Zod validation on mutations. Missing required fields, invalid types, malformed JSON.

### 404 Not Found

```json
{ "error": "Resource not found" }
```

Resource access: `withResourceAuth()` returns 404 if resource doesn't exist.

### 429 Rate Limited

```json
{
  "error": "Rate limit exceeded",
  "retryAfterSeconds": 30
}
```

Header: `Retry-After: 30`

### 500 Internal Server Error

```json
{ "error": "Sanitized error message (no secrets, no stack traces)" }
```

**Sanitization rules** (via `sanitizeErrorMessage`):
- Bearer tokens → `[redacted]`
- Webhook URLs → `[url redacted]`
- API keys (sk_live_, sk_test_, api_key) → `[redacted]`
- Truncated to 500 chars
- Stack traces never included

---

## Header Policies

| Header | When | Value |
|--------|------|-------|
| `Retry-After` | 429 responses | Seconds until rate limit resets |
| `X-Route-Timing` | All responses (via `withRouteTiming`) | Execution time in ms |
| `Cache-Control` | Cached GETs (via `withSummaryCache`) | `public, max-age={ttl}` |

---

## Test Contract Checklist

Every Tier-A route test file MUST include:

- [ ] **401 test**: Mock `requireAuth()` → null, assert status 401 + `{ error }` shape
- [ ] **200 shape test**: Mock auth + deps, assert response matches contract above
- [ ] **500 sanitization test**: Mock dep to throw with secret in message, assert 500 + secret not in response
- [ ] **400 test** (mutations only): Missing required fields → 400 + `{ error }` shape

---

## Tier-A Routes

Routes closest to revenue or security. Must have full contract coverage.

### Revenue-Critical (Growth Engine)
- `GET/POST /api/internal/growth/deals`
- `GET/POST /api/internal/growth/prospects`
- `GET /api/internal/growth/summary`
- `POST /api/internal/growth/outreach/draft`
- `POST /api/internal/growth/outreach/send`
- `POST /api/internal/growth/followups/schedule`

### Pipeline (Money Path)
- `GET/POST /api/proposals`
- `POST /api/propose/[id]`
- `POST /api/position/[id]`
- `POST /api/pipeline/run`

### Security-Critical
- `POST /api/internal/copilot/coach/action` (executes Brain tools)
- `POST /api/agents/run` (triggers autonomous agents)

### Health (Founder Dashboard)
- `GET /api/internal/founder/summary`
- `GET /api/internal/scores/*`
- `GET /api/risk/*`
- `GET /api/next-actions/*`

---

## Dependency on P0 Rules

Tier-A contracts enforce:
1. **Migration discipline (P0.1):** Routes trust that schema matches deployed code. `migrate deploy` ensures this.
2. **Degraded mode (P0.2):** Any fallback response MUST signal `degraded: true`. UI MUST render it.
