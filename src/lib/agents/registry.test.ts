import { describe, it, expect } from "vitest";
import {
  getAgentConfig,
  getAgentIds,
  getAllAgentConfigs,
  validateAgentConfigs,
} from "./registry";

describe("agent registry", () => {
  describe("getAgentConfig", () => {
    it("returns config for valid ID", () => {
      const config = getAgentConfig("commander");
      expect(config).toBeDefined();
      expect(config!.id).toBe("commander");
      expect(config!.name).toBe("Commander");
    });

    it("returns config for each worker ID", () => {
      const ids = [
        "commander", "signal_scout", "outreach_writer", "distribution_ops",
        "conversion_analyst", "followup_enforcer", "proposal_architect",
        "scope_risk_ctrl", "proof_producer", "qa_sentinel",
      ] as const;
      for (const id of ids) {
        expect(getAgentConfig(id)).toBeDefined();
      }
    });

    it("returns undefined for invalid ID", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = getAgentConfig("nonexistent" as any);
      expect(config).toBeUndefined();
    });
  });

  describe("getAgentIds", () => {
    it("returns all 10 worker IDs", () => {
      const ids = getAgentIds();
      expect(ids).toHaveLength(10);
      expect(ids).toContain("commander");
      expect(ids).toContain("signal_scout");
      expect(ids).toContain("outreach_writer");
      expect(ids).toContain("distribution_ops");
      expect(ids).toContain("conversion_analyst");
      expect(ids).toContain("followup_enforcer");
      expect(ids).toContain("proposal_architect");
      expect(ids).toContain("scope_risk_ctrl");
      expect(ids).toContain("proof_producer");
      expect(ids).toContain("qa_sentinel");
    });

    it("does not contain old agent IDs", () => {
      const ids = getAgentIds();
      expect(ids).not.toContain("revenue");
      expect(ids).not.toContain("delivery");
      expect(ids).not.toContain("growth");
      expect(ids).not.toContain("retention");
      expect(ids).not.toContain("intelligence");
      expect(ids).not.toContain("system");
    });
  });

  describe("getAllAgentConfigs", () => {
    it("returns 10 configs", () => {
      const configs = getAllAgentConfigs();
      expect(configs).toHaveLength(10);
    });

    it("each config has required fields", () => {
      for (const config of getAllAgentConfigs()) {
        expect(config.id).toBeTruthy();
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.systemPromptExtension).toBeTruthy();
        expect(Array.isArray(config.allowedTools)).toBe(true);
        expect(config.allowedTools.length).toBeGreaterThan(0);
        expect(Array.isArray(config.scheduledRuns)).toBe(true);
        expect(config.scheduledRuns.length).toBeGreaterThan(0);
        expect(Array.isArray(config.autoApprovedTools)).toBe(true);
      }
    });

    it("each config includes niche context in system prompt", () => {
      for (const config of getAllAgentConfigs()) {
        expect(config.systemPromptExtension).toContain("Niche Context");
      }
    });

    it("autoApprovedTools is subset of allowedTools for every config", () => {
      for (const config of getAllAgentConfigs()) {
        for (const tool of config.autoApprovedTools) {
          expect(config.allowedTools).toContain(tool);
        }
      }
    });

    it("each scheduledRun has valid cronLabel", () => {
      const validLabels = ["daily_morning", "daily_midday", "weekly_monday", "every_6h"];
      for (const config of getAllAgentConfigs()) {
        for (const run of config.scheduledRuns) {
          expect(validLabels).toContain(run.cronLabel);
          expect(run.taskPrompt).toBeTruthy();
        }
      }
    });
  });

  describe("validateAgentConfigs", () => {
    it("all tools exist in BRAIN_TOOLS", async () => {
      const result = await validateAgentConfigs();
      if (!result.valid) {
        // Print errors for debugging
        console.error("Validation errors:", result.errors);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
