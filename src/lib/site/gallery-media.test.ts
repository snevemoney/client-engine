import { describe, expect, it } from "vitest";
import { galleryMediaItems } from "./gallery-media";

describe("galleryMediaItems", () => {
  it("drops the hero still when it is only the poster for a listed video", () => {
    expect(
      galleryMediaItems([
        "/screenshots/betawise-earth/preview.webm",
        "/screenshots/betawise-earth/1-hero.jpg",
      ])
    ).toEqual(["/screenshots/betawise-earth/preview.webm"]);
  });

  it("keeps a video-only list unchanged", () => {
    expect(galleryMediaItems(["/screenshots/sketchbook/preview.webm"])).toEqual([
      "/screenshots/sketchbook/preview.webm",
    ]);
  });

  it("keeps still-only product galleries unchanged", () => {
    const stills = [
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
      "/screenshots/autoflow/3-editor.png",
    ];
    expect(galleryMediaItems(stills)).toEqual(stills);
  });

  it("keeps every product still even when the first is also the video poster", () => {
    const product = [
      "/screenshots/autoflow/preview.webm",
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
      "/screenshots/autoflow/3-editor.png",
    ];
    expect(galleryMediaItems(product)).toEqual(product);
  });

  it("drops only the poster when a second video shares the same still", () => {
    expect(
      galleryMediaItems([
        "/a/preview.webm",
        "/a/preview.mp4",
        "/a/1-hero.jpg",
      ])
    ).toEqual(["/a/preview.webm", "/a/preview.mp4"]);
  });

  it("ignores a derived poster path that is not actually in the list", () => {
    expect(galleryMediaItems(["/screenshots/x/preview.webm"])).toEqual([
      "/screenshots/x/preview.webm",
    ]);
  });
});
