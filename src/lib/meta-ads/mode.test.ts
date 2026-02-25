/**
 * Mode selection and mock scenario tests.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMetaMode, getMetaMockScenario, META_MOCK_SCENARIOS } from "./mode";
import { getMockDashboardData } from "./mock-provider";

const originalEnv = { ...process.env };
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
  Object.keys(env).forEach((k) => delete env[k]);
  Object.assign(env, originalEnv);
});

afterEach(() => {
  Object.keys(env).forEach((k) => delete env[k]);
  Object.assign(env, originalEnv);
});

describe("getMetaMode", () => {
  it("returns mock when META_MODE=mock", () => {
    env.META_MODE = "mock";
    expect(getMetaMode()).toBe("mock");
  });

  it("returns live when META_MODE=live", () => {
    env.META_MODE = "live";
    expect(getMetaMode()).toBe("live");
  });

  it("returns mock when NODE_ENV is not production and no override", () => {
    delete env.META_MODE;
    env.NODE_ENV = "development";
    expect(getMetaMode()).toBe("mock");
  });

  it("returns live when NODE_ENV=production and token+account set", () => {
    delete env.META_MODE;
    env.NODE_ENV = "production";
    env.META_ACCESS_TOKEN = "token";
    env.META_AD_ACCOUNT_ID = "act_123";
    expect(getMetaMode()).toBe("live");
  });

  it("returns mock when NODE_ENV=production but no token", () => {
    delete env.META_MODE;
    env.NODE_ENV = "production";
    env.META_AD_ACCOUNT_ID = "act_123";
    delete env.META_ACCESS_TOKEN;
    expect(getMetaMode()).toBe("mock");
  });
});

describe("getMetaMockScenario", () => {
  it("returns valid scenario when set", () => {
    env.META_MOCK_SCENARIO = "high_cpl";
    expect(getMetaMockScenario()).toBe("high_cpl");
  });

  it("returns healthy_campaigns when invalid or unset", () => {
    env.META_MOCK_SCENARIO = "invalid";
    expect(getMetaMockScenario()).toBe("healthy_campaigns");
  });
});

describe("mock provider data shape", () => {
  it("no_campaigns returns empty campaigns and valid summary", () => {
    env.META_MOCK_SCENARIO = "no_campaigns";
    const data = getMockDashboardData("act_mock", "last_7d");
    expect(data.ok).toBe(true);
    expect(data.campaigns).toEqual([]);
    expect(data.adsets).toEqual([]);
    expect(data.ads).toEqual([]);
    expect(data.summary.spend).toBe(0);
    expect(data.summary.leads).toBe(0);
  });

  it("healthy_campaigns returns campaigns with leads", () => {
    env.META_MOCK_SCENARIO = "healthy_campaigns";
    const data = getMockDashboardData("act_mock", "last_7d");
    expect(data.ok).toBe(true);
    expect(data.campaigns.length).toBeGreaterThan(0);
    expect(data.summary.leads).toBeGreaterThan(0);
    expect(data.summary.costPerLead).toBeGreaterThan(0);
  });

  it("high_cpl returns high cost per lead", () => {
    env.META_MOCK_SCENARIO = "high_cpl";
    const data = getMockDashboardData("act_mock", "last_7d");
    expect(data.ok).toBe(true);
    expect(data.summary.costPerLead).toBe(100);
  });

  it("no_leads_after_spend returns spend but zero leads", () => {
    env.META_MOCK_SCENARIO = "no_leads_after_spend";
    const data = getMockDashboardData("act_mock", "last_7d");
    expect(data.ok).toBe(true);
    expect(data.summary.spend).toBe(85);
    expect(data.summary.leads).toBe(0);
    expect(data.campaigns.some((c) => c.spend > 0 && c.leads === 0)).toBe(true);
  });
});
