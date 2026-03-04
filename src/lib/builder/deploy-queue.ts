/**
 * BullMQ queue for async builder deploys.
 * When Redis is available, deploy runs in background; API returns 202.
 */
import { createQueue } from "@/lib/queue";

const QUEUE_NAME = "builder-deploy";

export type BuilderDeployJobData = {
  deliveryProjectId: string;
  siteId: string;
  domain?: string;
};

let _queue: ReturnType<typeof createQueue> | null = null;

function getQueue() {
  if (!_queue) _queue = createQueue(QUEUE_NAME);
  return _queue;
}

export async function addDeployJob(data: BuilderDeployJobData): Promise<string> {
  const queue = getQueue();
  const job = await queue.add("deploy", data, { attempts: 2, backoff: { type: "exponential", delay: 5000 } });
  return job.id ?? String(job.id);
}
