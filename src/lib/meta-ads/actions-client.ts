/**
 * V3 Meta Ads write actions — pause, resume, budget.
 * Isolated from read client. Supports dry-run.
 */

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const TIMEOUT_MS = 15000;

type GraphError = { message: string; code?: number };

async function metaPost(path: string, body: Record<string, string>): Promise<{ success?: boolean }> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN not set");

  const params = new URLSearchParams({ access_token: token, ...body });
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { success?: boolean; error?: GraphError };

  if (json.error) {
    throw new Error(json.error.message ?? `Meta API error ${json.error.code ?? ""}`);
  }
  return json;
}

async function metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN not set");

  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const json = (await res.json()) as T & { error?: GraphError };

  if (json.error) {
    throw new Error(json.error.message ?? `Meta API error ${json.error.code ?? ""}`);
  }
  return json as T;
}

export type ExecuteResult =
  | {
      ok: true;
      entityType: string;
      entityId: string;
      actionType: string;
      requestPayload: Record<string, unknown>;
      responseSummary: string;
      dryRun?: boolean;
      simulated?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      entityType?: string;
      entityId?: string;
    };

export type ActionPayload = {
  percentIncrease?: number;
  percentDecrease?: number;
};

/** Execute Meta write action. If dryRun, returns simulated result without calling Meta. */
export async function executeMetaAction(
  entityType: "campaign" | "adset" | "ad",
  entityId: string,
  entityName: string,
  actionType: "pause" | "resume" | "increase_budget" | "decrease_budget",
  actionPayload: ActionPayload,
  dryRun: boolean
): Promise<ExecuteResult> {
  if (actionType === "pause") {
    if (dryRun) {
      return {
        ok: true,
        entityType,
        entityId,
        actionType: "pause",
        requestPayload: { status: "PAUSED" },
        responseSummary: `[DRY RUN] Would pause ${entityName}`,
        dryRun: true,
        simulated: true,
      };
    }
    try {
      await metaPost(entityId, { status: "PAUSED" });
      return {
        ok: true,
        entityType,
        entityId,
        actionType: "pause",
        requestPayload: { status: "PAUSED" },
        responseSummary: `Paused ${entityName}`,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        entityType,
        entityId,
      };
    }
  }

  if (actionType === "resume") {
    if (dryRun) {
      return {
        ok: true,
        entityType,
        entityId,
        actionType: "resume",
        requestPayload: { status: "ACTIVE" },
        responseSummary: `[DRY RUN] Would resume ${entityName}`,
        dryRun: true,
        simulated: true,
      };
    }
    try {
      await metaPost(entityId, { status: "ACTIVE" });
      return {
        ok: true,
        entityType,
        entityId,
        actionType: "resume",
        requestPayload: { status: "ACTIVE" },
        responseSummary: `Resumed ${entityName}`,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        entityType,
        entityId,
      };
    }
  }

  // Budget changes: campaign (CBO) or ad set
  if (actionType === "increase_budget" || actionType === "decrease_budget") {
    const budgetLevel = entityType === "campaign" ? "campaign" : entityType === "adset" ? "adset" : null;
    if (budgetLevel === null) {
      return {
        ok: false,
        error: "Budget changes supported for campaigns and ad sets only",
        entityType,
        entityId,
      };
    }

    const pct = actionType === "increase_budget"
      ? (actionPayload.percentIncrease ?? 10)
      : (actionPayload.percentDecrease ?? 10);

    // Fetch current daily_budget (in cents) — campaign or ad set
    let currentCents: number;
    try {
      const obj = await metaGet<{ daily_budget?: string; lifetime_budget?: string }>(entityId, {
        fields: "daily_budget,lifetime_budget",
      });
      const raw = obj.daily_budget;
      if (raw == null || raw === "") {
        const hasLifetime = obj.lifetime_budget != null && obj.lifetime_budget !== "";
        return {
          ok: false,
          error: hasLifetime
            ? "Entity uses lifetime budget; daily_budget changes not supported"
            : `${budgetLevel} has no daily_budget`,
          entityType,
          entityId,
        };
      }
      currentCents = parseInt(String(raw), 10) || 0;
      if (currentCents <= 0) {
        return {
          ok: false,
          error: `${budgetLevel} daily_budget is zero or invalid`,
          entityType,
          entityId,
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        entityType,
        entityId,
      };
    }

    let newCents: number;
    if (actionType === "increase_budget") {
      newCents = Math.round(currentCents * (1 + pct / 100));
    } else {
      newCents = Math.round(currentCents * (1 - pct / 100));
    }
    newCents = Math.max(100, newCents); // Min $1

    if (dryRun) {
      return {
        ok: true,
        entityType,
        entityId,
        actionType,
        requestPayload: {
          daily_budget: newCents,
          budgetLevel,
          percentChange: actionType === "increase_budget" ? pct : -pct,
          previousCents: currentCents,
        },
        responseSummary: `[DRY RUN] Would set ${budgetLevel} daily_budget to $${(newCents / 100).toFixed(2)} (was ${(currentCents / 100).toFixed(2)}, ${actionType === "increase_budget" ? "+" : "-"}${pct}%)`,
        dryRun: true,
        simulated: true,
      };
    }

    try {
      await metaPost(entityId, { daily_budget: String(newCents) });
      return {
        ok: true,
        entityType,
        entityId,
        actionType,
        requestPayload: { daily_budget: newCents, budgetLevel },
        responseSummary: `Updated ${budgetLevel} daily_budget to $${(newCents / 100).toFixed(2)} (${actionType === "increase_budget" ? "+" : "-"}${pct}%)`,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        entityType,
        entityId,
      };
    }
  }

  return {
    ok: false,
    error: `Unsupported action: ${actionType}`,
    entityType,
    entityId,
  };
}
