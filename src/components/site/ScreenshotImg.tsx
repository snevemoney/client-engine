import { rootPublicSrc } from "@/lib/base-path";

type ScreenshotImgProps = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
};

/**
 * Domain-root /screenshots — same files /work already serves.
 * next/image under /pro hits /pro/_next/image and 400s.
 */
export function ScreenshotImg({
  src,
  alt,
  fill,
  width,
  height,
  className = "",
}: ScreenshotImgProps) {
  const resolved = rootPublicSrc(src);
  if (fill) {
    return (
      <img
        src={resolved}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover object-top ${className}`.trim()}
      />
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      width={width ?? 1200}
      height={height ?? 675}
      className={className}
    />
  );
}
