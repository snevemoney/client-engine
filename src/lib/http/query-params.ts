/**
 * Phase 2.8.2: Shared URLSearchParams parsing utilities.
 * Null-safe, never throws. Invalid input returns defaults/fallbacks.
 */

export type StringParamOpts = {
  trim?: boolean;
  maxLength?: number;
  allowEmpty?: boolean;
};

export type IntParamOpts = {
  defaultValue?: number;
  min?: number;
  max?: number;
};

export type FloatParamOpts = {
  defaultValue?: number;
  min?: number;
  max?: number;
};

export type BoolParamOpts = {
  defaultValue?: boolean;
};

export type DateParamOpts = {
  defaultValue?: Date | null;
};

export type CsvParamOpts = {
  maxItems?: number;
  trim?: boolean;
};

const BOOL_TRUE = new Set(["1", "true", "yes", "on"]);
const BOOL_FALSE = new Set(["0", "false", "no", "off"]);

function getParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string
): string | null {
  const v = params.get(key);
  return v != null && v !== "" ? v : null;
}

/**
 * Parse string param. Trim by default. Optional max length. allowEmpty=false by default.
 */
export function parseStringParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: StringParamOpts
): string | null {
  const raw = getParam(params, key);
  if (raw == null) return null;
  let s = opts?.trim !== false ? raw.trim() : raw;
  if (!opts?.allowEmpty && s === "") return null;
  if (opts?.maxLength != null && s.length > opts.maxLength) {
    s = s.slice(0, opts.maxLength);
  }
  return s;
}

/**
 * Parse int param. Returns defaultValue or fallback on invalid input.
 */
export function parseIntParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: IntParamOpts
): number {
  const raw = getParam(params, key);
  if (raw == null) return opts?.defaultValue ?? 0;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || !Number.isFinite(n)) return opts?.defaultValue ?? 0;
  let v = n;
  if (opts?.min != null && v < opts.min) v = opts.min;
  if (opts?.max != null && v > opts.max) v = opts.max;
  return v;
}

/**
 * Parse float param. Returns defaultValue or fallback on invalid input.
 */
export function parseFloatParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: FloatParamOpts
): number {
  const raw = getParam(params, key);
  if (raw == null) return opts?.defaultValue ?? 0;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return opts?.defaultValue ?? 0;
  let v = n;
  if (opts?.min != null && v < opts.min) v = opts.min;
  if (opts?.max != null && v > opts.max) v = opts.max;
  return v;
}

/**
 * Parse bool param. Accepts: 1/0, true/false, yes/no, on/off.
 */
export function parseBoolParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: BoolParamOpts
): boolean {
  const raw = getParam(params, key);
  if (raw == null) return opts?.defaultValue ?? false;
  const lower = raw.toLowerCase().trim();
  if (BOOL_TRUE.has(lower)) return true;
  if (BOOL_FALSE.has(lower)) return false;
  return opts?.defaultValue ?? false;
}

/**
 * Parse enum param. Returns default if value not in allowed list.
 */
export function parseEnumParam<T extends string>(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const raw = getParam(params, key);
  if (raw == null) return defaultValue;
  const v = raw.trim();
  if (allowedValues.includes(v as T)) return v as T;
  return defaultValue;
}

/**
 * Parse date param. Returns Date or null. Safe invalid-date handling.
 */
export function parseDateParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: DateParamOpts
): Date | null {
  const raw = getParam(params, key);
  if (raw == null) return opts?.defaultValue ?? null;
  const d = new Date(raw);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return opts?.defaultValue ?? null;
  return d;
}

/**
 * Parse comma-separated strings. Trimming + dedupe + optional max items.
 */
export function parseCsvParam(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  opts?: CsvParamOpts
): string[] {
  const raw = getParam(params, key);
  if (raw == null) return [];
  const trim = opts?.trim !== false;
  const parts = raw.split(",").map((p) => (trim ? p.trim() : p)).filter(Boolean);
  const deduped = [...new Set(parts)];
  if (opts?.maxItems != null && deduped.length > opts.maxItems) {
    return deduped.slice(0, opts.maxItems);
  }
  return deduped;
}

/**
 * Parse sort param. Returns { key, dir } with dir in asc|desc.
 */
export function parseSortParam<K extends string>(
  params: URLSearchParams | { get: (k: string) => string | null },
  key: string,
  allowedKeys: readonly K[],
  defaultKey: K,
  defaultDir: "asc" | "desc" = "asc"
): { key: K; dir: "asc" | "desc" } {
  const raw = getParam(params, key);
  if (raw == null) return { key: defaultKey, dir: defaultDir };
  const parts = raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const sortKey = parts[0];
  const sortDir = parts[1] ?? defaultDir;
  const keyOk = sortKey && allowedKeys.includes(sortKey as K);
  const dirOk = sortDir === "asc" || sortDir === "desc";
  return {
    key: keyOk ? (sortKey as K) : defaultKey,
    dir: dirOk ? sortDir : defaultDir,
  };
}
