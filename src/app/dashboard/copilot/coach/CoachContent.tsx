"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useIntelligenceContext } from "@/hooks/useIntelligenceContext";
import { IntelligenceBanner } from "@/components/dashboard/IntelligenceBanner";

type CTA = {
  label: string;
  actionKey: string;
  modeDefault: "preview" | "execute";
  requiresConfirm: boolean;
  payload?: { nextActionId?: string; nbaActionKey?: string };
};

type CoachSource =
  | { kind: "score_snapshot"; id: string; createdAt: string }
  | { kind: "risk_flag"; id: string; ruleKey: string }
  | { kind: "next_action"; id: string; ruleKey: string; dedupeKey: string }
  | { kind: "api"; route: string; at: string };

type TopAction = {
  title: string;
  actionKey: string;
  nextActionId?: string;
  why: string;
  evidence: string[];
  sources?: CoachSource[];
  cta?: CTA;
};

type CoachReply = {
  status: string;
  diagnosis: string;
  topActions: TopAction[];
  risksOrUnknowns: string[];
  suggestedCommands: string[];
};

type CoachResponse = {
  reply: CoachReply;
  sources: {
    score: { latest: string; recentEvents: unknown[] };
    risk: { summary: string; top: unknown[] };
    nba: { summary: string; top: unknown[] };
  };
};

type ActionResult = {
  ok: boolean;
  preview?: { summary: string; steps: string[]; warnings: string[] };
  execution?: { resultSummary: string; errors: string[] };
  before?: ContextSnapshot;
  after?: ContextSnapshot;
};

type Message = {
  role: "user" | "assistant";
  content?: string;
  reply?: CoachResponse;
  actionResult?: ActionResult;
  error?: boolean;
};

type ContextSnapshot = {
  score: string;
  risk: string;
  nba: string;
  fetchedAt: string | null;
};

const PRESETS = [
  "What should I do today?",
  "What's the status?",
  "What are the top risks?",
  "What next actions should I prioritize?",
];

export default function CoachContent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [preview, setPreview] = useState<{
    cta: CTA;
    result: ActionResult;
  } | null>(null);
  const intel = useIntelligenceContext();
  const [context, setContext] = useState<ContextSnapshot>({
    score: "—",
    risk: "—",
    nba: "—",
    fetchedAt: null,
  });
  const [contextLoading, setContextLoading] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();
  const contextAbortRef = useRef<AbortController | null>(null);

  const fetchContext = useCallback(async () => {
    if (contextAbortRef.current) contextAbortRef.current.abort();
    const controller = new AbortController();
    contextAbortRef.current = controller;
    setContextLoading(true);
    try {
      const [scoreRes, riskRes, nbaRes] = await Promise.all([
        fetch("/api/internal/scores/summary?entityType=command_center&entityId=command_center", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch("/api/risk/summary", { credentials: "include", cache: "no-store", signal: controller.signal }),
        fetch("/api/next-actions/summary?entityType=command_center&entityId=command_center", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) return;

      const scoreData = scoreRes.ok ? await scoreRes.json() : null;
      const riskData = riskRes.ok ? await riskRes.json() : null;
      const nbaData = nbaRes.ok ? await nbaRes.json() : null;

      if (controller.signal.aborted) return;

      const scoreStr = scoreData?.latest
        ? `Score ${scoreData.latest.score} (${scoreData.latest.band})`
        : "No score";
      const riskStr = riskData?.openBySeverity
        ? `Open: ${(riskData.openBySeverity.critical ?? 0) + (riskData.openBySeverity.high ?? 0)} critical/high`
        : "—";
      const nbaStr = nbaData?.queuedByPriority
        ? `Queued: ${(nbaData.queuedByPriority.critical ?? 0) + (nbaData.queuedByPriority.high ?? 0) + (nbaData.queuedByPriority.medium ?? 0) + (nbaData.queuedByPriority.low ?? 0)}`
        : "—";

      setContext({
        score: scoreStr,
        risk: riskStr,
        nba: nbaStr,
        fetchedAt: new Date().toISOString(),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      setContext((c) => ({ ...c, fetchedAt: c.fetchedAt }));
    } finally {
      if (!controller.signal.aborted) {
        setContextLoading(false);
        contextAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void fetchContext();
    return () => {
      if (contextAbortRef.current) contextAbortRef.current.abort();
    };
  }, [fetchContext]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/internal/copilot/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          entityType: "command_center",
          entityId: "command_center",
          ...(sessionId && { sessionId }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.sessionId) setSessionId(data.sessionId);
      const reply = data.sessionId ? { ...data, sessionId: undefined } : data;
      setMessages((m) => [...m, { role: "assistant", reply }]);
      void fetchContext();
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCtaClick(cta: CTA) {
    if (actionLoading || !sessionId) return;
    if (cta.requiresConfirm) {
      const ok = await confirm({
        title: `Execute: ${cta.label}?`,
        body: "This action will modify your data. Proceed?",
        variant: "destructive",
        confirmLabel: "Execute",
      });
      if (!ok) return;
    }
    setActionLoading(true);
    setPreview(null);
    try {
      const body: Record<string, unknown> = {
        actionKey: cta.actionKey,
        mode: cta.requiresConfirm ? "preview" : "execute",
        entityType: "command_center",
        entityId: "command_center",
        sessionId,
      };
      if (cta.payload?.nextActionId) body.nextActionId = cta.payload.nextActionId;
      if (cta.payload?.nbaActionKey) body.nbaActionKey = cta.payload.nbaActionKey;

      const res = await fetch("/api/internal/copilot/coach/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const result: ActionResult = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Action failed");

      if (cta.requiresConfirm && result.preview) {
        setPreview({ cta, result });
      } else {
        setMessages((m) => [...m, { role: "assistant", actionResult: result }]);
        void fetchContext();
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
          error: true,
        },
      ]);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmExecute() {
    if (!preview || actionLoading || !sessionId) return;
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = {
        actionKey: preview.cta.actionKey,
        mode: "execute",
        entityType: "command_center",
        entityId: "command_center",
        sessionId,
      };
      if (preview.cta.payload?.nextActionId) body.nextActionId = preview.cta.payload.nextActionId;
      if (preview.cta.payload?.nbaActionKey) body.nbaActionKey = preview.cta.payload.nbaActionKey;

      const res = await fetch("/api/internal/copilot/coach/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const result: ActionResult = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Execute failed");

      setMessages((m) => [...m, { role: "assistant", actionResult: result }]);
      setPreview(null);
      void fetchContext();
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Unknown"}`,
          error: true,
        },
      ]);
      setPreview(null);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach Mode</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Tool-backed guidance. No guessing. Every recommendation cites evidence from scores, risks, and next actions.
        </p>
      </div>
      <IntelligenceBanner risk={intel.risk} nba={intel.nba} score={intel.score} loading={intel.loading} />

      <div className="flex gap-4 flex-1 min-h-0">
        <div
          className="w-52 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 space-y-2"
          data-testid="coach-context-panel"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 uppercase">Context</span>
            <button
              type="button"
              onClick={() => void fetchContext()}
              disabled={contextLoading}
              className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
              data-testid="coach-refresh-context"
            >
              {contextLoading ? "…" : "Refresh"}
            </button>
          </div>
          <div className="text-xs space-y-1.5">
            <p className="text-neutral-400">
              <span className="text-neutral-500">Score:</span> {context.score}
            </p>
            <p className="text-neutral-400">
              <span className="text-neutral-500">Risks:</span> {context.risk}
            </p>
            <p className="text-neutral-400">
              <span className="text-neutral-500">NBA:</span> {context.nba}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 pt-2 border-t border-neutral-800">
            <Link
              href="/dashboard/copilot/sessions"
              className="text-xs text-amber-400 hover:underline"
            >
              Sessions
            </Link>
            <Link
              href="/dashboard/scoreboard"
              className="text-xs text-amber-400 hover:underline"
            >
              Scoreboard
            </Link>
            <Link href="/dashboard/risk" className="text-xs text-amber-400 hover:underline">
              Risk
            </Link>
            <Link href="/dashboard/next-actions" className="text-xs text-amber-400 hover:underline">
              Next Actions
            </Link>
          </div>
        </div>

        <div className="flex-1 border border-neutral-800 rounded-lg flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-neutral-500">Ask for actionable guidance:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                {msg.role === "user" ? (
                  <span className="inline-block rounded-lg bg-neutral-700 px-3 py-2 text-sm text-neutral-100">
                    {msg.content}
                  </span>
                ) : msg.reply ? (
                  <CoachReplyBlock reply={msg.reply} onCtaClick={handleCtaClick} disabled={actionLoading} />
                ) : msg.actionResult ? (
                  <ActionResultBlock result={msg.actionResult} />
                ) : (
                  <span
                    className={
                      msg.error
                        ? "inline-block rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-200"
                        : "inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
                    }
                  >
                    {msg.content}
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-left">
                <span className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-500">
                  …
                </span>
              </div>
            )}
          </div>
          {preview && (
            <div
              className="border-t border-amber-500/30 bg-amber-950/20 p-3 space-y-2"
              data-testid="coach-preview-card"
            >
              <p className="text-sm font-medium text-amber-400/90">{preview.result.preview?.summary}</p>
              {preview.result.preview?.steps?.length ? (
                <ul className="text-xs text-neutral-400 list-disc list-inside">
                  {preview.result.preview.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {preview.result.preview?.warnings?.length ? (
                <p className="text-amber-400/80 text-xs">
                  Warnings: {preview.result.preview.warnings.join("; ")}
                </p>
              ) : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={confirmExecute}
                  disabled={actionLoading}
                  className="rounded-md bg-amber-500 text-neutral-900 px-3 py-1.5 text-sm font-medium hover:bg-amber-400 disabled:opacity-50"
                  data-testid="coach-confirm-execute"
                >
                  {actionLoading ? "Running…" : "Confirm & Execute"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-md border border-neutral-600 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <form
            className="border-t border-neutral-800 p-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask: what should I do today?"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
              disabled={loading}
              data-testid="coach-input"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
              data-testid="coach-send"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

function CoachReplyBlock({
  reply,
  onCtaClick,
  disabled,
}: {
  reply: CoachResponse;
  onCtaClick: (cta: CTA) => void;
  disabled?: boolean;
}) {
  const { status, diagnosis, topActions, risksOrUnknowns, suggestedCommands } = reply.reply;
  return (
    <div
      className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 max-w-[95%] space-y-2 text-left"
      data-testid="coach-reply"
    >
      <p className="font-medium text-amber-400/90">{status}</p>
      <p>{diagnosis}</p>
      {topActions.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 uppercase mb-1">Top 3 Next Actions</p>
          <ul className="space-y-1.5">
            {topActions.map((a, i) => (
              <li key={i} className="border-l-2 border-amber-500/30 pl-2">
                <span className="font-medium">{a.title}</span>
                <p className="text-neutral-400 text-xs">{a.why}</p>
                {a.evidence?.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-neutral-500 text-xs cursor-pointer hover:text-neutral-400">
                      Evidence
                    </summary>
                    <p className="text-neutral-500 text-xs mt-0.5 pl-2">
                      {a.evidence.join("; ")}
                    </p>
                    {a.sources && a.sources.length > 0 && (
                      <p className="text-neutral-600 text-xs mt-0.5 pl-2">
                        Sources: {a.sources.map((s) => `${s.kind}:${"id" in s ? String(s.id) : "route" in s ? s.route : "—"}`).join(", ")}
                      </p>
                    )}
                  </details>
                )}
                {a.cta && (
                  <button
                    type="button"
                    onClick={() => onCtaClick(a.cta!)}
                    disabled={disabled}
                    className="mt-1.5 rounded bg-amber-500/20 text-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-500/30 disabled:opacity-50"
                    data-testid={`coach-cta-${a.cta.actionKey}`}
                  >
                    {a.cta.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {risksOrUnknowns.length > 0 && (
        <p className="text-amber-400/80 text-xs">Risks/Unknowns: {risksOrUnknowns.join("; ")}</p>
      )}
      {suggestedCommands.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {suggestedCommands.map((cmd, i) => (
            <span key={i} className="rounded bg-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400">
              {cmd}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionResultBlock({ result }: { result: ActionResult }) {
  const ok = result.ok;
  const exec = result.execution;
  return (
    <div
      className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm max-w-[95%] space-y-2 text-left"
      data-testid="coach-action-result"
    >
      <p className={`font-medium ${ok ? "text-emerald-400/90" : "text-amber-400/90"}`}>
        {ok ? "Action completed" : "Action failed"}
      </p>
      {exec?.resultSummary && <p className="text-neutral-300">{exec.resultSummary}</p>}
      {exec?.errors?.length ? (
        <p className="text-amber-400/80 text-xs">Errors: {exec.errors.join("; ")}</p>
      ) : null}
      {result.before && result.after && (
        <div className="text-xs text-neutral-500 space-y-0.5">
          <p>Before: {result.before.score} | {result.before.risk} | {result.before.nba}</p>
          <p>After: {result.after.score} | {result.after.risk} | {result.after.nba}</p>
        </div>
      )}
    </div>
  );
}
