/**
 * Phase 2.5: Reminder priority helpers.
 */

export type ReminderPriority = "low" | "medium" | "high" | "critical";

const VALID: ReminderPriority[] = ["low", "medium", "high", "critical"];

export function normalizePriority(value: string | null | undefined): ReminderPriority {
  if (!value || typeof value !== "string") return "medium";
  const v = value.toLowerCase().trim();
  if (VALID.includes(v as ReminderPriority)) return v as ReminderPriority;
  if (v === "urgent" || v === "p0") return "critical";
  if (v === "p1") return "high";
  if (v === "p2") return "medium";
  if (v === "p3") return "low";
  return "medium";
}

export function priorityWeight(p: ReminderPriority): number {
  switch (p) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 2;
  }
}

export type ReminderLike = { priority?: string | null; dueAt?: Date | string | null; status?: string | null };

export function sortReminders<T extends ReminderLike>(reminders: T[]): T[] {
  const copy = [...reminders];
  copy.sort((a, b) => {
    const pa = priorityWeight(normalizePriority(a.priority));
    const pb = priorityWeight(normalizePriority(b.priority));
    if (pb !== pa) return pb - pa;

    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;
    return da - db;
  });
  return copy;
}
