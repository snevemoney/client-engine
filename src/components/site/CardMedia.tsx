"use client";

import { useEffect, useRef, useState } from "react";
import { rootPublicSrc } from "@/lib/base-path";
import { isVideoPath, resolveCardStillSrc, withVideoCacheBust } from "@/lib/site/media-path";
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

/** Visible from first paint — never opacity-0 (iOS will not decode a hidden video). */
const VIDEO_LAYER_CLASS = "absolute inset-0 h-full w-full object-cover object-top opacity-100";

/**
 * Catalog media: muted looping preview when the path is a video,
 * otherwise the existing still.
 *
 * Fill cards (public /work grid) layer a still under a fully visible
 * <video>. HTML poster and opacity-0 both break iOS Safari: poster
 * sticks on the first frame, and a hidden video never paints or plays.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillSrc = resolveCardStillSrc(src, siblings);
  const showVideo = isVideoPath(src) && !videoFailed;

  useEffect(() => {
    if (!showVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      const playResult = video.play();
      if (playResult) {
        playResult.catch(() => {
          /* iOS may reject until the next in-view tick */
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) tryPlay();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(video);
    tryPlay();
    return () => observer.disconnect();
  }, [showVideo, src]);

  if (!showVideo) {
    return (
      <ScreenshotImg
        src={isVideoPath(src) ? stillSrc : src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  const videoSrc = rootPublicSrc(withVideoCacheBust(src));
  const videoEl = (
    <video
      ref={videoRef}
      src={videoSrc}
      muted
      defaultMuted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-label={alt}
      className={VIDEO_LAYER_CLASS}
      onError={() => setVideoFailed(true)}
    />
  );

  if (fill) {
    return (
      <>
        <ScreenshotImg src={stillSrc} alt={alt} fill className={className} />
        {videoEl}
      </>
    );
  }

  return (
    <div className="relative">
      <ScreenshotImg
        src={stillSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
      {videoEl}
    </div>
  );
}
