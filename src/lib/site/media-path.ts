const VIDEO_EXT = new Set([".webm", ".mp4", ".mov"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/** Product /work slugs that get an additive preview.webm prepend. */
export const PRODUCT_WORK_PREVIEW_SLUGS = [
  "autoflow",
  "proof-qc-assist",
  "clearfield",
  "quickmarket",
] as const;

export type ProductWorkPreviewSlug = (typeof PRODUCT_WORK_PREVIEW_SLUGS)[number];

function pathOnly(src: string): string {
  return src.split("?")[0]?.split("#")[0] ?? src;
}

function extOf(src: string): string {
  const path = pathOnly(src);
  const i = path.lastIndexOf(".");
  if (i < 0) return "";
  return path.slice(i).toLowerCase();
}

export function isVideoPath(src: string): boolean {
  if (!src) return false;
  return VIDEO_EXT.has(extOf(src));
}

export function isImagePath(src: string): boolean {
  if (!src) return false;
  return IMAGE_EXT.has(extOf(src));
}

export function workPreviewPath(slug: string): string {
  return `/screenshots/${slug}/preview.webm`;
}

/** Poster: next image sibling in the list, else same path with .jpg. */
export function resolvePosterSrc(src: string, siblings: string[] = []): string | undefined {
  const idx = siblings.indexOf(src);
  const after = idx >= 0 ? siblings.slice(idx + 1) : siblings;
  const nextImage = after.find((item) => item !== src && isImagePath(item));
  if (nextImage) return nextImage;

  const path = pathOnly(src);
  const i = path.lastIndexOf(".");
  if (i < 0) return undefined;
  return `${path.slice(0, i)}.jpg`;
}

/** Prepend preview.webm when missing. Does not drop or rewrite other paths. */
export function prependPreviewWebm(screenshots: string[], slug: string): string[] {
  const preview = workPreviewPath(slug);
  if (screenshots.includes(preview)) return screenshots;
  return [preview, ...screenshots];
}
