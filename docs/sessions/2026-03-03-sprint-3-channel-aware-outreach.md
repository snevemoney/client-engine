# Session: Sprint 3 Channel-Aware Outreach — 2026-03-03

## Goal
Implement channel-aware outreach for proposals: Upwork, email, prospect, and default channels get appropriate snippet format, label, and char limit in the proposal prompt and console.

## Decisions Made
- **Outreach module:** New `src/lib/proposals/outreach.ts` with getOutreachChannel, getOutreachHeader, getOutreachLabel, getOutreachCharLimit, getOutreachSectionPrompt. Single source of truth for channel logic.
- **Sections parsing:** Extended to support multiple outreach headers (Upwork Snippet, Email Intro, Outreach Message, Pitch). First match wins. Questions section ends at first outreach header.
- **Build/save:** buildProposalContentFromSections accepts optional leadSource; uses channel-appropriate header when saving. Artifact API PATCH uses getOutreachCharLimit for validation.
- **ProposalConsoleEditor:** Optional leadSource prop; dynamic label, char limit, placeholder. "Sent" label already present (Sprint 1).

## What Was Built
- `src/lib/proposals/outreach.ts` — channel helpers
- `src/lib/pipeline/prompts/buildProposalPrompt.ts` — source in LeadForProposal, getOutreachSectionPrompt, getOutreachHeader
- `src/lib/pipeline/propose.ts` — pass lead.source to buildProposalPrompt
- `src/lib/proposals/sections.ts` — OUTREACH_HEADERS, extractOutreachSnippet, extractQuestionsSection, buildProposalContentFromSections(leadSource)
- `src/app/api/artifacts/[id]/route.ts` — lead.source in select, getOutreachCharLimit for validation, buildProposalContentFromSections(leadSource)
- `src/components/proposals/ProposalConsoleEditor.tsx` — leadSource prop, dynamic outreachLabel/outreachCharLimit
- `src/app/dashboard/proposals/[id]/page.tsx` — pass leadSource to ProposalConsoleEditor

## Key Insights
- Backward compatible: existing proposals with "## Upwork Snippet" still parse. New proposals use channel-appropriate header.
- Channels: upwork (600), email/prospect (800), default (600).
- Prospect conversion: ensure source: "prospect" is set when converting; outreach module maps research/rss to prospect.

## Trade-offs Accepted
- proposal-console/parse.ts has duplicate parseProposalSections (different type with `full`); unused, left as-is.
- PATCH artifact validation uses lead source for char limit; if lead not loaded, defaults to 600.

## Next Steps
- [ ] Verify prospect → lead conversion sets source: "prospect" (files not in this working copy)
- [ ] Run npm run docs:generate
