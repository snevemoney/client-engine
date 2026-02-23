/**
 * POST /api/integrations/[provider]/test — Test connection (placeholder or real for Meta)
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations/providers";
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
    const def = INTEGRATION_PROVIDERS.find((p) => p.key === provider);
    if (!def) return jsonError("Unknown provider", 400);

    const conn = await db.integrationConnection.findUnique({
      where: { provider },
    });

    let ok = false;
    let message = "Test not implemented yet";

    if (def.hasRealTest && provider === "meta") {
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
        where: { provider },
        data: {
          lastTestedAt: new Date(),
          lastError: ok ? null : message,
          status: ok ? "connected" : conn.status === "connected" ? "error" : conn.status,
        },
      });
    }

    return NextResponse.json({ ok, message });
  });
}
