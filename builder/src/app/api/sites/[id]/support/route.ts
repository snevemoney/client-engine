/**
 * GET /api/sites/[id]/support — List support requests (stub).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireBuilderApiKey } from "@/lib/require-api-key";

function requireAuth(req: NextRequest): boolean {
  return requireBuilderApiKey(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json([]);
}
