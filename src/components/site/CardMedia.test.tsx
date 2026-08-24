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

  it("non-fill layers a cache-busted still under an absolute video", () => {
    const { container } = render(
      <CardMedia
        src="/screenshots/sketchbook/preview.webm"
        alt="Sketchbook"
        width={1200}
        height={675}
        className="w-full h-auto"
        siblings={[
          "/screenshots/sketchbook/preview.webm",
          "/screenshots/sketchbook/1-hero.jpg",
        ]}
      />
    );

    const wrap = container.querySelector("div.relative");
    expect(wrap).toBeTruthy();
    const video = wrap?.querySelector("video");
    const img = wrap?.querySelector("img");
    expect(video).toBeTruthy();
    expect(img).toBeTruthy();
    expect(video?.compareDocumentPosition(img!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.preload).toBe("metadata");
    expect(video?.hasAttribute("controls")).toBe(false);
    expect(video?.getAttribute("aria-label")).toBe("Sketchbook");
    expect(video?.hasAttribute("poster")).toBe(false);
    expect(video?.hasAttribute("src")).toBe(false);
    expect(video?.className).toMatch(/absolute inset-0/);
    expect(video?.className).toMatch(/z-\[1\]/);
    expect(video?.className).toMatch(/opacity-100/);
    expect(video?.className).not.toMatch(/opacity-0/);
    const sources = [...(video?.querySelectorAll("source") ?? [])];
    expect(sources.map((el) => el.getAttribute("type"))).toEqual(["video/mp4", "video/webm"]);
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.mp4?v=17");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.webm?v=17");
    expect(img).toHaveAttribute("src", "/screenshots/sketchbook/1-hero.jpg?v=17");
    expect(playMock).toHaveBeenCalled();
  });

  it("fill cards keep still z-0 under a visible video and never use HTML poster", () => {
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
    const img = screen.getByRole("img", { name: "Betawise Earth" });
    expect(video).toBeTruthy();
    expect(video?.hasAttribute("poster")).toBe(false);
    expect(video?.hasAttribute("src")).toBe(false);
    expect(video?.className).not.toMatch(/opacity-0/);
    expect(video?.className).toMatch(/opacity-100/);
    expect(video?.className).toMatch(/absolute inset-0/);
    expect(video?.className).toMatch(/z-\[1\]/);
    expect(video?.className).toMatch(/object-center/);
    expect(video?.className).not.toMatch(/object-top/);
    expect(img.className).toMatch(/z-0/);
    const sources = [...(video?.querySelectorAll("source") ?? [])];
    expect(sources).toHaveLength(2);
    expect(sources[0]?.getAttribute("type")).toBe("video/mp4");
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.mp4?v=17");
    expect(sources[1]?.getAttribute("type")).toBe("video/webm");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.webm?v=17");
    expect(img).toHaveAttribute("src", "/screenshots/betawise-earth/1-hero.jpg?v=17");
    expect(playMock).toHaveBeenCalled();
  });

  it("keeps ScreenshotImg for stills", () => {
    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" fill />);
    const img = screen.getByRole("img", { name: "Autoflow" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/1-dashboard.png");
    expect(document.querySelector("video")).toBeNull();
  });

  it("renders a gallery still as that exact src, not the next sibling", () => {
    const siblings = [
      "/screenshots/autoflow/preview.webm",
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
      "/screenshots/autoflow/5-settings.png",
    ];
    render(
      <CardMedia
        src="/screenshots/autoflow/1-dashboard.png"
        alt="Autoflow dashboard"
        siblings={siblings}
      />
    );
    expect(screen.getByRole("img", { name: "Autoflow dashboard" })).toHaveAttribute(
      "src",
      "/screenshots/autoflow/1-dashboard.png"
    );
    expect(document.querySelector("video")).toBeNull();
  });

  it("does not rewrite the last gallery still to .jpg", () => {
    const siblings = [
      "/screenshots/autoflow/preview.webm",
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/5-settings.png",
    ];
    render(
      <CardMedia
        src="/screenshots/autoflow/5-settings.png"
        alt="Autoflow settings"
        siblings={siblings}
      />
    );
    const img = screen.getByRole("img", { name: "Autoflow settings" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/5-settings.png");
    expect(img.getAttribute("src")).not.toMatch(/\.jpg$/);
    expect(document.querySelector("video")).toBeNull();
  });

  it("hides the video and keeps the still only when networkState is NETWORK_NO_SOURCE", () => {
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
    expect(container.querySelector("video")).toBeTruthy();

    Object.defineProperty(video!, "networkState", {
      configurable: true,
      value: HTMLMediaElement.NETWORK_NO_SOURCE,
    });
    fireEvent.error(video!);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Working Volumes" })).toHaveAttribute(
      "src",
      "/screenshots/working-volumes/1-hero.jpg?v=17"
    );
  });
});
