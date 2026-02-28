"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildProposalContentFromSections,
  getSnippetCharCount,
  parseProposalSections,
  UPWORK_SNIPPET_MAX,
  type ProposalSections,
} from "@/lib/proposals/sections";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { fetchJsonThrow } from "@/lib/http/fetch-json";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const toastFn = (m: string, t?: "success" | "error") => t === "error" ? toast.error(m) : toast.success(m);

type Artifact = {
  id: string;
  leadId: string;
  title: string;
  content: string;
  meta: unknown;
  updatedAt: string;
};

type Props = {
  artifact: Artifact;
  onSaved?: (artifact: Artifact) => void;
};

export default function ProposalConsoleEditor({ artifact, onSaved }: Props) {
  const initialSections = useMemo(
    () => parseProposalSections(artifact.content ?? ""),
    [artifact.content]
  );

  const [sections, setSections] = useState<ProposalSections>(initialSections);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const meta = (artifact.meta ?? {}) as Record<string, unknown>;
  const proposalUi = (meta.proposalUi ?? meta.proposal ?? {}) as Record<string, unknown>;

  const [readyToSend, setReadyToSend] = useState<boolean>(!!proposalUi.readyToSend);
  const [sentOnUpwork, setSentOnUpwork] = useState<boolean>(!!proposalUi.sentOnUpwork);

  const debouncedSections = useDebouncedValue(sections, 400);

  const upworkCount = getSnippetCharCount(sections.upworkSnippet);
  const overLimit = upworkCount > UPWORK_SNIPPET_MAX;

  const metaUpdatedAt = (meta.updatedAt ?? proposalUi.updatedAt) as string | undefined;

  function showStatus(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2500);
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
  }

  const { execute: doSaveAll, pending: savingAll } = useAsyncAction(
    async (next?: Partial<ProposalSections>) => {
      const merged: ProposalSections = {
        ...debouncedSections,
        ...(next ?? {}),
      };
      const content = buildProposalContentFromSections(merged);
      const updated = await fetchJsonThrow<Artifact>(`/api/artifacts/${artifact.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          content,
          meta: {
            ...meta,
            updatedAt: new Date().toISOString(),
            snippetCharCount: getSnippetCharCount(merged.upworkSnippet),
            proposalUi: {
              readyToSend,
              sentOnUpwork,
              upworkSnippetChars: getSnippetCharCount(merged.upworkSnippet),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
      setSections(merged);
      return updated;
    },
    {
      toast: toastFn,
      successMessage: "Saved",
      onSuccess: (updated) => {
        showStatus("Saved");
        onSaved?.(updated);
      },
      onError: (msg) => showStatus(msg),
    }
  );

  const { execute: doSaveToggles, pending: savingToggles } = useAsyncAction(
    async (nextReady: boolean, nextSent: boolean) => {
      const updated = await fetchJsonThrow<Artifact>(`/api/artifacts/${artifact.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          meta: {
            ...meta,
            updatedAt: new Date().toISOString(),
            snippetCharCount: getSnippetCharCount(sections.upworkSnippet),
            proposalUi: {
              readyToSend: nextReady,
              sentOnUpwork: nextSent,
              upworkSnippetChars: getSnippetCharCount(sections.upworkSnippet),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
      setReadyToSend(nextReady);
      setSentOnUpwork(nextSent);
      return updated;
    },
    {
      toast: toastFn,
      successMessage: "Saved",
      onSuccess: (updated) => {
        showStatus("Saved");
        onSaved?.(updated);
      },
      onError: (msg) => showStatus(msg),
    }
  );

  const saving = savingAll || savingToggles;

  return (
    <div className="space-y-6">
      {/* Header + Save + Toggles */}
      <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-500 uppercase tracking-wider">Proposal artifact</div>
          <div className="font-medium text-neutral-200">{artifact.title || "Proposal"}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {metaUpdatedAt
              ? `Last edited: ${new Date(metaUpdatedAt).toLocaleString("en-US")}`
              : `Created: ${new Date(artifact.updatedAt).toLocaleString("en-US")}`}
          </div>
        </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => doSaveAll()}
              disabled={saving}
              className="border-neutral-600 text-neutral-200 hover:bg-neutral-800"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            {status ? <span className="text-sm text-neutral-400">{status}</span> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={readyToSend}
              onChange={(e) => {
                const next = e.target.checked;
                setReadyToSend(next);
                void doSaveToggles(next, sentOnUpwork);
              }}
              disabled={saving}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Ready to send
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sentOnUpwork}
              onChange={(e) => {
                const next = e.target.checked;
                setSentOnUpwork(next);
                void doSaveToggles(readyToSend, next);
              }}
              disabled={saving}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Sent on Upwork
          </label>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Human guardrail: this page tracks state only. It does not auto-send.
        </p>
      </div>

      {/* Opening */}
      <section className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Opening</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-400 hover:text-white h-8"
            onClick={() => copyToClipboard(sections.opening, "opening")}
          >
            {copied === "opening" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy
          </Button>
        </div>
        <textarea
          value={sections.opening}
          onChange={(e) => setSections((s) => ({ ...s, opening: e.target.value }))}
          rows={6}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
          placeholder="Opening message to the client…"
        />
      </section>

      {/* Upwork Snippet */}
      <section className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Upwork Snippet</h2>
          <div className={`text-xs ${overLimit ? "text-amber-400" : "text-neutral-500"}`}>
            {upworkCount} / {UPWORK_SNIPPET_MAX}
          </div>
        </div>
        <textarea
          value={sections.upworkSnippet}
          onChange={(e) => setSections((s) => ({ ...s, upworkSnippet: e.target.value }))}
          rows={4}
          className={`w-full rounded-lg border p-3 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 bg-neutral-900 ${
            overLimit ? "border-amber-600" : "border-neutral-700"
          }`}
          placeholder="Short Upwork message (keep under 600 chars)"
        />
        {overLimit ? (
          <div className="text-xs text-amber-400">Over 600 characters. Trim before sending.</div>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-neutral-400 hover:text-white -mt-1"
          onClick={() => copyToClipboard(sections.upworkSnippet, "upwork")}
        >
          {copied === "upwork" ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
          Copy Upwork Snippet
        </Button>
      </section>

      {/* Questions */}
      <section className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Questions Before Starting</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-400 hover:text-white h-8"
            onClick={() => copyToClipboard(sections.questions, "questions")}
          >
            {copied === "questions" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy
          </Button>
        </div>
        <textarea
          value={sections.questions}
          onChange={(e) => setSections((s) => ({ ...s, questions: e.target.value }))}
          rows={6}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
          placeholder="Qualification / discovery questions…"
        />
      </section>

      {/* Preview */}
      <section className="rounded-lg border border-neutral-800 p-4 bg-neutral-900/30">
        <div className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-2">Preview (saved markdown)</div>
        <pre className="whitespace-pre-wrap text-xs rounded-lg border border-neutral-800 p-3 bg-neutral-950 text-neutral-400 overflow-auto max-h-48">
          {buildProposalContentFromSections(sections)}
        </pre>
      </section>
    </div>
  );
}
