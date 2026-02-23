/**
 * GET /api/integrations/registry — read-only integration registry.
 * Used for health cards and visibility. No auth required for internal ops.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { INTEGRATIONS, getIntegrationSummary } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = getIntegrationSummary();
  return NextResponse.json({
    integrations: INTEGRATIONS,
    summary,
    docs: {
      checklist: "/docs/INTEGRATION_MASTER_CHECKLIST.md",
      roadmap: "/docs/INTEGRATION_ROADMAP_PHASES.md",
      speed: "/docs/APP_SPEED_AND_USABILITY_CHECKLIST.md",
    },
  });
}
