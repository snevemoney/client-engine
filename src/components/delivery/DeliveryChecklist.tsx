"use client";

import { useState } from "react";

type ChecklistItem = {
  id: string;
  category: string;
  label: string;
  isDone: boolean;
  isRequired: boolean;
};

export function DeliveryChecklist({
  projectId,
  items,
  onUpdate,
}: {
  projectId: string;
  items: ChecklistItem[];
  onUpdate: (items: ChecklistItem[]) => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (item: ChecklistItem) => {
    if (togglingId) return;
    const nextDone = !item.isDone;
    setTogglingId(item.id);
    const prevItems = items;
    onUpdate(
      items.map((c) =>
        c.id === item.id ? { ...c, isDone: nextDone } : c
      )
    );
    try {
      const res = await fetch(`/api/delivery-projects/${projectId}/checklist/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId: item.id, isDone: nextDone }),
      });
      if (!res.ok) {
        onUpdate(prevItems);
        const d = await res.json();
        alert(d?.error ?? "Failed to toggle");
      }
    } catch {
      onUpdate(prevItems);
      alert("Failed to toggle");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      <h2 className="text-sm font-medium text-neutral-500 mb-2">Checklist</h2>
      <ul className="space-y-1">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.isDone}
              onChange={() => handleToggle(c)}
              disabled={togglingId === c.id}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            <span className={c.isDone ? "text-emerald-400 line-through" : ""}>
              {c.label}
            </span>
            {c.isRequired && (
              <span className="text-xs text-neutral-500">required</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
