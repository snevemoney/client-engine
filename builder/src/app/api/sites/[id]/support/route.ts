/**
 * GET /api/sites/[id]/support — List support requests (stub).
 */
import { NextRequest, NextResponse } from "next/server";

function requireAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const key = process.env.BUILDER_API_KEY ?? "dev-key";
  return auth === `Bearer ${key}`;
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
