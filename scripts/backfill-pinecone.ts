/**
 * One-time script to index all existing artifacts into Pinecone.
 * Run: npx tsx scripts/backfill-pinecone.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "client-engine-artifacts";
const NAMESPACE = "artifacts";
const BATCH_SIZE = 50;

async function getIndexHost(): Promise<string> {
  const res = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX_NAME}`, {
    headers: { "Api-Key": PINECONE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Pinecone describe index failed: ${res.status}`);
  const data = await res.json();
  return `https://${data.host}`;
}

async function upsertBatch(
  host: string,
  records: Array<{ _id: string; content: string; leadId: string; artifactType: string; title: string; createdAt: string }>,
): Promise<void> {
  const res = await fetch(`${host}/records/namespaces/${NAMESPACE}/upsert`, {
    method: "POST",
    headers: {
      "Api-Key": PINECONE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Upsert failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function main() {
  if (!PINECONE_API_KEY) {
    console.error("PINECONE_API_KEY is required");
    process.exit(1);
  }

  console.log("Resolving Pinecone index host...");
  const host = await getIndexHost();
  console.log(`Index host: ${host}`);

  let cursor: string | undefined;
  let total = 0;

  do {
    const artifacts = await db.artifact.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      where: { type: { in: ["notes", "positioning", "proposal", "research"] } },
    });

    if (artifacts.length === 0) break;

    const records = artifacts.map((a) => ({
      _id: a.id,
      content: a.content.slice(0, 8000),
      leadId: a.leadId,
      artifactType: a.type,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
    }));

    await upsertBatch(host, records);
    total += artifacts.length;
    cursor = artifacts[artifacts.length - 1].id;
    console.log(`Indexed ${total} artifacts...`);
  } while (cursor);

  console.log(`Done. Total indexed: ${total}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
