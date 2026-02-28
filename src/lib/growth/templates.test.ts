/**
 * Phase 6.3: Outreach templates unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  OUTREACH_TEMPLATES,
  TEMPLATE_KEYS,
  getTemplate,
  renderTemplate,
} from "./templates";

describe("growth templates", () => {
  it("all template keys exist and have content", () => {
    expect(TEMPLATE_KEYS.length).toBeGreaterThan(0);
    for (const key of TEMPLATE_KEYS) {
      const t = getTemplate(key);
      expect(t).toBeDefined();
      expect(t!.content).toBeTruthy();
      expect(t!.content.length).toBeGreaterThan(10);
    }
  });

  it("nextFollowUpDays is valid (2, 3, or 7)", () => {
    for (const key of TEMPLATE_KEYS) {
      const t = getTemplate(key);
      expect(t).toBeDefined();
      expect([2, 3, 7]).toContain(t!.nextFollowUpDays);
    }
  });

  it("getTemplate returns null for unknown key", () => {
    expect(getTemplate("unknown_key")).toBeNull();
  });

  it("renderTemplate replaces placeholders", () => {
    const t = getTemplate("broken_link_fix")!;
    const out = renderTemplate(t, {
      name: "Tom",
      currentWebPresence: "linktr.ee/tom",
    });
    expect(out).toContain("Tom");
    expect(out).toContain("linktr.ee/tom");
    expect(out).not.toContain("{{name}}");
  });

  it("registry has expected keys", () => {
    const expected = [
      "broken_link_fix",
      "google_form_upgrade",
      "linktree_cleanup",
      "big_audience_no_site",
      "canva_site_upgrade",
      "calendly_blank_fix",
    ];
    for (const k of expected) {
      expect(OUTREACH_TEMPLATES[k]).toBeDefined();
    }
  });
});
