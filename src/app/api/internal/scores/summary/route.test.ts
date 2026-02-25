/**
 * Phase 3.2: Unit tests for score summary endpoint response shape.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";

describe("scores summary response shape", () => {
  const ENTITY = "test_summary_shape";

  beforeEach(async () => {
    await db.scoreSnapshot.deleteMany({ where: { entityId: ENTITY } });
    await db.scoreEvent.deleteMany({ where: { entityId: ENTITY } });
  });

  it("returns expected shape when snapshot exists", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: ENTITY,
        score: 82,
        band: "healthy",
        delta: 3,
        factorsJson: [{ key: "f1", label: "Factor 1", weight: 0.5, normalizedValue: 80, impact: 5 }],
        reasonsJson: [{ label: "Good reason", impact: 5, direction: "positive" }],
        computedAt: new Date(),
      },
    });

    const latest = await db.scoreSnapshot.findFirst({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { computedAt: "desc" },
    });
    const previous = await db.scoreSnapshot.findMany({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { computedAt: "desc" },
      skip: 1,
      take: 1,
    });
    const events = await db.scoreEvent.findMany({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const parseReasons = (rj: unknown) => {
      if (!Array.isArray(rj)) return [];
      return rj.map((r: { label?: string; impact?: number; direction?: string }) => ({
        label: String(r?.label ?? "—"),
        impact: Number(r?.impact) ?? 0,
        direction: String(r?.direction ?? "neutral"),
      })).sort((a: { impact: number }, b: { impact: number }) => a.impact - b.impact);
    };
    const parseFactors = (fj: unknown) => {
      if (!Array.isArray(fj)) return [];
      return fj.map((f: { key?: string; label?: string; weight?: number; normalizedValue?: number; impact?: number }) => ({
        key: String(f?.key ?? ""),
        label: String(f?.label ?? "—"),
        weight: Number(f?.weight) ?? 0,
        normalizedValue: Number(f?.normalizedValue) ?? 0,
        impact: Number(f?.impact) ?? 0,
      }));
    };

    const prevSnapshot = previous[0] ?? null;
    const previousFactorSummary = prevSnapshot ? parseFactors(prevSnapshot.factorsJson) : null;

    const response = {
      latest: latest
        ? {
            id: latest.id,
            score: latest.score,
            band: latest.band,
            delta: latest.delta,
            computedAt: latest.computedAt.toISOString(),
            topReasons: parseReasons(latest.reasonsJson),
            factorSummary: parseFactors(latest.factorsJson),
          }
        : null,
      previous: prevSnapshot
        ? {
            id: prevSnapshot.id,
            score: prevSnapshot.score,
            band: prevSnapshot.band,
            computedAt: prevSnapshot.computedAt.toISOString(),
          }
        : null,
      previousFactorSummary,
      recentEvents: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromScore: e.fromScore,
        toScore: e.toScore,
        delta: e.delta,
        fromBand: e.fromBand,
        toBand: e.toBand,
        createdAt: e.createdAt.toISOString(),
      })),
    };

    expect(response.latest).not.toBeNull();
    expect(response.latest).toHaveProperty("score", 82);
    expect(response.latest).toHaveProperty("band", "healthy");
    expect(response.latest).toHaveProperty("topReasons");
    expect(response.latest).toHaveProperty("factorSummary");
    expect(Array.isArray((response.latest as { topReasons: unknown[] }).topReasons)).toBe(true);
    expect(Array.isArray((response.latest as { factorSummary: unknown[] }).factorSummary)).toBe(true);
    expect(response).toHaveProperty("previousFactorSummary");
    expect(response.previousFactorSummary === null || Array.isArray(response.previousFactorSummary)).toBe(true);
    expect(response).toHaveProperty("recentEvents");
    expect(Array.isArray(response.recentEvents)).toBe(true);
  });

  it("previousFactorSummary populated when two snapshots exist", async () => {
    const past = new Date();
    past.setHours(past.getHours() - 2);
    await db.scoreSnapshot.createMany({
      data: [
        {
          entityType: "command_center",
          entityId: ENTITY,
          score: 60,
          band: "warning",
          factorsJson: [{ key: "f1", label: "F1", weight: 0.5, normalizedValue: 50, impact: -5 }],
          reasonsJson: [],
          computedAt: past,
        },
        {
          entityType: "command_center",
          entityId: ENTITY,
          score: 75,
          band: "healthy",
          factorsJson: [{ key: "f1", label: "F1", weight: 0.5, normalizedValue: 70, impact: 2 }],
          reasonsJson: [],
          computedAt: new Date(),
        },
      ],
    });
    const latest = await db.scoreSnapshot.findFirst({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { computedAt: "desc" },
    });
    const previous = await db.scoreSnapshot.findMany({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { computedAt: "desc" },
      skip: 1,
      take: 1,
    });
    const parseFactors = (fj: unknown) => {
      if (!Array.isArray(fj)) return [];
      return fj.map((f: { key?: string; label?: string; weight?: number; normalizedValue?: number; impact?: number }) => ({
        key: String(f?.key ?? ""),
        label: String(f?.label ?? "—"),
        weight: Number(f?.weight) ?? 0,
        normalizedValue: Number(f?.normalizedValue) ?? 0,
        impact: Number(f?.impact) ?? 0,
      }));
    };
    const prevSnapshot = previous[0] ?? null;
    const previousFactorSummary = prevSnapshot ? parseFactors(prevSnapshot.factorsJson) : null;
    expect(previousFactorSummary).not.toBeNull();
    expect(Array.isArray(previousFactorSummary)).toBe(true);
    expect(previousFactorSummary).toHaveLength(1);
    expect(previousFactorSummary![0]).toMatchObject({ key: "f1", normalizedValue: 50, impact: -5 });
  });

  it("handles no data case", async () => {
    const latest = await db.scoreSnapshot.findFirst({
      where: { entityType: "command_center", entityId: ENTITY },
      orderBy: { computedAt: "desc" },
    });
    expect(latest).toBeNull();
  });
});
