/**
 * Seed integration_connections for all providers (mirrors providerRegistry).
 * Backfills mode/category/prodOnly/displayName/helpText for existing rows; creates missing providers.
 * Run: node prisma/seed-integrations.mjs
 */
import { PrismaClient } from "@prisma/client";

const PROVIDERS = [
  { key: "meta", name: "Meta Ads", category: "analytics", prodOnly: true, sortOrder: 10, defaultMode: "off", helpText: "LIVE runs only in production. Use MOCK or MANUAL in local." },
  { key: "upwork", name: "Upwork", category: "research", prodOnly: false, sortOrder: 20, defaultMode: "manual" },
  { key: "rss", name: "RSS / News", category: "research", prodOnly: false, sortOrder: 30, defaultMode: "mock", helpText: "Add feed URLs. Query params for filtering stored in config." },
  { key: "linkedin", name: "LinkedIn", category: "outreach", prodOnly: true, sortOrder: 40, defaultMode: "manual", helpText: "LIVE runs only in production. Use MOCK or MANUAL in local." },
  { key: "crm", name: "CRM (Internal / HubSpot / Pipedrive)", category: "delivery", prodOnly: false, sortOrder: 50, defaultMode: "manual" },
  { key: "hubspot", name: "HubSpot", category: "delivery", prodOnly: false, sortOrder: 52, defaultMode: "manual" },
  { key: "pipedrive", name: "Pipedrive", category: "delivery", prodOnly: false, sortOrder: 54, defaultMode: "manual" },
  { key: "calendly", name: "Calendly / Cal.com", category: "delivery", prodOnly: false, sortOrder: 60, defaultMode: "manual" },
  { key: "calcom", name: "Cal.com", category: "delivery", prodOnly: false, sortOrder: 62, defaultMode: "manual" },
  { key: "loom", name: "Loom", category: "content", prodOnly: false, sortOrder: 70, defaultMode: "manual" },
  { key: "ga4", name: "Google Analytics 4", category: "analytics", prodOnly: true, sortOrder: 80, defaultMode: "off", helpText: "LIVE runs only in production. Use MOCK or MANUAL in local." },
  { key: "search_console", name: "Google Search Console", category: "visibility", prodOnly: true, sortOrder: 90, defaultMode: "manual", helpText: "LIVE runs only in production." },
  { key: "instagram", name: "Instagram", category: "visibility", prodOnly: false, sortOrder: 100, defaultMode: "manual" },
  { key: "x", name: "X (Twitter)", category: "visibility", prodOnly: false, sortOrder: 110, defaultMode: "manual" },
  { key: "google_business_profile", name: "Google Business Profile", category: "visibility", prodOnly: true, sortOrder: 120, defaultMode: "manual", helpText: "LIVE runs only in production." },
  { key: "youtube", name: "YouTube", category: "content", prodOnly: false, sortOrder: 130, defaultMode: "off" },
  { key: "stripe", name: "Stripe", category: "delivery", prodOnly: false, sortOrder: 140, defaultMode: "off" },
  { key: "google-ads", name: "Google Ads", category: "analytics", prodOnly: true, sortOrder: 150, defaultMode: "off", helpText: "LIVE runs only in production." },
  { key: "github", name: "GitHub", category: "ops", prodOnly: false, sortOrder: 160, defaultMode: "manual" },
];

const db = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const p of PROVIDERS) {
    const existing = await db.integrationConnection.findUnique({ where: { provider: p.key } });
    if (existing) {
      const mode =
        existing.status === "connected" ? "live" : existing.status === "disabled" ? "off" : "manual";
      await db.integrationConnection.update({
        where: { provider: p.key },
        data: {
          mode,
          category: p.category,
          prodOnly: p.prodOnly,
          providerLabel: p.name,
          displayName: p.name,
          helpText: p.helpText ?? undefined,
          sortOrder: p.sortOrder,
        },
      });
      updated++;
    } else {
      await db.integrationConnection.create({
        data: {
          provider: p.key,
          status: "not_connected",
          mode: p.defaultMode ?? "off",
          category: p.category,
          prodOnly: p.prodOnly,
          providerLabel: p.name,
          displayName: p.name,
          helpText: p.helpText ?? undefined,
          sortOrder: p.sortOrder,
        },
      });
      created++;
    }
  }

  console.log(`Integrations: ${created} created, ${updated} updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
