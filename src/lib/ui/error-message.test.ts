import { describe, it, expect } from "vitest";
import { toErrorMessage, isAbortError } from "./error-message";

describe("error-message", () => {
  describe("toErrorMessage", () => {
    it("returns message for Error", () => {
      expect(toErrorMessage(new Error("foo"))).toBe("foo");
    });
    it("returns string as-is", () => {
      expect(toErrorMessage("bar")).toBe("bar");
    });
    it("returns default for null/undefined", () => {
      expect(toErrorMessage(null)).toBe("An error occurred");
      expect(toErrorMessage(undefined)).toBe("An error occurred");
    });
    it("returns message for Error without stack in message", () => {
      const e = new Error("simple");
      expect(toErrorMessage(e)).toBe("simple");
    });
  });

  describe("isAbortError", () => {
    it("returns true for AbortError", () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      expect(isAbortError(e)).toBe(true);
    });
    it("returns true when message contains abort", () => {
      expect(isAbortError(new Error("request aborted"))).toBe(true);
    });
    it("returns false for generic error", () => {
      expect(isAbortError(new Error("failed"))).toBe(false);
    });
    it("returns false for null", () => {
      expect(isAbortError(null)).toBe(false);
    });
  });
});
