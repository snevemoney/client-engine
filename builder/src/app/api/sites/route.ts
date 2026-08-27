/**
 * POST /api/sites — Create a new site.
 * Stores brandColors as themeColorsJson so preview uses custom palette (not green).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBuilderApiKey } from "@/lib/require-api-key";

const CreateSchema = z.object({
  clientName: z.string().min(1),
  industry: z.string().default("custom"),
  scope: z.array(z.string()).default(["homepage", "about", "services", "contact"]),
  brandColors: z.array(z.string()).optional(),
  contentHints: z.string().optional(),
  deliveryProjectId: z.string().optional(),
});

function requireAuth(req: NextRequest): boolean {
  return requireBuilderApiKey(req);
}

export async function POST(req: NextRequest) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { clientName, industry, scope, brandColors, contentHints, deliveryProjectId } = parsed.data;

  const baseUrl = process.env.BUILDER_PUBLIC_URL ?? "http://localhost:3001";
  const site = await prisma.site.create({
    data: {
      clientName,
      industry,
      status: "draft",
      pages: JSON.stringify(scope),
      sections: JSON.stringify(
        scope.map((s) => ({ type: s, props: {} }))
      ),
      contentHints: contentHints ?? null,
      themeColorsJson: brandColors?.length ? JSON.stringify(brandColors) : null,
      deliveryProjectId: deliveryProjectId ?? null,
    },
  });

  const previewUrl = `${baseUrl}/preview/${site.id}`;
  await prisma.site.update({
    where: { id: site.id },
    data: { previewUrl },
  });

  return NextResponse.json({
    siteId: site.id,
    status: "draft",
    previewUrl,
    pages: scope,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  });
}
