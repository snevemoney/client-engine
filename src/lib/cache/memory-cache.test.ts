import { describe, it, expect, beforeEach, vi } from "vitest";
import { get, set, del, clear, getOrSet } from "./memory-cache";

describe("memory-cache", () => {
  beforeEach(() => {
    clear();
  });

  describe("get/set/del", () => {
    it("returns undefined when missing", () => {
      expect(get("x")).toBeUndefined();
    });
    it("returns value when set", () => {
      set("x", 42, 10000);
      expect(get<number>("x")).toBe(42);
    });
    it("returns undefined after del", () => {
      set("x", 1, 10000);
      del("x");
      expect(get("x")).toBeUndefined();
    });
  });

  describe("ttl", () => {
    it("returns undefined when expired", async () => {
      set("x", 1, 10);
      await new Promise((r) => setTimeout(r, 20));
      expect(get("x")).toBeUndefined();
    });
  });

  describe("getOrSet", () => {
    it("calls factory when missing", async () => {
      const factory = vi.fn().mockResolvedValue("v");
      const v = await getOrSet("k", 5000, factory);
      expect(v).toBe("v");
      expect(factory).toHaveBeenCalledTimes(1);
    });
    it("returns cached value on second call", async () => {
      const factory = vi.fn().mockResolvedValue("v");
      await getOrSet("k", 5000, factory);
      const v2 = await getOrSet("k", 5000, factory);
      expect(v2).toBe("v");
      expect(factory).toHaveBeenCalledTimes(1);
    });
    it("dedupes concurrent requests", async () => {
      const resolvers: Array<(v: string) => void> = [];
      const factory = vi.fn().mockImplementation(
        () =>
          new Promise<string>((r) => {
            resolvers.push(r);
          })
      );
      const p1 = getOrSet("k", 5000, factory);
      const p2 = getOrSet("k", 5000, factory);
      resolvers[0]!("done");
      expect(await p1).toBe("done");
      expect(await p2).toBe("done");
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });
});
