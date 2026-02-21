import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOperatorSettings, setOperatorSettings, type OperatorSettings } from "@/lib/ops/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getOperatorSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: OperatorSettings;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await setOperatorSettings(body);
  return NextResponse.json({ ok: true });
}
