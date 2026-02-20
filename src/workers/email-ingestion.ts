import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

interface ParsedLead {
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  budget?: string;
  tags: string[];
}

function computeHash(title: string, content: string): string {
  return crypto.createHash("sha256").update(`${title}|${content.slice(0, 500)}`).digest("hex").slice(0, 32);
}

function parseUpworkEmail(subject: string, text: string, html: string): ParsedLead | null {
  const titleMatch = subject.match(/new job:?\s*(.+)/i) || subject.match(/invitation:?\s*(.+)/i);
  if (!titleMatch) return null;

  const title = titleMatch[1].replace(/\s*-\s*Upwork$/, "").trim();

  const budgetMatch = text.match(/Budget:\s*\$?([\d,]+(?:\.\d{2})?(?:\s*-\s*\$?[\d,]+(?:\.\d{2})?)?)/i)
    || text.match(/\$([\d,]+(?:\.\d{2})?)/);
  const budget = budgetMatch ? `$${budgetMatch[1]}` : undefined;

  const urlMatch = text.match(/(https:\/\/www\.upwork\.com\/jobs\/[^\s"<]+)/i)
    || html.match(/(https:\/\/www\.upwork\.com\/jobs\/[^\s"<]+)/i);
  const sourceUrl = urlMatch ? urlMatch[1] : undefined;

  const skillsMatch = text.match(/Skills?:\s*(.+?)(?:\n|$)/i);
  const tags = skillsMatch
    ? skillsMatch[1].split(/[,|]/).map((s) => s.trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    title,
    description: text.slice(0, 3000),
    source: "upwork",
    sourceUrl,
    budget,
    tags,
  };
}

function parseGenericEmail(subject: string, text: string, from: string): ParsedLead {
  return {
    title: subject || "Untitled lead",
    description: `From: ${from}\n\n${text.slice(0, 3000)}`,
    source: "email",
    tags: [],
  };
}

async function ingestEmail(subject: string, text: string, html: string, from: string): Promise<string | null> {
  const isUpwork = from.includes("upwork.com") || subject.toLowerCase().includes("upwork");

  const parsed = isUpwork
    ? parseUpworkEmail(subject, text, html)
    : parseGenericEmail(subject, text, from);

  if (!parsed) return null;

  const hash = computeHash(parsed.title, parsed.description);

  const existing = await db.lead.findFirst({
    where: { OR: [{ contentHash: hash }, ...(parsed.sourceUrl ? [{ sourceUrl: parsed.sourceUrl }] : [])] },
  });

  if (existing) {
    console.log(`[email] Duplicate skipped: "${parsed.title}"`);
    return null;
  }

  const lead = await db.lead.create({
    data: {
      title: parsed.title,
      source: parsed.source,
      sourceUrl: parsed.sourceUrl || null,
      contentHash: hash,
      description: parsed.description,
      budget: parsed.budget || null,
      tags: parsed.tags,
      techStack: [],
    },
  });

  console.log(`[email] Created lead: "${lead.title}" (${lead.id})`);
  return lead.id;
}

export async function runEmailIngestion() {
  const host = process.env.IMAP_HOST;
  const port = parseInt(process.env.IMAP_PORT || "993");
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!host || !user || !pass) {
    console.log("[email] IMAP not configured (set IMAP_HOST, IMAP_USER, IMAP_PASS). Skipping.");
    return;
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    console.log("[email] Connected to IMAP server");

    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      let count = 0;
      for await (const message of client.fetch(
        { since, seen: false },
        { source: true, envelope: true }
      )) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source as any);
        const subject = (parsed as any).subject || "";
        const text = (parsed as any).text || "";
        const html = (parsed as any).html || "";
        const from = (parsed as any).from?.text || "";

        const leadId = await ingestEmail(subject, text, html, from);
        if (leadId) count++;
      }

      console.log(`[email] Ingestion complete: ${count} new leads`);
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("[email] Error:", err);
  } finally {
    await db.$disconnect();
  }
}
