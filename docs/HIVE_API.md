# Client Engine hive machine API (Phases 2 / 6 / 7)

Implement under CE (`client-engine`) behind machine auth (`CE_HIVE_TOKEN` / same as Scorpion `CE_HIVE_TOKEN`).

## Endpoints

### `GET /api/hive/actions?limit=10`

Returns `{ actions: [{ id, type, summary, createdAt, source? }] }`.

### `GET /api/hive/leads?q=`

Returns `{ hits: [{ id, name, status?, email? }] }`.

### `POST /api/hive/notes`

Body: `{ leadId|dealId, body, source: "openclaw"|"n8n"|"operator" }`  
Creates timeline note; audit `source`.

### `POST /api/hive/actions/queue`

Body: `{ type, payload, reason }`  
Enqueues **HITL** approval — never auto-executes spend/send/deploy/delete/secrets.

## Builder gate (Phase 2)

If builder upstream unhealthy: serve explicit HTML/JSON `503 builder_unavailable` instead of naked proxy 502.

## Money path (Phase 7)

Lead → qualify → build → proof (CE deliverable) → invoice/close.  
CE proofs ≠ ProofCheck QC product.

## Auth

- Humans: Caddy basic_auth + Auth.js on `/pro`  
- Machines: Bearer token; no basic_auth bypass for browsers  
