"use client";

import { useState, useEffect } from "react";

const MONETIZATION_ROLES = ["trust", "lead_capture", "conversion", "delivery", "proof", "upsell"] as const;
type MonetizationRole = (typeof MONETIZATION_ROLES)[number];

type Project = { id: string; slug: string; name: string; status: string };

export function MonetizationMapSection({
  initialProjects,
  initialMap,
}: {
  initialProjects: Project[];
  initialMap: Record<string, MonetizationRole[]>;
}) {
  const [map, setMap] = useState<Record<string, MonetizationRole[]>>(initialMap);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMap(initialMap);
  }, [initialMap]);

  function toggle(slug: string, role: MonetizationRole) {
    const current = map[slug] ?? [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role].sort();
    setMap((m) => ({ ...m, [slug]: next }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ops/monetization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectRoles: map }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error ?? "Save failed");
        return;
      }
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  const projects = initialProjects.filter((p) => p.status === "live").length > 0
    ? initialProjects.filter((p) => p.status === "live")
    : initialProjects;

  return (
    <section className="border border-neutral-800 rounded-lg p-6 space-y-4">
      <h2 className="text-sm font-medium text-neutral-300">Website / Project monetization</h2>
      <p className="text-xs text-neutral-500">
        Map each project/page to its monetization role: trust, lead_capture, conversion, delivery, proof, upsell.
      </p>
      {projects.length === 0 ? (
        <p className="text-sm text-neutral-500">No projects yet. Deploy projects to assign roles.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-neutral-500">
                  <th className="py-2 pr-4">Project</th>
                  {MONETIZATION_ROLES.map((r) => (
                    <th key={r} className="py-2 px-1 text-center capitalize">{r.replace("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-800">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-neutral-200">{p.name}</span>
                      <span className="text-neutral-500 ml-1">({p.slug})</span>
                    </td>
                    {MONETIZATION_ROLES.map((role) => (
                      <td key={role} className="py-2 px-1 text-center">
                        <input
                          type="checkbox"
                          checked={(map[p.slug] ?? []).includes(role)}
                          onChange={() => toggle(p.slug, role)}
                          className="rounded border-neutral-600 bg-neutral-900"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-neutral-100 text-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save mapping"}
            </button>
            {message && <span className="text-sm text-neutral-400">{message}</span>}
          </div>
        </>
      )}
    </section>
  );
}
