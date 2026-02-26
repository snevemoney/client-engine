import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { buildBrief } from "@/lib/orchestrator/brief";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/brief", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const brief = await buildBrief();
    return NextResponse.json(brief);
  });
}
