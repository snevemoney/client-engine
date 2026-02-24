"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FollowUpItem } from "./FollowupBucketTable";

export function FollowupCompleteModal({
  item,
  onClose,
  onSubmit,
  loading,
}: {
  item: FollowUpItem | null;
  onClose: () => void;
  onSubmit: (payload: { note?: string; nextAction?: string; nextActionDueAt?: string }) => Promise<void>;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState(item?.nextAction ?? "");
  const [nextActionDueAt, setNextActionDueAt] = useState("");

  const handleSubmit = async () => {
    await onSubmit({
      note: note.trim() || undefined,
      nextAction: nextAction.trim() || undefined,
      nextActionDueAt: nextActionDueAt.trim() || undefined,
    });
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-md p-4">
        <h3 className="font-medium mb-3">Complete follow-up</h3>
        <p className="text-sm text-neutral-400 mb-3">{item.title}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          rows={2}
          className="mb-3 bg-neutral-800 border-neutral-600 resize-none"
        />
        <Input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="Next action (optional)"
          className="mb-3 bg-neutral-800 border-neutral-600"
        />
        <Input
          type="datetime-local"
          value={nextActionDueAt}
          onChange={(e) => setNextActionDueAt(e.target.value)}
          placeholder="Next due date (optional)"
          className="mb-4 bg-neutral-800 border-neutral-600"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : "Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
