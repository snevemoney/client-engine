/**
 * Phase 9.2: Resolve clientName and clientEmail from linked entity IDs.
 * Priority: Proposal > DeliveryProject > IntakeLead > Lead > Deal(via Prospect).
 */

import { db } from "@/lib/db";

// Accept both Prisma.TransactionClient and the extended db client (from $extends)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = Record<string, any>;

export async function resolveClientFromEntities(
  opts: {
    proposalId?: string;
    deliveryProjectId?: string;
    intakeLeadId?: string;
    pipelineLeadId?: string;
    dealId?: string;
  },
  client: DbClient = db
): Promise<{ clientName: string | null; clientEmail: string | null }> {
  // 1. Proposal — has clientName + clientEmail directly
  if (opts.proposalId) {
    const p = await client.proposal.findUnique({
      where: { id: opts.proposalId },
      select: { clientName: true, clientEmail: true },
    });
    if (p?.clientName || p?.clientEmail) {
      return { clientName: p.clientName, clientEmail: p.clientEmail };
    }
  }

  // 2. DeliveryProject — has clientName, can get email from linked proposal
  if (opts.deliveryProjectId) {
    const dp = await client.deliveryProject.findUnique({
      where: { id: opts.deliveryProjectId },
      select: {
        clientName: true,
        proposal: { select: { clientEmail: true } },
      },
    });
    if (dp?.clientName) {
      return { clientName: dp.clientName, clientEmail: dp.proposal?.clientEmail ?? null };
    }
  }

  // 3. IntakeLead — has contactName + contactEmail
  if (opts.intakeLeadId) {
    const il = await client.intakeLead.findUnique({
      where: { id: opts.intakeLeadId },
      select: { contactName: true, contactEmail: true },
    });
    if (il?.contactName || il?.contactEmail) {
      return { clientName: il.contactName, clientEmail: il.contactEmail };
    }
  }

  // 4. Lead (pipeline) — has contactName + contactEmail
  if (opts.pipelineLeadId) {
    const l = await client.lead.findUnique({
      where: { id: opts.pipelineLeadId },
      select: { contactName: true, contactEmail: true },
    });
    if (l?.contactName || l?.contactEmail) {
      return { clientName: l.contactName, clientEmail: l.contactEmail };
    }
  }

  // 5. Deal — via Prospect (Prospect has no email field)
  if (opts.dealId) {
    const d = await client.deal.findUnique({
      where: { id: opts.dealId },
      select: { prospect: { select: { name: true } } },
    });
    if (d?.prospect?.name) {
      return { clientName: d.prospect.name, clientEmail: null };
    }
  }

  return { clientName: null, clientEmail: null };
}
