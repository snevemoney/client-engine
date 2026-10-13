import { describe, it, expect } from "vitest";
import { dollarsToCents, centsToDollars } from "./cents";

describe("dollarsToCents", () => {
  it("rounds half-up to integer cents", () => {
    expect(dollarsToCents(15.5)).toBe(1550);
    expect(dollarsToCents(0.1)).toBe(10);
    expect(dollarsToCents(0)).toBe(0);
  });

  it("rejects non-finite or negative values", () => {
    expect(dollarsToCents(Number.NaN)).toBe(0);
    expect(dollarsToCents(-3)).toBe(0);
  });
});

describe("centsToDollars", () => {
  it("divides by 100 and passes through null", () => {
    expect(centsToDollars(1550)).toBe(15.5);
    expect(centsToDollars(null)).toBeNull();
  });
});
