import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveWeeklySnapshot } from "@/lib/ops/weeklySnapshot";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const meta = await saveWeeklySnapshot();
    return NextResponse.json(meta);
  } catch (e) {
    console.error("[weekly-snapshot]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save snapshot" },
      { status: 500 }
    );
  }
}
