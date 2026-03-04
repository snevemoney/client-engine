/**
 * Unit tests for pipeline error classifier.
 * Verifies classification and retryability for each error code.
 */
import { describe, it, expect } from "vitest";
import {
  classifyPipelineError,
  isRetryableError,
  formatStepFailureNotes,
} from "./error-classifier";

describe("classifyPipelineError", () => {
  it("classifies 429 / rate limit as OPENAI_429", () => {
    expect(classifyPipelineError(new Error("Rate limit exceeded"))).toEqual({
      code: "OPENAI_429",
      message: "Rate limit exceeded",
    });
    expect(classifyPipelineError(new Error("OpenAI API error: 429"))).toEqual({
      code: "OPENAI_429",
      message: "OpenAI API error: 429",
    });
  });

  it("classifies 5XX as OPENAI_5XX", () => {
    expect(classifyPipelineError(new Error("OpenAI API error: 500"))).toEqual({
      code: "OPENAI_5XX",
      message: "OpenAI API error: 500",
    });
    expect(classifyPipelineError(new Error("502 Bad Gateway"))).toEqual({
      code: "OPENAI_5XX",
      message: "502 Bad Gateway",
    });
  });

  it("classifies 4XX / 401 / invalid as OPENAI_4XX", () => {
    expect(classifyPipelineError(new Error("OpenAI API error: 401"))).toEqual({
      code: "OPENAI_4XX",
      message: "OpenAI API error: 401",
    });
    expect(classifyPipelineError(new Error("Invalid API key"))).toEqual({
      code: "OPENAI_4XX",
      message: "Invalid API key",
    });
  });

  it("classifies network errors as OPENAI_NETWORK", () => {
    expect(classifyPipelineError(new Error("fetch failed"))).toEqual({
      code: "OPENAI_NETWORK",
      message: "fetch failed",
    });
    expect(classifyPipelineError(new Error("ECONNREFUSED"))).toEqual({
      code: "OPENAI_NETWORK",
      message: "ECONNREFUSED",
    });
    expect(classifyPipelineError(new Error("Request timeout"))).toEqual({
      code: "OPENAI_NETWORK",
      message: "Request timeout",
    });
  });

  it("classifies gate errors as GATE", () => {
    expect(classifyPipelineError(new Error("requires positioning_brief first"))).toEqual({
      code: "GATE",
      message: "requires positioning_brief first",
    });
  });

  it("classifies validation errors as VALIDATION", () => {
    expect(classifyPipelineError(new Error("JSON parse error"))).toEqual({
      code: "VALIDATION",
      message: "JSON parse error",
    });
    expect(classifyPipelineError(new Error("schema validation failed"))).toEqual({
      code: "VALIDATION",
      message: "schema validation failed",
    });
  });

  it("classifies DB errors as DB", () => {
    expect(classifyPipelineError(new Error("Prisma error"))).toEqual({
      code: "DB",
      message: "Prisma error",
    });
    expect(classifyPipelineError(new Error("database connection failed"))).toEqual({
      code: "DB",
      message: "database connection failed",
    });
  });

  it("classifies unknown errors as UNKNOWN", () => {
    expect(classifyPipelineError(new Error("Something went wrong"))).toEqual({
      code: "UNKNOWN",
      message: "Something went wrong",
    });
  });
});

describe("isRetryableError", () => {
  it("returns true for OPENAI_429, OPENAI_5XX, OPENAI_NETWORK", () => {
    expect(isRetryableError("OPENAI_429")).toBe(true);
    expect(isRetryableError("OPENAI_5XX")).toBe(true);
    expect(isRetryableError("OPENAI_NETWORK")).toBe(true);
  });

  it("returns false for OPENAI_4XX, VALIDATION, GATE, DB, UNKNOWN", () => {
    expect(isRetryableError("OPENAI_4XX")).toBe(false);
    expect(isRetryableError("VALIDATION")).toBe(false);
    expect(isRetryableError("GATE")).toBe(false);
    expect(isRetryableError("DB")).toBe(false);
    expect(isRetryableError("UNKNOWN")).toBe(false);
  });
});

describe("formatStepFailureNotes", () => {
  it("formats error with code prefix and truncated message", () => {
    const result = formatStepFailureNotes(new Error("OpenAI API error: 429 Too many requests"));
    expect(result).toMatch(/^OPENAI_429\|/);
    expect(result).toContain("429");
  });

  it("replaces newlines with spaces", () => {
    const result = formatStepFailureNotes(new Error("Line1\nLine2\nLine3"));
    expect(result).not.toContain("\n");
  });
});
