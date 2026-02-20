import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const { demoUrl, repoUrl, status } = body as { demoUrl?: string | null; repoUrl?: string | null; status?: string };

  const data: { demoUrl?: string | null; repoUrl?: string | null; status?: string } = {};
  if (demoUrl !== undefined) data.demoUrl = demoUrl === "" || demoUrl === null ? null : String(demoUrl);
  if (repoUrl !== undefined) data.repoUrl = repoUrl === "" || repoUrl === null ? null : String(repoUrl);
  if (typeof status === "string" && ["draft", "shipped", "archived"].includes(status)) data.status = status;

  const updated = await db.project.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
