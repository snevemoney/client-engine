# Common Tasks — AI Rules

Step-by-step guides for tasks an AI commonly helps with in this codebase.

## Task: Add a New API Endpoint

1. Create file at `src/app/api/{namespace}/route.ts`
2. Use the standard route pattern from `coding-patterns.md`
3. Add Zod schema for mutations
4. Add `rateLimitByKey()` for write endpoints
5. Add `logOpsEventSafe()` for important mutations
6. Add `withSummaryCache()` for summary/aggregation GETs
7. Update `docs/generated/` by running `npm run docs:generate`

## Task: Add a New Database Model

1. Add model to `prisma/schema.prisma`
2. Add `@@index` for fields used in WHERE clauses
3. Add composite indexes for multi-field queries (see existing patterns)
4. Run `npx prisma db push` (NOT `prisma migrate`)
5. Run `npx prisma generate`
6. Create service functions in `src/lib/{domain}/`
7. Create API routes
8. Run `npm run docs:generate`

## Task: Add a New Brain Tool

1. Add definition to `BRAIN_TOOLS` in `src/lib/brain/tools.ts`
2. Add handler in `src/lib/brain/executor.ts` (switch case)
3. If write tool: add to `WRITE_TOOLS` set in `tools.ts`
4. If agents should use it: add to `allowedTools` in agent config (`registry.ts`)
5. Test via Brain chat panel — ask it to use the tool
6. Run `npm run docs:generate`

## Task: Add a New Agent

1. Add ID to `AgentId` type in `src/lib/agents/types.ts`
2. Add config to `AGENT_REGISTRY` in `src/lib/agents/registry.ts`
3. Create system prompt extension (what the agent should do)
4. Define `allowedTools` (minimal set needed)
5. Define `autoApprovedTools` (read tools that skip approval)
6. Define `scheduledRuns` with cron labels and task prompts
7. Test: `POST /api/agents/cron` with `{agentId: "my_agent", trigger: "manual"}`
8. Monitor at `/dashboard/operator/agents`

## Task: Add a New Dashboard Page

1. Create `src/app/dashboard/{page}/page.tsx`
2. Add `"use client";` if interactive
3. Import and use intelligence context for health bar
4. Call `setPageData()` to give Brain context about this page
5. Use existing components from `src/components/ui/`
6. Follow dark theme: `bg-neutral-900`, `text-neutral-100`
7. Add to sidebar navigation in layout

## Task: Add a New NBA Rule

1. Add rule function in `src/lib/next-actions/rules.ts`
2. It receives `NextActionContext` and pushes to output array
3. Set `createdByRule` to a unique rule key (snake_case)
4. Set `dedupeKey` for idempotent upsert
5. Call it from `produceNextActions()`
6. Add scope mapping in `scope.ts`
7. Optionally add template in `templates.ts`
8. Test: `POST /api/next-actions/run` → check `/dashboard/next-actions`

## Task: Add a New Risk Rule

1. Add rule function in `src/lib/risk/rules.ts`
2. It receives `RiskRuleContext` and returns `RiskCandidate[]`
3. Set `dedupeKey` for deduplication
4. Call it from `evaluateRiskRules()`
5. Test: `POST /api/risk/run-rules` → check `/dashboard/risk`

## Task: Add a Notification Channel

1. Create adapter in `src/lib/notifications/channels/{name}.ts`
2. Implement `ChannelAdapter` interface (send function)
3. Register in channel selection logic
4. Create `NotificationChannel` record in DB
5. Test via `/api/notification-channels/[id]/test`

## Task: Fix a Slow Page

1. Check browser console for `[SLOW]` warnings (>300ms queries)
2. Look for missing `select` clauses (overfetching)
3. Look for sequential `await` that could be `Promise.all`
4. Check if summary endpoint needs `withSummaryCache()`
5. Check `prisma/schema.prisma` for missing composite indexes
6. Reference `docs/PERFORMANCE_TRIAGE.md` for deeper optimization

## Task: Deploy to Production

1. Run `npx tsc --noEmit` — must pass
2. Run `npx playwright test` — key specs must pass
3. Run `npm run docs:generate` if models/routes changed
4. Commit changes
5. Run `./scripts/deploy-safe.sh`
6. Run `./scripts/smoke-test.sh` post-deploy
7. Check `/api/health` on production
8. Reference `docs/VPS_DEPLOY_CHECKLIST.md` for full guide

## Task: Debug a Failed Agent Run

1. Check `/dashboard/operator/agents` for recent runs
2. Look at the `AgentRun` record — check `status`, `errorMessage`, `toolCallsJson`
3. Check if it hit circuit breaker (2 consecutive failures)
4. Check if it hit token limit (50k max)
5. Check if an approval was pending but expired
6. Look at `OpsEvent` logs for the timeframe
7. Try running the agent manually: `POST /api/agents/cron` with trigger "manual"

## Task: Debug a Failed Pipeline Run

1. Check `/dashboard/leads/[id]` for the lead
2. Look at `PipelineRun` + `PipelineStepRun` records
3. Common errors:
   - `OPENAI_4XX` — OpenAI API error (rate limit, bad request)
   - `VALIDATION` — Input validation failed
   - `TIMEOUT` — Step took too long
4. Check if `PIPELINE_DRY_RUN=1` should be set (no real API calls)
5. Retry: `POST /api/pipeline/retry/[leadId]`

## Task: Understand a Dashboard Page

When reading a dashboard page, look for:
1. `useRetryableFetch()` calls — what API endpoints it fetches
2. `useIntelligenceContext()` — the health bar data source
3. `useBrainPanel().setPageData()` — what context the Brain gets
4. `useAsyncAction()` calls — what mutations it performs
5. The API routes referenced — read them for the full data flow
