/**
 * Unified ServiceResult type for typed service return values.
 * Eliminates throw-everywhere error handling in service/route boundaries.
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

export function err(error: string, status = 500): ServiceResult<never> {
  return { ok: false, error, status }
}
