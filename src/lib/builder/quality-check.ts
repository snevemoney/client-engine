/**
 * Post-generation quality check for builder sites.
 * Fetches feedback, optionally retries generation, stores health score,
 * and creates a notification if quality is poor.
 */

import { db } from "@/lib/db";
import { getSiteFeedback, generateContent, type GenerateContentInput } from "./client";

const MAX_REGEN_ATTEMPTS = 1;

export type QualityCheckResult = {
  score: number;
  label: string;
  issues: string[];
  regenerated: boolean;
  attempts: number;
};

export async function checkAndReactToQuality(
  siteId: string,
  deliveryProjectId: string,
  regenerateInput?: GenerateContentInput,
): Promise<QualityCheckResult> {
  let feedback = await getSiteFeedback(siteId);
  let regenerated = false;
  let attempts = 0;

  // If quality is poor and we can regenerate, try once
  if (feedback.health.score < 70 && regenerateInput && attempts < MAX_REGEN_ATTEMPTS) {
    attempts++;
    console.log(`[quality-check] Score ${feedback.health.score}/100, triggering regeneration (attempt ${attempts})`);
    try {
      await generateContent(siteId, regenerateInput);
      feedback = await getSiteFeedback(siteId);
      regenerated = true;
    } catch (err) {
      console.error("[quality-check] Regeneration failed:", err);
    }
  }

  // Store health score on the delivery project
  await db.deliveryProject.update({
    where: { id: deliveryProjectId },
    data: {
      builderHealthScore: feedback.health.score,
      builderHealthLabel: feedback.health.label,
      builderHealthCheckedAt: new Date(),
    },
  });

  // Log activity
  await db.deliveryActivity.create({
    data: {
      deliveryProjectId,
      type: "note",
      message: `Website quality: ${feedback.health.score}/100 (${feedback.health.label})${regenerated ? " — content regenerated" : ""}`,
      metaJson: {
        action: "builder_quality_check",
        score: feedback.health.score,
        label: feedback.health.label,
        issues: feedback.suggestions,
        regenerated,
        attempts,
      },
    },
  });

  // Notify if quality is still poor after all attempts
  if (feedback.health.score < 70) {
    try {
      const { createNotificationEvent, queueNotificationDeliveries } = await import("@/lib/notifications/service");
      const { id, created } = await createNotificationEvent({
        eventKey: "builder.content_quality_poor",
        title: "Website content needs attention",
        message: `Quality score: ${feedback.health.score}/100. ${feedback.suggestions.slice(0, 3).join("; ")}`,
        severity: feedback.health.score < 50 ? "warning" : "info",
        sourceType: "delivery_project",
        sourceId: deliveryProjectId,
        actionUrl: `/dashboard/delivery/${deliveryProjectId}`,
        dedupeKey: `builder:quality:${siteId}:${new Date().toISOString().slice(0, 10)}`,
        createdByRule: "builder_quality_check",
        metaJson: {
          siteId,
          score: feedback.health.score,
          label: feedback.health.label,
          issues: feedback.suggestions,
        },
      });
      if (created) {
        await queueNotificationDeliveries(id).catch(() => {});
      }
    } catch (err) {
      console.error("[quality-check] Notification failed:", err);
    }
  }

  return {
    score: feedback.health.score,
    label: feedback.health.label,
    issues: feedback.suggestions,
    regenerated,
    attempts,
  };
}
