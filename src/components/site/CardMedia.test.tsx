import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardMedia } from "./CardMedia";

const playMock = vi.fn().mockResolvedValue(undefined);

class ImmediateIntersectObserver {
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0];
}

describe("CardMedia", () => {
  beforeEach(() => {
    cleanup();
    playMock.mockClear();
    vi.stubGlobal("IntersectionObserver", ImmediateIntersectObserver);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(playMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("layers a still under a visible muted looping preview", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/sketchbook/preview.webm"
        alt="Sketchbook"
        siblings={[
          "/screenshots/sketchbook/preview.webm",
          "/screenshots/sketchbook/1-hero.jpg",
        ]}
      />
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.preload).toBe("metadata");
    expect(video?.hasAttribute("controls")).toBe(false);
    expect(video?.getAttribute("aria-label")).toBe("Sketchbook");
    expect(video?.hasAttribute("poster")).toBe(false);
    expect(video?.hasAttribute("src")).toBe(false);
    expect(video?.className).not.toMatch(/opacity-0/);
    const sources = [...(video?.querySelectorAll("source") ?? [])];
    expect(sources.map((el) => el.getAttribute("type"))).toEqual(["video/mp4", "video/webm"]);
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.mp4?v=14");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.webm?v=14");
    expect(screen.getByRole("img", { name: "Sketchbook" })).toHaveAttribute(
      "src",
      "/screenshots/sketchbook/1-hero.jpg"
    );
    expect(playMock).toHaveBeenCalled();
  });

  it("fill cards keep the video fully visible and never use HTML poster", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/betawise-earth/preview.webm"
        alt="Betawise Earth"
        fill
        siblings={[
          "/screenshots/betawise-earth/preview.webm",
          "/screenshots/betawise-earth/1-hero.jpg",
        ]}
      />
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.hasAttribute("poster")).toBe(false);
    expect(video?.hasAttribute("src")).toBe(false);
    expect(video?.className).not.toMatch(/opacity-0/);
    expect(video?.className).toMatch(/opacity-100/);
    expect(video?.className).toMatch(/absolute inset-0/);
    expect(video?.className).toMatch(/z-\[1\]/);
    expect(video?.className).toMatch(/object-center/);
    expect(video?.className).not.toMatch(/object-top/);
    const sources = [...(video?.querySelectorAll("source") ?? [])];
    expect(sources).toHaveLength(2);
    expect(sources[0]?.getAttribute("type")).toBe("video/mp4");
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.mp4?v=14");
    expect(sources[1]?.getAttribute("type")).toBe("video/webm");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.webm?v=14");
    expect(screen.getByRole("img", { name: "Betawise Earth" })).toHaveAttribute(
      "src",
      "/screenshots/betawise-earth/1-hero.jpg"
    );
    expect(playMock).toHaveBeenCalled();
  });

  it("keeps ScreenshotImg for stills", () => {
    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" fill />);
    const img = screen.getByRole("img", { name: "Autoflow" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/1-dashboard.png");
    expect(document.querySelector("video")).toBeNull();
  });

  it("hides the video and keeps the still when the video errors", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/working-volumes/preview.webm"
        alt="Working Volumes"
        fill
        siblings={[
          "/screenshots/working-volumes/preview.webm",
          "/screenshots/working-volumes/1-hero.jpg",
        ]}
      />
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    fireEvent.error(video!);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Working Volumes" })).toHaveAttribute(
      "src",
      "/screenshots/working-volumes/1-hero.jpg"
    );
  });
});
