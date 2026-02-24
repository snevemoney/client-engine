/**
 * Config JSON validators for integration connections.
 */

/** Validate additionalQueryParams: flat string:string only. Reject nested/arrays/non-string. */
export function validateAdditionalQueryParams(
  value: unknown
): { ok: true; params: Record<string, string> } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, params: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "additionalQueryParams must be an object" };
  }
  const obj = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k !== "string") return { ok: false, error: "Keys must be strings" };
    if (typeof v !== "string") return { ok: false, error: `Value for "${k}" must be a string (no nested objects/arrays)` };
    result[k] = v;
  }
  return { ok: true, params: result };
}

/**
 * Merge validated additionalQueryParams into configJson.
 * Preserves other keys. Replaces only additionalQueryParams.
 */
export function mergeConfigWithQueryParams(
  config: Record<string, unknown>,
  additionalQueryParams: Record<string, string> | null
): Record<string, unknown> {
  const out = { ...config };
  if (additionalQueryParams !== null) {
    out.additionalQueryParams = additionalQueryParams;
  } else if ("additionalQueryParams" in out) {
    delete out.additionalQueryParams;
  }
  return out;
}
