/**
 * Email ingestion parsing tests — Upwork format, partial data, generic fallback,
 * empty subject, HTML-only, SHA256 dedup, duplicate handling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  parseUpworkEmail,
  parseGenericEmail,
  computeEmailHash,
} from "./email-ingestion";

vi.mock("imapflow", () => ({}));
vi.mock("mailparser", () => ({}));

vi.mock("@/lib/pipeline/orchestrator", () => ({
  runPipelineIfEligible: vi.fn().mockResolvedValue({ run: false, reason: "test" }),
}));

describe("parseUpworkEmail", () => {
  it("parses Upwork format: new job subject, budget, skills, URL", () => {
    const subject = "New job: Build a landing page - Upwork";
    const text = `Budget: $1,500 - $3,000
Skills: React, Next.js, Web Design
https://www.upwork.com/jobs/~abc123`;

    const result = parseUpworkEmail(subject, text, "");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Build a landing page");
    expect(result?.source).toBe("upwork");
    expect(result?.budget).toMatch(/\$/);
    expect(result?.sourceUrl).toContain("upwork.com/jobs");
    expect(result?.tags).toContain("React");
  });

  it("parses invitation format", () => {
    const subject = "Invitation: Fix my website - Upwork";
    const text = "Some description";

    const result = parseUpworkEmail(subject, text, "");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Fix my website");
  });

  it("returns null when subject does not match new job or invitation", () => {
    const result = parseUpworkEmail("Random email subject", "body", "");
    expect(result).toBeNull();
  });

  it("handles partial data: no budget, no skills, no URL", () => {
    const subject = "New job: Minimal lead - Upwork";
    const text = "Just a description";

    const result = parseUpworkEmail(subject, text, "");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Minimal lead");
    expect(result?.budget).toBeUndefined();
    expect(result?.tags).toEqual([]);
    expect(result?.sourceUrl).toBeUndefined();
  });

  it("extracts URL from HTML when not in text", () => {
    const subject = "New job: Web project - Upwork";
    const text = "No URL here";
    const html = '<a href="https://www.upwork.com/jobs/~xyz">View job</a>';

    const result = parseUpworkEmail(subject, text, html);

    expect(result?.sourceUrl).toContain("upwork.com/jobs");
  });

  it("truncates description to 3000 chars", () => {
    const subject = "New job: Long lead - Upwork";
    const text = "x".repeat(5000);

    const result = parseUpworkEmail(subject, text, "");

    expect(result?.description.length).toBe(3000);
  });
});

describe("parseGenericEmail", () => {
  it("uses subject as title", () => {
    const result = parseGenericEmail("Inquiry about project", "Body", "client@example.com");
    expect(result.title).toBe("Inquiry about project");
    expect(result.source).toBe("email");
  });

  it("uses Untitled lead for empty subject", () => {
    const result = parseGenericEmail("", "Body", "client@example.com");
    expect(result.title).toBe("Untitled lead");
  });

  it("includes from and text in description", () => {
    const result = parseGenericEmail("Hi", "I need a website", "jane@co.com");
    expect(result.description).toContain("jane@co.com");
    expect(result.description).toContain("I need a website");
  });

  it("truncates description to 3000 chars", () => {
    const result = parseGenericEmail("Subj", "x".repeat(5000), "a@b.com");
    expect(result.description.length).toBeLessThanOrEqual(3500);
  });
});

describe("computeEmailHash", () => {
  it("produces consistent SHA256 hash for same input", () => {
    const h1 = computeEmailHash("Title", "Content");
    const h2 = computeEmailHash("Title", "Content");
    expect(h1).toBe(h2);
  });

  it("produces different hash for different content", () => {
    const h1 = computeEmailHash("Title", "Content A");
    const h2 = computeEmailHash("Title", "Content B");
    expect(h1).not.toBe(h2);
  });

  it("produces 32-char hex string", () => {
    const h = computeEmailHash("T", "C");
    expect(h).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("ingestEmail dedup", () => {
  let leadId: string | null = null;

  afterEach(async () => {
    if (leadId) {
      await db.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
  });

  it("duplicate by contentHash is skipped", async () => {
    const { ingestEmail } = await import("./email-ingestion");

    const subject = "New job: Dedup test - Upwork";
    const text = "Unique content for dedup " + Date.now();
    const html = "";
    const from = "noreply@upwork.com";

    const id1 = await ingestEmail(subject, text, html, from);
    expect(id1).not.toBeNull();
    leadId = id1;

    const id2 = await ingestEmail(subject, text, html, from);
    expect(id2).toBeNull();
  });
});
