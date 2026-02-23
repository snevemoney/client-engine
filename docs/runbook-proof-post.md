# Runbook: Generate a proof post (dashboard)

1. Log in to the dashboard.
2. Go to **Proof** (`/dashboard/proof` in sidebar).
3. In "Generate proof post", select the **Lead** you want a proof post for.
4. Click **Generate**. The post appears below (6–10 lines: what I saw → cost → what I changed → result → "comment CHECKLIST").
5. Click **Copy** and paste where you share (e.g. LinkedIn, thread). No auto-send; human posts only.

**Checklist:** When someone comments CHECKLIST, go to **Checklist** (`/dashboard/checklist`) → optionally enter keywords → **Generate checklist** → copy and share from the UI. No auto-DM, no auto-email.

## Testing

**Tier A (automated):** `proof-api.spec.ts` checks 401 without auth on proof/checklist generate endpoints.

**Tier B (manual production):** Open `/dashboard/proof` in MCP browser or real browser → verify lead selector loads, Generate button works, generated post appears, Copy button works. Same for `/dashboard/checklist`.
