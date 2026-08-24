# Session: CI e2e full-flow navigation — 2026-08-24

## Goal
Unblock PR #23 `CI / e2e` after env/DB/seed already worked. `full-flow.spec.ts` failed on `page.goto("/dashboard/metrics")` with `net::ERR_ABORTED`.

## Decisions Made
- Do not `goto("/dashboard")` after login. That page `redirect()`s to `/dashboard/founder` and aborts the next Playwright navigation.
- Navigate with `waitUntil: "domcontentloaded"` and swallow only `ERR_ABORTED`, then assert the URL. Login still waits for `/\/dashboard/`.
- Add `AUTH_URL=http://localhost:3000` next to `NEXTAUTH_URL` for NextAuth v5.
- Do not change CardMedia fill/Safari behavior. Do not merge.

## What Was Built
- Modified `tests/e2e/full-flow.spec.ts` — `gotoPath()` helper; dropped redundant dashboard goto.
- Modified `.github/workflows/ci.yml` — `AUTH_URL` on the e2e job.
- `CHANGELOG.md` entry.

## Key Insights
- Next.js server `redirect()` can abort a following `page.goto` even when the destination is a different path.
- Smoke (`proof-api`, `smoke`) already passed on the same run; only full-flow failed.

## Trade-offs Accepted
- Swallowing `ERR_ABORTED` is scoped to navigation; URL assertion still fails if the page never landed.

## Open Questions
- Whether Scorecard / `enrich` assertions stay stable if metrics copy changes.

## Next Steps
- [x] Confirm `CI / e2e` is green on `01b6aa5` — 7 passed (full-flow, proof-api, smoke). Workflow [32692447598](https://github.com/snevemoney/client-engine/actions/runs/32692447598).
- [ ] Do not merge. `claude-review` fails because the actor is `cursor[bot]` (`allowed_bots`), not because of CardMedia or test code.
- [ ] Safari playback on device remains an operator check.
