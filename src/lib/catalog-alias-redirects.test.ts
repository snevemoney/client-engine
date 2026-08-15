import { describe, expect, it } from "vitest";
import { catalogAliasRedirects } from "./catalog-alias-redirects.js";

describe("catalogAliasRedirects", () => {
  it("is a no-op when the app is the public site (no basePath)", () => {
    expect(catalogAliasRedirects("")).toEqual([]);
    expect(catalogAliasRedirects(null)).toEqual([]);
  });

  it("308s leftover /pro twins to origin; keeps login and dashboard", () => {
    const rules = catalogAliasRedirects("/pro");
    expect(rules.every((r) => r.permanent === true && r.basePath === false)).toBe(true);

    const pairs = rules.map((r) => [r.source, r.destination]);
    expect(pairs).toContainEqual(["/pro", "/"]);
    expect(pairs).toContainEqual(["/pro/", "/"]);
    expect(pairs).toContainEqual(["/pro/work", "/work"]);
    expect(pairs).toContainEqual(["/pro/work/", "/work"]);
    expect(pairs).toContainEqual(["/pro/work/:path*", "/work/:path*"]);
    expect(pairs).toContainEqual(["/pro/services", "/services"]);
    expect(pairs).toContainEqual(["/pro/contact", "/contact"]);
    expect(pairs).toContainEqual(["/pro/campaigns", "/campaigns"]);
    expect(pairs).toContainEqual(["/pro/proof", "/proof"]);
    expect(pairs).toContainEqual(["/pro/demos", "/demos"]);
    expect(pairs).toContainEqual(["/pro/privacy", "/privacy"]);
    expect(pairs).toContainEqual(["/pro/terms", "/terms"]);
    expect(pairs).toContainEqual(["/pro/data-deletion", "/data-deletion"]);

    expect(rules.some((r) => r.source === "/pro/login" || r.source.startsWith("/pro/login"))).toBe(
      false
    );
    expect(
      rules.some((r) => r.source === "/pro/dashboard" || r.source.startsWith("/pro/dashboard"))
    ).toBe(false);
    expect(rules.some((r) => r.source === "/pro/api" || r.source.startsWith("/pro/api"))).toBe(
      false
    );
  });
});
