const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export function getBasePath(): string {
  return BASE_PATH;
}

/**
 * Prefix absolute paths for raw browser APIs (fetch, <a href>, window.location).
 * Do NOT use with next/navigation redirect(), Link, or router.push — Next.js
 * already applies basePath for those.
 */
export function appPath(pathname: string): string {
  if (!pathname.startsWith("/")) return pathname;
  if (!BASE_PATH || pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname;
  }
  return `${BASE_PATH}${pathname}`;
}

/** Strip the deployed base path so router.push/redirect receive app-relative paths. */
export function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }
  return pathname;
}

export const apiPath = appPath;
