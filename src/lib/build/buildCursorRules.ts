/**
 * Build CURSOR_RULES.md content from lead/build context.
 * Template-generated (deterministic), not LLM-generated — keeps handoff stable and predictable.
 */

export type BuildCursorRulesInput = {
  leadTitle?: string | null;
  company?: string | null;
  resultTarget?: string | null;
  constraints?: (string | null | undefined)[];
  stack?: (string | null | undefined)[];
  notes?: (string | null | undefined)[];
};

function cleanList(values?: (string | null | undefined)[]): string[] {
  return (values ?? [])
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
}

export function buildCursorRulesMarkdown(input: BuildCursorRulesInput): string {
  const leadTitle = input.leadTitle?.trim() || "Client project";
  const company = input.company?.trim() || "Unknown client";
  const resultTarget = input.resultTarget?.trim() || "Deliver a working result with clear proof";
  const constraints = cleanList(input.constraints);
  const stack = cleanList(input.stack);
  const notes = cleanList(input.notes);

  const stackLine = stack.length ? stack.join(", ") : "Use the existing project stack; avoid unnecessary rewrites.";
  const constraintsBlock = constraints.length
    ? constraints.map((c) => `- ${c}`).join("\n")
    : "- Prefer reversible changes.\n- Keep scope tight.\n- Ship the smallest proof first.";

  const notesBlock = notes.length ? notes.map((n) => `- ${n}`).join("\n") : "- No additional notes.";

  return `# CURSOR_RULES.md

## Project context
- **Lead / project:** ${leadTitle}
- **Client:** ${company}
- **Primary result target:** ${resultTarget}
- **Stack preference:** ${stackLine}

---

## Mission
Build only what helps this project move forward in production:
1. **Acquire** (if this improves conversion / clarity / trust)
2. **Deliver** (if this improves implementation / QA / speed)
3. **Improve** (if this creates reusable leverage for future projects)

If a change does not clearly support one of these, do not prioritize it.

---

## Non-negotiables
- **No fake completion:** do not claim features are done unless code, route, UI, and persistence are actually wired.
- **No hidden automation:** no auto-send, no auto-build, no silent state changes on money-path actions.
- **Human ownership required for:** final positioning, proposal narrative, final send, production deployment decisions.
- **No unnecessary rewrites:** preserve working code unless change is required for the task.
- **No abstraction inflation:** avoid adding frameworks/patterns unless the current task demands it.

---

## Build behavior rules
1. **Patch minimally, ship cleanly**
   - Make the smallest complete change that works.
   - Prefer extending current modules over introducing parallel systems.

2. **Preserve reversibility**
   - Favor changes that are easy to rollback.
   - Avoid destructive migrations unless explicitly required.

3. **Wire end-to-end, not half-done**
   - If adding a feature, connect:
     - UI
     - route/API
     - persistence/state
     - basic validation
   - Don't stop at "UI only" or "schema only."

4. **Use evidence in outputs**
   - When generating summaries/status, cite actual app data (artifacts, runs, scorecards, queue state) rather than generic statements.

5. **Keep operator visibility high**
   - Surfaces should make failures obvious:
     - failed runs
     - stale leads
     - stuck proposals
     - approval-required items

---

## Coding rules
- Follow the existing code style and folder conventions.
- Prefer typed helpers over inline ad-hoc logic.
- Validate incoming API payloads (Zod or existing pattern).
- Merge JSON/meta safely; don't overwrite unrelated keys.
- Keep UI copy clear and operator-focused (not marketing fluff).

---

## Output rules for generated artifacts
When generating docs or proposal/build artifacts:
- Use stable headings for parseability.
- Keep content concise and actionable.
- Include a **"Do now"** section when relevant.
- Avoid generic AI phrasing.

---

## Current project constraints
${constraintsBlock}

---

## Notes for this build
${notesBlock}

---

## Definition of done
A task is only "done" if:
- The code compiles (or fits the repo's current standard)
- The feature is reachable in the UI/API
- Data is persisted correctly
- Existing behavior is not broken
- The result supports Acquire / Deliver / Improve

If any of the above is missing, mark it as partial and list what remains.
`;
}

/**
 * Minimal fallback when LLM does not return cursorRulesMd or it is empty.
 * Ensures build step never fails the three-artifact contract.
 */
export function buildCursorRulesFallback(input: { leadTitle?: string; taskSummary?: string }): string {
  const leadTitle = input.leadTitle?.trim() || "Client task";
  const taskSummary = input.taskSummary?.trim() || "Implement the approved scoped work safely.";

  return `# CURSOR_RULES.md

## Mission
Implement the approved work for: **${leadTitle}**
Goal: ${taskSummary}

This is a private operator app. Optimize for production reliability, speed, and reversible changes.

## Scope
- Only implement what is required for this task.
- Prefer small, focused patches over broad refactors.
- Preserve existing behavior unless the task explicitly changes it.

## Human Guardrails
- Do NOT auto-send proposals, messages, or emails.
- Do NOT start builds/deployments automatically.
- Do NOT change positioning/narrative logic without explicit approval.
- Ask for approval before changing workflow-critical behavior.

## Change Boundaries
- Change only the files necessary for this task.
- Do NOT rename or move files unless required.
- Do NOT modify auth, billing, or core pipeline flow unless directly in scope.
- Do NOT introduce silent schema changes or hidden migrations.

## Code Rules
- Keep patches minimal and readable.
- Maintain TypeScript type safety.
- Reuse existing helpers/patterns where possible.
- No dead code, placeholders, or fake "done" comments.
- If adding TODOs, make them specific and actionable.

## Verification Rules
Before marking complete:
1. Confirm the feature works in the intended UI/API flow.
2. Confirm no existing path was broken.
3. Check relevant logs / error states.
4. Verify edge cases for null/empty/missing data.
5. Confirm output aligns with app guardrails (human approval still required where needed).

## Output Protocol
When done, report:
- Files changed
- What was implemented
- What was verified
- Known risks / limitations
- Suggested next step (Do now vs Backlog)

## Delivery Standard
Production-safe, reversible, and useful now.
`;
}
