# Phase 4.3 — NBA Personalization (Operator Learning v1)

**Goal:** Make Next Actions adapt to the operator. Add "don't suggest again", per-rule suppression, and lightweight learning from dismiss/done patterns.

---

## Preference Rules

- **Scope:** `entityType` + `entityId` (e.g. `command_center`, `command_center`)
- **Suppression target:** `ruleKey` (all NBAs from that rule) OR `dedupeKey` (specific action)
- **Duration:** Default 30 days. Supports `7d` | `30d` | `null` (permanent until re-enabled)
- **Status:** `active` = suppressing, `suppressed` = re-enabled (no longer filtering)

---

## Defaults

- **Don't suggest again:** 30 days
- **Dismiss:** One-time hide (no preference created)
- **Mark done:** Completes action; no automatic suppression

---

## Safety Notes

- **No auto-suppress:** Critical items are never auto-suppressed. User must explicitly choose "Don't suggest again."
- **Reversible:** User can re-enable any suppression from the Preferences section.
- **Per-scope:** Suppressions apply per entity scope (command_center vs review_stream).

---

## API

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/next-actions/preferences?entityType=...&entityId=...` | — | List active suppressions |
| POST | `/api/next-actions/preferences` | `{ entityType, entityId, ruleKey?, dedupeKey?, duration?: "7d"\|"30d", reason? }` | Create/update preference |
| PATCH | `/api/next-actions/preferences/[id]` | `{ status: "suppressed" }` | Re-enable (stop suppressing) |
| DELETE | `/api/next-actions/preferences/[id]` | — | Delete preference |

---

## Data Model

`NextActionPreference`:
- `entityType`, `entityId` — scope
- `ruleKey` (nullable) — suppress all NBAs from this rule
- `dedupeKey` (nullable) — suppress this specific action
- `status` — `active` | `suppressed`
- `suppressedUntil` (nullable) — temporary suppression end
- `reason` (nullable)

---

## Migration

```bash
npx prisma migrate deploy
```

Migration: `20260227_next_action_preference_personalization`
