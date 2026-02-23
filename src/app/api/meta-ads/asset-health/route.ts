/**
 * GET /api/meta-ads/asset-health — Read-only diagnostics for Meta assets.
 * Returns account, permissions, pages, IG, pixels, WhatsApp status.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchAssetHealth } from "@/lib/meta-ads/asset-health";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/meta-ads/asset-health", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim() ?? "";
    if (!accountId) {
      return NextResponse.json({
        ok: false,
        account: { id: "" },
        permissions: {},
        pages: [],
        instagramAccounts: [],
        pixels: [],
        whatsapp: { status: "unknown" as const },
        checks: [{ key: "config", label: "Config", status: "fail" as const, detail: "META_AD_ACCOUNT_ID not set" }],
        errors: ["META_AD_ACCOUNT_ID not configured"],
      });
    }

    try {
      const result = await fetchAssetHealth(accountId);
      return NextResponse.json(result);
    } catch (e) {
      console.warn("[meta-ads:asset-health] fetch error:", e);
      return NextResponse.json({
        ok: false,
        account: { id: accountId },
        permissions: {},
        pages: [],
        instagramAccounts: [],
        pixels: [],
        whatsapp: { status: "unknown" as const },
        checks: [{ key: "fetch", label: "Fetch", status: "fail" as const, detail: e instanceof Error ? e.message : "Failed" }],
        errors: [e instanceof Error ? e.message : String(e)],
      });
    }
  });
}
