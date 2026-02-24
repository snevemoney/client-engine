# Phase 1.4 + 1.5 Deploy Checklist

## 1. Sync code to VPS

```bash
git pull origin main  # or your deploy branch
```

## 2. Run full deploy (safe path)

```bash
./scripts/deploy-safe.sh
```

This will:
- Build app + worker
- Restart services
- Run `prisma db push`
- Run seed.mjs, seed-projects.mjs, seed-integrations.mjs
- Health check /api/health

## 3. Optional seeds (run if needed)

```bash
# If intake leads missing:
docker compose run --rm --user root app node prisma/seed-intake-leads.mjs

# For sample proof candidates:
docker compose run --rm --user root app node prisma/seed-proof-candidates.mjs

# For Phase 1.5 command center demo states:
docker compose run --rm --user root app node prisma/seed-command-center.mjs
```

## 4. Post-deploy DB must include

- ProofCandidate table + enums (ProofCandidateStatus, TriggerType, SourceType)
- IntakeLead: githubUrl, loomUrl, deliverySummary, deliveryCompletedAt, proofCandidateCount
- ProofRecord.proofCandidateId
- LeadActivityType: delivery_logged, proof_candidate_created, proof_candidate_promoted

## 5. Health check

```bash
curl -sfS http://127.0.0.1:3200/api/health
# or production URL
```

---

## Production smoke test (manual, after login)

See the user prompt for full smoke test steps (A–E).
