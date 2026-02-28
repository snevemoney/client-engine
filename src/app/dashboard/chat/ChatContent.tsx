"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type SuggestedAction =
  | { type: "link"; label: string; href: string }
  | {
      type: "executable";
      action: string;
      label: string;
      reason?: string;
      risk?: "low" | "medium" | "high";
      requiresApproval: boolean;
    };

type StructuredReply = {
  answer: string;
  data_gaps?: string[];
  sources_used?: string[];
  confidence?: "high" | "medium" | "low";
  suggested_actions?: SuggestedAction[];
};

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; reply?: StructuredReply; error?: boolean };

const QUICK_ACTIONS = [
  { label: "Command Center", href: "/dashboard/command" },
  { label: "Metrics", href: "/dashboard/metrics" },
  { label: "Proof", href: "/dashboard/proof" },
  { label: "Checklist", href: "/dashboard/checklist" },
];

const EXECUTABLE_ACTIONS = ["retry_failed_pipeline_runs"] as const;

function isExecutableAction(action: string): boolean {
  return (EXECUTABLE_ACTIONS as readonly string[]).includes(action);
}

export default function ChatContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const debouncedInput = useDebouncedValue(input, 200);
  const [loading, setLoading] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const { confirm, dialogProps } = useConfirmDialog();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = debouncedInput.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const reply = data.reply as StructuredReply;
      setMessages((m) => [...m, { role: "assistant", reply }]);
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

  async function executeAction(action: string) {
    if (executingAction || !isExecutableAction(action)) return;
    const ok = await confirm({
      title: "Execute action?",
      body: `This will run "${action}". Proceed?`,
      variant: "destructive",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setExecutingAction(action);
    try {
      const res = await fetch("/api/ops/chat/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Execution failed");
      const resultSummary = data.resultSummary ?? "Done.";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          reply: {
            answer: `**Action completed.** ${resultSummary}`,
            suggested_actions: [],
          },
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Execution error: ${e instanceof Error ? e.message : "Unknown"}`,
          error: true,
        },
      ]);
    } finally {
      setExecutingAction(null);
    }
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Operator chat</h1>
          <span className="rounded border border-emerald-600/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400/90">
            Unlimited
          </span>
        </div>
        <p className="text-sm text-neutral-400 mt-1">
          Ask anything about your business. Uses live brief, metrics, leads, proof, and learning. Suggested actions require your approval.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="rounded border border-neutral-700/80 px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 border border-neutral-800 rounded-lg flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500">
              Type your question below. The AI uses your live brief, metrics, leads, proof, and learning to answer.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user" ? "text-right" : "text-left"
              }
            >
              {msg.role === "user" ? (
                <span className="inline-block rounded-lg bg-neutral-700 px-3 py-2 text-sm text-neutral-100">
                  {msg.content}
                </span>
              ) : "reply" in msg && msg.reply ? (
                <div className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 max-w-[95%] space-y-2 text-left">
                  <div className="prose prose-invert prose-sm max-w-none">
                    {msg.reply.answer.split("\n").map((line, j) => (
                      <p key={j} className="mb-1 last:mb-0">
                        {line}
                      </p>
                    ))}
                  </div>
                  {msg.reply.data_gaps && msg.reply.data_gaps.length > 0 && (
                    <p className="text-amber-400/90 text-xs">
                      Data missing: {msg.reply.data_gaps.join("; ")}
                    </p>
                  )}
                  {msg.reply.sources_used && msg.reply.sources_used.length > 0 && (
                    <p className="text-neutral-500 text-xs">
                      Based on: {msg.reply.sources_used.join(", ")}
                    </p>
                  )}
                  {msg.reply.confidence && (
                    <p className="text-neutral-500 text-xs">
                      Confidence: {msg.reply.confidence}
                    </p>
                  )}
                  {msg.reply.suggested_actions && msg.reply.suggested_actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-700 mt-2">
                      {msg.reply.suggested_actions.map((sa, k) =>
                        sa.type === "link" ? (
                          <Link
                            key={k}
                            href={sa.href}
                            className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
                          >
                            {sa.label}
                          </Link>
                        ) : isExecutableAction(sa.action) ? (
                          <div
                            key={k}
                            className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs bg-neutral-700/50"
                          >
                            <span className="text-neutral-200">{sa.label}</span>
                            {sa.reason && (
                              <p className="text-neutral-500 mt-0.5">{sa.reason}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => executeAction(sa.action)}
                              disabled={executingAction !== null}
                              className="mt-1.5 rounded bg-neutral-100 text-neutral-900 px-2 py-1 text-xs font-medium hover:bg-neutral-200 disabled:opacity-50"
                            >
                              {executingAction === sa.action ? "Running…" : "Approve"}
                            </button>
                          </div>
                        ) : (
                          <Link
                            key={k}
                            href="/dashboard/metrics"
                            className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
                          >
                            {sa.label}
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
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
          <div ref={bottomRef} />
        </div>
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
            placeholder="Ask anything about your business…"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
