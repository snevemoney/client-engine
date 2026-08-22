import { isImagePath, isVideoPath, resolvePosterSrc } from "@/lib/site/media-path";

/**
 * Case-page gallery items: keep videos and real stills.
 * Drop a still only when it is merely the poster for a listed video
 * (proof rows: [preview.webm, 1-hero.jpg]). Product galleries that
 * also use the first still as a poster keep every still.
 */
export function galleryMediaItems(screenshots: string[]): string[] {
  const listedPosters = new Set<string>();
  for (const src of screenshots) {
    if (!isVideoPath(src)) continue;
    const poster = resolvePosterSrc(src, screenshots);
    if (poster && screenshots.includes(poster)) listedPosters.add(poster);
  }

  const hasIndependentStill = screenshots.some((src) => isImagePath(src) && !listedPosters.has(src));

  return screenshots.filter((src) => {
    if (isVideoPath(src)) return true;
    if (listedPosters.has(src) && !hasIndependentStill) return false;
    return true;
  });
}
