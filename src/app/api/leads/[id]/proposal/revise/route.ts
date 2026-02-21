import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runReviseProposal } from "@/lib/pipeline/reviseProposal";
import { buildProvenance } from "@/lib/pipeline/provenance";
import { rateLimit } from "@/lib/rate-limit";

const LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `${session.user.id}:proposal-revise`;
  const { ok, remaining, resetAt } = rateLimit(key, LIMIT, WINDOW_MS);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests", resetAt },
      { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(resetAt) } }
    );
  }

  const { id } = await params;
  let body: { instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON with instruction" }, { status: 400 });
  }
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const provenance = buildProvenance(null, "propose-revise", { temperature: 0.5 });
    const { artifactId } = await runReviseProposal(id, instruction, provenance);
    const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
    return NextResponse.json(artifact);
  } catch (err: unknown) {
    console.error("[proposal/revise] Error:", err);
    const msg = err instanceof Error ? err.message : "Revise failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
