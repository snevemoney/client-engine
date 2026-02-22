/**
 * PATCH a content asset (e.g. update inboundLeads, wonDeals, cashCollected).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  publishedAt: z.string().optional().nullable(),
  topicTag: z.string().optional(),
  format: z.string().optional(),
  ctaType: z.string().optional(),
  views: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  inboundLeads: z.number().int().min(0).optional(),
  qualifiedLeads: z.number().int().min(0).optional(),
  wonDeals: z.number().int().min(0).optional(),
  cashCollected: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.contentAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Content asset not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const asset = await db.contentAsset.update({
    where: { id },
    data: {
      ...(d.title !== undefined && { title: d.title }),
      ...(d.url !== undefined && { url: d.url }),
      ...(d.publishedAt !== undefined && { publishedAt: d.publishedAt ? new Date(d.publishedAt) : null }),
      ...(d.topicTag !== undefined && { topicTag: d.topicTag }),
      ...(d.format !== undefined && { format: d.format }),
      ...(d.ctaType !== undefined && { ctaType: d.ctaType }),
      ...(d.views !== undefined && { views: d.views }),
      ...(d.comments !== undefined && { comments: d.comments }),
      ...(d.inboundLeads !== undefined && { inboundLeads: d.inboundLeads }),
      ...(d.qualifiedLeads !== undefined && { qualifiedLeads: d.qualifiedLeads }),
      ...(d.wonDeals !== undefined && { wonDeals: d.wonDeals }),
      ...(d.cashCollected !== undefined && { cashCollected: d.cashCollected }),
      ...(d.notes !== undefined && { notes: d.notes }),
    },
  });
  return NextResponse.json(asset);
}
