/**
 * Fallback 3 (optional): Audio extraction + OpenAI Whisper transcription.
 * Requires yt-dlp for audio download and OPENAI_API_KEY for Whisper API.
 * Feature-flagged: set YOUTUBE_WHISPER_ENABLED=1 to enable.
 */

import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "whisper";
const MAX_AUDIO_SIZE_MB = 25;

function isEnabled(): boolean {
  return (
    (process.env.YOUTUBE_WHISPER_ENABLED === "1" || process.env.YOUTUBE_WHISPER_ENABLED === "true") &&
    !!process.env.OPENAI_API_KEY
  );
}

function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

export const whisperProvider: TranscriptProvider = {
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
      return { ok: false, provider: PROVIDER_NAME, error: "Whisper not enabled", code: "NOT_CONFIGURED" };
    }

    const meta: VideoMeta = { videoId };
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const tmpId = randomBytes(6).toString("hex");
    const audioPath = join(tmpdir(), `yt-audio-${tmpId}.mp3`);

    try {
      await exec("yt-dlp", [
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "-o", audioPath,
        videoUrl,
      ]);
    } catch (err) {
      ytLog("warn", "whisper: audio download failed", { videoId, error: err instanceof Error ? err.message : String(err) });
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: "Audio download failed",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    }

    try {
      const stats = await stat(audioPath);
      if (stats.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
        await unlink(audioPath).catch(() => {});
        return {
          ok: false,
          provider: PROVIDER_NAME,
          error: `Audio file too large (${(stats.size / 1024 / 1024).toFixed(1)}MB > ${MAX_AUDIO_SIZE_MB}MB)`,
          code: "UNSUPPORTED",
        };
      }
    } catch {
      return { ok: false, provider: PROVIDER_NAME, error: "Audio file missing after download", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    let transcriptionData: { text: string; segments?: { text: string; start: number; end: number }[]; language?: string };
    try {
      const audioBuffer = await readFile(audioPath);
      const blob = new Blob([audioBuffer], { type: "audio/mp3" });
      const form = new FormData();
      form.append("file", blob, "audio.mp3");
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");
      form.append("language", "en");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Whisper API ${res.status}: ${errText}`);
      }
      transcriptionData = await res.json();
    } catch (err) {
      ytLog("warn", "whisper API failed", { videoId, error: err instanceof Error ? err.message : String(err) });
      return {
        ok: false,
        provider: PROVIDER_NAME,
        error: err instanceof Error ? err.message : "Whisper API call failed",
        code: "TRANSCRIPT_UNAVAILABLE",
      };
    } finally {
      await unlink(audioPath).catch(() => {});
    }

    const segments: TranscriptSegment[] =
      transcriptionData.segments?.map((s) => ({
        text: s.text.trim(),
        start: s.start,
        duration: s.end - s.start,
      })) ?? (transcriptionData.text ? [{ text: transcriptionData.text }] : []);

    if (segments.length === 0) {
      return { ok: false, provider: PROVIDER_NAME, error: "Whisper returned empty transcript", code: "TRANSCRIPT_UNAVAILABLE" };
    }

    meta.language = transcriptionData.language ?? "en";
    ytLog("info", "whisper success", { videoId, segments: segments.length });
    return { ok: true, provider: PROVIDER_NAME, segments, meta, language: meta.language, confidence: 0.85 };
  },
};
