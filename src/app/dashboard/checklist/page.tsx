"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Copy, Check, Loader2 } from "lucide-react";

interface ChecklistArtifact {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  meta?: { keywords?: string[] };
}

export default function ChecklistPage() {
  const [checklists, setChecklists] = useState<ChecklistArtifact[]>([]);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ content: string; artifactId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchChecklists = useCallback(async () => {
    try {
      const res = await fetch("/api/checklist");
      if (res.ok) {
        const data = await res.json();
        setChecklists(data);
      }
    } catch {
      /* non-critical: recent checklists list won't load */
    }
  }, []);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  async function requestChecklist() {
    setGenerating(true);
    setLastGenerated(null);
    try {
      const keywords = keywordsInput
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      const res = await fetch("/api/checklist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestSource: "manual",
          ...(keywords.length ? { keywords } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastGenerated({ content: data.content, artifactId: data.artifactId });
        fetchChecklists();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Generate failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const displayContent = lastGenerated?.content ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checklist</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Reusable checklist for system cleanup, tool reduction, workflow simplification. No auto-DM, no auto-email.
        </p>
      </div>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-4">Request checklist</h2>
        <p className="text-xs text-neutral-500 mb-3">
          When someone comments CHECKLIST (e.g. on a proof post), you can generate and display it here.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 max-w-md">
            <label className="block text-xs text-neutral-500 mb-1">Keywords (optional)</label>
            <Input
              placeholder="e.g. tools, onboarding"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              className="bg-neutral-900 border-neutral-700"
            />
          </div>
          <Button
            onClick={requestChecklist}
            disabled={generating}
            className="gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            Generate checklist
          </Button>
        </div>
        {displayContent && (
          <div className="mt-4 p-4 rounded-lg bg-neutral-900/50 border border-neutral-800">
            <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans">{displayContent}</pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() => copyContent(displayContent)}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </section>

      {checklists.length > 0 && (
        <section className="border border-neutral-800 rounded-lg overflow-hidden">
          <h2 className="text-sm font-medium text-neutral-300 px-6 py-3 border-b border-neutral-800">Recent checklists</h2>
          <ul className="divide-y divide-neutral-800">
            {checklists.slice(0, 15).map((a) => (
              <li key={a.id} className="px-6 py-4 hover:bg-neutral-900/30">
                <div className="text-xs text-neutral-500">
                  {new Date(a.createdAt).toLocaleString("en-US")}
                  {a.meta?.keywords?.length ? ` · ${(a.meta.keywords as string[]).join(", ")}` : ""}
                </div>
                <pre className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap font-sans line-clamp-6">{a.content}</pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1 text-neutral-400"
                  onClick={() => copyContent(a.content)}
                >
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
