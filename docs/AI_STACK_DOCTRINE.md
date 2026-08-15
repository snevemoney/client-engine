# AI Stack Doctrine — Client Engine

Four-layer AI leverage hierarchy. Every AI system in this repo operates within these layers.

---

## Layer Order (Systems-True)

```
AI Engineering → Context Engineering → Intent Engineering → Prompt Engineering
```

**Order of dependency:** Each layer builds on the one below it. If the foundation is broken, nothing above it works.

**Order of leverage once foundation exists:** Intent + Context often outperform prompt-only optimization. Broken infra kills all leverage — AI Engineering is foundational, not "less important."

---

## Layer Definitions

### 1. AI Engineering (Foundation)

**Job:** Make the whole thing actually work.

**Builds:**
- Tool registry and execution
- Queues and job scheduling
- Execution logs and observability
- Memory storage and retrieval
- Route contracts and API shapes
- Auth, rate limits, guardrails
- Deploy system, migrations, health checks
- Tests and evals

### 2. Context Engineering (Runtime)

**Job:** Make sure the model sees the right world.

**Builds:**
- Retrieved records and domain context
- Session state and history
- Page context injection
- Founder/risk/NBA/growth summaries
- Scoped memory and learned weights
- Evidence, citations, and attribution
- Tools available and permissions
- Workflow state

### 3. Intent Engineering (Guidance)

**Job:** Make the AI act in service of the company, not just the request.

**Builds:**
- Organizational purpose and priorities
- What must never be violated
- What counts as success
- What gets prioritized vs ignored
- When to escalate vs act
- Decision rubrics and policies
- Role boundaries and WIP limits
- "When not to act" rules

### 4. Prompt Engineering (Surface)

**Job:** Control the immediate instruction.

**Builds:**
- Agent system prompts
- Output schemas and structured responses
- Tool-use instructions and refusal rules
- Role framing and personality
- Confirmation language
- User-facing interaction style

---

## Client Engine Mapping

| Layer | Key Artifacts |
|-------|---------------|
| **AI Engineering** | `src/lib/brain/tools.ts` (25 tools, WRITE_TOOLS set), `src/lib/agents/` (registry, runner, approval, scheduler), `prisma/schema.prisma` (JobRun, AgentRun, CopilotSession, OperatorLearnedWeight), `src/lib/api-utils.ts` (requireAuth, rate limits, withRouteTiming), route contracts (401/500/429 shapes), `deploy.sh` + `scripts/` (deploy system), `src/lib/ops-events/` (logOpsEventSafe, sanitize) |
| **Context Engineering** | `src/lib/command-center/fetch-data.ts` (business snapshot), `src/app/api/internal/founder/summary/route.ts` (founder aggregate), `src/app/api/internal/*/context/route.ts` (leads, delivery, growth, retention domain context), `src/lib/risk/fetch-context.ts` + `src/lib/next-actions/fetch-context.ts` (rule context), `src/lib/memory/` (weights, attribution, scoped retrieval), `src/lib/copilot/session-service.ts` (session history, page context injection), `src/hooks/useDomainContext.ts` (page → Brain context) |
| **Intent Engineering** | `docs/CLIENT_ENGINE_AXIOMS.md` (behavioral contract, money path, what's not allowed), `docs/COPILOT_DECISION_RUBRIC.md` (what to answer, flag, ignore), `docs/OPERATOR_FRAMEWORK.md` (strengths, weak spots, habits), `src/lib/copilot/safe-refusal.ts` (when not to act), `src/lib/agents/approval.ts` (escalation rules, write-tool gates), `src/lib/next-actions/rules.ts` (NBA policy, suppression), `src/lib/risk/rules.ts` (risk policy), PATCH allowlists (no status bypass — encoded constraints) |
| **Prompt Engineering** | `src/lib/brain/system-prompt.ts` (buildSystemPrompt — PBD/BizDoc personality), `src/lib/agents/registry.ts` (systemPromptExtension per agent), `src/lib/niche/context.ts` (niche injection into prompts), `src/lib/brain/tools.ts` (tool descriptions, refusal rules), pipeline prompts in `src/lib/pipeline/` (enrich, score, position, propose), domain prompts in `src/lib/learning/`, `src/lib/revenue/`, `src/lib/knowledge/` |

---

## Anti-Patterns

| Layer | Anti-Pattern |
|-------|--------------|
| **AI Engineering** | Adding tools without execution logs. Routes without auth or rate limits. Deploying without `migrate deploy`. Tests that don't cover 401/400/500 shapes. |
| **Context Engineering** | Strong prompt with weak context. Brain without `get_business_snapshot` first. Agents running without domain context. Session history not injected. |
| **Intent Engineering** | Agents busy instead of useful. No "when not to act" rule. Bypassing money-path gates. Proposals that oversell. Auto-send without approval. |
| **Prompt Engineering** | Prompt-first without Intent/Context foundation. Generic "helpful assistant" tone. No refusal rules. Output schema without validation. |

---

## How to Use This

### When adding a new AI feature
1. Start at AI Engineering: does the infra exist (tools, routes, logging)?
2. Then Context: will the model see the right data?
3. Then Intent: what should it optimize for, refuse, escalate?
4. Last, Prompt: how should it express itself?

### When debugging AI behavior
1. Check Context first — is the model seeing stale/wrong/missing data?
2. Then Intent — is the system correctly constrained?
3. Then Prompt — is the instruction unclear?
4. Last, AI Engineering — is something broken in execution?

### When reviewing AI changes
- Does the change touch the right layer?
- Does it violate any layer below it?
- Does it add a prompt without checking context and intent?

---

## References

- [docs/CLIENT_ENGINE_AXIOMS.md](CLIENT_ENGINE_AXIOMS.md) — Intent layer: behavioral contract
- [docs/COPILOT_DECISION_RUBRIC.md](COPILOT_DECISION_RUBRIC.md) — Intent layer: copilot rules
- [docs/OPERATOR_FRAMEWORK.md](OPERATOR_FRAMEWORK.md) — Intent layer: operator strengths/gaps
- [docs/BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md) — Domain ownership map
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System design
- [docs/PROACTIVE_PERSISTENT_SELF_IMPROVING_AGENT_ARCHITECTURE.md](PROACTIVE_PERSISTENT_SELF_IMPROVING_AGENT_ARCHITECTURE.md) — Three pillars, protocols, guardrails
