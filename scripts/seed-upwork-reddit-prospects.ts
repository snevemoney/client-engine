/**
 * Seed Upwork + Reddit coach prospects into pipeline leads.
 * Run: npx tsx scripts/seed-upwork-reddit-prospects.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";

const prospects = [
  // Upwork — Active Job Posts
  {
    title: "Klaude Furlong — AI-Powered Personal Transformation Coach",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Canada. Full Wix website redesign — 11 pages: course sales, Calendly booking, blog, podcast, lead magnet. Sells courses on Circle ($397–$997/yr), books on Amazon, group coaching. Needs conversion-focused design + SEO + copywriting. Premium project, <5 proposals. Search: Wix Website Redesign Premium Personal Transformation Brand.",
    budget: "Open to proposals",
    tags: ["coach", "upwork", "wix", "course", "booking", "premium"],
  },
  {
    title: "Executive Coaching Personal Brand Site",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Northern Virginia, USA. WordPress + Elementor Pro for licensed counselor and executive coach. Personal brand site for boutique executive coaching. 3-4 weeks. 50+ proposals.",
    timeline: "3-4 weeks",
    tags: ["coach", "upwork", "wordpress", "executive-coach"],
  },
  {
    title: "Expert UI Designer — 1-Page Life Coach Landing Page",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Pakistan. High-converting 1-page landing for personal brand in life coaching. $100 fixed, Figma design, mobile-responsive. Payment verified, 5.0 rating. 15-20 proposals.",
    budget: "$100",
    tags: ["coach", "upwork", "landing-page", "figma"],
  },
  {
    title: "Coaching Business Website Creation",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Website: welcome, services, about, mission, contact. ~$200. Squarespace. 20-50 proposals. Simple coaching site.",
    budget: "~$200",
    tags: ["coach", "upwork", "squarespace", "website"],
  },
  {
    title: "Mental Health Professionals for Lifestyle Coaching App",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Lifestyle coaching app — content, design, functionality for mental wellness. $30-50/hr, 1-3 months, 30+ hrs/week. $10K+ spent on Upwork. Needs mental health expertise.",
    budget: "$30-50/hr",
    timeline: "1-3 months",
    tags: ["coach", "upwork", "app", "wellness", "premium"],
  },
  {
    title: "Online Fitness Coaching Website & Lead Gen Funnel",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Landing page and lead gen funnel — transitioning to online fitness coaching. $200 fixed, bold flashy design, lead capture forms. 10-15 proposals.",
    budget: "$200",
    tags: ["coach", "upwork", "fitness", "landing-page", "funnel"],
  },
  {
    title: "Website for Online Health Coaching Business",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Professional website: service listings, testimonials, blog, SEO. $200 fixed, WordPress. Brand-reflective design. New client.",
    budget: "$200",
    tags: ["coach", "upwork", "wordpress", "health-coach", "seo"],
  },
  {
    title: "Leadership Coaching Business Website",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Professional site: services, philosophies, testimonials, easy nav. $20-40/hr, WordPress. Design + content + lead gen.",
    budget: "$20-40/hr",
    tags: ["coach", "upwork", "wordpress", "leadership"],
  },
  {
    title: "Squarespace Designer & SEO for Website Refresh",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Coaching/wellness site refresh on Squarespace. Improved continuity + SEO. $45-85/hr, 1-3 months.",
    budget: "$45-85/hr",
    timeline: "1-3 months",
    tags: ["coach", "upwork", "squarespace", "seo", "wellness"],
  },
  {
    title: "Journey to The End Counseling — Therapy Practice Website",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Professional site: services, therapist bio, contact form. $150 fixed, WordPress. User-friendly, mobile responsive. 10-15 proposals.",
    budget: "$150",
    tags: ["coach", "upwork", "wordpress", "therapy"],
  },
  {
    title: "Digital Twin / AI Coaching Platform for Executive Practice",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Full web-based AI coaching app: React, OpenAI/Claude, auth, session history, client portal, Stripe. Executive coaching for CEOs. Premium $20K+ spent. Prompt eng, RAG, vector DB. Phase 2: voice. 20-50 proposals.",
    budget: "Premium",
    tags: ["coach", "upwork", "ai", "webapp", "client-portal", "premium"],
  },
  {
    title: "Scalable Fitness Training Platform",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Italy. Subscription platform: video library, training plans, live sessions, admin dashboard, Stripe, user accounts. Hourly, expert, 3-6 months, 30+ hrs/week. GDPR, onboarding quiz, CMS. 50+ proposals.",
    budget: "Hourly, expert",
    timeline: "3-6 months",
    tags: ["coach", "upwork", "fitness", "platform", "subscription"],
  },
  {
    title: "Emmanuelle Vandepitterie — BACKSTAGE & BANKABLE",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA-based, French-speaking. Business coach, 22K LinkedIn followers. Needs community management + content. Likely needs web platform. Hourly, intermediate, 6+ months. Founder of coaching agency.",
    tags: ["coach", "upwork", "business-coach", "community"],
  },
  {
    title: "GHL Funnel Builder for Coaching Lead Capture",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "3-4 step funnel on GoHighLevel: landing, testimonial page, intake form for strategy calls. $300 fixed. From templates, needs customization. 5-10 proposals.",
    budget: "$300",
    tags: ["coach", "upwork", "funnel", "gohighlevel"],
  },
  {
    title: "Wellness Tea Club Landing Page Redesign",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "USA. Conversion-focused landing redesign for wellness subscription. $15-30/hr, GoDaddy. CRO specialist for structure, clarity, conversions.",
    budget: "$15-30/hr",
    tags: ["coach", "upwork", "wellness", "landing-page", "cro"],
  },
  {
    title: "Men's Leadership Brand — Automated Revenue System",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "Author/Coach. Full automated funnel: email capture, book sales, paid membership on Thinkific. $3K fixed, 4 days (urgent — Tamron Hall Show March 3, 2026). 10-15 proposals.",
    budget: "$3,000",
    timeline: "4 days",
    tags: ["coach", "upwork", "funnel", "thinkific", "urgent"],
  },
  {
    title: "Gallup/Harvard-Certified Coach — Course Promotion",
    source: "upwork",
    sourceUrl: "https://www.upwork.com",
    description:
      "India. Social media manager for course enrollments ($350+) + GCC consulting leads. Revenue share 22-32%. Teachable/Thinkific. Premium courses on employability, strengths coaching.",
    budget: "Revenue share 22-32%",
    tags: ["coach", "upwork", "course", "teachable", "marketing"],
  },
  // Reddit — Warm Outreach
  {
    title: "r/Coaching — Coach seeking scheduling & client portal app",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/Coaching",
    description:
      "Training session scheduling, client portal with payment history and waivers. Posted ~1 year ago, 8 comments. All-in-one coaching management solution.",
    tags: ["coach", "reddit", "scheduling", "client-portal"],
  },
  {
    title: "r/smallbusiness — Personal trainer building website",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/smallbusiness",
    description:
      "Website with booking options, client login area, blog/resources. 20+ comments, 9 months ago. Custom coaching website prospect.",
    tags: ["coach", "reddit", "fitness", "website", "booking"],
  },
  {
    title: "r/Entrepreneur — Nutritionist/Health Coach website builder",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/Entrepreneur",
    description:
      "Simple site with info and appointment booking (no store). Posted 3 weeks ago, 60+ comments. Service-focused website builder.",
    tags: ["coach", "reddit", "health", "website", "booking"],
  },
  {
    title: "r/lifecoaching — Coaches seeking website inspiration/platform",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/lifecoaching",
    description:
      "Multiple coaches in sub actively looking for platforms and websites. Several recent threads, 30-70+ comments.",
    tags: ["coach", "reddit", "life-coach", "website", "platform"],
  },
  {
    title: "r/CRM — Coaching/Tutoring Business seeking CRM",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/CRM",
    description:
      "Comprehensive CRM for 60+ coaches/tutors: simple UI, scheduling, client management. 30+ comments, 5 months ago. Potential enterprise client.",
    tags: ["coach", "reddit", "crm", "enterprise"],
  },
  {
    title: "r/Carrd — Life Coach Website Built on Carrd",
    source: "reddit",
    sourceUrl: "https://reddit.com/r/Carrd",
    description:
      "Coaches discussing website builds on Carrd. 6 months ago, 10+ comments. Upsell opportunity to custom solution.",
    tags: ["coach", "reddit", "life-coach", "carrd", "website"],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const p of prospects) {
    const existing = await db.lead.findFirst({
      where: {
        title: { equals: p.title, mode: "insensitive" },
        source: p.source,
      },
    });
    if (existing) {
      console.log(`Skip (exists): ${p.title}`);
      skipped++;
      continue;
    }

    const { budget, timeline, ...rest } = p as typeof p & { budget?: string; timeline?: string };
    await db.lead.create({
      data: {
        ...rest,
        budget: budget ?? undefined,
        timeline: timeline ?? undefined,
        tags: (rest.tags as string[]) ?? [],
      },
    });
    console.log(`Created: ${p.title}`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
