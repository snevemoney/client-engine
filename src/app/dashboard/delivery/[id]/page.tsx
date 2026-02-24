"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Project = {
  id: string;
  status: string;
  title: string;
  clientName: string | null;
  company: string | null;
  summary: string | null;
  owner: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  deliveryNotes: string | null;
  qaNotes: string | null;
  handoffNotes: string | null;
  githubUrl: string | null;
  loomUrl: string | null;
  proofRequestedAt: string | null;
  proofCandidateId: string | null;
  health: string;
  milestones: { id: string; title: string; status: string }[];
  checklistItems: { id: string; category: string; label: string; isDone: boolean; isRequired: boolean }[];
  readiness: { canComplete: boolean; reasons: string[] };
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/delivery-projects/${id}`)
      .then((r) => r.json())
      .then((d) => setProject(d))
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-12 text-neutral-500">Loading…</div>;
  if (!project) return (
    <div>
      <p className="text-neutral-500">Project not found.</p>
      <Link href="/dashboard/delivery" className="text-emerald-400 hover:underline mt-2 inline-block">← Delivery</Link>
    </div>
  );

  const handleComplete = async () => {
    const res = await fetch(`/api/delivery-projects/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) window.location.reload();
    else {
      const d = await res.json();
      alert(d?.error ?? "Cannot complete");
    }
  };

  const handleCreateProof = async () => {
    const res = await fetch(`/api/delivery-projects/${id}/create-proof-candidate`, { method: "POST" });
    if (res.ok) window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/delivery" className="text-sm text-neutral-400 hover:text-neutral-200">← Delivery</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <Badge variant="outline" className="capitalize">{project.status.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className={project.health === "overdue" ? "text-red-400" : project.health === "due_soon" ? "text-amber-400" : ""}>
            {project.health.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-neutral-400 mt-1">{project.clientName ?? project.company ?? "—"}</p>
      </div>

      <div className="grid gap-4 text-sm">
        <div><span className="text-neutral-500">Due:</span> {formatDate(project.dueDate)}</div>
        {project.githubUrl && <div><a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">GitHub</a></div>}
        {project.loomUrl && <div><a href={project.loomUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Loom</a></div>}
      </div>

      {project.summary && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 mb-1">Summary</h2>
          <p className="text-neutral-300">{project.summary}</p>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-neutral-500 mb-2">Milestones</h2>
        <ul className="space-y-1">
          {project.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className={m.status === "done" ? "text-emerald-400" : ""}>{m.title}</span>
              <Badge variant="outline" className="text-xs capitalize">{m.status}</Badge>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-medium text-neutral-500 mb-2">Checklist</h2>
        <ul className="space-y-1">
          {project.checklistItems.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className={c.isDone ? "text-emerald-400 line-through" : ""}>{c.label}</span>
              {c.isRequired && <span className="text-xs text-neutral-500">required</span>}
            </li>
          ))}
        </ul>
      </div>

      {!project.completedAt && (
        <div className="flex flex-wrap gap-2">
          {project.readiness?.canComplete ? (
            <Button onClick={handleComplete}>Mark completed</Button>
          ) : (
            <p className="text-sm text-amber-400">{project.readiness?.reasons?.join("; ") ?? "Complete checklist to mark done"}</p>
          )}
          <Button variant="outline" onClick={handleCreateProof} disabled={!!project.proofCandidateId}>
            {project.proofCandidateId ? "Proof linked" : "Create proof candidate"}
          </Button>
        </div>
      )}
    </div>
  );
}
