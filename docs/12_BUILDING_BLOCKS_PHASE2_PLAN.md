# 12 Building Blocks — Phase 2 Plan

**Goal:** Dedicated `/dashboard/business-plan` page with 6 paired sections (logic + emotion) for executable, motivating strategy.

**Status:** Plan only — do not build yet.

---

## Page Structure

Route: `/dashboard/business-plan`

Layout: 6 sections, each with Logic column + Emotion column (PBD-style pairs).

---

## 1) Skill / Will

| Aspect | Details |
|--------|---------|
| **Logic — Skill** | Capabilities, training gaps, leverage points |
| **Emotion — Will** | Motivation, commitment level, energy drivers |
| **Fields** | `skillGaps` (string[]), `skillPriorities` (string), `willDrivers` (string), `willBlockers` (string), `commitmentLevel` (1–10) |
| **Data model** | Extend `StrategyWeek` or add `BusinessPlanBlock` with `blockType: "skill_will"`, `logicJson`, `emotionJson` |
| **Weekly review linkage** | Review asks: "Did I close a skill gap? Did will hold?" |
| **Scoreboard metrics** | Skill gaps closed this week, commitment score trend |

---

## 2) Plan / Mission

| Aspect | Details |
|--------|---------|
| **Logic — Plan** | Tactical plan, milestones, timelines |
| **Emotion — Mission** | Why we exist, north star, purpose |
| **Fields** | `planMilestones` (string[]), `planTimeline` (string), `missionStatement` (reuse from Phase 1), `missionNorthStar` (string) |
| **Data model** | Reuse `StrategyWeek.missionStatement`; add `planMilestones` (Json array), `planTimeline`, `missionNorthStar` |
| **Weekly review linkage** | "Did I hit milestones? Is mission still aligned?" |
| **Scoreboard metrics** | Milestones hit, plan vs actual |

---

## 3) Systems / Dream

| Aspect | Details |
|--------|---------|
| **Logic — Systems** | Processes, automation, infrastructure |
| **Emotion — Dream** | Big-picture outcome, 3–5 year vision |
| **Fields** | `systemImprovements` (string[]), `automationBacklog` (string), `dreamStatement` (reuse from Phase 1), `dreamHorizon` (string) |
| **Data model** | Reuse `StrategyWeek.dreamStatement`; add `systemImprovements`, `automationBacklog`, `dreamHorizon` |
| **Weekly review linkage** | Review `systemImproved` checkbox; `nextAutomation` from review |
| **Scoreboard metrics** | Systems improved count, automation queue size |

---

## 4) Capital / Vision

| Aspect | Details |
|--------|---------|
| **Logic — Capital** | Cash, runway, revenue targets, investment |
| **Emotion — Vision** | What we see when we get there |
| **Fields** | `capitalTarget` (string), `runwayMonths` (number), `revenueTarget` (string), `visionStatement` (string), `visionHorizon` (string) |
| **Data model** | Add `BusinessPlanCapital` or extend StrategyWeek with `capitalTarget`, `runwayMonths`, `revenueTarget`, `visionStatement`, `visionHorizon` |
| **Weekly review linkage** | Weekly revenue / pipeline vs target |
| **Scoreboard metrics** | Revenue vs target, runway status |

---

## 5) Competition / Fuel

| Aspect | Details |
|--------|---------|
| **Logic — Competition** | Competitors, differentiators, market position |
| **Emotion — Fuel** | Enemy/problem to beat, motivation (reuse `fuelStatement`) |
| **Fields** | `competitors` (string[]), `differentiators` (string), `marketPosition` (string), `fuelStatement` (reuse) |
| **Data model** | Reuse `StrategyWeek.fuelStatement`; add `competitors`, `differentiators`, `marketPosition` |
| **Weekly review linkage** | "Did we hold position? Fuel still relevant?" |
| **Scoreboard metrics** | Competitive win/loss, positioning clarity |

---

## 6) Supporting Cast / Culture

| Aspect | Details |
|--------|---------|
| **Logic — Supporting Cast** | Team, partners, advisors, key relationships |
| **Emotion — Culture** | Values, how we work, team identity |
| **Fields** | `teamMembers` (string[]), `keyPartners` (string), `cultureValues` (string[]), `cultureIdentity` (string) |
| **Data model** | Link to `StrategyWeekRecruitingTarget`; add `cultureValues` (Json), `cultureIdentity` |
| **Weekly review linkage** | Recruiting targets, relationship health |
| **Scoreboard metrics** | Recruiting progress, culture alignment check |

---

## Data Model Options

### Option A: Extend StrategyWeek
- Add all Phase 2 fields to `StrategyWeek` (many nullable columns)
- Pros: Single table, simple
- Cons: StrategyWeek bloats; some blocks are longer-term (not just weekly)

### Option B: BusinessPlanBlock table
```prisma
model BusinessPlanBlock {
  id           String   @id @default(cuid())
  blockType    String   // skill_will | plan_mission | systems_dream | capital_vision | competition_fuel | supporting_cast_culture
  strategyWeekId String?
  strategyWeek  StrategyWeek? @relation(...)
  logicJson     Json     @default("{}")
  emotionJson   Json     @default("{}")
  updatedAt    DateTime @updatedAt
}
```
- One row per block type, optionally linked to current week
- Pros: Flexible, extensible
- Cons: More joins, JSON querying

### Option C: Hybrid
- Keep Phase 1 fields on StrategyWeek
- Add `BusinessPlanBlock` for Phase 2 blocks that are more "evergreen" (mission, dream, vision) vs weekly (plan milestones, fuel)
- Weekly blocks stay on StrategyWeek; evergreen blocks in BusinessPlanBlock with `strategyWeekId = null` for "current" version

---

## Weekly Review Linkage (Summary)

| Block | Review Question | Review Field |
|-------|-----------------|--------------|
| Skill/Will | Skill gap closed? Will held? | Custom checkbox or notes |
| Plan/Mission | Milestones hit? | Targets, review score |
| Systems/Dream | System improved? | `systemImproved`, `nextAutomation` |
| Capital/Vision | Revenue on track? | Targets status |
| Competition/Fuel | Position held? | Notes |
| Supporting Cast/Culture | Recruiting progress? | `StrategyWeekRecruitingTarget` |

---

## Scoreboard Metrics (Summary)

| Block | Metric |
|-------|--------|
| Skill/Will | Commitment score, skill gaps closed |
| Plan/Mission | Milestones hit, plan adherence |
| Systems/Dream | Systems improved count, automation queue |
| Capital/Vision | Revenue vs target, runway |
| Competition/Fuel | Competitive wins, positioning |
| Supporting Cast/Culture | Recruiting pipeline, culture check |

---

## Implementation Order (when building Phase 2)

1. Create `BusinessPlanBlock` model (or extend StrategyWeek)
2. API: GET/POST `/api/ops/business-plan` (load/save blocks)
3. Page: `/dashboard/business-plan` with 6 section components
4. Wire weekly review to relevant blocks
5. Add scoreboard metrics for each block
