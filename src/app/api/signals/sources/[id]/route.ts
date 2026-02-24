/**
 * PATCH /api/signals/sources/[id] — Update a signal source
 * DELETE /api/signals/sources/[id] — Delete a signal source
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
  mode: z.enum(["off", "mock", "manual", "live"]).optional(),
  prodOnly: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/signals/sources/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const source = await db.signalSource.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(source);
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("DELETE /api/signals/sources/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    await db.signalSource.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  });
}
