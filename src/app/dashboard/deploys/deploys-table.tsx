"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Save, Loader2 } from "lucide-react";

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  demoUrl: string | null;
  repoUrl: string | null;
  status: string;
  lead: { id: string; title: string; status: string } | null;
}

export function DeploysTable({ projects }: { projects: ProjectRow[] }) {
  if (projects.length === 0) return null;

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/50">
            <th className="text-left px-4 py-3 font-medium text-neutral-300">Project</th>
            <th className="text-left px-4 py-3 font-medium text-neutral-300">Slug</th>
            <th className="text-left px-4 py-3 font-medium text-neutral-300">Demo URL</th>
            <th className="text-left px-4 py-3 font-medium text-neutral-300 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <DeployRow key={p.id} project={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeployRow({ project }: { project: ProjectRow }) {
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
        <div className="font-medium text-neutral-100">{project.name}</div>
        {project.lead && (
          <div className="text-xs text-neutral-500 mt-0.5">
            Lead: {project.lead.title.slice(0, 40)}{project.lead.title.length > 40 ? "…" : ""}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <code className="text-neutral-400 text-xs">{project.slug}</code>
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
