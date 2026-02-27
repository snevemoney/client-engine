/**
 * Pinecone semantic search for artifacts.
 * All functions are no-ops when PINECONE_API_KEY is not set.
 * Uses Pinecone's integrated embedding (multilingual-e5-large) — no separate embedding calls.
 */

import { trackedFetch } from "@/lib/integrations/usage";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || "client-engine-artifacts";
const NAMESPACE = "artifacts";

function isEnabled(): boolean {
  return !!PINECONE_API_KEY;
}

let _host: string | null = null;

async function getIndexHost(): Promise<string> {
  if (_host) return _host;
  const res = await trackedFetch("pinecone", "describe_index", `https://api.pinecone.io/indexes/${PINECONE_INDEX_NAME}`, {
    headers: { "Api-Key": PINECONE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Pinecone describe index failed: ${res.status}`);
  const data = await res.json();
  _host = `https://${data.host}`;
  return _host;
}

/**
 * Upsert a single artifact into Pinecone. Fire-and-forget safe.
 */
export async function upsertArtifact(artifact: {
  id: string;
  leadId: string;
  type: string;
  title: string;
  content: string;
  createdAt: Date;
}): Promise<void> {
  if (!isEnabled()) return;
  try {
    const host = await getIndexHost();
    await trackedFetch("pinecone", "upsert", `${host}/records/namespaces/${NAMESPACE}/upsert`, {
      method: "POST",
      headers: {
        "Api-Key": PINECONE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            _id: artifact.id,
            content: artifact.content.slice(0, 8000),
            leadId: artifact.leadId,
            artifactType: artifact.type,
            title: artifact.title,
            createdAt: artifact.createdAt.toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[pinecone] upsert failed:", err);
  }
}

export type SearchResult = {
  id: string;
  score: number;
  content: string;
  leadId: string;
  title: string;
};

/**
 * Search Pinecone for artifacts semantically related to a query.
 * Returns empty array on failure (graceful degradation).
 */
export async function searchArtifacts(
  query: string,
  opts?: { topK?: number; leadId?: string; artifactType?: string },
): Promise<SearchResult[]> {
  if (!isEnabled()) return [];
  const topK = opts?.topK ?? 5;
  const filter: Record<string, unknown> = {};
  if (opts?.leadId) filter.leadId = { $eq: opts.leadId };
  if (opts?.artifactType) filter.artifactType = { $eq: opts.artifactType };

  try {
    const host = await getIndexHost();
    const body: Record<string, unknown> = {
      query: {
        topK,
        inputs: { text: query },
        ...(Object.keys(filter).length ? { filter } : {}),
      },
    };
    const res = await trackedFetch("pinecone", "search", `${host}/records/namespaces/${NAMESPACE}/search`, {
      method: "POST",
      headers: {
        "Api-Key": PINECONE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.result?.hits ?? []).map((hit: Record<string, unknown>) => {
      const fields = (hit.fields ?? {}) as Record<string, unknown>;
      return {
        id: hit._id as string,
        score: hit._score as number,
        content: (fields.content as string) ?? "",
        leadId: (fields.leadId as string) ?? "",
        title: (fields.title as string) ?? "",
      };
    });
  } catch (err) {
    console.error("[pinecone] search failed:", err);
    return [];
  }
}
