# NDA-Safe Proof Engine

**Purpose:** Log proof assets without exposing client details. Use for content ideas, proposals, and pattern history. Observational only (see CLIENT_ENGINE_AXIOMS.md §8).

## What to store

- **Anonymized case pattern** — e.g. “SaaS with 10–50 employees, manual ops, wanted one dashboard.”
- **Lesson learned** — What you’d do again or differently.
- **Outcome summary** — Result in neutral terms (no client name).
- **Process improvement** — Workflow or tool change that helped.
- **Channel content ideas** — e.g. “LinkedIn post on X”, “Newsletter section on Y”.
- **Linked artifact IDs** — Optional: proposal or content artifact IDs this proof supports.

## Rules

- No client names, companies, or identifiable details.
- Observational language only; no hype or guarantees.
- Tie to channel content ideas and proposals via `linkedArtifactIds` for traceability.

## Where it appears

- **Command Center:** Weekly critic checks “NDA-safe proof assets created this week.”
- **API:** `GET /api/proof-assets`, `POST /api/proof-assets` (manual entry).
- Use proof assets when drafting proposals or content to cite patterns without breaking NDAs.
