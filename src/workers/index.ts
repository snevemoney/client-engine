import { createWorker } from "../lib/queue";

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

process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...");
  await enrichWorker.close();
  await scoreWorker.close();
  await monitorWorker.close();
  process.exit(0);
});

console.log("[worker] Workers ready. Waiting for jobs...");
