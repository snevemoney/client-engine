/**
 * Fallback 2: yt-dlp subtitle extraction.
 * Only available if `yt-dlp` binary is installed in the environment.
 * Feature-flagged: set YOUTUBE_YTDLP_ENABLED=1 to enable.
 */

import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "yt-dlp";

function isEnabled(): boolean {
  return process.env.YOUTUBE_YTDLP_ENABLED === "1" || process.env.YOUTUBE_YTDLP_ENABLED === "true";
}

function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

function parseVttSegments(vtt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vtt.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/,
    );
    if (timeMatch) {
      const startSec =
        Number(timeMatch[1]) * 3600 +
        Number(timeMatch[2]) * 60 +
        Number(timeMatch[3]) +
        Number(timeMatch[4]) / 1000;
      const endSec =
        Number(timeMatch[5]) * 3600 +
        Number(timeMatch[6]) * 60 +
        Number(timeMatch[7]) +
        Number(timeMatch[8]) / 1000;
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== "") {
        textLines.push(lines[i]!.trim());
        i++;
      }
      const text = textLines.join(" ").replace(/<[^>]+>/g, "").trim();
      if (text) {
        segments.push({ text, start: startSec, duration: endSec - startSec });
      }
    }
    i++;
  }
  return segments;
}

export const ytDlpProvider: TranscriptProvider = {
  name: PROVIDER_NAME,

  async available(): Promise<boolean> {
    if (!isEnabled()) return false;
    try {
      await exec("yt-dlp", ["--version"]);
      return true;
    } catch {
      return false;
    }
  },

  async fetch(videoId: string): Promise<ProviderResult> {
    if (!isEnabled()) {
      return { ok: false, provider: PROVIDER_NAME, error: "yt-dlp not enabled", code: "NOT_CONFIGURED" };
    }

    const meta: VideoMeta = { videoId };
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const tmpId = randomBytes(6).toString("hex");
    const outTemplate = join(tmpdir(), `yt-sub-${tmpId}`);

    try {
      await exec("yt-dlp", [
        "--skip-download",
        "--write-auto-sub",
        "--write-sub",
        "--sub-lang", "en",
        "--sub-format", "vtt",
        "-o", outTemplate,
        videoUrl,
      ]);
    } catch (err) {
      ytLog("warn", "yt-dlp exec failed", { videoId, error: err instanceof Error ? err.message : String(err) });
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: err instanceof Error ? err.message : "yt-dlp failed",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    const candidates = [`${outTemplate}.en.vtt`, `${outTemplate}.en.auto.vtt`];
    let vttContent: string | null = null;
    for (const path of candidates) {
      try {
        vttContent = await readFile(path, "utf-8");
        await unlink(path).catch(() => {});
        break;
      } catch {
        continue;
      }
    }

    if (!vttContent) {
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: "No VTT subtitle file produced",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    const segments = parseVttSegments(vttContent);
    if (segments.length === 0) {
      return { ok: false, provider: PROVIDER_NAME, error: "Empty VTT content", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    ytLog("info", "yt-dlp success", { videoId, segments: segments.length });
    return { ok: true, provider: PROVIDER_NAME, segments, meta, language: "en" };
  },
};
