#!/usr/bin/env node
/**
 * Smoke health check: GET /api/health, assert ok === true.
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke-health.mjs
 * Exit 0 = PASS, non-zero = FAIL.
 */
const base = process.env.BASE_URL || "http://localhost:3000";
const url = `${base.replace(/\/$/, "")}/api/health`;

async function main() {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("FAIL: Could not reach", url, err?.message || err);
    process.exit(1);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    console.error("FAIL: /api/health returned", res.status, body);
    process.exit(1);
  }
  if (body.ok !== true) {
    console.error("FAIL: /api/health ok !== true", JSON.stringify(body));
    process.exit(1);
  }
  console.log("PASS: /api/health ok=true", JSON.stringify(body.checks));
  process.exit(0);
}
main();
