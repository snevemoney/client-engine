"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { exportSessionMarkdown } from "@/lib/copilot/session-export";

type SessionSummary = {
  id: string;
  title: string | null;
  entityType: string;
  entityId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type SessionDetail = SessionSummary & {
  messages: Array<{
    id: string;
    role: string;
    contentJson: unknown;
    sourcesJson: unknown;
    createdAt: string;
  }>;
  actionLogs: Array<{
    id: string;
    actionKey: string;
    mode: string;
    status: string;
    beforeJson: unknown;
    afterJson: unknown;
    resultJson: unknown;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState<string | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listAbortRef.current = controller;
    fetch("/api/internal/copilot/sessions", { credentials: "include", signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!controller.signal.aborted) setSessions(d.sessions ?? []);
      })
      .catch((e) => {
        if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    if (detailAbortRef.current) detailAbortRef.current.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    fetch(`/api/internal/copilot/sessions/${selectedId}`, { credentials: "include", signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!controller.signal.aborted) setSelected(d);
      })
      .catch((e) => {
        if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
        if (!controller.signal.aborted) setSelected(null);
      });
    return () => controller.abort();
  }, [selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
  }

  async function handleExport() {
    if (!selected) return;
    const md = exportSessionMarkdown(
      { title: selected.title, createdAt: new Date(selected.createdAt), status: selected.status },
      selected.messages,
      selected.actionLogs
    );
    setExported(md);
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coach Sessions</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Past conversations and action logs. Export for weekly review.
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div
          className="w-64 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
          data-testid="sessions-list"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase">Sessions</span>
            <Link href="/dashboard/copilot/coach" className="text-xs text-amber-400 hover:underline">
              New
            </Link>
          </div>
          {loading ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-neutral-500">No sessions yet.</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s.id)}
                    className={`w-full text-left rounded px-2 py-1.5 text-xs truncate ${
                      selectedId === s.id ? "bg-amber-500/20 text-amber-400" : "text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    {s.title ?? new Date(s.createdAt).toLocaleDateString()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 border border-neutral-800 rounded-lg flex flex-col min-h-0 overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between p-3 border-b border-neutral-800">
                <span className="text-sm font-medium">
                  {selected.title ?? `Session ${selected.id.slice(0, 8)}`}
                </span>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                  data-testid="sessions-export"
                >
                  Export summary
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.role === "user" ? "text-right" : "text-left"}
                  >
                    {m.role === "user" ? (
                      <span className="inline-block rounded-lg bg-neutral-700 px-3 py-2 text-sm text-neutral-100">
                        {(m.contentJson as { message?: string }).message ?? "—"}
                      </span>
                    ) : (
                      <div className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm max-w-[95%] text-left">
                        {(() => {
                          const c = m.contentJson as { reply?: { diagnosis?: string }; actionResult?: unknown; summary?: string };
                          if (c.reply?.diagnosis) return <p>{c.reply.diagnosis}</p>;
                          if (c.summary) return <p>{c.summary}</p>;
                          if (c.actionResult) {
                            const ar = c.actionResult as { execution?: { resultSummary?: string } };
                            return <p>{ar.execution?.resultSummary ?? "Action completed"}</p>;
                          }
                          return <p>—</p>;
                        })()}
                      </div>
                    )}
                  </div>
                ))}
                {selected.actionLogs.filter((a) => a.mode === "execute").length > 0 && (
                  <div className="pt-4 border-t border-neutral-800">
                    <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Action logs</p>
                    {selected.actionLogs
                      .filter((a) => a.mode === "execute")
                      .map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3 mb-2"
                          data-testid="session-action-log"
                        >
                          <p className="text-sm font-medium text-amber-400/90">
                            {a.actionKey} — {a.status}
                          </p>
                          {(a.resultJson as { resultSummary?: string })?.resultSummary && (
                            <p className="text-xs text-neutral-400 mt-1">
                              {(a.resultJson as { resultSummary: string }).resultSummary}
                            </p>
                          )}
                          {a.beforeJson != null && a.afterJson != null ? (
                            <div className="text-xs text-neutral-500 mt-2 space-y-0.5">
                              <p>
                                Before: {(a.beforeJson as { score?: string }).score ?? "—"} |{" "}
                                {(a.beforeJson as { risk?: string }).risk ?? "—"} |{" "}
                                {(a.beforeJson as { nba?: string }).nba ?? "—"}
                              </p>
                              <p>
                                After: {(a.afterJson as { score?: string }).score ?? "—"} |{" "}
                                {(a.afterJson as { risk?: string }).risk ?? "—"} |{" "}
                                {(a.afterJson as { nba?: string }).nba ?? "—"}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
              Select a session
            </div>
          )}
        </div>
      </div>

      {exported && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-300">
          Copied to clipboard
        </div>
      )}
    </div>
  );
}
