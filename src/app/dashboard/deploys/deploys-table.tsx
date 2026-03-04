"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ProofEditor } from "@/components/dashboard/deploys/proof-editor";
import { OutcomeEditor } from "@/components/dashboard/deploys/outcome-editor";

type Filter = "all" | "unpaid" | "invoiced" | "paid";

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  demoUrl: string | null;
  repoUrl: string | null;
  status: string;
  paymentStatus: string | null;
  paymentAmount: number | null;
  proofHeadline: string | null;
  proofSummary: string | null;
  proofTestimonial: string | null;
  campaignTags: string[];
  proofPublishedAt: string | null;
  lead: { id: string; title: string; status: string } | null;
}

export function DeploysTable({
  projects,
  filter,
  highlightProjectId,
}: {
  projects: ProjectRow[];
  filter: Filter;
  highlightProjectId?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (highlightProjectId) {
      const el = document.getElementById(`project-${highlightProjectId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightProjectId]);

  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unpaid", label: "Unpaid" },
    { value: "invoiced", label: "Invoiced" },
    { value: "paid", label: "Paid" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {tabs.map(({ value, label }) => (
          <Link
            key={value}
            href={value === "all" ? "/dashboard/deploys" : `/dashboard/deploys?filter=${value}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === value
                ? "bg-neutral-200 text-neutral-900"
                : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left px-4 py-3 font-medium text-neutral-300">Project</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-300">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-300">Payment</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-300">Demo URL</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-300 w-32">Actions</th>
            </tr>
          </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                No projects yet. Create a project via &quot;Start Build&quot; on a lead.
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <DeployRowFragment
                key={p.id}
                project={p}
                onUpdate={() => router.refresh()}
                highlight={highlightProjectId === p.id}
              />
            ))
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentBadge({
  project,
  onUpdate,
}: {
  project: ProjectRow;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const status = project.paymentStatus ?? "unpaid";

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as "unpaid" | "invoiced" | "partial" | "paid";
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: v }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        className="rounded px-2 py-0.5 text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-200 cursor-pointer"
      >
        <option value="unpaid">Unpaid</option>
        <option value="invoiced">Invoiced</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
      {project.paymentAmount != null && project.paymentAmount > 0 && (
        <span className="text-xs text-neutral-500">
          ${Number(project.paymentAmount).toLocaleString()}
        </span>
      )}
    </div>
  );
}

function DeployRowFragment({
  project,
  onUpdate,
  highlight,
}: {
  project: ProjectRow;
  onUpdate: () => void;
  highlight?: boolean;
}) {
  const [proofOpen, setProofOpen] = useState(!!highlight);

  return (
    <>
      <DeployRow
        project={project}
        onUpdate={onUpdate}
        proofOpen={proofOpen}
        onToggleProof={() => setProofOpen((o) => !o)}
      />
      {proofOpen && (
        <tr
          className="border-b border-neutral-800/50 bg-neutral-950/50"
          id={highlight ? `project-${project.id}` : undefined}
        >
          <td colSpan={5} className="px-4 py-3">
            <div className="space-y-4">
              <ProofEditor
                project={{
                  id: project.id,
                  slug: project.slug,
                  proofHeadline: project.proofHeadline,
                  proofSummary: project.proofSummary,
                  proofTestimonial: project.proofTestimonial,
                  campaignTags: project.campaignTags ?? [],
                  proofPublishedAt: project.proofPublishedAt,
                }}
                onUpdate={onUpdate}
              />
              {(project.paymentStatus ?? "") === "paid" && (
                <OutcomeEditor projectId={project.id} onUpdate={onUpdate} />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DeployRow({
  project,
  onUpdate,
  proofOpen,
  onToggleProof,
}: {
  project: ProjectRow;
  onUpdate: () => void;
  proofOpen: boolean;
  onToggleProof: () => void;
}) {
  const [demoUrl, setDemoUrl] = useState(project.demoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveDemoUrl() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoUrl: demoUrl.trim() || null }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const demoLink = `/demos/${project.slug}`;

  return (
    <tr className="border-b border-neutral-800/50 hover:bg-neutral-900/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleProof}
            className="p-0.5 text-neutral-500 hover:text-neutral-300"
            aria-label={proofOpen ? "Collapse proof" : "Expand proof"}
          >
            {proofOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div>
            <div className="font-medium text-neutral-100">{project.name}</div>
            {project.lead && (
              <div className="text-xs text-neutral-500 mt-0.5">
                Lead: {project.lead.title.slice(0, 40)}{project.lead.title.length > 40 ? "…" : ""}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-neutral-400 text-xs">{project.slug}</code>
      </td>
      <td className="px-4 py-3">
        <PaymentBadge project={project} onUpdate={onUpdate} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://…"
            className="max-w-md h-8 text-xs font-mono bg-neutral-900 border-neutral-700"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={saveDemoUrl}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </Button>
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleProof}
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            Proof
          </button>
          <Link
            href={demoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-200 text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" /> /demos/{project.slug}
          </Link>
        </div>
      </td>
    </tr>
  );
}
