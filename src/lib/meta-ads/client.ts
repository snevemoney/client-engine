/**
 * Meta Marketing API (Graph API) client — read-only.
 * Fetches ad account insights, campaigns, ad sets, ads.
 * Requires META_ACCESS_TOKEN and META_AD_ACCOUNT_ID.
 */

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const TIMEOUT_MS = 30000;

export type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d";

const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "frequency",
  "actions",
  "cost_per_action_type",
].join(",");

type GraphError = { message: string; type: string; code?: number };

async function metaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN not set");

  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  const res = await fetch(url.toString(), { signal: ctrl.signal });
  clearTimeout(id);

  const json = (await res.json()) as { data?: T; error?: GraphError; paging?: { next?: string } };

  if (json.error) {
    const err = json.error;
    throw new Error(err.message || `Meta API error ${err.code ?? ""}`);
  }

  return json as T;
}

/** POST to Meta Graph API (e.g. status updates). Requires ads_management. */
async function metaPost(path: string, body: Record<string, string>): Promise<{ success?: boolean }> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN not set");

  const url = new URL(`${BASE}/${path}`);
  const params = new URLSearchParams({ access_token: token, ...body });

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  const res = await fetch(url.toString(), {
    method: "POST",
    body: params,
    signal: ctrl.signal,
  });
  clearTimeout(id);

  const json = (await res.json()) as { success?: boolean; error?: GraphError };

  if (json.error) {
    const err = json.error;
    throw new Error(err.message || `Meta API error ${err.code ?? ""}`);
  }

  return json;
}

async function metaFetchPaginated<T extends { id?: string }>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const result = await metaFetch<{ data: T[]; paging?: { next?: string } }>(path, params);
  const items = result.data ?? [];
  let all = [...items];
  let next = (result as { paging?: { next?: string } }).paging?.next;

  while (next) {
    const res = await fetch(next, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = (await res.json()) as { data: T[]; paging?: { next?: string } };
    all = all.concat(json.data ?? []);
    next = json.paging?.next;
  }

  return all;
}

function accountPath(accountId: string): string {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return id;
}

export async function fetchAccountInsights(
  accountId: string,
  datePreset: DatePreset
): Promise<{ data: Array<Record<string, unknown>> }> {
  const path = `${accountPath(accountId)}/insights`;
  return metaFetch(path, {
    fields: INSIGHT_FIELDS,
    date_preset: datePreset,
  });
}

/** Fetch account insights for explicit time range (for prior period comparison). */
export async function fetchAccountInsightsTimeRange(
  accountId: string,
  since: string,
  until: string
): Promise<{ data: Array<Record<string, unknown>> }> {
  const path = `${accountPath(accountId)}/insights`;
  return metaFetch(path, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
  });
}

/** Fetch insights for a single entity (campaign/adset/ad) with time range. */
export async function fetchEntityInsightsTimeRange(
  entityId: string,
  since: string,
  until: string
): Promise<Record<string, unknown> | null> {
  const res = await metaFetch<{ data?: Array<Record<string, unknown>> }>(
    `${entityId}/insights`,
    { fields: INSIGHT_FIELDS, time_range: JSON.stringify({ since, until }) }
  );
  const arr = res?.data ?? [];
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

export async function fetchCampaigns(
  accountId: string,
  datePreset: DatePreset
): Promise<Array<{ id: string; name: string; status?: string; effective_status?: string; objective?: string; insights?: { data: Array<Record<string, unknown>> } }>> {
  const path = `${accountPath(accountId)}/campaigns`;
  const campaigns = await metaFetchPaginated(path, {
    fields: `id,name,status,effective_status,objective,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}`,
    date_preset: datePreset,
  });

  return campaigns.map((c) => {
    const ins = (c as { insights?: { data?: Array<Record<string, unknown>> } }).insights?.data;
    const insight = Array.isArray(ins) && ins.length > 0 ? ins[0] : {};
    return {
      id: (c as { id: string }).id,
      name: (c as { name?: string }).name ?? "—",
      status: (c as { status?: string }).status,
      effective_status: (c as { effective_status?: string }).effective_status,
      objective: (c as { objective?: string }).objective,
      insights: { data: [insight] },
    };
  });
}

/** Fetch campaigns with insights + delivery/learning fields. */
export async function fetchCampaignsWithInsights(
  accountId: string,
  datePreset: DatePreset
): Promise<Array<{ id: string; name: string; status?: string; effective_status?: string; objective?: string; insight?: Record<string, unknown>; delivery_info?: { status?: string }; learning_type_info?: { learning_type?: string }; review_feedback?: { abstract_message?: string } }>> {
  const path = `${accountPath(accountId)}/campaigns`;
  const fields = `id,name,status,effective_status,objective,delivery_info{status},learning_type_info{learning_type},review_feedback{abstract_message}`;
  const campaigns = await metaFetchPaginated(path, { fields });

  const withInsights: Array<{
    id: string;
    name: string;
    status?: string;
    effective_status?: string;
    objective?: string;
    insight?: Record<string, unknown>;
    delivery_info?: { status?: string };
    learning_type_info?: { learning_type?: string };
    review_feedback?: { abstract_message?: string };
  }> = [];

  for (const c of campaigns) {
    const id = (c as { id: string }).id;
    try {
      const insightRes = await metaFetch<{ data?: Array<Record<string, unknown>> }>(
        `${id}/insights`,
        { fields: INSIGHT_FIELDS, date_preset: datePreset }
      );
      const insight = Array.isArray(insightRes?.data) && insightRes.data.length > 0 ? insightRes.data[0] : undefined;
      withInsights.push({
        id,
        name: (c as { name?: string }).name ?? "—",
        status: (c as { status?: string }).status,
        effective_status: (c as { effective_status?: string }).effective_status,
        objective: (c as { objective?: string }).objective,
        insight,
        delivery_info: (c as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (c as { learning_type_info?: { learning_type?: string } }).learning_type_info,
        review_feedback: (c as { review_feedback?: { abstract_message?: string } }).review_feedback,
      });
    } catch {
      withInsights.push({
        id,
        name: (c as { name?: string }).name ?? "—",
        status: (c as { status?: string }).status,
        effective_status: (c as { effective_status?: string }).effective_status,
        objective: (c as { objective?: string }).objective,
        delivery_info: (c as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (c as { learning_type_info?: { learning_type?: string } }).learning_type_info,
        review_feedback: (c as { review_feedback?: { abstract_message?: string } }).review_feedback,
      });
    }
  }

  return withInsights;
}

export async function fetchAdSetsWithInsights(
  accountId: string,
  datePreset: DatePreset
): Promise<Array<{ id: string; name: string; campaign_id?: string; status?: string; effective_status?: string; objective?: string; insight?: Record<string, unknown>; delivery_info?: { status?: string }; learning_type_info?: { learning_type?: string } }>> {
  const path = `${accountPath(accountId)}/adsets`;
  const fields = `id,name,campaign_id,status,effective_status,objective,delivery_info{status},learning_type_info{learning_type}`;
  const adsets = await metaFetchPaginated(path, { fields });

  const withInsights: Array<{
    id: string;
    name: string;
    campaign_id?: string;
    status?: string;
    effective_status?: string;
    objective?: string;
    insight?: Record<string, unknown>;
    delivery_info?: { status?: string };
    learning_type_info?: { learning_type?: string };
  }> = [];

  for (const a of adsets) {
    const id = (a as { id: string }).id;
    try {
      const insightRes = await metaFetch<{ data?: Array<Record<string, unknown>> }>(
        `${id}/insights`,
        { fields: INSIGHT_FIELDS, date_preset: datePreset }
      );
      const insight = Array.isArray(insightRes?.data) && insightRes.data.length > 0 ? insightRes.data[0] : undefined;
      withInsights.push({
        id,
        name: (a as { name?: string }).name ?? "—",
        campaign_id: (a as { campaign_id?: string }).campaign_id,
        status: (a as { status?: string }).status,
        effective_status: (a as { effective_status?: string }).effective_status,
        objective: (a as { objective?: string }).objective,
        insight,
        delivery_info: (a as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (a as { learning_type_info?: { learning_type?: string } }).learning_type_info,
      });
    } catch {
      withInsights.push({
        id,
        name: (a as { name?: string }).name ?? "—",
        campaign_id: (a as { campaign_id?: string }).campaign_id,
        status: (a as { status?: string }).status,
        effective_status: (a as { effective_status?: string }).effective_status,
        objective: (a as { objective?: string }).objective,
        delivery_info: (a as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (a as { learning_type_info?: { learning_type?: string } }).learning_type_info,
      });
    }
  }

  return withInsights;
}

export async function fetchAdsWithInsights(
  accountId: string,
  datePreset: DatePreset
): Promise<
  Array<{
    id: string;
    name: string;
    adset_id?: string;
    creative?: { id?: string };
    status?: string;
    effective_status?: string;
    objective?: string;
    insight?: Record<string, unknown>;
    thumbnailUrl?: string | null;
    delivery_info?: { status?: string };
    learning_type_info?: { learning_type?: string };
  }>
> {
  const path = `${accountPath(accountId)}/ads`;
  const fields = `id,name,adset_id,creative{id},status,effective_status,delivery_info{status},learning_type_info{learning_type}`;
  const ads = await metaFetchPaginated(path, { fields });

  const withInsights: Array<{
    id: string;
    name: string;
    adset_id?: string;
    creative?: { id?: string };
    status?: string;
    effective_status?: string;
    objective?: string;
    insight?: Record<string, unknown>;
    thumbnailUrl?: string | null;
    delivery_info?: { status?: string };
    learning_type_info?: { learning_type?: string };
  }> = [];

  for (const a of ads) {
    const id = (a as { id: string }).id;
    try {
      const insightRes = await metaFetch<{ data?: Array<Record<string, unknown>> }>(
        `${id}/insights`,
        { fields: INSIGHT_FIELDS, date_preset: datePreset }
      );
      const insight = Array.isArray(insightRes?.data) && insightRes.data.length > 0 ? insightRes.data[0] : undefined;
      // Thumbnail: optional; skip per-ad fetch to avoid rate limits (can add in V2)

      withInsights.push({
        id,
        name: (a as { name?: string }).name ?? "—",
        adset_id: (a as { adset_id?: string }).adset_id,
        creative: (a as { creative?: { id?: string } }).creative,
        status: (a as { status?: string }).status,
        effective_status: (a as { effective_status?: string }).effective_status,
        insight,
        delivery_info: (a as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (a as { learning_type_info?: { learning_type?: string } }).learning_type_info,
      });
    } catch {
      withInsights.push({
        id,
        name: (a as { name?: string }).name ?? "—",
        adset_id: (a as { adset_id?: string }).adset_id,
        creative: (a as { creative?: { id?: string } }).creative,
        status: (a as { status?: string }).status,
        effective_status: (a as { effective_status?: string }).effective_status,
        delivery_info: (a as { delivery_info?: { status?: string } }).delivery_info,
        learning_type_info: (a as { learning_type_info?: { learning_type?: string } }).learning_type_info,
      });
    }
  }

  return withInsights;
}

export type MetaStatusLevel = "campaign" | "adset" | "ad";

export type UpdateStatusResult =
  | { ok: true; level: MetaStatusLevel; id: string; previousStatus: string; newStatus: string; message: string }
  | { ok: false; error: string; code?: string };

/** Update campaign, ad set, or ad status (pause/resume). Requires ads_management permission. */
export async function updateMetaObjectStatus(
  level: MetaStatusLevel,
  id: string,
  action: "pause" | "resume"
): Promise<UpdateStatusResult> {
  const status = action === "pause" ? "PAUSED" : "ACTIVE";
  try {
    await metaPost(id, { status });
    return {
      ok: true,
      level,
      id,
      previousStatus: action === "pause" ? "ACTIVE" : "PAUSED",
      newStatus: status,
      message: `${level} ${id} ${action}d successfully`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let code: string = "API_ERROR";
    if (msg.toLowerCase().includes("token") || msg.includes("Invalid OAuth") || msg.includes("expired")) {
      code = "INVALID_TOKEN";
    } else if (msg.includes("permission") || msg.includes("(#100)") || msg.includes("access") || msg.includes("ads_management")) {
      code = "PERMISSION_DENIED";
    } else if (msg.includes("rate") || msg.includes("throttl") || msg.includes("limit")) {
      code = "RATE_LIMIT";
    } else if (msg.includes("not exist") || msg.includes("not found") || msg.includes("Unknown")) {
      code = "NOT_FOUND";
    }
    return { ok: false, error: msg, code };
  }
}
