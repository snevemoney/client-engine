/**
 * Builder create route — verifies enrich path (deliveryProjectId + enrichContextUrl).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGenerateContent = vi.fn().mockResolvedValue({ siteId: "site1", previewUrl: "http://x/preview", status: "draft" });
const mockCreateSite = vi.fn().mockResolvedValue({ siteId: "site1", previewUrl: "http://x/preview", status: "creating", pages: [], createdAt: "", updatedAt: "" });
const mockGetAppUrl = vi.fn().mockReturnValue("http://localhost:3000");

vi.mock("@/lib/builder/client", () => ({
  createSite: (...args: unknown[]) => mockCreateSite(...args),
  generateContent: (siteId: string, genInput: Record<string, unknown>) => mockGenerateContent(siteId, genInput),
}));

vi.mock("@/lib/notify", () => ({
  notifyClientPreview: vi.fn().mockResolvedValue(undefined),
  getAppUrl: () => mockGetAppUrl(),
}));

const mockRequireDeliveryProject = vi.fn();
vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireDeliveryProject: mockRequireDeliveryProject,
    withRouteTiming: (_: string, fn: () => Promise<unknown>) => fn(),
    jsonError: actual.jsonError,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    siteBuildPlan: { findUnique: vi.fn() },
    deliveryProject: { update: vi.fn().mockResolvedValue({}) },
    deliveryActivity: { create: vi.fn().mockResolvedValue({}) },
    deliveryMilestone: { create: vi.fn().mockResolvedValue({}) },
    artifact: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/builder/quality-check", () => ({
  checkAndReactToQuality: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/builder/enrich-site-brief", () => ({
  enrichSiteBrief: vi.fn().mockResolvedValue({
    scope: ["homepage", "about", "services", "contact"],
    brandColors: ["#10b981", "#064e3b"],
    contentHints: "Test hints",
    clientInfo: {
      heroHeadline: "Test Headline",
      heroSubhead: "Test subhead",
      tone: "professional",
    },
    designSystem: {},
  }),
  packContentHintsForBuilder: vi.fn((h: string) => h),
}));

describe("POST /api/delivery-projects/[id]/builder/create", () => {
  const projectId = "proj1";
  const project = {
    id: projectId,
    title: "Test Project",
    clientName: "Test Client",
    builderSiteId: null,
    builderPreset: "custom",
    clientToken: null,
    pipelineLead: { id: "l1", contactName: "Lead", contactEmail: null, description: "Desc", score: 50, scoreReason: null, scoreVerdict: null },
    pipelineLeadId: "l1",
    intakeLeadId: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetAppUrl.mockReturnValue("http://localhost:3000");
    mockRequireDeliveryProject.mockResolvedValue({ ok: true, project } as never);
    const { db } = await import("@/lib/db");
    vi.mocked(db.siteBuildPlan.findUnique).mockResolvedValue(null);
    vi.mocked(db.artifact.findFirst).mockResolvedValue(null);
  });

  it("passes deliveryProjectId and enrichContextUrl when ENRICH_CONTEXT_SECRET is set", async () => {
    const orig = process.env.ENRICH_CONTEXT_SECRET;
    process.env.ENRICH_CONTEXT_SECRET = "test-secret";

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/delivery-projects/proj1/builder/create", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ id: projectId }) });

    process.env.ENRICH_CONTEXT_SECRET = orig;

    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [, genInput] = mockGenerateContent.mock.calls[0] as [string, Record<string, unknown>];
    expect(genInput).toHaveProperty("deliveryProjectId", projectId);
    expect(genInput).toHaveProperty("enrichContextUrl", "http://localhost:3000/api/internal/delivery-projects/proj1/enrich-context");
    expect(genInput).toHaveProperty("sections");
    expect(genInput).toHaveProperty("brandColors");
    expect(genInput.clientInfo).toHaveProperty("bio");
  });

  it("uses full clientInfo (local enrichSiteBrief) when ENRICH_CONTEXT_SECRET is unset", async () => {
    const orig = process.env.ENRICH_CONTEXT_SECRET;
    delete process.env.ENRICH_CONTEXT_SECRET;

    const { POST } = await import("./route");
    const req = new NextRequest("http://x/api/delivery-projects/proj1/builder/create", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ id: projectId }) });

    process.env.ENRICH_CONTEXT_SECRET = orig;

    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [, genInput] = mockGenerateContent.mock.calls[0] as [string, Record<string, unknown>];
    expect(genInput).not.toHaveProperty("deliveryProjectId");
    expect(genInput).not.toHaveProperty("enrichContextUrl");
    expect(genInput.clientInfo).toHaveProperty("name");
    expect(genInput.clientInfo).toHaveProperty("heroHeadline");
  });
});
