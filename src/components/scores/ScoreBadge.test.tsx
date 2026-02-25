/**
 * Phase 3.2: ScoreBadge component tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScoreBadge } from "./ScoreBadge";

describe("ScoreBadge", () => {
  beforeEach(() => cleanup());

  it("renders healthy band with correct text", () => {
    render(<ScoreBadge band="healthy" />);
    expect(screen.getByTestId("score-badge")).toHaveTextContent("healthy");
  });

  it("renders warning band with correct text", () => {
    render(<ScoreBadge band="warning" />);
    expect(screen.getByTestId("score-badge")).toHaveTextContent("warning");
  });

  it("renders critical band with correct text", () => {
    render(<ScoreBadge band="critical" />);
    expect(screen.getByTestId("score-badge")).toHaveTextContent("critical");
  });

  it("renders unknown band without crashing", () => {
    render(<ScoreBadge band="unknown" />);
    expect(screen.getByTestId("score-badge")).toHaveTextContent("unknown");
  });
});
