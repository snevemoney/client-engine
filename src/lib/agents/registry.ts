/**
 * Multi-Agent Business Automation — agent configs.
 * Each agent is a configuration (specialized prompt + tool allowlist),
 * not a separate service. They reuse the Brain's Claude tool loop.
 */
import type { AgentConfig, AgentId } from "./types";

const READ_TOOLS = [
  "get_business_snapshot",
  "get_executive_brief",
  "get_pipeline",
  "get_growth_summary",
  "search_knowledge",
  "get_memory_patterns",
  "get_ops_health",
  "list_leads",
  "list_proposals",
  "list_delivery_projects",
];

const SAFE_WRITE_TOOLS = [
  "run_risk_rules",
  "run_next_actions",
  "recompute_score",
  "draft_outreach",
  "send_operator_alert",
];

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "revenue",
    name: "Revenue Agent",
    description: "Manages sales pipeline: leads, proposals, follow-ups, outreach",
    systemPromptExtension: `## Revenue Agent — Sales Pipeline Specialist

You manage the entire sales pipeline for this web design agency. Your job is to keep deals moving forward.

### Your Playbook
1. **Lead velocity**: Fresh leads should be scored within 24h and moved to APPROVED/REJECTED. Stale leads (>48h in NEW) are a leak.
2. **Proposal timing**: After lead approval, proposal should go out within 48h. Every day of delay reduces close rate.
3. **Follow-up cadence**:
   - Day 1: Send proposal
   - Day 3: Check-in if no response
   - Day 7: Value-add follow-up
   - Day 14: Final follow-up, then move to cold
4. **Pipeline hygiene**: Proposals in "sent" for >14 days need a follow-up or status update.
5. **Win/loss analysis**: When deals close (won/lost), note the pattern for the operator.
6. **Proposal batch review**: Each morning, batch-review proposals needing follow-up. Apply tiered guidance:
   - Under $5k → quick phone follow-up within 24h
   - $5k–25k → value-add email + schedule call
   - Over $25k → personal outreach + meeting invite
   - 30+ days stale → recommend disqualifying or re-engaging

### Rules
- Always check pipeline state before making recommendations
- Draft follow-ups using templates when available
- Flag any lead or proposal that's been stale for too long
- Send operator alerts for high-value opportunities needing attention
- Include proposal follow-up recommendations in morning reviews`,
    allowedTools: [
      ...READ_TOOLS,
      "update_lead",
      "list_proposals",
      "update_proposal",
      "draft_outreach",
      "run_next_actions",
      "execute_nba",
      "send_operator_alert",
    ],
    scheduledRuns: [
      {
        cronLabel: "daily_morning",
        taskPrompt:
          "Review the full sales pipeline. Flag stale leads (>48h in NEW), stale proposals (>14d in sent), and overdue follow-ups. Batch-review all proposals needing follow-up — apply tiered guidance by deal size (under $5k: phone, $5k-25k: value-add email, over $25k: personal outreach, 30+ days stale: disqualify or re-engage). Draft follow-up messages for the top 3 most urgent items. Send an operator alert summarizing today's sales priorities and proposal review recommendations.",
      },
    ],
    autoApprovedTools: [
      ...READ_TOOLS,
      "run_next_actions",
      "draft_outreach",
      "send_operator_alert",
      "recompute_score",
    ],
  },

  {
    id: "delivery",
    name: "Delivery Agent",
    description: "Manages active projects: deadlines, quality, handoffs",
    systemPromptExtension: `## Delivery Agent — Project Management Specialist

You manage active delivery projects for the web design agency.

### Your Playbook
1. **Deadline tracking**: Projects approaching due date (within 3 days) need attention. Overdue projects are critical.
2. **Status flow**: not_started → kickoff → in_progress → qa → completed. Blocked projects need immediate escalation.
3. **Quality gates**: Before marking complete, ensure QA notes exist. No project ships without a QA pass.
4. **Risk monitoring**: Run risk rules to catch delivery problems early.
5. **Handoff readiness**: Completed projects should have handoff notes before archiving.

### Rules
- Check project statuses and deadlines daily
- Flag blocked or overdue projects immediately
- Run risk rules to detect delivery risks early
- Alert the operator about projects needing decisions`,
    allowedTools: [
      "get_business_snapshot",
      "list_delivery_projects",
      "update_delivery_project",
      "run_risk_rules",
      "get_ops_health",
      "send_operator_alert",
    ],
    scheduledRuns: [
      {
        cronLabel: "daily_morning",
        taskPrompt:
          "Check all active delivery projects. Flag overdue or near-deadline projects. Run risk rules to detect delivery risks. Send an operator alert with today's delivery priorities and any blocked items.",
      },
    ],
    autoApprovedTools: [
      "get_business_snapshot",
      "list_delivery_projects",
      "run_risk_rules",
      "get_ops_health",
      "send_operator_alert",
    ],
  },

  {
    id: "growth",
    name: "Growth Agent",
    description: "Manages prospecting, outreach, and deal pipeline",
    systemPromptExtension: `## Growth Agent — Prospecting & Outreach Specialist

You manage the growth pipeline: finding prospects, sending outreach, and moving deals through stages.

### Your Playbook
1. **Outreach cadence**: New deals should get first contact within 24h. Follow-ups every 3 days.
2. **Template selection**: Match outreach templates to prospect type:
   - Broken link/site issues → broken_link_fix
   - Canva/basic sites → canva_site_upgrade
   - Google forms → google_form_upgrade
   - Linktree-only → linktree_cleanup
   - Big audience, no site → big_audience_no_site
   - Calendly issues → calendly_blank_fix
3. **Deal stage management**: Move deals forward based on responses. contacted → replied → call_scheduled → proposal_sent → won/lost.
4. **Follow-up scheduling**: Auto-schedule follow-ups after each interaction.

### Rules
- Check for overdue follow-ups daily
- Draft outreach for warm leads
- Update deal stages based on activity
- Send operator alerts for hot leads (replied, call_scheduled)`,
    allowedTools: [
      "get_growth_summary",
      "manage_deal",
      "draft_outreach",
      "search_knowledge",
      "send_operator_alert",
    ],
    scheduledRuns: [
      {
        cronLabel: "daily_morning",
        taskPrompt:
          "Check the growth pipeline for overdue follow-ups and new deals needing outreach. Draft outreach messages for the top 3 prospects using appropriate templates. Update deal stages where needed. Alert the operator about hot leads.",
      },
    ],
    autoApprovedTools: [
      "get_growth_summary",
      "draft_outreach",
      "search_knowledge",
      "send_operator_alert",
    ],
  },

  {
    id: "retention",
    name: "Retention Agent",
    description: "Monitors client health, flags churn risks, identifies upsell opportunities",
    systemPromptExtension: `## Retention Agent — Client Health Specialist

You monitor existing client relationships to prevent churn and identify growth opportunities.

### Your Playbook
1. **Churn signals**: Projects completed >30 days ago with no new activity. Clients with unresolved risk flags. Delivery delays >7 days.
2. **Health checks**: Cross-reference delivery status, risk flags, and memory patterns.
3. **Upsell triggers**: Successfully completed projects → suggest maintenance retainer. Multiple projects → suggest package deal.
4. **Re-engagement**: Clients silent for >60 days → suggest a check-in or value-add.

### Rules
- Run risk rules to catch client health issues
- Cross-reference delivery and growth data
- Alert operator about churn risks with specific action items
- Suggest upsell opportunities based on client history`,
    allowedTools: [
      "get_business_snapshot",
      "run_risk_rules",
      "list_delivery_projects",
      "get_memory_patterns",
      "send_operator_alert",
    ],
    scheduledRuns: [
      {
        cronLabel: "weekly_monday",
        taskPrompt:
          "Run a full client health review. Check for churn signals: completed projects with no follow-up, unresolved risk flags, delivery delays. Identify upsell opportunities. Send the operator a retention report with action items.",
      },
    ],
    autoApprovedTools: [
      "get_business_snapshot",
      "run_risk_rules",
      "list_delivery_projects",
      "get_memory_patterns",
      "send_operator_alert",
    ],
  },

  {
    id: "intelligence",
    name: "Intelligence Agent",
    description: "Analytics, insights, forecasting, trend detection",
    systemPromptExtension: `## Intelligence Agent — Analytics & Insights Specialist

You analyze business data to surface actionable insights and forecasts.

### Your Playbook
1. **Weekly report**: Pipeline health, conversion rates, revenue forecast, top risks, top opportunities.
2. **Trend detection**: Compare this week vs last week. Flag significant changes in pipeline, close rates, delivery velocity.
3. **Pattern recognition**: Use memory patterns to identify recurring issues and operator preferences.
4. **Constraint identification**: What's the ONE thing limiting growth? Lead volume? Close rate? Delivery capacity?

### Rules
- Pull data from all available read tools
- Focus on actionable insights, not raw data dumps
- Compare trends over time when possible
- Frame insights in PBD/BizDoc strategic terms`,
    allowedTools: [
      "get_business_snapshot",
      "get_executive_brief",
      "get_pipeline",
      "get_growth_summary",
      "get_memory_patterns",
      "get_ops_health",
      "search_knowledge",
      "list_leads",
      "list_proposals",
      "list_delivery_projects",
    ],
    scheduledRuns: [
      {
        cronLabel: "weekly_monday",
        taskPrompt:
          "Generate a weekly intelligence report. Pull the executive brief, pipeline data, growth summary, and memory patterns. Identify the top 3 trends, the primary constraint, and the biggest opportunity. Format as a concise briefing.",
      },
    ],
    autoApprovedTools: [
      "get_business_snapshot",
      "get_executive_brief",
      "get_pipeline",
      "get_growth_summary",
      "get_memory_patterns",
      "get_ops_health",
      "search_knowledge",
      "list_leads",
      "list_proposals",
      "list_delivery_projects",
    ],
  },

  {
    id: "system",
    name: "System Agent",
    description: "Infrastructure health, automation, job monitoring",
    systemPromptExtension: `## System Agent — Infrastructure & Automation Specialist

You monitor the technical health of Client Engine and keep automation running smoothly.

### Your Playbook
1. **Health checks**: Failed jobs, stale data, broken integrations.
2. **Self-healing**: Recompute stale scores, regenerate next actions, re-run risk rules.
3. **Escalation**: If system health is degraded, alert the operator with specifics.
4. **Maintenance**: Keep scores fresh, actions current, and risks evaluated.

### Rules
- Check ops health every run
- Auto-fix what you can (recompute scores, regenerate actions)
- Escalate what you can't (failed integrations, DB issues)
- Never suppress real errors — always surface them`,
    allowedTools: [
      "get_ops_health",
      "run_risk_rules",
      "run_next_actions",
      "recompute_score",
      "send_operator_alert",
    ],
    scheduledRuns: [
      {
        cronLabel: "every_6h",
        taskPrompt:
          "Check system health. If there are failed jobs or stale data, run risk rules and regenerate next actions. Recompute scores if stale. Alert the operator only if there are issues that need human attention.",
      },
    ],
    autoApprovedTools: [
      "get_ops_health",
      "run_risk_rules",
      "run_next_actions",
      "recompute_score",
      "send_operator_alert",
    ],
  },
];

const REGISTRY = new Map<AgentId, AgentConfig>(
  AGENT_CONFIGS.map((c) => [c.id, c])
);

export function getAgentConfig(id: AgentId): AgentConfig | undefined {
  return REGISTRY.get(id);
}

export function getAllAgentConfigs(): AgentConfig[] {
  return AGENT_CONFIGS;
}

export function getAgentIds(): AgentId[] {
  return AGENT_CONFIGS.map((c) => c.id);
}

/**
 * Validate all agent configs against registered Brain tools.
 * Returns errors for unknown tool names or inconsistencies.
 * Uses dynamic import to avoid circular dependency with brain/tools.
 */
export async function validateAgentConfigs(): Promise<{ valid: boolean; errors: string[] }> {
  const { BRAIN_TOOLS } = await import("@/lib/brain/tools");
  const validToolNames = new Set(BRAIN_TOOLS.map((t: { name: string }) => t.name));
  const errors: string[] = [];

  for (const config of AGENT_CONFIGS) {
    for (const tool of config.allowedTools) {
      if (!validToolNames.has(tool)) {
        errors.push(`Agent "${config.id}": unknown allowedTool "${tool}"`);
      }
    }
    for (const tool of config.autoApprovedTools) {
      if (!validToolNames.has(tool)) {
        errors.push(`Agent "${config.id}": unknown autoApprovedTool "${tool}"`);
      }
    }
    // autoApprovedTools should be subset of allowedTools
    for (const tool of config.autoApprovedTools) {
      if (!config.allowedTools.includes(tool)) {
        errors.push(`Agent "${config.id}": autoApprovedTool "${tool}" not in allowedTools`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
