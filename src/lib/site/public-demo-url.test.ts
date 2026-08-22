import { describe, expect, it } from "vitest";
import { isPublicDemoUrl, publicDemoUrl } from "./public-demo-url";

describe("isPublicDemoUrl", () => {
  it("allows public evenslouis.ca marketing paths", () => {
    expect(isPublicDemoUrl("https://evenslouis.ca")).toBe(true);
    expect(isPublicDemoUrl("https://www.evenslouis.ca/work")).toBe(true);
    expect(isPublicDemoUrl("https://evenslouis.ca/proof/clearfield")).toBe(true);
    expect(isPublicDemoUrl("https://evenslouis.ca/reports/weekly")).toBe(true);
  });

  it("rejects empty, relative, and non-https URLs", () => {
    expect(isPublicDemoUrl(null)).toBe(false);
    expect(isPublicDemoUrl("")).toBe(false);
    expect(isPublicDemoUrl("  ")).toBe(false);
    expect(isPublicDemoUrl("/work")).toBe(false);
    expect(isPublicDemoUrl("http://evenslouis.ca")).toBe(false);
    expect(isPublicDemoUrl("not a url")).toBe(false);
  });

  it("rejects localhost, loopback, and private IPs", () => {
    expect(isPublicDemoUrl("https://localhost:3000")).toBe(false);
    expect(isPublicDemoUrl("https://127.0.0.1/work")).toBe(false);
    expect(isPublicDemoUrl("https://10.0.0.4/demo")).toBe(false);
    expect(isPublicDemoUrl("https://192.168.1.10")).toBe(false);
    expect(isPublicDemoUrl("https://172.16.0.8")).toBe(false);
  });

  it("rejects internal product paths on the public host", () => {
    expect(isPublicDemoUrl("https://evenslouis.ca/dashboard")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/dashboard/leads")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/pro")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/pro/login")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/login")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/scorpion")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/n8n")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/builder")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/claw")).toBe(false);
    expect(isPublicDemoUrl("https://evenslouis.ca/api/health")).toBe(false);
  });

  it("does not treat /proof as the blocked /pro prefix", () => {
    expect(isPublicDemoUrl("https://evenslouis.ca/proof")).toBe(true);
  });

  it("rejects hosts that are not on the allowlist", () => {
    expect(isPublicDemoUrl("https://github.com/snevemoney/clearfield-evidence-flow")).toBe(false);
    expect(isPublicDemoUrl("https://vercel.app")).toBe(false);
    expect(isPublicDemoUrl("https://n8n.example.com")).toBe(false);
  });
});

describe("publicDemoUrl", () => {
  it("returns the trimmed URL when safe, otherwise null", () => {
    expect(publicDemoUrl("  https://evenslouis.ca/work  ")).toBe("https://evenslouis.ca/work");
    expect(publicDemoUrl("https://evenslouis.ca/dashboard")).toBeNull();
    expect(publicDemoUrl(null)).toBeNull();
  });
});
