"use client";

import { useState } from "react";
import { rootPublicSrc } from "@/lib/base-path";
import { isVideoPath, resolvePosterSrc } from "@/lib/site/media-path";
import { ScreenshotImg } from "@/components/site/ScreenshotImg";

type CardMediaProps = {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  siblings?: string[];
};

/**
 * Catalog media: muted looping preview when the path is a video,
 * otherwise the existing still. Poster is the next image sibling
 * (or same path with .jpg). Missing webms fall back to the still.
 */
export function CardMedia({
  src,
  alt,
  fill,
  width,
  height,
  className = "",
  siblings = [],
}: CardMediaProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const poster = resolvePosterSrc(src, siblings);
  const showVideo = isVideoPath(src) && !videoFailed;
  const stillSrc = !showVideo && isVideoPath(src) ? (poster ?? src) : src;

  if (!showVideo) {
    return (
      <ScreenshotImg
        src={stillSrc}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  const videoClass = fill
    ? `absolute inset-0 h-full w-full object-cover object-top ${className}`.trim()
    : className;

  return (
    <video
      src={rootPublicSrc(src)}
      poster={poster ? rootPublicSrc(poster) : undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-label={alt}
      className={videoClass}
      onError={() => setVideoFailed(true)}
    />
  );
}
