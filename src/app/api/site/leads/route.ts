import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { sendLeadEvent } from "@/lib/meta-capi";
import { rateLimit } from "@/lib/rate-limit";

const SITE_LEADS_LIMIT = 10;
const SITE_LEADS_WINDOW_MS = 60_000; // 10 per minute per IP

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLeadEmailPayload(opts: {
  name: string;
  email: string;
  company?: string;
  website?: string;
  message: string;
  title: string;
}) {
  const body = [
    opts.message && `Message: ${opts.message}`,
    opts.company && `Company: ${opts.company}`,
    opts.website && `Website: ${opts.website}`,
  ]
    .filter(Boolean)
    .join("\n");
  const subject = `Website lead: ${escapeHtml(opts.title)}`;
  const text = `${opts.name} <${opts.email}> wrote:\n\n${body || "(No message)"}`;
  const html = [
    `<p><strong>${escapeHtml(opts.name)}</strong> &lt;${escapeHtml(opts.email)}&gt;</p>`,
    body ? `<pre style="white-space:pre-wrap;">${escapeHtml(body)}</pre>` : "<p>(No message)</p>",
    `<p><a href="mailto:${opts.email}">Reply to ${opts.email}</a></p>`,
  ].join("");
  return { subject, text, html };
}

async function sendLeadNotificationResend(opts: { to: string; replyTo: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.SITE_FROM_EMAIL ?? "Website <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      reply_to: opts.replyTo,
      text: opts.text,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    console.error("[site/leads] Resend error:", res.status, await res.text());
    return false;
  }
  return true;
}

async function sendLeadNotificationSMTP(opts: { to: string; replyTo: string; subject: string; text: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER ?? process.env.IMAP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.IMAP_PASS;
  if (!host || !user || !pass) return false;
  const from = process.env.SITE_FROM_EMAIL ?? user;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: { user, pass },
  });
  try {
    await transporter.sendMail({
      from: from.includes("<") ? from : `${from.split("@")[0]} <${from}>`,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("[site/leads] SMTP error:", e);
    return false;
  }
}

async function sendLeadNotification(opts: {
  to: string;
  name: string;
  email: string;
  company?: string;
  website?: string;
  message: string;
  title: string;
}) {
  const { subject, text, html } = buildLeadEmailPayload(opts);
  const sent = (await sendLeadNotificationResend({ to: opts.to, replyTo: opts.email, subject, text, html }))
    || (await sendLeadNotificationSMTP({ to: opts.to, replyTo: opts.email, subject, text, html }));
  if (!sent && (process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.IMAP_USER)) {
    console.warn("[site/leads] No email sent: set RESEND_API_KEY, or SMTP_HOST+SMTP_USER+SMTP_PASS (same mailbox as IMAP_* for Hostinger), and NOTIFY_EMAIL.");
  }
}

const MAX_EMAIL = 255;
const MAX_NAME = 255;
const MAX_COMPANY = 255;
const MAX_WEBSITE = 500;
const MAX_MESSAGE = 2000;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const rlKey = `site-leads:${clientIp}`;
  const rl = rateLimit(rlKey, SITE_LEADS_LIMIT, SITE_LEADS_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: { name?: string; email?: string; company?: string; website?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = truncate((typeof body.name === "string" ? body.name.trim() : ""), MAX_NAME);
  const email = truncate((typeof body.email === "string" ? body.email.trim() : ""), MAX_EMAIL);
  const company = typeof body.company === "string" ? truncate(body.company.trim(), MAX_COMPANY) || undefined : undefined;
  const website = typeof body.website === "string" ? truncate(body.website.trim(), MAX_WEBSITE) || undefined : undefined;
  const message = truncate((typeof body.message === "string" ? body.message.trim() : ""), MAX_MESSAGE);
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

    const notifyEmail = process.env.NOTIFY_EMAIL ?? "contact@evenslouis.ca";
    await sendLeadNotification({
      to: notifyEmail,
      name: name || "Someone",
      email,
      company,
      website,
      message,
      title,
    });

    const sourceUrl = req.headers.get("referer") ?? req.headers.get("origin");
    void sendLeadEvent({
      eventId: lead.id,
      email,
      leadId: lead.id,
      contentName: title,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined,
      clientUserAgent: req.headers.get("user-agent") ?? undefined,
      eventSourceUrl: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : undefined,
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (e) {
    console.error("[site/leads POST]", e);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
