# Lead intelligence schema

Human-risk dimensions for sales-engineering decisions. Defined so pipeline steps and Copilot can produce or consume them without new DB tables.

---

## Storage

- **Where:** `Artifact.meta` (JSON).
- **How:** Either:
  - A dedicated artifact: `type: "lead_intelligence"`, `title: "LEAD_INTELLIGENCE"`, `content` (markdown summary), `meta` (structured fields below); or
  - Enrichment or positioning artifact `meta` extended with the same fields.

Schema and helpers: `src/lib/lead-intelligence/schema.ts`.

---

## Fields (all optional)

| Field | Type | Meaning |
|-------|------|---------|
| `adoptionRisk` | string | What will they resist emotionally or politically? |
| `toolLoyaltyRisk` | string | Are they defending past decisions or tool choices? |
| `reversibility` | string | Can changes be rolled back safely? (e.g. "yes / pilot only / unknown") |
| `stakeholderMap` | string | Who must say yes, quietly? Who needs to feel safe? |
| `producedAt` | string (ISO) | When this intelligence was produced. |

---

## Use in pipeline / Copilot

- **Enrich or position step:** May write these into artifact `meta` when the model infers them from lead + research.
- **Proposal step:** May read `meta` (or a `lead_intelligence` artifact) to frame proposal as safe, reversible, and stakeholder-aware.
- **Copilot:** Uses these to answer rubric questions (who needs to feel safe, technical vs trust, least risky move). See docs/COPILOT_DECISION_RUBRIC.md.

No new Prisma models. Existing Artifact relation to Lead is sufficient.
