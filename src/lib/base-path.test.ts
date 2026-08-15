import { describe, expect, it } from "vitest";
import { resolveSiteHref, rootPublicSrc, siteHref } from "./base-path";

describe("rootPublicSrc", () => {
  it("keeps domain-root screenshot paths", () => {
    expect(rootPublicSrc("/screenshots/proof-qc-assist/1-workspace.png")).toBe(
      "/screenshots/proof-qc-assist/1-workspace.png"
    );
  });

  it("strips an accidental /pro prefix so /pro/work uses the same files as /work", () => {
    expect(rootPublicSrc("/pro/screenshots/autoflow/1-dashboard.png")).toBe(
      "/screenshots/autoflow/1-dashboard.png"
    );
  });

  it("leaves absolute and data URLs alone", () => {
    expect(rootPublicSrc("https://evenslouis.ca/screenshots/x.png")).toBe(
      "https://evenslouis.ca/screenshots/x.png"
    );
  });
});

describe("siteHref", () => {
  it("passes through in-app paths when no basePath is set", () => {
    expect(siteHref("/work")).toBe("/work");
    expect(siteHref("/work/proof-qc-assist")).toBe("/work/proof-qc-assist");
    expect(siteHref("/#contact")).toBe("/#contact");
  });

  it("never prefixes public roots with /pro", () => {
    expect(resolveSiteHref("/work", "/pro")).toBe("/work");
    expect(resolveSiteHref("/work/proof-qc-assist", "/pro")).toBe("/work/proof-qc-assist");
    expect(resolveSiteHref("/work#cases", "/pro")).toBe("/work#cases");
    expect(resolveSiteHref("/contact", "/pro")).toBe("/contact");
    expect(resolveSiteHref("/services", "/pro")).toBe("/services");
    expect(resolveSiteHref("/", "/pro")).toBe("/");
  });

  it("rewrites leftover /pro catalog and bare /pro hrefs to origin", () => {
    expect(resolveSiteHref("/pro/work", "/pro")).toBe("/work");
    expect(resolveSiteHref("/pro/work/proof-qc-assist", "/pro")).toBe("/work/proof-qc-assist");
    expect(resolveSiteHref("/pro/work#cases", "/pro")).toBe("/work#cases");
    expect(resolveSiteHref("/pro", "/pro")).toBe("/");
    expect(resolveSiteHref("/pro/", "/pro")).toBe("/");
  });

  it("still prefixes operator paths", () => {
    expect(resolveSiteHref("/login", "/pro")).toBe("/pro/login");
    expect(resolveSiteHref("/dashboard", "/pro")).toBe("/pro/dashboard");
    expect(resolveSiteHref("/dashboard/founder", "/pro")).toBe("/pro/dashboard/founder");
  });

  it("leaves mailto and external hrefs alone", () => {
    expect(siteHref("mailto:contact@evenslouis.ca")).toBe("mailto:contact@evenslouis.ca");
    expect(siteHref("https://github.com/snevemoney/proof-qc-assist")).toBe(
      "https://github.com/snevemoney/proof-qc-assist"
    );
  });
});
