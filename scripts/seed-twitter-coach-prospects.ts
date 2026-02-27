/**
 * Seed 25 Twitter/X coach prospects into pipeline leads.
 * Run: npx tsx scripts/seed-twitter-coach-prospects.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";

const prospects = [
  // Category 1: Actively seeking website/web needs
  {
    title: "Dret — Life Coach (Web Design)",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com",
    description:
      "Posted 'Just Launched: A Stunning Website for a Life Coach. Need a website that works while you coach? Let's talk!' — #WebDesign #LifeCoach #CoachingBusiness. Already in the coaching website space — direct client or referral partner.",
    tags: ["coach", "twitter", "webdesign", "life-coach"],
  },
  {
    title: "Var (verified) — Preparing Next Phase",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com",
    description:
      "'Need to setup a website as I prepare for my next phase of my life' — Mar 31, 2025. Actively looking for a website builder.",
    tags: ["coach", "twitter", "website"],
  },
  {
    title: "ChrisBOn / CBOTWMedia — Coaching Community",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/CBOTWMedia",
    description:
      "'I plan on continuing to coach and mentor people. So I will be adding Coaching services to the community tab on the website ASAP.' Needs website features for coaching services.",
    tags: ["coach", "twitter", "website", "community"],
  },
  {
    title: "Grady S Simmons — The Legal Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/La12185Lawyer",
    description:
      "Legal coach. New website launch at TheLegal.coach. Provides legal courses. Likely needs improvements, course platform, booking.",
    tags: ["coach", "twitter", "legal-coach", "course"],
  },
  {
    title: "Imp — Coach with Booking System",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com",
    description:
      "'I just paid for a website w a booking system so I could coach ppl.' Recently invested — needs upgrades or support.",
    tags: ["coach", "twitter", "booking", "website"],
  },
  {
    title: "Pavan Teja — AI for High-Ticket Coaching",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/PavanTeja05",
    description:
      "Discusses AI employees for 'high-ticket coaching business' and website chatbots. Interested in web app functionality for coaching.",
    tags: ["coach", "twitter", "ai", "webapp"],
  },
  {
    title: "Mohammad Faizan K — Coaching Business",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com",
    description:
      "'Coach with no website in 2026? Then you're not a coach.' — #CoachingBusiness #PersonalBrand. Actively promoting need for coaching websites — warm prospect.",
    tags: ["coach", "twitter", "website"],
  },
  {
    title: "Ernest Davis — Coaching Programs",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/ErnestCDavis",
    description:
      "Working to grow coaching business, promoting programs for client acquisition. Needs professional website with conversion funnels.",
    tags: ["coach", "twitter", "website", "funnel"],
  },
  // Category 2: Coach-focused profiles
  {
    title: "Dr. Andrea Arlington — Trauma-Informed Life Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/andreaarlington",
    description:
      "Certified Trauma-Informed ICF Life Coach, Family Recovery & Relationship Coach, speaker, author, online course creator. Needs course platform, booking, client portal.",
    tags: ["coach", "twitter", "life-coach", "course", "booking"],
  },
  {
    title: "Pratima Kumar — Life & Wellness Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/pjais",
    description:
      "Certified Life Coach, Wellness Coach, Aura Reader & Author. Developed Online Course on Self-help. Has online course — needs proper platform/website.",
    tags: ["coach", "twitter", "wellness", "course"],
  },
  {
    title: "Claudia Armani — Health Coach London (verified)",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/HealthCoachLond",
    description:
      "TOP 10 UK Health Coach, Quit Sugar online course, Pilates teacher. Needs online course hosting, booking system.",
    tags: ["coach", "twitter", "health", "course", "booking"],
  },
  {
    title: "Tim Johns — ThreePieceLife Business Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/oratotim",
    description:
      "Business coach and consultant, founder of ThreePieceLife — an online coaching course. Has online course — ideal for webapp/website pitch.",
    tags: ["coach", "twitter", "business-coach", "course"],
  },
  {
    title: "Elder Langhorne — The Genesis System",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/elderlanghorne",
    description:
      "Consultant-Coach-Trainer, Developer of The Genesis System — Five Steps to Improve Business, Health, Relationships & Life. Online Course. Perfect for comprehensive coaching website + course platform.",
    tags: ["coach", "twitter", "course", "transformation"],
  },
  {
    title: "Crockett Wellness & Life Coaching",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/lifecoacheshelp",
    description:
      "Certified Life Coach, Transformation Coach, Executive Coach, Confidence Coach, Mindset Coach, CBT Coaching. Multiple services — needs professional website with booking.",
    tags: ["coach", "twitter", "life-coach", "booking"],
  },
  {
    title: "Coach Nita (Anita Dailey) — Mindset Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/AnitaDailey4",
    description:
      "Speaker, Educator, Life Transformation Coach — guiding stronger mindsets. Needs website, booking system, possibly online course platform.",
    tags: ["coach", "twitter", "mindset", "booking"],
  },
  {
    title: "Vinod Krishnan — ICF Leadership Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/Ayyozhi",
    description:
      "ICF Leadership Coach, NLP practitioner. Helps leaders break free from Self-Doubt & Transform Leadership in 90 days. Structured program — ideal for client portal + webapp.",
    tags: ["coach", "twitter", "leadership", "client-portal"],
  },
  {
    title: "Dr. Missy Johnson — Transformation Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/AskDrMissy",
    description:
      "Transformation Coach for high-achieving women. Mindset, Message, Market. Needs professional website, booking, and course platform.",
    tags: ["coach", "twitter", "transformation", "booking", "course"],
  },
  {
    title: "Sabie Ntshakaza — Mindful Life Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/mindfulife_co",
    description:
      "Mindset Transformation Coach, Certified Life Coach & NLP Practitioner. Creating Safe Spaces. Needs website with booking and client portal.",
    tags: ["coach", "twitter", "mindset", "booking", "client-portal"],
  },
  {
    title: "Melissa J. Nixon — Mindset & Transformation Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/melissajnixon",
    description:
      "Mindset & Transformation Coach, Speaker, Trainer. #TheRequiredLife. Speaking + coaching — needs website, booking, event registration.",
    tags: ["coach", "twitter", "mindset", "booking", "events"],
  },
  // Category 3: Wellness & Personal Development
  {
    title: "Lez Wright — Health & Wellness Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/lezwright",
    description:
      "Health, Wellness & Personal Development Coach. Needs comprehensive coaching website.",
    tags: ["coach", "twitter", "wellness", "health"],
  },
  {
    title: "Demetrice Etheridge — Chews 4 Life",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/chews4Life",
    description:
      "Health & Wellness, Personal Development Coach, Mentor, Internet Marketing 2.0. Interested in online marketing — prime for website pitch.",
    tags: ["coach", "twitter", "wellness", "marketing"],
  },
  {
    title: "Jackie Mandeir — Lifestyle & Wellness Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/JackieMandeir",
    description:
      "Owner: jackiemandeir.com. Lifestyle & Wellness Coach, NLP & MBTI Practitioner, Personal Development Consultant. Already has domain — likely needs redesign or upgrades.",
    tags: ["coach", "twitter", "wellness", "website"],
  },
  {
    title: "Coach Rosie K — Relationship & Confidence Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/thiskindagirl22",
    description:
      "rosiekaycoaching.com. Relationship & Confidence Coach. Has domain — needs website improvements, booking, client portal.",
    tags: ["coach", "twitter", "relationship", "booking", "client-portal"],
  },
  {
    title: "E.W. — The Girl Get Up Collective",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/Ms_EricaWare",
    description:
      "Personal Empowerment Specialist, formerly 'The Confidence Coach.' Founder of The Girl Get Up Collective. Needs website, course platform, community portal.",
    tags: ["coach", "twitter", "empowerment", "course", "community"],
  },
  {
    title: "Sarah — Mindset Transformation Coach",
    source: "coach_prospect",
    sourceUrl: "https://twitter.com/selflovewithsk",
    description:
      "From wheelchair to rock climbing — coaching YOU to harness your mindset + create your life. Compelling story — needs a website to showcase her transformation coaching.",
    tags: ["coach", "twitter", "mindset", "transformation"],
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

    await db.lead.create({
      data: {
        ...p,
        tags: p.tags as string[],
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
