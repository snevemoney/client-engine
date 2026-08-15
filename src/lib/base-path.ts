import { PUBLIC_SITE_ROOTS } from "./catalog-alias-redirects.js";

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

export function shouldPrefixClientPath(url: string): boolean {
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  return url.startsWith("/api/") || url.startsWith("/healthz");
}

const CATALOG_ALIAS = "/pro";

export { PUBLIC_SITE_ROOTS };

/** Public catalog lives at origin /work — never under /pro. */
export function isPublicCatalogPath(pathname: string): boolean {
  return pathname === "/work" || pathname.startsWith("/work/");
}

export function isPublicSitePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return PUBLIC_SITE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}

/** Leftover /pro twins and public roots → origin path. Operator paths stay null. */
export function originPublicHref(pathname: string): string | null {
  if (pathname === CATALOG_ALIAS || pathname === `${CATALOG_ALIAS}/`) return "/";
  if (pathname.startsWith(`${CATALOG_ALIAS}/`)) {
    const rest = pathname.slice(CATALOG_ALIAS.length);
    if (isPublicSitePath(rest)) return rest;
    return null;
  }
  if (isPublicSitePath(pathname)) return pathname;
  return null;
}

/** /pro/work is a 308 alias of /work. Emit the origin catalog path or null. */
export function originCatalogHref(pathname: string): string | null {
  const origin = originPublicHref(pathname);
  if (origin && isPublicCatalogPath(origin)) return origin;
  return null;
}

/**
 * Marketing <a href>. Public roots never get a /pro prefix.
 * Leftover /pro and /pro/work rewrite to origin. Operator paths still prefix.
 */
export function resolveSiteHref(href: string, basePath: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const hashIdx = href.indexOf("#");
  const path = hashIdx === -1 ? href : href.slice(0, hashIdx) || "/";
  const hash = hashIdx === -1 ? "" : href.slice(hashIdx);
  const origin = originPublicHref(path);
  if (origin !== null) return `${origin}${hash}`;
  const prefix = (basePath || "").replace(/\/$/, "");
  if (!prefix || path === prefix || path.startsWith(`${prefix}/`)) {
    return `${path}${hash}`;
  }
  return `${prefix}${path}${hash}`;
}

export function siteHref(href: string): string {
  return resolveSiteHref(href, BASE_PATH);
}

/**
 * Screenshots live at origin /screenshots (the /work catalog).
 * Do not send them through /pro/_next/image — that 400s.
 */
export function rootPublicSrc(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  if (path.startsWith("/pro/screenshots/")) return path.slice(4);
  return path;
}
