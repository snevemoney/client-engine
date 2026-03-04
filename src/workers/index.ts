import { createWorker } from "../lib/queue";
import { runMonitor } from "./monitor";

console.log("[worker] Starting worker processes...");

interface LeadJob { leadId: string }
interface MonitorJob { type: string }

const enrichWorker = createWorker<LeadJob>("enrich", async (job) => {
  console.log(`[enrich] Processing lead ${job.data.leadId}`);
});

const scoreWorker = createWorker<LeadJob>("score", async (job) => {
  console.log(`[score] Processing lead ${job.data.leadId}`);
});

const monitorWorker = createWorker<MonitorJob>("monitor", async (job) => {
  console.log(`[monitor] Running check: ${job.data.type}`);
});

// Builder deploy worker: processes async deploy jobs from API
interface BuilderDeployJob { deliveryProjectId: string; siteId: string; domain?: string }
const builderDeployWorker = createWorker<BuilderDeployJob>("builder-deploy", async (job) => {
  const { deliveryProjectId, siteId, domain } = job.data;
  const { deploySite } = await import("../lib/builder/client");
  const { db } = await import("../lib/db");
  const deployed = await deploySite(siteId, domain);
  await db.$transaction([
    db.deliveryProject.update({
      where: { id: deliveryProjectId },
      data: { builderLiveUrl: deployed.liveUrl, artifactUrl: deployed.liveUrl },
    }),
    db.deliveryActivity.create({
      data: {
        deliveryProjectId,
        type: "note",
        message: `Website deployed to production: ${deployed.liveUrl}`,
        metaJson: { action: "builder_site_deployed", siteId: deployed.siteId, liveUrl: deployed.liveUrl },
      },
    }),
  ]);
  return { siteId: deployed.siteId, liveUrl: deployed.liveUrl };
});

// Email ingestion runs every 15 minutes (optional: requires imapflow/mailparser)
const EMAIL_INTERVAL = 15 * 60 * 1000;
async function emailLoop() {
  let runEmailIngestion: (() => Promise<void>) | null = null;
  try {
    const mod = await import("./email-ingestion");
    runEmailIngestion = mod.runEmailIngestion;
  } catch {
    console.log("[worker] Email ingestion skipped (imapflow/mailparser not available).");
  }
  while (true) {
    try {
      if (runEmailIngestion) await runEmailIngestion();
    } catch (err) {
      console.error("[email] Loop error:", err);
    }
    await new Promise((r) => setTimeout(r, EMAIL_INTERVAL));
  }
}

emailLoop();

// Website monitor runs every hour
const MONITOR_INTERVAL = 60 * 60 * 1000;
async function monitorLoop() {
  while (true) {
    try {
      await runMonitor();
    } catch (err) {
      console.error("[monitor] Loop error:", err);
    }
    await new Promise((r) => setTimeout(r, MONITOR_INTERVAL));
  }
}

monitorLoop();

process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...");
  await enrichWorker.close();
  await scoreWorker.close();
  await monitorWorker.close();
  await builderDeployWorker.close();
  process.exit(0);
});

console.log("[worker] Workers ready. Email ingestion running every 15 minutes.");
