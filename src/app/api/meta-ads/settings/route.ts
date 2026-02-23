/**
 * GET /api/meta-ads/settings — Read automation settings
 * PATCH /api/meta-ads/settings — Update settings (Zod validated)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { z } from "zod";

const SettingsSchema = z.object({
  mode: z.enum(["manual", "approve_required", "auto_safe"]).optional(),
  dryRun: z.boolean().optional(),
  targetCpl: z.number().nullable().optional(),
  minSpendForDecision: z.number().min(0).optional(),
  minImpressionsForDecision: z.number().min(0).optional(),
  maxBudgetIncreasePctPerAction: z.number().min(0).max(100).optional(),
  maxBudgetIncreasePctPerDay: z.number().min(0).max(100).optional(),
  allowChangesDuringLearning: z.boolean().optional(),
  protectedCampaignIds: z.array(z.string()).optional(),
  actionCooldownMinutes: z.number().min(0).max(10080).optional(), // 0 = disabled, max 7d
  maxActionsPerEntityPerDay: z.number().min(0).max(50).optional(),
});

export const dynamic = "force-dynamic";

async function ensureSettings(accountId: string) {
  const existing = await db.metaAdsAutomationSettings.findUnique({
    where: { accountId },
  });
  if (existing) return existing;
  return db.metaAdsAutomationSettings.create({
    data: {
      accountId,
      mode: "manual",
      dryRun: true,
      minSpendForDecision: 20,
      minImpressionsForDecision: 100,
      maxBudgetIncreasePctPerAction: 10,
      maxBudgetIncreasePctPerDay: 20,
      allowChangesDuringLearning: false,
      protectedCampaignIds: [],
    },
  });
}

export async function GET() {
  return withRouteTiming("GET /api/meta-ads/settings", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) {
      return NextResponse.json({ settings: null });
    }

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const settings = await ensureSettings(acc);
    return NextResponse.json({ settings });
  });
}

export async function PATCH(req: NextRequest) {
  return withRouteTiming("PATCH /api/meta-ads/settings", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) return jsonError("META_AD_ACCOUNT_ID not set", 503);

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

    let body: z.infer<typeof SettingsSchema>;
    try {
      const json = await req.json();
      body = SettingsSchema.parse(json);
    } catch (e) {
      return jsonError(
        e instanceof z.ZodError ? e.issues.map((err) => err.message).join("; ") : "Invalid body",
        400
      );
    }

    await ensureSettings(acc);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (body.mode != null) data.mode = body.mode;
    if (body.dryRun != null) data.dryRun = body.dryRun;
    if (body.targetCpl !== undefined) data.targetCpl = body.targetCpl;
    if (body.minSpendForDecision != null) data.minSpendForDecision = body.minSpendForDecision;
    if (body.minImpressionsForDecision != null) data.minImpressionsForDecision = body.minImpressionsForDecision;
    if (body.maxBudgetIncreasePctPerAction != null) data.maxBudgetIncreasePctPerAction = body.maxBudgetIncreasePctPerAction;
    if (body.maxBudgetIncreasePctPerDay != null) data.maxBudgetIncreasePctPerDay = body.maxBudgetIncreasePctPerDay;
    if (body.allowChangesDuringLearning != null) data.allowChangesDuringLearning = body.allowChangesDuringLearning;
    if (body.protectedCampaignIds != null) {
      const ids = body.protectedCampaignIds
        .filter((s) => typeof s === "string" && String(s).trim().length > 0)
        .map((s) => String(s).trim());
      data.protectedCampaignIds = [...new Set(ids)];
    }
    if (body.actionCooldownMinutes != null) data.actionCooldownMinutes = body.actionCooldownMinutes;
    if (body.maxActionsPerEntityPerDay != null) data.maxActionsPerEntityPerDay = body.maxActionsPerEntityPerDay;

    const updated = await db.metaAdsAutomationSettings.update({
      where: { accountId: acc },
      data,
    });

    return NextResponse.json({ settings: updated });
  });
}
