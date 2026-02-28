# Phase 4.4 — NBA Templates + Actionable Work Items (Playbooks)

**Goal:** Every Next-Best-Action can show a **playbook/template**: what to do, steps, links, and suggested execution buttons.

---

## Template Registry

Code-based registry in `src/lib/next-actions/templates.ts`. Keyed by `ruleKey` (from NBA rules). No DB.

### Template Shape

```ts
type NextActionTemplate = {
  ruleKey: string;
  title: string;
  outcome: string;   // "What good looks like"
  why: string;      // short, operator-friendly
  checklist: Array<{ id: string; text: string; optional?: boolean }>;
  links?: Array<{ label: string; href: string }>;
  suggestedActions?: Array<{
    actionKey: string;
    label: string;
    confirm?: { title: string; body: string };
  }>;
};
```

### Usage

- `getTemplate(ruleKey)` — returns template or default
- `listTemplateRuleKeys()` — all registered ruleKeys

---

## UI

- **"Open playbook"** button (BookOpen icon) on each NBA row
- Expandable panel shows: title, why, outcome, checklist, links, suggested action buttons
- Suggested actions call `POST /api/next-actions/[id]/execute` with `actionKey`

---

## Adding a New Template

1. Add entry to `TEMPLATES` in `templates.ts` for the ruleKey
2. Ensure `suggestedActions` use valid delivery action keys from `delivery-actions.ts`

---

## Constraints

- No external providers; all actions are internal (existing delivery actions)
- Client-safe: templates module has no server-only imports
