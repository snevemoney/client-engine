"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "Run research / workday", href: "/dashboard/command" },
  { label: "Metrics (retry failed)", href: "/dashboard/metrics" },
  { label: "Proof post", href: "/dashboard/proof" },
  { label: "Checklist", href: "/dashboard/checklist" },
];

const PREBAKED_PROMPTS = [
  "What happened today?",
  "What is the bottleneck?",
  "What should I do first?",
  "Which leads are strongest?",
  "Where am I leaking money?",
  "What should I post as proof today?",
  "What should I fix before turning up lead volume?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
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
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operator chat</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Ask: what happened today, best leads, bottleneck, what to do next. Uses live brief + constraint data.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 border border-neutral-800 rounded-lg flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">Ask operator-grade questions (uses live brief, constraint, money scorecard, ROI, learning):</p>
              <div className="flex flex-wrap gap-1.5">
                {PREBAKED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                    }}
                    className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "text-right"
                  : "text-left"
              }
            >
              <span
                className={
                  msg.role === "user"
                    ? "inline-block rounded-lg bg-neutral-700 px-3 py-2 text-sm text-neutral-100"
                    : "inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
                }
              >
                {msg.content}
              </span>
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
            placeholder="Ask about today, leads, bottleneck, next steps…"
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
    </div>
  );
}
