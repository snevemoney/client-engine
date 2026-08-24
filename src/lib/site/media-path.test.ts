import { describe, expect, it } from "vitest";
import {
  isImagePath,
  isVideoPath,
  prependPreviewWebm,
  PREVIEW_VIDEO_CACHE_BUST,
  PRODUCT_WORK_PREVIEW_SLUGS,
  resolveCardStillSrc,
  resolvePosterSrc,
  previewVideoSources,
  replaceVideoExt,
  withVideoCacheBust,
  workPreviewPath,
} from "./media-path";

describe("isVideoPath", () => {
  it("accepts muted-preview extensions", () => {
    expect(isVideoPath("/screenshots/autoflow/preview.webm")).toBe(true);
    expect(isVideoPath("/screenshots/autoflow/preview.mp4")).toBe(true);
    expect(isVideoPath("/screenshots/autoflow/preview.mov")).toBe(true);
    expect(isVideoPath("/screenshots/autoflow/PREVIEW.WEBM")).toBe(true);
    expect(isVideoPath("/x/preview.webm?v=2")).toBe(true);
  });

  it("rejects stills and empty paths", () => {
    expect(isVideoPath("/screenshots/autoflow/1-dashboard.png")).toBe(false);
    expect(isVideoPath("/screenshots/sketchbook/1-hero.jpg")).toBe(false);
    expect(isVideoPath("/screenshots/x/1-hero.webp")).toBe(false);
    expect(isVideoPath("")).toBe(false);
    expect(isVideoPath("/screenshots/x/preview")).toBe(false);
  });
});

describe("isImagePath", () => {
  it("accepts jpg/png/webp stills", () => {
    expect(isImagePath("/screenshots/x/1-hero.jpg")).toBe(true);
    expect(isImagePath("/screenshots/x/1-hero.jpeg")).toBe(true);
    expect(isImagePath("/screenshots/x/1-dashboard.png")).toBe(true);
    expect(isImagePath("/screenshots/x/1-hero.webp")).toBe(true);
    expect(isImagePath("/screenshots/x/preview.webm")).toBe(false);
  });
});

describe("resolvePosterSrc", () => {
  it("uses the next image sibling after the video", () => {
    expect(
      resolvePosterSrc("/screenshots/sketchbook/preview.webm", [
        "/screenshots/sketchbook/preview.webm",
        "/screenshots/sketchbook/1-hero.jpg",
      ])
    ).toBe("/screenshots/sketchbook/1-hero.jpg");
  });

  it("falls back to the same path with .jpg", () => {
    expect(resolvePosterSrc("/screenshots/x/preview.webm")).toBe("/screenshots/x/preview.jpg");
  });

  it("skips a following video and uses the next still", () => {
    expect(
      resolvePosterSrc("/a/preview.webm", ["/a/preview.webm", "/a/other.mp4", "/a/1-hero.png"])
    ).toBe("/a/1-hero.png");
  });
});

describe("resolveCardStillSrc", () => {
  it("prefers the next image sibling, else the first non-video screenshot", () => {
    expect(
      resolveCardStillSrc("/screenshots/sketchbook/preview.webm", [
        "/screenshots/sketchbook/preview.webm",
        "/screenshots/sketchbook/1-hero.jpg",
      ])
    ).toBe("/screenshots/sketchbook/1-hero.jpg");
    expect(
      resolveCardStillSrc("/screenshots/x/preview.webm", [
        "/screenshots/x/1-hero.png",
        "/screenshots/x/preview.webm",
      ])
    ).toBe("/screenshots/x/1-hero.png");
  });
});

describe("withVideoCacheBust", () => {
  it("appends ?v= when missing and leaves an existing v= alone", () => {
    expect(PREVIEW_VIDEO_CACHE_BUST).toBe("14");
    expect(withVideoCacheBust("/x/preview.webm")).toBe("/x/preview.webm?v=14");
    expect(withVideoCacheBust("/x/preview.webm?v=2")).toBe("/x/preview.webm?v=2");
  });
});

describe("previewVideoSources", () => {
  it("derives mp4 from the video extension and lists it before webm", () => {
    expect(replaceVideoExt("/screenshots/x/preview.webm", ".mp4")).toBe(
      "/screenshots/x/preview.mp4"
    );
    expect(previewVideoSources("/screenshots/x/preview.webm")).toEqual([
      { src: "/screenshots/x/preview.mp4?v=14", type: "video/mp4" },
      { src: "/screenshots/x/preview.webm?v=14", type: "video/webm" },
    ]);
  });
});

describe("prependPreviewWebm", () => {
  it("prepends when missing and leaves other paths intact", () => {
    const existing = ["/screenshots/autoflow/1-dashboard.png", "/screenshots/autoflow/2-workflows.png"];
    expect(prependPreviewWebm(existing, "autoflow")).toEqual([
      "/screenshots/autoflow/preview.webm",
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
    ]);
    expect(existing).toEqual([
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
    ]);
  });

  it("is a no-op when the preview path is already present", () => {
    const withPreview = [
      "/screenshots/clearfield/preview.webm",
      "/screenshots/clearfield/1-dashboard.png",
    ];
    expect(prependPreviewWebm(withPreview, "clearfield")).toBe(withPreview);
  });

  it("covers the four product slugs", () => {
    expect([...PRODUCT_WORK_PREVIEW_SLUGS]).toEqual([
      "autoflow",
      "proof-qc-assist",
      "clearfield",
      "quickmarket",
    ]);
    expect(workPreviewPath("proof-qc-assist")).toBe("/screenshots/proof-qc-assist/preview.webm");
  });
});
