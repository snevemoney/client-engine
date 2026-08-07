# Session: /pro cutover onto main

## Goal

Land the isolated `/pro` operator OS on `main`, verify live VPS wiring, and sweep docs/smoke so the next deploy does not regress to root `/dashboard` URLs.

## Decisions

- Merge PR #10 (`cursor/domain-path-consolidation-59dd` @ `46558a3`) onto `main` — do not reinvent architecture.
- Keep ADR 007: second image `NEXT_PUBLIC_BASE_PATH=/pro` on `127.0.0.1:3204`; root `:3200` unchanged; shared Postgres/Redis; Caddy `/pro*` without stripping.
- Auth.js: `NEXTAUTH_URL` origin-only + `AUTH_TRUST_HOST=true` (never put `/pro` in AUTH_URL).
- Do **not** redirect `evenslouis.pro` until Sprint 1–9 §5 smoke at `/pro` is finished.
- Do **not** start Architecture Phase 2–4.

## What was done

- Merged `/pro` onto `main` (`c81ac32` Merge PR #10).
- VPS checkout synced to `main`; Compose `pro` service present; containers healthy.
- Auth smoke inside `pro` container: CSRF → credentials callback → session → `/pro/dashboard` **200**.
- Public: `https://evenslouis.ca/pro/api/health` **200**.
- Doc/config sweep branch `cursor/pro-cutover-docs-59dd`: README, ROADMAP, PROJECT_CONTEXT, CHANGELOG, VPS/AFTER/BEFORE/DEPLOY checklists, `.env.example`, `scripts/smoke-test.sh` (public + `/pro`), `tests/e2e/prod.spec.ts` comment.

## Insights

- Live `/pro` was already healthy while `main` lacked the code — **merge drift** was the real risk; merging closed it.
- A checkout on an unrelated feature branch without Compose `pro` does not stop the existing `pro` container, but the next `docker compose up` from that tree would drift — keep VPS on `main` (or a branch that includes `pro`).

## Next steps

- Finish manual Sprint 1–9 §5 smoke at `/pro/...` URLs.
- Only then redirect `evenslouis.pro` → `https://evenslouis.ca/pro`.
- Merge remaining product PRs as needed (e.g. AI Brain Sonnet 5 / YouTube PR #13) without blocking `/pro` cut.
- Human decides when Architecture Phase 2 starts.
