/**
 * Cadence service: create workflow cadences for follow-up reminders.
 * Polymorphic: sourceType + sourceId reference Lead, DeliveryProject, or Project.
 */

import { db } from "@/lib/db";

export type CadenceSourceType = "lead" | "delivery_project" | "project";
export type CadenceTrigger = "scope_sent" | "deployed" | "invoiced" | "paid";

const TRIGGER_DAYS: Record<CadenceTrigger, number> = {
  scope_sent: 3,
  deployed: 7,
  invoiced: 14,
  paid: 7,
};

/**
 * Create a cadence for a given trigger. Fire-and-forget; logs errors.
 */
export async function createCadence(
  sourceType: CadenceSourceType,
  sourceId: string,
  trigger: CadenceTrigger
): Promise<void> {
  const days = TRIGGER_DAYS[trigger];
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + days);

  try {
    await db.cadence.create({
      data: {
        sourceType,
        sourceId,
        trigger,
        dueAt,
      },
    });
  } catch (e) {
    console.warn("[cadence] createCadence failed:", e);
  }
}
