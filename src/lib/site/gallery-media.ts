import { isImagePath, isVideoPath, resolvePosterSrc } from "./media-path";

/** Keep videos + stills that aren't just the poster for a listed video. */
export function galleryMediaItems(screenshots: string[]): string[] {
  const videos = screenshots.filter(isVideoPath);
  const posterOfVideo = new Set(
    videos
      .map((v) => resolvePosterSrc(v, screenshots))
      .filter((p): p is string => Boolean(p))
  );
  return screenshots.filter((src) => {
    if (isVideoPath(src)) return true;
    if (isImagePath(src) && posterOfVideo.has(src)) return false;
    return true;
  });
}
