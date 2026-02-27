/**
 * Sanity: E2E mutation safety guard triggers on non-local URLs.
 */
import { test, expect } from "@playwright/test";
import { requireSafeE2EBaseUrl } from "./helpers/safety";

test.describe("E2E mutation safety guard", () => {
  test("allows localhost", () => {
    expect(() => requireSafeE2EBaseUrl({ baseUrl: "http://localhost:3000" })).not.toThrow();
    expect(() => requireSafeE2EBaseUrl({ baseUrl: "http://127.0.0.1:3000" })).not.toThrow();
  });

  test("throws on prod URL without E2E_ALLOW_MUTATIONS", () => {
    expect(() => requireSafeE2EBaseUrl({ baseUrl: "https://evenslouis.ca" })).toThrow(/E2E mutation tests require/);
    expect(() => requireSafeE2EBaseUrl({ baseUrl: "https://example.com", allowLocalhostOnly: true })).toThrow(
      /require localhost/
    );
  });

  test("allowLocalhostOnly: prod URL throws even with opt-in (simulated)", () => {
    const orig = process.env.E2E_ALLOW_MUTATIONS;
    process.env.E2E_ALLOW_MUTATIONS = "1";
    try {
      expect(() =>
        requireSafeE2EBaseUrl({ baseUrl: "https://evenslouis.ca", allowLocalhostOnly: true })
      ).toThrow(/require localhost/);
    } finally {
      if (orig !== undefined) process.env.E2E_ALLOW_MUTATIONS = orig;
      else delete process.env.E2E_ALLOW_MUTATIONS;
    }
  });
});
