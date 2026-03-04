# Brain Tools

> Auto-generated on 2026-03-04. 25 tools (12 write).

## All Tools

| Tool | Type | Description |
|------|------|-------------|
| `get_business_snapshot` | read | Get the current operator score (health band), open risk flags by severity, and queued next best actions. Call this first |
| `get_executive_brief` | read | Get the executive brief: money scorecard, stage conversion, pipeline leak, revenue forecast, primary constraint, constra |
| `get_pipeline` | read | Get current pipeline: qualified leads, ready proposals, next actions, risk flags, and recent wins. |
| `get_growth_summary` | read | Get growth pipeline summary: deals by stage, overdue follow-ups, upcoming follow-ups, last activity timestamp. Requires  |
| `search_knowledge` | read | Search the knowledge base (including YouTube transcript insights, learning proposals, and artifacts) using semantic sear |
| `get_memory_patterns` | read | Get the operator's learned preferences and patterns: top rule weights (what they value), trend diffs (what's changing we |
| `run_risk_rules` | write | Evaluate all risk rules and upsert risk flags. Use this when the operator asks to check for risks or when risk data seem |
| `run_next_actions` | write | Regenerate next best actions from rules. Use when actions seem stale or the operator asks for fresh recommendations. |
| `recompute_score` | write | Refresh the operator score snapshot. Use when score seems stale or after running risk rules / next actions. |
| `execute_nba` | write | Execute a specific next best action by its ID. Available action keys: mark_done, snooze_1d, dismiss, don_t_suggest_again |
| `draft_outreach` | write | Draft an outreach message using a template. Returns the rendered message text. |
| `get_ops_health` | read | Get system health: failed jobs (24h/7d), pipeline run status, stale entities, and overall system status. |
| `list_leads` | read | List leads with optional filters. Returns id, title, status, source, contactName, contactEmail, score, createdAt. Status |
| `update_lead` | write | Update a lead's status, notes, or score. Provide the lead ID and the fields to change. |
| `list_proposals` | read | List proposals with optional filters. Returns id, title, clientName, status, priceMin, priceMax, createdAt. Status value |
| `update_proposal` | write | Update a proposal's status, pricing, or notes. Provide the proposal ID and fields to change. |
| `list_delivery_projects` | read | List delivery projects with optional filters. Returns id, title, clientName, status, dueDate, completedAt. Status values |
| `update_delivery_project` | write | Update a delivery project's status, notes, or dates. |
| `manage_deal` | write | Update a growth deal's stage, priority, or schedule follow-up. Stage values: new, contacted, replied, call_scheduled, pr |
| `send_operator_alert` | write | Send a notification alert to the operator. Use for important updates, warnings, or action items that need attention. |
| `list_proof_records` | read | List proof records with optional filters. Returns id, title, company, outcome, metricValue, metricLabel, createdAt, and  |
| `schedule_content_post` | write | Generate and optionally schedule a content post from a proof record. Creates a draft post for the given platform. If sch |
| `list_signals` | read | List signal items with optional filters. Returns id, title, score, tags, sourceUrl, status, createdAt. Use to find oppor |
| `match_signal_opportunities` | read | Match a signal item to existing prospects/deals by niche, platform, and keywords. Returns ranked matches with relevance  |
| `delegate_to_agent` | write | Delegate a complex task to a specialized worker. Workers: commander (orchestration/self-healing), signal_scout (RSS/oppo |

## Write Tools (require approval in agent mode)

- `run_risk_rules`
- `run_next_actions`
- `recompute_score`
- `execute_nba`
- `draft_outreach`
- `update_lead`
- `update_proposal`
- `update_delivery_project`
- `manage_deal`
- `send_operator_alert`
- `schedule_content_post`
- `delegate_to_agent`
