import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; company?: string; website?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : undefined;
  const website = typeof body.website === "string" ? body.website.trim() : undefined;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const title = company ? `${company} (website)` : name ? `${name} (website)` : "Website inquiry";
  const description = [message, company ? `Company: ${company}` : "", website ? `Website: ${website}` : ""].filter(Boolean).join("\n");
  try {
    const lead = await db.lead.create({
      data: { title, source: "website", description: description || undefined, contactName: name || undefined, contactEmail: email, tags: ["website"] },
    });
    await db.artifact.create({
      data: { leadId: lead.id, type: "INTAKE_NOTE", title: "Website intake", content: description || "No message provided.", meta: { company, website, capturedAt: new Date().toISOString() } },
    });
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (e) {
    console.error("[site/leads POST]", e);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
