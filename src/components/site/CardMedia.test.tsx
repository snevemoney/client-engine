import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardMedia } from "./CardMedia";

class MockIntersectionObserver {
  static last: MockIntersectionObserver | null = null;
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.last = this;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CardMedia", () => {
  let play: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup();
    MockIntersectionObserver.last = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: play,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a muted looping preview with mp4 then webm sources", () => {
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
    expect(video?.hasAttribute("playsinline") || video?.playsInline).toBeTruthy();
    expect(video?.getAttribute("webkit-playsinline")).toBe("true");
    expect(video?.getAttribute("aria-label")).toBe("Sketchbook");
    expect(video?.getAttribute("poster")).toBe("/screenshots/sketchbook/1-hero.jpg");
    expect(container.querySelector("img")).toBeNull();

    const sources = [...container.querySelectorAll("source")];
    expect(sources.map((s) => s.getAttribute("type"))).toEqual(["video/mp4", "video/webm"]);
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.mp4?v=6");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.webm?v=6");
    expect(play).toHaveBeenCalled();
    expect(MockIntersectionObserver.last?.options?.threshold).toBe(0.25);
  });

  it("centers fill videos and omits the poster so iOS does not freeze on a still", () => {
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
    expect(video?.className).toContain("object-center");
    expect(video?.className).not.toContain("object-top");
    expect(video?.hasAttribute("poster")).toBe(false);
    expect(video?.getAttribute("poster")).toBeNull();
  });

  it("calls play again on canplay, loadeddata, and when 25% visible", () => {
    const { container } = render(
      <CardMedia src="/screenshots/sketchbook/preview.webm" alt="Sketchbook" />
    );
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    play.mockClear();

    fireEvent.loadedData(video!);
    fireEvent.canPlay(video!);
    MockIntersectionObserver.last?.callback(
      [{ isIntersecting: true, intersectionRatio: 0.25 } as IntersectionObserverEntry],
      MockIntersectionObserver.last as unknown as IntersectionObserver
    );

    expect(play.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps ScreenshotImg for stills", () => {
    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" fill />);
    const img = screen.getByRole("img", { name: "Autoflow" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/1-dashboard.png");
  });

  it("falls back to the poster still only when the video has no source", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/working-volumes/preview.webm"
        alt="Working Volumes"
        siblings={[
          "/screenshots/working-volumes/preview.webm",
          "/screenshots/working-volumes/1-hero.jpg",
        ]}
      />
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    Object.defineProperty(video!, "networkState", {
      configurable: true,
      value: 3, // NETWORK_NO_SOURCE
    });
    fireEvent.error(video!);
    expect(screen.getByRole("img", { name: "Working Volumes" })).toHaveAttribute(
      "src",
      "/screenshots/working-volumes/1-hero.jpg"
    );
  });

  it("does not fall back on a transient video error", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/working-volumes/preview.webm"
        alt="Working Volumes"
        siblings={[
          "/screenshots/working-volumes/preview.webm",
          "/screenshots/working-volumes/1-hero.jpg",
        ]}
      />
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    Object.defineProperty(video!, "networkState", {
      configurable: true,
      value: 2, // NETWORK_LOADING
    });
    fireEvent.error(video!);
    expect(container.querySelector("video")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
