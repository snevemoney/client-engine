import { Queue, Worker, type Processor } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const parsed = new URL(redisUrl);

const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379"),
};

export { connection };

export function createQueue(name: string) {
  return new Queue(name, { connection });
}

export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
) {
  return new Worker<T>(name, processor, { connection });
}
