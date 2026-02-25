/**
 * Phase 3.6: DataFreshnessIndicator tests (Validation Matrix #60, #61).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

describe("DataFreshnessIndicator", () => {
  beforeEach(cleanup);

  it("returns null when computedAt is null", () => {
    const { container } = render(<DataFreshnessIndicator computedAt={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows data-freshness when computedAt is provided (Matrix #60)", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(<DataFreshnessIndicator computedAt={recent} />);
    expect(screen.getByTestId("data-freshness")).toBeInTheDocument();
  });

  it("61: shows Stale warning when computedAt > 24h ago", () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    render(<DataFreshnessIndicator computedAt={stale} />);
    expect(screen.getByTestId("data-freshness")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("does not show Stale when computedAt < 24h ago", () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    render(<DataFreshnessIndicator computedAt={recent} />);
    expect(screen.getByTestId("data-freshness")).toBeInTheDocument();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });

  it("3.6.3 stale boundary: exactly 24h no Stale, just over 24h shows Stale", () => {
    const exactly24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { unmount } = render(<DataFreshnessIndicator computedAt={exactly24h} />);
    expect(screen.getByTestId("data-freshness")).toBeInTheDocument();
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    unmount();

    const justOver24h = new Date(Date.now() - (24 * 60 * 60 * 1000 + 60_000)).toISOString();
    render(<DataFreshnessIndicator computedAt={justOver24h} />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
