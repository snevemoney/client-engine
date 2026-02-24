import { describe, it, expect } from "vitest";
import { isValidHttpUrl, isGitHubUrl, isLoomUrl } from "./url";

describe("isValidHttpUrl", () => {
  it("returns true for valid https URL", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
  });
  it("returns true for valid http URL", () => {
    expect(isValidHttpUrl("http://example.com/path")).toBe(true);
  });
  it("returns false for empty string", () => {
    expect(isValidHttpUrl("")).toBe(false);
  });
  it("returns false for non-string", () => {
    expect(isValidHttpUrl(null as unknown as string)).toBe(false);
    expect(isValidHttpUrl(undefined as unknown as string)).toBe(false);
  });
  it("returns false for ftp URL", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
  it("returns false for javascript: URL", () => {
    expect(isValidHttpUrl("javascript:void(0)")).toBe(false);
  });
  it("returns false for invalid URL", () => {
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});

describe("isGitHubUrl", () => {
  it("returns true for repo URL", () => {
    expect(isGitHubUrl("https://github.com/owner/repo")).toBe(true);
  });
  it("returns true for PR URL", () => {
    expect(isGitHubUrl("https://github.com/owner/repo/pull/1")).toBe(true);
  });
  it("returns true for commit URL", () => {
    expect(isGitHubUrl("https://github.com/owner/repo/commit/abc123")).toBe(true);
  });
  it("returns true for www.github.com", () => {
    expect(isGitHubUrl("https://www.github.com/owner/repo")).toBe(true);
  });
  it("returns false for non-GitHub URL", () => {
    expect(isGitHubUrl("https://example.com")).toBe(false);
  });
  it("returns false for invalid URL", () => {
    expect(isGitHubUrl("not a url")).toBe(false);
  });
});

describe("isLoomUrl", () => {
  it("returns true for loom.com URL", () => {
    expect(isLoomUrl("https://www.loom.com/share/abc123")).toBe(true);
  });
  it("returns true for www.loom.com", () => {
    expect(isLoomUrl("https://loom.com/share/xyz")).toBe(true);
  });
  it("returns false for non-Loom URL", () => {
    expect(isLoomUrl("https://example.com/video")).toBe(false);
  });
  it("returns false for invalid URL", () => {
    expect(isLoomUrl("not a url")).toBe(false);
  });
});
