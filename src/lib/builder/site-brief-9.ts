/**
 * Full 9-prompts site brief — Architecture, Design System, Content, Component Logic,
 * Figma Make, Animation, Responsive, Data Integration, QA.
 * Single LLM call produces complete spec for builder.
 */

import type { SiteBriefContext } from "./site-brief-prompt";

export type SiteBrief9 = {
  scope: string[];
  siteMap?: string;
  userFlows?: string;
  brandColors?: string[];
  designSystem?: {
    typographyScale?: string;
    spacingSystem?: string;
    layoutPatterns?: string;
    animationGuidelines?: string;
    wcagNotes?: string;
  };
  contentHints?: string;
  clientInfo: {
    heroHeadline?: string;
    heroSubhead?: string;
    ctaPrimary?: string;
    features?: { title: string; body: string }[];
    testimonials?: { quote: string; author: string; role: string }[];
    faq?: { q: string; a: string }[];
    footerTagline?: string;
    tone?: string;
  };
  componentLogic?: string;
  figmaMakePrompts?: string[];
  animationSpecs?: string;
  responsiveSpecs?: string;
  dataIntegration?: string;
  qaChecklist?: string;
};

const SYSTEM = `You are Principal Architect (Vercel) + Apple Design Director + Ogilvy Copywriter + Frontend Architect + Figma Make Engineer + Motion Designer + Responsive Specialist + Full-Stack Architect + QA Engineer. Produce ONE complete site spec as valid JSON. No markdown.

CRITICAL — Hero must be client-facing, not proposal/scope text:
- heroHeadline: 6 words. Use description, felt problem, or reframed offer. Benefit-focused (e.g. "Refresh Your Squarespace Site Without Starting Over"). Do NOT use proposal scope (e.g. "Your Site Lacks X — And It's Affecting Y").
- heroSubhead: 15 words. Use their language from description/reframed offer. Client-facing value prop. Do NOT use proposal scope or internal analysis.
- FORBIDDEN in hero: "Your X lacks", "And It's Affecting", "enhancing your online presence", "attract more clients", "seamless", "transform your life", "science-backed", "holistic", "streamlined".

Output this JSON. Populate ALL fields — scope, siteMap, userFlows, brandColors, designSystem (all 5 keys), clientInfo (all keys), componentLogic, figmaMakePrompts (5), animationSpecs, responsiveSpecs, dataIntegration, qaChecklist:
{
  "scope": ["homepage","about","services","testimonials","booking","contact","footer"],
  "siteMap": "Page hierarchy: Home > About, Services, Contact...",
  "userFlows": "3 journeys: 1) Book call 2) Learn services 3) Contact",
  "brandColors": ["#hex1","#hex2","#hex3","#hex4"],
  "designSystem": {
    "typographyScale": "H1:48px H2:36px body:16px...",
    "spacingSystem": "8px grid, section:64px",
    "layoutPatterns": "Breakpoints 375/768/1440",
    "animationGuidelines": "Fade-up 0.6s, stagger 0.1s",
    "wcagNotes": "Contrast 4.5:1 min"
  },
  "contentHints": "Prose for builder",
  "clientInfo": {
    "heroHeadline": "6 words — benefit-focused, from description/reframed offer. NOT proposal scope.",
    "heroSubhead": "15 words — client-facing value prop from description/reframed offer. NOT proposal scope.",
    "ctaPrimary": "CTA text",
    "features": [{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],
    "testimonials": [{"quote":"","author":"","role":""}],
    "faq": [{"q":"","a":""}],
    "footerTagline": "",
    "tone": ""
  },
  "componentLogic": "Booking: multi-step. Contact: name/email/message.",
  "figmaMakePrompts": ["Build a TYPE site with MOOD. Use COLOR. Hero, features, CTA. Responsive.", "...x5"],
  "animationSpecs": "Page load: hero fade-up 0.6s. Scroll: navbar shrink.",
  "responsiveSpecs": "375: stack. 768: 2-col. 1440: full.",
  "dataIntegration": "Contact form→email. Booking→calendar.",
  "qaChecklist": "Core Web Vitals. WCAG AA. SEO meta."
}

Use client's exact words from proposal, feltProblem, reframedOffer, enrichment. No generic phrases.

brandColors: Infer 4 hex colors from client description, industry, and positioning. Order: [primary for CTA/buttons, hero gradient start, hero gradient end, accent for borders/links]. Each client gets a distinct palette.
FORBIDDEN for health/fitness/coaching: green (#22c55e, #10b981, #059669, #047857). Use teal, coral, indigo, amber, or slate instead. Vary hue by client name — mentally hash the name and pick from a 12-hue wheel so no two clients look identical.`;

/** Phrases that make hero subhead sound generic. Used for validation + retry. */
export const HERO_SUBHEAD_FORBIDDEN = [
  "enhancing your online presence",
  "attract more clients",
  "seamless",
  "seamlessly",
  "supportive",
  "transition feels",
  "busy professionals",
  "amateur athletes",
  "flexible solutions",
  "convenient",
  "personalized support",
  "transform your life",
  "science-backed",
  "holistic",
  "streamlined",
  "fits seamlessly",
  "demanding schedule",
  "online presence",
  "seamless and supportive",
];

export function isHeroSubheadGeneric(subhead: string | undefined): boolean {
  if (!subhead?.trim()) return false;
  const lower = subhead.toLowerCase();
  return HERO_SUBHEAD_FORBIDDEN.some((p) => lower.includes(p.toLowerCase()));
}

export function buildSiteBrief9Prompt(ctx: SiteBriefContext): { system: string; user: string } {
  const langMap = ctx.languageMap as Record<string, unknown> | undefined;
  const useWords = Array.isArray(langMap?.use) ? (langMap.use as string[]).join(", ") : "";
  const avoidWords = Array.isArray(langMap?.avoid) ? (langMap.avoid as string[]).join(", ") : "";

  const user = `Full 9-prompts spec for:

Client: ${ctx.clientName}
Title: ${ctx.title}
Industry: ${ctx.industry}
${ctx.description ? `Description: ${ctx.description.slice(0, 600)}` : ""}

${ctx.proposalContent ? `Proposal/scope (for context only — do NOT use verbatim for hero; use description, felt problem, reframed offer for hero):
---
${ctx.proposalContent.slice(0, 1200)}
---
` : ""}

Positioning:
${ctx.feltProblem ? `Felt problem: ${ctx.feltProblem}` : ""}
${ctx.reframedOffer ? `Reframed offer: ${ctx.reframedOffer}` : ""}
${ctx.blueOceanAngle ? `Blue ocean: ${ctx.blueOceanAngle}` : ""}
${useWords ? `Use: ${useWords}` : ""}
${avoidWords ? `Avoid: ${avoidWords}` : ""}
${ctx.packaging?.hookOneLiner ? `Hook: ${ctx.packaging.hookOneLiner}` : ""}

${ctx.enrichmentSummary ? `Enrichment: ${ctx.enrichmentSummary.slice(0, 400)}` : ""}
${ctx.scoreVerdict ? `Score: ${ctx.scoreVerdict}` : ""}
${ctx.scoreReason ? `Reason: ${ctx.scoreReason}` : ""}

MANDATORY — Produce ALL 9 phases. Every field below MUST be populated (no empty strings, no omissions):
1. Architecture: scope, siteMap, userFlows
2. Design System: brandColors, designSystem (typographyScale, spacingSystem, layoutPatterns, animationGuidelines, wcagNotes)
3. Content: clientInfo (heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, tone)
4. Component Logic: componentLogic
5. Figma Make: figmaMakePrompts (5 strings)
6. Animation: animationSpecs
7. Responsive: responsiveSpecs
8. Data Integration: dataIntegration
9. QA: qaChecklist

Output valid JSON only. figmaMakePrompts: 5 strings. faq: up to 8. testimonials: 2-4.`;

  return { system: SYSTEM, user };
}
