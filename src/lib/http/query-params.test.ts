import { describe, it, expect } from "vitest";
import {
  parseStringParam,
  parseIntParam,
  parseFloatParam,
  parseBoolParam,
  parseEnumParam,
  parseDateParam,
  parseCsvParam,
  parseSortParam,
} from "./query-params";

describe("query-params", () => {
  const p = (s: string) => new URLSearchParams(s);

  describe("parseStringParam", () => {
    it("returns null when missing", () => {
      expect(parseStringParam(p(""), "x")).toBeNull();
    });
    it("trims by default", () => {
      expect(parseStringParam(p("x=  a  "), "x")).toBe("a");
    });
    it("returns null for empty when allowEmpty false", () => {
      expect(parseStringParam(p("x="), "x")).toBeNull();
    });
    it("truncates at maxLength", () => {
      expect(parseStringParam(p("x=abcdef"), "x", { maxLength: 3 })).toBe("abc");
    });
  });

  describe("parseIntParam", () => {
    it("returns default when missing", () => {
      expect(parseIntParam(p(""), "x", { defaultValue: 42 })).toBe(42);
    });
    it("parses valid int", () => {
      expect(parseIntParam(p("x=7"), "x")).toBe(7);
    });
    it("clamps to min/max", () => {
      expect(parseIntParam(p("x=100"), "x", { min: 1, max: 10 })).toBe(10);
    });
    it("returns default for invalid", () => {
      expect(parseIntParam(p("x=abc"), "x", { defaultValue: 5 })).toBe(5);
    });
  });

  describe("parseFloatParam", () => {
    it("parses valid float", () => {
      expect(parseFloatParam(p("x=3.14"), "x")).toBe(3.14);
    });
    it("returns default for invalid", () => {
      expect(parseFloatParam(p("x=xyz"), "x", { defaultValue: 1.5 })).toBe(1.5);
    });
  });

  describe("parseBoolParam", () => {
    it("accepts true variants", () => {
      expect(parseBoolParam(p("x=1"), "x")).toBe(true);
      expect(parseBoolParam(p("x=true"), "x")).toBe(true);
      expect(parseBoolParam(p("x=yes"), "x")).toBe(true);
      expect(parseBoolParam(p("x=on"), "x")).toBe(true);
    });
    it("accepts false variants", () => {
      expect(parseBoolParam(p("x=0"), "x")).toBe(false);
      expect(parseBoolParam(p("x=false"), "x")).toBe(false);
    });
    it("returns default for invalid", () => {
      expect(parseBoolParam(p("x=maybe"), "x", { defaultValue: true })).toBe(true);
    });
  });

  describe("parseEnumParam", () => {
    it("returns value when allowed", () => {
      expect(parseEnumParam(p("x=foo"), "x", ["foo", "bar"], "bar")).toBe("foo");
    });
    it("returns default when invalid", () => {
      expect(parseEnumParam(p("x=baz"), "x", ["foo", "bar"], "bar")).toBe("bar");
    });
  });

  describe("parseDateParam", () => {
    it("parses valid date", () => {
      const d = parseDateParam(p("x=2025-02-22"), "x");
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2025);
    });
    it("returns null for invalid", () => {
      expect(parseDateParam(p("x=invalid"), "x")).toBeNull();
    });
  });

  describe("parseCsvParam", () => {
    it("splits and trims", () => {
      expect(parseCsvParam(p("x=a,b,c"), "x")).toEqual(["a", "b", "c"]);
      expect(parseCsvParam(p("x= a , b "), "x")).toEqual(["a", "b"]);
    });
    it("dedupes", () => {
      expect(parseCsvParam(p("x=a,a,b"), "x")).toEqual(["a", "b"]);
    });
    it("limits maxItems", () => {
      expect(parseCsvParam(p("x=a,b,c,d"), "x", { maxItems: 2 })).toEqual(["a", "b"]);
    });
  });

  describe("parseSortParam", () => {
    it("returns default when missing", () => {
      expect(parseSortParam(p(""), "sort", ["a", "b"], "a")).toEqual({ key: "a", dir: "asc" });
    });
    it("parses key and dir", () => {
      expect(parseSortParam(p("sort=b,desc"), "sort", ["a", "b"], "a")).toEqual({ key: "b", dir: "desc" });
    });
    it("returns default for invalid key", () => {
      expect(parseSortParam(p("sort=c"), "sort", ["a", "b"], "a")).toEqual({ key: "a", dir: "asc" });
    });
  });
});
