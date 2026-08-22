import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardMedia } from "./CardMedia";

describe("CardMedia", () => {
  beforeEach(() => cleanup());

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(video?.getAttribute("aria-label")).toBe("Sketchbook");
    expect(video?.getAttribute("poster")).toBe("/screenshots/sketchbook/1-hero.jpg");
    expect(video?.getAttribute("src")).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const sources = container.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.mp4");
    expect(sources[0]?.getAttribute("type")).toBe("video/mp4");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/sketchbook/preview.webm");
    expect(sources[1]?.getAttribute("type")).toBe("video/webm");
  });

  it("offers the same mp4-then-webm pair when the stored path is mp4", () => {
    const { container } = render(
      <CardMedia src="/screenshots/betawise-earth/preview.mp4" alt="Betawise Earth" />
    );

    const sources = container.querySelectorAll("source");
    expect(sources).toHaveLength(2);
    expect(sources[0]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.mp4");
    expect(sources[0]?.getAttribute("type")).toBe("video/mp4");
    expect(sources[1]?.getAttribute("src")).toBe("/screenshots/betawise-earth/preview.webm");
    expect(sources[1]?.getAttribute("type")).toBe("video/webm");
  });

  it("attempts muted autoplay after mount", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);

    render(
      <CardMedia src="/screenshots/betawise-earth/preview.webm" alt="Betawise Earth" />
    );

    expect(play).toHaveBeenCalled();
  });

  it("keeps ScreenshotImg for stills", () => {
    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" fill />);
    const img = screen.getByRole("img", { name: "Autoflow" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/1-dashboard.png");
  });

  it("does not call play for stills", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);

    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" />);

    expect(play).not.toHaveBeenCalled();
  });

  it("falls back to the poster still when the video errors", () => {
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
    fireEvent.error(video!);
    expect(screen.getByRole("img", { name: "Working Volumes" })).toHaveAttribute(
      "src",
      "/screenshots/working-volumes/1-hero.jpg"
    );
  });
});
