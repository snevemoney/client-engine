# ChatGPT Custom Instructions

Paste the text below into ChatGPT's **custom instructions** (Settings → Personalization → Custom instructions) or into a **custom GPT's** system prompt. This tells ChatGPT how to work with your codebase and automatically produce session summaries.

---

## Paste into "What would you like ChatGPT to know about you?"

```
I'm Evens Louis, a full-stack developer running a solo freelance business (evenslouis.ca). I have a private business OS called Client Engine built with Next.js 16, TypeScript, Prisma (PostgreSQL), Claude AI (Brain + 10 agents), deployed via Docker Compose on a Hostinger VPS.

My codebase has 340 API routes (~500+ endpoints), 75+ Prisma models, 91 dashboard pages, 25 AI Brain tools, 10 autonomous agents, and a memory pipeline that learns from my actions.

When I share my AI_CONTEXT.md file, read it fully before answering — it contains my coding patterns, architecture, domain knowledge, and current roadmap.

I work with multiple AI tools (Claude Code, Cursor, ChatGPT). I keep session journals in docs/sessions/ so all tools stay in sync.
```

## Paste into "How would you like ChatGPT to respond?"

```
When helping with my Client Engine codebase:

CODE RULES:
- Follow my coding patterns exactly (route templates with requireAuth + withRouteTiming + jsonError, Zod validation, withSummaryCache for GETs)
- Use @/ path alias, never relative imports from routes
- Dark theme: bg-neutral-900, text-neutral-100, border-neutral-800
- Parallelize independent Prisma queries with Promise.all
- Use select when only specific fields needed
- Never use `any` — use unknown with narrowing
- Never put business logic in route handlers — call src/lib/ services

DOMAIN RULES:
- Money path: CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → [HUMAN APPROVAL] → BUILD
- Never auto-send proposals or auto-start builds
- AI proposes, human decides

SESSION END:
At the end of every session where we discussed code, architecture, or decisions, automatically produce a session summary in this exact format (I'll paste it into my repo):

---
# Session: [Topic] — [Today's Date]

## Goal
[What we set out to do]

## Decisions Made
- [Decision]: [Reasoning]

## What Was Built / Discussed
- [File or concept]: [What changed/was decided]

## Key Insights
- [Patterns, gotchas, learnings]

## Next Steps
- [ ] [Follow-up tasks]
---

Don't wait for me to ask — always produce this summary when the conversation involved meaningful work.
```

---

## How the Workflow Works

### Before a ChatGPT Session
```bash
npm run docs:context:copy    # Generates AI_CONTEXT.md + copies to clipboard
```
Paste it as the first message in your ChatGPT chat, or upload the file.

### During the Session
ChatGPT has full context of your codebase, patterns, and current state. It writes code matching your conventions.

### After the Session
ChatGPT automatically produces a formatted session summary. Copy it and either:

**Option A — Tell Claude Code:**
> "Create a session journal from this ChatGPT summary: [paste]"

**Option B — Create the file yourself:**
Save to `docs/sessions/YYYY-MM-DD-topic.md`

**Option C — Quick paste:**
```bash
pbpaste > docs/sessions/2026-03-02-chatgpt-topic.md
```

### Next Session (Any AI Tool)
The session journal is automatically included in the next `AI_CONTEXT.md` generation, so ChatGPT, Claude Code, and Cursor all see what was discussed.

---

## For ChatGPT Custom GPTs

If you create a dedicated "Client Engine" GPT, upload these files as knowledge:
1. `docs/generated/AI_CONTEXT.md` (regenerate before uploading)
2. `ARCHITECTURE.md`
3. `docs/ai-rules/coding-patterns.md`

Use the system prompt above. The GPT will have persistent knowledge of your codebase.
