import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveIntegration,
  resolveConnection,
} from "./resolver";

describe("resolveIntegration", () => {
  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it("OFF returns shouldRun=false", () => {
    const r = resolveIntegration("upwork", "off", false);
    expect(r.effectiveMode).toBe("off");
    expect(r.shouldRun).toBe(false);
    expect(r.behavior.useMock).toBe(false);
    expect(r.behavior.useLive).toBe(false);
  });

  it("MOCK returns useMock=true", () => {
    const r = resolveIntegration("upwork", "mock", false);
    expect(r.effectiveMode).toBe("mock");
    expect(r.shouldRun).toBe(true);
    expect(r.behavior.useMock).toBe(true);
    expect(r.behavior.useLive).toBe(false);
  });

  it("MANUAL returns useManual=true", () => {
    const r = resolveIntegration("upwork", "manual", false);
    expect(r.effectiveMode).toBe("manual");
    expect(r.shouldRun).toBe(true);
    expect(r.behavior.useManual).toBe(true);
    expect(r.behavior.useLive).toBe(false);
  });

  it("LIVE with prodOnly=false in dev returns useLive=true", () => {
    const r = resolveIntegration("upwork", "live", false);
    expect(r.effectiveMode).toBe("live");
    expect(r.shouldRun).toBe(true);
    expect(r.behavior.useLive).toBe(true);
  });

  it("LIVE with prodOnly=true in dev downgrades to mock", () => {
    const r = resolveIntegration("linkedin", "live", true);
    expect(r.effectiveMode).toBe("mock");
    expect(r.shouldRun).toBe(true);
    expect(r.behavior.useMock).toBe(true);
    expect(r.behavior.useLive).toBe(false);
  });
});

describe("resolveConnection", () => {
  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it("resolves from connection-like object", () => {
    const r = resolveConnection({ provider: "rss", mode: "mock", prodOnly: false });
    expect(r.effectiveMode).toBe("mock");
    expect(r.shouldRun).toBe(true);
  });

  it("handles prodOnly from connection", () => {
    const r = resolveConnection({ provider: "meta", mode: "live", prodOnly: true });
    expect(r.effectiveMode).toBe("mock");
  });
});
