"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, ExternalLink } from "lucide-react";

export interface ProofEditorProject {
  id: string;
  slug: string;
  proofHeadline: string | null;
  proofSummary: string | null;
  proofTestimonial: string | null;
  campaignTags: string[];
  proofPublishedAt: string | null;
}

export function ProofEditor({
  project,
  onUpdate,
}: {
  project: ProofEditorProject;
  onUpdate: () => void;
}) {
  const [headline, setHeadline] = useState(project.proofHeadline ?? "");
  const [summary, setSummary] = useState(project.proofSummary ?? "");
  const [testimonial, setTestimonial] = useState(project.proofTestimonial ?? "");
  const [tags, setTags] = useState(project.campaignTags?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofHeadline: headline.trim() || null,
          proofSummary: summary.trim() || null,
          proofTestimonial: testimonial.trim() || null,
          campaignTags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofPublishedAt: project.proofPublishedAt ? null : new Date().toISOString(),
        }),
      });
      if (res.ok) onUpdate();
    } finally {
      setPublishing(false);
    }
  }

  const isPublished = !!project.proofPublishedAt;

  return (
    <div className="space-y-4 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">Proof page</h3>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isPublished ? "bg-emerald-900/50 text-emerald-400" : "bg-neutral-800 text-neutral-500"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
          <a
            href={`/proof/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> /proof/{project.slug}
          </a>
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Headline (max 120 chars)</label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value.slice(0, 120))}
          placeholder="Outcome-focused headline"
          className="bg-neutral-900 border-neutral-700 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Summary</label>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="2-4 sentences: problem → what we built → result"
          rows={3}
          className="bg-neutral-900 border-neutral-700 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Testimonial (optional)</label>
        <Textarea
          value={testimonial}
          onChange={(e) => setTestimonial(e.target.value)}
          placeholder="Client quote"
          rows={2}
          className="bg-neutral-900 border-neutral-700 text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Campaign tags (comma-separated)</label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="nextjs, dashboard, local-business"
          className="bg-neutral-900 border-neutral-700 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </Button>
        <Button
          size="sm"
          variant={isPublished ? "outline" : "default"}
          onClick={togglePublish}
          disabled={publishing}
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
