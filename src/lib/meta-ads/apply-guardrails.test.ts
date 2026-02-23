import { describe, it, expect } from "vitest";
import {
  checkProtected,
  checkCooldown,
  checkDailyCap,
  buildEvidenceMessage,
} from "./apply-guardrails";

describe("apply-guardrails", () => {
  describe("checkProtected", () => {
    it("allows when no protected IDs", () => {
      const rec = { entityType: "campaign", entityId: "c1", campaignId: null };
      expect(checkProtected(rec, null)).toEqual({ ok: true });
      expect(checkProtected(rec, { protectedCampaignIds: [] })).toEqual({ ok: true });
    });

    it("blocks campaign when entityId is protected", () => {
      const rec = { entityType: "campaign", entityId: "prot1", campaignId: null };
      const settings = { protectedCampaignIds: ["prot1", "prot2"] };
      const r = checkProtected(rec, settings);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("protected");
      expect(r.ok === false && r.reason).toContain("prot1");
    });

    it("allows campaign when not in protected list", () => {
      const rec = { entityType: "campaign", entityId: "c1", campaignId: null };
      const settings = { protectedCampaignIds: ["prot1"] };
      expect(checkProtected(rec, settings)).toEqual({ ok: true });
    });

    it("blocks adset when parent campaign is protected", () => {
      const rec = { entityType: "adset", entityId: "as1", campaignId: "prot1" };
      const settings = { protectedCampaignIds: ["prot1"] };
      const r = checkProtected(rec, settings);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("prot1");
    });

    it("allows adset when parent campaign not protected", () => {
      const rec = { entityType: "adset", entityId: "as1", campaignId: "c1" };
      const settings = { protectedCampaignIds: ["prot1"] };
      expect(checkProtected(rec, settings)).toEqual({ ok: true });
    });

    it("blocks ad when parent campaign is protected", () => {
      const rec = { entityType: "ad", entityId: "ad1", campaignId: "prot1" };
      const settings = { protectedCampaignIds: ["prot1"] };
      const r = checkProtected(rec, settings);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("prot1");
    });
  });

  describe("checkCooldown", () => {
    it("allows when no recent actions", () => {
      expect(
        checkCooldown("acc1", "campaign", "c1", { actionCooldownMinutes: 720 }, [])
      ).toEqual({ ok: true });
    });

    it("allows when cooldown is 0", () => {
      const recent = [{ status: "success", createdAt: new Date() }];
      expect(
        checkCooldown("acc1", "campaign", "c1", { actionCooldownMinutes: 0 }, recent)
      ).toEqual({ ok: true });
    });

    it("blocks when success within cooldown", () => {
      const recent = [{ status: "success", createdAt: new Date() }];
      const r = checkCooldown("acc1", "campaign", "c1", { actionCooldownMinutes: 720 }, recent);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("Cooldown");
    });

    it("blocks when simulated within cooldown", () => {
      const recent = [{ status: "simulated", createdAt: new Date() }];
      const r = checkCooldown("acc1", "campaign", "c1", { actionCooldownMinutes: 720 }, recent);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("Cooldown");
    });

    it("allows when only failed actions in window", () => {
      const recent = [{ status: "failed", createdAt: new Date() }];
      expect(
        checkCooldown("acc1", "campaign", "c1", { actionCooldownMinutes: 720 }, recent)
      ).toEqual({ ok: true });
    });
  });

  describe("checkDailyCap", () => {
    it("allows when under cap", () => {
      const today = [{ status: "success" }];
      expect(
        checkDailyCap("campaign", "c1", { maxActionsPerEntityPerDay: 2 }, today)
      ).toEqual({ ok: true });
    });

    it("blocks when at cap", () => {
      const today = [{ status: "success" }, { status: "simulated" }];
      const r = checkDailyCap("campaign", "c1", { maxActionsPerEntityPerDay: 2 }, today);
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toContain("Daily cap");
    });

    it("allows when cap is 0 (disabled)", () => {
      const today = [{ status: "success" }, { status: "success" }, { status: "success" }];
      expect(
        checkDailyCap("campaign", "c1", { maxActionsPerEntityPerDay: 0 }, today)
      ).toEqual({ ok: true });
    });
  });

  describe("buildEvidenceMessage", () => {
    it("returns empty when no evidence", () => {
      expect(buildEvidenceMessage({})).toBe("");
    });

    it("includes spend, leads, cpl, ruleKey", () => {
      const msg = buildEvidenceMessage(
        { spend: 42, leads: 0, cpl: 100 },
        "no_leads_after_spend",
        "warn",
        "medium"
      );
      expect(msg).toContain("spend=$42");
      expect(msg).toContain("leads=0");
      expect(msg).toContain("cpl=$100");
      expect(msg).toContain("rule=no_leads_after_spend");
      expect(msg).toContain("sev=warn");
      expect(msg).toContain("conf=medium");
    });
  });
});
