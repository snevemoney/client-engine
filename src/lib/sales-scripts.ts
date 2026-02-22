/**
 * Default sales scripts (PBD-style). Use placeholders: {name}, {company}, {event}, {detail}, {month}, {result}.
 * No auto-send; human copies and sends.
 */

export const SALES_SCRIPTS = [
  {
    id: "networking_followup",
    name: "Networking follow-up",
    content:
      "Good meeting you at {event}. I liked your point about {topic}. I help {type} reduce {pain}. If useful, we can do a quick 15-minute call this week.",
  },
  {
    id: "linkedin_first",
    name: "LinkedIn first contact",
    content:
      "Hi {name}, I came across your post on {topic} and thought of a way we might help with {pain}. Would you be open to a short call?",
  },
  {
    id: "email_first",
    name: "Email first contact",
    content:
      "Hi {name}, I work with teams like {company} on {topic}. I noticed {detail}. Would a 15-min call this week make sense to explore if there’s a fit?",
  },
  {
    id: "not_now_callback",
    name: '"Not now" callback',
    content: "Totally fair. Would it be okay if I check back in around {month}? I’ll make a note.",
  },
  {
    id: "detail_followup",
    name: "Detail-based follow-up",
    content:
      "You mentioned {detail} and that timing was tight until {date}. Just checking if this is a better window.",
  },
  {
    id: "referral_primer",
    name: "Referral primer",
    content:
      "Most of my work comes from referrals. If I deliver what we discussed and you’re happy, I may ask if anyone in your network is dealing with something similar.",
  },
  {
    id: "referral_ask",
    name: "Referral ask",
    content:
      "You said the result on {project} helped. Who’s one person you know that might benefit from a similar fix?",
  },
  {
    id: "relationship_checkin",
    name: "Relationship check-in",
    content: "Quick check-in — how is the workflow/app holding up? Anything you want improved?",
  },
  {
    id: "result_followup_testimonial",
    name: "Result follow-up (testimonial)",
    content:
      "Glad this helped. Would you be okay if I shared a short case study about the outcome we got (without sensitive details)? It helps me show proof to future clients.",
  },
] as const;

export type SalesScriptId = (typeof SALES_SCRIPTS)[number]["id"];
