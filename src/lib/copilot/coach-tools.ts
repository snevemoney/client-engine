/**
 * Phase 5.1: Coach Mode tool layer.
 * Server-side functions that fetch context from internal APIs.
 * Callable from the coach route; fully testable via injected fetch.
 */

export type CoachFetchOptions = {
  baseUrl: string;
  cookie?: string;
};

export type ScoreContext = {
  latest: { id?: string; score: number; band: string; computedAt: string } | null;
  recentEvents: Array<{ eventType: string; createdAt: string; meta?: unknown }>;
  error?: string;
};

export type RiskContext = {
  summary: { openBySeverity: Record<string, number>; lastRunAt: string | null };
  top: Array<{ id: string; title: string; severity: string; status: string; ruleKey?: string }>;
  error?: string;
};

export type NBAContext = {
  summary: {
    top5: Array<{ id: string; title: string; priority: string; score: number }>;
    queuedByPriority: Record<string, number>;
    lastRunAt: string | null;
  };
  top: Array<{
    id: string;
    title: string;
    priority: string;
    score: number;
    reason: string | null;
    ruleKey?: string;
    dedupeKey?: string;
  }>;
  error?: string;
};

export type RunResult = { ok: boolean; error?: string; data?: unknown };

type FetchFn = typeof fetch;

async function coachFetch(
  url: string,
  opts: CoachFetchOptions,
  init?: RequestInit,
  fetchFn: FetchFn = fetch
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (opts.cookie) headers["Cookie"] = opts.cookie;

  try {
    const res = await fetchFn(url, { ...init, headers });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fetch failed" };
  }
}

export async function getScoreContext(
  entityType: string,
  entityId: string,
  opts: CoachFetchOptions,
  fetchFn = fetch
): Promise<ScoreContext> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const summaryUrl = `${base}/api/internal/scores/summary?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;
  const historyUrl = `${base}/api/internal/scores/history?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&range=7d`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.cookie) headers["Cookie"] = opts.cookie;

  const [summaryRes, historyRes] = await Promise.all([
    coachFetch(summaryUrl, opts, undefined, fetchFn),
    coachFetch(historyUrl, opts, undefined, fetchFn),
  ]);

  if (!summaryRes.ok) {
    return { latest: null, recentEvents: [], error: summaryRes.error };
  }

  const summary = summaryRes.data as {
    latest?: { id?: string; score?: number; band?: string; computedAt?: string };
    recentEvents?: Array<{ eventType?: string; createdAt?: string; meta?: unknown }>;
  };
  const latest = summary.latest
    ? {
        id: summary.latest.id,
        score: summary.latest.score ?? 0,
        band: summary.latest.band ?? "unknown",
        computedAt: summary.latest.computedAt ?? new Date().toISOString(),
      }
    : null;

  let recentEvents: ScoreContext["recentEvents"] = [];
  if (historyRes.ok) {
    const history = historyRes.data as { events?: Array<{ eventType?: string; createdAt?: string; meta?: unknown }> };
    recentEvents = (history.events ?? []).map((e) => ({
      eventType: e.eventType ?? "unknown",
      createdAt: e.createdAt ?? new Date().toISOString(),
      meta: e.meta,
    }));
  } else if (summary.recentEvents) {
    recentEvents = summary.recentEvents.map((e) => ({
      eventType: e.eventType ?? "unknown",
      createdAt: e.createdAt ?? new Date().toISOString(),
      meta: e.meta,
    }));
  }

  return { latest, recentEvents };
}

export async function getRiskContext(
  _entityType: string,
  _entityId: string,
  opts: CoachFetchOptions,
  fetchFn: FetchFn = fetch
): Promise<RiskContext> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const summaryUrl = `${base}/api/risk/summary`;
  const listUrl = `${base}/api/risk?status=open&pageSize=5`;

  const [summaryRes, listRes] = await Promise.all([
    coachFetch(summaryUrl, opts, undefined, fetchFn),
    coachFetch(listUrl, opts, undefined, fetchFn),
  ]);

  if (!summaryRes.ok) {
    return {
      summary: { openBySeverity: {}, lastRunAt: null },
      top: [],
      error: summaryRes.error,
    };
  }

  const summaryData = summaryRes.data as {
    openBySeverity?: Record<string, number>;
    lastRunAt?: string | null;
  };
  const summary = {
    openBySeverity: summaryData.openBySeverity ?? {},
    lastRunAt: summaryData.lastRunAt ?? null,
  };

  let top: RiskContext["top"] = [];
  if (listRes.ok) {
    const list = listRes.data as {
      items?: Array<{ id: string; title: string; severity: string; status: string; createdByRule?: string }>;
    };
    top = (list.items ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      ruleKey: r.createdByRule,
    }));
  }

  return { summary, top, error: listRes.ok ? undefined : listRes.error };
}

export async function getNBAContext(
  entityType: string,
  entityId: string,
  opts: CoachFetchOptions,
  fetchFn: FetchFn = fetch
): Promise<NBAContext> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const summaryUrl = `${base}/api/next-actions/summary?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;
  const listUrl = `${base}/api/next-actions?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&status=queued&pageSize=5`;

  const [summaryRes, listRes] = await Promise.all([
    coachFetch(summaryUrl, opts, undefined, fetchFn),
    coachFetch(listUrl, opts, undefined, fetchFn),
  ]);

  if (!summaryRes.ok) {
    return {
      summary: { top5: [], queuedByPriority: {}, lastRunAt: null },
      top: [],
      error: summaryRes.error,
    };
  }

  const summaryData = summaryRes.data as {
    top5?: Array<{ id: string; title: string; priority: string; score: number }>;
    queuedByPriority?: Record<string, number>;
    lastRunAt?: string | null;
  };
  const summary = {
    top5: summaryData.top5 ?? [],
    queuedByPriority: summaryData.queuedByPriority ?? {},
    lastRunAt: summaryData.lastRunAt ?? null,
  };

  let top: NBAContext["top"] = [];
  if (listRes.ok) {
    const list = listRes.data as {
      items?: Array<{
        id: string;
        title: string;
        priority: string;
        score: number;
        reason: string | null;
        createdByRule?: string;
        dedupeKey?: string;
      }>;
    };
    top = (list.items ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      score: a.score,
      reason: a.reason ?? null,
      ruleKey: a.createdByRule,
      dedupeKey: a.dedupeKey,
    }));
  } else {
    top = summary.top5.map((a) => ({ ...a, reason: null }));
  }

  return { summary, top, error: listRes.ok ? undefined : listRes.error };
}

export async function runRecomputeScore(
  entityType: string,
  entityId: string,
  opts: CoachFetchOptions,
  fetchFn: FetchFn = fetch
): Promise<RunResult> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const url = `${base}/api/internal/scores/compute`;
  const res = await coachFetch(
    url,
    opts,
    { method: "POST", body: JSON.stringify({ entityType, entityId }) },
    fetchFn
  );
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

export async function runRiskRules(
  opts: CoachFetchOptions,
  fetchFn: FetchFn = fetch
): Promise<RunResult> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const url = `${base}/api/risk/run-rules`;
  const res = await coachFetch(url, opts, { method: "POST" }, fetchFn);
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

export async function runNextActions(
  entityType: string,
  entityId: string,
  opts: CoachFetchOptions,
  fetchFn: FetchFn = fetch
): Promise<RunResult> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const url = `${base}/api/next-actions/run?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;
  const res = await coachFetch(url, opts, { method: "POST" }, fetchFn);
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}
