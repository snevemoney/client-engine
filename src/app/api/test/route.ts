import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/test", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);
    return NextResponse.json({ message: "API route works!" });
  });
}
