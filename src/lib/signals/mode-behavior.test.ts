import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSourceFindUnique = vi.fn();
const mockSourceUpdate = vi.fn();
const mockItemFindUnique = vi.fn();
const mockItemCreate = vi.fn();
const mockLogCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    signalSource: {
      findUnique: mockSourceFindUnique,
      update: mockSourceUpdate,
    },
    signalItem: {
      findUnique: mockItemFindUnique,
      create: mockItemCreate,
    },
    signalSyncLog: {
      create: mockLogCreate,
    },
  },
}));

describe("syncRssSource mode behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OFF mode returns ok with 0 count and no sync", async () => {
    const { syncRssSource } = await import("./rss-sync");
    mockSourceFindUnique.mockResolvedValue({
      id: "src-1",
      name: "Test",
      url: "https://example.com/feed",
      enabled: true,
      mode: "off",
      prodOnly: false,
      type: "rss",
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncRssSource("src-1", "off", false);

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toContain("OFF");
    expect(mockItemCreate).not.toHaveBeenCalled();
    expect(mockLogCreate).toHaveBeenCalled();
  });

  it("LIVE mode in local returns ok with 0 count (skipped)", async () => {
    const { syncRssSource } = await import("./rss-sync");
    mockSourceFindUnique.mockResolvedValue({
      id: "src-1",
      name: "Test",
      url: "https://example.com/feed",
      enabled: true,
      mode: "live",
      prodOnly: false,
      type: "rss",
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncRssSource("src-1", "live", false);

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toContain("production");
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("MANUAL mode returns ok with 0 count", async () => {
    const { syncRssSource } = await import("./rss-sync");
    mockSourceFindUnique.mockResolvedValue({
      id: "src-1",
      name: "Test",
      url: "https://example.com/feed",
      enabled: true,
      mode: "manual",
      prodOnly: false,
      type: "rss",
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncRssSource("src-1", "manual", false);

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toContain("MANUAL");
  });

  it("MOCK mode creates items in local", async () => {
    const { syncRssSource } = await import("./rss-sync");
    mockSourceFindUnique.mockResolvedValue({
      id: "src-1",
      name: "Test",
      url: "https://example.com/feed",
      enabled: true,
      mode: "mock",
      prodOnly: false,
      type: "rss",
      lastSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockItemFindUnique.mockResolvedValue(null);

    const result = await syncRssSource("src-1", "mock", false);

    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(mockItemCreate).toHaveBeenCalled();
    expect(mockLogCreate).toHaveBeenCalled();
  });
});
