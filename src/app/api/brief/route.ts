import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBrief } from "@/lib/orchestrator/brief";
import { withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/brief", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const brief = await buildBrief();
    return NextResponse.json(brief);
  });
}
