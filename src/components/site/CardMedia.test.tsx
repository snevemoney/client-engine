import { describe, expect, it, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardMedia } from "./CardMedia";

describe("CardMedia", () => {
  beforeEach(() => cleanup());

  it("renders a muted looping preview for video paths", () => {
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
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps ScreenshotImg for stills", () => {
    render(<CardMedia src="/screenshots/autoflow/1-dashboard.png" alt="Autoflow" fill />);
    const img = screen.getByRole("img", { name: "Autoflow" });
    expect(img).toHaveAttribute("src", "/screenshots/autoflow/1-dashboard.png");
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
