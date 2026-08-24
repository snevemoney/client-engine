"use client";

import { useEffect, useRef, useState } from "react";
import { rootPublicSrc } from "@/lib/base-path";
import { isVideoPath, previewVideoSources, resolvePosterSrc, withVideoCacheBust } from "@/lib/site/media-path";
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
const VIDEO_LAYER_CLASS =
  "absolute inset-0 z-[1] h-full w-full object-cover object-center opacity-100";

/**
 * Catalog media: muted looping preview when the path is a video,
 * otherwise the existing still (`src` unchanged — never the next sibling).
 *
 * Videos always layer a still under a fully visible <video>. HTML poster
 * and opacity-0 both break iOS Safari: poster sticks on the first frame,
 * and a hidden video never paints or plays. Non-fill (case-page gallery)
 * wraps the still in a relative box and absolutely positions the video
 * on top — never return video-only. Fill cards use still z-0 + video z-1.
 * Sources are H.264 MP4 first, then WebM — Safari cannot decode WebM.
 * Video fallback is NETWORK_NO_SOURCE only so a missing MP4 can still try WebM.
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
  const video = isVideoPath(src);
  const poster = video ? resolvePosterSrc(src, siblings) : undefined;
  const heroFromSrc = src.replace(/preview\.(webm|mp4|mov)$/i, "1-hero.jpg");
  const stillSrc = video ? withVideoCacheBust(poster || heroFromSrc) : src;
  const showVideo = video && !videoFailed;

  useEffect(() => {
    if (!showVideo) return;
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const tryPlay = () => {
      const playResult = el.play();
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

    observer.observe(el);
    tryPlay();
    return () => observer.disconnect();
  }, [showVideo, src]);

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

  const sources = previewVideoSources(src);
  const videoEl = (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-label={alt}
      className={VIDEO_LAYER_CLASS}
      onError={(event) => {
        if (event.currentTarget.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          setVideoFailed(true);
        }
      }}
    >
      {sources.map((source) => (
        <source key={source.type} src={rootPublicSrc(source.src)} type={source.type} />
      ))}
    </video>
  );

  if (fill) {
    return (
      <>
        <ScreenshotImg
          src={stillSrc}
          alt={alt}
          fill
          className={["z-0", className].filter(Boolean).join(" ")}
        />
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
