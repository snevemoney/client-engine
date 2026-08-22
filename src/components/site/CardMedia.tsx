"use client";

import { useEffect, useRef, useState } from "react";
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

const SOURCE_CACHE_BUST = "4";

function pathOnly(src: string): string {
  return src.split("?")[0]?.split("#")[0] ?? src;
}

function withCacheBust(src: string): string {
  const [path, hash] = src.split("#");
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}v=${SOURCE_CACHE_BUST}${hash ? `#${hash}` : ""}`;
}

/** MP4 first (iOS Safari), then WebM. Same basename as the catalog path. */
function previewSources(src: string): { src: string; type: string }[] {
  const path = pathOnly(src);
  const i = path.lastIndexOf(".");
  const base = i >= 0 ? path.slice(0, i) : path;
  return [
    { src: withCacheBust(rootPublicSrc(`${base}.mp4`)), type: "video/mp4" },
    { src: withCacheBust(rootPublicSrc(`${base}.webm`)), type: "video/webm" },
  ];
}

function tryPlay(el: HTMLVideoElement) {
  el.muted = true;
  el.defaultMuted = true;
  el.playsInline = true;
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  void el.play().catch(() => {
    // iOS can reject autoplay until the next canplay / intersection tick.
  });
}

/**
 * Catalog media: muted looping preview when the path is a video,
 * otherwise the existing still. Poster is the next image sibling
 * (or same path with .jpg). Missing files fall back only when the
 * element has no source (NETWORK_NO_SOURCE) — not on transient errors.
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
  const poster = resolvePosterSrc(src, siblings);
  const showVideo = isVideoPath(src) && !videoFailed;
  const stillSrc = !showVideo && isVideoPath(src) ? (poster ?? src) : src;

  useEffect(() => {
    if (!showVideo) return;
    const el = videoRef.current;
    if (!el) return;

    tryPlay(el);

    const onReady = () => tryPlay(el);
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) tryPlay(el);
              }
            },
            { threshold: 0.25 }
          );
    io?.observe(el);

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      io?.disconnect();
    };
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
      {...{ "webkit-playsinline": "true" }}
      onError={() => {
        const el = videoRef.current;
        if (el && el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          setVideoFailed(true);
        }
      }}
    >
      {previewSources(src).map((source) => (
        <source key={source.type} src={source.src} type={source.type} />
      ))}
    </video>
  );
}
