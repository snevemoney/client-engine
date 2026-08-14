/**
 * Primary provider: youtube-transcript npm packages.
 * Tries `youtube-transcript` first, then `@danielxceron/youtube-transcript` as a variant.
 *
 * IMPORTANT: use static imports so Next.js standalone file-tracing includes these
 * packages in the runner image. Dynamic `import()` was failing in production with
 * "Cannot find package 'youtube-transcript'" because the Dockerfile only copies
 * selectively into the slim runner.
 */

import { YoutubeTranscript } from "youtube-transcript";
import { YoutubeTranscript as AltYoutubeTranscript } from "@danielxceron/youtube-transcript";
import type { TranscriptProvider, ProviderResult, TranscriptSegment, VideoMeta } from "../types";
import { ytLog } from "../types";

const PROVIDER_NAME = "transcript-api";

export const transcriptApiProvider: TranscriptProvider = {
  name: PROVIDER_NAME,

  available() {
    return true;
  },

  async fetch(videoId: string): Promise<ProviderResult> {
    const meta: VideoMeta = { videoId, title: `Video ${videoId}` };

    // Attempt 1: youtube-transcript
    try {
      const list = await YoutubeTranscript.fetchTranscript(videoId);
      const segments: TranscriptSegment[] = list.map((item) => ({
        text: item.text,
        start: item.offset / 1000,
        duration: item.duration / 1000,
      }));
      if (segments.length > 0) {
        ytLog("info", "transcript-api primary success", { videoId, segments: segments.length });
        return { ok: true, provider: PROVIDER_NAME, segments, meta };
      }
    } catch (err) {
      ytLog("warn", "transcript-api primary failed", {
        videoId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Attempt 2: @danielxceron/youtube-transcript (fork with sometimes different behavior)
    try {
      const list = await AltYoutubeTranscript.fetchTranscript(videoId);
      const segments: TranscriptSegment[] = list.map(
        (item: { text: string; offset: number; duration: number }) => ({
          text: item.text,
          start: item.offset / 1000,
          duration: item.duration / 1000,
        }),
      );
      if (segments.length > 0) {
        ytLog("info", "transcript-api alt-fork success", { videoId, segments: segments.length });
        return { ok: true, provider: `${PROVIDER_NAME}:alt`, segments, meta };
      }
    } catch (err) {
      ytLog("warn", "transcript-api alt-fork failed", {
        videoId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      ok: false,
      provider: PROVIDER_NAME,
      error: "Both transcript-api variants failed",
      code: "TRANSCRIPT_UNAVAILABLE",
    };
  },
};
