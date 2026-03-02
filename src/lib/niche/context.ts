/**
 * Niche positioning context — injected into agent prompts and Brain system prompt.
 * Target: high-ticket local service businesses with follow-up leakage.
 */

export const NICHE_CONTEXT = {
  targetAudience: "high-ticket local service businesses",
  painPoint: "follow-up leakage",
  specificNiches: [
    "med spas and aesthetic clinics",
    "dental practices",
    "home renovation contractors",
    "legal firms (personal injury, family law)",
    "real estate teams",
    "coaching and consulting practices",
  ],
  avgDealSize: "$3,000–$15,000",
  keyProblems: [
    "leads come in but nobody follows up within 24h",
    "proposals sent but never tracked or followed up",
    "no system to capture proof from delivered work",
    "referrals never asked for systematically",
  ],
  positioning:
    "We build websites that close the follow-up gap for local service businesses.",
} as const;

export const NICHE_PROMPT_BLOCK = `
## Niche Context
Target: **high-ticket local service businesses** (med spas, dental, contractors, legal, real estate, coaching) with **follow-up leakage**.

Typical client:
- Charges $500–$5k per service
- Gets 20–100 leads/month from Google, referrals, and social
- Loses 30–60% of leads to slow or missing follow-up
- Has no system to track proposals, capture proof, or ask for referrals

Average deal value: $3k–$15k for a website + follow-up system.

Positioning: "We build websites that close the follow-up gap for local service businesses."

Every piece of outreach, proof, and content should reinforce this positioning. Frame problems in terms of **leaked revenue from missed follow-ups**, not generic "you need a better website."
`;
