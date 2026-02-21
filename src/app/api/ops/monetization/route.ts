import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonetizationMap, updateMonetizationMap, MONETIZATION_ROLES, type MonetizationRole } from "@/lib/ops/monetization";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const map = await getMonetizationMap();
    return NextResponse.json({ projectRoles: map, roles: MONETIZATION_ROLES });
  } catch (e) {
    console.error("[ops/monetization GET]", e);
    return NextResponse.json({ error: "Failed to load monetization map" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { projectRoles?: Record<string, string[]> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with projectRoles required" }, { status: 400 });
  }
  const projectRoles = body.projectRoles;
  if (!projectRoles || typeof projectRoles !== "object") {
    return NextResponse.json({ error: "projectRoles object required" }, { status: 400 });
  }
  const sanitized: Record<string, MonetizationRole[]> = {};
  for (const [slug, roles] of Object.entries(projectRoles)) {
    if (Array.isArray(roles))
      sanitized[slug] = roles.filter((r): r is MonetizationRole => typeof r === "string" && MONETIZATION_ROLES.includes(r as MonetizationRole));
  }
  try {
    await updateMonetizationMap(sanitized);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ops/monetization PATCH]", e);
    return NextResponse.json({ error: "Failed to update map" }, { status: 500 });
  }
}
