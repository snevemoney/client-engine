/**
 * Leftover /pro twins are not a second public site.
 * When NEXT_PUBLIC_BASE_PATH=/pro, 308 those URLs to origin (basePath: false).
 * Do not redirect /pro/login, /pro/dashboard, or /pro/api.
 */
const PUBLIC_SITE_ROOTS = [
  "/work",
  "/services",
  "/contact",
  "/campaigns",
  "/proof",
  "/demos",
  "/privacy",
  "/terms",
  "/data-deletion",
];

function rule(source, destination) {
  return {
    source,
    destination,
    permanent: true,
    basePath: false,
  };
}

function catalogAliasRedirects(basePath) {
  const prefix = String(basePath || "").replace(/\/$/, "");
  if (!prefix) return [];

  const rules = [rule(prefix, "/"), rule(`${prefix}/`, "/")];

  for (const root of PUBLIC_SITE_ROOTS) {
    rules.push(
      rule(`${prefix}${root}`, root),
      rule(`${prefix}${root}/`, root),
      rule(`${prefix}${root}/:path*`, `${root}/:path*`)
    );
  }

  return rules;
}

module.exports = { catalogAliasRedirects, PUBLIC_SITE_ROOTS };
