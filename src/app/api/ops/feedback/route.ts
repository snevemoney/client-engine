import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addOperatorFeedbackNote, getRecentOperatorFeedbackNotes } from "@/lib/ops/feedback";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await getRecentOperatorFeedbackNotes(10);
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with content required" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  const id = await addOperatorFeedbackNote(content, { tags: Array.isArray(body.tags) ? body.tags : undefined });
  return NextResponse.json({ id });
}
