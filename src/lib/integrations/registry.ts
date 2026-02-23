/**
 * Integration registry: single source of truth for app integrations.
 * Used for visibility, health cards, and roadmap tracking.
 * See docs/INTEGRATION_MASTER_CHECKLIST.md for full system view.
 */

import type { Integration } from "./types";

export const INTEGRATIONS: Integration[] = [
  // --- Signal ---
  {
    key: "meta-ads",
    name: "Meta Ads",
    category: "signal",
    status: "done",
    mode: "write",
    envVars: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"],
    testStatus: "tierB",
    owner: "code",
    notes: "Dashboard, trends, recommendations, guarded actions",
  },
  {
    key: "rss-research",
    name: "RSS Research",
    category: "signal",
    status: "done",
    mode: "read",
    envVars: ["RESEARCH_FEED_URL"],
    testStatus: "tierB",
    owner: "code",
    notes: "src/lib/research/adapters/rss.ts, cron POST /api/research/run",
  },
  {
    key: "upwork-research",
    name: "Upwork Research",
    category: "signal",
    status: "partial",
    mode: "read",
    envVars: [],
    testStatus: "none",
    owner: "code",
    notes: "Adapter exists, needs API auth and full flow",
  },
  {
    key: "youtube-transcripts",
    name: "YouTube Transcripts",
    category: "signal",
    status: "partial",
    mode: "read",
    envVars: [],
    testStatus: "none",
    owner: "code",
    notes: "Ingest/transcripts partial",
  },
  // --- Lead ---
  {
    key: "leads",
    name: "Leads",
    category: "lead",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Capture, pipeline, stages, touches",
  },
  {
    key: "site-form",
    name: "Site Form",
    category: "lead",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "/api/site/leads",
  },
  {
    key: "imap-inbox",
    name: "IMAP Inbox",
    category: "lead",
    status: "partial",
    mode: "read",
    envVars: ["IMAP_*"],
    testStatus: "none",
    owner: "code",
    notes: "Email ingestion partial",
  },
  {
    key: "calendly",
    name: "Calendly",
    category: "lead",
    status: "missing",
    mode: "read",
    envVars: ["CALENDLY_*"],
    testStatus: "none",
    owner: "code",
    notes: "Track booked calls, no-show, conversion",
  },
  // --- Execution ---
  {
    key: "proposals",
    name: "Proposals",
    category: "execution",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Draft, assist, pipeline; send via mailto/manual",
  },
  {
    key: "meta-ads-actions",
    name: "Meta Ads Actions",
    category: "execution",
    status: "done",
    mode: "write",
    envVars: ["META_ADS_ACCESS_TOKEN"],
    testStatus: "tierB",
    owner: "code",
    notes: "Guarded actions, dry-run, audit",
  },
  {
    key: "build-ops",
    name: "Build Ops",
    category: "execution",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Build triggers, deploy flows",
  },
  {
    key: "deploys",
    name: "Deploys",
    category: "execution",
    status: "done",
    mode: "read",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Deploy status, scripts",
  },
  {
    key: "notifications",
    name: "Notifications / Webhooks",
    category: "execution",
    status: "partial",
    mode: "write",
    envVars: [],
    testStatus: "none",
    owner: "code",
    notes: "Basic webhooks; Slack/Discord missing",
  },
  // --- Proof ---
  {
    key: "proof",
    name: "Proof / Results",
    category: "proof",
    status: "partial",
    mode: "write",
    envVars: [],
    testStatus: "none",
    owner: "code",
    notes: "Results ledger, proof pages; case study capture partial",
  },
  {
    key: "knowledge",
    name: "Knowledge",
    category: "proof",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Ingest, suggestions, RAG",
  },
  // --- Operator ---
  {
    key: "command-center",
    name: "Command Center",
    category: "operator",
    status: "done",
    mode: "read",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Dashboard, cards, runday",
  },
  {
    key: "ops-health",
    name: "Ops Health",
    category: "operator",
    status: "done",
    mode: "read",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Workday run, failures, integration health",
  },
  {
    key: "metrics",
    name: "Metrics",
    category: "operator",
    status: "done",
    mode: "read",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Revenue, pipeline, conversion visibility",
  },
  {
    key: "learning",
    name: "Learning",
    category: "operator",
    status: "done",
    mode: "read",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Learning log, patterns",
  },
  {
    key: "chat",
    name: "Ops Chat / Copilot",
    category: "operator",
    status: "done",
    mode: "write",
    envVars: [],
    testStatus: "tierB",
    owner: "code",
    notes: "Chat, execute actions, retry",
  },
];

export function getIntegrationsByCategory(
  category: Integration["category"]
): Integration[] {
  return INTEGRATIONS.filter((i) => i.category === category);
}

export function getIntegrationsByStatus(
  status: Integration["status"]
): Integration[] {
  return INTEGRATIONS.filter((i) => i.status === status);
}

export function getIntegrationSummary(): {
  total: number;
  done: number;
  partial: number;
  missing: number;
  backlog: number;
  read: number;
  write: number;
} {
  const done = INTEGRATIONS.filter((i) => i.status === "done").length;
  const partial = INTEGRATIONS.filter((i) => i.status === "partial").length;
  const missing = INTEGRATIONS.filter((i) => i.status === "missing").length;
  const backlog = INTEGRATIONS.filter((i) => i.status === "backlog").length;
  const read = INTEGRATIONS.filter((i) => i.mode === "read").length;
  const write = INTEGRATIONS.filter((i) => i.mode === "write").length;
  return {
    total: INTEGRATIONS.length,
    done,
    partial,
    missing,
    backlog,
    read,
    write,
  };
}
