# Phase 8.0 — Tier-A API Contracts

**Purpose:** Canonical response shapes, error shapes, and header policies for Tier-A internal routes.

**Date:** 2026-02-26

---

## Response Invariants (All Tier-A Routes)

| Invariant | Requirement |
|-----------|--------------|
| **401** | Unauthenticated requests return `401` (never 404/500 for auth failure) |
| **400** | Invalid input returns `400` with Zod-validated body |
| **429** | Rate-limited responses include `Retry-After` header and `retryAfterSeconds` in body |
| **500** | Server errors use `sanitizeErrorMessage()` — no secrets, no stack traces |
| **Cache-Control** | Cached GETs set `Cache-Control: private, max-age=15` where applicable |
| **Response** | All routes use `NextResponse.json()` via `withRouteTiming` (no raw `Response.json`) |

---

## Error Response Shape

```json
{
  "error": "string (sanitized, max 500 chars)",
  "code": "optional string"
}
```

**429 additional:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfterSeconds": 60
}
```

**Headers on 429:**
```
Retry-After: 60
Content-Type: application/json; charset=utf-8
```

---

## Scores

### GET /api/internal/scores/summary

**Query:** `entityType`, `entityId` (default: command_center)

**200:**
```json
{
  "latest": {
    "id": "string",
    "score": "number",
    "band": "string",
    "delta": "number | null",
    "computedAt": "ISO8601",
    "topReasons": [{ "label": "string", "impact": "number", "direction": "string" }],
    "factorSummary": [{ "key": "string", "label": "string", "weight": "number", "normalizedValue": "number", "impact": "number" }]
  } | null,
  "previous": { "id": "string", "score": "number", "band": "string", "computedAt": "ISO8601" } | null,
  "previousFactorSummary": "array | null",
  "recentEvents": [{ "id": "string", "eventType": "string", "fromScore": "number", "toScore": "number", "delta": "number", "fromBand": "string", "toBand": "string", "createdAt": "ISO8601" }]
}
```

### GET /api/internal/scores/latest

**Query:** `entityType`, `entityId`

**200:** Same shape as summary `latest` + `previous` + `recentEvents`.

### GET /api/internal/scores/history

**Query:** `entityType`, `entityId`, `range` (24h|7d|30d)

**200:** `{ "snapshots": [...], "events": [...] }`

### POST /api/internal/scores/compute

**Body:** `{ "entityType": "string", "entityId": "string" }`

**200:** `{ "ok": true, "snapshotId": "string", "score": "number", "band": "string" }`

---

## Risk

### GET /api/risk

**Query:** `status`, `severity`, `sourceType`, `search`, `page`, `pageSize`

**200 (paginated):**
```json
{
  "items": [{ "id": "string", "title": "string", "description": "string", "severity": "string", "status": "string", "key": "string", "sourceType": "string", "lastSeenAt": "ISO8601", "createdAt": "ISO8601" }],
  "meta": { "total": "number", "page": "number", "pageSize": "number", "totalPages": "number" }
}
```

### GET /api/risk/summary

**200:** `{ "open": "number", "snoozed": "number", "resolved": "number", "dismissed": "number", "critical": "number" }`

### POST /api/risk/run-rules

**200:** `{ "created": "number", "updated": "number", "criticalNotified": "number", "lastRunAt": "ISO8601" }`

**429:** `Retry-After` + `retryAfterSeconds`

### PATCH /api/risk/[id]

**Body:** `{ "status": "snoozed" | "resolved" | "dismissed", "snoozedUntil"?: "ISO8601" }`

**200:** `{ "id": "string", "status": "string", ... }`

---

## Next Actions

### GET /api/next-actions

**Query:** `status`, `priority`, `sourceType`, `entityType`, `entityId`, `search`, `page`, `pageSize`

**200 (paginated):**
```json
{
  "items": [{ "id": "string", "title": "string", "reason": "string", "priority": "string", "score": "number", "status": "string", "actionKey": "string", "createdByRule": "string", "createdAt": "ISO8601", "snoozedUntil": "ISO8601 | null", ... }],
  "meta": { "total": "number", "page": "number", "pageSize": "number", "totalPages": "number" }
}
```

### GET /api/next-actions/summary

**200:** `{ "queued": "number", "done": "number", "dismissed": "number" }`

### POST /api/next-actions/run

**Body:** `{ "entityType"?: "string", "entityId"?: "string" }`

**200:** `{ "created": "number", "updated": "number", "lastRunAt": "ISO8601" }`

### GET /api/next-actions/[id]

**200:** Single action object.

### POST /api/next-actions/[id]/execute

**Body:** `{ "actionKey": "string" }` (e.g. `mark_done`, `snooze_1d`)

**200:** `{ "ok": true, "action": { ... } }`

### GET /api/next-actions/[id]/template

**200:** `{ "templateKey": "string", "placeholders": "string[]", "content": "string" }`

### GET/PATCH/DELETE /api/next-actions/preferences/[id]

**200:** Preference object or `{ "ok": true }` for DELETE.

---

## Copilot

### POST /api/internal/copilot/coach

**Body:** `{ "message": "string" }`

**200:** `{ "reply": "string", "ctas": [{ "actionKey": "string", "label": "string", "previewPayload": "object" }] }`

### POST /api/internal/copilot/coach/action

**Body:** `{ "ctaActionKey": "string", "payload": "object" }`

**200:** `{ "ok": true, "result": "object", "summary": "string" }`

### GET /api/internal/copilot/sessions

**Query:** `limit`, `offset`

**200:** `{ "sessions": [{ "id": "string", "createdAt": "ISO8601", "messageCount": "number", ... }], "total": "number" }`

---

## Founder

### GET /api/internal/founder/summary

**200:** `{ "todayPlan": [...], "businessHealth": {...}, "execution": {...}, "pipelineFollowups": [...] }`

### GET /api/internal/founder/os/quarter

**Query:** `quarter`, `year`

**200:** `{ "quarter": "object", "kpis": [...], "themes": [...] }`

### GET /api/internal/founder/os/week

**Query:** `weekStart` (ISO date)

**200:** `{ "week": {...}, "outcomes": [...], "suggestions": [...], "patterns": [...] }`

### PUT /api/internal/founder/os/week

**Body:** `{ "weekStart": "ISO8601", "outcomes": [...], ... }`

**200:** `{ "ok": true }`

### POST /api/internal/founder/os/week/suggest

**Body:** `{ "weekStart": "ISO8601" }`

**200:** `{ "suggestions": [...], "patterns": [...] }`

---

## Growth

### GET /api/internal/growth/deals

**Query:** `status`, `page`, `pageSize`

**200 (paginated):** `{ "items": [...], "meta": {...} }`

### GET /api/internal/growth/prospects

**200:** `{ "items": [...], "meta": {...} }`

### GET /api/internal/growth/summary

**200:** `{ "dealsCount": "number", "prospectsCount": "number", "overdueFollowups": "number", ... }`

### POST /api/internal/growth/outreach/draft

**Body:** `{ "dealId": "string", "templateKey": "string", "channel"?: "dm" | "email" }`

**200:** `{ "draftId": "string", "content": "string", "placeholders": "string[]", "nextFollowUpDays": "number" }`

**400:** `{ "error": "string" }` (missing dealId, templateKey, malformed JSON)

### POST /api/internal/growth/outreach/send

**Body:** `{ "draftId": "string", "content": "string", "placeholders": "object" }`

**200:** `{ "ok": true, "eventId": "string" }`

### POST /api/internal/growth/followups/schedule

**Body:** `{ "dealId": "string", "actionKey": "string", "days": "number" }`

**200:** `{ "ok": true, "scheduleId": "string" }`

---

## Headers Policy

| Scenario | Header |
|----------|--------|
| All JSON responses | `Content-Type: application/json; charset=utf-8` |
| 429 rate limit | `Retry-After: <seconds>` |
| Cached GET (e.g. summary, latest) | `Cache-Control: private, max-age=15` |
| No-cache (mutations, dynamic) | `Cache-Control: no-store` or omit |

---

## Implementation Checklist

- [ ] All Tier-A routes use `withRouteTiming`
- [ ] All Tier-A routes use `requireAuth` (internal routes)
- [ ] All catch blocks use `jsonError(sanitizeErrorMessage(err), 500)`
- [ ] All Tier-A routes return `NextResponse` (never raw `Response.json`)
- [ ] Rate-limited routes: 429 with `Retry-After` and `retryAfterSeconds`
- [ ] Cached GETs: `Cache-Control: private, max-age=15` where applicable
