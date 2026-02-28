import { describe, it, expect } from "vitest";
import { safeParseJSON } from "./safe-parse-json";

describe("safeParseJSON", () => {
  it("parses plain JSON", () => {
    const result = safeParseJSON<{ a: number }>('{"a":1}');
    expect(result).toEqual({ a: 1 });
  });

  it("strips markdown json fence", () => {
    const result = safeParseJSON<{ score: number }>('```json\n{"score":50}\n```');
    expect(result).toEqual({ score: 50 });
  });

  it("strips markdown fence without json tag", () => {
    const result = safeParseJSON<{ x: string }>('```\n{"x":"y"}\n```');
    expect(result).toEqual({ x: "y" });
  });

  it("handles leading/trailing whitespace", () => {
    const result = safeParseJSON<{ n: number }>('  \n{"n":42}\n  ');
    expect(result).toEqual({ n: 42 });
  });

  it("throws on invalid JSON", () => {
    expect(() => safeParseJSON("not json")).toThrow(SyntaxError);
  });
});
