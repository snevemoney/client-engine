# Session Journal — AI Rules

After every meaningful work session, the AI should offer to update these files to preserve the thinking process.

## What to Capture

After a session, summarize:
1. **What was discussed** — problems explored, options considered, trade-offs debated
2. **What was decided** — the chosen approach and why
3. **What was built** — files created/modified, features added/fixed
4. **What was learned** — patterns discovered, gotchas found, things that didn't work
5. **What's next** — unfinished work, follow-up tasks, open questions

## Where to Write

### 1. `docs/sessions/YYYY-MM-DD-topic.md` (Session Log)

One file per session. Captures the full thinking process.

**Template:**
```markdown
# Session: [Topic] — YYYY-MM-DD

## Goal
What we set out to do.

## Decisions Made
- Decision 1: Chose X over Y because [reason]
- Decision 2: ...

## What Was Built
- Created `path/to/file.ts` — [purpose]
- Modified `path/to/other.ts` — [what changed and why]

## Key Insights
- [Pattern/gotcha/learning that's worth remembering]

## Trade-offs Accepted
- [What we gave up and why it's acceptable]

## Open Questions
- [Things still unresolved]

## Next Steps
- [ ] Task 1
- [ ] Task 2
```

### 2. `CHANGELOG.md` (What Changed)

Add entry under `[Unreleased]` with the session's changes:
```markdown
### Added
- Feature description

### Changed
- What was modified and why

### Fixed
- Bug that was fixed
```

### 3. `ROADMAP.md` (What's Next)

Update the "Active Work" and "Next Up" sections based on what was completed and what remains.

### 4. `docs/decisions/NNN-topic.md` (If Architectural Decision Was Made)

If the session involved choosing between approaches (e.g., "should we use X or Y?"), create a new ADR.

### 5. `.claude/projects/.../memory/MEMORY.md` (AI Memory)

Update Claude Code's persistent memory with stable patterns confirmed during the session.

## When to Journal

**Always journal when:**
- A feature was implemented (even partially)
- An architectural decision was made
- A bug was investigated (even if not fixed)
- A refactor was planned or executed
- Performance was analyzed or optimized

**Skip journaling for:**
- Pure Q&A with no code changes
- Trivial typo fixes
- Reading/exploring without decisions

## How to Ask the AI

At the end of a session, say:

> "Journal this session"

or

> "Update the docs with what we did"

or

> "Summarize our work and update changelog/roadmap"

The AI should then:
1. Create `docs/sessions/YYYY-MM-DD-topic.md` with full session summary
2. Update `CHANGELOG.md` with changes made
3. Update `ROADMAP.md` if tasks were completed or new ones identified
4. Create ADR if an architectural decision was made
5. Run `npm run docs:generate` if models/routes/tools changed
