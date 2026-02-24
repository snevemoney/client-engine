/**
 * Operator notifications: pipeline failures, health failures, new proposals ready.
 * Uses NOTIFY_EMAIL and Resend or SMTP (same as site form).
 */

import nodemailer from "nodemailer";

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? "contact@evenslouis.ca";

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

async function sendResend(opts: { subject: string; text: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.SITE_FROM_EMAIL ?? "Client Engine <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [NOTIFY_EMAIL],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    console.error("[notify] Resend error:", res.status, await res.text());
    return false;
  }
  return true;
}

async function sendSMTP(opts: { subject: string; text: string; html: string }): Promise<boolean> {
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
      to: NOTIFY_EMAIL,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("[notify] SMTP error:", e);
    return false;
  }
}

function getAppUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return u || "https://evenslouis.ca";
}

type WebhookContext = {
  event: string;
  leadId?: string;
  leadTitle?: string;
  leadStatus?: string;
  message: string;
  stepName?: string;
  count?: number;
  leadIds?: string[];
};

async function sendWebhook(opts: {
  subject: string;
  text: string;
  context?: WebhookContext;
}): Promise<boolean> {
  const url = process.env.NOTIFY_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url?.trim()) return false;
  const appUrl = getAppUrl();
  const ctx = opts.context;
  let payload: Record<string, unknown>;
  if (url.includes("discord.com")) {
    const lines = [`**${opts.subject}**`, "", opts.text.slice(0, 1600)];
    if (ctx) {
      if (ctx.leadId) lines.push(`Lead ID: \`${ctx.leadId}\``);
      if (ctx.leadTitle) lines.push(`Lead: ${ctx.leadTitle}`);
      if (ctx.leadStatus) lines.push(`Status: ${ctx.leadStatus}`);
      if (ctx.stepName) lines.push(`Step: ${ctx.stepName}`);
      if (ctx.leadIds?.length) {
        const links = ctx.leadIds.slice(0, 5).map((id) => `${appUrl}/dashboard/leads/${id}`);
        lines.push(...links);
      } else if (ctx.leadId) {
        lines.push(`Open: ${appUrl}/dashboard/leads/${ctx.leadId}`);
      }
    }
    payload = { content: lines.join("\n") };
  } else {
    payload = ctx
      ? {
          event: ctx.event,
          leadId: ctx.leadId,
          leadTitle: ctx.leadTitle,
          leadStatus: ctx.leadStatus,
          stepName: ctx.stepName,
          count: ctx.count,
          leadIds: ctx.leadIds,
          message: opts.text.slice(0, 2000),
          appUrl: ctx.leadId ? `${appUrl}/dashboard/leads/${ctx.leadId}` : appUrl,
        }
      : { text: `${opts.subject}\n\n${opts.text}` };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("[notify] Webhook error:", e);
    return false;
  }
}

/** Send operator alert (fire-and-forget). No-op if no email configured. */
export function sendOperatorAlert(opts: {
  subject: string;
  body: string;
  webhookContext?: WebhookContext;
}): void {
  const html = opts.body.replace(/\n/g, "<br>\n");
  Promise.all([
    sendResend({ subject: opts.subject, text: opts.body, html }),
    sendSMTP({ subject: opts.subject, text: opts.body, html }),
    sendWebhook({ subject: opts.subject, text: opts.body, context: opts.webhookContext }),
  ]).then(([a, b]) => {
    if (!a && !b && (process.env.RESEND_API_KEY || process.env.SMTP_HOST)) {
      console.warn("[notify] Could not send operator alert (check NOTIFY_EMAIL)");
    }
  });
}

export function notifyPipelineFailure(
  leadId: string,
  leadTitle: string,
  stepName: string,
  errMessage: string,
  leadStatus?: string
): void {
  const appUrl = getAppUrl();
  const statusLine = leadStatus ? `Status: ${leadStatus}` : null;
  const body = [
    `Pipeline run failed.`,
    ``,
    `Lead: ${leadTitle}`,
    `Lead ID: ${leadId}`,
    statusLine,
    `Step: ${stepName}`,
    `Error: ${errMessage}`,
    appUrl ? `` : "",
    appUrl ? `Dashboard: ${appUrl}/dashboard/leads/${leadId}` : "",
  ].filter(Boolean).join("\n");
  sendOperatorAlert({
    subject: `[Client Engine] Pipeline failed: ${stepName}`,
    body,
    webhookContext: { event: "pipeline_failure", leadId, leadTitle, leadStatus, stepName, message: errMessage },
  });
}

/** Call when research (or workday) creates new leads; pipeline will draft proposals. */
export function notifyNewProposalsReady(count: number, leadIds: string[]): void {
  const appUrl = getAppUrl();
  const links = leadIds.slice(0, 10).map((id) => `${appUrl}/dashboard/leads/${id}`).join("\n");
  const body = [
    `${count} new lead(s) created; pipeline will draft proposals.`,
    ``,
    links || "(no lead IDs)",
  ].join("\n");
  sendOperatorAlert({
    subject: `[Client Engine] ${count} new lead(s) from research`,
    body,
    webhookContext: { event: "proposals_ready", count, leadIds: leadIds.slice(0, 5), message: `${count} new leads` },
  });
}

export function notifyHealthFailure(reason: string): void {
  const body = `Health check failed: ${reason}`;
  sendOperatorAlert({
    subject: "[Client Engine] Health check failed",
    body,
    webhookContext: { event: "health_failure", message: reason },
  });
}
