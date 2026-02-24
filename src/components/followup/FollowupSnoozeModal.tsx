"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FollowUpItem } from "./FollowupBucketTable";

type SnoozeType = "2d" | "5d" | "next_monday" | "custom";

export function FollowupSnoozeModal({
  item,
  onClose,
  onSubmit,
  loading,
}: {
  item: FollowUpItem | null;
  onClose: () => void;
  onSubmit: (payload: { snoozeType: SnoozeType; nextActionDueAt?: string; reason?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [snoozeType, setSnoozeType] = useState<SnoozeType>("2d");
  const [customDue, setCustomDue] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    await onSubmit({
      snoozeType,
      nextActionDueAt: snoozeType === "custom" ? customDue.trim() || undefined : undefined,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
        <h3 className="font-medium mb-3">Snooze follow-up</h3>
        <p className="text-sm text-neutral-400 mb-3">{item.title}</p>
        <div className="space-y-2 mb-3">
          {(["2d", "5d", "next_monday", "custom"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="radio"
                name="snooze"
                checked={snoozeType === t}
                onChange={() => setSnoozeType(t)}
                className="rounded border-neutral-600 bg-neutral-800"
              />
              <span className="text-sm">
                {t === "2d" && "+2 days"}
                {t === "5d" && "+5 days"}
                {t === "next_monday" && "Next Monday"}
                {t === "custom" && "Custom date"}
              </span>
            </label>
          ))}
        </div>
        {snoozeType === "custom" && (
          <Input
            type="datetime-local"
            value={customDue}
            onChange={(e) => setCustomDue(e.target.value)}
            className="mb-3 bg-neutral-800 border-neutral-600"
          />
        )}
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="mb-4 bg-neutral-800 border-neutral-600"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (snoozeType === "custom" && !customDue.trim())}
          >
            {loading ? "Saving…" : "Snooze"}
          </Button>
        </div>
      </div>
    </div>
  );
}
