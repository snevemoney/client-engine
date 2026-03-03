# ADR-005: Agent Approval Gates for Write Tools

## Status: Accepted

## Context
The multi-agent system has 10 autonomous workers running on cron schedules. These agents can call the same 25 tools as the Brain. Without gates, an agent could update leads, send alerts, or modify proposals without human oversight.

The core philosophy is: "The AI proposes, the human decides."

## Decision
All write tools require an `AgentApproval` record when called by agents. The operator must explicitly approve or reject within 24 hours.

**Mechanics:**
- `requiresApproval(config, toolName)` checks if tool is in the write set and not auto-approved.
- Before executing a write tool, `createApprovalRequest()` creates an `AgentApproval` record.
- Operator is notified via in-app notification.
- Operator approves or rejects at `/dashboard/operator/agents`.
- Approved: tool executes. Rejected: recorded, weight penalty (-0.5 rule, -1.0 action).
- `expireStaleApprovals()` expires unanswered approvals after 24 hours.
- `reapStaleRuns()` terminates agent runs that have been waiting too long.

**Exceptions:**
- Each agent config has `autoApprovedTools` — read-heavy tools that skip approval.
- Brain (direct operator chat) does NOT use approval gates — the operator is already present.

## Consequences
- Agents cannot take destructive actions without human confirmation.
- Latency: write actions may wait up to 24h for approval (acceptable for background tasks).
- Operator must check approval queue regularly (notifications help).
- Circuit breaker: agents stop after 2 consecutive tool failures, preventing runaway approval spam.
