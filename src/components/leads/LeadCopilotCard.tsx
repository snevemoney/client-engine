"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CopilotResponse = {
  verdict: string;
  nextMove: string;
  riskType: "TRUST" | "TECHNICAL" | "MIXED";
  whoNeedsToFeelSafe: { stakeholder: string; why: string; safetyNeed: string }[];
  why: string[];
  risks: string[];
  safeguards: string[];
  questionsToAskNext?: string[];
  suggestedMessage?: string;
  receipts: { source: string; note: string }[];
  uncertainty?: string;
};

const PRESETS = [
  { label: "Least risky next move", question: "What is the least risky next move for this lead?" },
  { label: "Trust vs technical?", question: "Is this mainly a trust issue or technical issue?" },
  { label: "What to ask before proposal?", question: "What should I ask before I send a proposal?" },
  { label: "More reversible", question: "Make the next step more reversible." },
  { label: "Who needs to feel safe?", question: "Who needs to feel safe before this closes?" },
  { label: "Rewrite next message", question: "Rewrite my next message to reduce risk and increase trust." },
] as const;

export function LeadCopilotCard({ leadId }: { leadId: string }) {
  const [question, setQuestion] = useState<string>(PRESETS[0].question);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function askCopilot() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Copilot failed");

      setResult(data as CopilotResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Lead Copilot
        </h3>
        <span className="text-xs text-neutral-600">Rubric-based</span>
      </div>

      <textarea
        className="w-full min-h-[88px] rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 p-2 text-sm placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask: What should I send? Is this trust or technical risk? Who needs to feel safe?"
      />

      <div className="flex flex-wrap gap-2 mt-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white text-xs"
            onClick={() => setQuestion(p.question)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-3 border-neutral-600 text-neutral-200 hover:bg-neutral-800"
        onClick={askCopilot}
        disabled={loading || !question.trim()}
      >
        {loading ? "Thinking…" : "Ask Copilot"}
      </Button>

      {error && <p className="text-sm text-amber-400 mt-2">{error}</p>}

      {result && (
        <div className="mt-4 pt-4 border-t border-neutral-800 space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Verdict</div>
            <p className="text-neutral-200 whitespace-pre-wrap">{result.verdict}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Next move</div>
            <p className="text-neutral-200">{result.nextMove}</p>
          </div>
          {result.riskType && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Risk type</div>
              <p className="text-neutral-200">{result.riskType}</p>
            </div>
          )}
          {result.whoNeedsToFeelSafe?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Who needs to feel safe</div>
              <ul className="list-disc ml-5 text-neutral-300 space-y-0.5">
                {result.whoNeedsToFeelSafe.map((s, i) => (
                  <li key={i}>
                    <strong className="text-neutral-200">{s.stakeholder}</strong> — {s.safetyNeed}
                    {s.why ? ` (${s.why})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.why?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Why</div>
              <ul className="list-disc ml-5 text-neutral-300 space-y-0.5">
                {result.why.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.risks?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Risks</div>
              <ul className="list-disc ml-5 text-neutral-300 space-y-0.5">
                {result.risks.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.safeguards?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Safeguards</div>
              <ul className="list-disc ml-5 text-neutral-300 space-y-0.5">
                {result.safeguards.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {(result.questionsToAskNext?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Questions to ask next</div>
              <ul className="list-disc ml-5 text-neutral-300 space-y-0.5">
                {(result.questionsToAskNext ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {result.suggestedMessage && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Suggested message</div>
              <pre className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-400 overflow-x-auto">
                {result.suggestedMessage}
              </pre>
            </div>
          )}
          {result.receipts?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Receipts</div>
              <ul className="list-disc ml-5 text-neutral-400 space-y-0.5 text-xs">
                {result.receipts.map((r, i) => (
                  <li key={i}>
                    <strong className="text-neutral-300">{r.source}:</strong> {r.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.uncertainty && (
            <div className="text-xs text-neutral-500">
              <strong>Uncertainty:</strong> {result.uncertainty}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
