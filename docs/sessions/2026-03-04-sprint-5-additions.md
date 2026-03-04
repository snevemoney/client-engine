# Session: Sprint 5 Additions — 2026-03-04

## Goal

Implement the Sprint 5 Additions plan: auto payment follow-up on deploy, A/R panel on Command Center, and acceptance tests.

## Decisions Made

- **Deploy notification**: Use `notifyDeployComplete()` in notify.ts; call from both sync deploy route and builder-deploy worker. Link to `/dashboard/delivery/[id]`.
- **A/R data source**: Use `Project` model (Deploys page) for payment tracking; `DeliveryProject` remains for builder deploy flow.
- **AR summary**: `getARSummary()` returns `{ unpaidCount, invoicedCount, unpaidTotal }`; unpaid = status "unpaid" or null; invoiced = "invoiced" or "partial".
- **Deploys filter**: URL param `?filter=unpaid|invoiced|paid`; filter tabs as Link components.

## What Was Built

- **prisma/schema.prisma**: Added `paymentStatus`, `paymentAmount`, `invoicedAt`, `paidAt` to Project model.
- **src/lib/notify.ts**: `notifyDeployComplete(deliveryProjectId, projectTitle, liveUrl)`.
- **src/app/api/delivery-projects/[id]/builder/deploy/route.ts**: Call `notifyDeployComplete` after sync deploy success.
- **src/workers/index.ts**: Load project title, call `notifyDeployComplete` after builder deploy job success.
- **src/lib/ops/arSummary.ts**: `getARSummary()` with cached version in cached.ts.
- **src/components/dashboard/command/ARPanelCard.tsx**: Displays unpaid/invoiced counts, link to deploys.
- **src/app/dashboard/command/CommandSection2.tsx**: Added ARPanelCard and getCachedARSummary to Promise.all.
- **src/app/dashboard/deploys/page.tsx**: Filter support via searchParams; buildWhere for paymentStatus.
- **src/app/dashboard/deploys/deploys-table.tsx**: Filter tabs (All/Unpaid/Invoiced/Paid), Payment column with PaymentBadge (select to update status).
- **src/app/api/projects/[id]/route.ts**: PATCH accepts paymentStatus, paymentAmount, invoicedAt, paidAt.
- **tests/e2e/deploy-flow.spec.ts**: 401 without auth, 404 invalid project, 400 project without builderSiteId.
- **tests/e2e/ar-panel.spec.ts**: Command Center A/R Panel visibility; Deploys filter tabs and payment column.

## Key Insights

- Project vs DeliveryProject: Deploys page uses Project (lead builds); builder deploy uses DeliveryProject. A/R panel tracks Project.
- Prisma Decimal serializes; convert with `Number()` when passing to client components.

## Trade-offs Accepted

- Deploy-flow happy path (200/202 with liveUrl) not tested — would require mocking builder API or real builder.
- AR panel test uses 30s timeout for CommandSection2 streaming.

## Next Steps

- Run E2E tests against local server to verify ar-panel and deploy-flow specs pass.
- Consider adding paymentAmount inline edit on Deploys table if needed.
