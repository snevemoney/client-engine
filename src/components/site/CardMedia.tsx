"use client";

import { useEffect, useRef, useState } from "react";
import { rootPublicSrc } from "@/lib/base-path";
import { isVideoPath, resolvePosterSrc, videoSourceCandidates } from "@/lib/site/media-path";
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
 * (or same path with .jpg). Offers MP4 then WebM so Safari can play.
 * Both sources failing falls back to the still.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const poster = resolvePosterSrc(src, siblings);
  const showVideo = isVideoPath(src) && !videoFailed;
  const stillSrc = !showVideo && isVideoPath(src) ? (poster ?? src) : src;
  const sources = videoSourceCandidates(src);

  useEffect(() => {
    if (!showVideo) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    void el.play().catch(() => {});
  }, [src, showVideo]);

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
      ref={videoRef}
      poster={poster ? rootPublicSrc(poster) : undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-label={alt}
      className={videoClass}
      onError={() => setVideoFailed(true)}
    >
      {sources.map((candidate) => (
        <source
          key={`${candidate.type}:${candidate.src}`}
          src={rootPublicSrc(candidate.src)}
          type={candidate.type}
        />
      ))}
    </video>
  );
}
