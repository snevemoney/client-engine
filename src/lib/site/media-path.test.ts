import { describe, expect, it } from "vitest";
import {
  isImagePath,
  isVideoPath,
  prependPreviewWebm,
  PRODUCT_WORK_PREVIEW_SLUGS,
  resolvePosterSrc,
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
