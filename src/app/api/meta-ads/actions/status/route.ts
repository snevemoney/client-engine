/**
 * POST /api/meta-ads/actions/status — Pause or resume campaign/ad set/ad.
 * Requires auth + ads_management permission on the token.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateMetaObjectStatus } from "@/lib/meta-ads/client";
import { jsonError } from "@/lib/api-utils";
import { z } from "zod";

const BodySchema = z.object({
  level: z.enum(["campaign", "adset", "ad"]),
  id: z.string().min(1, "id required"),
  action: z.enum(["pause", "resume"]),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return jsonError("Unauthorized", 401);

  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (e) {
    return jsonError(
      e instanceof z.ZodError ? e.issues.map((err) => err.message).join("; ") : "Invalid body",
      400
    );
  }

  const result = await updateMetaObjectStatus(body.level, body.id, body.action);

  if (!result.ok) {
    const status =
      result.code === "PERMISSION_DENIED" ? 403 :
      result.code === "INVALID_TOKEN" ? 401 :
      result.code === "NOT_FOUND" ? 404 :
      result.code === "RATE_LIMIT" ? 429 : 502;
    console.warn(`[meta-ads:status] ${body.level}/${body.id} ${body.action} failed:`, result.error);
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json(result);
}
