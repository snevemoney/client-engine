/**
 * RSS/Atom feed sync service.
 * Respects IntegrationMode: OFF/MOCK/MANUAL/LIVE.
 */

import Parser from "rss-parser";
import { db } from "@/lib/db";
import { scoreSignalItem } from "./scoring-rules";
import type { IntegrationMode } from "@prisma/client";

const parser = new Parser();

const MOCK_ITEMS = [
  { title: "Mock: Hiring trends in 2025", url: "https://example.com/mock-1", summary: "AI and automation in hiring", publishedAt: new Date() },
  { title: "Mock: Budget planning for startups", url: "https://example.com/mock-2", summary: "Revenue and growth tips", publishedAt: new Date() },
  { title: "Mock: Marketing automation guide", url: "https://example.com/mock-3", summary: "Lead conversion and ads", publishedAt: new Date() },
];

export type SyncResult = {
  ok: boolean;
  count: number;
  message: string;
};

export async function syncRssSource(
  sourceId: string,
  mode: IntegrationMode,
  isProduction: boolean
): Promise<SyncResult> {
  const source = await db.signalSource.findUnique({ where: { id: sourceId } });
  if (!source) return { ok: false, count: 0, message: "Source not found" };
  if (!source.enabled) return { ok: false, count: 0, message: "Source disabled" };

  const modeStr = mode;

  // OFF = no sync
  if (modeStr === "off") {
    await logSync(sourceId, modeStr, "success", "OFF mode: no sync", 0);
    return { ok: true, count: 0, message: "OFF mode: no sync" };
  }

  // LIVE only in production
  if (modeStr === "live" && !isProduction) {
    await logSync(sourceId, modeStr, "success", "Live mode only works when deployed; skipped", 0);
    return { ok: true, count: 0, message: "Live mode only works when deployed; skipped" };
  }

  // MANUAL = no auto sync (allow manual paste/import later)
  if (modeStr === "manual") {
    await logSync(sourceId, modeStr, "success", "MANUAL mode: no auto sync", 0);
    return { ok: true, count: 0, message: "MANUAL mode: no auto sync" };
  }

  // MOCK = insert mock items
  if (modeStr === "mock") {
    return runMockSync(sourceId);
  }

  // LIVE = real feed fetch
  if (modeStr === "live") {
    return runLiveSync(sourceId, source.url);
  }

  await logSync(sourceId, modeStr, "error", `Unknown mode: ${modeStr}`, 0);
  return { ok: false, count: 0, message: `Unknown mode: ${modeStr}` };
}

async function runMockSync(sourceId: string): Promise<SyncResult> {
  let count = 0;
  try {
    for (const item of MOCK_ITEMS) {
      const { score, tags } = scoreSignalItem(item.title, item.summary);
      const existing = await db.signalItem.findUnique({ where: { url: item.url } });
      if (!existing) {
        await db.signalItem.create({
          data: {
            sourceId,
            url: item.url,
            title: item.title,
            summary: item.summary,
            publishedAt: item.publishedAt,
            score,
            tags,
          },
        });
        count++;
      }
    }
    await db.signalSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date() },
    });
    await logSync(sourceId, "mock", "success", `Imported ${count} mock items`, count);
    return { ok: true, count, message: `Imported ${count} mock items` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mock sync failed";
    await logSync(sourceId, "mock", "error", msg, 0);
    return { ok: false, count: 0, message: msg };
  }
}

async function runLiveSync(sourceId: string, feedUrl: string): Promise<SyncResult> {
  let count = 0;
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = feed.items ?? [];

    for (const item of items) {
      const url = item.link || item.guid || `https://unknown/${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const existing = await db.signalItem.findUnique({ where: { url } });
      if (existing) continue;

      const title = item.title || "Untitled";
      const summary = item.contentSnippet || item.content || null;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      const { score, tags } = scoreSignalItem(title, summary);

      await db.signalItem.create({
        data: {
          sourceId,
          url,
          title,
          summary,
          publishedAt,
          rawJson: item as unknown as object,
          score,
          tags,
        },
      });
      count++;
    }

    await db.signalSource.update({
      where: { id: sourceId },
      data: { lastSyncedAt: new Date() },
    });
    await logSync(sourceId, "live", "success", `Fetched ${count} new items from ${items.length} total`, count);
    return { ok: true, count, message: `Fetched ${count} new items` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Feed fetch failed";
    await logSync(sourceId, "live", "error", msg, 0);
    return { ok: false, count: 0, message: msg };
  }
}

async function logSync(
  sourceId: string,
  mode: string,
  status: "success" | "error",
  message: string,
  count: number
) {
  await db.signalSyncLog.create({
    data: { sourceId, mode, status, message, count },
  });
}
