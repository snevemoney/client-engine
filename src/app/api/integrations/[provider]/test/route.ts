/**
 * POST /api/integrations/[provider]/test — Test connection.
 * Respects mode: OFF=skipped, MOCK=mock success, MANUAL=manual response, LIVE=real test (if implemented).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderDef, resolveProviderKey } from "@/lib/integrations/providerRegistry";
import { canRunLiveIntegration } from "@/lib/integrations/runtime";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  return withRouteTiming("POST /api/integrations/[provider]/test", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { provider } = await params;
    const canonical = resolveProviderKey(provider);
    const def = getProviderDef(provider);
    if (!def) return jsonError("Unknown provider", 400);

    const conn = await db.integrationConnection.findUnique({
      where: { provider: canonical },
    });

    const mode = conn?.mode ?? def.defaultMode;
    const prodOnly = conn?.prodOnly ?? def.prodOnly;

    // OFF => skipped
    if (mode === "off") {
      return NextResponse.json({ ok: false, message: "Integration is OFF — test skipped." });
    }

    // MOCK => mock success
    if (mode === "mock") {
      if (conn) {
        await db.integrationConnection.update({
          where: { provider: canonical },
          data: {
            lastTestedAt: new Date(),
            lastTestStatus: "pass",
            lastError: null,
          },
        });
      }
      return NextResponse.json({ ok: true, message: "MOCK mode — simulated success." });
    }

    // MANUAL => no live test
    if (mode === "manual") {
      return NextResponse.json({
        ok: true,
        message: "MANUAL mode — no live test. Data entered manually.",
      });
    }

    // LIVE => run real test if supported and allowed
    if (!canRunLiveIntegration({ provider, mode, prodOnly, supportsLive: def.supportsLive })) {
      return NextResponse.json({
        ok: false,
        message: "LIVE not available (prodOnly in non-production or provider doesn't support live).",
      });
    }

    let ok = false;
    let message = "Test not implemented yet";

    if (def.hasRealTest && canonical === "meta") {
      const token = process.env.META_ADS_ACCESS_TOKEN ?? (conn?.configJson as Record<string, unknown>)?.accessToken;
      if (token) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token as string)}&fields=id,name`,
            { signal: AbortSignal.timeout(5000) }
          );
          ok = res.ok;
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          message = ok ? "Token valid" : json?.error?.message ?? `HTTP ${res.status}`;
        } catch (e) {
          message = e instanceof Error ? e.message : "Request failed";
        }
      } else {
        message = "No token configured";
      }
    }

    if (conn) {
      await db.integrationConnection.update({
        where: { provider: canonical },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: ok ? "pass" : "fail",
          lastError: ok ? null : message,
          status: ok ? "connected" : conn.status === "connected" ? "error" : conn.status,
        },
      });
    }

    return NextResponse.json({ ok, message });
  });
}
