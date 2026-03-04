import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCadence } from "@/lib/cadence/service";
import { generateProofDraft } from "@/lib/proof/generate";

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
  const {
    demoUrl,
    repoUrl,
    status,
    paymentStatus,
    paymentAmount,
    invoicedAt,
    paidAt,
    proofHeadline,
    proofSummary,
    proofTestimonial,
    campaignTags,
    proofPublishedAt,
  } = body as {
    demoUrl?: string | null;
    repoUrl?: string | null;
    status?: string;
    paymentStatus?: string | null;
    paymentAmount?: number | string | null;
    invoicedAt?: string | null;
    paidAt?: string | null;
    proofHeadline?: string | null;
    proofSummary?: string | null;
    proofTestimonial?: string | null;
    campaignTags?: string[];
    proofPublishedAt?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (demoUrl !== undefined) data.demoUrl = demoUrl === "" || demoUrl === null ? null : String(demoUrl);
  if (repoUrl !== undefined) data.repoUrl = repoUrl === "" || repoUrl === null ? null : String(repoUrl);
  if (typeof status === "string" && ["draft", "live", "shipped", "archived"].includes(status)) data.status = status;
  if (proofHeadline !== undefined) data.proofHeadline = proofHeadline === "" || proofHeadline === null ? null : String(proofHeadline).slice(0, 120);
  if (proofSummary !== undefined) data.proofSummary = proofSummary === "" || proofSummary === null ? null : String(proofSummary);
  if (proofTestimonial !== undefined) data.proofTestimonial = proofTestimonial === "" || proofTestimonial === null ? null : String(proofTestimonial);
  if (campaignTags !== undefined) data.campaignTags = Array.isArray(campaignTags) ? campaignTags.map((t) => String(t).trim()).filter(Boolean) : undefined;
  if (proofPublishedAt !== undefined) data.proofPublishedAt = proofPublishedAt ? new Date(proofPublishedAt) : null;
  if (paymentStatus !== undefined) {
    const valid = ["unpaid", "invoiced", "partial", "paid"];
    data.paymentStatus =
      paymentStatus === "" || paymentStatus === null
        ? null
        : typeof paymentStatus === "string" && valid.includes(paymentStatus)
          ? paymentStatus
          : undefined;
    if (data.paymentStatus === undefined) delete data.paymentStatus;
  }
  if (paymentAmount !== undefined) {
    data.paymentAmount =
      paymentAmount === "" || paymentAmount === null
        ? null
        : typeof paymentAmount === "number"
          ? paymentAmount
          : Number(paymentAmount);
  }
  if (invoicedAt !== undefined) {
    data.invoicedAt = invoicedAt ? new Date(invoicedAt) : null;
  }
  if (paidAt !== undefined) {
    data.paidAt = paidAt ? new Date(paidAt) : null;
  }

  const updated = await db.project.update({
    where: { id },
    data,
  });

  const wasInvoiced = ["invoiced", "partial"].includes(project.paymentStatus ?? "");
  const nowInvoiced = ["invoiced", "partial"].includes(updated.paymentStatus ?? "");
  if (nowInvoiced && !wasInvoiced) {
    createCadence("project", id, "invoiced").catch((e) =>
      console.warn("[cadence] invoiced failed:", e)
    );
  }

  const wasPaid = project.paymentStatus === "paid";
  const nowPaid = updated.paymentStatus === "paid";
  if (nowPaid && !wasPaid) {
    createCadence("project", id, "paid").catch((e) =>
      console.warn("[cadence] paid failed:", e)
    );
    generateProofDraft(id)
      .then((draft) => {
        if (draft) {
          return db.project.update({
            where: { id },
            data: {
              proofHeadline: draft.headline,
              proofSummary: draft.summary,
              campaignTags: draft.campaignTags,
            },
          });
        }
      })
      .catch((e) => console.warn("[proof] generate failed:", e));
  }

  return NextResponse.json(updated);
}
