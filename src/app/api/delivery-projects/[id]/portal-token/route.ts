/**
 * POST /api/delivery-projects/[id]/portal-token
 *
 * Creates clientToken if missing, returns portal URL.
 * Auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { checkStateChangeRateLimit, jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getAppUrl } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/portal-token", async () => {
    const { id } = await params;
    const rl = checkStateChangeRateLimit(req, "portal-token");
    if (rl) return rl;

    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    let token = project.clientToken;
    if (!token) {
      token = randomBytes(18).toString("base64url");
      await db.deliveryProject.update({
        where: { id },
        data: { clientToken: token },
      });
    }

    const baseUrl = getAppUrl();
    const portalUrl = `${baseUrl}/portal/${token}`;

    return NextResponse.json({ portalUrl, token });
  });
}
