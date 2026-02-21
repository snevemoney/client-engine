"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Copy, Check, Loader2 } from "lucide-react";

interface Lead {
  id: string;
  title: string;
  status: string;
}

interface ProofArtifact {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  lead: { id: string; title: string };
}

export default function ProofPage() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [proofPosts, setProofPosts] = useState<ProofArtifact[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ content: string; artifactId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const didAutoGenerate = useRef(false);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.ok) {
      const data = await res.json();
      setLeads(data);
      if (data.length && !selectedLeadId) setSelectedLeadId(data[0].id);
    }
  }, [selectedLeadId]);

  const fetchProofPosts = useCallback(async () => {
    const res = await fetch("/api/proof");
    if (res.ok) {
      const data = await res.json();
      setProofPosts(data);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchProofPosts();
  }, [fetchLeads, fetchProofPosts]);

  // URL trigger for browser automation: ?generate=1 runs generate once when a lead is selected
  useEffect(() => {
    if (didAutoGenerate.current || !searchParams.get("generate") || !selectedLeadId) return;
    didAutoGenerate.current = true;
    (async () => {
      setGenerating(true);
      setLastGenerated(null);
      try {
        const res = await fetch("/api/proof/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: selectedLeadId }),
        });
        if (res.ok) {
          const data = await res.json();
          setLastGenerated({ content: data.content, artifactId: data.artifactId });
          fetchProofPosts();
        }
      } finally {
        setGenerating(false);
      }
    })();
  }, [selectedLeadId, searchParams, fetchProofPosts]);

  async function generate() {
    if (!selectedLeadId) return;
    setGenerating(true);
    setLastGenerated(null);
    try {
      const res = await fetch("/api/proof/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLeadId }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastGenerated({ content: data.content, artifactId: data.artifactId });
        fetchProofPosts();
      } else {
        const err = await res.json();
        alert(err.error || "Generate failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  function copyContent(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayContent = lastGenerated?.content ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quiet Proof</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Generate daily proof posts from real pipeline artifacts. No hype, no invented numbers.
        </p>
      </div>

      <section className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-4">Generate proof post</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-xs text-neutral-500 mb-1">Lead</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              <option value="">Select a lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title.slice(0, 60)}{l.title.length > 60 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>
          <Button
            data-testid="proof-generate-btn"
            onClick={generate}
            disabled={generating || !selectedLeadId}
            className="gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate
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

      {proofPosts.length > 0 && (
        <section className="border border-neutral-800 rounded-lg overflow-hidden">
          <h2 className="text-sm font-medium text-neutral-300 px-6 py-3 border-b border-neutral-800">Recent proof posts</h2>
          <ul className="divide-y divide-neutral-800">
            {proofPosts.slice(0, 15).map((a) => (
              <li key={a.id} className="px-6 py-3 hover:bg-neutral-900/30">
                <Link href={`/dashboard/leads/${a.lead.id}`} className="block">
                  <div className="text-sm text-neutral-200">{a.lead.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {new Date(a.createdAt).toLocaleString()}
                  </div>
                </Link>
                <pre className="mt-2 text-xs text-neutral-400 whitespace-pre-wrap font-sans line-clamp-3">{a.content}</pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1 text-neutral-400"
                  onClick={(e) => {
                    e.preventDefault();
                    copyContent(a.content);
                  }}
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
