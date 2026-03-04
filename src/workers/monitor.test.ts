/**
 * Monitor threshold tests — SSL 30-day warn, 7-day error, HTTP timeout handling.
 */
import { describe, it, expect, vi } from "vitest";
import { sslStatusFromDaysLeft, checkUrl } from "./monitor";

describe("sslStatusFromDaysLeft", () => {
  it("returns error when SSL expires in less than 7 days", () => {
    expect(sslStatusFromDaysLeft(0)).toBe("error");
    expect(sslStatusFromDaysLeft(3)).toBe("error");
    expect(sslStatusFromDaysLeft(6)).toBe("error");
  });

  it("returns warning when SSL expires in 7-29 days", () => {
    expect(sslStatusFromDaysLeft(7)).toBe("warning");
    expect(sslStatusFromDaysLeft(15)).toBe("warning");
    expect(sslStatusFromDaysLeft(29)).toBe("warning");
  });

  it("returns ok when SSL valid for 30+ days", () => {
    expect(sslStatusFromDaysLeft(30)).toBe("ok");
    expect(sslStatusFromDaysLeft(90)).toBe("ok");
  });
});

describe("checkUrl", () => {
  it("returns error with Timeout message when request times out", async () => {
    const result = await checkUrl("http://10.255.255.1", 1);
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/Timeout|timeout|ECONNREFUSED|ETIMEDOUT/i);
  });
});
