/**
 * POST /api/voice/consent — Set voice consent for a proposal.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, jsonError, withRouteTiming, checkStateChangeRateLimit } from "@/lib/api-utils";
import { recordConsent } from "@/lib/voice";
import { requireProposalAccess } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ proposalId: z.string().min(1) });

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/voice/consent", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rl = checkStateChangeRateLimit(req, "voice:consent");
    if (rl) return rl;

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input: proposalId required", 400);

    const access = await requireProposalAccess(parsed.data.proposalId);
    if (!access.ok) return access.response;

    await recordConsent(parsed.data.proposalId);
    return NextResponse.json({ ok: true });
  });
}
